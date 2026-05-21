// Card reward profiles — curated manually, updated quarterly.
// To update: edit multipliers/centsPerPoint and bump PROFILES_LAST_UPDATED.
// TPG valuations: thepointsguy.com/guide/monthly-valuations/
// Multipliers are per $1 spent. centsPerPoint converts points → cash equivalent.
// For flat cash-back cards: rewardType='cashback', centsPerPoint=1, multiplier = % rate.

const PROFILES_LAST_UPDATED = '2026-05-20';

// Categories used throughout the app
const CATEGORIES = ['dining', 'groceries', 'travel', 'gas', 'streaming', 'drugstore', 'shopping', 'other'];

const CARD_PROFILES = [
  // ── Seeded dev cards ─────────────────────────────────────────────────────
  {
    id: 'chase_sapphire_preferred',
    name: 'Chase Sapphire Preferred',
    nameKeywords: ['sapphire preferred'],
    issuer: 'Chase',
    rewardType: 'points',
    programName: 'Ultimate Rewards',
    centsPerPoint: 2.0,  // TPG May 2026
    multipliers: { dining: 3, groceries: 3, travel: 2, gas: 1, streaming: 1, drugstore: 1, shopping: 1, other: 1 },
    notes: '3x dining & online groceries; points transfer to 14 airline/hotel partners',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'chase_southwest_rapid_rewards',
    name: 'Chase Southwest Rapid Rewards',
    nameKeywords: ['southwest', 'rapid rewards'],
    issuer: 'Chase',
    rewardType: 'points',
    programName: 'Southwest Rapid Rewards',
    centsPerPoint: 1.5,  // TPG May 2026
    multipliers: { dining: 2, groceries: 1, travel: 3, gas: 1, streaming: 1, drugstore: 1, shopping: 1, other: 1 },
    notes: '3x Southwest purchases, 2x hotels/rideshare/car rentals',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'bilt',
    name: 'Bilt Palladium',
    nameKeywords: ['bilt'],
    issuer: 'Wells Fargo',
    rewardType: 'points',
    programName: 'Bilt Rewards',
    centsPerPoint: 1.7,  // TPG May 2026
    multipliers: { dining: 3, groceries: 1, travel: 2, gas: 1, streaming: 1, drugstore: 1, shopping: 1, other: 1 },
    notes: '3x dining, 2x travel, 1x rent (no transaction fee)',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'citi_double_cash',
    name: 'Citi Double Cash',
    nameKeywords: ['double cash', 'citi double'],
    issuer: 'Citi',
    rewardType: 'cashback',
    programName: 'Cash Back',
    centsPerPoint: 1,
    multipliers: { dining: 2, groceries: 2, travel: 2, gas: 2, streaming: 2, drugstore: 2, shopping: 2, other: 2 },
    notes: '2% on everything (1% on purchase + 1% on payment)',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'bofa_visa_signature',
    name: 'BofA Visa Signature',
    nameKeywords: ['bofa', 'bank of america', 'boa visa', 'visa signature'],
    issuer: 'Bank of America',
    rewardType: 'cashback',
    programName: 'Cash Rewards',
    centsPerPoint: 1,
    multipliers: { dining: 1, groceries: 2, travel: 1, gas: 3, streaming: 1, drugstore: 1, shopping: 1, other: 1 },
    notes: '3% on chosen category (default: gas), 2% groceries/wholesale, 1% other',
    lastUpdated: '2026-05-20',
  },

  // ── Popular cards (not seeded, available for future user cards) ──────────
  {
    id: 'amex_gold',
    name: 'American Express Gold',
    nameKeywords: ['amex gold', 'american express gold'],
    issuer: 'American Express',
    rewardType: 'points',
    programName: 'Membership Rewards',
    centsPerPoint: 2.0,  // TPG May 2026
    multipliers: { dining: 4, groceries: 4, travel: 3, gas: 1, streaming: 1, drugstore: 1, shopping: 1, other: 1 },
    notes: '4x dining & US groceries (up to $25k/yr), 3x flights; best dining card in the market',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'amex_platinum',
    name: 'American Express Platinum',
    nameKeywords: ['amex platinum', 'american express platinum'],
    issuer: 'American Express',
    rewardType: 'points',
    programName: 'Membership Rewards',
    centsPerPoint: 2.0,
    multipliers: { dining: 1, groceries: 1, travel: 5, gas: 1, streaming: 1, drugstore: 1, shopping: 1, other: 1 },
    notes: '5x flights booked direct/Amex Travel, 5x prepaid hotels via Amex Travel',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'chase_freedom_unlimited',
    name: 'Chase Freedom Unlimited',
    nameKeywords: ['freedom unlimited'],
    issuer: 'Chase',
    rewardType: 'points',
    programName: 'Ultimate Rewards',
    centsPerPoint: 2.0,
    multipliers: { dining: 3, groceries: 1, travel: 1, gas: 1, streaming: 1, drugstore: 3, shopping: 1.5, other: 1.5 },
    notes: '3x dining/drugstore, 1.5x everything else; pairs with Sapphire for full 2¢ value',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'capital_one_venture',
    name: 'Capital One Venture',
    nameKeywords: ['venture', 'capital one venture'],
    issuer: 'Capital One',
    rewardType: 'miles',
    programName: 'Capital One Miles',
    centsPerPoint: 1.85,  // TPG May 2026
    multipliers: { dining: 2, groceries: 2, travel: 5, gas: 2, streaming: 2, drugstore: 2, shopping: 2, other: 2 },
    notes: '5x on hotels/rental cars via Capital One Travel, 2x everything else',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'discover_it',
    name: 'Discover it Cash Back',
    nameKeywords: ['discover it', 'discover cash'],
    issuer: 'Discover',
    rewardType: 'cashback',
    programName: 'Cash Back',
    centsPerPoint: 1,
    multipliers: { dining: 1, groceries: 1, travel: 1, gas: 5, streaming: 1, drugstore: 1, shopping: 5, other: 1 },
    notes: '5% rotating quarterly categories (gas/Amazon/restaurants etc.), 1% other',
    lastUpdated: '2026-05-20',
  },
];

// Match a card name from the DB to a profile
function matchProfile(accountName) {
  if (!accountName) return null;
  const lower = accountName.toLowerCase();
  for (const profile of CARD_PROFILES) {
    if (profile.nameKeywords.some(kw => lower.includes(kw))) return profile;
  }
  return null;
}

module.exports = { CARD_PROFILES, CATEGORIES, PROFILES_LAST_UPDATED, matchProfile };
