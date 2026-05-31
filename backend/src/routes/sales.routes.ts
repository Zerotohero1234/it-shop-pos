import { Router } from 'express';
import {
  getAllSales, getSaleById,
  createSale, returnSale, getReturnHistory,
} from '../controllers/sales.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/',               authenticate, getAllSales);
router.get('/:id',            authenticate, getSaleById);
router.get('/:id/returns',    authenticate, getReturnHistory);
router.post('/',              authenticate, createSale);
router.post('/:id/return',    authenticate, returnSale);

// Keep legacy /refund alias so any older clients don't break
router.post('/:id/refund',    authenticate, returnSale);

export default router;
