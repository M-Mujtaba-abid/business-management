// Login session for the business app. Each person logs in with their own email + password
// (User table). Works in the Edge runtime (middleware) and in Node routes: only Web Crypto is used.
//
// Cookie value: "<userId>.<sessionVersion>.<expiresAtMs>.<hex HMAC-SHA256 of the first three with AUTH_SECRET>"
// The signature proves the cookie was made by this server; /api/auth/check then confirms in the
// database that the user still exists and the sessionVersion still matches (so removing a user or
// changing their password ends their logins straight away).
// Needs env AUTH_SECRET (long random string). If it is missing, nobody can log in.

export const SESSION_COOKIE = 'bm_session'
export const SESSION_DAYS = 30

const enc = new TextEncoder()

const authSecret = () => process.env.AUTH_SECRET || ''
export const authConfigured = () => authSecret().length >= 16

async function hmacHex(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(authSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Compare without leaking how many characters matched
function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export async function createSessionToken(userId: string, sessionVersion: number): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const payload = `${userId}.${sessionVersion}.${expires}`
  return `${payload}.${await hmacHex(payload)}`
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
}

// Checks the signature and expiry only (no database). Returns { userId, version } or null.
export async function readSession(token: string | undefined): Promise<{ userId: string; version: number } | null> {
  if (!token || !authConfigured()) return null
  const [userId, version, expires, sig] = token.split('.')
  if (!userId || !/^\d+$/.test(version || '') || !/^\d+$/.test(expires || '') || !sig) return null
  if (Number(expires) < Date.now()) return null
  if (!safeEqual(sig, await hmacHex(`${userId}.${version}.${expires}`))) return null
  return { userId, version: Number(version) }
}
