const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { account_id, limit = 50, offset = 0 } = req.query;
    const query = account_id
      ? 'SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM transactions ORDER BY date DESC LIMIT ? OFFSET ?';
    const params = account_id ? [account_id, limit, offset] : [limit, offset];
    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', (req, res) => {
  try {
    const db = getDb();
    const summary = db.prepare(`
      SELECT
        category,
        COUNT(*) as count,
        ROUND(SUM(amount), 2) as total
      FROM transactions
      WHERE pending = 0
      GROUP BY category
      ORDER BY total DESC
    `).all();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
