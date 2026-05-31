import { Router } from 'express';
import {
  getDailyReport,
  getMonthlyReport,
  getLowStockReport,
  getIncomeExpenses,
  getTopProducts,
} from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/daily',             authenticate, getDailyReport);
router.get('/monthly',           authenticate, getMonthlyReport);
router.get('/low-stock',         authenticate, getLowStockReport);
router.get('/income-expenses',   authenticate, getIncomeExpenses);
router.get('/top-products',      authenticate, getTopProducts);

export default router;
