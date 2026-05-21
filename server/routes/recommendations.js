const express  = require('express');
const { query } = require('../db/database');
const { recommend, getCategoryMeta } = require('../services/recommendationEngine');
const { CATEGORIES, PROFILES_LAST_UPDATED } = require('../services/cardProfiles');

const router = express.Router();

// GET /api/recommendations/categories
router.get('/categories', (req, res) => {
  res.json({ categories: getCategoryMeta(), profilesLastUpdated: PROFILES_LAST_UPDATED });
});

// GET /api/recommendations?category=dining&amount=50
router.get('/', async (req, res) => {
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

    const accounts = await query(`
      SELECT a.id, a.name, a.balance_current, cd.apr
      FROM accounts a
      LEFT JOIN credit_details cd ON cd.account_id = a.id
      LEFT JOIN plaid_items pi ON pi.id = a.plaid_item_id
      WHERE a.type = 'credit' AND pi.user_id = $1
      ORDER BY a.balance_current DESC
    `, [req.user.id]);

    const result = recommend(accounts, category, parsedAmount);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
