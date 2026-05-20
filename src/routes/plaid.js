const express = require('express');
const router = express.Router();
const plaidService = require('../services/plaidService');
const { getDb, upsertAccount } = require('../db/database');

// Hardcoded until auth is added
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

    const db = getDb();

    // Upsert plaid_item (re-linking the same institution updates the token)
    const existing = db.prepare('SELECT id FROM plaid_items WHERE item_id = ?').get(itemId);
    let plaidItemId;
    if (existing) {
      db.prepare('UPDATE plaid_items SET access_token = ? WHERE id = ?').run(accessToken, existing.id);
      plaidItemId = existing.id;
    } else {
      const result = db.prepare(`
        INSERT INTO plaid_items (user_id, access_token, item_id, institution_name, institution_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(USER_ID, accessToken, itemId, institution_name || null, institution_id || null);
      plaidItemId = result.lastInsertRowid;
    }

    const accounts = await plaidService.getAccounts(accessToken);
    for (const acct of accounts) {
      upsertAccount({ ...acct, plaid_item_id: plaidItemId });
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

router.get('/accounts', (req, res) => {
  try {
    const accounts = getDb().prepare(`
      SELECT a.*, cd.apr, cd.is_promotional_apr, cd.promo_apr_expiry_date,
             cd.minimum_payment, cd.payment_due_date, pi.institution_name
      FROM accounts a
      LEFT JOIN credit_details cd ON cd.account_id = a.id
      LEFT JOIN plaid_items pi ON pi.id = a.plaid_item_id
      ORDER BY a.type, a.name
    `).all();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/accounts/:id/credit-details', (req, res) => {
  try {
    const db = getDb();
    const account = db.prepare('SELECT id, type FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.type !== 'credit') return res.status(400).json({ error: 'Only credit accounts have credit details' });

    const { apr, minimum_payment, payment_due_date, is_promotional_apr, promo_apr_expiry_date } = req.body;
    if (apr !== undefined && (isNaN(parseFloat(apr)) || parseFloat(apr) < 0)) {
      return res.status(400).json({ error: 'APR must be a non-negative number' });
    }

    db.prepare(`
      INSERT INTO credit_details (account_id, apr, is_promotional_apr, promo_apr_expiry_date, minimum_payment, payment_due_date)
      VALUES (@account_id, @apr, @is_promotional_apr, @promo_apr_expiry_date, @minimum_payment, @payment_due_date)
      ON CONFLICT(account_id) DO UPDATE SET
        apr                   = COALESCE(@apr, apr),
        is_promotional_apr    = COALESCE(@is_promotional_apr, is_promotional_apr),
        promo_apr_expiry_date = COALESCE(@promo_apr_expiry_date, promo_apr_expiry_date),
        minimum_payment       = COALESCE(@minimum_payment, minimum_payment),
        payment_due_date      = COALESCE(@payment_due_date, payment_due_date),
        updated_at            = CURRENT_TIMESTAMP
    `).run({
      account_id:           parseInt(req.params.id),
      apr:                  apr !== undefined ? parseFloat(apr) : null,
      is_promotional_apr:   is_promotional_apr !== undefined ? (is_promotional_apr ? 1 : 0) : null,
      promo_apr_expiry_date: promo_apr_expiry_date || null,
      minimum_payment:      minimum_payment !== undefined ? parseFloat(minimum_payment) : null,
      payment_due_date:     payment_due_date || null,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', (req, res) => {
  try {
    const db = getDb();
    const account = db.prepare('SELECT plaid_item_id FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const siblings = db.prepare(
      'SELECT COUNT(*) as count FROM accounts WHERE plaid_item_id = ? AND id != ?'
    ).get(account.plaid_item_id, req.params.id);

    db.transaction(() => {
      db.prepare('DELETE FROM credit_details WHERE account_id = ?').run(req.params.id);
      db.prepare('DELETE FROM transactions WHERE account_id = ?').run(req.params.id);
      db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
      if (siblings.count === 0) {
        db.prepare('DELETE FROM plaid_items WHERE id = ?').run(account.plaid_item_id);
      }
    })();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
