// Password hashing (server / Node only). Format: "scrypt$<salt hex>$<hash hex>"
// scripts/set-user.js writes the same format.
import { randomBytes, scrypt, timingSafeEqual } from 'crypto'

const KEYLEN = 64

const scryptAsync = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key)))
  )

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split('$')
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Used when the email is unknown, so a wrong email takes as long as a wrong password
export const DUMMY_HASH =
  'scrypt$00000000000000000000000000000000$' + '0'.repeat(KEYLEN * 2)
