# invest_track — Claude Code Guide

## Project Overview

Personal finance tracker for Israeli users. React SPA with Hebrew RTL UI, Firebase Firestore for persistence, localStorage fallback. Deployed on Vercel via GitHub (`aviad1aviad/invest_track`).

## Commands

```bash
npm start        # dev server (http://localhost:3000)
npm run build    # production build — MUST pass before committing
```

CI (`react-scripts build` with `CI=true`) treats ESLint warnings as errors. Always run `npm run build` before committing.

## Architecture

**State**: Single `useReducer` in `AppContext` (`src/context/AppContext.js`). All pages consume `const { state, dispatch } = useApp()`. Persisted to Firestore `userData/main` + localStorage on every state change.

**`sanitize(val)`** — strips `undefined` fields before writing to Firestore. Any new fields added to state objects must be defined (not `undefined`) or Firestore writes will throw.

**Routing**: Tab-based in `App.js` (no React Router pages). `TABS` array + `renderPage()` switch.

## Pages / Key Files

| File | Purpose |
|------|---------|
| `src/App.js` | Tab nav, DataControls (import/export JSON + Excel) |
| `src/context/AppContext.js` | Global state, reducers, Firestore sync, auto-snapshot logic |
| `src/pages/Dashboard.js` | KPIs, historical LineChart, global allocation pie, InsightsCard |
| `src/pages/Expenses.js` | Fixed monthly expenses, category pie |
| `src/pages/Incomes.js` | Income sources, category pie |
| `src/pages/Savings.js` | Pension / hishtalmut / gemel / keren-hishtalmut |
| `src/pages/Investments.js` | Securities, provident funds, USD lots |
| `src/pages/CreditTracker.js` | Credit card Excel import + transaction management |
| `src/utils/insights.js` | Domain-specific insight generators (expenses, savings, investments, dashboard) |
| `src/utils/priceService.js` | Live Israeli security prices via API |
| `src/utils/exchangeRate.js` | Live USD/ILS rate |
| `src/firebase.js` | Firebase init (Firestore only, no Auth) |

## CSS Conventions

- `src/pages/Page.css` — shared across all pages: table, card, filter bar, pie/legend layout classes
- Each page has its own `.css` file for page-specific styles
- RTL everywhere (`dir="rtl"` on root `<div class="app">`)
- Responsive breakpoints: 900px (tablet), 700px (mobile), 480px (small mobile)
- Color palette: primary `#4361ee`, warn `#f7932a`, danger `#c0392b`, success `#1a7a4a`

## State Shape

```js
{
  expenses: [],          // { id, domain, name, amount, paymentMethod, paymentEntity }
  incomes: [],           // { id, domain, name, amount }
  savings: [],           // { id, name, type, managingCompany, fundNumber, currentAmount,
                         //   totalDeposits, depositFee, accumulationFee, lastUpdated }
  investments: [],       // { id, name, type, investmentHouse, securityNumber, currency,
                         //   entryType, unitCount, unitPriceAgorot, currentValue,
                         //   currentValueUSD, currentExchangeRate, totalDeposits,
                         //   accumulationFee, lots[], lastUpdated }
  snapshots: [],         // { date, totalSavings, totalInvestments, grandTotal,
                         //   savingsDetail[], investmentsDetail[] }
  creditTransactions: [] // { id, date, billingDate, description, amount, branch,
                         //   category, manual, cardName }
}
```

## CreditTracker — Excel Import

Supports Israeli credit card Excel exports (כאל, ויזה, מסטרקארד, etc.). Two-step import:
1. **Column mapping** — auto-detects columns from header row, user can override with dropdowns, 5-row highlighted preview
2. **Classify & review** — auto-classifies by RULES (keyword→category), unclassified rows shown in separate tab

Key functions in `CreditTracker.js`:
- `detectColumns(header)` — maps header cells to `{ dateCol, billingDateCol, descCol, amountCol, branchCol }`
- `parseWithCols(allRows, headerIdx, cols)` — extracts transactions from raw rows
- `parseIsraeliDate(val)` — handles Excel serial numbers and DD/MM/YYYY strings
- `autoClassify(description)` — keyword-based category matching

## ESLint Gotchas

- **No unused imports** — removing a recharts import you don't use (`Legend`, etc.) is required
- **Regex escapes** — use `[-/.]` not `[\/\-\.]`
- **`useMemo` deps** — derived arrays used in dependency arrays must be stabilized with `useMemo`
- **No unused state vars** — if you add `useState` pairs, use both or remove

## Insights (`src/utils/insights.js`)

Four exported functions: `getExpenseInsights`, `getSavingsInsights`, `getInvestmentInsights`, `getDashboardInsights`. Each returns `[{ type, message, level }]` where `level` is `'info' | 'warn' | 'danger'`.

Israeli benchmark thresholds used:
- Savings accumulation fee: warn >0.5%, danger >1%
- Deposit fee: warn >3%, danger >5%
- Savings rate (income vs expenses): good ≥20%, warn 10–19%, danger <10%
- Stale savings data: >6 months; stale investment prices: >30 days
- Portfolio concentration: warn >50% single asset, danger >75%

## Changelog

### 2026-06-25 (session 2)
- **CreditTracker: Diners/Mastercard Excel fix** — `detectColumns` now strips `\r\n` from header cells (Mizrahi bank exports use multi-line cell headers); `loadRawFile` extracts global billing date from pre-header row `"עסקאות לחיוב ב-DD/MM/YYYY"`; `parseWithCols` accepts `globalBillingDate` fallback; UI shows green notice when billing date auto-detected; preview table renders Excel serial numbers as real dates
- **CLAUDE.md** — created this file (session 1)
- **CreditTracker: branch/domain column** — `detectColumns` now returns `branchCol`; stored on each transaction; shown in table and mobile cards
- **CreditTracker: billing date vs transaction date** — separate `billingDate` field; column mapping has optional "תאריך חיוב" selector; table shows billing date as primary with transaction date as small secondary when different
- **CLAUDE.md** — created this file

### Prior sessions
- **CreditTracker** — new 💳 tab: Excel import (2-step: column mapping → classify/review), auto-classify by Hebrew keywords, monthly bar chart, category pie, transactions table, bulk select/delete
- **Dashboard** — removed sub-pies; kept KPIs + historical LineChart + global allocation pie
- **Expenses / Incomes** — added category pie to each page
- **insights.js** — full rewrite: fixed `'תיק השקעות'` → `'חיסכון'` domain bug; added stale-price, same-company, concentration, savings-rate insights

## Deployment

Push to `master` → Vercel auto-deploys. Build must be clean (`npm run build` exits 0) for deployment to succeed.
