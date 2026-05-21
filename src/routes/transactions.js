const express = require('express');
const router  = express.Router();
const { query } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { account_id, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;
    const base = `
      SELECT t.*, a.name as account_name
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      JOIN plaid_items pi ON pi.id = a.plaid_item_id
      WHERE pi.user_id = $1
    `;
    let rows;
    if (account_id) {
      rows = await query(`${base} AND t.account_id = $2 ORDER BY t.date DESC LIMIT $3 OFFSET $4`, [userId, account_id, limit, offset]);
    } else {
      rows = await query(`${base} ORDER BY t.date DESC LIMIT $2 OFFSET $3`, [userId, limit, offset]);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const rows = await query(`
      SELECT t.category, COUNT(*) as count, ROUND(SUM(t.amount)::numeric, 2) as total
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      JOIN plaid_items pi ON pi.id = a.plaid_item_id
      WHERE pi.user_id = $1
      GROUP BY t.category
      ORDER BY total DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
