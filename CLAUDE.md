# Zeroed — Claude Code Instructions

Read this file in full before writing any code. It defines the tech stack, file ownership, change sequences, and hard rules that have come from real bugs we've already fixed. Violating these rules has caused multi-session debugging spirals.

---

## Project Context

**App:** Zeroed — high-trust fintech for debt payoff, net worth tracking, and financial insights.  
**Role:** Expert Frontend Architect specializing in financial interfaces (Monarch Money / Origin / Copilot standard).  
**Live URL:** https://zeroed-3331d.web.app  
**Firebase project:** `zeroed-3331d`

---

## Tech Stack (Strict — No Substitutions)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Strict mode, no `any` types |
| Routing | React Router v7 | `useNavigate`, `useSearchParams`, `Link` |
| Styling | **Tailwind CSS v4 ONLY** | `@tailwindcss/vite` plugin. CSS-first `@theme inline`. No other CSS frameworks. |
| UI primitives | **shadcn/ui (Radix)** | Card, Button, Badge, Input, Select, Progress, Sheet, Tabs, ChartContainer — always use these for interactive elements |
| Charts | Recharts via `ChartContainer` | `ChartConfig` + `ChartTooltipContent` for consistent tooltips |
| Toasts | Sonner (`@/components/ui/sonner`) | Uses project's `ThemeContext`, not `next-themes` |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable | |
| Auth | Firebase Authentication | Email/password + Google OAuth |
| Database | Firestore | Firebase Admin SDK, server-side only. Never access Firestore from the frontend. |
| API | Express.js → Firebase Cloud Functions | Node 22, 2nd Gen |
| Bank data | Plaid API v29 | Transactions + Liabilities + all account types |
| AI | Anthropic `claude-sonnet-4-6` | 10/month free gate, `is_pro` flag unlocks unlimited |
| Monorepo | npm workspaces | `apps/web`, `server`, `packages/core` |

**Do not introduce:** Mantine, MUI, Ant Design, Chakra, Emotion, styled-components, any CSS-in-JS, `next-themes`, or any other CSS framework alongside Tailwind.

---

## File Map — What Each File Does and When to Touch It

### CSS & Theme (`apps/web/src/index.css`)

**What it does:** The one and only stylesheet. Imports Tailwind v4, defines the entire oklch color palette via CSS custom properties, sets base typography, defines the `.skeleton`, `.spinner`, `.gradient-text`, `.app-main`, `.widget-grid`, `.auth-*` utility classes, and the `html.dark` override block.

**Touch when:** Changing colors, adding a new CSS custom property (`--color-*` or semantic token), adjusting sidebar/grid breakpoints, or adding a global animation.

**Do NOT:** Add `@layer` blocks without understanding the cascade order. Never write unlayered `* { margin: 0; padding: 0 }` — see CSS Architecture Rules below.

---

### Design Tokens (`apps/web/src/index.css` `:root` and `html.dark` blocks)

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--background` | cream oklch | deep charcoal | Page background |
| `--foreground` | warm near-black | warm off-white | Body text |
| `--card` | white | lighter charcoal | Card surfaces |
| `--surface-2` | deeper cream | mid charcoal | Inputs, nested backgrounds |
| `--nav-bg` | white | elevated charcoal | Sidebar, bottom nav |
| `--primary` | charcoal | burnt orange | Buttons, rings, CTAs |
| `--violet-light` | burnt orange | light burnt orange | Accent text, data highlights |
| `--violet-dim` | burnt orange / 12% | burnt orange / 16% | Accent background tints |
| `--green` / `--green-dim` | dark teal | bright teal | Positive values, assets |
| `--red` / `--red-dim` | dark red | bright red | **URGENT ALERTS ONLY** |
| `--amber` / `--amber-dim` | dark amber | bright amber | Warnings, high APR |
| `--blue` / `--blue-dim` | dark blue | bright blue | Informational |
| `--chart-1..5` | warm palette | bright palette | Chart series colors |
| `--muted-foreground` | warm gray | cool gray | Secondary text, labels |
| `--border` | black / 9% | white / 10% | Dividers, card edges |

---

### Entry Point (`apps/web/src/main.tsx`)

**What it does:** Mounts the React app. Imports `./index.css` (and nothing else CSS-related).

**Touch when:** Adding a top-level provider that must wrap everything. That's it.

**Do NOT:** Import any third-party CSS files here. The CSS import order disaster (Mantine + Tailwind both running) was caused by this file importing multiple style systems.

---

### App Shell (`apps/web/src/App.tsx`)

**What it does:** Defines all routes, wraps them in `ThemeProvider` → `AuthProvider` → `BrowserRouter`. Mounts `<Toaster />` (Sonner) outside routes so toasts work globally.

**Touch when:** Adding a new route, adding a new top-level context provider, or changing auth guard logic.

---

### Auth Context (`apps/web/src/context/AuthContext.tsx`)

**What it does:** Listens to `onAuthStateChanged`, fetches the user profile from `/api/user` once on login, provides `user`, `loading`, `signOut`.

**Touch when:** Changing what the user object contains, adding OAuth providers.

---

### Theme Context (`apps/web/src/context/ThemeContext.tsx`)

**What it does:** Reads/writes `localStorage` key `zeroed-theme`. Toggles `html.dark` class. Provides `theme` (`'light' | 'dark'`) and `toggleTheme`.

**Touch when:** Adding more theme options. Note: the inline script in `index.html` applies the saved theme before first paint — if you change the localStorage key here, update it there too.

---

### API Utility (`apps/web/src/lib/api.ts`)

**What it does:** `apiFetch(path, options)` attaches the Firebase ID token to every request. `fmt()` formats large dollar amounts. `fmtD()` formats dollar amounts with cents.

**Touch when:** Changing the API base URL, changing token attachment logic, or adding new shared formatters.

**Rule:** Never call `fetch()` directly in a page component. Always use `apiFetch`.

---

### Institution Logos (`apps/web/src/lib/institution-logos.ts`)

**What it does:** Pure runtime mapping from institution name → `{domain, brandColor}`. `getInstitutionDomain(name)` and `getInstitutionBrandColor(name)` do lowercase substring matching against 70+ institutions. `logoUrl(domain)` builds a logo.dev URL using `import.meta.env.VITE_LOGO_DEV_TOKEN`; returns `null` when the token is absent (safe — callers fall back to `AvatarCircle`).

**Touch when:** Adding a new institution that isn't resolving, or fixing an incorrect brand color.

**Rules:**
- All keywords in `INSTITUTION_MAP` must be lowercase — the matching code lowercases the input but not the keywords
- Add `VITE_LOGO_DEV_TOKEN=pk_...` to `apps/web/.env.local` (publishable key, safe for frontend, never commit the secret key)
- Never call `logoUrl` with a null domain; always guard: `const url = domain ? logoUrl(domain) : null`

---

### Layout & Nav (`apps/web/src/components/`)

| File | What it does |
|---|---|
| `Layout.tsx` | Wraps `<SideNav>` + `<main className="app-main">` + `<BottomNav>`. The `app-main` class provides the sidebar margin offset. |
| `SideNav.tsx` | Desktop sidebar — 5 nav tabs, active state via `useLocation`, theme toggle button at bottom. |
| `BottomNav.tsx` | Mobile-only bottom nav — same 5 tabs, hidden on `md+`. |
| `SubNav.tsx` | Reusable horizontal pill tab bar — used in Accounts, Plan, Spending. Pass `tabs`, `active`, `onChange`. |

**Touch when:** Adding a new top-level route (add to both SideNav and BottomNav). When changing SubNav, verify all 3 pages that use it.

---

### Pages

| File | Tab | Subtabs | Key state |
|---|---|---|---|
| `Dashboard.tsx` | Home | None (uses Tabs component for col visibility on mobile) | `data`, `netWorthHistory`, `spendingData`, `goals`, `insightPayload` |
| `Plan.tsx` | Plan | Strategy / Goals / AI Insights | URL-based via `useSearchParams` |
| `Accounts.tsx` | Accounts | Accounts / Budget / Rewards | URL-based via `useSearchParams` |
| `Spending.tsx` | Spending | Transactions / Trends / Recurring | URL-based via `useSearchParams` |
| `Settings.tsx` | Settings | None | Plaid items, income form, sinking funds |

**Change sequence for a new page feature:**
1. Define the TypeScript interface for new API data
2. Add/modify the server route and database function
3. Update `apiFetch` call in the page
4. Update the UI — always use shadcn/ui primitives, never raw `<div>` for interactive elements

---

### shadcn/ui Components (`apps/web/src/components/ui/`)

These are local copies — not node_modules. You can edit them.

| File | Status | Notes |
|---|---|---|
| `card.tsx` | Active | `CardTitle` renders as `<div>`, not `<h2>` — intentional |
| `button.tsx` | Active | |
| `badge.tsx` | Active | |
| `input.tsx` | Active | |
| `select.tsx` | Active | Uses Radix Select primitive |
| `progress.tsx` | Active | Use `[&>div]:bg-*` to color the fill |
| `sheet.tsx` | Active | Radix Dialog as slide-out panel. Side variants via `cva`. |
| `tabs.tsx` | Active | |
| `chart.tsx` | Active | ChartContainer + ChartTooltip + ChartTooltipContent |
| `sonner.tsx` | Active | Uses project ThemeContext, not next-themes |
| `tooltip.tsx` | Stub | `TooltipContent` returns null — non-functional but won't break builds |
| `avatar-circle.tsx` | Active | Colored initial avatar — fallback when logo unavailable |
| `institution-logo.tsx` | Active | Circular logo via logo.dev; falls back to `AvatarCircle` with brand color. Used in Accounts, Settings, anywhere an institution name is displayed. |
| `credit-card-chip.tsx` | Active | CSS-only mini credit card (1.586:1 ratio) — brand gradient, decorative EMV chip, white-filtered logo.dev icon. Used on all credit account rows and Dashboard priority card. |

---

### Server Files

| File | What it does | Touch when |
|---|---|---|
| `server/index.js` | Cloud Functions entry — `exports.api` (Express) + `exports.dailySync` (scheduled Plaid sync) | Adding a new scheduled function |
| `server/server.js` | Express app — mounts all routers, contains inline routes for `/api/dashboard`, `/api/net-worth-history`, `/api/dashboard-config` | Changing dashboard response shape, adding new inline routes |
| `server/db/database.js` | All Firestore reads/writes. Every data operation goes through here. | Adding new data models, changing collection structure |
| `server/middleware/auth.js` | `verifyIdToken` middleware — attaches `req.user` to every route | Changing auth logic |
| `server/routes/*.js` | Feature-specific route handlers | Adding endpoints to an existing feature domain |
| `server/services/payoffEngine.js` | Pure math — no I/O. 4 strategies, simulate, lump-sum, required-payment. | Changing payoff logic |
| `server/services/plaidService.js` | Plaid API integration — sync accounts + cursor-based transaction sync | Changing Plaid sync behavior |
| `server/services/claudeService.js` | Anthropic API calls | Changing AI prompt or model |

**Change sequence for a new API endpoint:**
1. `server/db/database.js` — add the Firestore read/write function
2. `server/routes/[domain].js` — add the Express route (or `server/server.js` for dashboard-level data)
3. Update the TypeScript interface in the frontend page
4. Add the `apiFetch` call in the page component
5. Update the UI

---

## CSS Architecture Rules (CRITICAL — Learned from a Major Bug)

### Rule 1: Never write unlayered universal resets

**NEVER** write this:
```css
*, *::before, *::after { margin: 0; padding: 0; }
```
or any `* { ... }` rule outside of a `@layer` block.

**Why this is catastrophic in Tailwind v4:**  
Tailwind v4 emits all utilities (`pt-6`, `gap-4`, `p-6`, etc.) inside `@layer utilities`. CSS Cascade Level 5 specifies that **unlayered rules outrank any `@layer` block regardless of specificity**. So `* { padding: 0 }` (unlayered, specificity 0,0,0) beats `.pt-6 { padding-top: 1.5rem }` (layered in `@layer utilities`, specificity 0,1,0). Every padding, margin, and gap utility in the **entire app** gets silently zeroed. This was the root cause of all spacing issues in Zeroed that took multiple sessions to track down.

**The fix:** Tailwind's `@import "tailwindcss"` already provides the standard box-sizing/margin/padding reset inside `@layer base`. Never duplicate it.

**If a custom reset is ever needed:** Wrap it in `@layer base { ... }` so utilities can override it normally.

### Rule 2: Valid places for unlayered CSS in index.css

Only these are acceptable outside of any `@layer`:
- `:root { }` and `html.dark { }` — CSS custom properties only
- `@theme inline { }` — Tailwind v4 theme mapping
- `@custom-variant dark (...)` — Tailwind v4 dark variant definition
- `@import` statements

### Rule 3: Dark mode variant must use `:where()`

The `@custom-variant dark` line must be:
```css
@custom-variant dark (&:where(.dark, .dark *));
```
**Not** `:is()`. Using `:is()` adds non-zero specificity to dark overrides, which can prevent light-mode utilities from overriding dark defaults. `:where()` is zero-specificity, so `dark:bg-card` and `bg-background` compete purely on layer order (correct behavior).

### Rule 4: No CSS class-based overrides on overflow for sticky positioning

`position: sticky` is broken by any ancestor with `overflow` set to anything other than `visible`. Never add `overflow-x-hidden` or `overflow-hidden` to the root wrapper of a page that has sticky headers.

### Rule 5: Use `min-h-dvh` not `min-h-screen`

`100vh` does not account for the browser chrome on mobile Safari. Use `min-h-dvh` everywhere.

---

## UI/UX Design Rules (High-Trust Finance)

### Color Psychology

1. **Never use pure black (`#000000`).** Use the oklch design tokens — `bg-background`, `bg-card`, `text-foreground`, etc.
2. **Never color debt balances or liabilities red.** `text-red` / `text-destructive` is reserved **exclusively** for urgent alerts: "Payment Overdue", "Action Required", utilization ≥ 90%, due date ≤ 7 days. Using red for debt amounts trains users to feel panic about normal financial data.
3. **Green is for improvement, not assets.** Use `text-green` for: positive net worth, positive delta, on-track goals, surplus. Do not use it generically for "assets" as a category label (use `text-foreground` there).
4. Use `text-foreground` for primary numbers, `text-muted-foreground` for labels and secondary context.

### Spacing & Padding

- shadcn `Card` inner padding: always `p-6` (24px). Never `p-3` or `p-4` inside cards — it looks cramped.
- Page horizontal padding: `px-6 md:px-10 lg:px-12`
- Page max width for content: `max-w-[1600px]` on Dashboard, `max-w-3xl` on single-column pages
- Section gaps: `space-y-6` minimum, `gap-6` on grids

### Typography Hierarchy

- Page title: `text-[22px] font-bold` or `text-2xl font-bold`
- Section/card title: `text-sm font-semibold` — this is the standard `CardTitle` size
- Section label (ALL CAPS): `text-[10px] font-bold uppercase tracking-widest text-muted-foreground` — use sparingly
- Body: default (`text-sm` or `text-base`)
- Micro labels/badges: `text-[11px]` or `text-xs`
- Currency hero numbers: `text-4xl font-black` or `text-5xl font-black tracking-tight tabular-nums`

### Data Formatting

- **All currency** via `fmt()` (large) or `fmtD()` (with cents) from `lib/api.ts`
- **Never** use raw JavaScript arithmetic (`+`, `-`, `*`, `/`) on financial values — floating point
- **Tabular numbers** on all currency and percentage displays: `tabular` class (`font-variant-numeric: tabular-nums`)

### Interactive Patterns

- Clickable cards: add `cursor-pointer group` to the `Card`. Use `group-hover:text-violet-light` on the arrow icon.
- Sheet drill-downs: use `Sheet` + `SheetContent` from `@/components/ui/sheet` — never modal dialogs for contextual detail
- Navigation from charts: use `useNavigate` from `react-router-dom` in the card's `onClick`. Do not open a sheet just to show a "View in Accounts →" link.
- Inline confirmation (delete/remove): two-click pattern — first click sets a `confirmId` state, shows "Remove? Yes / No" inline. Never `window.confirm()` or `window.alert()`.

---

## Component Architecture Rules

1. **Strictly typed:** Every component's props must have a TypeScript interface. No implicit `any`. No `(e: any)` event handlers — cast explicitly: `(data: unknown) => { const p = (data as SomeType | null)?.field; }`.
2. **shadcn/ui for all interactive elements:** Buttons, inputs, selects, dialogs, tooltips, progress bars — always use the shadcn primitive. Never a raw `<button>` or `<input>` for user-facing UI (raw elements are fine for non-interactive containers).
3. **No premature abstraction:** Three similar cards is not a reason to create a `<StatCard>` component. Build the abstraction when a fourth instance appears and the three are already proven stable.
4. **Page state machines:** Each page uses a `state: 'loading' | 'error' | 'content'` pattern. Always render all three states — never show an empty card while loading.
5. **`cn()` for conditional classes:** Always use `cn(baseClasses, conditionalClasses)` from `@/lib/utils`. Never string template literals for Tailwind classes — `twMerge` won't deduplicate them.

---

## Sequence of Changes by Feature Type

### Adding a new UI widget to the Dashboard
1. Define the data type interface (TypeScript)
2. Add the API call to the `load()` function in `Dashboard.tsx` (parallel with `Promise.all`)
3. Add the server route in `server/server.js` or `server/routes/`
4. Add the Firestore read in `server/db/database.js`
5. Add the widget card JSX in the appropriate column
6. Test loading, error, and empty states

### Adding a new page/tab
1. Create the page file in `apps/web/src/pages/`
2. Add the route to `App.tsx`
3. Add nav item to both `SideNav.tsx` and `BottomNav.tsx`
4. If it has subtabs, use `useSearchParams` for URL-based tab state (not `useState`) — this enables direct links and back-button behavior

### Changing the color palette
1. Update `:root` and `html.dark` blocks in `index.css`
2. Update `@theme inline` if you're adding a new `--color-*` mapping
3. Do NOT change hardcoded oklch values in page components — they should always reference CSS variables

### Adding a new Firestore collection
1. `server/db/database.js` — add read/write functions
2. `server/routes/[domain].js` — add Express routes
3. `firestore.rules` — if new collection needs user-scoped read access (currently all deny-all, bypassed by Admin SDK)
4. `firestore.indexes.json` — add composite indexes if querying by multiple fields
5. Frontend TypeScript interface + `apiFetch` call

### Deploying
```bash
npm run deploy
# equivalent to: npm run build:web && firebase deploy
# deploys: Hosting (dist/), Functions (server/), Firestore rules + indexes
```

---

## Common Mistakes to Avoid (Learned from Real Bugs)

| Mistake | What breaks | Fix |
|---|---|---|
| Unlayered `* { padding: 0; margin: 0; }` in index.css | All Tailwind padding/margin/gap utilities silently zeroed throughout the app | Delete it — Tailwind preflight handles this inside `@layer base` |
| `overflow-x-hidden` on the root page wrapper | `position: sticky` stops working — headers scroll away | Remove `overflow-x-hidden`; if horizontal overflow is a problem, fix the overflowing element directly |
| `min-h-screen` instead of `min-h-dvh` | Layout breaks on mobile Safari — browser chrome overlaps content | Always use `min-h-dvh` |
| `@custom-variant dark (&:is(.dark *))` | Dark mode overrides gain specificity, fighting light-mode utilities | Use `&:where(.dark, .dark *)` — zero specificity |
| Importing third-party CSS (Mantine, etc.) before `index.css` | CSS reset fires twice; unlayered rules from the foreign framework override Tailwind utilities | Only `./index.css` in `main.tsx` — no other style imports |
| Using `window.confirm()` or `window.alert()` | Breaks in some environments, never matches app design | Two-click inline confirmation pattern with `confirmId` state |
| `apiFetch` with method GET and `Content-Type: application/json` | Some servers reject GET with Content-Type header | `apiFetch` strips Content-Type on GET — don't override it |
| Raw arithmetic on currency values | Floating-point errors on money (e.g., `$0.1 + $0.2 = $0.30000000000000004`) | Use `fmt()` / `fmtD()` for display; for calculations use integer cents or the existing engine |
| Accessing Firestore from the frontend | Firebase client SDK exposes raw Firestore access, bypasses server-side validation | All data access goes through the Express API — no direct `firestore()` calls in the frontend |
