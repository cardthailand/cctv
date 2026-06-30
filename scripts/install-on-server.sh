#!/bin/bash
# รันบนเซิร์ฟเวอร์หลัง extract ไฟล์ไปที่ public_html แล้ว
set -euo pipefail

APP_DIR="/home/cctv/domains/cctvcard.in.th/public_html"
RECORD_DIR="/home/cctv/domains/cctvcard.in.th/recordings"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "สร้าง .env จาก .env.production.example ก่อน:"
  echo "  cp .env.production.example .env && nano .env"
  exit 1
fi

mkdir -p "$RECORD_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: ไม่พบ Node.js — ติดตั้ง Node 18+ ก่อน"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "WARNING: ไม่พบ FFmpeg — live/recording จะไม่ทำงาน"
fi

echo "[1/4] npm install..."
npm install --omit=dev

echo "[2/4] database migrate..."
npm run db:migrate

echo "[3/4] start with PM2..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.js --env production
  pm2 save
  pm2 status
else
  echo "PM2 ไม่พบ — รันด้วย: nohup npm start > app.log 2>&1 &"
fi

echo "[4/4] ตั้ง reverse proxy ตาม deploy/nginx-cctv.card.in.th.conf"
echo "เสร็จสิ้น — เปิด https://cctv.card.in.th/login"
