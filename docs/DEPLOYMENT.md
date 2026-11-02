# Deployment

Kyuwing runs on Vercel with a managed PostgreSQL database. This guide covers the full path from local to production, plus the decisions that matter for a small volunteer-run app.

## What you need

- A GitHub repository containing this project.
- A Vercel account connected to the same GitHub identity you deploy from.
- A PostgreSQL 16-compatible database reachable from Vercel. Options:
  - **Neon** (serverless Postgres; generous free tier; recommended)
  - **Vercel Postgres** (powered by Neon, provisioned from the Vercel dashboard)
  - **Supabase** (Postgres + extras you will not use)
  - Any managed Postgres with a public connection string

The app uses standard Prisma features only, so provider choice does not affect the code.

## 1. Prepare the repository

```bash
git add .
git commit -m "Prepare Kyuwing for deployment"
git push origin main
```

Confirm the CI workflow (`.github/workflows/ci.yml`) passes. It boots a Postgres service, applies migrations, and runs typecheck, lint, tests, and build.

## 2. Provision the database

### Neon

1. Create a project in the Neon console.
2. Copy the **pooled** connection string for the `main` branch.
3. Ensure it includes `?sslmode=require`.
4. Use port `5432` (Neon's pooler) and keep the `-pooler` host if offered. Prisma works with either; the pooled host is better for serverless.

### Vercel Postgres / Marketplace

1. Open the Vercel project → **Storage** → **Create Database**.
2. Choose Postgres (Neon-backed) and the free plan.
3. Connect it to the project. Vercel injects `DATABASE_URL` (and related variables) into the environment.
4. Verify the injected variable name matches what Prisma expects. If Vercel provides `POSTGRES_PRISMA_URL`, either rename it or set `DATABASE_URL` to the same value.

> Marketplace integrations may require an interactive browser login. If the CLI cannot complete provisioning, create the database in the Vercel dashboard, then pull the environment locally with `vercel env pull`.

### Supabase

1. Create a project and wait for provisioning to finish.
2. Open **Project Settings → Database → Connection string**.
3. Copy the **Transaction pooler** string (port `6543`) for `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=1` if it is not already present.
4. Copy the **Session pooler** string (port `5432`) or the **Direct connection** string for `DIRECT_URL`. Migrations need a session/direct connection, not the transaction pooler.
5. URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, and so on).

```bash
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

`DIRECT_URL` is declared in `prisma/schema.prisma` and is used only by Prisma Migrate. If your direct host is IPv6-only and Vercel cannot reach it, use the session pooler URL above instead — it supports migrations over IPv4.

Free Supabase projects pause after a period of inactivity. A weekly game day is usually enough activity to keep it awake; the first request after a pause may take a little longer.

## 3. Create the Vercel project

### Option A — dashboard (recommended for first deploy)

1. **Add New → Project** → import the GitHub repo.
2. Framework preset: **Next.js**. Build command: `pnpm build`. Install command: `pnpm install`.
3. Add the environment variables below for **Production** (and Preview if you want preview deployments).
4. Deploy.
5. Deploy, then point the `badass-kyuwing.vercel.app` alias at the production deployment (or rename the project to `badass-kyuwing`).

### Option B — CLI

```bash
cd kyuwing
vercel link            # choose the jeremiahdanielregalario account/team
vercel env add DATABASE_URL production
vercel env add QUEUE_MASTER_PIN production
vercel env add AUTH_SECRET production
vercel env add NEXT_PUBLIC_APP_URL production
vercel --prod
```

Verify the active account first:

```bash
vercel whoami
vercel teams ls
```

It must be the account tied to the GitHub identity that owns the repo.

## 4. Environment variables

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | `postgresql://user:pass@host/db?sslmode=require` | Pooled connection recommended at runtime |
| `DIRECT_URL` | yes in production | direct Postgres URL | Used by `prisma migrate`; can equal `DATABASE_URL` when there is no pooler |
| `QUEUE_MASTER_PIN` | yes | a 6+ digit PIN | Shared by all queue masters; rotate when someone leaves |
| `AUTH_SECRET` | yes | 32+ random chars | `openssl rand -base64 32`; rotating invalidates sessions |
| `NEXT_PUBLIC_APP_URL` | yes | `https://badass-kyuwing.vercel.app` | Used in metadata and absolute links |
| `NEXT_PUBLIC_ORG_NAME` | no | `UP BadAss` | Overrides the org label |

Set the same values for **Preview** if you want preview deployments to work; otherwise use a separate preview database so previews cannot touch production data.

## 5. Apply migrations

The build runs `prisma generate` but **does not** run migrations. Apply them explicitly against production:

```bash
# with the production DATABASE_URL in your shell
DATABASE_URL="postgresql://..." pnpm db:deploy
```

Or from the Vercel dashboard environment:

```bash
vercel env pull .env.production.local
DATABASE_URL="$(grep '^DATABASE_URL=' .env.production.local | cut -d= -f2- | tr -d '\"')" pnpm db:deploy
```

Migrations are idempotent; running `db:deploy` again is safe.

### Should you seed production?

The seed creates demo players and a **live demo game day**. Do **not** run the full seed against production if real data will live there.

To bootstrap only the venues and fee rules, either:

- Edit `prisma/seed.ts` to guard the demo game-day creation with an environment check, or
- Create the venues and fee matrix through the UI after the first login (recommended), or
- Run a one-off script that upserts only `Venue` and `FeeRule`.

If you do seed a staging environment, remember to replace the placeholder fees before real use.

## 6. Verify the deployment

1. Open `https://badass-kyuwing.vercel.app`.
2. Confirm the landing page renders and the pairing demo is interactive.
3. Open `/login`, sign in with the production PIN.
4. Create a test game day, add a player, check in, pair, start, finish, and confirm requeue.
5. Record a payment and download both Excel and PDF.
6. Delete the test game day.
7. Confirm `/app` redirects to `/login` in a private window (auth guard works).

## 7. Custom domain

`badass-kyuwing.vercel.app` is the production alias for the association. To use a custom domain:

1. Vercel project → **Settings → Domains** → add the domain.
2. Point DNS as instructed (A/CNAME).
3. Update `NEXT_PUBLIC_APP_URL` to the new origin and redeploy.

## Rollback

- **Code:** Vercel keeps immutable deployments. Promote a previous deployment from **Deployments → … → Promote to Production**.
- **Database:** migrations are forward-only. Before a risky migration, take a provider snapshot (Neon branching, Supabase backups) so you can restore. There is no down-migration tooling in this repo.
- **Environment:** if a bad `QUEUE_MASTER_PIN` or `AUTH_SECRET` is deployed, change it in Vercel and redeploy; all sessions are invalidated.

## Security checklist

- [ ] `QUEUE_MASTER_PIN` is not `1234` and is shared only with queue masters.
- [ ] `AUTH_SECRET` is a long random value, unique to production.
- [ ] The database requires TLS and does not allow public unauthenticated access beyond the connection string.
- [ ] The repo contains no `.env` file with real secrets (`.gitignore` covers `.env`).
- [ ] `NEXT_PUBLIC_APP_URL` is the HTTPS production origin.
- [ ] Preview deployments cannot reach the production database unless intended.
- [ ] `vercel whoami` shows the correct account before deploying.
- [ ] The GitHub repo is private if the roster contains personal data, or the data is limited to nickname/level.

## Operational notes

- **Cold starts:** serverless functions may take a second on first request. The board polling warms them quickly.
- **Connection limits:** on a free Postgres tier, use the pooled connection string. Prisma with a pooler needs `pgbouncer=true` for some providers; Neon's pooler works without it.
- **Exports:** generated per request in memory. Very large sessions (hundreds of players) may hit function memory limits; typical sessions (20–60 players) are well within bounds.
- **Logs:** Vercel → Project → Logs. Server action failures surface here; the UI shows a toast, not a stack trace.
- **Backups:** enable provider backups before the first real session. The exported Excel/PDF is a financial record, not a database backup.

## Cost expectation

For a weekly association session, the free tiers of Vercel and Neon are sufficient: one project, a handful of functions, a small database, and low traffic. The main constraints are database storage and compute hours, not bandwidth.
