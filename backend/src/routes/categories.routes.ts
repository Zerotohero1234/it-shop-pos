import { Router } from 'express';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categories.controller';
import { authenticate, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/',    authenticate,            getAllCategories);
router.post('/',   authenticate, adminOnly, createCategory);
router.put('/:id', authenticate, adminOnly, updateCategory);
router.delete('/:id', authenticate, adminOnly, deleteCategory);

export default router;
