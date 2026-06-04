/**
 * Reports Controller
 * ລາຍງານປະຈຳວັນ, ເດືອນ, ສິນຄ້າໃກ້ໝົດ, ສະຫຼຸບລາຍຮັບ
 */

import { Request, Response } from 'express';
import pool from '../config/db';
import { parsePositiveInt } from '../utils/validation';

// GET /api/reports/daily
// Query: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD  OR  ?days=14 (fallback)
export async function getDailyReport(req: Request, res: Response): Promise<void> {
  try {
    const startDate = req.query.start_date ? String(req.query.start_date) : null;
    const endDate   = req.query.end_date   ? String(req.query.end_date)   : null;

    let query: string;
    let params: (string | number)[];

    if (startDate && endDate) {
      query = `SELECT
         DATE(created_at)        AS date,
         COUNT(*)                AS total_sales,
         SUM(total)              AS total_revenue,
         AVG(total)              AS avg_order,
         SUM(CASE WHEN payment_status = 'refunded' THEN 1 ELSE 0 END) AS refunds
       FROM sales
       WHERE payment_status != 'pending'
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY date ASC`;
      params = [startDate, endDate];
    } else {
      const days = Math.min(90, Math.max(1, parsePositiveInt(req.query.days) ?? 14));
      query = `SELECT
         DATE(created_at)        AS date,
         COUNT(*)                AS total_sales,
         SUM(total)              AS total_revenue,
         AVG(total)              AS avg_order,
         SUM(CASE WHEN payment_status = 'refunded' THEN 1 ELSE 0 END) AS refunds
       FROM sales
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND payment_status != 'pending'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`;
      params = [days];
    }

    const [rows] = await pool.execute<any[]>(query, params);

    res.status(200).json({
      success: true,
      message: 'ລາຍງານປະຈຳວັນສຳເລັດ',
      data: rows,
    });
  } catch (error) {
    console.error('getDailyReport error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// GET /api/reports/monthly
// Query: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD  OR  ?months=6 (fallback)
export async function getMonthlyReport(req: Request, res: Response): Promise<void> {
  try {
    const startDate = req.query.start_date ? String(req.query.start_date) : null;
    const endDate   = req.query.end_date   ? String(req.query.end_date)   : null;

    let query: string;
    let params: (string | number)[];

    if (startDate && endDate) {
      query = `SELECT
         DATE_FORMAT(created_at, '%Y-%m') AS month,
         COUNT(*)                          AS total_sales,
         SUM(total)                        AS total_revenue,
         AVG(total)                        AS avg_order
       FROM sales
       WHERE payment_status != 'pending'
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC`;
      params = [startDate, endDate];
    } else {
      const months = Math.min(24, Math.max(1, parsePositiveInt(req.query.months) ?? 6));
      query = `SELECT
         DATE_FORMAT(created_at, '%Y-%m') AS month,
         COUNT(*)                          AS total_sales,
         SUM(total)                        AS total_revenue,
         AVG(total)                        AS avg_order
       FROM sales
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
         AND payment_status != 'pending'
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC`;
      params = [months];
    }

    const [rows] = await pool.execute<any[]>(query, params);

    res.status(200).json({
      success: true,
      message: 'ລາຍງານປະຈຳເດືອນສຳເລັດ',
      data: rows,
    });
  } catch (error) {
    console.error('getMonthlyReport error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// GET /api/reports/low-stock
export async function getLowStockReport(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT
         p.id, p.sku, p.name, p.stock, p.min_stock,
         c.name AS category_name,
         (p.min_stock - p.stock) AS shortage
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1 AND p.stock < p.min_stock
       ORDER BY shortage DESC`
    );

    res.status(200).json({
      success: true,
      message: 'ລາຍງານສິນຄ້າໃກ້ໝົດສຳເລັດ',
      data: rows,
      count: (rows as any[]).length,
    });
  } catch (error) {
    console.error('getLowStockReport error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// GET /api/reports/top-products
// Query: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&limit=10
export async function getTopProducts(req: Request, res: Response): Promise<void> {
  try {
    const startDate = req.query.start_date ? String(req.query.start_date) : null;
    const endDate   = req.query.end_date   ? String(req.query.end_date)   : null;
    const limit     = Math.min(20, Math.max(1, parsePositiveInt(req.query.limit) ?? 10));

    let dateCondition: string;
    const params: string[] = [];

    if (startDate && endDate) {
      dateCondition = 'AND DATE(s.created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else {
      dateCondition = 'AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    // Note: LIMIT must be interpolated (mysql2 does not support ? for LIMIT)
    const [rows] = await pool.execute<any[]>(
      `SELECT
         p.id,
         p.name,
         p.sku,
         c.name                     AS category_name,
         SUM(si.quantity)           AS total_quantity,
         SUM(si.subtotal)           AS total_revenue,
         COUNT(DISTINCT si.sale_id) AS sale_count
       FROM sale_items si
       JOIN products p   ON si.product_id = p.id
       JOIN sales    s   ON si.sale_id    = s.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE s.payment_status = 'paid'
         ${dateCondition}
       GROUP BY p.id, p.name, p.sku, c.name
       ORDER BY total_quantity DESC
       LIMIT ${limit}`,
      params
    );

    res.status(200).json({
      success: true,
      message: 'ລາຍງານສິນຄ້າຂາຍດີສຳເລັດ',
      data: rows,
    });
  } catch (error) {
    console.error('getTopProducts error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// GET /api/reports/income-expenses
// Query: ?start_date=YYYY-MM-DD &end_date=YYYY-MM-DD
export async function getIncomeExpenses(req: Request, res: Response): Promise<void> {
  try {
    const startDate = req.query.start_date
      ? String(req.query.start_date)
      : new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10); // YTD default

    const endDate = req.query.end_date
      ? String(req.query.end_date)
      : new Date().toISOString().slice(0, 10);

    // Single query to get both Income and Expense from income_expenses table
    // This table is the central ledger (records source='sale', source='return', source='manual')
    const [rows] = await pool.execute<any[]>(
      `SELECT 
         type, 
         COALESCE(SUM(amount), 0) AS total, 
         COUNT(*) AS count
       FROM income_expenses
       WHERE DATE(transaction_date) BETWEEN ? AND ?
       GROUP BY type`,
      [startDate, endDate]
    );

    let incomeTotal  = 0;
    let expenseTotal = 0;
    let incomeCount  = 0;
    let expenseCount = 0;

    for (const r of rows as any[]) {
      if (r.type === 'Income') {
        incomeTotal = Number(r.total);
        incomeCount = Number(r.count);
      } else if (r.type === 'Expense') {
        expenseTotal = Number(r.total);
        expenseCount = Number(r.count);
      }
    }

    res.status(200).json({
      success: true,
      message: 'ລາຍງານລາຍຮັບ-ລາຍຈ່າຍສຳເລັດ',
      data: [
        { type: 'Income',  total: incomeTotal,  count: incomeCount  },
        { type: 'Expense', total: expenseTotal, count: expenseCount },
      ],
      summary: {
        total_income:  incomeTotal,
        total_expense: expenseTotal,
        net_profit:    incomeTotal - expenseTotal,
        period:        { start: startDate, end: endDate },
      },
    });
  } catch (error) {
    console.error('getIncomeExpenses error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}
