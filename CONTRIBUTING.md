# Contributing to Kyuwing

Thanks for helping. Kyuwing is a small, deliberately focused app: one queue master, one board, one session at a time. Keep changes in that spirit.

## Before you start

- Read [AGENTS.md](AGENTS.md) for conventions and gotchas.
- For pairing changes, read [docs/PAIRING.md](docs/PAIRING.md).
- For money changes, read [docs/FEES.md](docs/FEES.md).

## Setup

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:deploy
pnpm db:seed
pnpm dev
```

If `docker compose` is unavailable, use the standalone container command in the [README](README.md#quick-start).

## Workflow

1. Branch from `main`: `git switch -c feat/short-description`.
2. Make the smallest coherent change.
3. Add or update tests for logic in `lib/`.
4. Run the full gate:

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   ```

5. Update docs and `CHANGELOG.md` under `Unreleased` for user-visible changes.
6. Open a pull request describing the problem, the approach, and how you verified it.

## What we look for

- **Correctness over cleverness.** The board is used live, under time pressure. Predictable beats clever.
- **Pure logic stays pure.** `lib/pairing.ts`, `lib/fees.ts`, and `lib/datetime.ts` must not import Prisma or React.
- **Timezones are sacred.** Game dates are UTC-midnight values representing Manila calendar dates. Add a test for anything date-related.
- **Touch-first UI.** If a control is hard to hit on a phone, it is wrong.
- **Copy is plain.** Queue masters are not developers. Avoid jargon in the product.

## Tests

```bash
pnpm test          # once
pnpm test:watch    # while iterating
```

Test files live next to the code as `lib/*.test.ts`. The suite currently covers pairing, fees, and date/time helpers. New behavior in those modules needs a test; UI behavior should be verified manually on a phone-width viewport.

## Database changes

```bash
# edit prisma/schema.prisma
pnpm db:migrate --name describe_the_change
```

Commit both the schema change and the generated migration. Never edit an applied migration. If you change seed data, run `pnpm db:reset` and confirm the demo board still works.

## Style

- Prettier is configured; run `pnpm format` before committing.
- ESLint must pass with **zero warnings**. Warnings are treated as defects.
- Use the design tokens in `app/globals.css` (`forest`, `lime`, `cream`, `coral`, `line`, `ink`, `muted`) instead of raw colors.
- Prefer named exports for components; default exports are for routes only.

## Reporting bugs

Include: what you did, what you expected, what happened, the game-day status, and a screenshot if the board is involved. If a pairing looked wrong, include the four players' levels, wait times, games played, and any requests or permanent partners.

## Code of conduct

Be decent. This is a volunteer tool for a university sports association. Assume good faith, critique the work rather than the person, and keep discussion useful.
