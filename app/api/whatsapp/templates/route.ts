import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, MAX_VARIANTS, type TemplateKey } from '@/lib/whatsappTemplates'

export const dynamic = 'force-dynamic'

const MAX_LENGTH = 3000

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

// Every automatic message with its wordings (saved, or the built-in defaults)
export async function GET() {
  try {
    const rows = await prisma.whatsAppTemplate.findMany()
    const saved = new Map(rows.map((r) => [r.key, r]))
    return NextResponse.json({
      templates: TEMPLATE_KEYS.map((key) => {
        const row = saved.get(key)
        const bodies = row ? [row.body, ...(row.variants || [])] : DEFAULT_TEMPLATES[key]
        return {
          key,
          bodies,
          enabled: row?.enabled ?? true,
          isDefault: !row || sameList(bodies, DEFAULT_TEMPLATES[key]),
          defaultBodies: DEFAULT_TEMPLATES[key],
          updatedAt: row?.updatedAt ?? null,
        }
      }),
      // Filled from the server settings; shown in the preview
      values: { reviewUrl: process.env.REVIEW_URL || '', business: process.env.BUSINESS_NAME || '' },
      maxVariants: MAX_VARIANTS,
    })
  } catch (error: any) {
    console.error('WhatsApp templates GET error:', error)
    return NextResponse.json({ error: error.message || 'Could not load the messages' }, { status: 500 })
  }
}

// Save one message: { key, bodies: string[], enabled }. { key, reset: true } goes back to the default wordings.
export async function PUT(request: NextRequest) {
  try {
    const { key, bodies, enabled, reset } = (await request.json()) as {
      key?: TemplateKey
      bodies?: unknown
      enabled?: boolean
      reset?: boolean
    }
    if (!key || !TEMPLATE_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Unknown message.' }, { status: 400 })
    }

    if (reset) {
      await prisma.whatsAppTemplate.deleteMany({ where: { key } })
      return NextResponse.json({ ok: true, bodies: DEFAULT_TEMPLATES[key], enabled: true })
    }

    const list = (Array.isArray(bodies) ? bodies : [])
      .map((b) => (typeof b === 'string' ? b.replace(/\r\n/g, '\n').trim() : ''))
      .filter(Boolean)
    if (!list.length) return NextResponse.json({ error: 'Write at least one wording.' }, { status: 400 })
    if (list.length > MAX_VARIANTS) {
      return NextResponse.json({ error: `At most ${MAX_VARIANTS} wordings per message.` }, { status: 400 })
    }
    if (list.some((b) => b.length > MAX_LENGTH)) {
      return NextResponse.json({ error: `A wording is too long (max ${MAX_LENGTH} characters).` }, { status: 400 })
    }

    const [body, ...variants] = list
    const row = await prisma.whatsAppTemplate.upsert({
      where: { key },
      create: { key, body, variants, enabled: enabled !== false },
      update: { body, variants, enabled: enabled !== false, lastVariant: -1 },
    })
    return NextResponse.json({ ok: true, bodies: [row.body, ...row.variants], enabled: row.enabled, updatedAt: row.updatedAt })
  } catch (error: any) {
    console.error('WhatsApp templates PUT error:', error)
    return NextResponse.json({ error: error.message || 'Could not save the message' }, { status: 500 })
  }
}
