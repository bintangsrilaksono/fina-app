# Deployment

## Status: NOT IMPLEMENTED (no deployment configuration in the repository)

Verified absent from the repository:

- No `Dockerfile` or `docker-compose.yml`.
- No `vercel.json`.
- No `.github/workflows/*` or any other CI/CD pipeline definition.
- No `supabase/config.toml` or Supabase CLI project for environment-linked migrations.
- No infrastructure-as-code (Terraform, Pulumi, CDK, etc.).

## What exists

[package.json](../package.json) scripts:

```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "eslint"
```

These are the unmodified defaults from `create-next-app`. [next.config.ts](../next.config.ts) sets only `reactCompiler: true` — no `output` mode (e.g. `standalone`), no image domains, no redirects/headers configuration, no environment-specific settings.

[README.md](../README.md) still contains the generic, unedited `create-next-app` boilerplate text suggesting deployment "on Vercel" — this is template text, not evidence of an actual configured or executed deployment.

## Required environment variables (names only — see [15-security.md](15-security.md))

Any deployment target must supply, at minimum, the three variables declared in [.env.example](../.env.example):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `GOOGLE_GEN_AI_API_KEY`

There is no runtime startup check that validates these are present as a group (only `GOOGLE_GEN_AI_API_KEY`'s absence is explicitly checked, and only lazily, inside `createAI()` — the two Supabase vars are used with a non-null assertion (`!`) with no check at all, so a missing Supabase URL/key would fail deep inside the Supabase SDK with a less obvious error).

## Database provisioning

Because there is no Supabase CLI project, provisioning a new environment requires manually running, in order:

1. [migrations/setup-db.sql](../migrations/setup-db.sql) — enables `pgvector`, creates the `transactions` table and its (permissive) RLS policy.
2. [migrations/setup-vector.sql](../migrations/setup-vector.sql) — creates the `match_transactions` RPC function.

There is no seed data script and no documented order-of-operations beyond what's inferred here from the SQL files' own dependencies (the vector extension must exist before the `match_transactions` function can reference `vector(768)`).

## What production deployment would require (gap list, not a plan)

- A CI pipeline running lint, type-check, and (once they exist) tests before deploy.
- A chosen hosting target with Next.js 16 App Router + Server Actions + streaming `ReadableStream` route support (Vercel is the implied default given the framework and boilerplate README text, but this was never actually configured in-repo).
- Fixing the RLS/auth gaps in [15-security.md](15-security.md) *before* any deployment that could be reached by more than one real user, since there is currently no per-tenant data isolation.
- A function-timeout-aware plan for `generateVideo`'s unbounded polling loop (see [14-error-handling.md](14-error-handling.md)) — long video generations could exceed common serverless function time limits with no code-level fallback.
- Secrets management appropriate to the chosen host (e.g. Vercel/host environment variables) — nothing in-repo currently assumes a specific secrets manager.
- Monitoring/alerting, since none exists (see [16-testing.md](16-testing.md) and [AUDIT-REPORT.md](AUDIT-REPORT.md)).

This gap list is expanded with severity and priority in [GAP-ANALYSIS.md](GAP-ANALYSIS.md).
