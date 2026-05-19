const express = require('express');
const router  = express.Router();
const { getExpenses, addExpense, deleteExpense } = require('../db/database');

const CATEGORIES = ['car', 'home', 'medical', 'travel', 'education', 'holiday', 'tax', 'other'];

// GET /api/expenses
router.get('/', (req, res) => {
  try {
    const expenses = getExpenses(1);
    const monthlyTotal = expenses.reduce((s, e) => s + e.amount, 0);
    res.json({ expenses, monthlyTotal: Math.round(monthlyTotal * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses
router.post('/', (req, res) => {
  try {
    const { name, amount, category } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
    const cat = CATEGORIES.includes(category) ? category : 'other';
    const expense = addExpense({ user_id: 1, name: name.trim(), amount: Math.round(amt * 100) / 100, category: cat });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  try {
    const result = deleteExpense(parseInt(req.params.id), 1);
    if (!result.changes) return res.status(404).json({ error: 'Expense not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
