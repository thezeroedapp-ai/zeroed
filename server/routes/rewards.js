const express  = require('express');
const { recommend, getCategoryMeta } = require('../services/recommendationEngine');
const { CATEGORIES, PROFILES_LAST_UPDATED } = require('../services/cardProfiles');
const db = require('../db/database');

const router = express.Router();

// GET /api/rewards/categories
router.get('/categories', (req, res) => {
  res.json({ categories: getCategoryMeta(), profilesLastUpdated: PROFILES_LAST_UPDATED });
});

// GET /api/rewards?category=dining&amount=50
router.get('/', async (req, res) => {
  try {
    const { category, amount } = req.query;

    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category required. Valid values: ${CATEGORIES.join(', ')}` });
    }

    const parsedAmount = amount ? parseFloat(amount) : null;
    if (parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const allAccounts = await db.getAccountsByUser(req.user.uid);
    const accounts    = allAccounts
      .filter(a => a.type === 'credit')
      .sort((a, b) => (b.balance_current || 0) - (a.balance_current || 0));

    const result = recommend(accounts, category, parsedAmount);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
