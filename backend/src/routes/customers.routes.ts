import { Router } from 'express';
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customers.controller';
import { authenticate, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/',    authenticate, getAllCustomers);
router.get('/:id', authenticate, getCustomerById);
router.post('/',   authenticate, createCustomer);
router.put('/:id', authenticate, updateCustomer);
router.delete('/:id', authenticate, adminOnly, deleteCustomer);

export default router;
