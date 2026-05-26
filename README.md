# Business Manager - Sales Tracking Application

A modern, mobile-friendly business management app built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **Neon PostgreSQL Database**.

Perfect for managing sales, tracking costs, and calculating profits for your business.

## Features

✨ **Key Features:**
- 📝 Add new sales with product name, customer info, and pricing
- 💰 Automatic profit calculation
- 📊 Real-time sales and profit statistics
- 📱 Fully responsive mobile-friendly design
- 🗑️ Delete sales with confirmation
- 🎯 Beautiful card-based UI
- 💾 Persistent database storage

## Tech Stack

- **Frontend**: Next.js 14 (React 18)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Validation**: Zod
- **HTTP**: Axios

## Prerequisites

Before you start, make sure you have:

1. **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
2. **npm** or **yarn** package manager
3. **Neon Database Account** (free) - [Sign up](https://console.neon.tech)
4. **Git** (optional, for version control)

## Step-by-Step Setup & Running Guide

### Step 1: Extract the Project

Unzip the provided `business-manager.zip` file to your desired location:

```bash
unzip business-manager.zip
cd business-manager
```

### Step 2: Install Dependencies

Install all required npm packages:

```bash
npm install
```

This will take 2-3 minutes. Wait for it to complete.

### Step 3: Set Up Neon Database

1. Go to [Neon Console](https://console.neon.tech)
2. Sign up for a free account (or log in)
3. Click "Create Project"
4. Name your project (e.g., "business-manager")
5. Choose a region closest to you
6. Click "Create Project"
7. Wait for the project to be created
8. Click on your project
9. Find the "Connection string" section
10. Copy the PostgreSQL connection string that looks like:
    ```
    postgresql://user:password@ep-xxx.us-east-1.neon.tech/dbname?sslmode=require
    ```

### Step 4: Create Environment File

1. Open the project folder in a code editor (VS Code recommended)
2. Rename `.env.example` to `.env.local`
3. Paste your Neon connection string:
    ```
    DATABASE_URL="your-neon-connection-string-here"
    ```
4. Save the file

### Step 5: Initialize the Database

Run Prisma migrations to create the database tables:

```bash
npx prisma migrate dev --name init
```

This will:
- Create the database schema
- Generate Prisma client
- Ask for a migration name (just press Enter to use default)

Wait for this to complete - it's important!

### Step 6: (Optional) Seed Sample Data

To test with sample data, run:

```bash
# This is optional - the app works without it
```

### Step 7: Start Development Server

Run the development server:

```bash
npm run dev
```

You should see:
```
> business-manager@1.0.0 dev
> next dev

  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
```

### Step 8: Open in Browser

Open your web browser and go to:

```
http://localhost:3000
```

🎉 **You're all set!** The app should now be running.

## How to Use the App

### Adding a Sale

1. Fill in the form with:
   - **Product Name**: What you sold (e.g., "Top Cover", "Phone Case")
   - **Customer Name**: Who you sold it to
   - **Address**: Customer's address
   - **Cost Price**: How much you paid for it
   - **Sold Price**: How much you sold it for

2. Click **"Add Sale"** button
3. The sale will be added instantly and appear as a card below

### Viewing Statistics

At the top, you'll see:
- **Total Sales**: Sum of all sold prices
- **Total Profit**: Sum of all profits (sold price - cost)
- **Profit Margin**: Percentage profit relative to sales

### Managing Sales

- **View Details**: Each sale is shown as a card with all information
- **Delete**: Click "Delete" on any card to remove it (with confirmation)

## Building for Production

When you're ready to deploy:

### Build the Project

```bash
npm run build
```

This creates an optimized production build.

### Start Production Server

```bash
npm run start
```

The app will be available at `http://localhost:3000`

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Click "New Project"
4. Select your GitHub repository
5. Add your `DATABASE_URL` environment variable in Vercel dashboard
6. Click "Deploy"

Your app will be live in minutes!

## Troubleshooting

### "Cannot find module 'next'"
```bash
npm install
```

### "Database connection failed"
- Check your `.env.local` file exists and has the correct DATABASE_URL
- Make sure the Neon connection string is copied correctly
- Verify you ran `npx prisma migrate dev --name init`

### "Port 3000 already in use"
```bash
npm run dev -- -p 3001
# Or kill the process using port 3000
```

### Prisma errors
```bash
# Regenerate Prisma client
npx prisma generate

# Reset database (warning: deletes all data)
npx prisma migrate reset
```

## Project Structure

```
business-manager/
├── app/
│   ├── api/
│   │   └── sales/
│   │       ├── route.ts          # GET/POST sales
│   │       └── [id]/route.ts     # DELETE sale
│   ├── components/
│   │   ├── SaleForm.tsx          # Add sale form
│   │   ├── SaleCard.tsx          # Sale display card
│   │   └── Stats.tsx             # Statistics display
│   ├── page.tsx                  # Main page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── prisma/
│   └── schema.prisma             # Database schema
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── tailwind.config.js            # Tailwind config
├── next.config.js                # Next.js config
└── .env.local                    # Environment variables
```

## Database Schema

The app uses a simple but effective schema:

```sql
CREATE TABLE "Sale" (
  id              TEXT PRIMARY KEY,
  productName     TEXT NOT NULL,
  customerName    TEXT NOT NULL,
  address         TEXT NOT NULL,
  cost            FLOAT NOT NULL,
  soldPrice       FLOAT NOT NULL,
  profit          FLOAT NOT NULL,
  createdAt       TIMESTAMP DEFAULT NOW(),
  updatedAt       TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### GET /api/sales
Get all sales with statistics
**Response:**
```json
{
  "sales": [...],
  "totalSales": 5000,
  "totalProfit": 1500,
  "count": 10
}
```

### POST /api/sales
Create a new sale
**Body:**
```json
{
  "productName": "Top Cover",
  "customerName": "John Doe",
  "address": "123 Main St",
  "cost": 100,
  "soldPrice": 150
}
```

### DELETE /api/sales/[id]
Delete a sale by ID

## Customization

### Change Colors
Edit `tailwind.config.js` to customize the color scheme.

### Add More Fields
1. Update `prisma/schema.prisma`
2. Run: `npx prisma migrate dev --name add_field`
3. Update `SaleForm.tsx` and `SaleCard.tsx`

### Change Database
Edit `.env.local` to use a different PostgreSQL provider (AWS RDS, Supabase, etc.)

## Performance Tips

- The app is optimized for mobile and desktop
- Images are lazy-loaded for faster performance
- API calls are optimized for minimal latency
- Database queries are indexed for speed

## Security Considerations

- All data is stored in your private Neon database
- Environment variables are kept secret in `.env.local`
- API routes validate all input
- No sensitive data is logged

## Support & Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Neon Documentation](https://neon.tech/docs/introduction)

## License

This project is open source and available for personal and commercial use.

## What's Included

✅ Complete Next.js setup with TypeScript
✅ Database schema and migrations ready
✅ Mobile-responsive Tailwind CSS design
✅ API routes for CRUD operations
✅ Form validation and error handling
✅ Real-time statistics dashboard
✅ Beautiful card-based UI
✅ Delete functionality with confirmation
✅ Production-ready code
✅ Comprehensive documentation

## Next Steps

1. Run the app locally to test
2. Add your first sale
3. Deploy to Vercel (optional)
4. Share with your business partner
5. Start tracking your profits! 🚀

---

**Happy Selling! 💼**

For questions or issues, refer to the troubleshooting section above.
#   b u s i n e s s - m a n a g e m e n t  
 