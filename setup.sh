#!/bin/bash

# Business Manager - Setup Script for Mac/Linux

echo ""
echo "========================================="
echo "  Business Manager Setup"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please download and install from: https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js is installed"
node --version
echo ""

# Install dependencies
echo "[STEP 1] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi
echo "[OK] Dependencies installed"
echo ""

# Check for .env.local
if [ ! -f ".env.local" ]; then
    echo "[WARNING] .env.local not found!"
    echo ""
    echo "You need to:"
    echo "1. Go to https://console.neon.tech"
    echo "2. Create a free account"
    echo "3. Create a new project"
    echo "4. Copy the connection string"
    echo "5. Create .env.local file with:"
    echo "   DATABASE_URL=\"your-connection-string\""
    echo ""
    read -p "Press Enter to continue..."
else
    echo "[OK] .env.local found"
fi

echo ""
echo "[STEP 2] Setting up database..."
npx prisma migrate dev --name init
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to setup database"
    echo "Make sure DATABASE_URL in .env.local is correct"
    exit 1
fi
echo "[OK] Database setup complete"
echo ""

echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "To start the development server, run:"
echo "  npm run dev"
echo ""
echo "Then open: http://localhost:3000"
echo ""
