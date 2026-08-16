# Changelog

Notable changes to the NETS group prototype, newest first. Each entry names the
commit it landed in so a change can be traced back to its diff.

---

## A working card carousel and editable Quick Actions — `a77377d`

Two things on Home only looked finished: the three dots under the vCashCard
were decoration — there was one card and nothing to swipe to — and the four
Quick Actions were a hard-coded array.

**A carousel of real NETS cards**
- Alongside the **vCashCard** there is now a **NETS Prepaid Card** (tap and pay,
  no bank account needed) and a **NETS Motoring CashCard** (ERP, carparks,
  petrol), each with its own float, masked number and status.
- Swiping works because the track is a native scroll-snap container rather than
  a JavaScript drag gesture: a finger swipe follows the finger, keeps its
  momentum, and never fights the page's vertical scroll.
- The dots are real buttons and the track takes arrow keys, so the carousel is
  reachable without a touchscreen. Only the card in view is exposed to
  assistive technology, and only its balance is the page's heading.

**Cards that do something** — tapping a card opens a sheet that loads it from
the wallet, moves the money back, or freezes it.
- A load is a real movement of the customer's money: recorded as a transaction
  and gone from the spendable balance. Two new transaction types, **Card Load**
  and **Card Unload**, neither counted as spending — nothing has been spent
  until the card is used at a merchant.
- The limits — the wallet balance, the card's $500 ceiling, the frozen flag —
  live in `cardStorage`, so the sheet cannot move money the rules would refuse.
- The vCashCard holds no separate balance (it is the wallet, read from the
  ledger like everywhere else), cannot be frozen, and sends you to Top-up.

**Editable Quick Actions**
- An **Edit** control opens a picker of eleven shortcuts — Wrapped, the spending
  dashboard, Hangouts, Rewards, alerts, help and the rest — of which four can be
  chosen, in the order they will appear.
- The choice is stored per account in a new `user_preferences` table and
  survives signing out. It is normalised on read, so a selection written by an
  older build can never leave the row with a gap or a shortcut to a route that
  no longer exists.

The three bottom sheets are now one shared component that is a real dialog:
labelled, closed by Escape, focused on open. The Quick Actions row became a
named navigation landmark — which is also what separates *Reminders* the
shortcut from *Reminders* the bell in the header.

Covered by 12 unit tests over the selection rules and 11 end-to-end tests over
the carousel, the transfers, freezing and editing the shortcuts.

---

## A movable location, and an illustrated rewards store — `61b1f15`

The demo location was fixed to Orchard, so the distances added below were the
only ones anyone could ever see. The area is now chosen in the app.

**Location picker (`src/app/components/LocationPicker.tsx`)**
- A banner stating where the customer is, tappable, on both the Hangouts
  *Near you* tab and the rewards store.
- A sheet listing 27 areas with the distance to each, searchable, with
  *Reset to my usual area* when the customer has moved away from the demo's
  starting point.
- The choice is stored per user and broadcast on a `locationChanged` event, so
  setting it in Hangouts re-ranks the rewards store too. Both screens read it
  from `getUserArea`, so the two can never disagree.

**Reward artwork** — every reward now carries an emoji that fits the merchant:
🧋 for LiHO, ☕ for the kopitiam, 🍗 for chicken rice, 🍜 for hawker noodles,
🥟 for Old Chang Kee, 🛒 for FairPrice, 🚗 for Grab, 📚 for the bookshop, 💵 for
wallet cashback. Partner deals created in the management portal are illustrated
too — the emoji is derived from the merchant name and category rather than
stored, so a new deal is never left with a blank tile. The icon is decorative
and hidden from screen readers, which read the reward title instead.

Four more end-to-end tests: moving the location, searching and resetting it, a
location set in Hangouts driving the rewards store, and the emoji appearing.

---

## Location-aware Hangouts and rewards — `b777059`

Hangout ideas and reward outlets already recorded where they were, but nothing
used it. They are now ranked and filtered by how close they actually are.

**New geo module (`src/app/utils/geo.ts`)**
- Turns the area names the catalogues already use — `Bugis`,
  `Marina Bay Sands`, `Jalan Kubor, Kampong Glam` — into coordinates, and
  measures great-circle (haversine) distance from the customer.
- Longer area names win over shorter ones, so `Marina Bay Sands` is not
  mistaken for `Marina South`.
- Chains and digital rewards are labelled *Multiple outlets* and count as
  nearby everywhere; rewards with no outlet at all (wallet cashback) are left
  out of distance results entirely.

**Hangouts**
- New **Near you** tab: distance on every card, closest first, with a
  2 / 5 / 10 km radius filter.
- An empty radius offers to widen the search rather than showing a blank grid.
- Distances also appear on the Discover and Saved cards.
- Tabs went from three to four, so *Favourites* → **Saved** and
  *Hangouts* → **Plans** to fit a 320px screen.

**Rewards store**
- New **Near me** toggle keeping outlets within 5 km, with distance on every
  card and the outlet's area named in the reward sheet.
- Every catalogue reward now carries the area of the outlet that honours it.

**Demo location** — Alex Chen is placed in Orchard, which puts the hawker,
kopitiam and bubble-tea outlets in Somerset, Dhoby Ghaut and Tiong Bahru within
walking distance while Ang Mo Kio and Mandai fall outside the default radius.
Everything downstream works from coordinates, so replacing `getUserArea` with
the browser Geolocation API is the only change a production build needs.

Covered by 18 unit tests over the distance maths and area resolution, and 6
end-to-end tests over both surfaces.

---

## Savings goals move real money — `99bc8b9`

Adding money to a goal updated the goal record and nothing else. Because the
wallet balance is the opening balance plus the sum of transactions, the money
never left the wallet: contributing $200 left the balance at $2,500.00 when it
should have read $2,300.00.

- A contribution is now recorded as a transaction and leaves the spendable
  balance. Two new transaction types, **Goal Contribution** and **Goal
  Withdrawal**, neither counted as merchant spending — the money is still the
  customer's, just earmarked — so the spending dashboard is unaffected.
- Contributions are capped at the available balance and the goal's remaining
  room, enforced in storage rather than trusted from the UI.
- Money can be taken back out. Previously there was no way to release funds at
  all, so debiting the wallet without this would have made goals a one-way
  trap. Deleting a goal now returns its balance too.
- The opening balance and the sum over transactions had been duplicated across
  four screens, which is what let the goals flow drift out of step. Both now
  live in `transactionStorage` and every screen uses them.

---

## End-to-end tests run against a production build — `fd0721e`

CI intermittently failed three tests, always at the second sign-in within a
test. Nothing was broken — it was too slow.

The suite ran against `npm run dev`, which enables a dev-only feature that
mirrors the whole database to disk after every write: export the SQLite file,
base64-encode it, snapshot every table, POST the lot to the Vite middleware.
That cost grows with the data a test creates and runs on the browser's main
thread, so on a shared CI runner sign-in drifted past the assertion timeout.

Measured with the CPU throttled 8×, same test, same machine:

| Server | Second sign-in | Test duration |
| --- | --- | --- |
| `npm run dev` | did not finish in 20s | 1m 30s |
| `vite preview` | under 3s | 17.6s |

- Playwright now serves a production preview build on port 4173.
- `signIn()` no longer reloads the page when the login form is already showing.
- Side benefit: the suite no longer rewrites the tracked `database/nets.sqlite`
  or emits per-table CSV snapshots on every run.

Related: `950dbe5` added end-to-end cover for both halves of the post-login
redirect — a cold visit to a protected route still returns there after signing
in, and a deliberate sign-out starts the next session on Home.

---

## Product completeness pass — `b7d3710`

The prototype's core journeys worked, but several visible surfaces were
unfinished. This covered the whole recommended package.

### One transaction model
`src/app/utils/transactionModel.ts` is the single source of truth for six
types: **Purchase, Repayment Sent, Repayment Received, Cashback, Refund,
Top-up**. Every screen derives its wording from it, so a top-up can no longer
read as "Paid you back" and a repayment can no longer appear as "Top-up" in the
management portal. Legacy rows are reclassified on startup — repayments stored
as `transfer`, cashback under category `reward`, `NULL` kinds on seeded rows.
Wallet flows are separated from spending categories, so `reward`, `payment` and
`topup` no longer appear alongside Groceries and Entertainment.

### Notification Centre
A real `/notifications` screen: full history, read/unread state, channel
filters (payments, reminders, rewards, Hangouts), deep links to the related
bill or plan, and mark-all-as-read. Per-channel push preferences; the transient
banner respects them and no longer marks everything read when dismissed.

### Profile
All five dead buttons now open working screens — Personal Information
(editable, persisted), Payment Methods (add, default, freeze, remove),
Notifications, Security & Privacy (change PIN, policies and terms) and
Help & Support (FAQs, issue reporting, contacts).

### Transaction history and receipts
Search, type filters and period filters, money in/out totals, and a
per-transaction receipt with a stable reference number.

### Hangouts and Rewards
Hangout invites start with nobody selected and show checkmarks with an
"N friends selected" count. Redemption gained a confirmation receipt with an
explicit **Done**, expiry dates, terms, voucher status (active / used /
expired) and a redemption history; expired vouchers can no longer be marked as
used.

### Responsiveness and accessibility
The management portal header and tabs fit at 320px without wrapping or a
horizontal scrollbar. Accessible names for icon-only controls, visible focus
states, screen-reader announcements for payment success and errors,
reduced-motion support and 44px touch targets.

Status colours were corrected for contrast — the previous shades measured
2.5:1, 2.2:1 and 3.8:1 against white, all failing WCAG AA. They now clear
4.8:1 in both directions, which is why the greens and reds read darker.

### Presentation and engineering
**Demo Controls** under Profile: load a repeatable presentation scenario, clear
demo activity only, or wipe everything. Plus 35 Playwright end-to-end tests
covering login, PIN recovery, payments, splits, repayments, Hangouts,
redemption, notifications, profile and the 320px layout, and a GitHub Actions
workflow running typecheck, tests and the production build.

---

## Known limitations

Deliberate, and worth stating plainly in a presentation:

- **No backend.** PINs are stored unhashed in a browser-local SQLite database,
  recovery codes are shown on screen rather than delivered by SMS, and each
  browser holds its own isolated copy of the data.
- **Admin access is client-side.** The management portal is guarded in the UI,
  not by server-side authorisation.
- **Payments are simulated.** The NETS sandbox needs credentials the prototype
  cannot safely ship, so the QR flow falls back to a simulated authorisation
  with a mock reference.
- **Location is set manually.** There is no device location permission; the
  area is chosen in the app.

A production deployment would need a secure backend, hashed credentials,
server-side sessions, real one-time-password delivery, role-based admin
authorisation and server-synchronised data.
