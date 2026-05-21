# Zeroed — Debt Payoff Tracker

> **Keep this README updated.** After every dev session, update Current Status, Changelog, and Roadmap. The README is the single source of truth for where the project stands — if it's not in here, it didn't happen. See `DEVLOG.md` for day-by-day session notes.

The goal of Zeroed is simple: **know exactly when you'll be debt-free, and take the fastest path there.**

Most people with credit card debt don't have a clear picture — they make minimum payments, get hit with interest, and never see the finish line. Zeroed connects to your real bank accounts, surfaces your actual APRs and balances, and runs a month-by-month simulation that shows you the optimal order to attack your debt, your exact debt-free date, and how much interest you'll save by throwing even an extra $100/mo at it.

Built as a mobile-first PWA today. Roadmap: React frontend → Supabase (multi-user) → React Native + Expo (native iOS/Android). The Node.js backend API is the stable interface across all three platforms — it never changes regardless of what frontend consumes it.

---

## Current Status

**v2.0 — PostgreSQL/Supabase migration complete.** *(2026-05-20)*

All 7 screens built and tested with live data:

- **Dashboard** — totals, monthly interest, surplus (net of sinking funds), smart alerts, goals snapshot, AI Analysis card
- **Plan** — 4 payoff strategies with freed-minimum rollover, lump-sum simulator, extra payment slider, AI insights
- **Goals** — set debt-free date targets, per-card payoff goals, balance targets; required-payment calculator shows exactly what it takes to hit any date
- **Accounts** — utilization bars, due date badges, promo APR warnings, inline edit for APR/min payment/due date
- **Reward** — pick a spend category (dining, groceries, travel, gas, etc.) and get ranked card recommendations based on reward multipliers and TPG point valuations; cards with active debt balances are ranked lower with a warning
- **Activity** — transaction history grouped by month, categorized, filterable
- **Settings** — bank connect/disconnect, income/expenses/strategy profile, sinking funds manager
- Daily Plaid sync at 8am via cron
- Claude AI insights on Plan screen + AI spending analysis on Dashboard (10 free/month per user, Pro tier bypasses limit)

**Next:** Multi-user auth — Supabase Auth (email/password + Google OAuth), scope all queries to JWT `user_id`, remove hardcoded `WHERE id = 1`.

---

## Changelog

| Version | Date | What shipped |
|---------|------|--------------|
| v2.0 | 2026-05-20 | PostgreSQL/Supabase migration — replaced `better-sqlite3` with `pg` Pool; all routes async/await; new `schema.sql` for Supabase; GitHub org moved to `thezeroedapp-ai`; project email `thezeroedapp@gmail.com` |
| v1.4 | 2026-05-20 | Card recommendation engine — curated reward profiles (10 cards), TPG point valuations, debt-penalty ranking, 8-category picker, `GET /api/recommendations` |
| v1.3 | 2026-05-20 | AI spending insights (Dashboard), manual APR inline edit (Accounts), `is_pro` bypass flag |
| v1.2 | 2026-05-20 | Sinking funds manager (Settings), surplus accuracy fix across all payoff calculations |
| v1.1 | 2026-05-20 | 4-strategy grid UI, lump-sum simulator, Goals screen, freed-minimum rollover |
| v1.0 | 2026-05-20 | Initial build: Dashboard, Plan, Accounts, Activity, Settings; Plaid sandbox; SQLite |

---

## What It Does

### Core Features

- **Dashboard** — Total debt, monthly interest cost, surplus, debt-free date, smart alerts, and a live goals status card
- **Accounts** — All connected credit cards with APR, utilization, due dates, and promo rate warnings
- **Plan** — Four payoff strategies, 3 scenarios, extra payment slider, lump-sum simulator, attack order with per-card payoff dates, AI analysis
- **Goals** — Set targets and track progress; required-payment calculator answers "what does it take to be free by [date]?"
- **Reward** — Pick a spend category and get ranked card recommendations based on reward multipliers and point valuations; active-debt cards ranked lower automatically
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
- **Supabase account** — free tier at [supabase.com](https://supabase.com); create a project and grab the connection string
- **Plaid account** — free sandbox at [dashboard.plaid.com](https://dashboard.plaid.com)
- **Anthropic API key** — optional, powers AI insights

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/thezeroedapp-ai/zeroed.git
cd zeroed
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
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
PORT=3000
```

Find your Plaid credentials at [dashboard.plaid.com](https://dashboard.plaid.com) → Team Settings → Keys.
Find your Supabase connection string at your project → Settings → Database → Connection string (URI mode).

### 3. Set up the database

In your Supabase project, open the **SQL Editor** and run the full contents of `src/db/schema.sql`. This creates all 11 tables. Only needs to be done once.

### 4. Start the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

On first run the server seeds a user profile and 5 realistic dev credit card accounts so the app is usable immediately without connecting real banks.

> **To reset dev data:** Truncate the tables in Supabase SQL Editor: `TRUNCATE users, accounts, credit_details, transactions, payoff_plans, plan_items, user_goals, user_expenses, user_insights, ai_usage, plaid_items RESTART IDENTITY CASCADE;` then restart the server.

---

## Project Structure

```
zeroed/
├── src/
│   ├── server.js                 # Express server, /api/dashboard, /api/user, cron, dev seed
│   ├── db/
│   │   ├── schema.sql            # PostgreSQL schema (11 tables) — run once in Supabase SQL Editor
│   │   └── database.js           # pg Pool, query/queryOne/withTransaction helpers, all CRUD functions
│   ├── routes/
│   │   ├── plaid.js              # /api/plaid/* — link token, exchange, sync, accounts, credit-details
│   │   ├── plan.js               # /api/plan/* — generate, latest, alerts, lump-sum, required-payment
│   │   ├── goals.js              # /api/goals — CRUD + live progress computation
│   │   ├── expenses.js           # /api/expenses — sinking funds CRUD
│   │   ├── transactions.js       # /api/transactions — history + category summary
│   │   ├── insights.js           # /api/insights — AI spending analysis, usage tracking, freemium gate
│   │   └── recommendations.js    # /api/recommendations — ranked card suggestions by spend category
│   ├── services/
│   │   ├── plaidService.js         # Plaid API client — sync accounts + transactions
│   │   ├── payoffEngine.js         # Pure math — 4 strategies, simulate, lump-sum, required-payment
│   │   ├── claudeService.js        # Claude API — Plan insight + Dashboard spending analysis
│   │   ├── cardProfiles.js         # 10 curated reward profiles — multipliers, TPG valuations
│   │   └── recommendationEngine.js # Ranking logic — effectiveRate, 50% debt penalty, category match
│   └── public/
│       ├── style.css               # Full design system — mobile-first, 480px max-width
│       ├── index.html              # Dashboard
│       ├── accounts.html           # Account list + inline APR edit
│       ├── plan.html               # Payoff plan + strategies + lump-sum
│       ├── goals.html              # Goals + required-payment calculator
│       ├── recommend.html          # Card recommender — category picker + ranked results
│       ├── activity.html           # Transaction history
│       └── settings.html           # Profile + bank connections + sinking funds
├── DEVLOG.md                     # Day-by-day session notes and decisions
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
| PUT | `/api/plaid/accounts/:id/credit-details` | Manually set APR, min payment, due date for a card |
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
| GET | `/api/insights/latest` | Cached AI spending insight + monthly usage stats |
| POST | `/api/insights/generate` | Generate AI spending insight (checks 10/mo free limit) |
| GET | `/api/recommendations/categories` | All spend categories with icons and profile last-updated date |
| GET | `/api/recommendations?category=dining&amount=50` | Ranked card recommendations for a spend category |

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
- [x] Manual APR entry — inline edit per card on Accounts page; warning when data is missing
- [x] AI spending insights — 90-day habit analysis on Dashboard; 10 free/month, `is_pro` flag for unlimited
- [x] Card recommendation engine — curated reward profiles (10 cards), 8 categories, TPG valuations, debt-penalty ranking
- [x] **PostgreSQL/Supabase migration** — replaced SQLite; async/await throughout; Supabase-ready schema *(v2.0, 2026-05-20)*
- [x] **GitHub org** — repo moved to `thezeroedapp-ai`; project email `thezeroedapp@gmail.com` *(2026-05-20)*

### Up Next 🔜

**Phase 2 — Multi-user foundation**
- [ ] **Multi-user auth** — Supabase Auth (email/password + Google OAuth); scope all queries to JWT `user_id`; remove hardcoded `WHERE id = 1`
- [ ] **Stripe freemium** — Pro gate for unlimited AI; `is_pro` flag already in schema; pricing TBD
- [ ] Connect Plaid production credentials + get Liabilities product approved *(apply early — 2–3 week review)*

**Phase 3 — React web**
- [ ] **React + Vite + TypeScript** — replace vanilla HTML screens; shared hooks + API client layer
- [ ] Monorepo setup (Turborepo) — `apps/web`, `packages/api`, `packages/types`

**Phase 4 — Native mobile**
- [ ] **React Native + Expo** — iOS + Android; reuses hooks from Phase 3; Supabase Auth handles mobile tokens
- [ ] Push notifications for payment due dates and promo APR expiry

### Later 📋
- [ ] Reward profile updates — quarterly refresh of TPG valuations and card multipliers in `src/services/cardProfiles.js`
- [ ] User overrides for card reward multipliers (Settings page)
- [ ] Lump-sum "split across multiple cards" optimization
- [ ] PDF/CSV export of payoff plan and transaction history

---

## Platform Strategy

Zeroed is designed to run on web, iOS, and Android from a single backend. The Express API is the stable contract — every platform calls the same endpoints.

### Architecture roadmap

```
Phase 1 — Done ✅
  Vanilla HTML/CSS/JS (PWA)  →  Node.js API  →  Supabase Postgres

Phase 2 — In progress
  Vanilla HTML/CSS/JS (PWA)  →  Node.js API  →  Supabase Postgres + Auth (multi-user)

Phase 3 — React web
  React (Vite)               →  Node.js API  →  Supabase
  Shared: hooks, API client, TypeScript types

Phase 4 — Native mobile
  React Native + Expo        →  Node.js API  →  Supabase
  Shared: same hooks + API client as web (monorepo)
```

### What gets shared across web + iOS + Android

| Layer | Shared? | Notes |
|---|---|---|
| API client + fetch hooks | ✅ Yes | Same endpoints, same response shapes |
| Business logic (payoff math, formatters) | ✅ Yes | Pure JS/TS, no platform deps |
| TypeScript types | ✅ Yes | Account, Plan, Goal, etc. |
| UI components | ❌ No | React uses `<div>`, React Native uses `<View>` |
| Styles | ❌ No | CSS vs StyleSheet API |
| Navigation | ❌ No | React Router vs React Navigation |

### Why Node.js stays (not Python)

The backend language doesn't affect which platforms can connect to it — iOS, Android, and web all speak HTTP. Rewriting working Express routes in Python would cost weeks with zero user-facing benefit. Python would only be added if a specific ML/data-science use case emerges (e.g. training a spending prediction model). For a REST API serving financial data, Node.js + Supabase is the right call.

---

## Tech Stack

### Current
- **Backend:** Node.js, Express, pg (PostgreSQL client), node-cron
- **Database:** Supabase (PostgreSQL) — schema at `src/db/schema.sql`, run once in Supabase SQL Editor
- **Bank data:** Plaid API v29 (Transactions + Liabilities products)
- **AI insights:** Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`
- **Frontend:** Vanilla HTML/CSS/JS — mobile-first PWA, 480px max-width
- **Reward profiles:** Curated static JSON in `cardProfiles.js`, TPG valuations updated quarterly
- **Repository:** [github.com/thezeroedapp-ai/zeroed](https://github.com/thezeroedapp-ai/zeroed)
- **Project email:** thezeroedapp@gmail.com

### Target (multi-user + mobile)
- **Auth:** Supabase Auth (email/password + Google OAuth) + Row-Level Security
- **Web frontend:** React + Vite + TypeScript
- **Mobile:** React Native + Expo (iOS + Android)
- **Monorepo:** Turborepo — `apps/web`, `apps/mobile`, `packages/api`, `packages/types`
