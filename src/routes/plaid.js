const express = require('express');
const router  = express.Router();
const plaidService = require('../services/plaidService');
const { pool, query, queryOne, withTransaction, upsertAccount } = require('../db/database');

const USER_ID = 1;

router.post('/create-link-token', async (req, res) => {
  try {
    const linkToken = await plaidService.createLinkToken(USER_ID);
    res.json({ link_token: linkToken });
  } catch (err) {
    console.error('create-link-token:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/exchange-token', async (req, res) => {
  try {
    const { public_token, institution_name, institution_id } = req.body;
    const { accessToken, itemId } = await plaidService.exchangePublicToken(public_token);

    const existing = await queryOne('SELECT id FROM plaid_items WHERE item_id = $1', [itemId]);
    let plaidItemId;
    if (existing) {
      await pool.query('UPDATE plaid_items SET access_token = $1 WHERE id = $2', [accessToken, existing.id]);
      plaidItemId = existing.id;
    } else {
      const inserted = await queryOne(`
        INSERT INTO plaid_items (user_id, access_token, item_id, institution_name, institution_id)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [USER_ID, accessToken, itemId, institution_name || null, institution_id || null]);
      plaidItemId = inserted.id;
    }

    const accounts = await plaidService.getAccounts(accessToken);
    for (const acct of accounts) {
      await upsertAccount({ ...acct, plaid_item_id: plaidItemId });
    }

    res.json({ success: true, item_id: itemId, account_count: accounts.length });
  } catch (err) {
    console.error('exchange-token:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const results = await plaidService.syncAllAccounts(USER_ID);
    res.json({ success: true, ...results });
  } catch (err) {
    console.error('sync:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounts', async (req, res) => {
  try {
    const accounts = await query(`
      SELECT a.*, cd.apr, cd.is_promotional_apr, cd.promo_apr_expiry_date,
             cd.minimum_payment, cd.payment_due_date, pi.institution_name
      FROM accounts a
      LEFT JOIN credit_details cd ON cd.account_id = a.id
      LEFT JOIN plaid_items pi ON pi.id = a.plaid_item_id
      ORDER BY a.type, a.name
    `);
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/accounts/:id/credit-details', async (req, res) => {
  try {
    const account = await queryOne('SELECT id, type FROM accounts WHERE id = $1', [req.params.id]);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.type !== 'credit') return res.status(400).json({ error: 'Only credit accounts have credit details' });

    const { apr, minimum_payment, payment_due_date, is_promotional_apr, promo_apr_expiry_date } = req.body;
    if (apr !== undefined && (isNaN(parseFloat(apr)) || parseFloat(apr) < 0)) {
      return res.status(400).json({ error: 'APR must be a non-negative number' });
    }

    await pool.query(`
      INSERT INTO credit_details
        (account_id, apr, is_promotional_apr, promo_apr_expiry_date, minimum_payment, payment_due_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(account_id) DO UPDATE SET
        apr                   = COALESCE($2, credit_details.apr),
        is_promotional_apr    = COALESCE($3, credit_details.is_promotional_apr),
        promo_apr_expiry_date = COALESCE($4, credit_details.promo_apr_expiry_date),
        minimum_payment       = COALESCE($5, credit_details.minimum_payment),
        payment_due_date      = COALESCE($6, credit_details.payment_due_date),
        updated_at            = NOW()
    `, [
      parseInt(req.params.id),
      apr              !== undefined ? parseFloat(apr)              : null,
      is_promotional_apr !== undefined ? (is_promotional_apr ? 1 : 0) : null,
      promo_apr_expiry_date || null,
      minimum_payment  !== undefined ? parseFloat(minimum_payment)  : null,
      payment_due_date || null,
    ]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const account = await queryOne('SELECT plaid_item_id FROM accounts WHERE id = $1', [req.params.id]);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const { rows: [{ count }] } = await pool.query(
      'SELECT COUNT(*) as count FROM accounts WHERE plaid_item_id = $1 AND id != $2',
      [account.plaid_item_id, req.params.id]
    );

    await withTransaction(async (client) => {
      await client.query('DELETE FROM credit_details WHERE account_id = $1', [req.params.id]);
      await client.query('DELETE FROM transactions WHERE account_id = $1', [req.params.id]);
      await client.query('DELETE FROM accounts WHERE id = $1', [req.params.id]);
      if (parseInt(count) === 0) {
        await client.query('DELETE FROM plaid_items WHERE id = $1', [account.plaid_item_id]);
      }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
