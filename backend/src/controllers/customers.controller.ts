/**
 * Customers Controller
 * GET, POST, PUT, DELETE /api/customers
 */

import { Request, Response } from 'express';
import pool from '../config/db';
import { Customer } from '../types';
import { parsePositiveInt } from '../utils/validation';

// GET /api/customers
export async function getAllCustomers(req: Request, res: Response): Promise<void> {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';

    const conditions: string[] = [];
    const params: string[] = [];

    if (search) {
      conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute<Customer[]>(
      `SELECT id, name, email, phone, address, created_at, updated_at
       FROM customers ${where}
       ORDER BY created_at DESC`,
      params
    );

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນລູກຄ້າສຳເລັດ',
      data: rows,
      count: (rows as Customer[]).length,
    });
  } catch (error) {
    console.error('getAllCustomers error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// GET /api/customers/:id
export async function getCustomerById(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ລູກຄ້າບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [rows] = await pool.execute<Customer[]>(
      `SELECT id, name, email, phone, address, created_at, updated_at
       FROM customers WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!(rows as Customer[])[0]) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບລູກຄ້ານີ້' });
      return;
    }

    // Fetch purchase history
    const [sales] = await pool.execute<any[]>(
      `SELECT s.id, s.invoice_number, s.total, s.payment_method, s.payment_status, s.created_at
       FROM sales s WHERE s.customer_id = ?
       ORDER BY s.created_at DESC LIMIT 10`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນລູກຄ້າສຳເລັດ',
      data: { ...(rows as Customer[])[0], recent_sales: sales },
    });
  } catch (error) {
    console.error('getCustomerById error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// POST /api/customers
export async function createCustomer(req: Request, res: Response): Promise<void> {
  const { name, phone = null, email = null, address = null } = req.body;

  if (!name || String(name).trim() === '') {
    res.status(400).json({ success: false, message: 'ກະລຸນາໃສ່ຊື່ລູກຄ້າ' });
    return;
  }

  try {
    // Check duplicate email
    if (email) {
      const [dup] = await pool.execute<any[]>(
        'SELECT id FROM customers WHERE email = ? LIMIT 1',
        [email]
      );
      if ((dup as any[]).length > 0) {
        res.status(409).json({ success: false, message: 'Email ນີ້ຖືກໃຊ້ງານແລ້ວ' });
        return;
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)`,
      [String(name).trim(), phone, email || null, address]
    ) as any;

    res.status(201).json({
      success: true,
      message: 'ເພີ່ມລູກຄ້າສຳເລັດ',
      data: { id: result.insertId, name: String(name).trim() },
    });
  } catch (error) {
    console.error('createCustomer error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// PUT /api/customers/:id
export async function updateCustomer(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ລູກຄ້າບໍ່ຖືກຕ້ອງ' });
    return;
  }

  const allowed = ['name', 'phone', 'email', 'address'];
  const setClauses: string[] = [];
  const params: any[] = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(req.body[field] === '' ? null : req.body[field]);
    }
  }

  if (setClauses.length === 0) {
    res.status(400).json({ success: false, message: 'ບໍ່ມີຂໍ້ມູນທີ່ຕ້ອງການອັບເດດ' });
    return;
  }

  try {
    const [existing] = await pool.execute<Customer[]>(
      'SELECT id FROM customers WHERE id = ? LIMIT 1',
      [id]
    );
    if (!(existing as Customer[])[0]) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບລູກຄ້ານີ້' });
      return;
    }

    // Check duplicate email if email is being changed
    if (req.body.email) {
      const [dup] = await pool.execute<any[]>(
        'SELECT id FROM customers WHERE email = ? AND id != ? LIMIT 1',
        [req.body.email, id]
      );
      if ((dup as any[]).length > 0) {
        res.status(409).json({ success: false, message: 'Email ນີ້ຖືກໃຊ້ງານແລ້ວ' });
        return;
      }
    }

    params.push(id);
    await pool.execute(
      `UPDATE customers SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const [updated] = await pool.execute<Customer[]>(
      'SELECT id, name, email, phone, address, created_at, updated_at FROM customers WHERE id = ? LIMIT 1',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'ອັບເດດລູກຄ້າສຳເລັດ',
      data: (updated as Customer[])[0],
    });
  } catch (error) {
    console.error('updateCustomer error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// DELETE /api/customers/:id  (Admin only)
export async function deleteCustomer(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ລູກຄ້າບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [existing] = await pool.execute<Customer[]>(
      'SELECT id, name FROM customers WHERE id = ? LIMIT 1',
      [id]
    );
    if (!(existing as Customer[])[0]) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບລູກຄ້ານີ້' });
      return;
    }

    await pool.execute('DELETE FROM customers WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'ລຶບລູກຄ້າສຳເລັດ',
      data: { id },
    });
  } catch (error) {
    console.error('deleteCustomer error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}
