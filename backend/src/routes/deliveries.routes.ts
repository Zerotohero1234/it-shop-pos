import { Router } from 'express';
import {
  getAllDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
} from '../controllers/deliveries.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/',    authenticate, getAllDeliveries);
router.get('/:id', authenticate, getDeliveryById);
router.patch('/:id', authenticate, updateDeliveryStatus);

export default router;
