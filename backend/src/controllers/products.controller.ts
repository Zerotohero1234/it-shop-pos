/**
 * Products Controller
 * ຈັດການ CRUD ສິນຄ້າ — GET, POST, PUT, DELETE
 *
 * DB Schema (actual):
 *   id, category_id, sku, name, description,
 *   price, cost_price, stock, min_stock,
 *   image_url, is_active, created_at, updated_at
 */

import { Request, Response } from 'express';
import pool from '../config/db';
import { Product } from '../types';
import { parsePositiveInt } from '../utils/validation';

// ─────────────────────────────────────────────────────────────
// Helper: generate a simple SKU when caller doesn't provide one
// ─────────────────────────────────────────────────────────────
function generateSku(): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SKU-${Date.now()}-${rand}`;
}

// ─────────────────────────────────────────────────────────────
// GET /api/products
// Query params:
//   search    – ค้นหาจาก name หรือ sku
//   page      – หน้า (default 1)
//   limit     – จำนวนต่อหน้า (default 20, max 100)
//   low_stock – "true" → แสดงเฉพาะสินค้าที่ stock < min_stock
// ─────────────────────────────────────────────────────────────
export async function getAllProducts(req: Request, res: Response): Promise<void> {
  try {
    const search    = req.query.search    ? String(req.query.search).trim() : '';
    const lowStock  = req.query.low_stock === 'true';
    const page      = Math.max(1, parsePositiveInt(req.query.page)  ?? 1);
    const limit     = Math.min(100, Math.max(1, parsePositiveInt(req.query.limit) ?? 20));
    const offset    = (page - 1) * limit;

    // Build WHERE clauses dynamically
    const conditions: string[] = ['p.is_active = 1'];
    const params: any[]        = [];

    if (search) {
      conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (lowStock) {
      conditions.push('p.stock < p.min_stock');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total rows for pagination meta
    const [countRows] = await pool.execute<any[]>(
      `SELECT COUNT(*) as total
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${where}`,
      params
    );
    const total = (countRows[0] as any).total as number;

    // Fetch page of products
    // Note: LIMIT/OFFSET are safe integer literals (validated above) — not user input
    const [rows] = await pool.execute<Product[]>(
      `SELECT
         p.id, p.sku, p.name, p.description,
         p.price, p.cost_price, p.stock, p.min_stock,
         p.image_url, p.is_active, p.created_at, p.updated_at,
         p.category_id,
         c.name AS category_name,
         IF(p.stock < p.min_stock, 1, 0) AS low_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    // Count low-stock items overall (for dashboard badge)
    const [lowRows] = await pool.execute<any[]>(
      `SELECT COUNT(*) as cnt FROM products WHERE is_active = 1 AND stock < min_stock`
    );
    const lowStockCount = (lowRows[0] as any).cnt as number;

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນສິນຄ້າສຳເລັດ',
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        lowStockCount,
      },
    });
  } catch (error) {
    console.error('getAllProducts error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/products/:id
// ─────────────────────────────────────────────────────────────
export async function getProductById(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ສິນຄ້າບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [rows] = await pool.execute<Product[]>(
      `SELECT
         p.id, p.sku, p.name, p.description,
         p.price, p.cost_price, p.stock, p.min_stock,
         p.image_url, p.is_active, p.created_at, p.updated_at,
         p.category_id,
         c.name AS category_name,
         IF(p.stock < p.min_stock, 1, 0) AS low_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ? AND p.is_active = 1
       LIMIT 1`,
      [id]
    );

    if (!rows[0]) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບສິນຄ້ານີ້' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນສິນຄ້າສຳເລັດ',
      data: rows[0],
    });
  } catch (error) {
    console.error('getProductById error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/products  (Admin only)
// Body: { name, price, stock?, min_stock?, sku?, category_id?,
//         description?, cost_price?, image_url? }
// ─────────────────────────────────────────────────────────────
export async function createProduct(req: Request, res: Response): Promise<void> {
  const {
    name,
    price,
    stock       = 0,
    min_stock   = 5,
    sku,
    category_id = null,
    description = null,
    cost_price  = 0,
    image_url   = null,
  } = req.body;

  // Validate required fields
  if (!name || name.trim() === '') {
    res.status(400).json({ success: false, message: 'ກະລຸນາໃສ່ຊື່ສິນຄ້າ' });
    return;
  }
  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
    res.status(400).json({ success: false, message: 'ກະລຸນາໃສ່ລາຄາສິນຄ້າທີ່ຖືກຕ້ອງ' });
    return;
  }
  if (isNaN(Number(stock)) || Number(stock) < 0) {
    res.status(400).json({ success: false, message: 'ຈຳນວນສິນຄ້າຕ້ອງເປັນຕົວເລກທີ່ ≥ 0' });
    return;
  }

  const finalSku = sku && String(sku).trim() !== '' ? String(sku).trim() : generateSku();

  try {
    // Check duplicate SKU
    const [existing] = await pool.execute<any[]>(
      'SELECT id FROM products WHERE sku = ? LIMIT 1',
      [finalSku]
    );
    if (existing.length > 0) {
      res.status(409).json({ success: false, message: 'SKU ນີ້ຖືກໃຊ້ງານແລ້ວ' });
      return;
    }

    // Check category exists if provided
    if (category_id !== null) {
      const [cat] = await pool.execute<any[]>(
        'SELECT id FROM categories WHERE id = ? LIMIT 1',
        [category_id]
      );
      if (cat.length === 0) {
        res.status(400).json({ success: false, message: 'ບໍ່ພົບໝວດໝູ່ສິນຄ້ານີ້' });
        return;
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO products
         (category_id, sku, name, description, price, cost_price, stock, min_stock, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id,
        finalSku,
        String(name).trim(),
        description,
        Number(price),
        Number(cost_price),
        Number(stock),
        Number(min_stock),
        image_url,
      ]
    ) as any;

    res.status(201).json({
      success: true,
      message: 'ເພີ່ມສິນຄ້າສຳເລັດ',
      data: { id: result.insertId, sku: finalSku, name: String(name).trim() },
    });
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/products/:id  (Admin only)
// Body: any subset of { name, price, stock, min_stock, sku,
//        category_id, description, cost_price, image_url }
// ─────────────────────────────────────────────────────────────
export async function updateProduct(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ສິນຄ້າບໍ່ຖືກຕ້ອງ' });
    return;
  }

  // Build SET clause from only the fields the caller sent
  const allowed = ['name', 'price', 'stock', 'min_stock', 'sku',
                   'category_id', 'description', 'cost_price', 'image_url'];
  const setClauses: string[] = [];
  const params: any[]        = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(req.body[field] === '' ? null : req.body[field]);
    }
  }

  if (setClauses.length === 0) {
    res.status(400).json({ success: false, message: 'ບໍ່ມີຂໍ້ມູນທີ່ຕ້ອງການອັپເດດ' });
    return;
  }

  // Basic validation for numeric fields if present
  if (req.body.price !== undefined && (isNaN(Number(req.body.price)) || Number(req.body.price) < 0)) {
    res.status(400).json({ success: false, message: 'ລາຄາຕ້ອງເປັນຕົວເລກທີ່ ≥ 0' });
    return;
  }
  if (req.body.stock !== undefined && (isNaN(Number(req.body.stock)) || Number(req.body.stock) < 0)) {
    res.status(400).json({ success: false, message: 'ຈຳນວນສິນຄ້າຕ້ອງເປັນຕົວເລກທີ່ ≥ 0' });
    return;
  }

  try {
    // Ensure product exists
    const [existing] = await pool.execute<Product[]>(
      'SELECT id FROM products WHERE id = ? AND is_active = 1 LIMIT 1',
      [id]
    );
    if (!existing[0]) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບສິນຄ້ານີ້' });
      return;
    }

    // Check duplicate SKU if sku is being changed
    if (req.body.sku !== undefined) {
      const [dupSku] = await pool.execute<any[]>(
        'SELECT id FROM products WHERE sku = ? AND id != ? LIMIT 1',
        [req.body.sku, id]
      );
      if (dupSku.length > 0) {
        res.status(409).json({ success: false, message: 'SKU ນີ້ຖືກໃຊ້ງານແລ້ວ' });
        return;
      }
    }

    params.push(id); // for WHERE id = ?
    await pool.execute(
      `UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    // Return updated product
    const [updated] = await pool.execute<Product[]>(
      `SELECT p.*, c.name AS category_name,
              IF(p.stock < p.min_stock, 1, 0) AS low_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'ອັປເດດສິນຄ້າສຳເລັດ',
      data: updated[0],
    });
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/products/:id  (Admin only — soft delete)
// ─────────────────────────────────────────────────────────────
export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ສິນຄ້າບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [existing] = await pool.execute<Product[]>(
      'SELECT id, name FROM products WHERE id = ? AND is_active = 1 LIMIT 1',
      [id]
    );
    if (!existing[0]) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບສິນຄ້ານີ້' });
      return;
    }

    // Soft delete: set is_active = 0
    await pool.execute('UPDATE products SET is_active = 0 WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'ລຶບສິນຄ້າສຳເລັດ',
      data: { id, name: (existing[0] as any).name },
    });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}
