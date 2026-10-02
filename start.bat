@echo off
setlocal

:: Always run from the repository directory, including when double-clicked.
cd /d "%~dp0"
if not defined PORT set "PORT=3000"

echo ===================================================
echo   OpenStory Studio - 1-Click Launch (Windows)
echo ===================================================
echo.

:: 1. Check Node.js and npm
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 20.9 or newer from https://nodejs.org
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH!
    pause
    exit /b 1
)

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)"
if %errorlevel% neq 0 (
    echo [ERROR] OpenStory Studio requires Node.js 20.9 or newer.
    node -v
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
if %errorlevel% neq 0 (
    echo [ERROR] Prisma client generation failed!
    pause
    exit /b 1
)
call npx prisma db push --skip-generate
if %errorlevel% neq 0 (
    echo [ERROR] Database setup failed!
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   Launching OpenStory Studio on http://localhost:%PORT%
echo ===================================================
echo.

:: Open browser after 2 seconds in background. Set OPENSTORY_SKIP_BROWSER=1
:: for automated checks or when you do not want a browser window.
if not "%OPENSTORY_SKIP_BROWSER%"=="1" (
    start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"
)

:: Start Next.js dev server
call npm run dev
exit /b %errorlevel%
