const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

const CATEGORIES = ['car', 'home', 'medical', 'travel', 'education', 'holiday', 'tax', 'other'];

// GET /api/expenses/income — returns user's monthly income
router.get('/income', async (req, res) => {
  try {
    res.json({ monthlyIncome: req.user.monthly_income || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/income — updates user's monthly income
router.put('/income', async (req, res) => {
  try {
    const { monthly_income } = req.body;
    await db.upsertUser(req.user.uid, { monthly_income: parseFloat(monthly_income) || null });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/sinking-funds — returns sinking funds in Settings format
router.get('/sinking-funds', async (req, res) => {
  try {
    const expenses = await db.getExpenses(req.user.uid);
    const funds = expenses.map(e => ({
      id:             e.id,
      category:       e.category,
      monthly_amount: e.amount,
      label:          e.name,
    }));
    res.json({ funds, monthlyTotal: Math.round(funds.reduce((s, f) => s + f.monthly_amount, 0) * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses/sinking-funds
router.post('/sinking-funds', async (req, res) => {
  try {
    const { category, monthly_amount, label } = req.body;
    const amt = parseFloat(monthly_amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
    const cat     = CATEGORIES.includes(category) ? category : 'other';
    const expense = await db.addExpense(req.user.uid, {
      name:     label || cat,
      amount:   Math.round(amt * 100) / 100,
      category: cat,
    });
    res.status(201).json({ id: expense.id, category: expense.category, monthly_amount: expense.amount, label: expense.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/sinking-funds/:id
router.delete('/sinking-funds/:id', async (req, res) => {
  try {
    const result = await db.deleteExpense(req.user.uid, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Expense not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses — raw list (used internally by plan/insights)
router.get('/', async (req, res) => {
  try {
    const expenses     = await db.getExpenses(req.user.uid);
    const monthlyTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    res.json({ expenses, monthlyTotal: Math.round(monthlyTotal * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    const { name, amount, category } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
    const cat     = CATEGORIES.includes(category) ? category : 'other';
    const expense = await db.addExpense(req.user.uid, { name: name.trim(), amount: Math.round(amt * 100) / 100, category: cat });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.deleteExpense(req.user.uid, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Expense not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
