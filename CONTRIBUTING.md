# Contributing to Kyuwing

Thanks for helping. Kyuwing runs real UP BadAss game days: a queue master uses it on a tablet, under time pressure, with players waiting. Every change lands in production the moment it is merged. That shapes everything below.

Kyuwing is deliberately focused: one queue master, one board, one game day at a time. Changes that keep it simple are the easiest to accept.

## The short version

1. **Open an issue first** for anything bigger than a small fix, and wait for a reply before building it.
2. **Fork** the repo and work on a branch in your fork.
3. **Use seed data only.** Never commit, screenshot or paste real player data, exports or secrets, anywhere, including into AI tools.
4. **Run the checks** (`pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`) and add tests for logic you change.
5. **Update the docs and `CHANGELOG.md`** for anything a queue master would notice.
6. **Open a pull request** using the template. GitHub runs the same checks; a PR can't be merged until they all pass.
7. **The maintainer merges**, never on a game day (usually Mondays and Saturdays).

## Before you start

- **Ask first.** Open an issue describing the problem (not just the solution). Pairing rules, fee rules and anything on the public pages need agreement before code, since they affect real people's games and money. Typos, small bugs and doc fixes can go straight to a PR.
- **Read [AGENTS.md](AGENTS.md).** It is the project's rulebook (conventions, invariants and gotchas) for people and AI tools alike.
- **Read the doc for the area you're touching:** [docs/PAIRING.md](docs/PAIRING.md) for pairing, [docs/FEES.md](docs/FEES.md) for money, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit, [docs/OPERATIONS.md](docs/OPERATIONS.md) for how a game day is actually run.

## Privacy: read this even if you read nothing else

The repository is public. The app holds real members' names, contacts and payments.

- Develop with the **seed data** (`pnpm db:seed`). You will never be given access to the production database, and you don't need it.
- **Never** commit, attach to an issue, screenshot or paste into any tool: real names, contacts, Excel/PDF exports, live or fees links, `.env` values, PINs or database URLs.
- The unauthenticated pages (live view `/live/...`, fees sheet `/fees/...`, roster `/roster`) may only return what their `toPublic…()` functions return. If you add a field there, say so in the PR, and keep `lib/public-board.test.ts`, `lib/public-fees.test.ts` and `lib/public-roster.test.ts` passing.
- Found a security or privacy problem? **Don't open a public issue.** Report it privately as described in [SECURITY.md](SECURITY.md).

## Setup

You need Node.js 22, pnpm 10+ and Docker.

```bash
pnpm install
docker compose up -d        # Postgres on port 5433 (not 5432)
cp .env.example .env        # the defaults work locally
pnpm db:deploy
pnpm db:seed
pnpm dev                    # http://localhost:3000, sign in with the PIN from .env
```

If `docker compose` is unavailable, use the standalone `docker run` command in the [README](README.md#quick-start). `pnpm build` needs `DATABASE_URL` set, so run it with the database up (CI always runs it for you).

## How the code is organised

The parts people most often get wrong:

- **Board, Fees and Sign-ups changes are engine ops**, not server actions. They live in `lib/board-engine/` and run on the tablet first (offline) and on the server. To change one of those behaviours, change the op and add a test in `lib/board-engine/engine.test.ts`. Ops must be deterministic: no `Date.now()`, no `Math.random()`.
- **Pure logic stays pure.** `lib/pairing.ts`, `lib/fees.ts`, `lib/datetime.ts` and `lib/board-engine/` must not import Prisma or React.
- **Dates are UTC midnight of the Manila calendar date.** Use the helpers in `lib/datetime.ts`. Anything date-related needs a test.
- **Money is whole pesos.** Use `formatPeso()` in the UI.
- **Other mutations** are server actions in `lib/actions/`, validated with Zod, returning `ok(...)` / `fail(...)`.

## Workflow

1. Branch in your fork: `git switch -c fix/short-description` (or `feat/…`, `docs/…`).
2. Make the smallest coherent change. One concern per PR; split unrelated changes.
3. Add or update tests next to the code (`lib/**/*.test.ts`). Pairing and fee changes always need tests.
4. Check it on a **phone-width** screen if you changed the UI. Touch targets should be at least 36–44px.
5. Run the checks:

   ```bash
   pnpm format         # fix formatting
   pnpm typecheck
   pnpm lint           # zero warnings allowed
   pnpm test
   ```

6. Update `README.md` / `docs/*.md` if behaviour changed, and add a line to `CHANGELOG.md` under **Unreleased** for anything users would notice.
7. Open the PR, fill in the template, and add a screenshot for UI changes.

## Quality checks on pull requests

Every pull request runs these on GitHub, and **all must pass before it can be merged**:

| Check | What it does |
| --- | --- |
| **Quality gate** | Formatting (Prettier), typecheck, lint with zero warnings, the full test suite, migrations applied to a fresh database, a check that `prisma/schema.prisma` matches the migrations, the seed script, and a production build |
| **Changelog** | Fails if app code changed but `CHANGELOG.md` didn't. For changes with nothing user-visible (refactors, tests, CI), the maintainer can add the `skip-changelog` label |
| **Dependency review** | Fails if the PR adds a dependency with a known high-severity vulnerability |

The first time you contribute, a maintainer has to approve the workflow run before the checks start; that's a GitHub safety rule for forks.

If a check fails, open it in the PR's **Checks** tab, fix the problem in your branch and push again. Please don't ask for a merge with failing checks.

## Using AI tools

AI coding tools are welcome. [AGENTS.md](AGENTS.md) is written for them, so point your tool at it. The rules:

- **You are responsible for every line you submit.** Read it, understand it, run it, and be ready to explain any part in review. "The AI wrote it" isn't an answer to a review question.
- **Say so in the PR** if an AI tool wrote a significant part of the change, and which tool. The template has a box for it. This doesn't count against you; it tells the reviewer where to look harder.
- **Never give an AI tool real data or secrets:** no production data, exports, `.env` files, PINs, database URLs or live links. Seed data only.
- **Keep it small and focused.** Large, sprawling or unreviewed AI-generated PRs will be closed. So will PRs that reformat or rewrite code unrelated to the change.
- **Pairing and fee logic get the strictest review** however they were written: tests, a doc update, and a clear explanation of what changes for players.
- Don't let a tool invent behaviour. If it adds features, copy or config you didn't ask for, remove them.

## Database changes

```bash
# edit prisma/schema.prisma, then:
pnpm db:migrate --name describe_the_change
```

Commit the schema change and the generated migration together. Never edit a migration that has already been merged. CI fails if the schema and migrations disagree. If you change seed data, run `pnpm db:reset` and check the demo board still works.

## Style

- Prettier is configured; run `pnpm format` before committing.
- ESLint must pass with **zero warnings**.
- Use the design tokens in `app/globals.css` (`forest`, `lime`, `cream`, `coral`, `line`, `ink`, `muted`), not raw colours.
- Named exports for components; default exports for routes only.
- Product copy is plain: queue masters aren't developers. Use "queue master", "game day", "check in", "sign-ups", "court block".
- Keep the credit line "App by Danyel Regalario" where it is (see AGENTS.md).

## Reporting bugs

Use the **Bug report** issue template. Include what you did, what you expected, what happened, the game-day status and the device. If a pairing looked wrong, give the four players' levels, wait times, games played and any requests or permanent partners, **using nicknames or made-up names, never contacts**.

## Code of conduct

Be decent. This is a volunteer tool for a university sports association. Assume good faith, critique the work rather than the person, and keep discussion useful.

## Licence

By contributing you agree that your contribution is licensed under the project's [MIT licence](LICENSE).
