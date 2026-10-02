# OpenStory Studio - 1-Click Launch (PowerShell)
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "  OpenStory Studio - 1-Click Launch (PowerShell)   " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please download and install Node.js (v18 or higher) from https://nodejs.org"
    Exit 1
}

Write-Host "[1/4] Checking Node.js environment: $(node -v)" -ForegroundColor Green

# 2. Ensure .env exists
if (-not (Test-Path .env)) {
    Write-Host "[2/4] Initializing default .env file..." -ForegroundColor Yellow
    Set-Content -Path .env -Value 'DATABASE_URL="file:./dev.db"'
} else {
    Write-Host "[2/4] .env file detected." -ForegroundColor Green
}

# 3. Check node_modules
if (-not (Test-Path node_modules)) {
    Write-Host "[3/4] Installing dependencies with npm install..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "[3/4] Dependencies already installed." -ForegroundColor Green
}

# 4. Prisma database sync
Write-Host "[4/4] Setting up SQLite database..." -ForegroundColor Yellow
npx prisma generate
npx prisma db push --skip-generate

Write-Host ""
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "  Launching OpenStory Studio on http://localhost:3000" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host ""

# Open browser
Start-Process "http://localhost:3000"

# Start Next.js dev server
npm run dev
