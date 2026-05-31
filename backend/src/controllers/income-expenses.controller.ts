/**
 * Income & Expenses Controller
 * ຈັດການລາຍຮັບ-ລາຍຈ່າຍ (manual entries + read system entries)
 *
 * source='manual'  → Admin ເພີ່ມເອງ (ແກ້ໄຂ/ລົບໄດ້)
 * source='sale'    → ສ້າງອັດຕະໂນມັດຈາກການຂາຍ (ແກ້ໄຂ/ລົບບໍ່ໄດ້)
 * source='return'  → ສ້າງອັດຕະໂນມັດຈາກການຄືນສິນຄ້າ (ແກ້ໄຂ/ລົບບໍ່ໄດ້)
 */

import { Request, Response } from 'express';
import pool from '../config/db';
import { parsePositiveInt, checkRequired } from '../utils/validation';

type Source = 'manual' | 'sale' | 'return';
type TxType = 'Income' | 'Expense';

const VALID_TYPES:   TxType[]  = ['Income', 'Expense'];
const VALID_SOURCES: Source[]  = ['manual', 'sale', 'return'];

// ── GET /api/income-expenses ──────────────────────────────────────
// Query: type, source, start_date, end_date, page, limit
export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const page   = Math.max(1, parsePositiveInt(req.query.page)  ?? 1);
    const limit  = Math.min(100, Math.max(1, parsePositiveInt(req.query.limit) ?? 20));
    const offset = (page - 1) * limit;

    const typeFilter   = req.query.type   ? String(req.query.type)   : null;
    const sourceFilter = req.query.source ? String(req.query.source) : null;
    const startDate    = req.query.start_date ? String(req.query.start_date) : null;
    const endDate      = req.query.end_date   ? String(req.query.end_date)   : null;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (typeFilter && VALID_TYPES.includes(typeFilter as TxType)) {
      conditions.push('type = ?');
      params.push(typeFilter);
    }
    if (sourceFilter && VALID_SOURCES.includes(sourceFilter as Source)) {
      conditions.push('source = ?');
      params.push(sourceFilter);
    }
    if (startDate && endDate) {
      conditions.push('DATE(transaction_date) BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute<any[]>(
      `SELECT id, transaction_date, type, amount, description, source, created_at
       FROM income_expenses ${where}
       ORDER BY transaction_date DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [countRow] = await pool.execute<any[]>(
      `SELECT COUNT(*) AS total FROM income_expenses ${where}`,
      params
    );

    const total = Number((countRow as any[])[0].total);

    res.status(200).json({
      success: true,
      message: 'ດຶງຂໍ້ມູນລາຍຮັບ-ລາຍຈ່າຍສຳເລັດ',
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getAll income-expenses error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ── GET /api/income-expenses/summary ─────────────────────────────
// Query: start_date, end_date
export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const startDate = req.query.start_date ? String(req.query.start_date) : null;
    const endDate   = req.query.end_date   ? String(req.query.end_date)   : null;

    const dateCondition = startDate && endDate ? 'AND DATE(transaction_date) BETWEEN ? AND ?' : '';
    const params        = startDate && endDate ? [startDate, endDate] : [];

    const [rows] = await pool.execute<any[]>(
      `SELECT type, source, SUM(amount) AS total, COUNT(*) AS cnt
       FROM income_expenses
       WHERE 1=1 ${dateCondition}
       GROUP BY type, source`,
      params
    );

    let totalIncome  = 0;
    let totalExpense = 0;
    let incomeCount  = 0;
    let expenseCount = 0;

    for (const r of rows as any[]) {
      if (r.type === 'Income')  { totalIncome  += Number(r.total); incomeCount  += Number(r.cnt); }
      if (r.type === 'Expense') { totalExpense += Number(r.total); expenseCount += Number(r.cnt); }
    }

    res.status(200).json({
      success: true,
      message: 'ສະຫຼຸບລາຍຮັບ-ລາຍຈ່າຍສຳເລັດ',
      data: {
        total_income:  totalIncome,
        total_expense: totalExpense,
        balance:       totalIncome - totalExpense,
        income_count:  incomeCount,
        expense_count: expenseCount,
        period: { start: startDate, end: endDate },
      },
    });
  } catch (error) {
    console.error('getSummary error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ── GET /api/income-expenses/:id ─────────────────────────────────
export async function getById(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ບໍ່ຖືກຕ້ອງ' });
    return;
  }
  try {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM income_expenses WHERE id = ? LIMIT 1',
      [id]
    );
    const row = (rows as any[])[0];
    if (!row) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບລາຍການນີ້' });
      return;
    }
    res.status(200).json({ success: true, message: 'ດຶງຂໍ້ມູນສຳເລັດ', data: row });
  } catch (error) {
    console.error('getById error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ── POST /api/income-expenses (Admin only) ────────────────────────
// Body: { type, amount, description, transaction_date? }
export async function create(req: Request, res: Response): Promise<void> {
  const missing = checkRequired(req.body, ['type', 'amount', 'description']);
  if (missing) {
    res.status(400).json({ success: false, message: `ກະລຸນາໃສ່ ${missing}` });
    return;
  }

  const { type, amount, description, transaction_date } = req.body;

  if (!VALID_TYPES.includes(type as TxType)) {
    res.status(400).json({ success: false, message: 'ປະເພດຕ້ອງເປັນ Income ຫຼື Expense' });
    return;
  }
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) {
    res.status(400).json({ success: false, message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກທີ່ຫຼາຍກວ່າ 0' });
    return;
  }

  try {
    const txDate = transaction_date
      ? String(transaction_date)
      : new Date().toISOString().slice(0, 10);

    const [result] = await pool.execute(
      `INSERT INTO income_expenses (type, amount, description, transaction_date, source)
       VALUES (?, ?, ?, ?, 'manual')`,
      [type, amt, String(description).trim(), txDate]
    ) as any;

    res.status(201).json({
      success: true,
      message: 'ເພີ່ມລາຍການສຳເລັດ',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('create income-expense error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ── PUT /api/income-expenses/:id (Admin only) ─────────────────────
export async function update(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [rows] = await pool.execute<any[]>(
      'SELECT id, source, transaction_date FROM income_expenses WHERE id = ? LIMIT 1',
      [id]
    );
    const existing = (rows as any[])[0];
    if (!existing) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບລາຍການນີ້' });
      return;
    }
    if (existing.source !== 'manual') {
      res.status(403).json({ success: false, message: 'ບໍ່ສາມາດແກ້ໄຂລາຍການທີ່ສ້າງໂດຍລະບົບ' });
      return;
    }

    const missing = checkRequired(req.body, ['type', 'amount', 'description']);
    if (missing) {
      res.status(400).json({ success: false, message: `ກະລຸນາໃສ່ ${missing}` });
      return;
    }

    const { type, amount, description, transaction_date } = req.body;

    if (!VALID_TYPES.includes(type as TxType)) {
      res.status(400).json({ success: false, message: 'ປະເພດຕ້ອງເປັນ Income ຫຼື Expense' });
      return;
    }
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      res.status(400).json({ success: false, message: 'ຈຳນວນເງິນຕ້ອງເປັນຕົວເລກທີ່ຫຼາຍກວ່າ 0' });
      return;
    }

    const txDate = transaction_date
      ? String(transaction_date)
      : existing.transaction_date;

    await pool.execute(
      `UPDATE income_expenses SET type=?, amount=?, description=?, transaction_date=? WHERE id=?`,
      [type, amt, String(description).trim(), txDate, id]
    );

    res.status(200).json({ success: true, message: 'ແກ້ໄຂລາຍການສຳເລັດ' });
  } catch (error) {
    console.error('update income-expense error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}

// ── DELETE /api/income-expenses/:id (Admin only) ──────────────────
export async function remove(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: 'ID ບໍ່ຖືກຕ້ອງ' });
    return;
  }

  try {
    const [rows] = await pool.execute<any[]>(
      'SELECT id, source FROM income_expenses WHERE id = ? LIMIT 1',
      [id]
    );
    const existing = (rows as any[])[0];
    if (!existing) {
      res.status(404).json({ success: false, message: 'ບໍ່ພົບລາຍການນີ້' });
      return;
    }
    if (existing.source !== 'manual') {
      res.status(403).json({ success: false, message: 'ບໍ່ສາມາດລົບລາຍການທີ່ສ້າງໂດຍລະບົບ' });
      return;
    }

    await pool.execute('DELETE FROM income_expenses WHERE id = ?', [id]);

    res.status(200).json({ success: true, message: 'ລົບລາຍການສຳເລັດ' });
  } catch (error) {
    console.error('remove income-expense error:', error);
    res.status(500).json({ success: false, message: 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' });
  }
}
