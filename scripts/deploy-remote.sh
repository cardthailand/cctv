#!/bin/bash
set -euo pipefail

APP_DIR="/home/cctv/domains/cctvcard.in.th/public_html"
cd "$APP_DIR"

echo "[deploy] Installing dependencies..."
npm install --omit=dev

if [ ! -f .env ]; then
  echo "[deploy] WARNING: .env not found. Copy from .env.production.example first."
  exit 1
fi

echo "[deploy] Running database migration..."
npm run db:migrate

echo "[deploy] Restarting PM2 process..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.js --env production
  pm2 save
else
  echo "[deploy] PM2 not found. Start manually: npm start"
fi

echo "[deploy] Done."
