# Changelog

Notable changes to the NETS group prototype, newest first. Each entry names the
commit it landed in so a change can be traced back to its diff.

---

## A split bill gets its own id, and a vote belongs to one person

A second round from AnNi, on top of her earlier split-bill work.

**Splits are keyed by the payment, not by the clock.** The previous entry gave
each split its own identity by keying on merchant, payer and the moment it was
made. That separates two splits at the same stall on different days, but two
made in the same second — the same merchant scanned twice in one sitting, both
labelled "Just now" — still collapsed into one bill with a double-counted total
and, once the payer's share was derived from it, a *negative* share on screen. A
split now carries the payment's own id in a new `reminders.bill_id` column, so
two splits are two bills no matter how close together they were made. Rows
written before the column existed keep the old key as a fallback, and the
dashboard and the shared bill screen now derive that key from one shared
`billKeyFor` helper — building it separately in two places is what let a tapped
bill open as an empty one. Older databases get the column by migration.

**A payer's share is read, not reconstructed.** The shared bill screen worked
the payer's share out as total minus everyone else's. That is only correct while
the numbers are, and it had no floor, so bad data rendered as the payer being
owed a negative amount. The share recorded at payment time is now used directly,
with the subtraction kept only for legacy rows that never stored one, and the
result clamped at zero.

**An impossible split is refused rather than saved.** Nothing checked that the
shares in a split added up to the bill. A corrupt split could write reminders
chasing friends for money they did not owe — a $119.85 share on a $79.90 bill.
Shares are now summed against the bill total, within a cent for rounding, before
any reminder is written; if they disagree the reminders are skipped and the
mismatch logged. The payment itself is unaffected and still recorded.

**You can only cast your own vote.** Hangout voting had a "Voting as" switcher
that let anyone on the device vote as any participant, host included — convenient
for a single-device demo, indefensible as a product. Voting is locked to the
logged-in user and the roster is now a read-only "Who has voted" display.

**Two smaller fixes.** Coming back from a shared bill returns you to the Shared
Bills tab instead of dropping you on To Receive, and saving reminder settings no
longer throws you to the profile screen a second later.

## Sponsored slots get a lane, a neighbourhood and a cooldown

Three changes to paid placement, plus a teammate's split-bill work.

**Two spotlight lanes.** There was one banner, so a chain with a marketing
budget could hold it against every hawker stall in the country — the opposite of
what a heartland payments network should be selling. The spotlight is now sold
in two lanes, hawker and brand, decided by the merchant's own name. One of each
runs at a time, so a chain and a stall are always both represented and neither
outbids the other for the same slot. The concurrent cap rises from three to four
to make room.

**Placements are local.** A stall was paying for the whole island. A placement
now reaches customers within range of the outlet its reward belongs to, so an
Ang Mo Kio customer sees the Cheng San stall and a Woodlands customer sees
Marsiling — neither sees the other's. Chains and rewards with no outlet still
reach everyone. Two neighbourhood stalls were added to the catalogue so the rule
has something to demonstrate.

**A cooldown on the banner.** The cap on concurrent slots did nothing against one
merchant rebooking the spotlight the moment its own placement ended. A merchant
that has held it for 14 days out of the last 30 now stands down for a week
before booking it again. The cooldown is on the banner only — the same merchant
can still buy a featured slot meanwhile.

**Split bills, from AnNi.** Each split is now its own bill, keyed by merchant,
payer and when it was made. Splitting the same merchant twice used to merge into
one combined bill with a double-counted total; the dashboard, the shared bill
screen and the demo scenario all now treat one split as one bill. Includes her
migration for older databases missing `merchant_items.category`.

## Every voucher verifiable from any device, not just the one that issued it

The previous entry published redemptions to a server index so a merchant's phone
could verify a scan. It published them at the moment of redemption and nowhere
else, which left most of the wallet invisible to the counter.

Three kinds of voucher were never in the index. The seeded demo vouchers are
written straight into SQLite by the presentation reset, so they never pass
through `redeemReward` — `XP-DEMO01` to `XP-DEMO05`, the ones a demo actually
shows, were the worst affected. Anything redeemed while the network was down
lost its single fire-and-forget attempt. Anything redeemed before the index
existed was never offered to it. Scanning any of them returned 404 from the
server, fell through to the scanning device's own database, found nothing there
either, and told the customer their voucher did not exist. Confirmed against a
running server: `GET /api/voucher/XP-DEMO04` answered 404 on a freshly seeded
demo.

Publishing is now a sweep of the whole wallet rather than a single event. It
runs at startup, whenever the rewards wallet is opened — the screen that renders
the QR, so a code is in the index before anything can point a camera at it — and
still at redemption, now retried three times instead of fired once. `POST
/api/vouchers` takes the batch in one request.

Reconciliation is forward-only. A device republishes its whole wallet on every
start, so a phone that has been offline since before a voucher was spent keeps
offering `used: false` for it; honouring that would un-spend the voucher and let
it be redeemed twice. A voucher already marked used in the index stays used, and
the only transition a publish can cause is unused to used.

Two related holes closed. Marking a voucher used in the app now reaches the
index, so a customer who taps "Use now" cannot then have the same code honoured
at a counter. And the demo reset clears the index before republishing the
reseeded wallet — the seeded codes are fixed strings, so without that a code
spent in one run of the demo would still read as spent after a reset, and the
reset would look broken.

The scan screen no longer treats "the server does not know this code" as "the
server is unreachable". It prefers the index whenever the index holds the code,
falls back to the local record for a same-device scan, and distinguishes an
unknown code from a device that is simply offline rather than showing one
message for both.

Covered by `tests/e2e/voucher-cross-device.spec.ts`, which drives a second
browser context — no shared cookies, localStorage or IndexedDB — so a passing
test cannot be reading the issuing device's local record. Three of its five
cases fail against the previous code.

---

## The split mission fired on any payment, and Alex started below the top tier

Two things found by exercising the missions in the running app rather than
only in tests.

**"Split the bill" completed whenever anyone paid for anything.** The signal was
a transaction carrying a `payment_id` — but that is the idempotency key written
on *every* payment, not a marker of a split. Buying a kopi on your own ticked
the mission. Splits are now read from the bills the user is owed on, which is
what a split actually creates. Verified both ways round: a plain QR payment no
longer completes it, and the seeded Din Tai Fung split still does.

**The demo account started just short of the top tier.** Alex is presented as a
long-standing customer, but the scenario's four weeks of activity left him at
Heartland Insider, so the walkthrough could not show the top tier or the 1.3x
earn rate. The scenario now carries in a stated XP balance from before its
window, which puts lifetime and spendable both just past 10,000. It is one
labelled grant in the ledger — "Earlier NETS activity" — rather than months of
invented transactions manufactured to reach the same number, and it is written
only by the presentation scenario, so a real account never has one.

---

## A voucher QR that actually scans — `5ec3ce3`, `1a8716c`

The voucher "QR" was a 7x7 grid of pseudo-random squares — it read as a QR code
on a slide, but no scanner could do anything with it, and the voucher could only
ever be redeemed by the customer tapping "mark as used" on their own phone.

`qrCode.ts` generates real QR symbols: byte mode, error-correction level M,
versions 1–10, with the mask chosen by the specified penalty rules rather than
fixed. The output is verified by decoding it with an independent decoder, which
is how a bug in the format-information placement was caught — it was writing
over the dark module, and every symbol failed to decode until it was fixed.

Scanning a voucher opens `/v/:refCode`. That route is public, because the device
reading the code at a counter is not signed in as the customer holding it. It
looks the reference code up against the rewards record, marks the voucher used,
and shows the reward, the merchant, the XP it cost and its dates — all read back
from the record. The QR carries nothing but the reference code, so a code cannot
be edited into a voucher for a different reward or a larger amount. A code that
is unknown, already used or expired says so instead of showing a success screen.

The QR points at the running origin, so it resolves to the deployed site rather
than to a developer's machine. That alone was not enough to make a scan work,
though: the synchronized database is only served to an authenticated session, so
a phone scanning the code — which is not signed in as the customer holding the
voucher — had nothing to look the code up in. Redemptions are now also published
to a small server-side index keyed by reference code, and the scan screen
verifies against that, falling back to the local record for a same-device scan.
The index holds only what a merchant needs to honour the voucher: no user
identity, no wallet, no transaction history. Verified by scanning from a second
browser with no cookies at all.

---

## Bounding the XP economy, and warning before XP is lost

Two consequences of the XP engine, addressed.

**Mission XP had no ceiling.** Clearing every mission every day minted 310 XP
against reward prices of 150-1000, so a committed user earned more from missions
than from actually spending — roughly two $10 cashbacks a week for free. This
was not theoretical: an end-to-end test that assumed a customer could not afford
a 600 XP reward started failing because the balance had quietly grown past it.
Mission values are rebalanced down (10/25/40/50/25, so a full day is 150 rather
than 310), and mission earnings are now capped at 400 XP per Monday-anchored
week. The allowance is spent chronologically, the day that hits the ceiling says
so, and the Missions screen shows progress against the cap rather than letting
it bite invisibly.

**Expiry was quieter than earning.** XP lapsing was only visible to someone who
happened to open the Rewards tab, so the rule that takes XP away was less
apparent than the one that grants it. A new scheduler mirrors the voucher
reminders — same 7/3/1/0-day tiers, same `app_meta` dedupe, same notification
channel — and links straight to the ledger. Lots are grouped by the day they
lapse rather than notified one by one, because a month of payments is dozens of
lots expiring together and the total is what matters. Permanent grants are never
warned about, and `?tab=ledger` was added to the Rewards deep-link allowlist,
which otherwise would have dropped the notification on the overview tab.

---

## XP that means something: tiers, a ledger and daily missions — `3cacd3c`, `4433098`

The XP Store rewarded a lifetime total and nothing else. Four things changed.

**Tiers now pay.** Reaching a tier was purely cosmetic — a Kampung Spirit member
earned exactly what a new user earned. Each tier now carries an earn multiplier
(1x, 1.1x, 1.2x, 1.3x) that stacks on top of a merchant campaign, so the ceiling
is a top-tier customer at a 2x heartland stall: 2.6x. The multiplier applied to
a payment is the tier the user held *at that moment*, computed in a forward pass
over history, so there is no circularity between "tier decides earnings" and
"earnings decide tier".

**XP has a ledger.** The balance was recomputed on every read as lifetime earned
minus lifetime spent, which left nowhere to express expiry, refunds or an audit
trail. History now builds explicit lots: XP expires at the end of the month
after it was earned, redemptions consume the oldest valid lot first so nothing
lapses unnecessarily, and a refunded payment claws back from that payment's own
lot. A Ledger tab shows what is live and what is about to lapse.

**The weekly quest was not weekly.** It counted lifetime transactions, so it
pinned to 3/3 forever once a user had ever made three payments. It is now five
daily missions on a calendar — check in, pay with NETS, support a heartland
stall, three payments in a day, split a bill — evaluated per day against real
activity, so they reset on their own with no scheduled job.

**An affordability filter.** The store gained an "I can afford this now" toggle,
counting what the current balance actually covers.

### Merchant side

- **Campaigns can be scheduled.** A 2x bonus ran until someone edited it back.
  Campaigns now take start and end dates and only pay out for payments inside
  the window, so historical transactions keep the rate that was live when they
  happened.
- **Matching a sale to a merchant is exact.** The old substring rule let a
  merchant named "Kopi" claim every "Kopitiam Food Court" payment and price it
  at the wrong rate. A merchant now matches its own name or a declared alias,
  and that one rule is shared by the XP engine and the merchant portal so a sale
  that earns XP is always the sale the merchant sees.
- **Deleting a merchant no longer rewrites history.** It was a hard `DELETE`,
  which silently repriced every past payment at that merchant back to the
  default rate. It is a soft hide: out of the scan list, still pricing its own
  history, restorable.
- **XP analytics.** A new screen reports XP issued, what the bonus cost and
  campaign uplift against non-campaign days, per merchant.

### Reconciling with main — `4433098`

Main had independently grown a merchant portal, paid reward promotions, voucher
expiry and a transaction model while this work built the XP engine, so the two
were reconciled rather than concatenated. Main's surfaces won where they
overlapped — the portal and `promotionStorage` remain the merchant-facing story,
and the fabricated transaction seeding this branch had extended is gone in
favour of main's deliberate "activity is created only by using the app". The XP
engine was rebuilt on main's `rewardStorage`. `merchantInsights` now routes
through the single matching rule, and its tests moved to it, including the case
the loose rule got wrong.

`47c8057` follows up: `merchantAnalytics` and `questStorage` read purchases
through the shared `getPurchases`/`classifyTransaction` helpers instead of their
own SQL, so XP issued, missions and the portal's sales all describe one set of
rows.

### Two bugs the end-to-end suite caught — `5cd5804`, `d8a975e`

- **The welcome bonus expired in 1970.** The starter bonus is pinned to
  `createdAt: 1` as a sort sentinel, not a real date. The new expiry rule read
  it as a real date and lapsed it immediately, so a new customer opened the
  store holding 20 XP instead of 500 and could not redeem anything. Ledger
  entries can now be marked as never expiring; such a lot is excluded from
  "expiring soon" and reads as "Never expires" rather than an Invalid Date,
  while still being spent first by FIFO.
- **A test encoded a fixture assumption that daily missions broke.** The
  paid-placement test asserted a 600 XP reward reads as locked *because* "Alex
  starts with 500 XP". Balances now depend on the day's activity. The test reads
  the displayed balance and asserts the label matches real affordability, so it
  still fails in either direction and does not rot when earning rules change.

---

## Seeing where XP comes from: tiers and a monthly breakdown — `d13e3e0`

Groundwork for the above, landed first.

- **The balance card opens the tier ladder.** Tapping it shows every tier, its
  XP breakpoints, which are unlocked, and an animated bar for progress through
  the current one. The ladder moved into a single exported `TIERS` list that
  `getTier` walks, replacing a hardcoded if-chain, so the badge and the sheet
  cannot disagree.
- **"This month" opens a breakdown.** A new `/xp-breakdown` screen lists the XP
  each payment earned in a chosen month, with a month tab strip, the top source
  and that month's bonus XP. Repeat visits to one stall group into a single
  source.
- **Merchant XP settings became reachable.** `xpRate` and `xpBonus` already
  drove earning and were carried through on edit, but no form exposed them, so
  every merchant added through the portal was stuck at 10 XP per $1 with no
  multiplier. Both are now editable, with validation and a live preview of the
  XP a customer would earn.

---

## A deployment no longer breaks the open tab

"Something went wrong — Failed to fetch dynamically imported module:
.../AdminAccessPage-DBFQ14iU.js" on the live site, opening the admin portal.

Pages are code-split, and every chunk filename carries a content hash. Deploying
replaces those files, so a browser holding the previous build asks for a name
the server no longer has and the import rejects. Two things made it stick:

- **The app had no recovery.** A failed import went straight to the error
  screen. It now reloads once, which fetches the current `index.html` and with it
  the chunk names that exist now. The reload is stamped in `sessionStorage` and
  only repeats after a minute, so a chunk that is genuinely broken still shows
  the error rather than looping.
- **The service worker never let go of the old shell.** Its cache name was a
  fixed `v1`, so the `activate` handler — which deletes every cache except the
  current one — never had anything to delete, and `/` and `/login` were
  precached as HTML that names hashed chunks. The cache is now keyed to a build
  id passed on the registration URL, so each release prunes the last, and no
  HTML is precached: the navigation handler caches whatever the network last
  returned, which is always the running build's shell.

"Back to Home" on the error screen also now clears the caches and unregisters
the service worker before reloading, but only for this class of error — it is an
escape hatch from a stale shell, not something to do to every crash.

Covered by an end-to-end test that fails a chunk request exactly once, the way a
redeploy does, and asserts the app arrives at the page anyway.

---

## Showing that the data is real — `a7ac891`

A prototype's hardest claim to make from the outside is that it is not a set of
hard-coded screens. `/admin` → **Database** answers it by showing the database
instead of describing it.

**Every table, live.** The list comes from `sqlite_master`, each table's columns
from `PRAGMA table_info` and its rows from `SELECT *`. Nothing is enumerated by
hand, so a table added next week appears without this page being touched. Each
table carries a one-line note on what writes to it, row counts update while the
page is open, and any row can be read field by field.

**Derived, not stored.** Each account's wallet balance is shown as the sum that
produces it — opening balance, the movement across N ledger rows, the result —
and its XP as earned minus spent. Underneath, the page scans every column of
every table for a `balance` or `xp` column and reports what it finds. That is a
check run at render time rather than a promise: if a stored figure is ever added,
the panel says so. The one stored amount, `cards.balance`, is named and
explained — a prepaid card's float is its own holding, and every movement in or
out of it is still a ledger transaction.

**Nothing secret.** Credential columns are masked, and the page says why the
`users.password` column is empty: PINs are hashed and held by the server, and
are never written to the browser's copy. The whole database downloads as a real
`.sqlite` file that opens in any SQL client.

Admin-only, behind the same three-role guard as the portals. Six end-to-end
tests, including one that pays for something as a customer and then finds that
payment in the ledger's row count, and one that checks the balance on this screen
equals the balance on Home.

---

## One merchant side, not two — `892dc5a`

Two merchant implementations landed independently: a stall portal on this
branch, and a merchant dashboard on `main`. Merging them meant choosing, not
concatenating.

**One record of a sale.** The `main` build wrote every sale twice — once to the
transaction ledger, once to its own `merchant_sales` table. Two records of the
same sale is one record too many; they drift, and then the stall's takings
disagree with its own menu report. `merchant_sales` is gone. Everything now
reads `item_sales`, the single line-level record of what was sold, which the
per-dish view already used. The dashboard's own figures were kept and re-pointed
at it, so nothing it showed was lost.

**Both roles survive.** `main` added a `role` column; this branch added
`merchant_id`. The merged schema keeps both, and back-fills either from the
other, so a database seeded under either build reads correctly under the merged
one.

**Kept from `main`:** the seven-day revenue chart, the breakfast/lunch/dinner
split, the recommendation panel, "XP given out" and "Vouchers used", the
merchant-set XP multiplier (1x/1.5x/2x), and the CSV export — which counts
anonymous unique buyers and carries no name, number or card.

**Kept from this branch:** per-dish ranking with peak hours and week-on-week
trend, the menu editor, item-level attribution at the pay screen, the
return-rate panel, self-serve paid placement, and the three-role route guard.

XP is derived from the sale rather than stored, so the merchant's "XP given out"
and the customer's own balance cannot disagree.

`main`'s merchant end-to-end spec was rewritten rather than deleted: it was
asserting two features worth keeping, and now covers what the per-dish spec does
not — the week and daypart views, the multiplier, and the contents of the export.
The demo login for the kopitiam was also documented wrongly in two places; it is
`kopitiammerchant`, not `kopitiam090909`.

---

## A merchant side of the app — `11d1437`

The insights built earlier were admin-only, and stopped at the merchant name.
A stallholder could not open them, and "$6.80 at Kopitiam" was never the thing
they wanted to know.

**Merchant accounts** — two demo stalls sign in with their own credentials and
land in their own portal: **Kopitiam** (`kopitiammerchant` / `555555`) and
**Bubble Tea Bar** (`bubbletea070707` / `666666`).
- The route guard generalised from admin-or-customer to three roles, each with
  a home and a set of pages it may stay on. A merchant cannot reach the
  customer wallet; a customer cannot reach a portal.
- Merchant accounts are excluded from the contact list, so a stall cannot be
  invited to a Hangout or asked to split a bill, and from the customer counts
  in the management portal.
- Scoping is by session, never by page: every read takes the merchant id from
  the signed-in user. A test asserts one stall cannot see another's dishes.

**Menus and item-level sales** — merchants keep a menu (add, reprice, mark sold
out, remove). Where a stall has one, the pay screen asks the customer what they
bought and records it against the payment. The sale copies the item's name and
price rather than joining to the menu, so renaming a dish never rewrites the
history of what sold for how much; a unique index on (payment id, item id)
makes it idempotent, matching the transaction ledger's own guard.

**The dashboard** opens on the best seller by name — *"Nasi Lemak, 35 sold,
$122.50, 42% of everything you sell, sells most around 8am"* — then:
- every dish ranked, with its own peak hour and a week-on-week trend;
- an hourly trading chart;
- a panel naming what is on the menu but has never sold.

A dish first sold this week shows **no** trend rather than a fabricated rise off
a base of nothing.

**The rewards tab** answers the merchant's real question: of the customers who
redeemed one of your rewards, how many came back and paid you, and how many had
never bought from you before. Merchants can also buy their own Featured or
Spotlight placement — restricted to their own rewards — and see impressions,
redemptions and what they paid.

Two bugs found on the way. The scan screen had no way to choose a stall, and
pressing Scan discarded a hand-picked merchant to randomise, so a chosen dish
could never be paid for. And the seeded demo trade wrote item sales with no
matching payments, leaving a stall's takings disagreeing with its own menu
report — every seeded sale is now both.

Covered by 17 unit tests over the item analytics and 13 end-to-end tests over
the portal, the menu, the isolation between stalls, and the loop from paying for
a dish to seeing it on the stall's dashboard.

---

## Vercel authentication and durable sessions — `a644461`

The production deployment previously contained only the Vite bundle. Direct
visits such as `/login` returned Vercel's 404 page, `/api/session` did not exist,
and the login screen translated that missing backend into **Secure sign-in is
temporarily unavailable**.

- A root `api/index.mjs` now exposes the existing secure Node request handler as
  a Vercel Function. An API-specific rewrite keeps every `/api/*` endpoint on
  that function, while the final SPA rewrite sends unmatched browser routes to
  `index.html`.
- Credential hashes, HttpOnly sessions, recovery challenges, audit records and
  the synchronized SQLite snapshot now persist in the connected Redis store.
  The adapter accepts the `KV_REST_API_URL` / `KV_REST_API_TOKEN` names generated
  by the installed Vercel integration as well as current `UPSTASH_REDIS_*`
  names.
- The JSON store remains the local-development fallback. Vercel fails clearly
  during initialization if Redis or `SESSION_SECRET` is missing instead of
  appearing to deploy successfully with a backend that cannot retain state.
- Concurrent requests inside one Fluid Compute instance are serialized around
  the prototype's cohesive state document, avoiding shared-memory session
  races. The built-in customer, administrator and merchant accounts seed a new
  demo store unless a custom `NETS_SEED_USERS_JSON` is supplied.

Verified with strict TypeScript checking, 90 unit tests, four server-security
tests, nine focused browser journeys across customer, administrator and merchant
roles, a production Vite build, and direct checks of the rewritten API and SPA
paths. PIN recovery in production still requires an approved
`OTP_WEBHOOK_URL`; ordinary sign-in does not.

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

- **Prototype backend.** PIN hashes, sessions and synchronized app state now
  live behind a Vercel Function and connected Redis store. The prototype keeps
  its state in one Redis document and uses an in-instance login throttle; a
  banking rollout needs transactional records, a distributed rate limiter and
  managed identity controls.
- **Admin access is client-side.** The management portal, the merchant portal
  and the database explorer are guarded in the UI by the role on the session,
  not by server-side authorisation. The explorer is the one that matters most:
  it can read every table, so in a real deployment that route would need the
  server to refuse the data, not just the app to refuse the screen.
- **Payments are simulated.** The NETS sandbox needs credentials the prototype
  cannot safely ship, so the QR flow falls back to a simulated authorisation
  with a mock reference.
- **Location is set manually.** There is no device location permission; the
  area is chosen in the app.

A production deployment would need a secure backend, hashed credentials,
server-side sessions, real one-time-password delivery, role-based admin
authorisation and server-synchronised data.
