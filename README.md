# Zeroed — Debt Payoff Tracker

The goal of Zeroed is simple: **know exactly when you'll be debt-free, and take the fastest path there.**

Most people with credit card debt don't have a clear picture — they make minimum payments, get hit with interest, and never see the finish line. Zeroed connects to your real bank accounts, surfaces your actual APRs and balances, and runs a month-by-month simulation that shows you the optimal order to attack your debt, your exact debt-free date, and how much interest you'll save by throwing even an extra $100/mo at it.

Built as a mobile-first PWA so it works on any device without an app store. Future upgrade path to iOS/Android via React Native is planned.

---

## Current Status

**v1.0 — fully working.** All 5 screens built and tested with live data:

- Dashboard loads with correct totals, monthly interest burn, surplus, and smart alerts
- Plan screen runs avalanche/snowball simulation with freed-minimum rollover
- Accounts screen shows utilization bars, due date badges, and promo APR warnings
- Activity screen ready for transactions once Plaid sync runs
- Settings screen handles bank connect/disconnect and profile updates
- Daily Plaid sync runs automatically at 8am via cron
- Claude AI insights wired into the Plan screen (optional — gracefully skipped if no API key)

**Next:** connect real Plaid production credentials, get Plaid Liabilities product approved, add manual APR entry as fallback, ship to a real device.

---

## What It Does

- **Dashboard** — Total debt, monthly interest cost, surplus, debt-free date, and smart alerts
- **Accounts** — All connected credit cards with APR, utilization, due dates, and promo rate warnings
- **Plan** — Avalanche vs. snowball strategy toggle, 3 payoff scenarios, extra payment slider, attack order with per-card payoff dates
- **Activity** — Transaction history grouped by month (after syncing via Plaid)
- **Settings** — Connect/disconnect banks via Plaid Link, update income/expenses/strategy

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

---

## Project Structure

```
zeroed/
├── src/
│   ├── server.js                 # Express server, /api/dashboard, /api/user, cron
│   ├── db/
│   │   ├── schema.sql            # SQLite schema (7 tables)
│   │   └── database.js           # DB singleton, upsertAccount, savePlan, getPayoffPlan
│   ├── routes/
│   │   ├── plaid.js              # /api/plaid/* — link token, exchange, sync, accounts
│   │   ├── plan.js               # /api/plan/* — generate, latest, alerts
│   │   └── transactions.js       # /api/transactions
│   ├── services/
│   │   ├── plaidService.js       # Plaid API client — accountsGet, liabilitiesGet, transactionsGet
│   │   ├── payoffEngine.js       # Pure math — simulate, compare scenarios, checkAlerts
│   │   └── claudeService.js      # Claude API — AI insight for the Plan screen
│   └── public/
│       ├── style.css             # Full design system — mobile-first, 480px max-width
│       ├── index.html            # Dashboard
│       ├── accounts.html         # Account list
│       ├── plan.html             # Payoff plan + scenarios
│       ├── activity.html         # Transaction history
│       └── settings.html         # Profile + bank connections
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
| DELETE | `/api/plaid/accounts/:id` | Disconnect account (cascades to plaid_item if last) |
| POST | `/api/plaid/create-link-token` | Start Plaid Link flow |
| POST | `/api/plaid/exchange-token` | Complete Plaid Link, store access token |
| POST | `/api/plaid/sync` | Refresh balances + pull new transactions |
| POST | `/api/plan/generate` | Run payoff engine + Claude insight, persist plan |
| GET | `/api/plan/latest` | Last saved plan |
| GET | `/api/plan/alerts` | Promo APR expiry + high utilization alerts |
| GET | `/api/transactions` | Transaction list (`?limit=200`) |

---

## Payoff Engine

The engine (`src/services/payoffEngine.js`) runs entirely locally — no API calls.

**Avalanche** — sorts by highest APR first; tiebreaker is lowest balance (minimizes total interest).  
**Snowball** — sorts by lowest balance first (fastest psychological wins).

Each simulation month: accrue interest → pay all minimums → attack priority card with surplus. When a card pays off, its minimum **permanently joins** the attack budget for all future months (freed minimum rollover).

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

**Total: $54,995.77 · Debt free: ~Feb 2028 (21 months) on avalanche**

To reset the seed data: `rm zeroed.db && npm start`

---

## Connecting Real Banks (Plaid Sandbox)

In sandbox mode, use these fake credentials inside the Plaid Link widget:

- **Username:** `user_good`
- **Password:** `pass_good`

These are Plaid's test credentials — they work inside the widget to simulate linking a bank. Your `.env` credentials authenticate your app to the Plaid API; these credentials are what a test "user" enters inside the Link popup.

Accounts synced from Plaid are merged with any existing dev seed data. Real Plaid accounts have APR/liability data available in sandbox automatically (Liabilities product requires Plaid approval for production).

---

## Running on Desktop / Always-On

To keep the server running after your terminal closes:

```bash
npm install -g pm2
pm2 start src/server.js --name zeroed
pm2 save
pm2 startup   # auto-start on reboot

pm2 logs zeroed   # view logs
```

The database file (`zeroed.db`) is local — copy it alongside the code if you want to preserve existing data when moving machines.

---

## Roadmap

- [ ] Connect Plaid production credentials + get Liabilities product approved
- [ ] Manual APR entry in Settings as fallback when Plaid liabilities aren't available
- [ ] Push notifications for payment due dates and promo APR expiry
- [ ] Lump-sum payment simulator ("what if I put my tax refund at this card?")
- [ ] React Native / Expo upgrade for native iOS + Android apps
- [ ] Multi-user support with proper auth

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
