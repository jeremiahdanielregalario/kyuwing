# AGENTS.md

Notes for AI agents and contributors working in this repository. Read this before changing code.

## What this is

Kyuwing is a badminton game-day queueing app for UP BadAss. One shared queue-master account (PIN login), no player accounts. The product bet is that a non-technical queue master can run a full session from a tablet without training.

Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Prisma 6 + PostgreSQL, Zod, SWR, ExcelJS, pdf-lib, Vitest.

## Commands

```bash
pnpm dev            # dev server
pnpm build          # prisma generate && next build
pnpm lint           # eslint .
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm format         # prettier --write .
pnpm db:deploy      # prisma migrate deploy
pnpm db:seed        # seed demo data
pnpm db:reset       # drop + recreate + migrate + seed
```

**Always run `pnpm typecheck`, `pnpm lint`, and `pnpm test` before calling work done.** All three are expected to be clean (zero lint warnings).

## Layout

```
app/                      Routes (App Router). Marketing `/`, auth `/login`, product `/app/**`
app/api/gamedays/[id]/    Board polling JSON + Excel/PDF exports
components/app/           Client UI for the product
components/marketing/     Landing-page-only client UI
components/ui/            Small design-system primitives
lib/pairing.ts            The pairing engine — pure, no DB
lib/queries.ts            Read-side DTO mapping (Prisma → board/report shapes)
lib/actions/              Server actions, one file per domain
lib/auth.ts               PIN check + signed JWT cookie
lib/fees.ts               Fee math and peso formatting
lib/datetime.ts           Manila timezone + court-plan helpers
prisma/                   Schema, migrations, seed
docs/                     Long-form documentation
```

## Conventions

### Data and time

- **Dates are stored as UTC midnight of the Manila calendar date.** Use `dateOnly()`, `dateOnlyFromKey()`, and `formatGameDate()`. Never use `new Date(y, m, d)` or `toLocaleDateString` for game dates — they shift across timezones.
- All displayed times are Asia/Manila. Use the helpers in `lib/datetime.ts`.
- Money is stored as whole Philippine pesos (`Int`). Use `formatPeso()` in UI and `formatPesoPdf()` in PDFs (`₱` is unavailable in standard PDF fonts).
- `DATABASE_URL` is the runtime connection (pooled in production). `DIRECT_URL` is used only by `prisma migrate`; locally it can equal `DATABASE_URL`.

### Server actions

- Every mutation lives in `lib/actions/*` and starts with `"use server"`.
- Guard authenticated actions with the local `guard()` helper (or `isQueueMaster()` for new files). Return `fail(...)` / `ok(...)` from `lib/action-result.ts`; do not throw for expected validation failures.
- Validate external input with Zod from `lib/validation.ts`.
- After a mutation that changes the board, call `refreshGameDay(gameDayId)` so polling clients update.
- Server actions are called from client components inside `startTransition`; surface the result with Sonner toasts.

### Pairing

- `lib/pairing.ts` is pure and DB-free. Keep it that way so it stays unit-testable.
- Any change to weights or selection logic must come with tests in `lib/pairing.test.ts`, and a note in `docs/PAIRING.md` if behavior changes materially.
- Invariants to preserve:
  - Fewer than 4 available players → no match.
  - Teams must be as balanced as the candidate pool allows.
  - A mutual permanent pair is never split across the net.
  - A player is never in two simultaneous suggestions.
- `scarcity` is inferred as `players.length < 8` when not passed. `generateMatches` passes `waiting.length < 10` because bench depth, not just court count, determines whether cross-bracket play is acceptable.

### Read side

- `lib/queries.ts` owns Prisma includes and DTO mapping. Keep the board DTO (`lib/board-types.ts`) stable — the client and the polling route share it.
- Board polling is a single route: `GET /api/gamedays/[id]/board`. It is authenticated; do not expose player contact details there.

### UI

- Tailwind 4 tokens are defined in `app/globals.css` (`forest`, `lime`, `cream`, `coral`, `line`, `ink`, `muted`). Use them; avoid raw hex in components.
- `buttonVariants` returns a class string. For links, use `<Link className={buttonVariants({...})}>`; for actions, use `<Button>`.
- The app targets phones and tablets first. Touch targets should be at least 36–44px; the live board is used standing up.
- Client components that read `Date.now()` during render cause hydration mismatches. Compute time-dependent values in effects, event handlers, or with a captured timestamp (see `signup-manager.tsx`).
- Modals render through a portal and gate on a `useSyncExternalStore` mount flag. Keep that pattern.
- Use `React.useEffect` sparingly. Prefer deriving state or updating it in the event that changes the selection (see `venue-settings.tsx`).

### Naming and copy

- User-facing copy uses "queue master", "game day", "check in", "sign-ups", "court block".
- Levels display as `E-` … `A+`; bracket names are Beginner / Developing / Intermediate / Advanced / Open.
- The credit line is exactly **"App by Danyel Regalario"** and must remain in the landing footer, login page, app sidebar, exports, README, and `package.json` author.

## Gotchas

- `next.config.ts` disables typed routes and marks `exceljs` / `pdf-lib` as server-external packages. Don't import those from client components.
- `prisma generate` is part of `pnpm build`; a fresh clone needs it before `tsc` if the client is missing.
- The local database listens on **5433**, not 5432, to avoid clashing with a system Postgres.
- `docker compose` may be unavailable even when Docker runs. The standalone `docker run` equivalent is in the README.
- Exports are generated per request; there is no export file cache. Do not write to disk in the export routes.
- Seed fee values are placeholders. Do not present them as official rates in new copy.

## Definition of done

1. `pnpm typecheck` passes.
2. `pnpm lint` passes with no warnings.
3. `pnpm test` passes.
4. `pnpm build` succeeds for changes touching routes, server actions, or config.
5. Behavior changes are reflected in `README.md` and the relevant `docs/*.md`.
6. `CHANGELOG.md` has an entry under `Unreleased` for user-visible changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
