/**
 * All debt math runs locally — no API calls.
 * debts shape: { name, balance, apr, minimumPayment }
 */

// --- getAttackOrder ---

function getAttackOrder(debts, strategy) {
  const sorted = [...debts].sort((a, b) =>
    strategy === 'avalanche'
      ? (b.apr - a.apr) || (a.balance - b.balance) // highest APR; tiebreak by lower balance
      : a.balance - b.balance                       // lowest balance first
  );
  return sorted.map((d, i) => ({ ...d, priority: i + 1 }));
}

// --- checkAlerts ---

function checkAlerts(accounts) {
  const alerts = [];
  const now = new Date();

  for (const acct of accounts) {
    if (acct.type !== 'credit') continue;

    // Promo APR expiring within 6 months (0% BT within 3 months flagged more urgently)
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

    // High utilization >= 90%
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
  // Freed minimums from paid-off cards accumulate permanently and roll
  // into the attack fund each month (the "debt snowball/avalanche rollover").
  let freedBudget = 0;
  // Clamp negative surplus — we can still simulate, just no extra attack money.
  const safeExtra = Math.max(0, extraBudget);

  while (working.some(d => !d.paid) && months < 600) {
    months++;

    // 1. Accrue monthly interest on all unpaid cards
    for (const debt of working) {
      if (debt.paid) continue;
      const interest = debt.remainingBalance * (debt.apr / 100 / 12);
      debt.remainingBalance += interest;
      totalInterest += interest;
    }

    // 2. Pay minimum on every card (capped at remaining balance)
    //    Freed minimums from cards that hit zero are added to freedBudget,
    //    making them available for the attack phase this same month.
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

    // 3. Attack phase: apply (extra + freed minimums) to priority cards in order.
    //    If the priority card is fully paid off, any remaining budget cascades to
    //    the next card in the same month (standard avalanche/snowball rollover).
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
        // Freed minimum is available starting next month
        freedBudget += debt.minimumPayment;
        // Continue — cascade remaining budget to the next priority card
      }
    }
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    cardPayoffMonths,
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
// Runs simulatePayoff with +$0, +$300, +$500 on top of the base surplus

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
  calculatePayoffPlan,
  compareScenarios,
  checkAlerts,
};
