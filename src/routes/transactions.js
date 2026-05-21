const express = require('express');
const router  = express.Router();
const { query } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { account_id, limit = 50, offset = 0 } = req.query;
    const base = `SELECT t.*, a.name as account_name FROM transactions t JOIN accounts a ON a.id = t.account_id`;
    let rows;
    if (account_id) {
      rows = await query(`${base} WHERE t.account_id = $1 ORDER BY t.date DESC LIMIT $2 OFFSET $3`, [account_id, limit, offset]);
    } else {
      rows = await query(`${base} ORDER BY t.date DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const rows = await query(`
      SELECT category, COUNT(*) as count, ROUND(SUM(amount)::numeric, 2) as total
      FROM transactions
      GROUP BY category
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
