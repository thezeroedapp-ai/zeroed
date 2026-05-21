/**
 * All debt math runs locally — no API calls.
 * debts shape: { name, balance, apr, minimumPayment }
 */

// --- getAttackOrder ---
// Strategies:
//   avalanche          — highest APR first (minimizes total interest)
//   snowball           — lowest balance first (fastest psychological wins)
//   hybrid             — 60% APR weight + 40% balance weight (balances math & motivation)
//   highestPaymentRatio— highest (minimumPayment/balance) first (frees cash flow fastest)

function getAttackOrder(debts, strategy) {
  const active = debts.filter(d => d.balance > 0);
  let sorted;

  if (strategy === 'snowball') {
    sorted = [...active].sort((a, b) => a.balance - b.balance);

  } else if (strategy === 'hybrid') {
    // Rank each debt by APR (higher = better) and by balance (lower = better), then blend
    const byApr = [...active].sort((a, b) => b.apr - a.apr);
    const byBal = [...active].sort((a, b) => a.balance - b.balance);
    const aprRank = Object.fromEntries(byApr.map((d, i) => [d.name, i]));
    const balRank = Object.fromEntries(byBal.map((d, i) => [d.name, i]));
    sorted = [...active].sort((a, b) =>
      (0.6 * aprRank[a.name] + 0.4 * balRank[a.name]) -
      (0.6 * aprRank[b.name] + 0.4 * balRank[b.name])
    );

  } else if (strategy === 'highestPaymentRatio') {
    // Highest (minimum / balance) first — frees up cash flow fastest
    sorted = [...active].sort((a, b) => {
      const ratioA = a.minimumPayment / (a.balance || 1);
      const ratioB = b.minimumPayment / (b.balance || 1);
      return ratioB - ratioA;
    });

  } else {
    // avalanche (default)
    sorted = [...active].sort((a, b) => (b.apr - a.apr) || (a.balance - b.balance));
  }

  return sorted.map((d, i) => ({ ...d, priority: i + 1 }));
}

// --- checkAlerts ---

function checkAlerts(accounts) {
  const alerts = [];
  const now = new Date();

  for (const acct of accounts) {
    if (acct.type !== 'credit') continue;

    if (acct.is_promotional_apr && acct.promo_apr_expiry_date) {
      const expiry = new Date(acct.promo_apr_expiry_date + 'T12:00');
      const daysUntil = Math.ceil((expiry - now) / 86400000);
      const isLowPromo = (acct.apr || 0) <= 3;

      if (daysUntil <= 180) {
        alerts.push({
          type: isLowPromo ? 'balance_transfer_expiring' : 'promo_apr_expiring',
          title: `${acct.name} — ${isLowPromo ? '0% Promo' : 'Intro APR'} Expiring`,
          description: `${acct.apr}% intro rate expires ${expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${daysUntil > 0 ? daysUntil + ' days left' : 'expired'}`,
          severity: daysUntil <= 60 ? 'danger' : 'warning',
          daysUntil: Math.max(0, daysUntil),
          accountId: acct.id,
          accountName: acct.name,
        });
      }
    }

    const bal = acct.balance_current || 0;
    const lim = acct.credit_limit || 0;
    if (lim > 0 && bal / lim >= 0.9) {
      const pct = Math.round(bal / lim * 100);
      alerts.push({
        type: 'high_utilization',
        title: `${acct.name} — High Utilization`,
        description: `${pct}% of credit limit used ($${Math.round(bal).toLocaleString()} of $${Math.round(lim).toLocaleString()}). This impacts your credit score.`,
        severity: bal / lim >= 0.95 ? 'danger' : 'warning',
        daysUntil: null,
        accountId: acct.id,
        accountName: acct.name,
      });
    }
  }

  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'danger' ? -1 : 1;
    if (a.daysUntil !== null && b.daysUntil !== null) return a.daysUntil - b.daysUntil;
    return a.daysUntil !== null ? -1 : 1;
  });
}

// --- calculateMonthlyInterest ---

function calculateMonthlyInterest(debts) {
  return debts.reduce((sum, d) => {
    if (d.balance <= 0) return sum;
    return sum + d.balance * (d.apr / 100 / 12);
  }, 0);
}

// --- simulatePayoff ---
// extraBudget = money available above and beyond all minimums

function simulatePayoff(debts, extraBudget, strategy) {
  const active = debts.filter(d => d.balance > 0);
  if (active.length === 0) return { months: 0, totalInterest: 0, cardPayoffMonths: {} };

  const working = getAttackOrder(active, strategy).map(d => ({
    ...d,
    remainingBalance: d.balance,
    paid: false,
  }));

  let months = 0;
  let totalInterest = 0;
  const cardPayoffMonths = {};
  let freedBudget = 0;
  const safeExtra = Math.max(0, extraBudget);

  while (working.some(d => !d.paid) && months < 600) {
    months++;

    // 1. Accrue monthly interest
    for (const debt of working) {
      if (debt.paid) continue;
      const interest = debt.remainingBalance * (debt.apr / 100 / 12);
      debt.remainingBalance += interest;
      totalInterest += interest;
    }

    // 2. Pay minimums; freed minimums roll into attack fund immediately
    for (const debt of working) {
      if (debt.paid) continue;
      const payment = Math.min(debt.minimumPayment, debt.remainingBalance);
      debt.remainingBalance -= payment;
      if (debt.remainingBalance < 0.01) {
        debt.remainingBalance = 0;
        debt.paid = true;
        cardPayoffMonths[debt.name] = months;
        freedBudget += debt.minimumPayment;
      }
    }

    // 3. Attack phase: cascade surplus + freed minimums down priority order
    let attackRemaining = safeExtra + freedBudget;
    for (const debt of working) {
      if (debt.paid || attackRemaining <= 0.005) continue;
      const extra = Math.min(attackRemaining, debt.remainingBalance);
      debt.remainingBalance -= extra;
      attackRemaining -= extra;
      if (debt.remainingBalance < 0.01) {
        debt.remainingBalance = 0;
        debt.paid = true;
        cardPayoffMonths[debt.name] = months;
        freedBudget += debt.minimumPayment;
      }
    }
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    cardPayoffMonths,
  };
}

// --- simulateLumpSum ---
// Apply a one-time lump-sum payment to a specific account (by id or name), then simulate.
// Returns a comparison: { withLump, without, monthsSaved, interestSaved }

function simulateLumpSum(debts, lumpAmount, accountId, extraBudget, strategy) {
  const lump = Math.max(0, lumpAmount || 0);
  const modified = debts.map(d => {
    const isTarget = accountId
      ? (d.id === accountId || d.id === parseInt(accountId))
      : false; // if no accountId, apply to first priority card below
    if (isTarget) return { ...d, balance: Math.max(0, d.balance - lump) };
    return d;
  });

  // If no specific account matched, apply to highest-priority card
  const noneMatched = accountId && !debts.some(d => d.id === accountId || d.id === parseInt(accountId));
  let applied = modified;
  if (!accountId || noneMatched) {
    const order = getAttackOrder(debts.filter(d => d.balance > 0), strategy);
    if (order.length) {
      const target = order[0];
      applied = debts.map(d =>
        d.name === target.name ? { ...d, balance: Math.max(0, d.balance - lump) } : d
      );
    }
  }

  const withLump = simulatePayoff(applied.filter(d => d.balance > 0), extraBudget, strategy);
  const without  = simulatePayoff(debts.filter(d => d.balance > 0), extraBudget, strategy);

  return {
    withLump,
    without,
    monthsSaved:    without.months - withLump.months,
    interestSaved:  Math.round((without.totalInterest - withLump.totalInterest) * 100) / 100,
  };
}

// --- calculateRequiredPayment ---
// Binary search: find the minimum extra monthly payment to pay off in ≤ targetMonths.
// Returns { requiredExtra, achievable, currentMonths }

function calculateRequiredPayment(debts, targetMonths, extraBudget, strategy) {
  const active = debts.filter(d => d.balance > 0);
  if (!active.length) return { requiredExtra: 0, achievable: true, currentMonths: 0 };

  const base = simulatePayoff(active, extraBudget, strategy);
  if (base.months <= targetMonths) {
    return { requiredExtra: 0, achievable: true, currentMonths: base.months };
  }

  // Check if the goal is theoretically achievable at all (with very high payment)
  const best = simulatePayoff(active, extraBudget + 999999, strategy);
  if (best.months > targetMonths) {
    return { requiredExtra: null, achievable: false, currentMonths: base.months };
  }

  // Binary search between 0 and total remaining balance
  const totalDebt = active.reduce((s, d) => s + d.balance, 0);
  let lo = 0, hi = totalDebt;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const result = simulatePayoff(active, extraBudget + mid, strategy);
    if (result.months <= targetMonths) hi = mid;
    else lo = mid;
  }

  return {
    requiredExtra: Math.ceil(hi),
    achievable: true,
    currentMonths: base.months,
  };
}

// --- calculatePayoffPlan ---

function calculatePayoffPlan(debts, monthlyIncome, monthlyExpenses, extraPayment = 0, strategy = 'avalanche') {
  const activeDebts = debts.filter(d => d.balance > 0);

  const totalMinimums = activeDebts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  const surplus = monthlyIncome - monthlyExpenses - totalMinimums;
  const extraBudget = surplus + (extraPayment || 0);

  const order = getAttackOrder(activeDebts, strategy);
  const { months, totalInterest, cardPayoffMonths } = simulatePayoff(activeDebts, extraBudget, strategy);

  const debtFreeDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  return {
    order,
    totalMonths: months,
    totalInterest,
    debtFreeDate,
    totalMinimums: Math.round(totalMinimums * 100) / 100,
    surplus: Math.round(surplus * 100) / 100,
    extraBudget: Math.round(Math.max(0, extraBudget) * 100) / 100,
    negativeSurplus: extraBudget < 0,
    perCardTimeline: cardPayoffMonths,
  };
}

// --- compareScenarios ---

function compareScenarios(debts, surplus, strategy = 'avalanche') {
  return [0, 300, 500].map(extra => {
    const result = simulatePayoff(debts.filter(d => d.balance > 0), surplus + extra, strategy);
    return { extraMonthly: extra, ...result };
  });
}

module.exports = {
  getAttackOrder,
  calculateMonthlyInterest,
  simulatePayoff,
  simulateLumpSum,
  calculateRequiredPayment,
  calculatePayoffPlan,
  compareScenarios,
  checkAlerts,
};
