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

module.exports = { getPayoffInsight };
