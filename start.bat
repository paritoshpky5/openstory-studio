@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   OpenStory Studio - 1-Click Launch (Windows)
echo ===================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please download and install Node.js (v18 or higher) from https://nodejs.org
    pause
    exit /b 1
)

echo [1/4] Checking Node.js environment...
node -v

:: 2. Ensure .env exists
if not exist .env (
    echo [2/4] Initializing default .env file...
    echo DATABASE_URL="file:./dev.db"> .env
) else (
    echo [2/4] .env file detected.
)

:: 3. Check node_modules
if not exist node_modules (
    echo [3/4] Installing dependencies with npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
) else (
    echo [3/4] Dependencies already installed.
)

:: 4. Prisma database sync
echo [4/4] Setting up SQLite database...
call npx prisma generate
call npx prisma db push --skip-generate

echo.
echo ===================================================
echo   Launching OpenStory Studio on http://localhost:3000
echo ===================================================
echo.

:: Open browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Start Next.js dev server
call npm run dev
