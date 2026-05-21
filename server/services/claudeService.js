const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getPayoffInsight(plan, accounts, extraBudget, strategy) {
  const accountSummary = accounts
    .filter(a => a.balance_current > 0)
    .map(a => `${a.name}: $${(a.balance_current || 0).toFixed(2)} balance, ${a.apr || '?'}% APR, $${a.minimum_payment || 0}/mo minimum`)
    .join('\n');

  const orderStr = plan.order.map(d => d.name).join(' → ');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: 'You are a personal finance advisor helping users pay off debt. Be concise (2-3 sentences), encouraging, and actionable. End with one specific tip the user can act on today.',
    messages: [{
      role: 'user',
      content: `My debt payoff plan (${strategy} strategy, $${Math.round(extraBudget || 0)}/mo extra):

Accounts:
${accountSummary}

Attack order: ${orderStr}
Debt-free date: ${plan.debtFreeDate} (${plan.totalMonths} months)
Total interest: $${(plan.totalInterest || 0).toFixed(2)}
Monthly surplus: $${Math.round(plan.surplus || 0)}

Give me 2-3 sentences of personalized insight and one specific action I can take today.`,
    }],
  });

  return message.content[0].text;
}

async function getSpendingInsight(user, accounts, spendingByCategory, totalDebt, monthlyInterest, surplus) {
  const accountSummary = accounts
    .filter(a => a.balance_current > 0)
    .map(a => `  • ${a.name}: $${(a.balance_current || 0).toFixed(0)} @ ${a.apr || 0}% APR`)
    .join('\n');

  const spendingLines = Object.entries(spendingByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, total]) => `  • ${cat}: $${total.toFixed(0)} total ($${(total / 3).toFixed(0)}/mo avg)`)
    .join('\n');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: `You are a personal finance coach helping someone eliminate debt faster by analyzing their spending habits.
Be specific with dollar amounts. Reference their actual card names and spending categories.
Be direct and encouraging. Return exactly 3 insights numbered 1, 2, 3 — each 1-2 sentences.`,
    messages: [{
      role: 'user',
      content: `Analyze my spending and debt:

Income: $${user.monthly_income || 0}/mo | Living expenses: $${user.monthly_expenses || 0}/mo | Surplus for debt: $${Math.round(surplus)}/mo
Strategy: ${user.strategy || 'avalanche'} | Total debt: $${totalDebt.toFixed(0)} | Monthly interest cost: $${monthlyInterest.toFixed(0)}

Debt breakdown:
${accountSummary || '  (no accounts)'}

Spending last 90 days by category:
${spendingLines || '  (no transaction data yet — give general advice based on the debt profile)'}

Give me:
1. The biggest spending area I could trim and exactly how much redirecting it saves in interest or months
2. A behavioral pattern you notice and whether my payoff strategy fits my situation
3. One specific action I can take this week to accelerate payoff`,
    }],
  });

  return message.content[0].text;
}

module.exports = { getPayoffInsight, getSpendingInsight };
