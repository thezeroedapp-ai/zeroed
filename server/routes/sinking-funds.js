const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

const CATEGORIES = ['car', 'home', 'medical', 'travel', 'education', 'holiday', 'tax', 'other'];

// GET /api/sinking-funds/income
router.get('/income', async (req, res) => {
  try {
    res.json({ monthly_income: req.user.monthly_income || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sinking-funds/income
router.put('/income', async (req, res) => {
  try {
    const { monthly_income } = req.body;
    await db.upsertUser(req.user.uid, { monthly_income: parseFloat(monthly_income) || null });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sinking-funds
router.get('/', async (req, res) => {
  try {
    const funds = await db.getSinkingFunds(req.user.uid);
    const monthly_total = Math.round(funds.reduce((s, f) => s + (f.monthly_amount || 0), 0) * 100) / 100;
    res.json({ funds, monthly_total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sinking-funds
router.post('/', async (req, res) => {
  try {
    const { category, monthly_amount, label } = req.body;
    const amt = parseFloat(monthly_amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
    const cat  = CATEGORIES.includes(category) ? category : 'other';
    const fund = await db.addSinkingFund(req.user.uid, {
      label:          label || cat,
      monthly_amount: Math.round(amt * 100) / 100,
      category:       cat,
    });
    res.status(201).json(fund);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sinking-funds/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.deleteSinkingFund(req.user.uid, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Sinking fund not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
