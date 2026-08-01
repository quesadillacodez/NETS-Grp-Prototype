# NETS Presentation Revisions

## Suvanesh - replace slides 17-20

### Slide 17 - Group outings start with too much coordination

**Assumption**

Gen Z and Millennial users coordinate outings across messaging, maps, social media,
and booking apps. A shared decision tool inside NETS would reduce the effort needed
to agree on an activity, date, location, and budget.

**Validation questions**

- Think about your most recent group outing. How did the group decide what to do?
- Which part took longest: activity, date, location, or budget?
- How many apps or group-chat messages were needed before the plan was confirmed?
- Would a shared shortlist and private group vote have reduced that effort?

### Slide 18 - Social outings are common, but NETS enters too late

**Existing evidence from the team's 48-response survey**

- 37 of 48 respondents (77.1%) use cashless payment for social outings.
- 26 of 48 respondents (54.2%) selected social features as a reason to use one
  payment method more consistently.
- Promotions and discounts received 25 of 48 responses (52.1%). That result belongs
  to the team's rewards hypothesis; it is not the basis of this feature.

**Insight**

NETS currently appears only when the group is ready to pay. The earlier decision and
coordination stage is an opportunity to make NETS useful before the transaction.

**Decision**

Build a shared outing planner, then validate the specific coordination pain with a
short behavioural follow-up survey. Do not claim the pain is validated until those
responses are collected.

### Slide 19 - NETS Hangouts turns scattered opinions into one plan

1. Browse activity ideas by budget, category, area, and group size.
2. Shortlist two or three suitable options.
3. Invite friends from the NETS contact list.
4. Each person votes for one activity.
5. The organiser confirms the group's top choice.
6. Everyone sees the same activity, date, budget, and participant list.
7. After the outing, the plan hands off to NETS Pay and Smart Split Bill.

**Feature boundary:** Hangouts does not issue discounts, XP, cashback, vouchers, or
reward redemption. Those belong exclusively to Hadi's XP Rewards Store.

### Slide 20 - NETS becomes useful before, during, and after an outing

**Customer value**

- Reduces repetitive group-chat coordination.
- Makes budget expectations visible before the outing.
- Gives every participant an equal voice through voting.
- Keeps the final plan and payment journey in one place.

**Business value**

- Creates app opens before a transaction occurs.
- Generates organic invitations when organisers add friends.
- Produces aggregated demand signals by activity, area, group size, and budget.
- Increases the chance that a planned outing ends with a NETS payment.

**Presentation handoff**

“Suvanesh helps the group decide what to do before payment. An Ni makes paying
together frictionless. Hadi rewards users for continuing to choose NETS.”

## Member-by-member refinements

### Hadi - XP Rewards Store

- State one earning rule everywhere. The integrated prototype uses 10 XP per $1 and
  2x XP at selected heartland merchants.
- Explain reward economics: who funds the voucher, what one XP costs NETS, expiry,
  breakage, and a maximum redemption rate.
- Replace “zero customer acquisition cost” with “lower customer acquisition cost.”
  Merchant onboarding, placement, support, and reward funding are not literally free.
- Demonstrate the strongest integration: make a payment, show XP increasing, redeem
  wallet cashback, and show the wallet balance and admin redemption count updating.
- Address abuse controls such as refunded transactions, repeated micro-payments,
  duplicate voucher use, and account farming.

### An Ni - Smart Split Bill and reminders

- Do not claim NETS can reliably “detect” every group payment without explaining the
  signal. Present Split Bill as an explicit post-payment prompt or explain the rule.
- Demonstrate consent: friends approve their own payment; the payer cannot deduct money
  from them automatically.
- Cover partial approval, declined requests, rounding, custom splits, payer share,
  refunds, and a participant leaving the group.
- Separate the two hypotheses clearly: calculation/payment friction versus the social
  discomfort of chasing repayment.
- Label simulated authorisation honestly during the prototype demonstration.

### Kaden - AI spending and savings dashboard

- Show which transaction fields drive each category and recommendation.
- If classification is rule-based, call it smart categorisation rather than AI. If AI is
  used, explain the model input, output, fallback, and error handling.
- Let users correct a category; the correction should affect future insights.
- Add privacy and consent language because personal spending behaviour is sensitive.
- Demonstrate one traceable chain: transaction -> category -> budget impact -> insight ->
  user action.

### Mikael - NETS Wrapped

- Replace any unsourced popularity chart with traceable evidence or prototype testing.
- Make sharing opt-in and hide exact amounts by default; spending data can be sensitive.
- Explain how a spending personality is calculated so it does not appear arbitrary.
- Show why Wrapped complements Kaden: Kaden supports financial decisions, while Wrapped
  provides reflection, identity, and social engagement.
- Test whether users want a monthly recap or a less frequent quarterly/annual recap.

### Suvanesh - NETS Hangouts

- Collect behavioural evidence about the last real outing rather than only asking if
  respondents “would use” the feature.
- Track prototype measures such as time to create a plan, invitation acceptance, voting
  completion, and time to consensus.
- Keep discounts and XP out of the primary interface so ownership remains unmistakable.
- Demonstrate with multiple app accounts: Alex creates, Sarah votes, Alex confirms, and
  the group continues to bill splitting.
- Add notification and tie-breaking rules only after the core shortlist-vote-confirm flow
  is reliable.

## Team narrative

Use one journey in the final demonstration:

1. Suvanesh: friends plan an outing.
2. An Ni: they pay, split, authorise, and manage repayment.
3. Kaden: the transaction updates budgets and insights.
4. Mikael: the transaction contributes to the monthly recap.
5. Hadi: the payment earns XP that can be redeemed.

This makes the prototype feel like one product while preserving individual ownership.

