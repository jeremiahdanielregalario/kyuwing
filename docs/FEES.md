# Fees

Kyuwing records what each player owes for a session and whether they have paid. It does **not** process payments.

> **The seeded amounts are placeholders.** They exist so the ledger and reports can be demonstrated. Replace them with the association's approved rates before using Kyuwing for real money. The UI labels the fee editor accordingly.

## The rule matrix

A fee rule is one row per:

```
(venue, game day type, player category) → flat fee + per-game fee
```

| Dimension | Values |
| --- | --- |
| Venue | KBC, DASC (extensible) |
| Game day type | `REGULAR`, `TIPID`, `MEGA` |
| Player category | `ACTIVE`, `ALUMNI`, `APPLICANT` |

Both amounts are **whole Philippine pesos** and stored as integers. `perGameFee` may be zero (Tipid days use this). `flatFee` may be zero for a pure per-game model.

Rules are edited in **Venues → Fees** and saved as a matrix for the selected venue, with a column per game-day type and a row per category.

### Placeholder seed values

These are illustrative only.

| Venue | Category | Regular | Tipid | MEGA |
| --- | --- | --- | --- | --- |
| KBC | Active | ₱250 + ₱50/game | ₱180 + ₱0/game | ₱300 + ₱50/game |
| KBC | Alumni | ₱320 + ₱60/game | ₱230 + ₱0/game | ₱370 + ₱60/game |
| KBC | Applicant | ₱350 + ₱60/game | ₱250 + ₱0/game | ₱400 + ₱60/game |
| DASC | Active | ₱300 + ₱60/game | ₱220 + ₱0/game | ₱350 + ₱60/game |
| DASC | Alumni | ₱370 + ₱70/game | ₱270 + ₱0/game | ₱420 + ₱70/game |
| DASC | Applicant | ₱400 + ₱70/game | ₱300 + ₱0/game | ₱450 + ₱70/game |

Rationale for the shape (not the numbers): Tipid days are court-fee-only with used shuttles, so the per-game component is zero. MEGA days run at a larger scale and carry a higher flat fee. Alumni and applicants sit above active members. Non-affiliates (plus-ones from outside the association) pay a higher per-game rate (₱30 in production).

Every category needs a rule for every venue and game-day type: a player whose category has no rule is billed ₱0.

## Calculation

```ts
total = flatFee + perGameFee × max(0, gamesPlayed)
```

Implemented in `computeFee` (`lib/fees.ts`).

Key properties:

- **Games played is the multiplier, not games won.** A 35-point game counts once for everyone on court, win or lose.
- `gamesPlayed` increments when a match is completed, for all four players.
- **Free games** do not increment `gamesPlayed`, so they add nothing to anyone's fee. A free game is offered when a game starts within 15 minutes of the reservation's end and is played with a used shuttle (`Match.free`).
- Cancelled matches do not count. Suggested matches do not count until completed.
- If no rule exists for the combination, the total is **0**, not an error — this makes adding a new category or venue safe until the matrix is filled in.
- Negative game counts are clamped to 0.
- Rounding happens at display time, not in the calculation. Amounts are whole pesos in practice.

## The ledger

**Game day → Fees** shows one row per signed-up player:

| Column | Source |
| --- | --- |
| Player | nickname + level badge |
| Category | player's permanent category |
| Games | `SessionPlayer.gamesPlayed` |
| W / L | derived from completed matches |
| Flat | matched rule |
| Per game | matched rule |
| Total | `flat + perGame × games` |
| Paid | settlement state |
| Balance | `max(0, total - amountPaid)` |

Totals across the session (billed, collected, outstanding) are shown at the top.

### Recording payment

- **Mark paid** defaults the amount to the full total and the method to cash.
- The amount can be overridden — useful for partial payments or discounts. The balance is clamped at zero, so overpayment does not produce a negative balance.
- **Clear** sets `paid = false`, keeps the recorded amount only up to the total, and clears the method.
- **Mark all paid** applies the full computed total to every unpaid player with method `CASH`. Use it at the end of a clean session, not as a substitute for reconciliation.
- Methods: `CASH`, `GCASH`, `BANK`, `OTHER`.

Payment state is stored on `SessionPlayer` (`paid`, `amountPaid`, `paymentMethod`), so it is per game day, not per person across their lifetime.

## Where fees appear

1. **Fee ledger** — the operational view for collecting money.
2. **Excel export** — a “Players & Fees” sheet with the full breakdown, totals, and payment state.
3. **PDF export** — a summary table with totals, using `PHP 250` instead of `₱250` because standard PDF fonts lack the peso glyph.
4. **Board** — a paid indicator on player rows, so the queue master can see who still owes without leaving the board.

## Changing rates

1. Go to **Venues**.
2. Select KBC or DASC.
3. Edit the fee matrix.
4. Save.

Rules are stored per venue, so changing KBC does not affect DASC. Because game days reference the venue's rules at read time, **changing a rule changes the computed total for existing game days too** — including completed ones. If you need historical accuracy:

- Export the report for any completed session before changing rates, or
- Treat the exported workbook/PDF as the financial record of that session.

There is currently no effective-dated fee rule table. This is a known limitation; the export-before-change workflow is the intended mitigation.

## Adding a venue or category

- **Venue:** create it in Venues, then fill in its 9 fee rules (3 day types × 3 categories). Missing rules compute to 0 and will be obvious in the ledger.
- **Category:** categories are a Prisma enum (`ACTIVE`, `ALUMNI`, `APPLICANT`). Adding one requires a schema change, a migration, updates to `CATEGORY_LABELS`/`CATEGORY_SHORT`, the ledger filters, and the fee editor. The compiler will point at most of these.

## Reporting checklist for the treasurer

1. Finish the session and complete the game day.
2. Open **Fees** and reconcile any partial payments.
3. Open **Reports** and download both Excel and PDF.
4. Check that the Excel total matches the cash + GCash + bank received.
5. File the export; it is the immutable record for that date.

## Extras, change, and settling

On the **Fees** tab, press **Record** on a player to add what they bought or owe on top of court and shuttle fees:

- **Grips** — badminton grips sold on the day, ₱20 each (`GRIP_PRICE` in `lib/fees.ts`). Enter how many.
- **Other charge** — any other amount the finance member wants to charge, with a short reason (hover the Extras cell to see it).

Grips and other charges show in the **Extras** column and are included in **Total**, so Balance, the Payment list on the live view, and the PDF/Excel reports all include them. The ledger no longer shows a separate flat-fee column; the flat share appears in the split-cost summary above it.

If a player hands over more than they owe (usually cash with no coins), type the amount received. The **Change** column shows what to give back, and the toast says so. When the change has been handed over, tick **Settled**. Exact payments settle themselves; **Mark all paid** also settles everyone. Settled needs the player to be paid in full first, and it resets if their charges change.

## Split-cost scheme (any venue)

A game day can carry its own **Court rate per hour** instead of using the venue's fee matrix. Set it when you create the game day, or later in **Settings**. Leave it blank to keep using the venue rates.

- **Court cost** = rate × hours × courts, summed over every block of the court plan. Example: 3 courts 10:00–12:00 and 4 courts 12:00–14:00 is 14 court-hours; at ₱200 that is ₱2,800.
- **Flat fee** = court cost ÷ the players who checked in, rounded up to the next peso. Everyone pays the same share, whatever their category.
- **Shuttles**, per game played: Active ₱20 · Alumni, Inactive, Applicant ₱25 · Non-affiliate ₱30.
- **Total** = flat share + (games × shuttle rate). Free games still do not count.
- The share is recalculated from who is checked in, so it drops as more players arrive. Settle after the game day is complete; a player marked paid earlier keeps the amount recorded at that moment.

The Fees tab shows the breakdown (`court-hours × rate = cost ÷ players = share`). The rule lives in `buildFeeSchedule` in `lib/fees.ts`; the shuttle rates are `SPLIT_SHUTTLE_RATES` there.

## Tests

`lib/fees.test.ts` covers:

- Missing rule → 0.
- Zero games → flat fee only.
- Flat + per-game math, including zero flat and zero per-game.
- Negative games clamped.
- Fractional internal math.
- Peso formatting: symbol, thousands separators, rounding, negatives (`-₱250`).
- PDF formatting (`PHP`, no peso glyph).
- Label coverage for every enum value.

`lib/fee-split.test.ts` covers court-hours and cost, the round-up split, shuttle rates per category, and falling back to the venue rules.

Run with `pnpm test`.
