# 🚀 Quick Start Guide - IT Shop POS

## ✅ Prerequisites
- [x] Node.js 18+ ติดตั้งแล้ว
- [x] Docker Desktop ติดตั้งและเปิดอยู่
- [x] npm dependencies ติดตั้งแล้ว

---

## 🐳 ใช้ Docker (แนะนำ)

```bash
# 1. ที่ root directory
cd /path/to/it-shop-pos

# 2. เริ่ม MySQL
docker-compose up -d

# 3. ตรวจสอบ
docker-compose ps

# 4. ไปที่ backend
cd backend

# 5. รัน backend
npm run dev
```

**ทดสอบ:** http://localhost:3001/api/health ✅

---

## 💻 Quick Commands

```bash
# Backend
cd backend
npm run dev         # รัน dev (port 3001)
npm run build       # build TypeScript
npm start          # รัน production

# Docker
docker-compose up -d        # เริ่ม MySQL
docker-compose down         # หยุด MySQL
docker-compose logs mysql   # ดู logs
docker-compose ps          # ดูสถานะ

# MySQL
docker exec -it it-shop-mysql mysql -u it_shop_user -pit_shop_pass it_shop_db
```

---

## ❌ ถ้าเจอ Error

### Port 5000 conflict (macOS AirPlay)

**แก้ไข:**
```bash
cd backend
nano .env
# เปลี่ยนเป็น PORT=3001
npm run dev
```

### Cannot connect to database

```bash
docker-compose ps       # เช็ค MySQL
docker-compose up -d    # เริ่ม MySQL
docker-compose logs mysql  # ดู logs
```

### ECONNREFUSED

```bash
cat backend/.env  # ตรวจสอบ credentials
# ควรเป็น:
# DB_HOST=localhost
# DB_USER=it_shop_user
# DB_PASSWORD=it_shop_pass
```

---

## ✅ ถ้าสำเร็จจะเห็น

```
🚀 IT Shop POS API Server is running
📍 Environment: development
🌐 Server URL: http://localhost:3001
💚 Health Check: http://localhost:3001/api/health
✅ Database connection established successfully
```

**เปิด browser:** http://localhost:3001/api/health

**Response:**
```json
{
  "success": true,
  "message": "IT Shop POS API ກຳລັງເຮັດວຽກ",
  "data": {
    "database": "ເຊື່ອມຕໍ່ແລ້ວ",
    ...
  }
}
```

---

## 📚 API Endpoints

| Endpoint | Method |
|----------|--------|
| `http://localhost:3001/` | GET |
| `http://localhost:3001/api/health` | GET |

---

## 🎯 Next Steps

✅ Phase 1 เสร็จแล้ว!

**Phase 2: Authentication**
- Login API
- JWT Token
- Password Hashing
- Protected Routes

---

**พร้อมแล้วให้เริ่ม Phase 2!** 🚀
