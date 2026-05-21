const { matchProfile, CARD_PROFILES, PROFILES_LAST_UPDATED } = require('./cardProfiles');

// Cards with an active balance being paid down get penalized.
// A card is "under attack" if it has a balance and is in the user's payoff plan.
// We reduce its effective rate by this factor so it ranks lower but isn't hidden.
const DEBT_PENALTY_FACTOR = 0.5;

// effectiveRate: cents earned per $1 spent, expressed as a percentage
function effectiveRate(profile, category) {
  const mult = profile.multipliers[category] ?? profile.multipliers.other ?? 1;
  return mult * profile.centsPerPoint; // e.g. 3x * 2.0¢ = 6%
}

// Build ranked recommendations for a given category + user's account list.
// accounts: rows from the DB (must have name, balance_current, apr).
// category: one of CATEGORIES.
// amount: optional purchase amount in dollars (for dollar-value display).
function recommend(accounts, category, amount = null) {
  const results = [];

  for (const account of accounts) {
    const profile = matchProfile(account.name);
    if (!profile) continue;

    const hasDebt = (account.balance_current || 0) > 0;
    const base    = effectiveRate(profile, category);
    const rate    = hasDebt ? base * DEBT_PENALTY_FACTOR : base;

    const earnedDollars = amount ? (amount * rate / 100) : null;

    results.push({
      accountId:    account.id,
      accountName:  account.name,
      profileId:    profile.id,
      category,
      rewardType:   profile.rewardType,
      programName:  profile.programName,
      multiplier:   profile.multipliers[category] ?? profile.multipliers.other ?? 1,
      centsPerPoint: profile.centsPerPoint,
      effectiveRate: Math.round(base * 10) / 10,        // unpenalized, for display
      adjustedRate:  Math.round(rate * 10) / 10,        // what drives ranking
      earnedDollars: earnedDollars ? Math.round(earnedDollars * 100) / 100 : null,
      hasDebt,
      penalized: hasDebt,
      notes:    profile.notes,
    });
  }

  // Sort by adjustedRate desc; break ties by effectiveRate
  results.sort((a, b) => b.adjustedRate - a.adjustedRate || b.effectiveRate - a.effectiveRate);

  // Tag rank
  results.forEach((r, i) => { r.rank = i + 1; });

  return {
    category,
    amount,
    recommendations: results,
    profilesLastUpdated: PROFILES_LAST_UPDATED,
    unmatchedAccounts: accounts
      .filter(a => !matchProfile(a.name))
      .map(a => a.name),
  };
}

// Return all available category options with display labels and icons
function getCategoryMeta() {
  return [
    { id: 'dining',    label: 'Dining',     icon: '🍽️' },
    { id: 'groceries', label: 'Groceries',  icon: '🛒' },
    { id: 'travel',    label: 'Travel',     icon: '✈️' },
    { id: 'gas',       label: 'Gas',        icon: '⛽' },
    { id: 'streaming', label: 'Streaming',  icon: '📺' },
    { id: 'drugstore', label: 'Drugstore',  icon: '💊' },
    { id: 'shopping',  label: 'Shopping',   icon: '🛍️' },
    { id: 'other',     label: 'Other',      icon: '📦' },
  ];
}

module.exports = { recommend, getCategoryMeta, DEBT_PENALTY_FACTOR };
