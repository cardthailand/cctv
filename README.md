# CCTV Web Client

ระบบดูกล้องวงจรปิด 4 ช่อง พร้อมบันทึกต่อเนื่อง, Login (Local + Google OAuth), RBAC และ AI Chat

## ความต้องการ

- Node.js 18+
- FFmpeg ใน PATH
- PostgreSQL (remote หรือ local)

## ติดตั้ง

```bash
cp .env.example .env
# แก้ไขค่าใน .env

npm install
npm run db:migrate
npm start
```

เปิดเบราว์เซอร์: http://localhost:3000/login

## บทบาทผู้ใช้

| Role | Live | Playback | AI Chat | จัดการผู้ใช้ |
|------|------|----------|---------|-------------|
| admin | ทุกช่อง | ทุกช่อง | ได้ | ได้ |
| user | ทุกช่อง | ทุกช่อง | ได้ | ไม่ได้ |
| employee | ช่องที่ assign | ช่องที่ assign | ไม่ได้ | ไม่ได้ |

## คำสั่ง

| คำสั่ง | รายละเอียด |
|--------|-----------|
| `npm start` | รัน production |
| `npm run dev` | รันแบบ watch |
| `npm run db:migrate` | สร้างตาราง + seed admin |

## ความปลอดภัย

- อย่า commit ไฟล์ `.env`
- เปลี่ยน `SESSION_SECRET`, `WS_TOKEN_SECRET` และรหัสผ่าน DB ก่อน deploy
- ใช้ HTTPS ใน production
- เปิดสิทธิ์ IP ของเซิร์ฟเวอร์ใน PostgreSQL (`pg_hba.conf`) ที่ `ctb2.upz.in.th`

## Deploy ไป production (cctv.card.in.th)

Path บนเซิร์ฟเวอร์: `/home/cctv/domains/cctvcard.in.th/public_html`

### ขั้นตอนบนเซิร์ฟเวอร์ (ครั้งแรก)

```bash
ssh -p 50022 root@ctb2.upz.in.th

# ติดตั้ง Node.js 18+, FFmpeg, PM2 (ถ้ายังไม่มี)
# npm i -g pm2

cd /home/cctv/domains/cctvcard.in.th/public_html
cp .env.production.example .env
nano .env   # แก้รหัสผ่านและ secrets

mkdir -p /home/cctv/domains/cctvcard.in.th/recordings
```

ตั้ง reverse proxy ตาม `deploy/nginx-cctv.card.in.th.conf` ให้ชี้ `cctv.card.in.th` → `localhost:3000` และ WebSocket `/ws/cam1-4` → port `9001-9004`

### Deploy จาก Windows (ต้องมี SSH key/password)

```powershell
cd C:\App\cctv\Web_Client
.\scripts\deploy.ps1
```

### Deploy แบบ Manual (ไม่มี SSH จากเครื่อง dev)

**1. สร้างไฟล์ deploy:**
```powershell
cd C:\App\cctv\Web_Client
npm run pack
```
ได้ไฟล์ `cctv-deploy.tar.gz`

**2. อัปโหลดผ่าน DirectAdmin File Manager:**
- ไปที่ `domains/cctvcard.in.th/public_html`
- อัปโหลด `cctv-deploy.tar.gz`
- Extract ไฟล์ในโฟลเดอร์นั้น

**3. เปิด Terminal ใน DirectAdmin (หรือ SSH จาก panel):**
```bash
cd /home/cctv/domains/cctvcard.in.th/public_html
cp .env.production.example .env
nano .env
chmod +x scripts/install-on-server.sh
bash scripts/install-on-server.sh
```

**4. ตั้ง reverse proxy** ตาม `deploy/nginx-cctv.card.in.th.conf`

### หมายเหตุ production

- ตั้ง `USE_DIRECT_WS_PORT=false` ใน `.env` เพื่อใช้ WebSocket ผ่าน HTTPS proxy
- ใช้ `DB_HOST=127.0.0.1` ถ้า PostgreSQL อยู่เครื่องเดียวกับ app
- ต้องมี FFmpeg และการเข้าถึง RTSP กล้องจากเซิร์ฟเวอร์


### Database: `no pg_hba.conf entry for host`

เซิร์ฟเวอร์ PostgreSQL ยังไม่อนุญาต IP ของเครื่องที่รัน app — ให้ admin DB whitelist IP แล้วรัน:

```bash
npm run db:migrate
```

### กล้อง RTSP 401 Unauthorized

ตั้งค่า `CAMERA_PASSWORD` ใน `.env` ให้ถูกต้อง (ค่าเริ่มต้นใน `.env.example` เป็น placeholder)
