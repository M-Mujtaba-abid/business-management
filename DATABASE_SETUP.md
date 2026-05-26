# Database Setup Guide

## Option 1: Using Neon (Recommended - Free)

### What is Neon?
Neon is a free PostgreSQL database hosting service. Perfect for this app!

### Steps:
1. Visit: https://console.neon.tech
2. Sign up with email (takes 1 minute)
3. Create a new project
4. Choose a region closest to you
5. Wait for project creation (30 seconds)
6. Go to "Connection string" section
7. Copy the PostgreSQL connection string
8. It looks like:
   ```
   postgresql://neondb_owner:xxxxx@ep-xxx.neon.tech/neondb?sslmode=require
   ```

### Save to .env.local:
```
DATABASE_URL="postgresql://neondb_owner:xxxxx@ep-xxx.neon.tech/neondb?sslmode=require"
```

---

## Option 2: Using Supabase (Also Free)

### Steps:
1. Visit: https://supabase.com
2. Sign up with GitHub
3. Create a new project
4. Go to Settings → Database
5. Find the connection string
6. Copy it to .env.local

---

## Option 3: Using Vercel PostgreSQL

### Steps:
1. Visit: https://vercel.com
2. Go to Storage → Postgres
3. Create a new database
4. Copy connection string
5. Add to .env.local

---

## After Adding DATABASE_URL:

Run these commands:

```bash
# Setup database tables
npx prisma migrate dev --name init

# View database in web interface (optional)
npx prisma studio
```

---

## Troubleshooting Database Issues

### "Error: P1000 Can't reach database"
- Check DATABASE_URL is correct
- Make sure there are no typos
- Verify the database server is running

### "Column doesn't exist"
```bash
# Reset and recreate
npx prisma migrate reset
npx prisma migrate dev --name init
```

### View Database Contents
```bash
npx prisma studio
```
This opens a web interface to see all your data!

---

## All Database Options Comparison

| Provider | Cost | Speed | Ease |
|----------|------|-------|------|
| Neon | Free | Fast | ⭐⭐⭐⭐⭐ |
| Supabase | Free | Fast | ⭐⭐⭐⭐ |
| Vercel Postgres | Free | Fast | ⭐⭐⭐⭐ |
| AWS RDS | Paid | Fast | ⭐⭐⭐ |
| Railway | Free/Paid | Fast | ⭐⭐⭐⭐ |

**We recommend Neon** - simplest and most straightforward!

---

## Getting Your Connection String - Step by Step

### Neon:
1. Open https://console.neon.tech
2. Login to your account
3. Click on your project name
4. Look for "Connection string" in the right panel
5. Click "Show password" if needed
6. Click the copy button (icon next to the string)
7. Paste in .env.local

### The string should include:
- postgresql:// (protocol)
- username:password@
- hostname.region.neon.tech (server)
- /database_name (database)
- ?sslmode=require (SSL requirement)

Example:
```
postgresql://neondb_owner:AbCdEfG123@ep-random-name.neon.tech/neondb?sslmode=require
```

---

## Testing Your Connection

After adding DATABASE_URL, run:

```bash
npx prisma db push
```

If it works, you'll see:
```
✓ Pushed to database
```

If it fails, check your connection string again.

---

That's it! Your database is ready to use! 🚀
