// WhatsApp message templates. No server imports here: the WhatsApp page uses this for its preview.
//
// Anti-spam: WhatsApp flags the same text sent to many people. So every message has several
// wordings ("variations", one picked per send, never the same one twice in a row), and a wording
// can hold choices like {Salam|AoA|Assalam o Alaikum}, picked at random each time.

export type TemplateKey = 'ORDER_CONFIRM' | 'DISPATCHED' | 'DELIVERED' | 'REPLY_CONFIRMED' | 'REPLY_CANCELLED'

// In the order a customer receives them
export const TEMPLATE_KEYS: TemplateKey[] = ['ORDER_CONFIRM', 'REPLY_CONFIRMED', 'REPLY_CANCELLED', 'DISPATCHED', 'DELIVERED']

export const MAX_VARIANTS = 6

// Placeholders a template can use. A line whose placeholder has no value (e.g. no tracking number yet)
// is left out of the message.
export const PLACEHOLDERS: { tag: string; label: string }[] = [
  { tag: '{name}', label: 'Customer name' },
  { tag: '{orderNo}', label: 'Order number, e.g. #1045' },
  { tag: '{products}', label: 'Products with quantity' },
  { tag: '{total}', label: 'Order total, e.g. Rs 2,500' },
  { tag: '{address}', label: 'Delivery address' },
  { tag: '{city}', label: 'City' },
  { tag: '{tracking}', label: 'Courier tracking number' },
  { tag: '{reviewUrl}', label: 'Review link (only sent to customers who have replied before)' },
  { tag: '{business}', label: 'Business name (BUSINESS_NAME setting)' },
]

const lines = (...l: string[]) => l.join('\n')

export const DEFAULT_TEMPLATES: Record<TemplateKey, string[]> = {
  ORDER_CONFIRM: [
    lines(
      '{Assalam o Alaikum|AoA|Salam} {name}! 🛍️',
      '',
      'Aapka order {orderNo} humein {mil gaya hai|receive ho gaya hai}:',
      '• {products}',
      '• Total: {total}',
      '• Address: {address}, {city}',
      '',
      'Order *confirm* karne ke liye *1* reply karein',
      'Order *cancel* karne ke liye *2* reply karein',
      '',
      '— {business}',
    ),
    lines(
      '{Salam|Hello} {name},',
      '',
      '{Shukriya|Bohat shukriya} aap ne order kiya! Order {orderNo} ki details:',
      '{products}',
      'Total: {total}',
      'Deliver hoga: {address}, {city}',
      '',
      'Kya hum isay bhej dein? *1* = haan, confirm | *2* = cancel',
      '',
      '— {business}',
    ),
    lines(
      '{name}, {AoA|Assalam o Alaikum}!',
      '',
      'Order {orderNo} {aa gaya hai|mil gaya hai} 👍',
      '{products} ({total})',
      '{address}, {city}',
      '',
      '{Please|Barah-e-karam} confirm kar dein: *1* confirm, *2* cancel.',
      '',
      '— {business}',
    ),
  ],
  REPLY_CONFIRMED: [
    lines('Shukriya {name}! Aapka order {orderNo} confirm ho gaya hai ✅ Hum jald hi isay dispatch kar denge.', '', '— {business}'),
    lines('{Done|Theek hai} {name} ✅ Order {orderNo} confirm. {Jaise hi|Jab} parcel nikle ga, hum aap ko bata denge.', '', '— {business}'),
    lines('{JazakAllah|Shukriya} {name}! Order {orderNo} confirm kar diya gaya hai. In shaa Allah jald dispatch hoga.', '', '— {business}'),
  ],
  REPLY_CANCELLED: [
    lines('Aapki order {orderNo} cancel karne ki request mil gayi hai. Hum jald aap se rabta karenge.', '', '— {business}'),
    lines('{Theek hai|Ji} {name}, order {orderNo} ki cancel request note kar li hai. Hum {jald|thori der mein} aap se baat karenge.', '', '— {business}'),
    lines('{name}, order {orderNo} cancel karne ki request {mil gayi|aa gayi} hai. Koi masla ho to yahin bata dein.', '', '— {business}'),
  ],
  DISPATCHED: [
    lines(
      '{name}, aapka order {orderNo} dispatch ho gaya hai aur aapke ghar ki taraf aa raha hai 🚚',
      '',
      'In shaa Allah 2–3 din mein aapke paas pohanch jayega.',
      'Tracking number: {tracking}',
      '',
      '— {business}',
    ),
    lines(
      '{Good news|Khushkhabri} {name}! 📦 Order {orderNo} {courier ko de diya gaya hai|rawana ho gaya hai}.',
      '{2–3 din|Do teen din} mein deliver ho jayega.',
      'Tracking: {tracking}',
      '',
      '— {business}',
    ),
    lines(
      '{Salam|AoA} {name}, order {orderNo} {nikal chuka hai|ship ho gaya hai} 🚚',
      'Delivery 2–3 din mein {expected hai|ho jayegi}, in shaa Allah.',
      'Tracking no: {tracking}',
      '',
      '— {business}',
    ),
  ],
  DELIVERED: [
    lines(
      '{name}, aapka order {orderNo} deliver ho gaya hai ✅',
      '',
      'Humse khareedari ka shukriya! Apna review aur feedback zaroor dein, is se humein aur behtar hone mein madad milti hai 🙏',
      'Bas is message ka reply kar ke apni raaye bata dein.',
      '',
      'Review dein: {reviewUrl}',
      '',
      '— {business}',
    ),
    lines(
      '{name}, order {orderNo} {aap tak pohanch gaya|deliver ho chuka} hai 🎉',
      '{Umeed hai|Hope} aap ko pasand aaya hoga! Ek line mein apna feedback {zaroor|please} bata dein 🙏',
      'Review: {reviewUrl}',
      '',
      '— {business}',
    ),
    lines(
      '{Shukriya|JazakAllah} {name}! Order {orderNo} deliver ho gaya ✅',
      'Product kaisa laga? Aapka feedback humare liye {bohat|bahut} ahem hai, reply kar ke bata dein.',
      'Review link: {reviewUrl}',
      '',
      '— {business}',
    ),
  ],
}

// Sample values for the preview on the WhatsApp page
export const SAMPLE_VALUES: Record<string, string> = {
  name: 'Ali Khan',
  orderNo: '#1045',
  products: 'Black Watch ×2, Wallet',
  total: 'Rs 4,500',
  address: 'House 12, Street 4, Gulberg',
  city: 'Lahore',
  tracking: 'LE123456789',
  reviewUrl: 'https://g.page/r/your-review-link',
  business: 'Your Shop',
}

// Placeholders are {word}; choices are {a|b|c} (a choice may hold placeholders: {Hi {name}|Salam})
const PLACEHOLDER_RE = /\{(\w+)\}/g
const CHOICE_RE = /\{([^{}]*\|[^{}]*)\}/

// Picks one option of every {a|b|c} choice
export function spin(text: string, random: () => number = Math.random): string {
  // hide placeholders so a choice that contains one can be matched
  let out = text.replace(PLACEHOLDER_RE, '\u0001$1\u0002')
  for (let guard = 0; guard < 200; guard++) {
    const m = out.match(CHOICE_RE)
    if (!m || m.index === undefined) break
    const options = m[1].split('|')
    const pick = options[Math.floor(random() * options.length)] ?? ''
    out = out.slice(0, m.index) + pick + out.slice(m.index + m[0].length)
  }
  return out.replace(/\u0001(\w+)\u0002/g, '{$1}')
}

// How many different texts a wording can produce (shown on the WhatsApp page)
export function countSpins(text: string): number {
  const hidden = text.replace(PLACEHOLDER_RE, '')
  let total = 1
  for (const m of hidden.matchAll(/\{([^{}]*\|[^{}]*)\}/g)) total *= m[1].split('|').length
  return total
}

// Fills {placeholders}. A line with an empty placeholder is dropped, then extra blank lines are tidied.
export function renderTemplate(body: string, values: Record<string, string>): string {
  const out: string[] = []
  for (const line of spin(body).replace(/\r\n/g, '\n').split('\n')) {
    let missing = false
    const filled = line.replace(PLACEHOLDER_RE, (tag, key: string) => {
      if (!(key in values)) return tag // unknown tag: keep it as typed
      const v = (values[key] || '').trim()
      if (!v) missing = true
      return v
    })
    if (!missing) out.push(filled)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Index of the wording to use next: random, but never the one used last time
export function pickVariant(count: number, last: number, random: () => number = Math.random): number {
  if (count <= 1) return 0
  if (last < 0 || last >= count) return Math.min(Math.floor(random() * count), count - 1)
  const i = Math.min(Math.floor(random() * (count - 1)), count - 2)
  return i >= last ? i + 1 : i
}
