const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const assets = await db.getManualAssets(req.user.uid);
    res.json({ assets });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, asset_type, asset_subtype, current_value, linked_loan_id, address } = req.body;
    if (!name || !asset_type || typeof current_value !== 'number' || current_value < 0) {
      return res.status(400).json({ error: 'name, asset_type, and current_value (≥0) are required' });
    }
    const data = {
      name,
      asset_type,
      asset_subtype:  asset_subtype  || null,
      current_value:  Math.round(current_value * 100) / 100,
      linked_loan_id: linked_loan_id || null,
    };
    if (asset_type === 'real_estate' && address && typeof address === 'string') {
      data.address = address.trim();
    }
    const id = await db.addManualAsset(req.user.uid, data);
    res.json({ id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, asset_type, asset_subtype, current_value, linked_loan_id, address } = req.body;
    if (!name || !asset_type || typeof current_value !== 'number' || current_value < 0) {
      return res.status(400).json({ error: 'name, asset_type, and current_value (≥0) are required' });
    }
    const data = {
      name,
      asset_type,
      asset_subtype:  asset_subtype  || null,
      current_value:  Math.round(current_value * 100) / 100,
      linked_loan_id: linked_loan_id || null,
      address:        asset_type === 'real_estate' && address && typeof address === 'string'
                        ? address.trim()
                        : null,
    };
    await db.updateManualAsset(req.user.uid, req.params.id, data);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.deleteManualAsset(req.user.uid, req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
