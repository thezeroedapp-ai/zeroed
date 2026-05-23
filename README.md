# Zeroed — Debt Payoff Tracker

> **Keep this README updated.** After every dev session, update Current Status, Changelog, and Roadmap. The README is the single source of truth for where the project stands — if it's not in here, it didn't happen. See `DEVLOG.md` for day-by-day session notes.

The goal of Zeroed is simple: **know exactly when you'll be debt-free, and take the fastest path there.**

Most people with credit card debt don't have a clear picture — they make minimum payments, get hit with interest, and never see the finish line. Zeroed connects to your real bank accounts, surfaces your actual APRs and balances, and runs a month-by-month simulation that shows you the optimal order to attack your debt, your exact debt-free date, and how much interest you'll save by throwing even an extra $100/mo at it.

Built as a mobile-first React PWA. Backend runs on Firebase Cloud Functions.

---

## Current Status

**v4.4 — Cloud Functions 2nd Gen + Node 22.** *(2026-05-23)*

Live at: **[https://zeroed-3331d.web.app](https://zeroed-3331d.web.app)**

Full Firebase stack live with a dark premium UI:

- **Auth:** Firebase Authentication (email/password + Google OAuth)
- **Database:** Firestore — subcollections under `users/{uid}/`
- **API:** Express wrapped as Firebase Cloud Functions (`exports.api`)
- **Hosting:** Firebase Hosting (React SPA) + Rewrites to Cloud Functions
- **Frontend:** React 18 + Vite + TypeScript — 5-tab nav with subtabs, dark design system, bento grid dashboard

All screens working (5-tab structure):
- **Home (Dashboard)** — bento grid layout with interactive debt payoff projection chart (recharts), monthly stats, net worth summary (assets − liabilities), priority attack card, AI analysis, goals preview
- **Plan** — 3 subtabs: Strategy (4 payoff strategies, freed-minimum rollover, lump-sum simulator, extra payment calculator), Goals (debt-free date targets, per-card payoff goals, balance targets, required-payment calculator), AI Insights (Claude-powered spending analysis)
- **Accounts** — 3 subtabs: Accounts (all types grouped by institution, net worth strip, inline APR/min edit), Budget (per-category monthly budgets with progress bars), Rewards (category-based card recommendations ranked by reward multipliers and TPG valuations)
- **Spending** — 3 subtabs: Transactions (filterable by expenses/payments, "Explore cards →" teaser linking to Accounts › Rewards), Trends (6-month stacked bar chart by category), Recurring (auto-detected subscriptions with annual cost estimate)
- **Settings** — bank connect/disconnect, income profile, sinking funds manager

**Next:** Connect Plaid production; Stripe freemium gate.

---

## Changelog

| Version | Date | What shipped |
|---------|------|--------------|
| v4.4 | 2026-05-23 | Firebase Cloud Functions upgraded: Node 20 1st Gen → Node 22 2nd Gen; firebase-functions v4 → v5; index.js migrated from v1 API (functions.https/pubsub) to v2 API (onRequest/onSchedule) |
| v4.3 | 2026-05-23 | Tech debt cleanup (expenses→sinking_funds, recommendations→rewards, removed old HTML public/ dir); 5-tab nav consolidation (Goals→Plan subtab, Budget+Rewards→Accounts subtabs); "Explore cards →" teaser in Spending→Transactions; legacy route redirects |
| v4.2 | 2026-05-22 | Monarch/Origin parity — all Plaid account types (investment, loan, mortgage, brokerage); net worth on Dashboard + Accounts; Budget screen with per-category progress; Spending screen (transactions + stacked trends chart + recurring detection); first production Firebase deploy to zeroed-3331d.web.app |
| v4.1 | 2026-05-22 | Dark premium UI redesign — complete `index.css` overhaul (violet accent, navy backgrounds, glassmorphism nav); Dashboard bento grid with recharts debt payoff projection; bug fixes: Recommend auth token, Goals Firestore string IDs, plan route response shape |
| v4.0 | 2026-05-22 | Firebase migration — replaced Railway + Supabase + PostgreSQL with Firebase Auth + Firestore + Cloud Functions + Hosting; React frontend migrated from Supabase SDK to Firebase SDK; all routes scoped to `req.user.uid` (string); Firestore subcollections under `users/{uid}/`; `firebase deploy` ships everything |
| v3.2 | 2026-05-21 | Monorepo restructure — `server/`, `apps/web/`, `packages/core/`; responsive layout (mobile bottom nav, tablet/desktop sidebar) |
| v3.1 | 2026-05-21 | React + Vite + TypeScript frontend — replaced vanilla HTML; React Router, AuthContext, all 9 pages |
| v3.0 | 2026-05-21 | Multi-user auth — Supabase Auth (email/password + Google OAuth); JWT middleware; all 7 pages gated |
| v2.1 | 2026-05-20 | Supabase live + NUMERIC type parser fix |
| v2.0 | 2026-05-20 | PostgreSQL/Supabase migration — replaced SQLite with pg; async/await throughout |
| v1.4 | 2026-05-20 | Card recommendation engine — curated reward profiles, TPG valuations, 8-category picker |
| v1.3 | 2026-05-20 | AI spending insights (Dashboard), manual APR inline edit |
| v1.2 | 2026-05-20 | Sinking funds manager, surplus accuracy fix |
| v1.1 | 2026-05-20 | 4-strategy grid, lump-sum simulator, Goals screen |
| v1.0 | 2026-05-20 | Initial build: Dashboard, Plan, Accounts, Activity, Settings; Plaid sandbox; SQLite |

---

## What It Does

### Core Features

- **Home (Dashboard)** — Total debt, monthly interest cost, surplus, debt-free date, net worth (assets − liabilities), smart alerts, live goals status card, projected payoff chart
- **Plan › Strategy** — Four payoff strategies, 3 scenarios, extra payment slider, lump-sum simulator, attack order with per-card payoff dates
- **Plan › Goals** — Set debt-free date targets, per-card payoff goals, balance targets; required-payment calculator answers "what does it take to be free by [date]?"
- **Plan › AI Insights** — Claude-powered spending analysis, 10 free/month with freemium gate
- **Accounts › Accounts** — All connected accounts grouped by institution and type (Cash & Savings, Investments, Credit Cards, Loans); net worth summary strip; inline edit for APR/min payment on credit cards
- **Accounts › Budget** — Set per-category monthly spending limits; progress bars (spent/remaining/pct), overall summary strip; add/remove budgets
- **Accounts › Rewards** — Pick a spend category and get ranked card recommendations; active-debt cards ranked lower automatically
- **Spending › Transactions** — Filterable by expenses/payments, account name lookup; "Explore cards →" teaser linking to Accounts › Rewards
- **Spending › Trends** — 6-month stacked bar chart by category (recharts)
- **Spending › Recurring** — Auto-detected subscriptions from 2+ months of history, annual cost estimate
- **Settings** — Connect/disconnect banks via Plaid Link, update income/strategy, manage sinking funds

### Payoff Strategies

| Strategy | How it works | Best for |
|---|---|---|
| **Avalanche** | Highest APR first | Minimizing total interest (mathematically optimal) |
| **Snowball** | Lowest balance first | Motivation — quick wins build momentum |
| **Hybrid** | 60% APR + 40% balance weighting | Balanced — good math *and* visible progress |
| **Cash Flow** | Highest min-payment/balance ratio first | Freeing up monthly cash flow fastest |

---

## Prerequisites

- **Node.js v20+**
- **Firebase project** — [console.firebase.google.com](https://console.firebase.google.com); enable Authentication (Email/Password + Google) and Firestore
- **Plaid account** — free sandbox at [dashboard.plaid.com](https://dashboard.plaid.com)
- **Anthropic API key** — optional, powers AI insights
- **Firebase CLI** — `npm install -g firebase-tools`

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/adornedbyveena/zeroed.git
cd zeroed
npm install
```

### 2. Configure environment

Create a `.env` file at the project root (see `.env.example` for all keys):

```
# Firebase (server-side) — Firebase console → Project settings → Service accounts → Generate new private key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}  # paste JSON as a single line

# Plaid — dashboard.plaid.com → Team Settings → Keys
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox

# AI insights (optional)
ANTHROPIC_API_KEY=sk-ant-...

PORT=3000
```

`apps/web/.env.local` (Firebase client config) is **committed to git** — no manual creation needed. The values are public by design (Firebase client config is not secret).

### 3. Start local development

```bash
# Terminal 1 — Express backend on :3000
npm run dev

# Terminal 2 — Vite frontend on :5173 (proxies /api to :3000)
npm run dev:web
```

Open [http://localhost:5173](http://localhost:5173).

**UI-only development (no local server needed)** — proxies API calls to production Firebase:

```bash
npm run dev:web:remote
```

### 4. Deploy to Firebase

```bash
firebase login
npm run deploy   # builds React + deploys Hosting + Functions + Firestore rules
```

---

## Project Structure

```
zeroed/
├── server/
│   ├── index.js              # Cloud Functions entry — exports.api + exports.dailySync
│   ├── server.js             # Express app — all routes, dashboard, user endpoints
│   ├── db/
│   │   └── database.js       # Firebase Admin SDK — Firestore CRUD, all data access
│   ├── middleware/
│   │   └── auth.js           # Firebase token verification — verifyIdToken, auto-create profile
│   ├── routes/
│   │   ├── plaid.js          # /api/plaid/* — link token, exchange, sync, accounts, items
│   │   ├── plan.js           # /api/plan/* — generate, latest, lump-sum, required-payment, alerts
│   │   ├── goals.js          # /api/goals — CRUD + live progress computation
│   │   ├── sinking-funds.js  # /api/sinking-funds — income + sinking funds CRUD
│   │   ├── transactions.js   # /api/transactions — history, category summary, trends, recurring
│   │   ├── budgets.js        # /api/budgets — CRUD + current-month spending enrichment
│   │   ├── insights.js       # /api/insights — AI spending analysis, freemium gate
│   │   ├── rewards.js        # /api/rewards — ranked card suggestions
│   │   └── admin.js          # /api/admin — admin-only user management
│   ├── services/
│   │   ├── plaidService.js         # Plaid API — sync accounts + transactions (all account types)
│   │   ├── payoffEngine.js         # Pure math — 4 strategies, simulate, lump-sum, required-payment
│   │   ├── claudeService.js        # Claude API — plan insight + spending analysis
│   │   ├── cardProfiles.js         # Curated reward profiles — multipliers, TPG valuations
│   │   └── recommendationEngine.js # Ranking logic — effectiveRate, debt penalty
│   └── package.json
├── apps/web/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── firebase.ts    # Firebase client init (Auth)
│   │   │   └── api.ts         # apiFetch — attaches Firebase ID token to all requests
│   │   ├── context/
│   │   │   └── AuthContext.tsx # Firebase onAuthStateChanged, profile fetch, signOut
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── SideNav.tsx    # 5-tab sidebar (Home, Plan, Accounts, Spending, Settings)
│   │   │   ├── BottomNav.tsx  # 5-tab mobile nav (same tabs)
│   │   │   └── SubNav.tsx     # Reusable horizontal subtab bar
│   │   └── pages/
│   │       ├── Dashboard.tsx  # Home tab
│   │       ├── Plan.tsx       # Plan tab (Strategy / Goals / AI Insights subtabs)
│   │       ├── Accounts.tsx   # Accounts tab (Accounts / Budget / Rewards subtabs)
│   │       ├── Spending.tsx   # Spending tab (Transactions / Trends / Recurring subtabs)
│   │       ├── Settings.tsx, Admin.tsx, Login.tsx, Signup.tsx
│   ├── .env.local             # VITE_FIREBASE_* vars (committed — Firebase client config is public)
│   └── package.json
├── packages/core/
│   └── index.ts               # Shared: fmt(), fmtD(), ROUTES constants
├── firebase.json              # Hosting + Functions + Firestore config
├── .firebaserc                # Project: zeroed-3331d
├── firestore.rules            # Deny-all (Admin SDK bypasses)
├── firestore.indexes.json     # Composite indexes
├── .env.example               # Documents required server env vars
├── DEVLOG.md
└── package.json               # npm workspaces root
```

---

## API Reference

All `/api/*` routes require `Authorization: Bearer <Firebase ID token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (public) |
| GET | `/api/user` | User profile |
| PUT | `/api/user` | Update income, expenses, or strategy |
| GET | `/api/dashboard` | Aggregated totals, alerts, priority card, debt-free date |
| GET | `/api/plaid/accounts` | All connected accounts |
| POST | `/api/plaid/create-link-token` | Start Plaid Link flow |
| POST | `/api/plaid/exchange-token` | Complete Plaid Link, store access token |
| POST | `/api/plaid/sync` | Refresh balances + pull new transactions |
| GET | `/api/plaid/items` | Connected bank institutions |
| PUT | `/api/plaid/accounts/:id/credit-details` | Set APR, min payment, due date |
| DELETE | `/api/plaid/accounts/:id` | Remove account |
| POST | `/api/plan/generate` | Run payoff engine + Claude insight, persist plan |
| GET | `/api/plan/latest` | Last saved plan |
| GET | `/api/plan/alerts` | Promo APR expiry + high utilization alerts |
| POST | `/api/plan/lump-sum` | Simulate one-time extra payment impact |
| POST | `/api/plan/required-payment` | Extra monthly needed for a target date |
| GET | `/api/goals` | All active goals with live progress |
| POST | `/api/goals` | Create a goal |
| DELETE | `/api/goals/:id` | Remove a goal |
| GET | `/api/transactions` | Transaction list |
| GET | `/api/transactions/summary` | Spending by category |
| GET | `/api/transactions/trends` | 6-month spending by category (top 7, stacked chart data) |
| GET | `/api/transactions/recurring` | Recurring transactions detected from 2+ months of history |
| GET | `/api/budgets` | All budgets enriched with current-month spent/remaining/pct |
| POST | `/api/budgets` | Create budget (`category` + `monthly_limit`) |
| DELETE | `/api/budgets/:id` | Remove budget |
| GET | `/api/sinking-funds/income` | Saved monthly income |
| PUT | `/api/sinking-funds/income` | Update monthly income |
| GET | `/api/sinking-funds` | All sinking funds |
| POST | `/api/sinking-funds` | Add a sinking fund |
| DELETE | `/api/sinking-funds/:id` | Remove a sinking fund |
| GET | `/api/insights/latest` | Cached AI insight + usage stats |
| POST | `/api/insights/generate` | Generate AI spending insight (10/mo free limit) |
| GET | `/api/rewards/categories` | Spend categories with icons |
| GET | `/api/rewards?category=dining` | Ranked card recommendations |

---

## Firestore Schema

All user data lives under `users/{uid}/`:

| Subcollection | Document ID | Key fields |
|---|---|---|
| `accounts` | `plaid_account_id` | name, type (`depository`/`credit`/`investment`/`loan`/`mortgage`/`brokerage`), subtype, balance_current, apr, minimum_payment, credit_limit, institution_name |
| `transactions` | `plaid_transaction_id` | account_id, amount, date, name, category |
| `goals` | auto | goal_type, target_date, target_balance, account_id, is_active |
| `sinking_funds` | auto | category, monthly_amount, label |
| `budgets` | auto | category, monthly_limit, created_at, updated_at |
| `insights` | auto | content, created_at |
| `ai_usage` | `YYYY-MM` | count |
| `plaid_items` | `plaid_item_id` | access_token, institution_name, last_synced |
| `payoff_plans` | auto | strategy, surplus, items (embedded array) |

---

## Payoff Engine

The engine (`server/services/payoffEngine.js`) runs entirely locally — no API calls.

**Core simulation:** Each month — accrue interest → pay all minimums → attack priority card with surplus. When a card pays off, its minimum **permanently joins** the attack budget (freed-minimum rollover).

**Lump-sum simulation:** Reduces a card's balance by the lump amount, then runs a normal simulation. Returns `monthsSaved` and `interestSaved` vs. baseline.

**Required-payment calculator:** Binary search (50 iterations) over the extra payment range `[0, totalDebt]` to find the minimum extra amount that achieves `months ≤ targetMonths`.

---

## Connecting Real Banks (Plaid Sandbox)

In sandbox mode, use these fake credentials inside the Plaid Link widget:

- **Username:** `user_good`
- **Password:** `pass_good`

---

## Roadmap

### Done ✅
- [x] 4 payoff strategies: Avalanche, Snowball, Hybrid, Cash Flow
- [x] Freed-minimum rollover, lump-sum simulator, required-payment calculator
- [x] Goals system with 3 goal types
- [x] Transaction history with category filters
- [x] AI insights (Plan + Dashboard) with freemium gate (`is_pro`)
- [x] Card recommendation engine — 10 cards, 8 categories, TPG valuations
- [x] Sinking funds — flows into all surplus calculations
- [x] Manual APR/min payment inline edit
- [x] **React + Vite + TypeScript** frontend
- [x] **Monorepo** — `server/`, `apps/web/`, `packages/core/`
- [x] **Multi-user auth** — email/password + Google OAuth
- [x] **Firebase migration** — Auth + Firestore + Cloud Functions + Hosting; Railway + Supabase + PostgreSQL removed *(v4.0, 2026-05-22)*
- [x] **All Plaid account types** — depository, credit, investment, loan, mortgage, brokerage *(v4.2)*
- [x] **Net worth tracking** — Total Assets − Total Liabilities on Dashboard + Accounts *(v4.2)*
- [x] **Budget system** — per-category monthly limits, progress bars, spent/remaining *(v4.2)*
- [x] **Spending trends** — 6-month stacked bar chart by category (recharts) *(v4.2)*
- [x] **Recurring detection** — auto-detect subscriptions from 2+ months of history, annual cost *(v4.2)*
- [x] **Firebase production deploy** — live at zeroed-3331d.web.app *(v4.2, 2026-05-22)*
- [x] **Mac + Windows simultaneous dev** — `.env.local` committed, `dev:web:remote` script proxies to production *(v4.2)*
- [x] **Tech debt cleanup** — renamed `expenses`→`sinking_funds` (Firestore + routes), `recommendations`→`rewards`; removed old vanilla HTML public/ dir; consistent `monthly_amount` field throughout *(v4.3, 2026-05-23)*
- [x] **5-tab nav consolidation** — Goals→Plan subtab, Budget+Rewards→Accounts subtabs; reusable `SubNav` component; URL-based subtab navigation via `useSearchParams`; "Explore cards →" cross-tab deep link *(v4.3, 2026-05-23)*
- [x] **Cloud Functions 2nd Gen** — Node 20 → 22, firebase-functions v4 → v5, v1 API → v2 `onRequest`/`onSchedule` *(v4.4, 2026-05-23)*

### Up Next 🔜
- [ ] Plaid production credentials (apply early — 2–3 week review)
- [ ] Stripe freemium — Pro gate for unlimited AI; `is_pro` flag already in schema

### Later 📋
- [ ] React Native + Expo — iOS + Android
- [ ] Push notifications for due dates and promo APR expiry
- [ ] Reward profile updates — quarterly TPG valuation refresh
- [ ] Lump-sum split across multiple cards
- [ ] PDF/CSV export of payoff plan

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Auth | Firebase Authentication (email/password + Google) |
| Database | Firestore (Firebase Admin SDK, server-side) |
| API | Express.js → Firebase Cloud Functions |
| Hosting | Firebase Hosting (SPA) + Cloud Functions (API) |
| Bank data | Plaid API v29 (Transactions + Liabilities) |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Monorepo | npm workspaces |
| Deploy | `firebase deploy` |

**Firebase project:** `zeroed-3331d`  
**Production URL:** [zeroed-3331d.web.app](https://zeroed-3331d.web.app)  
**Repository:** [github.com/thezeroedapp-ai/zeroed](https://github.com/thezeroedapp-ai/zeroed)
