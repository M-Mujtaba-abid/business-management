import fs from 'fs/promises'
import path from 'path'
import { ImageResponse } from 'next/og'
import prisma from '@/lib/prisma'
import { whatsappBlockedFor } from '@/lib/whatsapp'

// The order bill (design "A · Classic invoice"), drawn as a PNG on the server so the same image
// is downloaded, shared and sent on WhatsApp.

export const SHOP = {
  name: 'Fancy Store',
  whatsapp: process.env.BILL_WHATSAPP || '0341-4159747',
}

const ACCENT = '#0f766e'
const S = 2 // drawn at 2× so the bill stays sharp on phones
const W = 600

export interface BillItem {
  name: string
  qty: number
  price: number
}

export interface BillData {
  orderNo: number | null
  date: Date
  customerName: string
  customerPhone: string | null
  address: string
  city: string
  source: string | null
  externalOrderId: string | null
  trackingNumber: string | null
  items: BillItem[]
  delivery: number
  // null = WhatsApp allowed for this order; else why not (e.g. Daraz). Then the bill shows no WhatsApp number.
  whatsappBlocked: string | null
}

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`
const px = (n: number) => n * S

// Every product of the order the sale belongs to (a parcel shares one order number)
export async function loadBill(saleId: string, delivery: number): Promise<BillData | null> {
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { orderSource: true } })
  if (!sale) return null
  const rows = sale.orderNo
    ? await prisma.sale.findMany({ where: { orderNo: sale.orderNo }, orderBy: { createdAt: 'asc' } })
    : sale.parcelId
      ? await prisma.sale.findMany({ where: { parcelId: sale.parcelId }, orderBy: { createdAt: 'asc' } })
      : [sale]

  const clean = (v: string | null | undefined, skip: string[] = []) => {
    const t = (v || '').trim()
    return t && !skip.includes(t) ? t : ''
  }

  return {
    orderNo: sale.orderNo,
    date: sale.createdAt,
    customerName: clean(sale.customerName, ['Walk-in']) || 'Customer',
    customerPhone: clean(sale.customerPhone) || null,
    address: clean(sale.address),
    city: clean(sale.city, ['General']),
    source: sale.orderSource?.name || null,
    externalOrderId: clean(sale.externalOrderId) || null,
    trackingNumber: clean(sale.trackingNumber) || null,
    items: rows.map((r) => ({ name: r.productName, qty: r.quantity, price: r.soldPrice })),
    delivery: Math.max(0, delivery || 0),
    whatsappBlocked: await whatsappBlockedFor(sale.orderSourceId),
  }
}

export const billTotals = (b: BillData) => {
  const subtotal = b.items.reduce((a, i) => a + i.price * i.qty, 0)
  return { subtotal, total: subtotal + b.delivery }
}

export const billFileName = (b: BillData) => `FancyStore-Bill-${b.orderNo ?? 'order'}.png`

// ── Assets, read once ──

let assets: Promise<{ logo: string; fonts: { name: string; data: Buffer; weight: 400 | 600 | 700 }[] }> | null = null

function loadAssets() {
  if (!assets) {
    const root = process.cwd()
    assets = Promise.all([
      fs.readFile(path.join(root, 'public', 'logo.png')),
      fs.readFile(path.join(root, 'assets', 'fonts', 'Inter-400.ttf')),
      fs.readFile(path.join(root, 'assets', 'fonts', 'Inter-600.ttf')),
      fs.readFile(path.join(root, 'assets', 'fonts', 'Inter-700.ttf')),
    ])
      .then(([logo, r, sb, b]) => ({
        logo: `data:image/png;base64,${logo.toString('base64')}`,
        fonts: [
          { name: 'Inter', data: r, weight: 400 as const },
          { name: 'Inter', data: sb, weight: 600 as const },
          { name: 'Inter', data: b, weight: 700 as const },
        ],
      }))
      .catch((err) => {
        assets = null // try again next time
        throw err
      })
  }
  return assets
}

// Rough height of the drawing, so the image has no empty space at the bottom
function billHeight(b: BillData, infoLines: number) {
  const itemRows = b.items.reduce((a, i) => a + 52 + Math.floor(i.name.length / 30) * 20, 0)
  const totals = 30 + (b.delivery > 0 ? 30 : 0) + 64
  return 8 + 32 + 84 + 28 + (40 + infoLines * 21) + 28 + 42 + itemRows + 28 + totals + 36 + 78
}

// The bill as PNG bytes
export async function renderBillPng(b: BillData): Promise<ArrayBuffer> {
  const { logo, fonts } = await loadAssets()
  const { subtotal, total } = billTotals(b)
  const date = b.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' })

  const customer = [b.customerPhone, b.address, b.city].filter(Boolean) as string[]
  const order = [
    b.source ? `Source: ${b.source}` : '',
    b.externalOrderId ? `Order ID: ${b.externalOrderId}` : '',
    b.trackingNumber ? `Tracking: ${b.trackingNumber}` : '',
  ].filter(Boolean)
  const infoLines = Math.max(customer.length + 1, order.length + 1)

  const label = { fontSize: px(10), letterSpacing: px(1.5), color: '#6b7280', fontWeight: 600 }
  const muted = { fontSize: px(13), color: '#4b5563' }
  const cols = { qty: px(56), price: px(92), amount: px(104) }

  const image = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', fontFamily: 'Inter', color: '#1f2937' }}>
        <div style={{ height: px(8), background: ACCENT, display: 'flex' }} />

        <div style={{ display: 'flex', flexDirection: 'column', padding: `${px(32)}px ${px(44)}px 0`, gap: px(28) }}>
          {/* Logo + order number */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: px(4) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} width={px(212)} height={px(70)} style={{ objectFit: 'contain', objectPosition: 'left' }} alt="" />
              {!b.whatsappBlocked && (
                <div style={{ display: 'flex', ...muted, fontSize: px(12), fontWeight: 600 }}>{`WhatsApp: ${SHOP.whatsapp}`}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: px(4) }}>
              <div style={{ display: 'flex', ...label, fontSize: px(11), letterSpacing: px(2) }}>INVOICE</div>
              <div style={{ display: 'flex', fontSize: px(26), fontWeight: 700, color: ACCENT }}>{b.orderNo ? `#${b.orderNo}` : ''}</div>
              <div style={{ display: 'flex', ...muted, fontSize: px(12) }}>{date}</div>
            </div>
          </div>

          {/* Customer + order details */}
          <div style={{ display: 'flex', gap: px(20), padding: `${px(18)}px ${px(20)}px`, background: '#f9fafb', borderRadius: px(10) }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: px(4), flex: 1 }}>
              <div style={{ display: 'flex', ...label }}>BILL TO</div>
              <div style={{ display: 'flex', fontSize: px(15), fontWeight: 600, color: '#111827' }}>{b.customerName}</div>
              {customer.map((line, i) => (
                <div key={i} style={{ display: 'flex', ...muted }}>{line}</div>
              ))}
            </div>
            {order.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: px(4), flex: 1 }}>
              <div style={{ display: 'flex', ...label }}>ORDER</div>
              {order.map((line, i) => (
                <div key={i} style={{ display: 'flex', ...muted }}>{line}</div>
              ))}
            </div>
            )}
          </div>

          {/* Products */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', padding: `${px(10)}px 0`, borderBottom: `${px(2)}px solid #111827`, ...label, color: '#374151', letterSpacing: px(1) }}>
              <div style={{ display: 'flex', flex: 1 }}>ITEM</div>
              <div style={{ display: 'flex', width: cols.qty, justifyContent: 'center' }}>QTY</div>
              <div style={{ display: 'flex', width: cols.price, justifyContent: 'flex-end' }}>PRICE</div>
              <div style={{ display: 'flex', width: cols.amount, justifyContent: 'flex-end' }}>AMOUNT</div>
            </div>
            {b.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: `${px(14)}px 0`, borderBottom: `${px(1)}px solid #e5e7eb`, fontSize: px(14) }}>
                <div style={{ display: 'flex', flex: 1, fontWeight: 600, color: '#111827', paddingRight: px(10) }}>{it.name}</div>
                <div style={{ display: 'flex', width: cols.qty, justifyContent: 'center' }}>{String(it.qty)}</div>
                <div style={{ display: 'flex', width: cols.price, justifyContent: 'flex-end' }}>{rs(it.price)}</div>
                <div style={{ display: 'flex', width: cols.amount, justifyContent: 'flex-end', fontWeight: 600 }}>{rs(it.price * it.qty)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: px(270), gap: px(8), fontSize: px(14) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
                <span>Subtotal</span>
                <span>{rs(subtotal)}</span>
              </div>
              {b.delivery > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
                  <span>Delivery</span>
                  <span>{rs(b.delivery)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: `${px(12)}px ${px(14)}px`,
                  marginTop: px(4),
                  background: ACCENT,
                  color: '#ffffff',
                  borderRadius: px(8),
                  fontWeight: 700,
                  fontSize: px(17),
                }}
              >
                <span>Total</span>
                <span>{rs(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Thank you */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: px(6),
            margin: `${px(36)}px ${px(44)}px 0`,
            paddingTop: px(22),
            borderTop: `${px(1)}px dashed #d1d5db`,
          }}
        >
          <div style={{ display: 'flex', fontSize: px(18), fontWeight: 600, color: '#111827' }}>Thank you for shopping with us!</div>
          {!b.whatsappBlocked && (
            <div style={{ display: 'flex', ...muted, fontSize: px(12), color: '#6b7280' }}>{`If you have any query, contact us on WhatsApp: ${SHOP.whatsapp}`}</div>
          )}
        </div>
      </div>
    ),
    { width: px(W), height: px(billHeight(b, infoLines)), fonts },
  )
  return image.arrayBuffer()
}
