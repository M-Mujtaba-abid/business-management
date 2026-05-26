@echo off
REM Business Manager - Setup Script for Windows

echo.
echo =========================================
echo  Business Manager Setup
echo =========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please download and install from: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node --version
echo.

REM Install dependencies
echo [STEP 1] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Check for .env.local
if not exist ".env.local" (
    echo [WARNING] .env.local not found!
    echo.
    echo You need to:
    echo 1. Go to https://console.neon.tech
    echo 2. Create a free account
    echo 3. Create a new project
    echo 4. Copy the connection string
    echo 5. Create .env.local file with:
    echo    DATABASE_URL="your-connection-string"
    echo.
    pause
) else (
    echo [OK] .env.local found
)

echo.
echo [STEP 2] Setting up database...
call npx prisma migrate dev --name init
if errorlevel 1 (
    echo ERROR: Failed to setup database
    echo Make sure DATABASE_URL in .env.local is correct
    pause
    exit /b 1
)
echo [OK] Database setup complete
echo.

echo =========================================
echo  Setup Complete! 
echo =========================================
echo.
echo To start the development server, run:
echo   npm run dev
echo.
echo Then open: http://localhost:3000
echo.
pause
