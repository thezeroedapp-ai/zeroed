const express  = require('express');
const { getDb } = require('../db/database');
const { recommend, getCategoryMeta } = require('../services/recommendationEngine');
const { CATEGORIES, PROFILES_LAST_UPDATED } = require('../services/cardProfiles');

const router = express.Router();

const ACCOUNTS_QUERY = `
  SELECT a.id, a.name, a.balance_current, cd.apr
  FROM accounts a
  LEFT JOIN credit_details cd ON cd.account_id = a.id
  WHERE a.type = 'credit'
  ORDER BY a.balance_current DESC
`;

// GET /api/recommendations/categories
router.get('/categories', (req, res) => {
  res.json({ categories: getCategoryMeta(), profilesLastUpdated: PROFILES_LAST_UPDATED });
});

// GET /api/recommendations?category=dining&amount=50
router.get('/', (req, res) => {
  try {
    const { category, amount } = req.query;

    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `category required. Valid values: ${CATEGORIES.join(', ')}`,
      });
    }

    const parsedAmount = amount ? parseFloat(amount) : null;
    if (parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const accounts = getDb().prepare(ACCOUNTS_QUERY).all();
    const result   = recommend(accounts, category, parsedAmount);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
