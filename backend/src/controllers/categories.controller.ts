/**
 * Categories Controller
 * GET    /api/categories      — ດຶງໝວດໝູ່ສິນຄ້າທັງໝົດ
 * POST   /api/categories      — ເພີ່ມໝວດໝູ່ (Admin only)
 * PUT    /api/categories/:id  — ແກ້ໄຂໝວດໝູ່ (Admin only)
 * DELETE /api/categories/:id  — ລຶບໝວດໝູ່ (Admin only)
 */

import { Request, Response } from 'express';
import pool from '../config/db';

// GET /api/categories
export async function getAllCategories(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT c.id, c.name, c.description, c.created_at,
              COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       GROUP BY c.id
       ORDER BY c.name ASC`
    );
    res.status(200).json({ success: true, message: 'ດຶງໝວດໝູ່ສຳເລັດ', data: rows });
  } catch (error) {
    console.error('getAllCategories error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// POST /api/categories  (Admin only)
export async function createCategory(req: Request, res: Response): Promise<void> {
  const { name, description = null } = req.body;
  if (!name || String(name).trim() === '') {
    res.status(400).json({ success: false, message: 'ກະລຸນາໃສ່ຊື່ໝວດໝູ່' });
    return;
  }
  try {
    const [dup] = await pool.execute<any[]>(
      'SELECT id FROM categories WHERE name = ? LIMIT 1',
      [String(name).trim()]
    );
    if ((dup as any[]).length > 0) {
      res.status(409).json({ success: false, message: 'ໝວດໝູ່ນີ້ມີຢູ່ແລ້ວ' });
      return;
    }
    const [result] = await pool.execute(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [String(name).trim(), description]
    ) as any;
    res.status(201).json({
      success: true,
      message: 'ເພີ່ມໝວດໝູ່ສຳເລັດ',
      data: { id: result.insertId, name: String(name).trim(), description, product_count: 0 },
    });
  } catch (error) {
    console.error('createCategory error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// PUT /api/categories/:id  (Admin only)
export async function updateCategory(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const { name, description = null } = req.body;

  if (!name || String(name).trim() === '') {
    res.status(400).json({ success: false, message: 'ກະລຸນາໃສ່ຊື່ໝວດໝູ່' });
    return;
  }
  try {
    // Check exists
    const [existing] = await pool.execute<any[]>(
      'SELECT id FROM categories WHERE id = ? LIMIT 1', [id]
    );
    if ((existing as any[]).length === 0) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບໝວດໝູ່' });
      return;
    }
    // Check duplicate name (excluding self)
    const [dup] = await pool.execute<any[]>(
      'SELECT id FROM categories WHERE name = ? AND id != ? LIMIT 1',
      [String(name).trim(), id]
    );
    if ((dup as any[]).length > 0) {
      res.status(409).json({ success: false, message: 'ຊື່ໝວດໝູ່ນີ້ມີຢູ່ແລ້ວ' });
      return;
    }
    await pool.execute(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [String(name).trim(), description, id]
    );
    res.status(200).json({ success: true, message: 'ແກ້ໄຂໝວດໝູ່ສຳເລັດ' });
  } catch (error) {
    console.error('updateCategory error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// DELETE /api/categories/:id  (Admin only)
export async function deleteCategory(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  try {
    const [existing] = await pool.execute<any[]>(
      'SELECT id FROM categories WHERE id = ? LIMIT 1', [id]
    );
    if ((existing as any[]).length === 0) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບໝວດໝູ່' });
      return;
    }
    // Unlink products before deleting (set category_id = NULL)
    await pool.execute('UPDATE products SET category_id = NULL WHERE category_id = ?', [id]);
    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
    res.status(200).json({ success: true, message: 'ລຶບໝວດໝູ່ສຳເລັດ' });
  } catch (error) {
    console.error('deleteCategory error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}
