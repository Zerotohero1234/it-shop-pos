/**
 * Deliveries Controller
 * GET, PATCH /api/deliveries
 */

import { Request, Response } from 'express';
import pool from '../config/db';
import { Delivery } from '../types';
import { parsePositiveInt } from '../utils/validation';

const VALID_STATUSES = ['Pending', 'Shipping', 'Delivered'] as const;
type DeliveryStatus = typeof VALID_STATUSES[number];

// GET /api/deliveries
export async function getAllDeliveries(req: Request, res: Response): Promise<void> {
  try {
    const statusFilter = req.query.status ? String(req.query.status) : '';

    const conditions: string[] = [];
    const params: string[] = [];

    if (statusFilter && VALID_STATUSES.includes(statusFilter as DeliveryStatus)) {
      conditions.push('d.status = ?');
      params.push(statusFilter);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute<Delivery[]>(
      `SELECT
         d.id, d.sale_id, d.address, d.status, d.driver_name,
         d.delivery_date, d.notes, d.created_at, d.updated_at,
         s.invoice_number,
         s.total,
         c.name AS customer_name
       FROM deliveries d
       LEFT JOIN sales     s ON d.sale_id = s.id
       LEFT JOIN customers c ON s.customer_id = c.id
       ${where}
       ORDER BY d.created_at DESC`,
      params
    );

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນການຈັດສົ່ງສຳເລັດ',
      data: rows,
      count: (rows as Delivery[]).length,
    });
  } catch (error) {
    console.error('getAllDeliveries error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// GET /api/deliveries/:id
export async function getDeliveryById(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [rows] = await pool.execute<Delivery[]>(
      `SELECT
         d.*, s.invoice_number, s.total,
         c.name AS customer_name, c.phone AS customer_phone
       FROM deliveries d
       LEFT JOIN sales     s ON d.sale_id = s.id
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE d.id = ? LIMIT 1`,
      [id]
    );

    if (!(rows as Delivery[])[0]) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບການຈັດສົ່ງນີ້' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນການຈັດສົ່ງສຳເລັດ',
      data: (rows as Delivery[])[0],
    });
  } catch (error) {
    console.error('getDeliveryById error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// PATCH /api/deliveries/:id  (Admin only)
// Body: { status: 'Pending'|'Shipping'|'Delivered', driver_name? }
export async function updateDeliveryStatus(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ບໍ່ຖືກຕ້ອງ' });
    return;
  }

  const { status, driver_name } = req.body;

  if (!status || !VALID_STATUSES.includes(status as DeliveryStatus)) {
    res.status(400).json({
      success: false,
      message: `ສະຖານະຕ້ອງເປັນ: ${VALID_STATUSES.join(', ')}`,
    });
    return;
  }

  try {
    const [existing] = await pool.execute<Delivery[]>(
      'SELECT id, status FROM deliveries WHERE id = ? LIMIT 1',
      [id]
    );

    if (!(existing as Delivery[])[0]) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບການຈັດສົ່ງນີ້' });
      return;
    }

    const current = (existing as any[])[0].status as string;

    // Enforce forward-only transitions: Pending → Shipping → Delivered
    const order = { Pending: 0, Shipping: 1, Delivered: 2 };
    if (order[status as DeliveryStatus] <= order[current as DeliveryStatus]) {
      res.status(400).json({
        success: false,
        message: `ບໍ່ສາມາດປ່ຽນຈາກ "${current}" ເປັນ "${status}" ໄດ້`,
      });
      return;
    }

    const setClauses = ['status = ?'];
    const params: any[] = [status];

    if (driver_name !== undefined) {
      setClauses.push('driver_name = ?');
      params.push(driver_name || null);
    }

    params.push(id);
    await pool.execute(
      `UPDATE deliveries SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const [updated] = await pool.execute<Delivery[]>(
      `SELECT d.*, s.invoice_number, c.name AS customer_name
       FROM deliveries d
       LEFT JOIN sales s ON d.sale_id = s.id
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE d.id = ? LIMIT 1`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: `ອັບເດດສະຖານະເປັນ "${status}" ສຳເລັດ`,
      data: (updated as Delivery[])[0],
    });
  } catch (error) {
    console.error('updateDeliveryStatus error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}
