
  # NETS Lifestyle Banking Prototype

  A mobile banking prototype built around NETS: payments and bill splitting,
  savings goals, an XP rewards store, and NETS Hangouts — all on a browser-local
  SQLite database, with no backend. The original design bundle is available at
  https://www.figma.com/design/UPb1XE6jPq6Xrh8UccxeFr/Mobile-Banking-App-Prototype.

  **[CHANGELOG.md](CHANGELOG.md) records every change made to the prototype,
  newest first**, along with the limitations that are deliberate rather than
  unfinished.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  Before a submission or demo, run:

  - `npm run typecheck` for strict TypeScript validation.
  - `npm test` for regression tests covering split rounding, transaction
    classification, and Hangout vote ties.
  - `npm run build` for the production bundle.
  - `npm run test:e2e` for the Playwright end-to-end suite, which serves a
    production preview build rather than the dev server.

  ## Data storage (browser SQLite database)

  This version stores each user's records in a real SQLite database that runs
  in the browser (via sql.js / WebAssembly) and saves to IndexedDB, so data
  survives page refreshes. It replaces the old localStorage approach.

  - Each user keeps their own records: every table has a user_id (reminders
    use from_user_id / to_user_id), and every read filters by the logged-in
    user.
  - The database engine lives in `src/app/utils/db.ts`. The storage files
    (userStorage, transactionStorage, reminderStorage, notificationStorage)
    keep the exact same function names as before, so the pages are unchanged.
  - `public/sql-wasm.wasm` is the SQLite engine — Vite serves it at
    `/sql-wasm.wasm`, which is what db.ts loads. Don't delete it.
  - The database loads once in `src/main.tsx` before the app renders.

  To wipe the whole database, open DevTools console and run:
  `indexedDB.deleteDatabase('nets-db')` then refresh.

  Note: the database lives in one browser on one device — different browsers
  or devices each get their own copy (there's no server syncing them). That's
  expected for a browser-only setup.

  ## Environment variables (NETS Sandbox)

  Copy `.env.example` to `.env` and fill in your NETS Sandbox credentials
  before running `npm run dev`. These used to be hardcoded in
  `src/app/utils/netsQr.ts`; they're now read from `import.meta.env` so the
  key isn't committed to source control. `.env` is git-ignored.

  ## Recent hardening changes

  - Moved the NETS API key/project ID out of source code and into `.env`
    (see above), with `.env.example` as a template and `.gitignore` added.
  - Fixed a crash: `ReminderTrackingPage.tsx` referenced the `Eye` icon from
    `lucide-react` without importing it — this threw whenever a reminder was
    scheduled for later. Now imported correctly.
  - Added `ErrorBoundary` (`src/app/components/ErrorBoundary.tsx`) around
    every route so an unexpected error shows a recoverable "Back to Home"
    screen instead of a blank white page.
  - Routes are now code-split with `React.lazy` (see `src/app/App.tsx`)
    instead of one large upfront bundle — cuts the biggest JS chunk from
    ~588 KB to ~302 KB and removes the Vite build-size warning.
  - Added `src/app/utils/useRequiredState.ts`, a reusable guard hook for
    pages that expect data via router `location.state`, for future pages
    that don't already have their own fallback/redirect logic.
  - Added a "simulated authorization" step (`src/app/utils/securePayment.ts`)
    to the peer-to-peer reminder repayment flow in
    `PaymentAuthorizationPage.tsx`. Peer repayment is a local DB write with
    no real payment rail behind it — this makes that explicit (a generated
    `SIM-AUTH-XXXXXXXX` reference, clearly labeled "simulated" in the UI on
    both the authorization screen and `PaymentCompletePage.tsx`) instead of
    silently implying real bank-grade security. The one flow that *does* hit
    a real payment system is the NETS Sandbox QR flow in `netsQr.ts` — the
    code comments call out that distinction directly.

## Integrated NETS lifestyle prototype

The app now presents the team features as one connected customer journey while keeping
individual feature ownership clear:

- **NETS Hangouts (`/hangouts`) - Suvanesh:** discover activities, shortlist two or three
  options, invite other demo users, vote, confirm the group choice, and hand the finished
  outing, including its participant list, activity, reference and estimated group total, to
  the existing NETS payment and bill-splitting flow. Ties require an organiser vote and
  only invited participants can vote. This replaces the former
  monthly-discount catalogue so it no longer duplicates Hadi's rewards concept.
- **NETS XP Rewards (`/rewards`) - Hadi:** earn XP automatically from the shared transaction
  table, receive a 2x heartland multiplier, progress through loyalty tiers, redeem cashback
  or vouchers, open voucher codes in a wallet, and inspect a traceable XP history. Instant
  wallet cashback writes back to the same transaction ledger used by Home.
- **Admin Portal (`/admin`):** management users can inspect live users and transactions,
  manage merchants, and maintain partner rewards that appear in the XP Rewards Store.
- **Savings goals:** money put into a goal leaves the spendable balance as a Goal
  Contribution transaction and comes back as a Goal Withdrawal, so the wallet balance and
  the goals always agree. Neither counts as merchant spending.
- **Location awareness (`src/app/utils/geo.ts`):** hangout ideas and reward outlets are
  ranked and filtered by great-circle distance from the customer's area. Alex Chen starts
  in Orchard; the area can be changed in-app from either surface, and both follow it.
  There is no device location permission — swapping `getUserArea` for the browser
  Geolocation API is the only change a production build needs.
- **Shared persistence:** hangout shortlists, plans, votes, reward redemptions, users,
  payments, reminders, budgets and admin data all persist in the browser sql.js database.
- **Ledger integrity:** purchases, income, top-ups, transfers, cashback and refunds are
  classified separately. This prevents repayments from earning XP or appearing as merchant
  spending, and prevents top-ups/cashback from being presented as salary income.
- **Payment safety:** each completed split has a stable payment ID, so revisiting the success
  screen cannot create duplicate transactions, reminders or notifications. Equal splits use
  integer cents and assign any rounding cent to the payer.
- **Honest analytics:** the dashboard uses transparent rules and wallet cash-flow labels;
  Wrapped compares against the user's own recent history instead of an unsupported population
  average.

The main navigation is now **Home -> Pay -> Hangouts -> Rewards -> Profile**. Reminders
remain available from Home and the notification bell.

Run with `npm install` then `npm run dev`.
