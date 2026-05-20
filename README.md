# Zeroed — Debt Payoff Tracker

The goal of Zeroed is simple: **know exactly when you'll be debt-free, and take the fastest path there.**

Most people with credit card debt don't have a clear picture — they make minimum payments, get hit with interest, and never see the finish line. Zeroed connects to your real bank accounts, surfaces your actual APRs and balances, and runs a month-by-month simulation that shows you the optimal order to attack your debt, your exact debt-free date, and how much interest you'll save by throwing even an extra $100/mo at it.

Built as a mobile-first PWA so it works on any device without an app store. Future upgrade path to iOS/Android via React Native is planned.

---

## Current Status

**v1.3 — AI spending insights with free tier, manual APR entry, and sinking funds.**

All 6 screens built and tested with live data:

- **Dashboard** — totals, monthly interest, surplus (net of sinking funds), smart alerts, goals snapshot, AI Analysis card
- **Plan** — 4 payoff strategies with freed-minimum rollover, lump-sum simulator, extra payment slider, AI insights
- **Goals** — set debt-free date targets, per-card payoff goals, balance targets; required-payment calculator shows exactly what it takes to hit any date
- **Accounts** — utilization bars, due date badges, promo APR warnings, inline edit for APR/min payment/due date
- **Activity** — transaction history grouped by month, categorized, filterable
- **Settings** — bank connect/disconnect, income/expenses/strategy profile, sinking funds manager
- Daily Plaid sync at 8am via cron
- Claude AI insights on Plan screen + AI spending analysis on Dashboard (10 free/month per user, Pro tier bypasses limit)

**Next:** card rewards & points engine, then Plaid production credentials.

---

## What It Does

### Core Features

- **Dashboard** — Total debt, monthly interest cost, surplus, debt-free date, smart alerts, and a live goals status card
- **Accounts** — All connected credit cards with APR, utilization, due dates, and promo rate warnings
- **Plan** — Four payoff strategies, 3 scenarios, extra payment slider, lump-sum simulator, attack order with per-card payoff dates, AI analysis
- **Goals** — Set targets and track progress; required-payment calculator answers "what does it take to be free by [date]?"
- **Activity** — Transaction history grouped by month (after syncing via Plaid)
- **Settings** — Connect/disconnect banks via Plaid Link, update income/expenses/strategy, manage sinking funds

### Payoff Strategies

| Strategy | How it works | Best for |
|---|---|---|
| **Avalanche** | Highest APR first | Minimizing total interest (mathematically optimal) |
| **Snowball** | Lowest balance first | Motivation — quick wins build momentum |
| **Hybrid** | 60% APR + 40% balance weighting | Balanced — good math *and* visible progress |
| **Cash Flow** | Highest min-payment/balance ratio first | Freeing up monthly cash flow fastest |

### Goals System

Three goal types:

1. **Debt-Free Date** — "I want to be debt-free by [date]." The calculator runs a binary search to find the exact extra monthly payment required and tells you whether you're on track.
2. **Card Payoff** — "I want [card] gone by [date]." Same math, focused on one card.
3. **Balance Target** — "Get my total debt below $X." Shows a progress bar toward the threshold.

### Lump-Sum Simulator

On the Plan screen, enter any one-time amount (tax refund, bonus, gift) and pick which card to apply it to. The simulator instantly shows months saved and interest saved vs. not making that payment.

### Sinking Funds

In Settings, reserve a monthly amount for known future expenses — car registration, medical bills, holiday spending, travel, taxes, etc. Enter the monthly equivalent (e.g. $1,200/yr car registration = $100/mo). The total is automatically subtracted from your surplus in every calculation: dashboard, plan, lump-sum simulator, and required-payment calculator. This keeps the payoff timeline honest — a plan that ignores real expenses will always slip.

---

## Prerequisites

- **Node.js v18+** — install via [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source ~/.zshrc   # or ~/.bashrc
  nvm install --lts
  ```
- **Plaid account** — free sandbox at [dashboard.plaid.com](https://dashboard.plaid.com)
- **Anthropic API key** — optional, powers AI insights on the Plan screen

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/venkatbade/Zeroed.git
cd Zeroed
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_sandbox_secret_here
PLAID_ENV=sandbox
ANTHROPIC_API_KEY=sk-ant-...   # optional
PORT=3000
```

Find your Plaid credentials at [dashboard.plaid.com](https://dashboard.plaid.com) → Team Settings → Keys.

### 3. Start the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The database (`zeroed.db`) is created automatically on first run and seeded with 5 realistic dev credit card accounts so the app is usable immediately without connecting real banks.

> **Existing database?** If you're upgrading from v1.0, the server automatically runs migrations on startup (adds the `insight` column to `payoff_plans` and creates the `user_goals` table). No manual steps needed.

---

## Project Structure

```
zeroed/
├── src/
│   ├── server.js                 # Express server, /api/dashboard, /api/user, cron
│   ├── db/
│   │   ├── schema.sql            # SQLite schema (9 tables)
│   │   └── database.js           # DB singleton, upsertAccount, savePlan, goals + expenses CRUD
│   ├── routes/
│   │   ├── plaid.js              # /api/plaid/* — link token, exchange, sync, accounts
│   │   ├── plan.js               # /api/plan/* — generate, latest, alerts, lump-sum, required-payment
│   │   ├── goals.js              # /api/goals — CRUD + live progress computation
│   │   ├── expenses.js           # /api/expenses — sinking funds CRUD
│   │   └── transactions.js       # /api/transactions
│   ├── services/
│   │   ├── plaidService.js       # Plaid API client
│   │   ├── payoffEngine.js       # Pure math — 4 strategies, simulate, lump-sum, required-payment
│   │   └── claudeService.js      # Claude API — AI insight for the Plan screen
│   └── public/
│       ├── style.css             # Full design system — mobile-first, 480px max-width
│       ├── index.html            # Dashboard
│       ├── accounts.html         # Account list
│       ├── plan.html             # Payoff plan + strategies + lump-sum
│       ├── goals.html            # Goals + required-payment calculator
│       ├── activity.html         # Transaction history
│       └── settings.html         # Profile + bank connections + sinking funds
├── .env.example
├── .gitignore
└── package.json
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Aggregated totals, alerts, priority card, debt-free date |
| GET | `/api/user` | User profile (income, expenses, strategy) |
| PUT | `/api/user` | Update income, expenses, or strategy |
| GET | `/api/plaid/accounts` | All accounts with credit details |
| DELETE | `/api/plaid/accounts/:id` | Disconnect account |
| POST | `/api/plaid/create-link-token` | Start Plaid Link flow |
| POST | `/api/plaid/exchange-token` | Complete Plaid Link, store access token |
| POST | `/api/plaid/sync` | Refresh balances + pull new transactions |
| POST | `/api/plan/generate` | Run payoff engine + Claude insight, persist plan |
| GET | `/api/plan/latest` | Last saved plan (includes stored AI insight) |
| GET | `/api/plan/alerts` | Promo APR expiry + high utilization alerts |
| POST | `/api/plan/lump-sum` | Simulate one-time extra payment impact |
| POST | `/api/plan/required-payment` | Extra monthly payment needed for a target date |
| GET | `/api/goals` | All active goals with live progress and on-track status |
| POST | `/api/goals` | Create a goal |
| DELETE | `/api/goals/:id` | Remove a goal |
| GET | `/api/transactions` | Transaction list with account name (`?limit=200`) |
| GET | `/api/transactions/summary` | Spending by category |
| GET | `/api/expenses` | All sinking funds + monthly total |
| POST | `/api/expenses` | Add a sinking fund (`name`, `amount`, `category`) |
| DELETE | `/api/expenses/:id` | Remove a sinking fund |
| PUT | `/api/plaid/accounts/:id/credit-details` | Manually set APR, min payment, due date for a card |
| GET | `/api/insights/latest` | Cached AI spending insight + monthly usage stats |
| POST | `/api/insights/generate` | Generate AI spending insight (checks 10/mo free limit) |

---

## Payoff Engine

The engine (`src/services/payoffEngine.js`) runs entirely locally — no API calls.

**Core simulation:** Each month — accrue interest → pay all minimums → attack priority card with surplus. When a card pays off, its minimum **permanently joins** the attack budget (freed-minimum rollover).

**Lump-sum simulation:** Reduces a card's balance by the lump amount, then runs a normal simulation. Returns `monthsSaved` and `interestSaved` vs. the baseline.

**Required-payment calculator:** Binary search (50 iterations) over the extra payment range `[0, totalDebt]` to find the minimum extra amount that achieves `months ≤ targetMonths`. Returns the required extra or `achievable: false` if the date is too soon.

**checkAlerts** fires on:
- Promo APR expiring within 6 months → `warning`; within 60 days → `danger`
- Credit utilization ≥ 90% → `warning`; ≥ 95% → `danger`

---

## Dev Seed Data

On first run the server seeds a profile and 5 realistic credit cards (no Plaid credentials needed):

| Card | Balance | APR | Min | Due |
|------|---------|-----|-----|-----|
| Chase Southwest Rapid Rewards | $779.92 | 23.49% | $40 | May 10 |
| Bilt Palladium | $3,041.81 | 10% promo (exp. Sep 17) | $31 | May 19 |
| Citi Double Cash | $8,382.27 | 21.49% | $237.47 | May 20 |
| BofA Visa Signature | $15,455.76 | 23.49% promo (exp. Aug 17) | $277 | May 14 |
| Chase Sapphire Preferred | $27,336.01 | 19.49% | $719 | May 27 |

**Total: $54,995.77**

| Strategy | Months to debt-free | Total interest |
|---|---|---|
| Avalanche | 21 months | $10,306 |
| Hybrid | 22 months | $10,513 |
| Snowball | 22 months | $11,092 |
| Cash Flow | 22 months | $10,988 |

To hit debt-free in 18 months instead: pay an extra **$431/mo** on the avalanche strategy.

To reset: `rm zeroed.db && npm start`

---

## Connecting Real Banks (Plaid Sandbox)

In sandbox mode, use these fake credentials inside the Plaid Link widget:

- **Username:** `user_good`
- **Password:** `pass_good`

---

## Running on Desktop / Always-On

```bash
npm install -g pm2
pm2 start src/server.js --name zeroed
pm2 save
pm2 startup   # auto-start on reboot

pm2 logs zeroed   # view logs
```

---

## Roadmap

### Done ✅
- [x] 4 payoff strategies: Avalanche, Snowball, Hybrid, Cash Flow
- [x] Freed-minimum rollover in simulation
- [x] Lump-sum payment simulator
- [x] Goals system with required-payment calculator
- [x] Per-card and total-debt goal types
- [x] Transaction history with account names and category filters
- [x] AI insights stored persistently per plan
- [x] Promo APR and high-utilization alerts
- [x] Daily Plaid sync cron
- [x] Sinking funds — reserve monthly amounts for known future expenses; flows into all surplus calculations
- [x] Manual APR entry — inline edit per card on Accounts page; yellow warning when data is missing
- [x] AI spending insights — 90-day habit analysis on Dashboard; 10 free/month, `is_pro` flag for unlimited

### Up Next 🔜
- [ ] **Card recommendation engine** — given a purchase category (dining, groceries, travel, gas), recommend which card to use based on reward multipliers, point valuations, and a hard rule against using cards you're actively paying down
- [ ] **Rewards & points profiles** — preset profiles for Chase Sapphire, Amex Gold, Bilt, Citi Double Cash, BofA Cash Rewards, etc. with category multipliers and estimated point values
- [ ] Connect Plaid production credentials + get Liabilities product approved
- [ ] Push notifications for payment due dates and promo APR expiry

### Later 📋
- [ ] Multi-user auth + Stripe upgrade flow (freemium: 10 AI analyses/mo free, Pro unlimited)
- [ ] Lump-sum "split across multiple cards" optimization
- [ ] React Native / Expo upgrade for native iOS + Android apps
- [ ] PDF/CSV export of payoff plan and transaction history

---

## Upgrading to iOS/Android

The PWA can be promoted to a native app using **React Native + Expo** or wrapped with **Capacitor**. The Express backend stays identical — only the frontend layer changes. The API contract documented above is the interface between them.

---

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, node-cron
- **Bank data:** Plaid API v29 (Transactions + Liabilities products)
- **AI insights:** Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`
- **Frontend:** Vanilla HTML/CSS/JS — no frameworks, mobile-first PWA
- **Database:** SQLite (WAL mode, foreign keys enabled)
