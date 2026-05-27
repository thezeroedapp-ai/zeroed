'use strict';

const express          = require('express');
const router           = express.Router();
const valuationService = require('../services/valuationService');

// GET /api/valuations/real-estate?address=<full address>
router.get('/real-estate', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address query param required' });
    const result = await valuationService.fetchRealEstateAVM(address);
    res.json(result);
  } catch (err) {
    console.error('[valuations/real-estate]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// POST /api/valuations/vehicle
// Body: { vin? } OR { make, model, year, mileage?, trim? }
router.post('/vehicle', async (req, res) => {
  try {
    const specs = req.body;
    if (!specs.vin && (!specs.make || !specs.model || !specs.year)) {
      return res.status(400).json({ error: 'vin OR make + model + year required' });
    }
    const result = await valuationService.fetchVehicleValue(specs);
    res.json(result);
  } catch (err) {
    console.error('[valuations/vehicle]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/valuations/address-autocomplete?q=<partial address>
// Proxies to Nominatim (OpenStreetMap) — no API key required.
router.get('/address-autocomplete', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 3) return res.json({ suggestions: [] });

  try {
    const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
      q,
      format:         'json',
      addressdetails: '1',
      limit:          '6',
      countrycodes:   'us',
    });
    const r    = await fetch(url, { headers: { 'User-Agent': 'Zeroed/1.0 (fintech-app)' } });
    const data = await r.json();

    const suggestions = data
      .map(item => {
        const a = item.address ?? {};
        const street = [a.house_number, a.road].filter(Boolean).join(' ');
        const city   = a.city || a.town || a.village || a.county || '';
        const state  = a.state  || '';
        const zip    = a.postcode || '';
        return [street, city, state, zip].filter(Boolean).join(', ');
      })
      .filter(s => s.length > 0);

    res.json({ suggestions });
  } catch (err) {
    console.error('[valuations/address-autocomplete]', err.message);
    res.json({ suggestions: [] }); // degrade silently — user can type manually
  }
});

module.exports = router;
