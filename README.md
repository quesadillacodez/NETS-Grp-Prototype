
  # NETS Pay Together

  This is a code bundle for Mobile Banking App Prototype. The original project is available at https://www.figma.com/design/UPb1XE6jPq6Xrh8UccxeFr/Mobile-Banking-App-Prototype.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  The development command starts one Node process for both the Vite app and the
  secure `/api` routes. Demo PINs are hashed into the ignored runtime store on
  first start; the browser never receives credential hashes or session tokens.

  Before a submission or demo, run:

  - `npm run typecheck` for strict TypeScript validation.
  - `npm test` for regression tests covering split rounding, transaction
    classification, and Hangout vote ties.
  - `npm run build` for the production bundle.

  ## Secure server and synchronized data

  Authentication, login throttling, account lockout, HttpOnly sessions, PIN
  changes and recovery challenges are handled by `server/index.mjs`. Recovery
  codes expire after five minutes and are stored only as keyed hashes. Local
  development can return a clearly labelled test OTP; production requires an
  `OTP_WEBHOOK_URL` and never exposes the code in the browser.

  App records use SQLite in the browser for fast local interaction and are
  synchronized through the authenticated `/api/sync/state` endpoint. A newer
  server revision hydrates another device after sign-in. The server-side data
  file must live on persistent encrypted storage in production.

  ## Local SQLite cache

  Each device keeps a working SQLite copy in IndexedDB via sql.js/WebAssembly,
  so navigation and refreshes remain fast. Credential fields are always null in
  this browser copy.

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

  The synchronized server copy is authoritative across devices. If two devices
  submit the same revision, the newer server state wins and the stale device is
  rehydrated rather than silently overwriting it.

  ## Environment variables (NETS Sandbox)

  Copy `.env.example` to `.env` and fill in your NETS Sandbox credentials
  before running `npm run dev`. These used to be hardcoded in
  `src/app/utils/netsQr.ts`; they're now read from `import.meta.env` so the
  key isn't committed to source control. `.env` is git-ignored.

  Server-only variables must never use the `VITE_` prefix. For production, set
  `NODE_ENV=production`, a 32-byte-or-longer `SESSION_SECRET`, `NETS_DATA_FILE`
  on persistent storage, and the OTP provider values documented in
  `server/README.md`. Build with `npm run build`, then run `npm start` behind
  HTTPS.

  ## Installable app

  `public/manifest.webmanifest`, the branded icons and `public/sw.js` make the
  production build installable as a standalone PWA. The shell has an offline
  fallback; secure sign-in and synchronization still require connectivity.

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
- **Shared persistence:** hangout shortlists, plans, votes, reward redemptions, users,
  payments, reminders, budgets and admin data use the local sql.js cache and authenticated
  server synchronization so the same account can resume on another device.
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
