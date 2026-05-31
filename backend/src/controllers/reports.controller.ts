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

    // Fetch all 4 sources in parallel
    const [[saleIncomeRows], [refundRows], [manualIncomeRows], [manualExpenseRows]] =
      await Promise.all([
        // Income from paid sales
        pool.execute<any[]>(
          `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
           FROM sales
           WHERE payment_status = 'paid'
             AND DATE(created_at) BETWEEN ? AND ?`,
          [startDate, endDate]
        ),
        // Expense from refunded sales
        pool.execute<any[]>(
          `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
           FROM sales
           WHERE payment_status = 'refunded'
             AND DATE(created_at) BETWEEN ? AND ?`,
          [startDate, endDate]
        ),
        // Income from manual income_expenses entries
        pool.execute<any[]>(
          `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
           FROM income_expenses
           WHERE type = 'Income'
             AND DATE(transaction_date) BETWEEN ? AND ?`,
          [startDate, endDate]
        ),
        // Expense from manual income_expenses entries
        pool.execute<any[]>(
          `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
           FROM income_expenses
           WHERE type = 'Expense'
             AND DATE(transaction_date) BETWEEN ? AND ?`,
          [startDate, endDate]
        ),
      ]);

    const incomeTotal  = Number((saleIncomeRows  as any[])[0]?.total || 0)
                       + Number((manualIncomeRows as any[])[0]?.total || 0);
    const expenseTotal = Number((refundRows       as any[])[0]?.total || 0)
                       + Number((manualExpenseRows as any[])[0]?.total || 0);

    const incomeCount  = Number((saleIncomeRows  as any[])[0]?.count || 0)
                       + Number((manualIncomeRows as any[])[0]?.count || 0);
    const expenseCount = Number((refundRows       as any[])[0]?.count || 0)
                       + Number((manualExpenseRows as any[])[0]?.count || 0);

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
