# Fees

Kyuwing records what each player owes for a session and whether they have paid. It does **not** process payments.

## How fees are calculated

Fees follow the finance team's **Gameday Finance Tracker** sheet, which is the standard, and are the same for every game-day type (Regular, Tipid, MEGA):

```
court rent = court rate × hours × courts   (summed over every court block)
base price = court rent ÷ players who checked in, rounded up to the next ₱5
total      = base price + shuttle rate × games played + ₱10 (applicants and Plus 1s) − voucher
           + extras (grips, other charges)
```

- **Queue masters on duty** (the nicknames in the game day's queue master field, e.g. "Roniel & Jgops") pay no base price, ₱20 a game whatever their category, and no surcharge. They still count as players when the rent is divided, as in the sheet. Matching is by nickname or one of the player's **Also goes by** names, ignoring case (`isQueueMasterOnDuty`).
- **₱10 surcharge** for Applicants and Non-affiliates ("Plus 1"), once per game day (`NON_MEMBER_SURCHARGE`).
- **Voucher**: a discount in pesos entered in the Record payment dialog (`SessionPlayer.voucher`). It never takes the fee below ₱0; grips and other charges are added after it.

**Default court rate**, per court per hour:

| Venue | Rate |
| --- | --- |
| DASC | ₱300 |
| KBC | ₱250 |

The rates live in `DEFAULT_COURT_RATES` (`lib/fees.ts`). A venue without a default has no court cost until the game day gets a rate. A game day can override the rate (New game day, or **Settings → Court rate per hour**); leaving it blank uses the venue's default.

**Shuttle rate per game**, by player category (`SPLIT_SHUTTLE_RATES`):

| Category | Per game |
| --- | --- |
| Active | ₱20 |
| Inactive, Alumni, Applicant | ₱25 |
| Non-affiliate | ₱30 |

Example: 3 courts 10:00–12:00 and 4 courts 12:00–14:00 is 14 court-hours. At KBC (₱250) the rent is ₱3,500; with 28 players the base price is ₱125. An Active player who played 3 games owes ₱125 + 3 × ₱20 = ₱185; an Applicant with 3 games owes ₱125 + 3 × ₱25 + ₱10 = ₱210; a queue master with 3 games owes 3 × ₱20 = ₱60. With 30 players the share is ₱116.67, so the base price is ₱120.

Key properties:

- **Games played is the multiplier, not games won.** A 35-point game counts once for everyone on court, win or lose.
- `gamesPlayed` increments when a match is completed, for all four players.
- **Free games** do not increment `gamesPlayed`, so they add nothing to anyone's fee. A free game is offered when a game starts within 15 minutes of the reservation's end and is played with a used shuttle (`Match.free`).
- Cancelled matches do not count. Suggested matches do not count until completed.
- The share is recalculated from who is checked in, so it drops as more players arrive. Settle after the game day is complete; a player marked paid earlier keeps the amount recorded at that moment.
- With nobody checked in there is no base price yet.
- Totals are worked out when the Fees tab or a report is opened, so these rules also apply to earlier game days.
- Negative game counts are clamped to 0.

### Retired: the per-venue fee matrix

Earlier versions had a **Venues → Fee table** with a flat + per-game fee for every venue, game-day type and player category, and a game day could opt into splitting the rent instead. That pre-setting of flat fees is deprecated: the Fee table is gone and the flat fee is always rent ÷ players. The `FeeRule` table is still in the database but is no longer read or written.

## The ledger

**Game day → Fees** shows one row per signed-up player:

| Column | Source |
| --- | --- |
| Player | nickname + level badge |
| Category | player's permanent category |
| Games | `SessionPlayer.gamesPlayed` |
| W / L | derived from completed matches |
| Total | `base price + shuttle rate × games + surcharge − voucher` + extras |
| Paid | settlement state |
| Balance | `max(0, total - amountPaid)` |

Totals across the session (billed, collected, outstanding) are shown at the top.

### Recording payment

- **Mark paid** defaults the amount to the full total and the method to cash.
- The amount can be overridden — useful for partial payments or discounts. The balance is clamped at zero, so overpayment does not produce a negative balance.
- **Voucher** takes a discount off the fee; the row's note shows it, with "QM on duty" and "+₱10" where they apply.
- **Clear** sets `paid = false`, keeps the recorded amount only up to the total, and clears the method.
- **Mark all paid** applies the full computed total to every unpaid player with method `CASH`. Use it at the end of a clean session, not as a substitute for reconciliation.
- Methods: `CASH`, `GCASH`, `BANK`, `OTHER`.

Payment state is stored on `SessionPlayer` (`paid`, `amountPaid`, `paymentMethod`), so it is per game day, not per person across their lifetime.

## Where fees appear

1. **Fee ledger** — the operational view for collecting money.
2. **Excel export** — laid out like the finance team's **Gameday Finance Tracker** sheet: one row per player with membership status, games, total, mode of payment and remarks (grips, other charges, sukli, balances), rows shaded green once paid, and the side panel with base price, rent, shuttles used, expenses, estimated revenue and totals by payment method. The shuttle tube price (₱880) can be edited in the sheet.
3. **PDF export** — a summary table with totals, using `PHP 250` instead of `₱250` because standard PDF fonts lack the peso glyph.
4. **Board** — a paid indicator on player rows, so the queue master can see who still owes without leaving the board.

## Changing rates

The default rates are in code (`DEFAULT_COURT_RATES`). If a venue changes its price for one game day, set **Court rate per hour** in that game day's Settings. Because the fee is computed from the game day's plan and rate at read time, editing the plan, rate or attendance recalculates the total for that game day, including completed ones. Export the report for a completed session first if you need the old figures; the exported workbook/PDF is the financial record.

## Adding a venue

Create it in **Venues**. With no default rate its court cost is ₱0 until you set **Court rate per hour** on each game day, or add the venue to `DEFAULT_COURT_RATES`.

## Reporting checklist for the treasurer

1. Finish the session and complete the game day.
2. Open **Fees** and reconcile any partial payments.
3. Open **Reports** and download both Excel and PDF.
4. Check that the Excel **Cash** and **Gcash** totals match what was received.
5. File the export; it is the immutable record for that date.

## Extras, change, and settling

On the **Fees** tab, press **Record** on a player to add what they bought or owe on top of court and shuttle fees:

- **Grips** — badminton grips sold on the day, ₱20 each (`GRIP_PRICE` in `lib/fees.ts`). Enter how many.
- **Other charge** — any other amount the finance member wants to charge, with a short reason (hover the Extras cell to see it).

Grips and other charges show in the **Extras** column and are included in **Total**, so Balance, the Payment list on the live view, and the PDF/Excel reports all include them. The ledger no longer shows a separate flat-fee column; the flat share appears in the split-cost summary above it.

If a player hands over more than they owe (usually cash with no coins), type the amount received. The **Change** column shows what to give back, and the toast says so. When the change has been handed over, tick **Settled**. Exact payments settle themselves; **Mark all paid** also settles everyone. Settled needs the player to be paid in full first, and it resets if their charges change.

The Fees tab shows the breakdown (`court-hours × rate = rent ÷ players = share`). The rule lives in `buildFeeSchedule` in `lib/fees.ts`.

## Tests

`lib/fees.test.ts` covers the fee math (zero games, flat + per-game, negatives clamped), peso formatting and label coverage for every enum value.

`lib/fee-split.test.ts` covers court-hours and cost, the round-up split, the DASC/KBC default rates and overrides, and shuttle rates per category.

Run with `pnpm test`.
