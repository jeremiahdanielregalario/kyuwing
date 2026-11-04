# Pairing engine

`lib/pairing.ts` answers one question: **of the players currently waiting, which four should play next, and who partners whom?**

It is pure, synchronous, and database-free. Wait time arrives as `waitMinutes`, so the engine never touches the clock. That makes it deterministic and easy to test.

```
findBestMatch(players, history, options) → PairingSuggestion | null
suggestMatches(players, history, { courts }) → PairingSuggestion[]
```

## The short version

1. Sort the queue by priority, then longest wait, then fewest games.
2. Take a candidate pool (max 14 by default), pulling in the partner of any permanent pair so it is never half-included.
3. Build “units”: a mutual permanent pair is one unit of two; everyone else is a unit of one.
4. Enumerate every combination of units that totals exactly four players.
5. For each foursome, try all three team splits.
6. Reject any split that puts a mutual permanent pair on opposite sides.
7. Score every remaining candidate with a weighted cost. Lowest cost wins.
8. For multiple courts, remove the chosen four and repeat.

## Cost model

Lower is better. Penalties add; bonuses subtract (negative cost).

| Factor | Weight | Direction |
| --- | ---: | --- |
| Team strength difference (`abs(team1 - team2)`) | ×48 per level step | penalty |
| Cross-bracket teammate (gap > 1) | ×55 per bracket beyond one | penalty |
| Large numeric teammate gap (more than 3 level steps) | ×5 per extra step | penalty |
| Repeated teammate (every prior time) | ×150 each | penalty |
| Same teammate within the last 3 rounds | +110 | penalty |
| Repeated opponent (every prior time) | ×20 each | penalty |
| Same opponent within the last 3 rounds | +14 | penalty |
| Repeated exact foursome (every prior time) | ×260 each | penalty |
| Same foursome within the last 3 rounds | +130 | penalty |
| Wait time | −1.15 per minute, capped at 120 min | bonus |
| Games already played | +17 per game | penalty |
| Priority player | −90 | bonus |
| `PAIR_WITH` honored (teammates) | −135 | bonus |
| `PLAY_AGAINST` honored (opponents) | −115 | bonus |
| `PAIR_WITH` violated (opponents) | +95 | penalty |
| `PLAY_AGAINST` violated (teammates) | +80 | penalty |

### What dominates

Team balance is the strongest structural signal: one level of imbalance costs 48, which is more than roughly 40 minutes of wait bonus. That is intentional — a lopsided game is worse than a slightly longer wait.

Repeating a teammate is the next strongest signal (150 plus 110 if recent), and repeating an entire foursome is stronger still (260 plus 130 recent). A fresh, balanced foursome will almost always beat a stale one, even if the stale one has waited longer.

Requests are weighted heavily but not absolutely. Honoring a partner request is worth −135; violating it costs +95. A request will lose to a team-balance difference of about three level steps, which is the intended “bend, don't break” behavior.

### Scarcity mode

When the queue is thin, strict bracket rules can make a match impossible. Scarcity mode:

- Multiplies the cross-bracket penalty by **0.2** (55 → 11 per bracket).
- Does **not** remove the requirement that teams balance.

`findBestMatch` defaults `scarcity` to `players.length < 8`. `suggestMatches` re-evaluates it per court as the remaining pool shrinks. The server action `generateMatches` explicitly passes `scarcity: waiting.length < 10`, because bench depth determines whether crossing brackets is socially acceptable better than raw court count does.

When scarcity mode produces a cross-bracket pairing, the suggestion is flagged `crossBracket: true` and the board shows the reason “Cross-bracket fill for scarcity.”

## Bracket rules

Levels map to numeric values 0–18 and to five brackets:

```
value:   0  1  2 | 3  4  5  6 | 7  8  9 10 | 11 12 13 14 | 15 16 17 18
label:  E-  E  E+ |DE D-  D  D+ |CD C-  C C+ |BC B-  B  B+ |AB A-  A  A+
bracket:    E     |     D      |     C      |     B      |     A
```

- **Same bracket** (gap 0): free.
- **One bracket apart** (gap 1): free. A C+ may partner a D-.
- **Two or more brackets apart** (gap > 1): penalized 55 per extra bracket, reduced to 11 in scarcity.
- **Numeric gap > 3**: an additional 5 per extra step, to discourage, say, C+ with D- even though they are adjacent brackets.

The rule is applied to **teammates**, not opponents. Opponents of different levels are fine as long as the teams balance; the balance term handles the rest.

## Permanent pairs

A permanent pair is mutual: `a.permanentPartnerId === b.id` **and** `b.permanentPartnerId === a.id`.

- The pair is treated as a single unit when building foursomes.
- If one partner is in the candidate pool and the other is not, the other is pulled in — even if their wait is shorter.
- Any split that puts the pair across the net is rejected outright, not merely penalized.
- The engine will bench the pair together rather than split them.

## Requests

Requests are day-scoped and directional in storage (`playerId` requests `targetPlayerId`), but evaluated as edges:

- `PAIR_WITH` creates a “should be teammates” edge.
- `PLAY_AGAINST` creates a “should be opponents” edge.

Edges only count when both players are in the foursome. Honoring one adds a bonus and sets `honorsRequest`; violating one adds a smaller penalty. Because they are costs rather than constraints, a request never forces an unfair match.

Permanent partners are a stronger rule than a `PAIR_WITH` request and are enforced as a hard constraint.

## Wait time and fairness

- Wait is measured from `queuedAt` (check-in), never from sign-up.
- The wait bonus is capped at 120 minutes so a single very long wait cannot dominate team balance.
- Games played adds 17 per game, which is why someone on their fourth game loses to someone on their first when other factors are close.
- Priority subtracts 90 — roughly five games’ worth — which is enough to pull someone forward without letting them jump repeatedly.

Tie-break: if two candidates have exactly equal cost, the one with the higher average wait wins.

## Multi-court behavior

`suggestMatches` fills courts sequentially:

```
remaining = all waiting players
for each court:
    pick best match from remaining
    remove those four from remaining
```

This guarantees no player appears on two courts in the same wave. It also means the second court is filled from a slightly worse pool — expected, and preferable to duplicate assignments.

The number of courts is the number of currently free courts in the active block, capped at 12. A court is “busy” if it has a `SUGGESTED` or `LIVE` match.

### Next up (queued games)

### Placed players (fill the rest)

The queue master can drop 1 to 3 players on a court's slots and press Pair. `generateMatches` takes `seeds` (player and side) and an explicit `courtNumber`; the seeds go to the engine as `mustInclude` plus `sides`, which keeps players placed on the same side as partners and different sides as opponents, and orients the returned teams to the sides they were put. The rest of the match is chosen as usual. Seeds must be waiting and free (or, for the waiting court, free by the game's estimated start), a team holds two, and four seeds are refused because that is already a full court. Tests: "placed players (sides)" in `lib/pairing.test.ts`.

### Planning ahead (waiting courts)

`lib/planning.ts` estimates when courts free up (`GAME_MINUTES` = 15 per game) and when each game in the waiting line should start: every game takes the court that frees first and holds it for a game's length. A player's `availableAt` is the end of their live game or of the latest waiting game they are in. When fewer than four idle players are waiting, `generateMatches` (queueing) widens the pool to anyone whose `availableAt` is at or before the new game's start and passes everyone idle as `mustInclude`, so idle players always play first and players on court only fill the gaps. Live and planned games count as history so the same four are not repeated.

Rules: waiting-court games can contain players on court or in other waiting games; real-court games still take waiting players only. At `startMatch`, only a **live** game blocks a player (`PLAYER_STILL_PLAYING`, with the expected finish time), and the board offers to re-pair. `promoteQueuedGames` moves only planned games whose four players are all free onto a freed court. Tests: `lib/planning.test.ts`, and "must include" in `lib/pairing.test.ts`.

The waiting line is ordered by `Match.createdAt` (then id). `reorderQueuedGame` moves a game with `moveInLine` and hands the existing timestamps back out in the new order (`lineTimes`, strictly increasing so equal times cannot tie), so promotion and the planning timeline follow the new order with no extra column.

### Regenerate

`regenerateMatches` swaps suggested games for different ones: all suggestions on the courts, or one game (on a court or in Next up) by id. It re-runs the same engine with `variety`: a repeatable pseudo-random shake of at most 30 cost points (under one level step, so fairness is not given up) plus an `avoid` list of arrangements, keyed by `arrangementKey` (who plays with whom, ignoring which side is "team 1"). Each replacement game stores what was rejected in `Match.rejected`, so successive presses never bring back an earlier lineup. The old games are deleted only in the same transaction that creates the new ones; if no other arrangement exists the suggestions stay as they were and the board says why. A regenerated Next up game keeps its place in line. Tests are in `lib/pairing.test.ts` ("regenerating with variety").

When every court is busy, auto-pair still runs: it builds **one** game from the players who are waiting and not already committed to a match, and stores it as a `SUGGESTED` match with `courtNumber = 0` (`QUEUED_COURT`). Queued games form a line ordered by creation time.

- Players in a queued game are committed like any other suggestion, so the next queued game is built from the rest of the queue and nobody is in two games.
- When a court frees up (a game ends or a court’s match is cancelled or moved), the oldest queued game moves onto it as a suggestion. The queue master still presses **Start** when the four are on court.
- Auto-pair with open courts serves the line first: queued games take the open courts before any new pairing happens.
- Queued games count as waiting time for their players, so fairness weights keep working while they wait.

## Worked examples

### Balanced mixed bracket

Queue: `C+`, `C+`, `D-`, `D-` (wait 10 min each, no history).

Candidate splits:

- `C+ + C+` vs `D- + D-` → team values 20 vs 8, balance 12 → cost 576.
- `C+ + D-` vs `C+ + D-` → 15 vs 15, balance 0 → cost 0.

The second split wins: one stronger player with one weaker player per side. Both teammates are within one bracket, so no cross-bracket penalty.

### Same-bracket four

Queue: `C-`, `C`, `C`, `C+`.

A zero-balance split exists (`C- + C+` vs `C + C`, both 18). The engine returns `balance: 0` and `crossBracket: false`.

### Permanent pair with a huge gap

Queue: `A+` (permanent with `E-`), `E-`, `C`, `C`.

The `A+`/`E-` pair must stay together, so the only legal splits put them on the same team:

- `A+ + E-` (18) vs `C + C` (18) → balance 0, but a two-bracket teammate gap.
- `A+ + C` vs `E- + C` → balance 10 → cost 480.

The first split wins on balance despite the gap; the pair is preserved. This is the intended behavior: honoring a committed pair outranks bracket purity.

### Repeat foursome avoidance

Eight `C` players, all waiting 5 minutes. Players `p1–p4` played together in round 1.

The exact foursome `p1–p4` carries 260 + 130 = 390 in penalties. Any fresh foursome with the same wait and balance costs 0. The engine picks a fresh four, so at least one of `p1–p4` rotates out.

### Thin queue

Queue: `A+`, `A`, `E-`, `E` (four players, so scarcity is on by default).

Every split crosses at least two brackets. With scarcity, the cross-bracket penalty is 11 per extra bracket instead of 55, so a match is produced rather than returning nothing. `crossBracket` is `true` and the reason reads “Cross-bracket fill for scarcity.”

## Tuning

Weights are constants at the top of `lib/pairing.ts`. If you change one:

1. Update the table above.
2. Add or adjust a test in `lib/pairing.test.ts`.
3. Run `pnpm test`.
4. Sanity-check on the demo board (`pnpm db:seed`, then open the live game day) with a realistic queue.

Things to be careful about:

- Raising `TEAM_DIFF_WEIGHT` makes games fairer but can starve high-level players when the pool is shallow.
- Raising `REPEAT_TEAMMATE_WEIGHT` increases variety but may push wait times up.
- Lowering `WAIT_WEIGHT` makes the queue feel unfair; raising it too far makes matches lopsided.
- `PRIORITY_WEIGHT` should stay below a few games’ worth (`GAMES_WEIGHT × 4` ≈ 68 is a reasonable floor) so priority cannot be abused indefinitely.

## Test coverage

`lib/pairing.test.ts` covers:

- Fewer than four players → `null`.
- Balanced split with mixed brackets.
- Zero-gap same-bracket four.
- Longest-waiting four preferred in a deep queue.
- Permanent pair never split.
- `PAIR_WITH` honored when fair.
- `PLAY_AGAINST` honored when fair.
- Repeated foursome avoided.
- Scarcity lowers cost and sets `crossBracket`.
- Default scarcity below eight players.
- Multi-court fill without duplicates.
- Stops when there are not enough players.
- Empty list under four players.
