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
| `LIVE` | Running. The board accepts check-ins, pairings, and manual court edits. |
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
| `venues.ts` | Venue details |

Each action:

1. Calls `guard()` (session check) and returns a typed failure if unauthenticated.
2. Validates input with Zod.
3. Performs the Prisma mutation, usually in a transaction when multiple rows change.
4. Calls `refreshGameDay(id)` to invalidate/refresh derived state.
5. Returns `{ ok: true, message, data }` or `{ ok: false, error }`.

Client components invoke actions inside `React.startTransition` and surface the result with a Sonner toast. The UI never assumes success.

### Polling

The live board is the only frequently refreshed surface. `components/app/queue-board.tsx` uses SWR against `GET /api/gamedays/[id]/board`, which returns the same `BoardData` DTO as the server-rendered page. The route is authenticated and returns `401` when the session is missing.

Presses on the board take one round trip. The server action calls `refreshGameDay`, so its response already carries the redrawn page; `QueueBoard` copies that fresh `initialData` into the SWR cache instead of fetching again. Common presses (Start, Finish, Cancel, Check in, Done, Requeue) update the screen first with pure helpers in `lib/board-optimistic.ts`, and a failed action refetches to roll back. Sign-ups does the same with React's `useOptimistic`. Pages that load a game day for both their title and their body share one load per request (`getBoardData` and `getFeeReport` are wrapped in React `cache`).

Players get a separate, public, view-only board at `/live/[id]/[key]`, polled from `GET /api/live/[id]/[key]`. The key is an HMAC of the game-day id with `AUTH_SECRET` (`lib/share.ts`), so links can't be guessed or pointed at another game day, and nothing is stored. Both routes return `toPublicBoard(data)` (`lib/public-board.ts`), which strips everything private: full names, contacts, categories, fees, payments, notes, and requests. The board shares the link through `components/app/share-live-dialog.tsx`: the message text comes from `lib/share-message.ts`, and the QR code is drawn client-side on a canvas (`qrcode`, error correction H so the icon in the middle still scans) and downloaded as a PNG data URL, so nothing is written on the server. Whether the link was already shared is kept per device in `localStorage` (`kyuwing.live-shared.<gameDayId>`), which drives the reminder pop-up.

The public roster (`app/roster/page.tsx`) is unauthenticated and read-only. `getPublicRoster()` selects every player's nickname, full name, level, category and active flag only, and `toPublicRoster()` (`lib/public-roster.ts`) re-keys recency, attendance history and awards by short aliases, so no contacts, notes or database ids reach the page. Archived players carry `archived: true`: the list hides them until **Show archived** is pressed, and the stats and bracket chart count active players only (`lib/public-roster.test.ts` checks this). It reuses the Players components in `readOnly` mode (`PlayerManager`, `RecencyPanel`, `AwardsPanel`, plus `BracketSpread`), which hides every edit, import and export control. The live view links to it with `?back=/live/<id>/<key>`; the page only accepts a `/live/...` path there.

Starting a draft game day goes through `startGameDay(id, setup)` (`lib/actions/gamedays.ts`) from `components/app/start-game-day-dialog.tsx`. `lib/court-setup.ts` holds the pure rules (one name per court, run-of-numbers resizing, `applyCourtSetup`). The action saves the confirmed counts and names into `courtPlan`, sets the status to LIVE, and moves suggested games on courts that no longer exist to the Next up line.

Polling keeps multiple devices (queue master tablet, spare phone) in sync without websockets. The interval is short enough to feel live and long enough not to hammer the database on a hobby deployment.

## Pairing engine boundary

`lib/pairing.ts` is deliberately pure and synchronous. It receives plain player objects and match history, and returns suggestions. It has no Prisma, React, or `Date` dependency — wait times arrive as `waitMinutes`. This makes the engine fast to test and safe to change.

`generateMatches` (in `lib/actions/gamedays.ts`) is the adapter: it loads waiting players, converts timestamps to wait minutes, loads active requests and completed-match history, computes free courts for the selected block, calls `suggestMatches`, and persists the results as `SUGGESTED` matches.

See [PAIRING.md](PAIRING.md).

## Authentication

One shared queue-master identity, plus a separate developer identity.

1. The login form posts a name and PIN to `loginAction` (`mode: "master" | "admin"`).
2. `checkPin` / `checkAdminPin` compare SHA-256 digests with `timingSafeEqual`; expected values come from `QUEUE_MASTER_PIN` (development fallback: `1234`) and `ADMIN_PIN` (no fallback — developer sign-in is disabled when unset).
3. On success, `createSession` signs a JWT (`HS256`, 14-hour expiry) with `AUTH_SECRET` and sets it as an HTTP-only, `SameSite=Lax` cookie (`Secure` in production). Developer sessions carry an `admin: true` claim.
4. `app/app/layout.tsx` calls `getSession()` and redirects to `/login?next=/app` when absent.
5. API routes and server actions re-check the session; the layout guard is not the only line of defense. `lib/actions/ui-config.ts` additionally requires `isAdmin()`.

### Motion and feel

Motion tokens live in `app/globals.css`: `--ease-fluid` for movement, `--ease-spring` for things that pop, `--ease-exit` for leaving. Shared utilities are `press` (scale-on-tap feedback, used by `buttonVariants`), `glass` (frosted bars), `skeleton` (loading shimmer) and `animate-page-in` / `animate-pop-in` / `animate-live-ring`. `Modal` is a bottom sheet under 640px (swipe the header down to close) and a centred dialog above it; it stays mounted for its exit animation. `app/app/template.tsx` eases each page in, and `loading.tsx` files show `components/ui/skeleton.tsx` placeholders. `lib/haptics.ts` gives a short vibration on supporting phones. On the live board, `haptic()` fires on action success or failure, game start and end, and drag start and drop; court cards are keyed by court and match so a new game pops in; the main actions sit in a sticky `glass` bar; the drag overlay is portalled to `document.body` (the page wrapper's entry transform would otherwise offset its fixed position), pinned to the pointer by a modifier, and drop targets are hit-tested at the pointer (`pointerWithin`, falling back to the nearest valid target); and from `lg` the queue is a sticky side column with its own scroll box (below `lg`, by default, it is a split-screen panel portalled to `document.body` and fixed above the bottom nav, marked `data-queue-panel`; the board adds a spacer of the same height under the courts, the collision detector returns no target while the pointer is over the panel, and a rAF loop scrolls the window with `behavior: "instant"` while the finger is in the 64px band above it; the preference is stored in `localStorage` under `kyuwing.board-split`, and when off the queue scrolls with the page) while the courts column is a `@container` whose grid goes to two or three columns by its own width. Below `md`, the Fees ledger and the player database render a card list (`ul.md:hidden`) instead of their wide tables (`hidden md:block`); both read the same filtered rows. A `prefers-reduced-motion` block turns all of it off.

### Developer UI customization

`/login?mode=admin` unlocks a "Customize UI" button. Only elements tagged with a `data-trim-id` listed in `lib/ui-trim.ts` can be hidden, so critical controls are never removable. Hidden ids are stored globally in `AppSetting` under `ui.hidden.v1`; every `/app` layout injects the matching `display: none` rules, which makes the change apply to every queue master on every device. The developer can restore individual pieces or everything from the trim toolbar.

There are no player accounts. Players never log in, and no personal data beyond nickname, optional full name, optional contact, and notes is stored.

## Error handling

- Expected validation failures return `{ ok: false, error }` and render as toasts. They are not exceptions.
- Route-level errors hit `app/error.tsx`; unknown routes hit `app/not-found.tsx`.
- The board treats a failed poll as transient and keeps the last good data on screen.

## Exports

- **Excel** (`app/api/gamedays/[id]/export/xlsx/route.ts`) builds a workbook with Summary, Players & Fees, and Match History sheets via ExcelJS, each headed by the UP BadAss wordmark. Reports use the app's black and gold, list the game day's queue master and finance member, and do not carry the app credit. The wordmark is embedded as base64 (`lib/brand-logo.ts`) so export routes never read `public/` at runtime.
- **PDF** (`app/api/gamedays/[id]/export/pdf/route.ts`) draws a print-ready summary with pdf-lib. Standard fonts lack `₱`, so amounts render as `PHP 250`.
- **Roster export** (`app/api/players/export/route.ts`) produces a CSV of the player database.

The Messenger sign-up list is parsed by `lib/signup-text.ts` (pure: header, `QM:`/`FIN:` roles, `@` mentions, waitlist, matching against official nicknames, suggestions) and checked against the database by `lib/signup-check.ts`. `createGameDay` and `addPlayersFromText` re-check the list on the server and refuse anything that is not entirely official nicknames, whatever the browser sent.

Playing time per player (`lib/play-time.ts`, from each finished match's `startedAt` to `endedAt`) appears on the in-app Reports page only, in the Player leaderboard. It is deliberately absent from both exports; a test in `lib/play-time.test.ts` fails if either export route starts using it.

Both report routes authenticate, stream the file with a `Content-Disposition` filename, and never write to disk.

## Performance notes

- The board query is a handful of indexed reads. Indexes exist on `GameDay(date)`, `GameDay(status)`, `SessionPlayer(gameDayId, status)`, `Match(gameDayId, status)`, and `MatchPlayer(playerId)`.
- The pairing search is bounded: it sorts by priority/wait, caps the candidate pool, and evaluates foursomes and splits within that pool. It is not exponential in the full queue size.
- Server components are used for every page except the interactive board, sign-ups, ledger, settings, and marketing demo.

## Installable app

`app/manifest.ts` serves the web app manifest (standalone display, `start_url` `/app`, icons in `public/icons/`, generated from `app/icon.svg`; `app/apple-icon.png` is the iOS home-screen icon. The icon is the UP BadAss emblem, the feather from the official logo without the lettering, on white; `public/brand/upbadass-emblem.svg` is the same emblem for `BrandMark` in the UI, while reports keep the full wordmark). `public/sw.js` is a minimal service worker registered from the root layout by `ServiceWorkerRegistration` (`components/install-app.tsx`). It only handles navigations: network first, and an inline "You're offline" page if the network fails. It caches nothing, so authenticated board data never lands in a cache, and a deploy takes effect on the next load. `InstallAppButton` captures `beforeinstallprompt` at module load (it can fire before any button mounts), shows the iOS Share → Add to Home Screen steps where there is no install event, and hides in standalone mode or after `appinstalled`. `InstallReminder` (rendered in the app shell) is the post-sign-in pop-up: `LoginForm` sets a `sessionStorage` flag on success, and the pop-up opens while that flag is set and the install mode is `prompt` or `ios`; answering it clears the flag.

## Deliberate non-goals

- Multi-tenant organizations, per-user permissions, and audit logs.
- Real-time websockets.
- Offline-first sync.
- Tournament brackets; Kyuwing is for open-play queueing.
- Payment processing; it records payments, it does not collect them.
