/**
 * Users Controller  (Admin only for all endpoints)
 * GET    /api/users             — ລາຍຊື່ຜູ້ໃຊ້ທັງໝົດ
 * PUT    /api/users/:id         — ແກ້ໄຂຂໍ້ມູນຜູ້ໃຊ້
 * DELETE /api/users/:id         — ລຶບຜູ້ໃຊ້
 * PUT    /api/users/:id/reset-password — ຣີເຊັດລະຫັດຜ່ານ
 */

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { User } from '../types';

const SALT_ROUNDS = 10;

// GET /api/users
export async function getAllUsers(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute<User[]>(
      `SELECT id, username, name, role, created_at
       FROM users
       ORDER BY role ASC, name ASC`
    );
    res.status(200).json({ success: true, message: 'ດຶງຂໍ້ມູນສຳເລັດ', data: rows });
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// PUT /api/users/:id
export async function updateUser(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const { name, role } = req.body;

  if (!name || String(name).trim() === '') {
    res.status(400).json({ success: false, message: 'ກະລຸນາໃສ່ຊື່' });
    return;
  }
  if (role && !['Admin', 'Employee'].includes(role)) {
    res.status(400).json({ success: false, message: 'Role ບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [existing] = await pool.execute<User[]>(
      'SELECT id FROM users WHERE id = ? LIMIT 1', [id]
    );
    if ((existing as any[]).length === 0) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບຜູ້ໃຊ້' });
      return;
    }

    // Prevent admin from demoting themselves
    if (req.user!.id === id && role && role !== req.user!.role) {
      res.status(403).json({ success: false, message: 'ບໍ່ສາມາດປ່ຽນ Role ຂອງຕົນເອງໄດ້' });
      return;
    }

    await pool.execute(
      'UPDATE users SET name = ?, role = ? WHERE id = ?',
      [String(name).trim(), role || 'Employee', id]
    );
    res.status(200).json({ success: true, message: 'ແກ້ໄຂຂໍ້ມູນສຳເລັດ' });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// DELETE /api/users/:id
export async function deleteUser(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);

  if (req.user!.id === id) {
    res.status(403).json({ success: false, message: 'ບໍ່ສາມາດລຶບບັນຊີຂອງຕົນເອງໄດ້' });
    return;
  }

  try {
    const [existing] = await pool.execute<User[]>(
      'SELECT id FROM users WHERE id = ? LIMIT 1', [id]
    );
    if ((existing as any[]).length === 0) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບຜູ້ໃຊ້' });
      return;
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    res.status(200).json({ success: true, message: 'ລຶບຜູ້ໃຊ້ສຳເລັດ' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// PUT /api/users/:id/reset-password
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword || String(newPassword).length < 6) {
    res.status(400).json({ success: false, message: 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ' });
    return;
  }

  try {
    const [existing] = await pool.execute<User[]>(
      'SELECT id FROM users WHERE id = ? LIMIT 1', [id]
    );
    if ((existing as any[]).length === 0) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບຜູ້ໃຊ້' });
      return;
    }

    const hashed = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
    res.status(200).json({ success: true, message: 'ຣີເຊັດລະຫັດຜ່ານສຳເລັດ' });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}
