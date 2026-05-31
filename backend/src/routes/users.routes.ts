import { Router } from 'express';
import { getAllUsers, updateUser, deleteUser, resetPassword } from '../controllers/users.controller';
import { authenticate, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/',                    authenticate, adminOnly, getAllUsers);
router.put('/:id',                 authenticate, adminOnly, updateUser);
router.delete('/:id',              authenticate, adminOnly, deleteUser);
router.put('/:id/reset-password',  authenticate, adminOnly, resetPassword);

export default router;
