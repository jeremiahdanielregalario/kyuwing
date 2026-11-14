# Kyuwing

**Fair doubles queues for UP BadAss.** Kyuwing runs a badminton game day from sign-up to settlement: arrival-based queueing, balanced auto-pairings, court blocks, fee tracking, and Excel/PDF reports — all from one tablet-friendly board.

> App by **Danyel Regalario** · Built for the UP Badminton Association in Diliman (UP BadAss).

---

## Why Kyuwing

Running open-play doubles by hand is a juggling act: who has waited longest, who has already partnered whom, which court is free, who still owes money. Kyuwing takes the bookkeeping off the queue master's hands while keeping the human in control.

- **Arrival is the queue.** Sign-ups are only a list of expected players. A wait timer starts at check-in, not at sign-up.
- **Balanced games, not random ones.** The engine weighs every foursome and every team split, then picks the fairest available match.
- **Repeat pairings fade out.** Teammates, opponents, and whole foursomes are penalized if they keep recurring.
- **Court blocks match reality.** Set the game time (say 9 AM–12 PM), then split it: “3 courts from 9–10, 4 courts from 10–12” is a first-class setting, and blocks always stay inside the game time.
- **Fees follow the finance sheet.** Base price = total court rent ÷ players, rounded up to ₱5 (DASC ₱300, KBC ₱250 per court per hour), plus a shuttle rate per game by player type, ₱10 more for applicants and Plus 1s, less any voucher. Queue masters on duty pay ₱20 a game only.
- **Reports the treasurer can use.** One click for a formatted Excel workbook or a print-ready PDF.

## Feature tour

| Area          | What it does                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Game days     | Draft → Live → Completed lifecycle, venue, date, type, court blocks                                             |
| Sign-ups      | Add from the player database, add all active players, CSV/JSON import, walk-ins                                 |
| Live board    | Expected / Waiting / Playing / Done lanes, live wait timers, court-surface cards                                |
| Court control | Tap or drag: move a match to another court, swap players between slots, place four players on an open court     |
| Pairing       | Multi-court auto-pair, single-court suggestions, drag-and-drop edits, requests                                  |
| Requests      | Partner-with, play-against, and permanent partners per game day                                                 |
| Players       | 19-level ladder (`E-` … `A+`), nickname + full name, category, active flag                                      |
| Public roster | View-only `/roster` for players: levels, type, recency, attendance and awards; no contacts, edits or exports    |
| Recency       | Log and edit game-day and tournament chat lists; each player is scored and banded by how recently they play     |
| Awards        | Paste tournament results; podium players get a trophy showing each title and their doubles partner or teammates |
| Fees          | Venue/type/category fee rules, per-player ledger, cash/GCash/bank/other                                         |
| Reports       | Session summary, player breakdown, Excel (`.xlsx`) and PDF export                                               |
| Ops guide     | In-app queue-master playbook with checklists and FAQs                                                           |
| Install       | Installable web app (manifest + service worker): its own window and home-screen icon; offline fallback page     |

### Player levels

The 19-step ladder follows the UP BadAss convention, grouped into five brackets used by the pairing rule:

```
E:   E-  E  E+
D:   DE  D-  D  D+
C:   CD  C-  C  C+
B:   BC  B-  B  B+
A:   AB  A-  A  A+
```

Brackets are `E → D → C → B → A`; the engine prefers partners and opponents within the same bracket, tolerates one bracket up or down, and only crosses further when the queue is thin.

A player can also be **X** (not rated yet), typically a new applicant whose official level is not known. X is not on the ladder: the engine never picks an X player by itself, a game with an X player cannot start, and the queue board pops up **Set levels** for any X player on the game day so the queue master can rate them first.

### Venues

| Code | Venue                     | Default day | Default hours | Default courts |
| ---- | ------------------------- | ----------- | ------------- | -------------- |
| KBC  | Kalayaan Badminton Center | Monday      | 10:00–14:00   | 3              |
| DASC | Don Antonio Sports Center | Saturday    | 09:00–13:00   | 4              |

Both venues and their court blocks are editable in **Venues**.

### Game-day types

- **Regular** — the standard session.
- **Tipid** — court fee only, used shuttles.
- **MEGA** — larger scale, higher fee tier.

> **Fees are fixed.** The court rate is fixed per venue (DASC ₱300, KBC ₱250 per court per hour; a game day can override it), and the base price is always the total rent divided by the players who checked in, rounded up to ₱5. The old per-venue fee matrix is retired. See [docs/FEES.md](docs/FEES.md).

## Tech stack

- [Next.js 16](https://nextjs.org) App Router + React 19 + TypeScript
- Tailwind CSS 4 with a custom forest/lime/cream design system
- PostgreSQL via [Prisma 6](https://www.prisma.io)
- Zod validation, server actions, JWT session cookie (`jose`)
- [SWR](https://swr.vercel.app) polling for the live board
- [ExcelJS](https://github.com/exceljs/exceljs) and [pdf-lib](https://pdf-lib.js.org) for reports
- [Vitest](https://vitest.dev) for the pairing, fee, and date/time test suites

## Quick start

### Prerequisites

- Node.js 20.9+ (22 LTS recommended)
- pnpm 10+
- Docker (for the local Postgres container)

### 1. Install

```bash
git clone https://github.com/jeremiahdanielregalario/kyuwing.git
cd kyuwing
pnpm install
```

### 2. Start Postgres

```bash
docker compose up -d
```

This starts `postgres:16-alpine` on **port 5433** with user/password/database all set to `kyuwing`. Using a different Postgres? Point `DATABASE_URL` at it instead.

### 3. Configure the environment

```bash
cp .env.example .env
```

| Variable               | Required          | Purpose                                             |
| ---------------------- | ----------------- | --------------------------------------------------- |
| `DATABASE_URL`         | yes               | PostgreSQL connection string (pooled in production) |
| `DIRECT_URL`           | recommended       | Direct connection used by `prisma migrate`          |
| `QUEUE_MASTER_PIN`     | yes in production | Shared PIN for the queue-master login               |
| `ADMIN_PIN`            | optional          | Separate developer PIN; unlocks UI customization    |
| `AUTH_SECRET`          | yes in production | Signs the session cookie; use 32+ random characters |
| `NEXT_PUBLIC_APP_URL`  | recommended       | Absolute URL used in links and metadata             |
| `NEXT_PUBLIC_ORG_NAME` | optional          | Overrides the org name in the UI                    |

Generate a secret with `openssl rand -base64 32`.

### 4. Create the schema and demo data

```bash
pnpm db:deploy   # apply migrations
pnpm db:seed     # venues, 28 demo players, a live demo game day
```

### 5. Run it

```bash
pnpm dev
```

Open <http://localhost:3000>, go to **Queue master login**, and use the PIN from `.env` (`1234` by default in development).

## Scripts

| Command                  | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `pnpm dev`               | Start the dev server                                |
| `pnpm build`             | Generate the Prisma client and build for production |
| `pnpm start`             | Serve the production build                          |
| `pnpm lint`              | ESLint (Next.js core-web-vitals + TypeScript)       |
| `pnpm typecheck`         | `tsc --noEmit`                                      |
| `pnpm test`              | Run the Vitest suites once                          |
| `pnpm test:watch`        | Watch mode                                          |
| `pnpm format`            | Prettier write                                      |
| `pnpm format:check`      | Prettier check                                      |
| `pnpm db:up` / `db:down` | Start/stop the Docker Postgres                      |
| `pnpm db:generate`       | Regenerate the Prisma client                        |
| `pnpm db:migrate`        | Create/apply a dev migration                        |
| `pnpm db:deploy`         | Apply committed migrations (production)             |
| `pnpm db:seed`           | Seed venues, players, and a demo session            |
| `pnpm db:studio`         | Open Prisma Studio                                  |
| `pnpm db:reset`          | Drop, recreate, migrate, and seed                   |

> If your machine lacks the Docker Compose plugin, run the container directly:
>
> ```bash
> docker run -d --name kyuwing-postgres \
>   -e POSTGRES_USER=kyuwing -e POSTGRES_PASSWORD=kyuwing -e POSTGRES_DB=kyuwing \
>   -p 5433:5432 -v kyuwing_pgdata:/var/lib/postgresql/data postgres:16-alpine
> ```

## How a game day runs

```
Create game day → build sign-ups → check in arrivals → auto-pair open courts
      → start match → end game → players requeue → settle fees → export
```

1. **Create the game day** — venue, date, type, court blocks.
2. **Build the sign-up list** — from the database, all active players, CSV/JSON, or walk-ins.
3. **Check in only on arrival** — this starts the wait timer and makes a player pairable.
4. **Auto-pair** — fills every free court with the fairest foursome; review before starting.
5. **Start and finish** — a suggested match becomes live, then ending it requeues all four players and increments games played.
6. **Settle and export** — record payments in Fees, then download Excel or PDF from Reports.

The in-app **Playbook** (`/app/guide`) has the same routine with checklists and FAQs.

## Project structure

```
app/
  page.tsx                       Marketing landing page
  login/                         Queue-master PIN login
  app/                           Authenticated shell
    gamedays/                    List, create, board, sign-ups, fees, reports, settings
    players/  venues/  guide/    Roster, fee rules, playbook
  api/gamedays/[id]/
    board/                       Polling endpoint for the live board
    export/xlsx/  export/pdf/    Report downloads
components/
  app/                           Board, sign-ups, fees, settings, nav
  marketing/                     Interactive pairing demo
  ui/                            Buttons, cards, badges, modals, inputs
lib/
  pairing.ts                     Weighted foursome + team-split engine
  queries.ts                     Board and report DTOs
  actions/                       Server actions (game days, players, venues, auth)
  fees.ts  datetime.ts  levels.ts
prisma/
  schema.prisma  migrations/  seed.ts
docs/                            Architecture, pairing, fees, operations, deployment
```

## Testing

```bash
pnpm test
```

- `lib/pairing.test.ts` — 13 tests: balance, bracket rules, wait priority, permanent pairs, requests, foursome avoidance, scarcity, multi-court fills.
- `lib/fees.test.ts` — 12 tests: fee math, peso formatting (including negatives), labels.
- `lib/datetime.test.ts` — 20 tests: Manila timezone handling, date-only storage, court-plan parsing, slot selection.

The critical invariant: a stored game date must never shift a day because of timezone conversion. Dates are stored at UTC midnight of the Manila calendar date.

## Deployment

Kyuwing is built for Vercel + a managed PostgreSQL database. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full walkthrough, including environment variables, `prisma migrate deploy`, seeding decisions, and the custom domain.

Short version:

```bash
vercel link
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
vercel env add QUEUE_MASTER_PIN production
vercel env add ADMIN_PIN production        # optional: developer UI customization
vercel env add AUTH_SECRET production
vercel env add NEXT_PUBLIC_APP_URL production
vercel --prod
```

Then run `pnpm db:deploy` against the production database.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — data model, request flow, auth, polling
- [Pairing engine](docs/PAIRING.md) — weights, tie-breakers, worked examples
- [Fees](docs/FEES.md) — rule matrix, calculation, settlement, reporting
- [Operations](docs/OPERATIONS.md) — day-of checklist for queue masters
- [Deployment](docs/DEPLOYMENT.md) — Vercel, database, migrations, rollback
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Agent notes](AGENTS.md)

## License

[MIT](LICENSE) © [JD Regalario](https://github.com/jeremiahdanielregalario)
