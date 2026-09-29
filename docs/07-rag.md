# RAG (Retrieval-Augmented Generation)

## Purpose

Ground AI answers and generations in the user's actual transaction history instead of relying solely on parametric model knowledge or a manually-passed context window.

## Architecture

Two files implement the entire RAG system:

- [src/features/ai/embedding.ts](../src/features/ai/embedding.ts) — embedding generation + vector search.
- [migrations/setup-vector.sql](../migrations/setup-vector.sql) — the pgvector similarity RPC.

There is no separate "RAG service", no document loader, no text splitter/chunker, and no re-ranking step. The unit of retrieval is one whole transaction row.

### Write path (indexing)

[src/features/transaction/action.ts](../src/features/transaction/action.ts) `handleEmbedding`:

```ts
const embeddingText = JSON.stringify(transaction);
const embeddingVector = await generateEmbedding(embeddingText);
```

Called from both `createTransaction` and `updateTransaction`. The entire transaction object (type, category, amount, description, date) is stringified as-is and embedded as a single unit — there is no field weighting, no separate embedding of just the description, and no de-duplication of near-identical transactions.

### Embedding generation

[embedding.ts](../src/features/ai/embedding.ts) `generateEmbedding`:

```ts
ai.models.embedContent({ model: "gemini-embedding-2", contents, config: { outputDimensionality: 768 } })
```

Returns `response.embeddings[0].values` (a `number[]`), or throws if the SDK returns no embeddings.

### Storage

[migrations/setup-db.sql](../migrations/setup-db.sql): the `transactions` table has an `embedding VECTOR(768)` column alongside the regular relational columns — embeddings live in the same row and table as the source data, not a separate vector store.

### Read path (retrieval)

[embedding.ts](../src/features/ai/embedding.ts) `findEmbedding(query, match_threshold?, match_count?)`:

1. Embeds the query string with the same model/dimensionality.
2. Calls `supabase.rpc("match_transactions", { query_embedding, match_threshold, match_count })`.
3. Defaults: `match_threshold: 0.3`, `match_count: 15` (defaults differ by caller — see table below).

[migrations/setup-vector.sql](../migrations/setup-vector.sql) `match_transactions`:

```sql
SELECT ..., 1 - (transactions.embedding <=> query_embedding) AS similarity
FROM transactions
WHERE 1 - (transactions.embedding <=> query_embedding) > match_threshold
ORDER BY transactions.embedding <=> query_embedding
LIMIT match_count;
```

Cosine distance (`<=>`, requires `pgvector`'s cosine operator class) converted to a similarity score. No index (e.g. `ivfflat`/`hnsw`) is created on the `embedding` column in the migration file — at current scale (a personal app's transaction count) a sequential scan is acceptable, but this will not scale to large multi-tenant datasets without adding one.

### Retrieval parameters actually used per caller

| Caller | threshold | count | Integration style |
|---|---|---|---|
| [chat.ts](../src/features/ai/chat.ts) personal mode, via `get_transaction` tool | `0.3` | `100` | Tool-mediated (model decides when to call) |
| [wizard.ts](../src/features/ai/wizard.ts) `handleWizardTools`, via `get_transaction` tool | `0.3` | `1` | Tool-mediated, expects a single best match (for update/delete targeting) |
| [generative-content.ts](../src/features/ai/generative-content.ts) (chart/image/video) | `0.5` | `50` | Pre-fetch (always runs before prompting) |

## Data flow

See the RAG Flow diagram in [01-architecture.md](01-architecture.md#3-rag-flow).

## Inputs / Outputs

| Function | Input | Output |
|---|---|---|
| `generateEmbedding(contents: string)` | Any string | `number[]` length 768 |
| `findEmbedding(query, threshold?, count?)` | Query string + optional tuning | Array of transaction rows + `similarity` field |

## Error handling

- `generateEmbedding` throws `"Failed to generate embedding"` if the SDK returns no embeddings, otherwise rethrows the original error unchanged.
- `findEmbedding` throws a generic `"Failed to perform vector search."` on any Supabase RPC error, discarding the original Postgres error detail.
- `handleEmbedding` in `action.ts` wraps embedding failure in a differently-worded `"Failed to generate embedding"` error, creating two different error messages for what can be the same underlying failure depending on call path.

## Security considerations

- The `match_transactions` RPC and underlying `transactions` table are governed by the RLS policy `USING (true)` (see [11-database-and-vector-db.md](11-database-and-vector-db.md)) — retrieval is **not** scoped to the current user's `user_id`. Any authenticated (or, depending on Supabase project API settings, even anonymous) caller can retrieve any user's transactions through this RPC. This is the most significant security gap tied to the RAG feature and is elevated in [AUDIT-REPORT.md](AUDIT-REPORT.md) and [15-security.md](15-security.md).
- Embedded text includes the full transaction description field verbatim — if a user enters sensitive free text into a description, it is sent to the Gemini embedding API unfiltered.

## Limitations

- No hybrid search (keyword + vector) — pure vector similarity only.
- No re-ranking or MMR (maximal marginal relevance) diversity step.
- No incremental re-embedding strategy if the embedding model changes (all rows would need a one-off backfill script, which does not exist).
- Similarity threshold/count values are hardcoded per call site, not configurable at runtime or per-user.
