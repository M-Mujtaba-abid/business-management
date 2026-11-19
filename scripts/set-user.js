// Emergency / first-user tool: add a login, or reset a password, straight in the database.
// Day to day, users are managed in the app: Settings → Users.
//
//   USER_PASSWORD='secret' node scripts/set-user.js <email> <name> [personId]
//
// The password is read from the USER_PASSWORD env var (not the command line) and only its
// scrypt hash is saved. Prisma reads DATABASE_URL from .env; set DATABASE_URL in the shell to
// target another database.
const { randomBytes, scryptSync } = require('crypto')
const { PrismaClient } = require('@prisma/client')

async function main() {
  const [emailArg, name, personId] = process.argv.slice(2)
  const password = process.env.USER_PASSWORD || ''
  const email = (emailArg || '').trim().toLowerCase()

  if (!email || !email.includes('@') || !name) {
    console.error("Usage: USER_PASSWORD='secret' node scripts/set-user.js <email> <name> [personId]")
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('USER_PASSWORD must be at least 8 characters.')
    process.exit(1)
  }

  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  const passwordHash = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`

  const prisma = new PrismaClient()
  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, ...(personId ? { personId } : {}) },
      create: { email, name, passwordHash, personId: personId || null },
    })
    console.log(`Saved login: ${user.email} (${user.name})`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
