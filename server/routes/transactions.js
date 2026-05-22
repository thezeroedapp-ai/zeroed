const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const { account_id, limit = 50, offset = 0 } = req.query;
    const transactions = await db.getTransactionsByUser(req.user.uid, { accountId: account_id, limit, offset });
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/summary
router.get('/summary', async (req, res) => {
  try {
    const summary = await db.getTransactionSummary(req.user.uid);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
