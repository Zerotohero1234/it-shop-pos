/**
 * Sales Controller
 * POS Checkout, Sales History, Full/Partial Returns
 *
 * DB: sales (invoice_number, subtotal, total, payment_method, payment_status,
 *            refund_status: none/partial/full)
 *     sale_items   (sale_id, product_id, quantity, unit_price, subtotal)
 *     return_items (sale_id, sale_item_id, product_id, quantity, refund_amount, reason, returned_by)
 *     deliveries   (sale_id, address, status, driver_name, delivery_date)
 */

import { Request, Response } from 'express';
import pool from '../config/db';
import { parsePositiveInt } from '../utils/validation';

// Generate invoice number: INV-YYYYMMDD-XXXX
function generateInvoiceNumber(): string {
  const date = new Date();
  const d = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${d}-${rand}`;
}

// Normalize payment method
function normalizePaymentMethod(raw: string): 'cash' | 'transfer' | 'card' {
  const lower = String(raw).toLowerCase();
  if (lower === 'transfer') return 'transfer';
  if (lower === 'card')     return 'card';
  return 'cash';
}

// ─────────────────────────────────────────────────────────────
// GET /api/sales
// Query: ?page=1&limit=20&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
export async function getAllSales(req: Request, res: Response): Promise<void> {
  try {
    const page      = Math.max(1, parsePositiveInt(req.query.page)  ?? 1);
    const limit     = Math.min(100, Math.max(1, parsePositiveInt(req.query.limit) ?? 20));
    const offset    = (page - 1) * limit;
    const startDate = req.query.start_date ? String(req.query.start_date) : null;
    const endDate   = req.query.end_date   ? String(req.query.end_date)   : null;

    let dateCondition = '';
    const dateParams: string[] = [];

    if (startDate && endDate) {
      dateCondition = 'WHERE DATE(s.created_at) BETWEEN ? AND ?';
      dateParams.push(startDate, endDate);
    }

    const [rows] = await pool.execute<any[]>(
      `SELECT
         s.id, s.invoice_number, s.total, s.subtotal, s.discount, s.tax,
         s.payment_method, s.payment_status, s.refund_status, s.notes, s.created_at,
         c.id   AS customer_id,
         c.name AS customer_name,
         u.id   AS user_id,
         u.name AS user_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN users     u ON s.user_id = u.id
       ${dateCondition}
       ORDER BY s.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      dateParams
    );

    const [countRow] = await pool.execute<any[]>(
      `SELECT COUNT(*) AS total FROM sales s ${dateCondition}`,
      dateParams
    );

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນການຂາຍສຳເລັດ',
      data: rows,
      meta: {
        total: (countRow as any[])[0].total,
        page,
        limit,
        totalPages: Math.ceil((countRow as any[])[0].total / limit),
      },
    });
  } catch (error) {
    console.error('getAllSales error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/sales/:id
// Returns items with returned_qty + full return_history
// ─────────────────────────────────────────────────────────────
export async function getSaleById(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [saleRows] = await pool.execute<any[]>(
      `SELECT s.*, c.name AS customer_name, u.name AS user_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN users     u ON s.user_id = u.id
       WHERE s.id = ? LIMIT 1`,
      [id]
    );

    if (!(saleRows as any[])[0]) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບການຂາຍນີ້' });
      return;
    }

    // Sale items with returned_qty per item
    const [items] = await pool.execute<any[]>(
      `SELECT
         si.*,
         p.name AS product_name,
         p.sku,
         COALESCE(SUM(ri.quantity), 0) AS returned_qty
       FROM sale_items si
       LEFT JOIN products p ON si.product_id = p.id
       LEFT JOIN return_items ri ON ri.sale_item_id = si.id
       WHERE si.sale_id = ?
       GROUP BY si.id`,
      [id]
    );

    // Full return history
    const [returnHistory] = await pool.execute<any[]>(
      `SELECT
         ri.id, ri.sale_item_id, ri.product_id,
         p.name  AS product_name,
         ri.quantity, ri.refund_amount, ri.reason,
         u.name  AS returned_by_name,
         ri.returned_at
       FROM return_items ri
       LEFT JOIN products p ON ri.product_id = p.id
       LEFT JOIN users    u ON ri.returned_by = u.id
       WHERE ri.sale_id = ?
       ORDER BY ri.returned_at ASC`,
      [id]
    );

    const [delivery] = await pool.execute<any[]>(
      'SELECT * FROM deliveries WHERE sale_id = ? LIMIT 1',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນການຂາຍສຳເລັດ',
      data: {
        ...(saleRows as any[])[0],
        items,
        return_history: returnHistory,
        delivery: (delivery as any[])[0] || null,
      },
    });
  } catch (error) {
    console.error('getSaleById error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/sales  — POS Checkout (transaction)
// ─────────────────────────────────────────────────────────────
export async function createSale(req: Request, res: Response): Promise<void> {
  const { customer_id, payment_method, items, delivery } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, message: 'ກະລຸນາເລືອກສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ' });
    return;
  }
  for (const item of items) {
    if (!item.product_id || !item.quantity || Number(item.quantity) <= 0) {
      res.status(400).json({ success: false, message: 'ຂໍ້ມູນສິນຄ້າບໍ່ຖືກຕ້ອງ' });
      return;
    }
  }
  if (!payment_method) {
    res.status(400).json({ success: false, message: 'ກະລຸນາເລືອກວິທີຊຳລະ' });
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let subtotal = 0;
    const resolvedItems: Array<{
      product_id: number;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      const [productRows] = await conn.execute<any[]>(
        'SELECT id, name, price, stock FROM products WHERE id = ? AND is_active = 1 LIMIT 1',
        [Number(item.product_id)]
      );
      const product = (productRows as any[])[0];
      if (!product) {
        await conn.rollback();
        res.status(404).json({ success: false, message: `ບໍ່ພົບສິນຄ້າ ID ${item.product_id}` });
        return;
      }
      if (product.stock < Number(item.quantity)) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: `ສິນຄ້າ "${product.name}" ໃນສາງບໍ່ພຽງພໍ (ມີ ${product.stock}, ຕ້ອງການ ${item.quantity})`,
        });
        return;
      }
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * Number(item.quantity);
      subtotal += lineTotal;
      resolvedItems.push({
        product_id: Number(item.product_id),
        quantity:   Number(item.quantity),
        unit_price: unitPrice,
        subtotal:   lineTotal,
      });
    }

    const total      = subtotal;
    const payMethod  = normalizePaymentMethod(payment_method);
    const invoiceNum = generateInvoiceNumber();
    const userId     = req.user!.id;
    const custId     = customer_id ? Number(customer_id) : null;

    const [saleResult] = await conn.execute(
      `INSERT INTO sales
         (invoice_number, customer_id, user_id, subtotal, discount, tax, total, payment_method, payment_status)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?, 'paid')`,
      [invoiceNum, custId, userId, subtotal, total, payMethod]
    ) as any;
    const saleId = saleResult.insertId as number;

    for (const ri of resolvedItems) {
      await conn.execute(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, ri.product_id, ri.quantity, ri.unit_price, ri.subtotal]
      );
      await conn.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [ri.quantity, ri.product_id]
      );
    }

    if (delivery && delivery.address) {
      await conn.execute(
        `INSERT INTO deliveries (sale_id, address, driver_name, delivery_date, status)
         VALUES (?, ?, ?, ?, 'Pending')`,
        [saleId, delivery.address, delivery.driver_name || null, delivery.delivery_date || null]
      );
    }

    await conn.execute(
      `INSERT INTO income_expenses (type, amount, description, transaction_date, source)
       VALUES ('Income', ?, ?, CURDATE(), 'sale')`,
      [total, `ການຂາຍ #${invoiceNum}`]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'ການຂາຍສຳເລັດ',
      data: {
        id: saleId, invoice_number: invoiceNum,
        total, subtotal,
        payment_method: payMethod, payment_status: 'paid',
        has_delivery: !!(delivery && delivery.address),
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error('createSale error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດ ການຂາຍຖືກຍົກເລີກ' });
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/sales/:id/return  (Admin only)
// Body: { type: 'full' }
//    OR { type: 'partial', items: [{ sale_item_id, product_id, quantity, reason? }] }
// ─────────────────────────────────────────────────────────────
export async function returnSale(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ບໍ່ຖືກຕ້ອງ' });
    return;
  }

  const type  = String(req.body.type ?? 'full');
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  if (!['full', 'partial'].includes(type)) {
    res.status(400).json({ success: false, message: 'type ຕ້ອງເປັນ full ຫຼື partial' });
    return;
  }
  if (type === 'partial' && items.length === 0) {
    res.status(400).json({ success: false, message: 'ກະລຸນາເລືອກສິນຄ້າທີ່ຕ້ອງການຄືນ' });
    return;
  }

  const conn = await pool.getConnection();
  try {
    // ── Read sale (before transaction, optimistic check) ──────
    const [saleRows] = await conn.execute<any[]>(
      'SELECT id, invoice_number, total, payment_status, refund_status FROM sales WHERE id = ? LIMIT 1',
      [id]
    );
    const sale = (saleRows as any[])[0];
    if (!sale) {
      conn.release();
      res.status(404).json({ success: false, message: 'ບໍ່ພົບການຂາຍນີ້' });
      return;
    }
    if (sale.refund_status === 'full') {
      conn.release();
      res.status(400).json({ success: false, message: 'ບິນນີ້ຄືນສິນຄ້າຄົບແລ້ວ' });
      return;
    }

    // ── Read all sale items ───────────────────────────────────
    const [saleItemRows] = await conn.execute<any[]>(
      'SELECT id, product_id, quantity, unit_price FROM sale_items WHERE sale_id = ?',
      [id]
    );
    const saleItemsList = saleItemRows as any[];

    // ── Read already-returned quantities per sale_item ────────
    const [retRows] = await conn.execute<any[]>(
      'SELECT sale_item_id, SUM(quantity) AS ret_qty FROM return_items WHERE sale_id = ? GROUP BY sale_item_id',
      [id]
    );
    const retMap = new Map<number, number>();
    for (const r of retRows as any[]) retMap.set(Number(r.sale_item_id), Number(r.ret_qty));

    // ── Validate partial items before opening transaction ─────
    if (type === 'partial') {
      for (const item of items) {
        const siId = parsePositiveInt(item.sale_item_id) ?? 0;
        const si   = saleItemsList.find((s: any) => s.id === siId);
        if (!si) {
          conn.release();
          res.status(400).json({ success: false, message: `ບໍ່ພົບລາຍການ sale_item_id ${siId}` });
          return;
        }
        if (Number(si.product_id) !== (parsePositiveInt(item.product_id) ?? -1)) {
          conn.release();
          res.status(400).json({ success: false, message: 'product_id ບໍ່ຕົງກັນ' });
          return;
        }
        const alreadyRet = retMap.get(siId) ?? 0;
        const maxReturn  = Number(si.quantity) - alreadyRet;
        const qty        = parsePositiveInt(item.quantity) ?? 0;
        if (qty <= 0 || qty > maxReturn) {
          conn.release();
          res.status(400).json({ success: false, message: 'ຈຳນວນຄືນເກີນຈຳນວນທີ່ຊື້' });
          return;
        }
      }
    }

    await conn.beginTransaction();

    let totalRefund = 0;
    const userId    = req.user!.id;
    let   finalFullReturn = false;

    if (type === 'full') {
      // Return every remaining item
      for (const si of saleItemsList) {
        const alreadyRet = retMap.get(si.id) ?? 0;
        const remaining  = Number(si.quantity) - alreadyRet;
        if (remaining <= 0) continue;
        const refundAmt = remaining * Number(si.unit_price);
        totalRefund += refundAmt;
        await conn.execute(
          `INSERT INTO return_items
             (sale_id, sale_item_id, product_id, quantity, refund_amount, reason, returned_by)
           VALUES (?, ?, ?, ?, ?, NULL, ?)`,
          [id, si.id, si.product_id, remaining, refundAmt, userId]
        );
        await conn.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [remaining, si.product_id]);
      }
      await conn.execute(
        "UPDATE sales SET payment_status = 'refunded', refund_status = 'full' WHERE id = ?",
        [id]
      );
      finalFullReturn = true;

    } else {
      // Partial — process each submitted item
      for (const item of items) {
        const siId      = Number(item.sale_item_id);
        const si        = saleItemsList.find((s: any) => s.id === siId);
        const qty       = Number(item.quantity);
        const refundAmt = qty * Number(si.unit_price);
        totalRefund += refundAmt;

        await conn.execute(
          `INSERT INTO return_items
             (sale_id, sale_item_id, product_id, quantity, refund_amount, reason, returned_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, siId, Number(si.product_id), qty, refundAmt, item.reason ?? null, userId]
        );
        await conn.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [qty, si.product_id]);
        retMap.set(siId, (retMap.get(siId) ?? 0) + qty);
      }

      // Determine if all items are now fully returned
      finalFullReturn = saleItemsList.every(
        (si: any) => (retMap.get(si.id) ?? 0) >= Number(si.quantity)
      );

      if (finalFullReturn) {
        await conn.execute(
          "UPDATE sales SET payment_status = 'refunded', refund_status = 'full' WHERE id = ?",
          [id]
        );
      } else {
        await conn.execute("UPDATE sales SET refund_status = 'partial' WHERE id = ?", [id]);
      }
    }

    // Record Expense in income_expenses
    const suffix = finalFullReturn ? '(ທັງໝົດ)' : '(ບາງສ່ວນ)';
    await conn.execute(
      `INSERT INTO income_expenses (type, amount, description, transaction_date, source)
       VALUES ('Expense', ?, ?, CURDATE(), 'return')`,
      [totalRefund, `ຄືນສິນຄ້າຈາກບິນ #${sale.invoice_number} ${suffix}`]
    );

    await conn.commit();

    res.status(200).json({
      success: true,
      message: finalFullReturn ? 'ຄືນສິນຄ້າສຳເລັດ' : 'ຄືນສິນຄ້າບາງສ່ວນສຳເລັດ',
      data: {
        id,
        total_refund:  totalRefund,
        refund_status: finalFullReturn ? 'full' : 'partial',
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error('returnSale error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/sales/:id/returns  — return history for a sale
// ─────────────────────────────────────────────────────────────
export async function getReturnHistory(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [saleRows] = await pool.execute<any[]>(
      'SELECT id, invoice_number, total, refund_status FROM sales WHERE id = ? LIMIT 1',
      [id]
    );
    const sale = (saleRows as any[])[0];
    if (!sale) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບການຂາຍນີ້' });
      return;
    }

    const [retItems] = await pool.execute<any[]>(
      `SELECT
         ri.id, ri.sale_item_id, ri.product_id,
         p.name  AS product_name,
         ri.quantity, ri.refund_amount, ri.reason,
         u.name  AS returned_by_name,
         ri.returned_at
       FROM return_items ri
       LEFT JOIN products p ON ri.product_id = p.id
       LEFT JOIN users    u ON ri.returned_by = u.id
       WHERE ri.sale_id = ?
       ORDER BY ri.returned_at ASC`,
      [id]
    );

    const refundedTotal = (retItems as any[]).reduce(
      (s, r) => s + Number(r.refund_amount), 0
    );

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນການຄືນສຳເລັດ',
      data: {
        sale_id:         id,
        original_total:  Number(sale.total),
        refunded_total:  refundedTotal,
        remaining_total: Number(sale.total) - refundedTotal,
        refund_status:   sale.refund_status,
        returned_items:  retItems,
      },
    });
  } catch (error) {
    console.error('getReturnHistory error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}
