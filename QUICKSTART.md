# QUICK START GUIDE - Run in 5 Minutes! ⚡

## Step 1: Get Neon Database URL
1. Go to https://console.neon.tech
2. Sign up (free account)
3. Create a new project
4. Copy the connection string (looks like: `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`)

## Step 2: Create .env.local File
Create a file named `.env.local` in the project root:

```
DATABASE_URL="paste-your-neon-url-here"
```

## Step 3: Install & Setup (Run these commands in order)

```bash
# Install dependencies
npm install

# Create database
npx prisma migrate dev --name init

# Start the app
npm run dev
```

## Step 4: Open Browser
Go to: http://localhost:3000

🎉 Done! Start adding sales!

## What You'll See

1. **Dashboard** - Shows total sales and profit
2. **Form** - Add new sales with 5 fields
3. **Cards** - View all your sales below

## Form Fields to Fill

- Product Name (e.g., "Top Cover")
- Customer Name (e.g., "Ahmed Khan")
- Address (e.g., "Lahore, Pakistan")
- Cost Price (e.g., 100)
- Sold Price (e.g., 150)

Click **Add Sale** → Instantly appears as a card!

## To Stop the Server
Press `Ctrl + C` in terminal

## To Start Again
```bash
npm run dev
```

## Common Issues?

**Port already in use:**
```bash
npm run dev -- -p 3001
```

**Database error:**
- Check `.env.local` has DATABASE_URL
- Make sure DATABASE_URL is correct from Neon

**Module not found:**
```bash
npm install
```

That's it! Enjoy! 🚀
