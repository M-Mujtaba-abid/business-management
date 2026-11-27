// Runs during `npm run build`. On a PRODUCTION deploy it applies new database migrations
// (prisma migrate deploy) before the app is built, so merging a PR that adds tables / fields is safe.
//
// When it runs:
//  - RUN_MIGRATIONS=true   (set in Vercel → Environment Variables, Production only)  ← main switch
//  - or VERCEL_ENV=production (Vercel's own variable, when system variables are exposed)
// Otherwise (preview deploys of unmerged PRs, builds on your own computer) it is skipped, so they never
// change the live database (your local .env points DIRECT_URL at production).
//
// If the migration fails, the build fails and Vercel keeps the old version live — the site never runs
// new code on an old database.
const { execSync } = require('child_process')

const forced = String(process.env.RUN_MIGRATIONS || '').trim().toLowerCase() === 'true'
const vercelProd = process.env.VERCEL_ENV === 'production'

if (!forced && !vercelProd) {
  console.log(
    `[migrate] skipped — RUN_MIGRATIONS=${process.env.RUN_MIGRATIONS || '(not set)'}, VERCEL_ENV=${process.env.VERCEL_ENV || '(not set)'}`
  )
  process.exit(0)
}
if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('[migrate] DIRECT_URL / DATABASE_URL is not set — cannot update the database.')
  process.exit(1)
}
// prisma migrate uses directUrl (DIRECT_URL) from the schema; fall back to DATABASE_URL if it is missing
if (!process.env.DIRECT_URL) {
  console.log('[migrate] DIRECT_URL not set, using DATABASE_URL')
  process.env.DIRECT_URL = process.env.DATABASE_URL
}

console.log(`[migrate] applying database migrations (${forced ? 'RUN_MIGRATIONS=true' : 'VERCEL_ENV=production'})…`)
execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
console.log('[migrate] database is up to date')
