import crypto from 'crypto'
import type { Sale, WhatsAppKind } from '@prisma/client'
import prisma from '@/lib/prisma'
import { cleanPhone } from '@/lib/orderRefs'
import { trackingLink } from '@/lib/leopards'
import { DEFAULT_TEMPLATES, renderTemplate, pickVariant, type TemplateKey } from '@/lib/whatsappTemplates'
import { type Actor, SYSTEM, WHATSAPP, WA_KIND_WORDS, logOrder } from '@/lib/orderLog'

// WhatsApp customer messages, sent through our own whatsmeow service (wa-service/).
//
// Flow: notifyOrder() saves a WhatsAppMessage row and hands it to wa-service, which queues it,
// sends it (with an anti-ban gap) and reports back to /api/whatsapp/webhook (sent / failed).
// Customer replies come back to the same webhook and are matched to the order there.
// Every message in and out is also kept in WhatsAppChat, for the order's Chat window.
//
// Nothing here throws: a WhatsApp problem must never stop an order from being saved.

const SERVICE_URL = (process.env.WA_SERVICE_URL || '').replace(/\/+$/, '')
const API_SECRET = process.env.WA_API_SECRET || ''
const WEBHOOK_SECRET = process.env.WA_WEBHOOK_SECRET || ''
const REVIEW_URL = process.env.REVIEW_URL || ''
const BUSINESS_NAME = process.env.BUSINESS_NAME || ''

export const whatsappEnabled = () => Boolean(SERVICE_URL && API_SECRET)

// A plain text to the owners (daily report), not tied to an order. Sent straight away (skips quiet
// hours). Returns the error text, or null when wa-service accepted it.
export async function sendOwnerMessage(phone: string, text: string): Promise<string | null> {
  if (!whatsappEnabled()) return 'WhatsApp service is not set up (WA_SERVICE_URL / WA_API_SECRET).'
  const to = toWaPhone(phone)
  if (!to) return `Not a valid phone number: ${phone}`
  try {
    const res = await fetch(`${SERVICE_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_SECRET}` },
      // refId is not a WhatsAppMessage row: the sent / failed webhook simply ignores it
      body: JSON.stringify({ refId: `owner_${Date.now()}_${to}`, phone: to, text, priority: 'now' }),
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (res.ok) return null
    const data = await res.json().catch(() => ({}))
    return data?.error || `WhatsApp service error (${res.status})`
  } catch (err: any) {
    return err?.name === 'TimeoutError' ? 'WhatsApp service did not answer in time.' : `WhatsApp service unreachable: ${err?.message || err}`
  }
}

// Customer phone in WhatsApp's international form (digits only), e.g. "0300-1234567" → "923001234567".
// Numbers without a country code are taken as Pakistani.
export function toWaPhone(v: unknown): string | null {
  const cleaned = cleanPhone(v)
  if (!cleaned) return null
  let d = cleaned.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = '92' + d.slice(1) // 03001234567
  else if (d.length === 10 && d.startsWith('3')) d = '92' + d // 3001234567
  return d.length >= 11 && d.length <= 13 ? d : null
}

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`

const productsLine = (rows: Sale[]) =>
  rows.map((r) => (r.quantity > 1 ? `${r.productName} ×${r.quantity}` : r.productName)).join(', ')

// ── Message templates (editable on the WhatsApp page, saved in WhatsAppTemplate) ──

export const templateKeyFor = (kind: Exclude<WhatsAppKind, 'BILL' | 'ANSWER_LOCKED'>, response?: 'CONFIRMED' | 'CANCELLED'): TemplateKey =>
  kind === 'REPLY_ACK' ? (response === 'CANCELLED' ? 'REPLY_CANCELLED' : 'REPLY_CONFIRMED') : kind

// The saved wordings (or the defaults) and whether the message is switched on
export async function getTemplate(key: TemplateKey): Promise<{ bodies: string[]; enabled: boolean; lastVariant: number; saved: boolean }> {
  const row = await prisma.whatsAppTemplate.findUnique({ where: { key } }).catch(() => null)
  if (!row) return { bodies: DEFAULT_TEMPLATES[key], enabled: true, lastVariant: defaultLast.get(key) ?? -1, saved: false }
  const bodies = [row.body, ...(row.variants || [])].filter((b) => b.trim())
  return { bodies: bodies.length ? bodies : DEFAULT_TEMPLATES[key], enabled: row.enabled, lastVariant: row.lastVariant, saved: true }
}

// Wording used last for templates that were never saved (no row to remember it in)
const defaultLast = new Map<TemplateKey, number>()

// One wording for this send: random, never the same one as last time
async function chooseBody(key: TemplateKey): Promise<{ body: string; enabled: boolean }> {
  const tpl = await getTemplate(key)
  const i = pickVariant(tpl.bodies.length, tpl.lastVariant)
  if (tpl.saved) {
    await prisma.whatsAppTemplate.update({ where: { key }, data: { lastVariant: i } }).catch(() => undefined)
  } else {
    defaultLast.set(key, i)
  }
  return { body: tpl.bodies[i], enabled: tpl.enabled }
}

// ── Switches: WhatsApp as a whole, and per order source (Settings) ──

const MASTER_KEY = 'whatsapp.enabled'

export async function isWhatsAppOn(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: MASTER_KEY } }).catch(() => null)
  return row ? row.value !== 'false' : true
}

export async function setWhatsAppOn(on: boolean) {
  await prisma.appSetting.upsert({
    where: { key: MASTER_KEY },
    create: { key: MASTER_KEY, value: String(on) },
    update: { value: String(on) },
  })
}

// May this order's customer get anything on WhatsApp? null = yes, else the reason why not.
export async function whatsappBlockedFor(orderSourceId: string | null | undefined): Promise<string | null> {
  if (!(await isWhatsAppOn())) return 'WhatsApp is switched off in Settings.'
  if (orderSourceId) {
    const src = await prisma.orderSource.findUnique({ where: { id: orderSourceId }, select: { name: true, whatsappEnabled: true } })
    if (src && !src.whatsappEnabled) return `WhatsApp is off for ${src.name} orders (Settings).`
  }
  return null
}

// ── Opt-out (customer replied STOP) ──

const STOP_WORDS = ['stop', 'unsubscribe', 'stop karo', 'band karo', 'mat bhejo', 'msg mat karo', 'message mat karo']
const START_WORDS = ['start', 'subscribe', 'resume']
const normalize = (t: string) => t.trim().toLowerCase().replace(/[.!,*]+/g, ' ').replace(/\s+/g, ' ').trim()

export const isStopMessage = (text: string) => STOP_WORDS.includes(normalize(text))
export const isStartMessage = (text: string) => START_WORDS.includes(normalize(text))

export const isOptedOut = async (phone: string) =>
  Boolean(await prisma.whatsAppOptOut.findUnique({ where: { phone } }).catch(() => null))

export async function setOptOut(phone: string, out: boolean) {
  if (out) await prisma.whatsAppOptOut.upsert({ where: { phone }, create: { phone }, update: {} })
  else await prisma.whatsAppOptOut.deleteMany({ where: { phone } })
}

// Has this customer ever written to us? (links are only sent to people who have)
const hasReplied = async (phone: string) =>
  (await prisma.whatsAppChat.count({ where: { phone, direction: 'IN' } }).catch(() => 0)) > 0

export function orderValues(rows: Sale[]): Record<string, string> {
  const lead = rows[0]
  return {
    name: lead.customerName || '',
    orderNo: lead.orderNo ? `#${lead.orderNo}` : '',
    products: productsLine(rows),
    total: rs(rows.reduce((a, r) => a + r.soldPrice * r.quantity, 0)),
    address: lead.address || '',
    city: lead.city || '',
    tracking: lead.trackingNumber || '',
    trackingLink: trackingLink(lead.trackingNumber),
    reviewUrl: REVIEW_URL,
    business: BUSINESS_NAME,
  }
}

// All products of an order (a parcel shares one order number)
export const loadOrder = (orderNo: number) =>
  prisma.sale.findMany({ where: { orderNo }, orderBy: { createdAt: 'asc' } })

// ── Confirm / Cancel poll (sent right after the order confirmation text) ──

// Fixed on purpose: a vote only carries a hash of the option's text, so changing these would stop
// votes on polls that were already sent from being understood. Index 0 = confirm, 1 = cancel.
export const POLL_OPTIONS = ['✅ Confirm', '❌ Cancel'] as const

const POLL_QUESTIONS = [
  '{Order|Apna order} {orderNo} confirm {karein|kar dein}?',
  'Kya hum order {orderNo} {bhej dein|dispatch kar dein}?',
  'Order {orderNo}: {confirm ya cancel?|aap ka jawab?}',
]

const pollQuestion = (values: Record<string, string>) =>
  renderTemplate(POLL_QUESTIONS[Math.floor(Math.random() * POLL_QUESTIONS.length)], values).slice(0, 255)

export const responseForOption = (index: number): 'CONFIRMED' | 'CANCELLED' | null =>
  index === 0 ? 'CONFIRMED' : index === 1 ? 'CANCELLED' : null

const answerLabel = (r: 'CONFIRMED' | 'CANCELLED') => (r === 'CONFIRMED' ? POLL_OPTIONS[0] : POLL_OPTIONS[1])

const ANSWER_LOCKED_TEXT = [
  '{name}, aap ka pehla jawab ({answer}) order {orderNo} ke liye {save ho chuka hai|humare paas save hai} 👍',
  'Agar isay badalna ho to {humein call ya message karein|humein message ya call kar dein}.',
  '',
  '— {business}',
].join('\n')

// The customer's first confirm / cancel is final (a poll vote can be changed any time, so later
// taps must not flip the order back and forth):
//   'saved'   first answer: stored on the order, thank-you sent
//   'same'    the same answer again (a repeated tap or webhook): nothing happens
//   'locked'  a different answer later: the order keeps the first one; the customer is told once
export async function applyCustomerResponse(orderNo: number, response: 'CONFIRMED' | 'CANCELLED'): Promise<'saved' | 'same' | 'locked'> {
  // Only an order still waiting for an answer takes it (atomic, so two quick taps can't both win)
  const { count } = await prisma.sale.updateMany({
    where: { orderNo, customerResponse: { in: ['NONE', 'PENDING'] } },
    data: { customerResponse: response, customerRespondedAt: new Date() },
  })
  const lead = await prisma.sale.findFirst({ where: { orderNo }, select: { customerResponse: true, customerName: true } })
  const customer: Actor = { source: 'CUSTOMER', name: lead?.customerName || 'Customer' }
  if (count > 0) {
    await logOrder({
      orderNo,
      action: 'customer_response',
      message: response === 'CONFIRMED' ? 'Customer confirmed the order on WhatsApp' : 'Customer cancelled the order on WhatsApp',
      actor: customer,
      details: { response },
    })
    await notifyOrder(orderNo, 'REPLY_ACK', { force: true, response })
    return 'saved'
  }
  if (!lead || lead.customerResponse === response) return 'same'
  if (lead.customerResponse === 'CONFIRMED' || lead.customerResponse === 'CANCELLED') {
    await logOrder({
      orderNo,
      action: 'customer_response',
      message: `Customer tried to change their answer to ${response === 'CONFIRMED' ? 'Confirm' : 'Cancel'} (ignored: the first answer, ${
        lead.customerResponse === 'CONFIRMED' ? 'Confirm' : 'Cancel'
      }, stays)`,
      actor: customer,
      details: { tried: response, kept: lead.customerResponse },
    })
    await tellAnswerLocked(orderNo, lead.customerResponse)
  }
  return 'locked'
}

// "Your first answer is saved, call or message us to change it": at most once per order. Never throws.
async function tellAnswerLocked(orderNo: number, first: 'CONFIRMED' | 'CANCELLED'): Promise<void> {
  try {
    const rows = await loadOrder(orderNo)
    const phone = rows.length ? toWaPhone(rows[0].customerPhone) : null
    if (!phone || (await whatsappBlockedFor(rows[0].orderSourceId)) || (await isOptedOut(phone))) return
    const body = renderTemplate(ANSWER_LOCKED_TEXT, { ...orderValues(rows), answer: answerLabel(first) })
    // The unique (order, kind) makes this a one-time message: a second attempt fails here
    const msg = await prisma.whatsAppMessage.create({ data: { orderNo, kind: 'ANSWER_LOCKED', phone, body } }).catch(() => null)
    if (msg) await pushToService(msg, { priority: 'now' })
  } catch (err) {
    console.error(`WhatsApp answer-locked note for #${orderNo} failed:`, err)
  }
}

// Hand one saved message to wa-service and record the outcome on its row.
// With `image`, the message goes out as a picture and `body` is its caption.
// priority 'now': an answer to something the customer just did (their reply, a bill we chose to send);
// it skips quiet hours and the daily limit. 'normal' (automatic order updates) waits for them.
// Returns the error text, or null when it was queued.
async function pushToService(
  msg: { id: string; phone: string; body: string },
  opts: {
    priority: 'now' | 'normal'
    image?: { data: ArrayBuffer; mime: 'image/png' | 'image/jpeg' }
    poll?: { question: string; options: string[] } // sent right after the text
  },
): Promise<string | null> {
  let error: string | null = null
  let scheduledFor: Date | null = null
  if (!whatsappEnabled()) {
    error = 'WhatsApp service is not set up (WA_SERVICE_URL / WA_API_SECRET).'
  } else {
    try {
      const res = await fetch(`${SERVICE_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_SECRET}` },
        body: JSON.stringify({
          refId: msg.id,
          phone: msg.phone,
          text: msg.body,
          priority: opts.priority,
          ...(opts.image ? { image: Buffer.from(opts.image.data).toString('base64'), mime: opts.image.mime } : {}),
          ...(opts.poll ? { poll: opts.poll } : {}),
        }),
        signal: AbortSignal.timeout(opts.image ? 20000 : 8000),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const at = data?.scheduledFor ? new Date(data.scheduledFor) : null
        scheduledFor = at && !isNaN(at.getTime()) && at.getTime() > Date.now() + 60_000 ? at : null
      } else {
        error = data?.error || `WhatsApp service error (${res.status})`
      }
    } catch (err: any) {
      error = err?.name === 'TimeoutError' ? 'WhatsApp service did not answer in time.' : `WhatsApp service unreachable: ${err?.message || err}`
    }
  }
  const row = await prisma.whatsAppMessage.update({
    where: { id: msg.id },
    data: { attempts: { increment: 1 }, scheduledFor, ...(error ? { status: 'FAILED', error } : {}) },
  })
  // Order history: could not even hand it to the service, or it waits for quiet hours to end
  if (error) {
    await logOrder({
      orderNo: row.orderNo,
      action: 'whatsapp_failed',
      message: `WhatsApp ${WA_KIND_WORDS[row.kind] || 'message'} failed: ${error}`,
      actor: WHATSAPP,
      details: { kind: row.kind, error },
    })
  } else if (scheduledFor) {
    await logOrder({
      orderNo: row.orderNo,
      action: 'whatsapp_scheduled',
      message: `WhatsApp ${WA_KIND_WORDS[row.kind] || 'message'} waiting, goes out ${scheduledFor.toLocaleString('en-GB', {
        timeZone: 'Asia/Karachi',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      actor: WHATSAPP,
      details: { kind: row.kind, scheduledFor },
    })
  }
  return error
}

interface NotifyOptions {
  // Send again even if this message was already sent (e.g. the customer changed their reply)
  force?: boolean
  response?: 'CONFIRMED' | 'CANCELLED'
}

// Sends the message for one step of an order. Each (order, kind) is sent once, so moving a status
// back and forth never spams the customer. Never throws.
export async function notifyOrder(orderNo: number | null | undefined, kind: Exclude<WhatsAppKind, 'BILL' | 'ANSWER_LOCKED'>, opts: NotifyOptions = {}): Promise<void> {
  if (!orderNo) return
  // Order history: why a message did not go out
  const skipped = (reason: string) =>
    logOrder({
      orderNo,
      action: 'whatsapp_skipped',
      message: `WhatsApp ${WA_KIND_WORDS[kind] || 'message'} not sent: ${reason}`,
      actor: SYSTEM,
      details: { kind, reason },
    })
  try {
    const rows = await loadOrder(orderNo)
    if (!rows.length) return
    const phone = toWaPhone(rows[0].customerPhone)
    if (!phone) return skipped('no valid customer phone number')
    // WhatsApp off (everywhere, or for this order's source, e.g. Daraz): nothing at all goes out
    const blocked = await whatsappBlockedFor(rows[0].orderSourceId)
    if (blocked) return skipped(blocked.replace(/\.$/, ''))

    const existing = await prisma.whatsAppMessage.findUnique({ where: { orderNo_kind: { orderNo, kind } } })
    if (existing && !opts.force && existing.status !== 'FAILED') return // already sent / on its way

    // The customer replied STOP: record why nothing went out (shown on the order)
    if (await isOptedOut(phone)) {
      const error = 'Customer replied STOP, so no automatic messages are sent to them.'
      await prisma.whatsAppMessage.upsert({
        where: { orderNo_kind: { orderNo, kind } },
        create: { orderNo, kind, phone, body: '', status: 'FAILED', error },
        update: { status: 'FAILED', error, scheduledFor: null },
      })
      return skipped('the customer replied STOP')
    }

    const tpl = await chooseBody(templateKeyFor(kind, opts.response))
    if (!tpl.enabled) return skipped('this message is switched off on the WhatsApp page') // switched off on the WhatsApp page
    const values = orderValues(rows)
    // no links to people who never wrote back (or voted): links from unknown numbers look like spam
    if ((values.reviewUrl || values.trackingLink) && !(await hasReplied(phone))) {
      values.reviewUrl = ''
      values.trackingLink = ''
    }
    const body = renderTemplate(tpl.body, values)
    if (!body) return

    const msg = await prisma.whatsAppMessage.upsert({
      where: { orderNo_kind: { orderNo, kind } },
      create: { orderNo, kind, phone, body },
      update: { phone, body, status: 'PENDING', error: null, waMessageId: null, sentAt: null, scheduledFor: null },
    })

    // The order now waits for the customer's confirm / cancel reply
    if (kind === 'ORDER_CONFIRM' && rows[0].customerResponse === 'NONE') {
      await prisma.sale.updateMany({ where: { orderNo }, data: { customerResponse: 'PENDING' } })
    }

    const error = await pushToService(msg, {
      priority: kind === 'REPLY_ACK' ? 'now' : 'normal',
      // Confirm / Cancel as a poll the customer taps (typing 1 / 2 still works too)
      ...(kind === 'ORDER_CONFIRM' ? { poll: { question: pollQuestion(values), options: [...POLL_OPTIONS] } } : {}),
    })
    if (error) console.warn(`WhatsApp ${kind} for #${orderNo} not sent: ${error}`)
  } catch (err) {
    console.error(`WhatsApp ${kind} for #${orderNo} failed:`, err)
  }
}

// Sends an order's bill picture to the customer (from the Bill window). Can be sent again any time.
// Returns the error text, or null when it was queued.
export async function sendBill(orderNo: number, customerPhone: unknown, png: ArrayBuffer, caption: string): Promise<string | null> {
  const phone = toWaPhone(customerPhone)
  if (!phone) return 'This order has no valid customer phone number.'
  try {
    const msg = await prisma.whatsAppMessage.upsert({
      where: { orderNo_kind: { orderNo, kind: 'BILL' } },
      create: { orderNo, kind: 'BILL', phone, body: caption },
      update: { phone, body: caption, status: 'PENDING', error: null, waMessageId: null, sentAt: null, scheduledFor: null },
    })
    // Sent by hand from the Bill window: goes now, even at night
    return await pushToService(msg, { priority: 'now', image: { data: png, mime: 'image/png' } })
  } catch (err: any) {
    console.error(`WhatsApp bill for #${orderNo} failed:`, err)
    return err?.message || 'Could not send the bill'
  }
}

// The WhatsApp messages of each order, for the orders list (confirm / dispatched / delivered / bill)
export async function whatsappByOrder(orderNos: number[]) {
  const map = new Map<
    number,
    { kind: WhatsAppKind; status: string; error: string | null; sentAt: Date | null; updatedAt: Date; scheduledFor: Date | null }[]
  >()
  if (!orderNos.length) return map
  const msgs = await prisma.whatsAppMessage.findMany({
    where: { orderNo: { in: orderNos }, kind: { notIn: ['REPLY_ACK', 'ANSWER_LOCKED'] } },
    orderBy: { kind: 'asc' }, // stable order, so the list can tell when something changed
    select: { orderNo: true, kind: true, status: true, error: true, sentAt: true, updatedAt: true, scheduledFor: true },
  })
  for (const { orderNo, ...m } of msgs) {
    const list = map.get(orderNo)
    if (list) list.push(m)
    else map.set(orderNo, [m])
  }
  return map
}

// Which message (if any) a status change should send
export const kindForStatus = (status: string): Exclude<WhatsAppKind, 'BILL' | 'ANSWER_LOCKED'> | null =>
  status === 'PACKING' ? 'ORDER_CONFIRM' : status === 'DISPATCHED' ? 'DISPATCHED' : status === 'DELIVERED' ? 'DELIVERED' : null

// ── Chat log ──

// Saves one message of a conversation. Repeated webhooks carry the same WhatsApp id, so they are skipped.
export async function logChat(entry: {
  phone: string
  direction: 'IN' | 'OUT'
  body: string
  orderNo?: number | null
  manual?: boolean
  waMessageId?: string | null
  at?: Date
}): Promise<void> {
  try {
    await prisma.whatsAppChat.createMany({
      data: [
        {
          phone: entry.phone,
          direction: entry.direction,
          body: entry.body.slice(0, 4000),
          orderNo: entry.orderNo ?? null,
          manual: entry.manual ?? false,
          waMessageId: entry.waMessageId || null,
          ...(entry.at ? { createdAt: entry.at } : {}),
        },
      ],
      skipDuplicates: true,
    })
  } catch (err) {
    console.error('WhatsApp chat log failed:', err)
  }
}

// ── Webhook security ──

// wa-service signs each webhook body with HMAC-SHA256 (header: X-WA-Signature: sha256=<hex>)
export function verifySignature(rawBody: string, header: string | null): boolean {
  if (!WEBHOOK_SECRET || !header) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ── Customer replies ──

const CONFIRM_WORDS = new Set(['1', 'confirm', 'confirmed', 'yes', 'haan', 'han', 'ha', 'hn', 'ji', 'jee', 'ok', 'okay', 'done', 'theek', 'thik', '✅', '👍'])
const CANCEL_WORDS = new Set(['2', 'cancel', 'cancelled', 'canceled', 'no', 'nahi', 'nahin', 'nhi', 'na', '❌'])

// "1", "Confirm", "2 #1045", "cancel 1045" → the answer and an optional order number
export function parseReply(text: string): { response: 'CONFIRMED' | 'CANCELLED'; orderNo: number | null } | null {
  const t = text.trim().toLowerCase().replace(/[.!,*]+/g, ' ')
  if (!t || t.length > 40) return null // a long message is a question for a human, not a reply
  const tokens = t.split(/\s+/).filter(Boolean)
  const first = tokens[0]
  const response = CONFIRM_WORDS.has(first) ? 'CONFIRMED' : CANCEL_WORDS.has(first) ? 'CANCELLED' : null
  if (!response) return null
  const numToken = tokens.slice(1).find((x) => /^#?\d{3,}$/.test(x))
  return { response, orderNo: numToken ? parseInt(numToken.replace('#', ''), 10) : null }
}

// The order a customer's reply is about:
// 1) the confirm message they swiped-to-reply on, 2) an order number they typed,
// 3) their newest order still waiting for a reply, 4) their newest order still being packed (change of mind).
export async function findOrderForReply(phone: string, quotedId: string | null, typedOrderNo: number | null): Promise<number | null> {
  if (quotedId) {
    const quoted = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: quotedId } })
    if (quoted && quoted.phone === phone && quoted.kind === 'ORDER_CONFIRM') return quoted.orderNo
  }

  const confirms = await prisma.whatsAppMessage.findMany({
    where: { phone, kind: 'ORDER_CONFIRM', status: 'SENT' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { orderNo: true },
  })
  if (!confirms.length) return null
  const orderNos = confirms.map((c) => c.orderNo)

  if (typedOrderNo && orderNos.includes(typedOrderNo)) return typedOrderNo

  const orders = await prisma.sale.findMany({
    where: { orderNo: { in: orderNos } },
    distinct: ['orderNo'],
    select: { orderNo: true, status: true, customerResponse: true },
  })
  const byNo = new Map(orders.map((o) => [o.orderNo, o]))
  const waiting = orderNos.find((n) => byNo.get(n)?.customerResponse === 'PENDING')
  if (waiting) return waiting
  return orderNos.find((n) => byNo.get(n)?.status === 'PACKING') ?? null
}
