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
app/api/gamedays/[id]/    Offline sync (sync, state) + Excel/PDF exports
components/app/           Client UI for the product
components/marketing/     Landing-page-only client UI
components/ui/            Small design-system primitives
lib/pairing.ts            The pairing engine — pure, no DB
lib/board-engine/         Board/Fees/Sign-ups rules as ops — pure, runs on tablet and server
lib/board-store.ts        Engine state load/save, runOps (server)
lib/offline/              On-device game day: IndexedDB, outbox, sync loop
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

### Player data and bulk level updates

- **Never match players on nickname alone.** Nicknames repeat across different people and change between the club's sheet and the app (`Neo` belongs to two different members; `Jolo` was a duplicate record of `VICTOR, Jean Louie`). Match on full name (surname + given name), then use the nickname only to confirm; a nickname that disagrees with the name is not evidence.
- **Same surname is not the same person.** `ORTIZ, Arabella` is not `Ortiz, Ayla` or `Ortiz, Angela Gwenn Alair`; `BENCIO, Jorrel` is not `Bencio, Conrado`. Require the given name to agree too.
- The club's sheets arrive as `SURNAME, Given` in `NAME` plus a `NICKNAME`; app `fullName` also uses `SURNAME, Given`, so split on the raw comma before cleaning. Spellings drift by a letter (`Ghessette` / `Ghesette`), and the minus sign is often U+2212 `−`, not `-`.
- A sheet can list one person twice with different levels. Leave that player alone and report the conflict rather than picking a row.
- Report, don't invent: players the sheet omits keep their existing level, and players that exist only in the app are not "fixed" by a guess.
- Before writing, print a dry run with a confidence score and a margin against the runner-up, and eyeball the weakest rows. Write only `level`; never overwrite names, categories or contacts from a leveling sheet. Back up the current values first.

### Server actions

- Every mutation lives in `lib/actions/*` and starts with `"use server"`.
- Guard authenticated actions with the local `guard()` helper (or `isQueueMaster()` for new files). Return `fail(...)` / `ok(...)` from `lib/action-result.ts`; do not throw for expected validation failures.
- Validate external input with Zod from `lib/validation.ts`.
- After a mutation that changes the board, call `refreshGameDay(gameDayId)` so polling clients update.
- `revalidatePath` in an action sends the redrawn current page back in the same response. Do **not** call `router.refresh()` after an action (that is a second full round trip). The board, Fees and Sign-ups don't wait for the server at all (see ops below); after a server action that changes their game day some other way (e.g. `addPlayersFromText`), call the hook's `refresh()`.
- Board, Fees and Sign-ups changes are **ops** in `lib/board-engine/ops.ts`. The pages call them through `useOfflineGameDay` (`lib/offline/actions.ts` mirrors the server action signatures); the server actions in `lib/actions/gamedays.ts` are thin wrappers over `runOps`. To add or change one of these behaviours, change the engine, not a server action, and add a test in `lib/board-engine/engine.test.ts`.
- Engine rules: ops must be deterministic. Ids of created rows come from `createdId(ctx, suffix)`, randomness from the op id, time from `ctx.at` (never `Date.now()`), and an op that sets something carries the value (not a toggle), so a resend is harmless. `applyOp` hands each op a clone and keeps the original when the op is refused, so a refused op may leave its copy half-changed but must return `fail(...)`.
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

- `lib/queries.ts` owns read queries; board and fee DTOs come from `toBoardData` / `toFeeReport` in `lib/board-engine/view.ts`. Keep the board DTO (`lib/board-types.ts`) stable.
- The offline routes `POST /api/gamedays/[id]/sync` and `GET /api/gamedays/[id]/state` are authenticated. Engine state never carries contacts or the player database's notes; keep it that way, since it is stored on the tablet.
- The public live view (`/live/[id]/[key]`, `GET /api/live/[id]/[key]`) is unauthenticated. It must only ever return `getPublicBoard()` / `toPublicBoard()` output (fees appear only once the game day is COMPLETED, as nickname, games, total, balance); add fields there deliberately and keep the leak test in `lib/public-board.test.ts` passing.
- The finance officer's fees sheet (`/fees/[id]/[key]`, `GET /api/fees/[id]/[key]`) is unauthenticated behind its own key (`feesViewKey`, a different HMAC scope from the live link). It must only return `toPublicFeeSheet()` output (nickname, games, amounts, paid state and payment method, plus the finance tracker's rows: status label, nickname and surname, remarks; never ids, given names, raw categories, levels, contacts or the player database's notes). Keep `lib/public-fees.test.ts` passing.
- The public roster (`/roster`) is unauthenticated and read-only. It must only render `getPublicRoster()` / `toPublicRoster()` output (nickname, full name, level, category, recency, history and awards; never contacts or notes. Archived players are included with `archived: true` and stay hidden until the visitor presses **Show archived**, and they are left out of the counts and bracket chart). Keep `lib/public-roster.test.ts` passing and pass `readOnly` to the shared Players components there.
- The one public write is `POST /api/live/[id]/[key]/leave` (a player's "I'm leaving" request). It needs the link's key, creates a `LeaveRequest` only, and changes nothing on the board until the queue master confirms. Keep it that way, and never return full names or other private fields from it.

### UI

- Tailwind 4 tokens are defined in `app/globals.css` (`forest`, `lime`, `cream`, `coral`, `line`, `ink`, `muted`). Use them; avoid raw hex in components.
- `buttonVariants` returns a class string. For links, use `<Link className={buttonVariants({...})}>`; for actions, use `<Button>`.
- The app targets phones and tablets first. Touch targets should be at least 36–44px; the live board is used standing up.
- Client components that read `Date.now()` during render cause hydration mismatches. Compute time-dependent values in effects, event handlers, or with a captured timestamp (see `signup-manager.tsx`).
- Modals render through a portal and gate on a `useSyncExternalStore` mount flag. Keep that pattern.
- Use `React.useEffect` sparingly. Prefer deriving state or updating it in the event that changes the selection (see `venue-settings.tsx`).

### Naming and copy

- User-facing copy uses "queue master", "game day", "check in", "sign-ups", "court block".
- Levels display as `E`, `D-` … `A+` (13 levels; the retired E-, E+, DE, CD, BC, AB are read through `RETIRED_LEVELS`); bracket names are Beginner / Developing / Intermediate / Advanced / Open.
- The credit line is exactly **"App by Danyel Regalario"** and must remain in the landing footer, login page, app sidebar, README, and `package.json` author. Session reports (PDF/Excel) deliberately do **not** carry it: they are UP BadAss documents, branded with the wordmark (`lib/brand-logo.ts`), black and gold, and signed by the game day's queue master and finance member.

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
