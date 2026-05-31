# 🛒 IT Shop POS & Inventory Management System

Point of Sale (POS) and inventory management system for IT equipment stores.  

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript |
| Database | MySQL 8.0 (Docker) |
| Auth | JWT + bcrypt |

---

## 🚀 Installation and Setup

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Git

### Step 1: Clone Project
```bash
git clone https://github.com/YOUR_USERNAME/it-shop-pos.git
cd it-shop-pos
```

### Step 2: Start MySQL (Docker)
```bash
docker-compose up -d

# Wait 10-20 seconds, then check
docker-compose ps
docker-compose logs mysql
```

### Step 3: Setup Backend
```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run backend (port 3001)
npm run dev
```

### Step 4: Setup Frontend
```bash
cd frontend

# Install dependencies
npm install

# Run frontend (port 3000)
npm run dev
```

### Step 5: Open Browser