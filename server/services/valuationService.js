'use strict';

// Zero hardcoding — all keys and base URLs come from process.env.
const RENTCAST_API_KEY    = () => process.env.RENTCAST_API_KEY;
const RENTCAST_BASE       = 'https://api.rentcast.io/v1';

const MARKETCHECK_API_KEY = () => process.env.MARKETCHECK_API_KEY;
const MARKETCHECK_BASE    = 'https://mc-api.marketcheck.com/v2';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function guardedFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Accept: 'application/json', ...options.headers } });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

// ─── RentCast — Real Estate AVM ───────────────────────────────────────────────

/**
 * Fetch an Automated Valuation Model for a residential property.
 * @param {string} address  Full street address including city, state, zip.
 * @returns {Promise<{
 *   address: string; estimatedValue: number;
 *   priceRangeLow: number; priceRangeHigh: number;
 *   confidenceScore: number; valuationDate: string; source: 'rentcast';
 * }>}
 */
async function fetchRealEstateAVM(address) {
  const key = RENTCAST_API_KEY();
  if (!key) throw new Error('RENTCAST_API_KEY is not set in environment');

  const data = await guardedFetch(
    `${RENTCAST_BASE}/avm/value?address=${encodeURIComponent(address)}`,
    { headers: { 'X-Api-Key': key } },
  );

  // Normalise across RentCast response field variations
  const estimatedValue  = data.price    ?? data.value    ?? 0;
  const priceRangeLow   = data.priceLow ?? data.valueLow ?? Math.round(estimatedValue * 0.9);
  const priceRangeHigh  = data.priceHigh ?? data.valueHigh ?? Math.round(estimatedValue * 1.1);
  const rangeWidth      = priceRangeHigh - priceRangeLow;
  const confidenceScore = estimatedValue > 0
    ? Math.max(0, Math.min(1, 1 - (rangeWidth / (2 * estimatedValue))))
    : 0;

  return {
    address:         data.addressLine1 || data.formattedAddress || address,
    estimatedValue,
    priceRangeLow,
    priceRangeHigh,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    valuationDate:   new Date().toISOString().slice(0, 10),
    source:          'rentcast',
  };
}

// ─── MarketCheck — Vehicle Valuation ─────────────────────────────────────────

/**
 * Fetch a vehicle market value estimate using VIN or make/model/year.
 * @param {{ vin?: string; make?: string; model?: string; year?: number; mileage?: number; trim?: string }} specs
 * @returns {Promise<{
 *   vin?: string; make: string; model: string; year: number; mileage?: number;
 *   estimatedValue: number; tradeInValue: number; retailValue: number;
 *   valuationDate: string; source: 'marketcheck';
 * }>}
 */
async function fetchVehicleValue(specs) {
  const key = MARKETCHECK_API_KEY();
  if (!key) throw new Error('MARKETCHECK_API_KEY is not set in environment');

  if (!specs.vin && (!specs.make || !specs.model || !specs.year)) {
    throw new Error('fetchVehicleValue requires vin OR make + model + year');
  }

  const params = new URLSearchParams({ api_key: key });
  if (specs.vin)     params.set('vin',   specs.vin);
  if (specs.make)    params.set('make',  specs.make);
  if (specs.model)   params.set('model', specs.model);
  if (specs.year)    params.set('year',  String(specs.year));
  if (specs.trim)    params.set('trim',  specs.trim);
  if (specs.mileage) params.set('miles', String(specs.mileage));

  const data = await guardedFetch(
    `${MARKETCHECK_BASE}/predict/car/us/price?${params.toString()}`,
  );

  const estimatedValue = data.price ?? data.mean ?? 0;

  return {
    vin:            specs.vin,
    make:           data.make  ?? specs.make  ?? '',
    model:          data.model ?? specs.model ?? '',
    year:           data.year  ?? specs.year  ?? 0,
    mileage:        specs.mileage,
    estimatedValue,
    tradeInValue:   data.trade_in ?? data.tradeIn ?? Math.round(estimatedValue * 0.85),
    retailValue:    data.retail               ?? Math.round(estimatedValue * 1.08),
    valuationDate:  new Date().toISOString().slice(0, 10),
    source:         'marketcheck',
  };
}

module.exports = { fetchRealEstateAVM, fetchVehicleValue };
