import { Router } from 'express';
import { authenticate, adminOnly } from '../middleware/auth';
import {
  getAll, getSummary, getById,
  create, update, remove,
} from '../controllers/income-expenses.controller';

const router = Router();

// summary must come before /:id so it isn't swallowed by the param route
router.get('/summary', authenticate, getSummary);
router.get('/',        authenticate, getAll);
router.get('/:id',     authenticate, getById);
router.post('/',       authenticate, adminOnly, create);
router.put('/:id',     authenticate, adminOnly, update);
router.delete('/:id',  authenticate, adminOnly, remove);

export default router;
