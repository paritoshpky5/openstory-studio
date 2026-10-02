#!/usr/bin/env bash
set -e

echo "==================================================="
echo "  OpenStory Studio - 1-Click Launch (Mac & Linux)"
echo "==================================================="
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not found in PATH!"
    echo "Please download and install Node.js (v18 or higher) from https://nodejs.org"
    exit 1
fi

echo "[1/4] Checking Node.js environment..."
node -v

# 2. Ensure .env exists
if [ ! -f .env ]; then
    echo "[2/4] Initializing default .env file..."
    echo 'DATABASE_URL="file:./dev.db"' > .env
else
    echo "[2/4] .env file detected."
fi

# 3. Check node_modules
if [ ! -d node_modules ]; then
    echo "[3/4] Installing dependencies with npm install..."
    npm install
else
    echo "[3/4] Dependencies already installed."
fi

# 4. Prisma database sync
echo "[4/4] Setting up SQLite database..."
npx prisma generate
npx prisma db push --skip-generate

echo ""
echo "==================================================="
echo "  Launching OpenStory Studio on http://localhost:3000"
echo "==================================================="
echo ""

# Open browser in background depending on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 2 && open http://localhost:3000) &
elif command -v xdg-open &> /dev/null; then
    (sleep 2 && xdg-open http://localhost:3000) &
fi

# Start Next.js dev server
npm run dev
