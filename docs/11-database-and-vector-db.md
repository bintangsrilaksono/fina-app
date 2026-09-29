# Database & Vector Database

## Purpose

Persist transaction records and support both exact/filtered lookup and semantic (vector) retrieval, using a single Postgres database for both roles — no separate vector-database service.

## Schema

[migrations/setup-db.sql](../migrations/setup-db.sql) defines one table:

```sql
CREATE TABLE public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    embedding VECTOR(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

This is the **only** table in the application. There are no tables for users/profiles (Supabase's built-in `auth.users` is referenced by FK but never populated with app-specific profile data), no categories table (categories are a hardcoded TypeScript array, [transaction-constant.ts](../src/constants/transaction-constant.ts)), and no chat-history table (conversations live only in client-side React state, [chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx), and are lost on page reload).

## Row-Level Security — critical gap

```sql
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive rules for all" ON public.transactions FOR ALL USING (true);
-- Jika sudah ada sistem auth
-- CREATE POLICY "Users can manage their own transactions" ON public.transactions
--    FOR ALL USING (auth.uid() = user_id);
```

RLS is enabled but the active policy allows every operation (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) for every row unconditionally. The commented-out policy — which *would* scope access to `auth.uid() = user_id` — documents the developer's own intended-but-not-activated design. Because `user_id` is never actually set on insert anywhere in [transaction/action.ts](../src/features/transaction/action.ts) (`createTransaction`'s payload only spreads the client-supplied `transaction` fields, which don't include `user_id`), even flipping on the commented policy today would hide all rows from all users, since `user_id` is always `NULL`. Fixing this requires both a code change (populate `user_id` from the authenticated session on write) and a schema/policy change together. See [AUDIT-REPORT.md](AUDIT-REPORT.md) (CRITICAL) and [15-security.md](15-security.md).

## Vector search

[migrations/setup-vector.sql](../migrations/setup-vector.sql):

```sql
CREATE EXTENSION IF NOT EXISTS vector; -- (in setup-db.sql, run first)

CREATE FUNCTION match_transactions(query_embedding vector(768), match_threshold float, match_count int)
RETURNS TABLE (id uuid, type text, category text, amount numeric, description text, date date, user_id uuid, similarity float)
LANGUAGE sql AS $$
  SELECT ..., 1 - (transactions.embedding <=> query_embedding) AS similarity
  FROM transactions
  WHERE 1 - (transactions.embedding <=> query_embedding) > match_threshold
  ORDER BY transactions.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

- Distance operator: `<=>` (cosine distance) — requires the column to have been created without a specific index type; no `CREATE INDEX ... USING ivfflat/hnsw` statement exists, so this function currently performs a full sequential scan with a cosine-distance computation per row.
- `SECURITY` mode is not specified on the function (defaults to `SECURITY INVOKER` in Postgres), meaning the function itself does not bypass RLS — but since the RLS policy is `USING (true)`, this offers no real protection today.

## Access patterns

| Operation | Code | Mechanism |
|---|---|---|
| List transactions (paginated, searchable) | `getTransactions()` in [action.ts](../src/features/transaction/action.ts) | Supabase query builder: `.select(...).order(...).ilike(...).range(...)`, exact count |
| Balance summary | `getBalanceSummary()` in [action.ts](../src/features/transaction/action.ts) | `.select("amount, type")` then reduced client-side in JS (not a SQL aggregate) — every row is fetched to compute the sum |
| Create/Update | `createTransaction`/`updateTransaction` | Supabase `.insert()`/`.update()`, embeds transaction first via `handleEmbedding()` |
| Delete | `deleteTransaction(id)` | Supabase `.delete().eq("id", id)` |
| Semantic search | `findEmbedding()` in [embedding.ts](../src/features/ai/embedding.ts) | `.rpc("match_transactions", ...)` |

Note: `getBalanceSummary` computing totals in application code rather than a SQL `SUM(...) GROUP BY type` means the entire `transactions` table (minus most columns) is transferred on every dashboard load — fine at small scale, a real scalability concern otherwise (see [AUDIT-REPORT.md](AUDIT-REPORT.md)).

## Migrations / tooling

There is no Supabase CLI project (no `supabase/` folder, no `supabase/config.toml`) and no migration framework. The two `.sql` files in [migrations/](../migrations/) are plain scripts intended to be run manually (e.g. pasted into the Supabase SQL editor) — there is no versioning, no rollback, and no record of which migrations have been applied to a given environment.

## Security considerations

- Client-side Supabase access uses the "publishable" (anon) key ([client.ts](../src/lib/supabase/client.ts)) — appropriate for RLS-protected tables, but currently meaningless given the permissive policy.
- Server-side access ([server.ts](../src/lib/supabase/server.ts)) uses cookie-forwarded auth via `@supabase/ssr`, not a service-role key — this is the correct pattern *if* RLS were actually enforcing per-user isolation.
- No encryption-at-rest or column-level encryption is configured in application code (this is generally handled by the Supabase platform itself, outside repo scope).

## Limitations

- No soft-delete/audit trail — `deleteTransaction` is a hard `DELETE`.
- No database-level constraint preventing `amount <= 0` (that check only exists in application code and in AI tool-execution code, not in the schema itself, e.g. no `CHECK (amount > 0)`).
- Single-table design will not scale to multi-currency, recurring transactions, or multi-account tracking without schema changes.
