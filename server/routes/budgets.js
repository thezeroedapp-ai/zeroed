const express = require('express');
const db      = require('../db/database');

const router = express.Router();

// GET /api/budgets — with current month spending enrichment
router.get('/', async (req, res) => {
  try {
    const uid = req.user.uid;
    const [budgets, transactions] = await Promise.all([
      db.getBudgets(uid),
      db.getTransactionsByUser(uid, { limit: 500 }),
    ]);

    const now       = new Date();
    const cutoff    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const spent = {};
    transactions
      .filter(t => t.date >= cutoff && t.amount > 0)
      .forEach(t => {
        const cat    = t.category || 'Other';
        spent[cat]   = (spent[cat] || 0) + t.amount;
      });

    const enriched = budgets.map(b => ({
      ...b,
      spent:     Math.round((spent[b.category] || 0) * 100) / 100,
      remaining: Math.round(Math.max(0, b.monthly_limit - (spent[b.category] || 0)) * 100) / 100,
      pct:       Math.min(100, Math.round(((spent[b.category] || 0) / b.monthly_limit) * 100)),
    }));

    res.json({ budgets: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets — create
router.post('/', async (req, res) => {
  try {
    const { category, monthly_limit } = req.body;
    if (!category || monthly_limit == null) {
      return res.status(400).json({ error: 'category and monthly_limit required' });
    }
    const budget = await db.upsertBudget(req.user.uid, null, {
      category,
      monthly_limit: parseFloat(monthly_limit),
    });
    res.json({ budget });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.deleteBudget(req.user.uid, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
