# Architecture

Kyuwing is a single-tenant Next.js application backed by PostgreSQL. This document covers the data model, the request/response flow, authentication, and the choices that keep the live board fast.

## System overview

```
Browser (queue master tablet/phone)
   │
   ├── Server-rendered pages       app/app/**
   ├── Server actions              lib/actions/**
   └── Polling (SWR, ~4s)          GET /api/gamedays/[id]/board
                │
        Next.js server (Vercel)
                │
          Prisma 6 client
                │
           PostgreSQL
```

There is no separate API tier and no client-side state store. Pages render on the server, mutations run as server actions, and the live board refetches a single JSON endpoint on an interval.

## Data model

Eight tables, all defined in [`prisma/schema.prisma`](../prisma/schema.prisma).

```
Venue 1──* FeeRule
Venue 1──* GameDay
GameDay 1──* SessionPlayer *──1 Player
GameDay 1──* Match 1──* MatchPlayer *──1 Player
GameDay 1──* PairingRequest *──1 Player (requesting)
                            *──1 Player (target)
```

### Venue

Where play happens. `shortName` is the unique code (`KBC`, `DASC`). `dayOfWeek` drives the default schedule, and the default start/end/courts pre-fill a new game day. Court blocks are **not** stored here — they belong to each game day, because bookings change week to week.

### FeeRule

The pricing matrix: one row per `(venue, dayType, category)`. Amounts are whole pesos. See [FEES.md](FEES.md).

### Player

The permanent roster. `nickname` is the unique display key — queue masters know people by nickname. `level` is one of 19 enum values; `category` is `ACTIVE`, `ALUMNI`, or `APPLICANT`; `active` controls whether "add all active players" includes them. Players are never hard-deleted once they have session history unless an operator explicitly does so.

### GameDay

A single session. Three states:

| Status | Meaning |
| --- | --- |
| `DRAFT` | Being set up. Not on the live board. Players can still be added. |
| `LIVE` | Running. The board accepts check-ins, pairings, and scores. |
| `COMPLETED` | Frozen. Leftover suggestions are cancelled and the report is final. |

`courtPlan` is a JSON array of `{ id, label, start, end, courts }`. It is intentionally not relational: it is small, edited as a unit, and only read for the current board. `parseCourtPlan` validates it defensively because it comes from the database as `Json`.

### SessionPlayer

The join between a person and one game day, and the heart of the queue.

| Field | Purpose |
| --- | --- |
| `status` | `EXPECTED` → `WAITING` → `PLAYING` → `DONE` |
| `joinedAt` | When they signed up/were added |
| `queuedAt` | When they checked in — **wait time is measured from here** |
| `lastPlayedAt` | Used for fairness display and diagnostics |
| `gamesPlayed` | Incremented on match completion; drives both fairness and fees |
| `permanentPartnerId` | Player id of a mutual permanent partner for the day |
| `priority` | Manual bump for someone leaving early or unfairly skipped |
| `paid`, `amountPaid`, `paymentMethod` | Settlement state |

The unique constraint `(gameDayId, playerId)` prevents duplicate sign-ups.

### Match and MatchPlayer

A match belongs to a game day, occupies a court number, carries a round number, and has a status: `SUGGESTED`, `LIVE`, `COMPLETED`, `CANCELLED`.

`MatchPlayer` stores `team` (1 or 2) and `slot` (1 or 2 within the team). Storing the side explicitly means the board never has to infer teams from array order, and manual swaps are straightforward.

### PairingRequest

A soft preference for one game day: `PAIR_WITH` or `PLAY_AGAINST` a target player. Requests are scoped to the day and can be deactivated without deleting the record. Permanent partners are stored on `SessionPlayer` instead because they are a stronger, day-long commitment.

## Request flow

### Reads

Pages call `lib/queries.ts` directly during server rendering. Query functions own the Prisma `include` graph and map rows into DTOs from `lib/board-types.ts`. Nothing leaks Prisma models into client components.

- `getBoard(gameDayId)` — the full board DTO: game day, venue, players, requests, matches, court plan, and computed stats.
- `getFeeLedger(gameDayId)` — rows with computed totals, balances, wins/losses.
- `getReport(gameDayId)` — the same data shaped for Excel/PDF.
- `getPlayers()`, `getVenues()`, `getGameDays()` — management screens.

### Writes

All mutations are server actions in `lib/actions/`:

| File | Responsibility |
| --- | --- |
| `auth.ts` | PIN login/logout |
| `gamedays.ts` | Game day lifecycle, sign-ups, check-in, pairing, matches, payments |
| `players.ts` | Roster CRUD, CSV/JSON import |
| `venues.ts` | Venue details and fee matrix |

Each action:

1. Calls `guard()` (session check) and returns a typed failure if unauthenticated.
2. Validates input with Zod.
3. Performs the Prisma mutation, usually in a transaction when multiple rows change.
4. Calls `refreshGameDay(id)` to invalidate/refresh derived state.
5. Returns `{ ok: true, message, data }` or `{ ok: false, error }`.

Client components invoke actions inside `React.startTransition` and surface the result with a Sonner toast. The UI never assumes success.

### Polling

The live board is the only frequently refreshed surface. `components/app/queue-board.tsx` uses SWR against `GET /api/gamedays/[id]/board`, which returns the same `BoardData` DTO as the server-rendered page. The route is authenticated and returns `401` when the session is missing.

Polling keeps multiple devices (queue master tablet, spare phone) in sync without websockets. The interval is short enough to feel live and long enough not to hammer the database on a hobby deployment.

## Pairing engine boundary

`lib/pairing.ts` is deliberately pure and synchronous. It receives plain player objects and match history, and returns suggestions. It has no Prisma, React, or `Date` dependency — wait times arrive as `waitMinutes`. This makes the engine fast to test and safe to change.

`generateMatches` (in `lib/actions/gamedays.ts`) is the adapter: it loads waiting players, converts timestamps to wait minutes, loads active requests and completed-match history, computes free courts for the selected block, calls `suggestMatches`, and persists the results as `SUGGESTED` matches.

See [PAIRING.md](PAIRING.md).

## Authentication

One shared queue-master identity.

1. The login form posts a name and PIN to `loginAction`.
2. `checkPin` compares SHA-256 digests with `timingSafeEqual`; the expected PIN comes from `QUEUE_MASTER_PIN` (development fallback: `1234`).
3. On success, `createSession` signs a JWT (`HS256`, 14-hour expiry) with `AUTH_SECRET` and sets it as an HTTP-only, `SameSite=Lax` cookie (`Secure` in production).
4. `app/app/layout.tsx` calls `getSession()` and redirects to `/login?next=/app` when absent.
5. API routes and server actions re-check the session; the layout guard is not the only line of defense.

There are no player accounts. Players never log in, and no personal data beyond nickname, optional full name, optional contact, and notes is stored.

## Error handling

- Expected validation failures return `{ ok: false, error }` and render as toasts. They are not exceptions.
- Route-level errors hit `app/error.tsx`; unknown routes hit `app/not-found.tsx`.
- The board treats a failed poll as transient and keeps the last good data on screen.

## Exports

- **Excel** (`app/api/gamedays/[id]/export/xlsx/route.ts`) builds a workbook with Summary, Players, Matches, and Fees sheets via ExcelJS. Creator metadata carries the app credit.
- **PDF** (`app/api/gamedays/[id]/export/pdf/route.ts`) draws a print-ready summary with pdf-lib. Standard fonts lack `₱`, so amounts render as `PHP 250`.
- **Roster export** (`app/api/players/export/route.ts`) produces a CSV of the player database.

Both report routes authenticate, stream the file with a `Content-Disposition` filename, and never write to disk.

## Performance notes

- The board query is a handful of indexed reads. Indexes exist on `GameDay(date)`, `GameDay(status)`, `SessionPlayer(gameDayId, status)`, `Match(gameDayId, status)`, and `MatchPlayer(playerId)`.
- The pairing search is bounded: it sorts by priority/wait, caps the candidate pool, and evaluates foursomes and splits within that pool. It is not exponential in the full queue size.
- Server components are used for every page except the interactive board, sign-ups, ledger, settings, and marketing demo.

## Deliberate non-goals

- Multi-tenant organizations, per-user permissions, and audit logs.
- Real-time websockets.
- Offline-first sync.
- Tournament brackets; Kyuwing is for open-play queueing.
- Payment processing; it records payments, it does not collect them.
