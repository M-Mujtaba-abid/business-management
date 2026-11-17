import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  verifySignature,
  parseReply,
  findOrderForReply,
  notifyOrder,
  logChat,
  isStopMessage,
  isStartMessage,
  setOptOut,
} from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// Called by wa-service (signed with WA_WEBHOOK_SECRET):
//   { type: 'sent',    refId, messageId }         a queued message reached WhatsApp
//   { type: 'failed',  refId, error }             it could not be sent
//   { type: 'message', from, text, quotedId?, messageId, media?, fromMe? }
//        a customer wrote to us (fromMe: we typed it on the business phone; media: photo / voice note…)
type WebhookEvent =
  | { type: 'sent'; refId: string; messageId: string }
  | { type: 'failed'; refId: string; error: string }
  | {
      type: 'message'
      from: string
      text: string
      quotedId?: string | null
      messageId: string
      media?: boolean
      fromMe?: boolean
      timestamp?: number
    }

export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (!verifySignature(raw, request.headers.get('x-wa-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let evt: WebhookEvent
  try {
    evt = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    if (evt.type === 'sent' || evt.type === 'failed') {
      // updateMany: an unknown refId (e.g. a deleted order) is simply ignored
      await prisma.whatsAppMessage.updateMany({
        where: { id: evt.refId },
        data:
          evt.type === 'sent'
            ? { status: 'SENT', waMessageId: evt.messageId, sentAt: new Date(), error: null, scheduledFor: null }
            : { status: 'FAILED', error: String(evt.error || 'Unknown error').slice(0, 500) },
      })
      if (evt.type === 'sent') {
        const msg = await prisma.whatsAppMessage.findUnique({ where: { id: evt.refId } })
        if (msg) await logChat({ phone: msg.phone, direction: 'OUT', body: msg.body, orderNo: msg.orderNo, waMessageId: evt.messageId })
      }
      return NextResponse.json({ ok: true })
    }

    if (evt.type === 'message') {
      const phone = String(evt.from || '').replace(/\D/g, '')
      const text = String(evt.text || '')
      if (!phone || !text) return NextResponse.json({ ok: true, matched: false })
      const at = evt.timestamp ? new Date(evt.timestamp * 1000) : undefined

      // Typed on the business phone: only goes into the chat
      if (evt.fromMe) {
        await logChat({ phone, direction: 'OUT', body: text, manual: true, waMessageId: evt.messageId, at })
        return NextResponse.json({ ok: true, logged: true })
      }

      // STOP / START: no more automatic messages to this customer, or allow them again
      if (!evt.media && (isStopMessage(text) || isStartMessage(text))) {
        await logChat({ phone, direction: 'IN', body: text, waMessageId: evt.messageId, at })
        await setOptOut(phone, isStopMessage(text))
        return NextResponse.json({ ok: true, optedOut: isStopMessage(text) })
      }

      const reply = evt.media ? null : parseReply(text)
      const orderNo = reply ? await findOrderForReply(phone, evt.quotedId || null, reply.orderNo) : null
      await logChat({ phone, direction: 'IN', body: text, orderNo, waMessageId: evt.messageId, at })
      if (!reply) return NextResponse.json({ ok: true, matched: false })

      if (!orderNo) return NextResponse.json({ ok: true, matched: false })

      const lead = await prisma.sale.findFirst({ where: { orderNo }, select: { customerResponse: true } })
      // Same answer again (or a repeated webhook): nothing changes, no second thank-you
      if (lead?.customerResponse === reply.response) {
        return NextResponse.json({ ok: true, matched: true, orderNo, unchanged: true })
      }

      await prisma.sale.updateMany({
        where: { orderNo },
        data: { customerResponse: reply.response, customerRespondedAt: new Date() },
      })
      await notifyOrder(orderNo, 'REPLY_ACK', { force: true, response: reply.response })
      return NextResponse.json({ ok: true, matched: true, orderNo, response: reply.response })
    }

    return NextResponse.json({ ok: true, ignored: true })
  } catch (error: any) {
    console.error('WhatsApp webhook error:', error)
    // 500 makes wa-service retry
    return NextResponse.json({ error: error.message || 'Webhook failed' }, { status: 500 })
  }
}
