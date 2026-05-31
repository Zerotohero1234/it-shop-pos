/**
 * Auth Routes
 * ທຸກ route ສຳລັບ Authentication
 */

import { Router } from 'express';
import { login, register, getMe, changePassword } from '../controllers/authController';
import { authenticate, adminOnly } from '../middleware/auth';

const router = Router();

/**
 * @route  POST /api/auth/login
 * @desc   Login with email & password → returns JWT token
 * @access Public
 */
router.post('/login', login);

/**
 * @route  POST /api/auth/register
 * @desc   Create a new user account (admin only)
 * @access Admin
 */
router.post('/register', authenticate, adminOnly, register);

/**
 * @route  GET /api/auth/me
 * @desc   Get current logged-in user profile
 * @access Private
 */
router.get('/me', authenticate, getMe);

/**
 * @route  PUT /api/auth/change-password
 * @desc   Change own password
 * @access Private
 */
router.put('/change-password', authenticate, changePassword);

export default router;
