# Zeroed — Dev Log

> One entry per work session. Log what was built, what was decided, and what's next. Keep this updated — it's the running history of how the product evolved and why decisions were made.

---

## 2026-05-20

### v1.0 — Initial Build

**Built:**
- Express backend with Plaid API v29 integration (sandbox mode)
- SQLite database with `better-sqlite3`
- 5 screens: Dashboard, Plan, Accounts, Activity, Settings
- 4 payoff strategies: Avalanche, Snowball, Hybrid, Cash Flow with freed-minimum rollover
- Daily Plaid sync cron at 8am
- Dev seed data: 5 realistic credit card accounts, no Plaid credentials required
- Mobile-first PWA design, 480px max-width

**Decisions:**
- Single-user for now (user_id = 1 hardcoded) — multi-user deferred to Phase 2
- SQLite chosen for simplicity in early dev; migration to Supabase planned from day one
- Node.js stays (not Python) — backend language doesn't affect platform support, rewrite would cost weeks for zero user-facing benefit

---

### v1.1 — Payoff Strategies + Goals

**Built:**
- 4-strategy grid UI on Plan screen
- Lump-sum payment simulator (shows months saved + interest saved)
- Goals screen: debt-free date, per-card payoff, balance target goal types
- Required-payment calculator: binary search to find exact extra payment needed for any target date

---

### v1.2 — Sinking Funds

**Built:**
- Sinking funds manager in Settings — reserve monthly amounts for known future expenses
- Categories: car, home, medical, travel, education, holiday, tax, other
- Sinking fund total automatically subtracted from surplus in all calculations: dashboard, plan, lump-sum, required-payment
- Settings fixes: version number bump, category dropdown reset after adding, delete confirmation guard

**Why sinking funds matter:** Without them, the surplus is overstated and the payoff plan always slips. e.g. $1,200/yr car registration = $100/mo less available for debt.

---

### v1.3 — AI Spending Insights + Manual APR

**Built:**
- AI spending analysis card on Dashboard (not Plan — more visible there, where users land first)
- Sends 90-day transaction category breakdown + full debt profile to Claude (`claude-sonnet-4-6`)
- Returns exactly 3 numbered insights, cached in `user_insights` table
- Freemium gate: 10 free analyses/month tracked in `ai_usage` table; `is_pro` flag bypasses limit
- `GET /api/insights/latest` — returns cached insight + usage stats
- `POST /api/insights/generate` — checks limit, calls Claude, increments usage
- Manual APR inline edit on Accounts page — `PUT /api/plaid/accounts/:id/credit-details`
- Warning badge when APR or minimum payment is missing (Plaid sometimes omits these)

**Decisions:**
- AI costs accumulate to us (app owner via Anthropic API key); passed to users via freemium gate
- Stripe + auth deferred to Phase 2; manual Pro upgrade via SQL (`UPDATE users SET is_pro = true`) for now
- 10/month free tier — low enough to control costs, high enough to be useful for active users
- Insight kept on Dashboard so users see it without navigating to Plan

---

### v1.4 — Card Recommendation Engine *(pulled from second machine)*

**Built:**
- `cardProfiles.js` — 10 curated card profiles with `nameKeywords`, `centsPerPoint`, per-category `multipliers`
- `recommendationEngine.js` — `effectiveRate = multiplier × centsPerPoint`; 50% debt penalty for cards with active balances
- `GET /api/recommendations?category=dining&amount=50` — ranked results
- `GET /api/recommendations/categories` — category list with icons and `profilesLastUpdated` date
- Reward screen: category picker + ranked card list

**Decisions:**
- Cards with active debt ranked lower (`DEBT_PENALTY_FACTOR = 0.5`) to discourage points chasing while in debt — the math never favors rewards over 20%+ APR interest
- TPG (The Points Guy) valuations used for `centsPerPoint`; update quarterly
- `PROFILES_LAST_UPDATED` exposed in the API so the UI can show freshness

---

### v2.0 — PostgreSQL/Supabase Migration + GitHub Org

**Built:**
- Full database migration from SQLite (`better-sqlite3`) to PostgreSQL (`pg`)
- New `src/db/schema.sql`: BIGSERIAL, TIMESTAMPTZ, NUMERIC, ON CONFLICT DO NOTHING — Supabase-native
- `database.js` rewritten: `query(text, params)`, `queryOne(text, params)`, `withTransaction(fn)` helpers; all async
- All routes + `server.js` + `plaidService.js` converted from sync to async/await
- SQL params changed from `?`/`@name` to `$1,$2,...` throughout
- SSL configured: `rejectUnauthorized: false` when DATABASE_URL isn't localhost (Supabase requirement)
- `pg` aggregate functions return strings — added `parseFloat()` where needed (e.g. `SUM(amount)` in insights)
- `ROUND(SUM(amount), 2)` → `ROUND(SUM(amount)::numeric, 2)` for explicit PostgreSQL cast

**Infrastructure changes:**
- Project email created: `thezeroedapp@gmail.com` — use this for all service accounts (Supabase, Plaid, Anthropic, Stripe, GitHub)
- GitHub org created: `thezeroedapp-ai`
- Repo migrated from `venkatbade/Zeroed` → `https://github.com/thezeroedapp-ai/zeroed`
- Old personal remote revoked and replaced with org remote

**Decisions:**
- No SQLite fallback — all-in on Supabase; hybrid complexity not worth it
- Schema run manually in Supabase SQL Editor (not auto-applied at startup) — keeps startup simple and prevents accidental re-runs
- Still single-user (user_id = 1 hardcoded) — multi-user auth is Phase 2, needs Supabase Auth wired up first
- Separate project email keeps personal and product accounts cleanly separated for future team access

**What's next:**
1. Multi-user auth: Supabase Auth, JWT scoping, remove hardcoded user_id = 1

---

## 2026-05-20 (continued)

### v2.1 — Supabase Live + NUMERIC Fix

**Supabase connected and verified working.**

**Bug found and fixed:** pg returns all `NUMERIC` columns as JavaScript strings by default. This caused string concatenation instead of numeric addition everywhere (e.g. minimum payments were `"719" + "277"` = `"719277"` instead of `996`). Dashboard showed `$0` total debt and `-$719,274,129` surplus.

**Fix:** Added a global pg type parser in `database.js`:
```js
const { Pool, types } = require('pg');
types.setTypeParser(1700, parseFloat); // 1700 = pg OID for NUMERIC
```
This converts all NUMERIC fields to JS floats at the driver level — no per-query casting needed anywhere else.

**Infrastructure note:** Supabase direct connections use IPv6 by default. Standard home/office networks are IPv4. Use the **Session Pooler** connection string (not Direct) — works on IPv4 and is the right choice for a persistent Express server.

**Architecture:** GitHub = code only (`.env` gitignored). Supabase = live database connected at runtime via `DATABASE_URL`. New devs clone from GitHub, add `.env`, connect to shared Supabase.

---

## 2026-05-22

### v4.0 — Firebase Migration (Railway + Supabase → Firebase)

**Why:** Railway JWT secret corruption caused persistent 401 errors that couldn't be reproduced locally. Root cause was Railway corrupting the `SUPABASE_JWT_SECRET` env var, invalidating all existing tokens. Migrated to Firebase to eliminate the Railway dependency and consolidate to a single platform.

**What changed:**

- `server/db/database.js` — full rewrite. Replaced `pg` Pool with Firebase Admin SDK + Firestore. All user data in subcollections under `users/{uid}/`. `plaid_account_id` string = Firestore document ID (eliminates numeric-to-plaid mapping).
- `server/middleware/auth.js` — replaced `jsonwebtoken` + `SUPABASE_JWT_SECRET` with `admin.auth().verifyIdToken(token)`.
- `server/index.js` — new Cloud Functions entry: `exports.api = functions.https.onRequest(app)` + `exports.dailySync` scheduled function replaces node-cron in production.
- `server/server.js` — exports `app` for Cloud Functions; starts locally via `require.main === module` guard.
- All routes rewritten for Firestore: no SQL, no JOINs, subcollections, `req.user.uid` (string) throughout.
- `apps/web/src/lib/firebase.ts` — new Firebase client init.
- `apps/web/src/lib/api.ts` — `apiFetch` now attaches Firebase ID token (`auth.currentUser.getIdToken()`).
- `apps/web/src/context/AuthContext.tsx` — `onAuthStateChanged` replaces Supabase listener.
- `apps/web/src/pages/Login.tsx` + `Signup.tsx` — Firebase Auth SDK calls.
- `firebase.json` + `.firebaserc` + `firestore.rules` + `firestore.indexes.json` — new deploy config.
- Removed: `@supabase/supabase-js`, `pg`, `jsonwebtoken`, `DATABASE_URL`, `SUPABASE_*` env vars.
- Added: `firebase-admin`, `firebase-functions`, `firebase` (client SDK).

**Firestore schema decisions:**
- No `credit_details` subcollection — APR, minimum_payment etc. merged directly into account document on Plaid sync.
- `payoff_plans/{id}` uses embedded `items: [...]` array instead of a separate `plan_items` table.
- Timestamp serialization: `toObj()` helper converts Firestore Timestamp objects to ISO strings before JSON responses.

**Local dev:**
- `npm run dev` → Express on :3000 (reads `FIREBASE_SERVICE_ACCOUNT` from `.env`)
- `npm run dev:web` → Vite on :5173 (proxies `/api` to :3000)
- `FIREBASE_SERVICE_ACCOUNT` = full service account JSON on one line; Cloud Functions auto-initialize in production without it.

**Deploy:** `npm run deploy` = `npm run build:web && firebase deploy`

---

## 2026-05-21

### v3.2 — Monorepo Restructure + Responsive Web

**Built:**
- Monorepo directory structure: `server/` (Express), `apps/web/` (React), `packages/core/` (shared)
- `packages/core/index.ts` — shared `fmt()`, `fmtD()`, `ROUTES` constants; importable by any app in the monorepo
- Root `package.json` converted to npm workspaces: `apps/*`, `packages/*`
- `apps/web/vite.config.ts` — path alias `@zeroed/core → packages/core/index.ts`
- `apps/web/tsconfig.app.json` — matching `paths` entry so TypeScript resolves the alias
- `apps/web/src/components/SideNav.tsx` — left sidebar nav for tablet/desktop; same routes as BottomNav
- `apps/web/src/components/Layout.tsx` — shell wrapper: renders SideNav + BottomNav + page content
- `App.tsx` updated: `ProtectedRoute` wraps children in `Layout`; individual pages no longer import BottomNav
- Responsive CSS breakpoints in `index.css`:
  - Mobile (< 768px): bottom tab bar, 480px centered column (unchanged)
  - Tablet (768–1023px): 68px icon-only sidebar, bottom nav hidden, content full-width up to 860px
  - Desktop (≥ 1024px): 220px labeled sidebar, content up to 1000px, 4-column metrics grid

**Architecture:**
```
zeroed/
├── server/          ← Express API (was src/)
├── apps/web/        ← React + Vite (was client/)
├── packages/core/   ← shared TS (fmt, fmtD, ROUTES)
├── package.json     ← npm workspaces root
└── .env             ← root-level, loaded by server at startup
```

**Dev commands:**
- `npm run dev` — Express on :3000
- `npm run dev:web` — Vite on :5174 (proxies /api to :3000)
- `npm run build:web` — production build to `apps/web/dist`

---

### v3.1 — React + Vite Frontend Migration

**Built:**
- `client/` directory: Vite 5 + React 18 + TypeScript scaffold
- `client/src/index.css` — full design system ported from `style.css` (CSS variables, all component classes, auth page styles)
- `client/src/lib/supabase.ts` — lazy Supabase client initialization via `/api/config`
- `client/src/lib/api.ts` — `apiFetch()` (attaches JWT Bearer token), `fmt()`, `fmtD()` helpers
- `client/src/context/AuthContext.tsx` — React Context: session state, loading flag, `signOut()`; wraps entire app
- `client/src/components/BottomNav.tsx` — `NavLink`-based nav with active state via React Router
- `client/src/App.tsx` — React Router v6; `ProtectedRoute` + `PublicRoute` wrappers; all 9 routes
- 9 page components: `Login`, `Signup`, `Dashboard`, `Accounts`, `Plan`, `Goals`, `Activity`, `Recommend`, `Settings`

**Architecture:**
- Dev: Vite on `localhost:5174` proxies `/api/*` to Express on `localhost:3000`
- Production: `npm run build` outputs to `client/dist`; Express serves it
- Auth: same Supabase JWT pattern, now managed by React Context instead of global `auth.js`
- CSS: global CSS classes (no CSS modules) — same class names as the old HTML, zero visual regression

**Decisions:**
- TypeScript chosen for type safety and autocomplete as complexity grows
- Global CSS retained (not CSS modules) to keep migration 1:1 and avoid renames across all classes
- `client/` subfolder keeps Express backend source (`src/`) cleanly separated

---

### v3.0 — Multi-user Auth (Supabase Auth + Google OAuth)

**Built:**
- `src/middleware/auth.js` — JWT verification using `jsonwebtoken` + `SUPABASE_JWT_SECRET`; looks up user by `auth_id`; auto-creates profile on first OAuth login
- `auth_id TEXT UNIQUE` column added to `public.users` via `ALTER TABLE` + SQL migration
- DB trigger `on_auth_user_created` — fires on every `auth.users` INSERT, auto-creates `public.users` profile row with name from metadata
- `GET /api/config` — public endpoint serving `SUPABASE_URL` + `SUPABASE_ANON_KEY` to the frontend
- `app.use('/api', authenticate)` — all API routes now require a valid Supabase JWT
- `src/public/auth.js` — shared frontend helper: `getSupabase()`, `getSession()`, `requireAuth()`, `apiFetch()`, `signOut()`
- `login.html` + `signup.html` — email/password + Google OAuth; match existing mobile-first design
- All 7 pages: Supabase CDN + auth.js added to head; `fetch(` → `apiFetch(`; `requireAuth()` guard at top of init
- All routes: `user_id = 1` → `req.user.id`; account queries filter by `pi.user_id = $N`
- Dev seed removed from startup — real users create their own data via signup

**Decisions:**
- `auth_id TEXT` (not UUID FK) keeps schema simple, avoids cross-schema FK complexity with `auth.users`
- Profile creation in both trigger AND middleware fallback — handles OAuth timing edge cases
- Only `/api/config` and `/api/health` are public; everything else requires JWT
- New Supabase "Publishable key" UI: use Legacy anon tab for `eyJ...` format needed by `@supabase/supabase-js` v2

**What's next:**
- Enable Google OAuth in Supabase Auth settings + configure Google Cloud Console credentials
- Stripe freemium — Pro gate for unlimited AI; `is_pro` already in schema
- Plaid production credentials

---
