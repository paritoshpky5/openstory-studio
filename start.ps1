# OpenStory Studio - 1-Click Launch (PowerShell)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
if (-not $env:PORT) { $env:PORT = "3000" }

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "  OpenStory Studio - 1-Click Launch (PowerShell)   " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Check Node.js and npm
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js 20.9 or newer from https://nodejs.org"
    Exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm is not installed or not in PATH!" -ForegroundColor Red
    Exit 1
}

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] OpenStory Studio requires Node.js 20.9 or newer." -ForegroundColor Red
    node -v
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
    & npm install
    if ($LASTEXITCODE -ne 0) { Exit $LASTEXITCODE }
} else {
    Write-Host "[3/4] Dependencies already installed." -ForegroundColor Green
}

# 4. Prisma database sync
Write-Host "[4/4] Setting up SQLite database..." -ForegroundColor Yellow
& npx prisma generate
if ($LASTEXITCODE -ne 0) { Exit $LASTEXITCODE }
& npx prisma db push --skip-generate
if ($LASTEXITCODE -ne 0) { Exit $LASTEXITCODE }

Write-Host ""
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "  Launching OpenStory Studio on http://localhost:$($env:PORT)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host ""

# Open browser unless explicitly disabled for automation.
if ($env:OPENSTORY_SKIP_BROWSER -ne "1") {
    Start-Process "http://localhost:$($env:PORT)"
}

# Start Next.js dev server
& npm run dev
Exit $LASTEXITCODE
