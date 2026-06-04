-- IT Shop POS Database Schema
-- Created: 2026-05-26
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS it_shop_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE it_shop_db;

-- ─────────────────────────────────────────
-- Users (staff / admin accounts)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('Admin', 'Employee') NOT NULL DEFAULT 'Employee',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- Product Categories
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- Products
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  category_id  INT,
  sku          VARCHAR(100) NOT NULL UNIQUE,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  price        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  cost_price   DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stock        INT NOT NULL DEFAULT 0,
  min_stock    INT NOT NULL DEFAULT 5,
  image_url    VARCHAR(500),
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- Customers
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE,
  phone       VARCHAR(20),
  address     TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- Sales (orders / transactions)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number  VARCHAR(50) NOT NULL UNIQUE,
  customer_id     INT,
  user_id         INT NOT NULL,
  subtotal        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  tax             DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total           DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_method  ENUM('cash', 'card', 'transfer') NOT NULL DEFAULT 'cash',
  payment_status  ENUM('paid', 'pending', 'refunded') NOT NULL DEFAULT 'paid',
  refund_status   ENUM('none', 'partial', 'full') NOT NULL DEFAULT 'none',
  notes           TEXT,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id)     REFERENCES users(id)
);

-- ─────────────────────────────────────────
-- Sale Items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sale_id     INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL,
  unit_price  DECIMAL(10, 2) NOT NULL,
  subtotal    DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (sale_id)    REFERENCES sales(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ─────────────────────────────────────────
-- Deliveries
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  sale_id        INT NOT NULL,
  address        TEXT NOT NULL,
  status         ENUM('Pending', 'Shipping', 'Delivered') NOT NULL DEFAULT 'Pending',
  driver_name    VARCHAR(100),
  delivery_date  DATE,
  notes          TEXT,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- Income & Expenses
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS income_expenses (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  type              ENUM('Income', 'Expense') NOT NULL,
  amount            DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  description       TEXT,
  transaction_date  DATE NOT NULL,
  source            ENUM('manual', 'sale', 'return') NOT NULL DEFAULT 'manual',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- Return Items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS return_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  sale_id        INT NOT NULL,
  sale_item_id   INT NOT NULL,
  product_id     INT NOT NULL,
  quantity       INT NOT NULL,
  refund_amount  DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  reason         TEXT,
  returned_by    INT NOT NULL,
  returned_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id)      REFERENCES sales(id)      ON DELETE CASCADE,
  FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)   REFERENCES products(id),
  FOREIGN KEY (returned_by)  REFERENCES users(id)
);

-- ─────────────────────────────────────────
-- Seed Data
-- ─────────────────────────────────────────
INSERT IGNORE INTO users (username, name, password, role) VALUES
  ('admin', 'ຜູ້ດູແລລະບົບ', '$2b$10$.a4jvUrZ9a5Nh/Ave/RcgenBxP.07dU01wsLLnQ/2W5i7LASCVv7C', 'Admin');
-- Default password above is "admin123" (bcrypt hash) — change before going to production

INSERT IGNORE INTO categories (name, description) VALUES
  ('Laptops',     'Portable computers and notebooks'),
  ('Desktops',    'Desktop computers and workstations'),
  ('Components',  'CPU, RAM, SSD, GPU and other parts'),
  ('Peripherals', 'Keyboards, mice, monitors and accessories'),
  ('Networking',  'Routers, switches, cables and adapters'),
  ('Storage',     'Hard drives, SSDs, USB drives and memory cards');
