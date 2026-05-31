/**
 * Authentication & Authorization Middleware
 * MiddleWare ສຳຫລັບກວດສອບ JWT Token ແລະ Role
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractBearerToken } from '../utils/jwt';
import { UserRole } from '../types';

/**
 * authenticate — verifies JWT and attaches user to req.user
 * ໃຊ້ສຳລັບ route ທີ່ຕ້ອງການ login ກ່ອນ
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'ກະລຸນາ login ກ່ອນ (ບໍ່ມີ token)',
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    // Distinguish expired vs invalid
    const isExpired = error instanceof Error && error.name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      message: isExpired ? 'Token ໝົດອາຍຸ ກະລຸນາ login ໃໝ່' : 'Token ບໍ່ຖືກຕ້ອງ',
    });
  }
}

/**
 * requireRole — checks that req.user has one of the allowed roles
 * ໃຊ້ຕໍ່ຈາກ authenticate ສຳລັບ route ທີ່ຕ້ອງການ Role ສະເພາະ
 *
 * @example  router.delete('/users/:id', authenticate, requireRole('admin'), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'ກະລຸນາ login ກ່ອນ',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'ທ່ານບໍ່ມີສິດໃນການດຳເນີນການນີ້',
      });
      return;
    }

    next();
  };
}

/**
 * adminOnly — shorthand for requireRole('Admin')
 */
export const adminOnly = requireRole('Admin');
