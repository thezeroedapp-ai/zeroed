const express      = require('express');
const router       = express.Router();
const plaidService = require('../services/plaidService');
const db           = require('../db/database');

router.post('/create-link-token', async (req, res) => {
  try {
    const linkToken = await plaidService.createLinkToken(req.user.uid);
    res.json({ link_token: linkToken });
  } catch (err) {
    console.error('create-link-token:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/create-link-token/update', async (req, res) => {
  try {
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ error: 'item_id required' });
    const uid   = req.user.uid;
    const items = await db.getPlaidItems(uid);
    const item  = items.find(i => i.id === item_id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const linkToken = await plaidService.createUpdateLinkToken(uid, item.access_token);
    res.json({ link_token: linkToken });
  } catch (err) {
    console.error('create-link-token/update:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/exchange-token', async (req, res) => {
  try {
    const { public_token, institution_name } = req.body;
    const { accessToken, itemId } = await plaidService.exchangePublicToken(public_token);
    const uid = req.user.uid;

    await db.upsertPlaidItem(uid, itemId, {
      access_token:     accessToken,
      item_id:          itemId,
      institution_name: institution_name || null,
    });

    const accounts = await plaidService.getAccounts(accessToken);
    for (const acct of accounts) {
      const { credit_details, ...rest } = acct;
      await db.upsertAccount(uid, {
        ...rest,
        ...(credit_details || {}),
        institution_name: institution_name || null,
        plaid_item_id:    itemId,
      });
    }

    res.json({ success: true, item_id: itemId, account_count: accounts.length });
  } catch (err) {
    console.error('exchange-token:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const results = await plaidService.syncAllAccounts(req.user.uid);
    res.json({ success: true, ...results });
  } catch (err) {
    console.error('sync:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounts', async (req, res) => {
  try {
    const accounts = await db.getAccountsByUser(req.user.uid);
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/items', async (req, res) => {
  try {
    const items = await db.getPlaidItems(req.user.uid);
    res.json({
      items: items.map(i => ({
        item_id:          i.id,
        institution_name: i.institution_name || 'Unknown Bank',
        last_synced:      i.updated_at || null,
        error_status:     i.error_status || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:itemId', async (req, res) => {
  try {
    const uid    = req.user.uid;
    const itemId = req.params.itemId;
    const items  = await db.getPlaidItems(uid);
    const item   = items.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (item.access_token) {
      try { await plaidService.removeItem(item.access_token); } catch { /* already removed */ }
    }

    const accounts = await db.getAccountsByUser(uid);
    for (const account of accounts.filter(a => a.plaid_item_id === itemId)) {
      await db.userRef(uid).collection('accounts').doc(account.id).delete();
      const txSnap = await db.userRef(uid).collection('transactions')
        .where('account_id', '==', account.id).get();
      if (txSnap.docs.length) {
        const batch = db.firestore.batch();
        txSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    await db.userRef(uid).collection('plaid_items').doc(itemId).delete();
    res.json({ success: true });
  } catch (err) {
    console.error('delete-item:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/accounts/:id/credit-details', async (req, res) => {
  try {
    const uid       = req.user.uid;
    const accountId = req.params.id; // plaid_account_id
    const accounts  = await db.getAccountsByUser(uid);
    const account   = accounts.find(a => a.id === accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    if (account.type !== 'credit') return res.status(400).json({ error: 'Only credit accounts have credit details' });

    const { apr, minimum_payment, payment_due_date, is_promotional_apr, promo_apr_expiry_date } = req.body;
    if (apr !== undefined && (isNaN(parseFloat(apr)) || parseFloat(apr) < 0)) {
      return res.status(400).json({ error: 'APR must be a non-negative number' });
    }

    const updates = {};
    if (apr               !== undefined) updates.apr                   = parseFloat(apr);
    if (minimum_payment   !== undefined) updates.minimum_payment       = parseFloat(minimum_payment);
    if (payment_due_date  !== undefined) updates.payment_due_date      = payment_due_date;
    if (is_promotional_apr !== undefined) updates.is_promotional_apr   = !!is_promotional_apr;
    if (promo_apr_expiry_date !== undefined) updates.promo_apr_expiry_date = promo_apr_expiry_date;

    await db.userRef(uid).collection('accounts').doc(accountId).update(updates);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const uid       = req.user.uid;
    const accountId = req.params.id;
    const accounts  = await db.getAccountsByUser(uid);
    const account   = accounts.find(a => a.id === accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    await db.userRef(uid).collection('accounts').doc(accountId).delete();

    // Delete related transactions
    const txSnap = await db.userRef(uid).collection('transactions')
      .where('account_id', '==', accountId).get();
    if (txSnap.docs.length) {
      const batch = db.firestore.batch();
      txSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // Remove plaid item if this was its only account
    const remaining = accounts.filter(a => a.plaid_item_id === account.plaid_item_id && a.id !== accountId);
    if (!remaining.length && account.plaid_item_id) {
      const items = await db.getPlaidItems(uid);
      const item  = items.find(i => i.id === account.plaid_item_id);
      if (item?.access_token) {
        try { await plaidService.removeItem(item.access_token); } catch { /* already removed */ }
      }
      await db.userRef(uid).collection('plaid_items').doc(account.plaid_item_id).delete();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
