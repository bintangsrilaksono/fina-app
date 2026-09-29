# ADR 005: Supabase Postgres with a Permissive RLS Policy (Interim State)

**Status:** INFERRED (reconstructed from [migrations/setup-db.sql](../../migrations/setup-db.sql); the commented-out alternative policy in the same file is itself evidence about the intended future decision)

## Context

The app needs a database with built-in auth integration (to eventually support the `user_id` FK to `auth.users`) and, per ADR 003, native vector-search support.

## Decision (as implemented)

Use Supabase (managed Postgres + Auth + `pgvector` + client SDKs for browser/server/middleware contexts) as the sole datastore and auth provider. Enable Row-Level Security on the `transactions` table, but activate a permissive policy (`USING (true)`) rather than the per-user policy that is written, correctly, directly beneath it as a comment.

## Evidence this is a known-interim, not final, state

The exact commented-out line is:
```sql
-- CREATE POLICY "Users can manage their own transactions" ON public.transactions
--    FOR ALL USING (auth.uid() = user_id);
```
This is not a hypothetical alternative someone might write later — it is the *correct* policy, already written, sitting immediately next to the permissive one that's actually active, with a comment ("Jika sudah ada sistem auth" — "if there's already an auth system") explaining the condition under which it should be swapped in. This is strong first-hand evidence that permissive RLS was a deliberate development-time placeholder, not a considered final security posture.

## Consequences

- Supabase's integrated Auth + Postgres + pgvector meant one platform serves three needs (data, auth, vector search) with one set of credentials — efficient for a small project.
- The permissive RLS policy, left active, is the CRITICAL finding in [AUDIT-REPORT.md](../AUDIT-REPORT.md) (SEC-1) — this ADR does not excuse that finding; it explains *why* the placeholder exists, which makes the fix (swap to the already-written policy, once `user_id` is populated per SEC-2) faster than if the correct policy had to be designed from scratch.

## Alternatives not taken

None inferred — Supabase's suitability for this app's needs (auth + Postgres + vector, one platform) is not in question; only the *activation* of the security policy already written for it is outstanding.
