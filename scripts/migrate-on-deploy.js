// Runs during `npm run build`. On a Vercel PRODUCTION deploy it applies new database migrations
// (prisma migrate deploy) before the app is built, so merging a PR that adds tables / fields is safe.
//
//  - Vercel production (VERCEL_ENV=production): migrate. If it fails, the build fails and Vercel keeps
//    the old version live — the site never runs new code on an old database.
//  - Vercel preview (unmerged PRs) and builds on your own computer: skipped, so they never change
//    the live database (your local .env points DIRECT_URL at production).
const { execSync } = require('child_process')

if (process.env.VERCEL_ENV !== 'production') {
  console.log(`[migrate] skipped (VERCEL_ENV=${process.env.VERCEL_ENV || 'not on Vercel'})`)
  process.exit(0)
}
if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('[migrate] DIRECT_URL / DATABASE_URL is not set on Vercel — cannot update the database.')
  process.exit(1)
}
// prisma migrate uses directUrl (DIRECT_URL) from the schema; fall back to DATABASE_URL if it is missing
if (!process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DATABASE_URL

console.log('[migrate] Vercel production deploy: applying database migrations…')
execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
console.log('[migrate] database is up to date')
