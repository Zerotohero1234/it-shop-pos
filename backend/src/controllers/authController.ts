/**
 * Auth Controller
 * ຈັດການ Login, Register, GetMe, ChangePassword
 */

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { generateToken } from '../utils/jwt';
import { User, UserPublic } from '../types';

const SALT_ROUNDS = 10;

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { username, password }
// ─────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  // Validate required fields
  if (!username || !password) {
    res.status(400).json({
      success: false,
      message: 'ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ',
    });
    return;
  }

  try {
    // Find user by username
    const [rows] = await pool.execute<User[]>(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );

    const user = rows[0];

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ',
      });
      return;
    }

    // Compare password with bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ',
      });
      return;
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    // Build public user object (no password)
    const userPublic: UserPublic = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
    };

    res.status(200).json({
      success: true,
      message: 'ເຂົ້າສູ່ລະບົບສຳເລັດ',
      data: {
        token,
        user: userPublic,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ',
    });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register  (Admin only — enforced in route)
// Body: { username, password, name, role? }
// ─────────────────────────────────────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  const { username, password, name, role = 'Employee' } = req.body;

  // Validate required fields
  if (!username || !password || !name) {
    res.status(400).json({
      success: false,
      message: 'ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້, ລະຫັດຜ່ານ ແລະ ຊື່',
    });
    return;
  }

  // Validate role
  if (!['Admin', 'Employee'].includes(role)) {
    res.status(400).json({
      success: false,
      message: 'Role ບໍ່ຖືກຕ້ອງ (ໃຊ້ Admin ຫຼື Employee)',
    });
    return;
  }

  // Username: letters, numbers, underscore only, 3-50 chars
  const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
  if (!usernameRegex.test(username)) {
    res.status(400).json({
      success: false,
      message: 'ຊື່ຜູ້ໃຊ້ຕ້ອງມີ 3-50 ຕົວ (a-z, 0-9, _) ເທົ່ານັ້ນ',
    });
    return;
  }

  // Password min length
  if (password.length < 6) {
    res.status(400).json({
      success: false,
      message: 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ',
    });
    return;
  }

  try {
    // Check duplicate username
    const [existing] = await pool.execute<User[]>(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );

    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        message: 'ຊື່ຜູ້ໃຊ້ນີ້ຖືກໃຊ້ງານແລ້ວ',
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new user
    const [result] = await pool.execute(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      [username.trim(), hashedPassword, name.trim(), role]
    ) as any;

    res.status(201).json({
      success: true,
      message: 'ສ້າງບັນຊີຜູ້ໃຊ້ສຳເລັດ',
      data: {
        id: result.insertId,
        username: username.trim(),
        name: name.trim(),
        role,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ',
    });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me  (requires authenticate middleware)
// ─────────────────────────────────────────────────────────────
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute<User[]>(
      'SELECT id, username, name, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user!.id]
    );

    const user = rows[0];

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'ບໍ່ພົບຂໍ້ມູນຜູ້ໃຊ້',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນຜູ້ໃຊ້ສຳເລັດ',
      data: user,
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ',
    });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/auth/change-password  (requires authenticate middleware)
// Body: { currentPassword, newPassword }
// ─────────────────────────────────────────────────────────────
export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({
      success: false,
      message: 'ກະລຸນາໃສ່ລະຫັດຜ່ານປັດຈຸບັນ ແລະ ລະຫັດຜ່ານໃໝ່',
    });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({
      success: false,
      message: 'ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ',
    });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({
      success: false,
      message: 'ລະຫັດຜ່ານໃໝ່ຕ້ອງຕ່າງຈາກລະຫັດຜ່ານປັດຈຸບັນ',
    });
    return;
  }

  try {
    // Fetch current user with password hash
    const [rows] = await pool.execute<User[]>(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [req.user!.id]
    );

    const user = rows[0];
    if (!user) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບຂໍ້ມູນຜູ້ໃຊ້' });
      return;
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ',
      });
      return;
    }

    // Hash new password and update
    const hashedNew = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [
      hashedNew,
      req.user!.id,
    ]);

    res.status(200).json({
      success: true,
      message: 'ປ່ຽນລະຫັດຜ່ານສຳເລັດ',
    });
  } catch (error) {
    console.error('ChangePassword error:', error);
    res.status(500).json({
      success: false,
      message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ',
    });
  }
}
