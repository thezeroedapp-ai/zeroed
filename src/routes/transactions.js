const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { account_id, limit = 50, offset = 0 } = req.query;
    const base = `SELECT t.*, a.name as account_name FROM transactions t JOIN accounts a ON a.id = t.account_id`;
    const query = account_id
      ? `${base} WHERE t.account_id = ? ORDER BY t.date DESC LIMIT ? OFFSET ?`
      : `${base} ORDER BY t.date DESC LIMIT ? OFFSET ?`;
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
      GROUP BY category
      ORDER BY total DESC
    `).all();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
