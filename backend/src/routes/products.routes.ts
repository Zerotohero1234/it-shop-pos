/**
 * Products Routes
 *
 * GET    /api/products           – ດຶງສິນຄ້າທັງໝົດ
 * GET    /api/products/:id       – ດຶງສິນຄ້າຕາມ ID
 * POST   /api/products           – ເພີ່ມສິນຄ້າ (Admin)
 * PUT    /api/products/:id       – ແກ້ໄຂສິນຄ້າ (Admin)
 * DELETE /api/products/:id       – ລຶບສິນຄ້າ (Admin)
 * POST   /api/products/:id/image – ອັບໂຫຼດຮູບ (Admin)
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import pool from '../config/db';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/products.controller';
import { authenticate, adminOnly } from '../middleware/auth';
import { handleUpload } from '../middleware/upload';
import { parsePositiveInt } from '../utils/validation';

const router = Router();

router.get('/',    authenticate, getAllProducts);
router.get('/:id', authenticate, getProductById);
router.post('/',   authenticate, adminOnly, createProduct);
router.put('/:id', authenticate, adminOnly, updateProduct);
router.delete('/:id', authenticate, adminOnly, deleteProduct);

/**
 * POST /api/products/:id/image
 * Upload / replace product image (multipart/form-data, field name: "image")
 * Returns: { success, data: { image_url } }
 */
router.post('/:id/image', authenticate, adminOnly, handleUpload, async (req: Request, res: Response): Promise<void> => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ສິນຄ້າບໍ່ຖືກຕ້ອງ' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ success: false, message: 'ກະລຸນາເລືອກໄຟລ໌ຮູບ' });
    return;
  }

  try {
    // Build public URL: /uploads/products/filename.jpg
    const imageUrl = `/uploads/products/${req.file.filename}`;

    await pool.execute(
      'UPDATE products SET image_url = ? WHERE id = ? AND is_active = 1',
      [imageUrl, id]
    );

    res.status(200).json({
      success: true,
      message: 'ອັບໂຫຼດຮູບສິນຄ້າສຳເລັດ',
      data: {
        image_url: imageUrl,
        full_url:  `${process.env.API_BASE_URL || 'http://localhost:3001'}${imageUrl}`,
        filename:  req.file.filename,
      },
    });
  } catch (error) {
    console.error('uploadProductImage error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
});

export default router;
