# Changelog

Notable changes to the NETS group prototype, newest first. Each entry names the
commit it landed in so a change can be traced back to its diff.

---

## Merchant portal, voucher return loop, secure sessions and PWA — `e31122f`

The XP Store now has a dedicated seller side instead of leaving every merchant
decision inside the administrator portal. A separate **Kopitiam Merchant**
account is linked only to its own merchant record and is routed to a private
`/merchant` workspace; customers cannot enter it, and merchants cannot enter
customer or administrator journeys.

**What the merchant can act on**

- A mobile merchant dashboard reports NETS revenue, order count, average ticket,
  anonymous unique and repeat customers, XP awarded and vouchers used.
- Product references from real customer payments become a ranked menu report,
  making signals such as **Nasi Lemak is the best seller** visible without
  exposing customer names, cards or individual spending histories.
- Seven-day revenue bars and breakfast, lunch and dinner demand show when stock
  and staffing matter most.
- A rule-based action feed turns those figures into simple recommendations for
  the top item, the quietest period and customer retention.
- The merchant can set a 1x, 1.5x or 2x XP multiplier for future purchases and
  immediately see the customer-facing earning effect.
- A CSV export provides the merchant-facing report that was previously missing
  while deliberately omitting payment credentials and customer identities.

Merchant sales are stored in a new scoped `merchant_sales` table. Successful
full and split-payment journeys write into it once per payment ID, so the seller
view follows actual app usage. A clearly labelled sample week gives the demo
account an understandable starting story and remains distinguishable from live
payments.

**Voucher expiry return loop** — active vouchers now create deduplicated Rewards
notifications as they cross the seven-, three- and one-day thresholds. Opening
the alert deep-links to the voucher wallet, turning the existing Notification
Centre into a useful return-visit trigger instead of introducing another inbox.

**Security and installability**

- Authentication moved behind a Node server with hashed PINs, throttled login
  and recovery attempts, expiring challenges, HttpOnly sessions, CSRF checks and
  an authenticated revision-based SQLite synchronisation endpoint.
- Customer, administrator and merchant landing routes are derived from explicit
  roles while safe internal deep links still work after customer sign-in.
- A web app manifest, install card, offline fallback, service worker and NETS
  icons make the prototype installable as a PWA.
- The completed `XP_Rewards_Store_Deck.pptx` and its ten rendered slide previews
  are included as presentation deliverables; generated inspection traces are
  ignored.

The integration with the newer Home, rewards-placement, location and merchant
insight work passes 90 unit tests and 13 focused Chrome tests covering login,
role isolation, the merchant dashboard, server security and PWA metadata.

---

## Merchant insights and paid placements — `2fb7e08`

The rewards store had a catalogue and no other side to it. Merchants got nothing
back from taking part, and NETS earned nothing from running it.

**What a merchant learns** — a new **Rewards** tab in the management portal
reports, per merchant, what the ledger already knows:
- Sales, revenue, average basket, busiest hour and day.
- How many customers bought more than once, and what their sales are
  categorised as.
- Which of its rewards customers actually redeem, ranked.
- **Of the customers who redeemed a voucher, how many came back and paid here** —
  and how many of those had never bought there before. That is the only real
  evidence a reward did its job, and it is computed from timestamps rather than
  asserted.

Nothing is stored. Every figure is derived from the transactions and redemptions
tables when it is read, so the portal cannot show a merchant a number the
customer app would contradict. A merchant with no activity says so rather than
showing zeroes that look like a broken screen.

**What NETS sells** — merchants buy position in the store. **Featured** ($40/wk)
pins the reward above the listing; **Spotlight** ($90/wk) adds the banner at the
top. Each booking has a window and a report: impressions, attributed
redemptions, the fee prorated to the days actually run, and the cost per
redemption. Three rules live in storage rather than in the UI:
- At most three paid slots at once, counted across the whole booked window
  rather than just today — so a booking cannot slip in by starting later.
- One reward cannot hold two overlapping placements.
- Only one merchant holds the spotlight at a time, because there is one banner
  and a second buyer would pay the higher rate for nothing.

Placements expire on their own: status is derived from the window every time it
is read, the same rule that governs voucher expiry.

**What the customer sees** — promoted rewards lead the store and every one is
labelled **Sponsored**, with a line explaining what that means. A paid slot buys
position and nothing else: the XP price, the distance and the locked state of a
reward the customer cannot afford are all untouched, and a promoted reward is
still filtered out by search or by the *Near me* radius when it does not belong.
Cards also show how often a reward has been redeemed — the same signal the
portal ranks by.

The presentation scenario now seeds reward history and a live placement, so the
insights, the ranking and the sponsored card all have something real to show the
moment a demo loads.

Covered by 42 unit tests over the insight and placement rules, and 10 end-to-end
tests over the portal, the store, and the loop between them.

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
