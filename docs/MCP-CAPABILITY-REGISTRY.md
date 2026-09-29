# MCP Capability Registry

> **This is a readiness and design registry. No MCP server exists in this repository.** Every "Potential MCP Tool/Resource" below is a *proposed* name. The narrative behind it is in [19-mcp-readiness.md](19-mcp-readiness.md).

**Revision:** v2. Split into **Part A (AI capabilities)** and **Part B (business capabilities)**. Proposed tools no longer call an LLM.

## Prerequisites for every row in Part B

These must be fixed before any Part B capability is exposed:
- **SEC-1** permissive RLS
- **SEC-2** `user_id` never set
- **SEC-3** no authentication enforcement
- **SEC-7** unvalidated mutations

See [AUDIT-REPORT.md](AUDIT-REPORT.md). Until they are fixed, *no* capability is safe to expose to external MCP clients, whatever its individual status says.

**Common auth model, used by every Part B row unless it says otherwise:**
- **Authentication:** an OAuth 2.1 access token issued to the MCP client for exactly one user.
- **Authorization:** the tool's scope, `transactions:read` or `transactions:write`.
- **Tenant isolation:** queries run with the user-scoped Supabase session, so RLS enforces `auth.uid() = user_id`. The business layer also applies an explicit ownership predicate. The service-role key is never used.

---

## Part A — AI capabilities (stay with the customer's Claude; not MCP tools)

| Capability | Existing function | Existing file | Classification | What replaces it in MCP mode |
|---|---|---|---|---|
| Financial advice chat (persona) | `generalChat` via `handleChatStreaming` | [chat.ts](../src/features/ai/chat.ts) | NOT SUITABLE AS MCP TOOL | Optional MCP **prompt** `financial_advisor` (persona and rules as text; the server runs no model) |
| Data-grounded Q&A | `handleChatStreaming` (personal) | [chat.ts](../src/features/ai/chat.ts) | NOT SUITABLE AS MCP TOOL | Claude calls `list_transactions`, `search_transactions`, and `get_balance_summary` |
| Text/voice → transaction plus action planning | `handleWizardTools`, `handleWizardInput` | [wizard.ts](../src/features/ai/wizard.ts) | NOT SUITABLE AS MCP TOOL | Claude extracts and plans, then calls `create_transaction`, `update_transaction`, or `delete_transaction` |
| Receipt vision extraction | `extractReceiptData` | [multimodal.ts](../src/features/ai/multimodal.ts) | NOT SUITABLE AS MCP TOOL | Claude reads the attached image, then calls `create_transaction`; `fina://categories` constrains the category |
| Chart design | `generateChart` (model picks chart type and does the grouping) | [generative-content.ts](../src/features/ai/generative-content.ts) | NOT SUITABLE AS MCP TOOL | Claude renders the chart from `get_spending_breakdown` data |
| Image generation | `generateImage` | [generative-content.ts](../src/features/ai/generative-content.ts) | NOT SUITABLE AS MCP TOOL | Out of the server's scope; the customer's own tooling |
| Video generation | `generateVideo` | [generative-content.ts](../src/features/ai/generative-content.ts) | NOT SUITABLE AS MCP TOOL | Out of the server's scope. Most expensive capability, so never on the provider's bill in MCP mode |

## Part B — Business capabilities (expose through MCP)

| Capability | Existing function | Existing file | Potential MCP Tool | Potential MCP Resource | Input | Output | Authentication | Authorization | Tenant isolation | Current status | Refactoring required |
|---|---|---|---|---|---|---|---|---|---|---|---|
| List/filter transactions | `getTransactions` | [action.ts](../src/features/transaction/action.ts) | `list_transactions` | `fina://transactions/recent` (optional) | `date_from?, date_to?, type?, category?, min_amount?, max_amount?, text?, limit≤100, cursor?` | `{items, next_cursor, total}` (no embedding column) | Common | `transactions:read` | Common | MCP READY WITH REFACTORING | Add structured filters (today: text match on description only); cap `limit` (caller-controlled today); auth |
| Get one transaction | — (no equivalent; today's `get_transaction` is semantic search) | — | `get_transaction` | — | `id: uuid` | `Transaction` or not-found | Common | `transactions:read` | Common; another user's row reads as not-found | REQUIRES ARCHITECTURAL CHANGE (new business function) | New small function; needed for safe update and delete |
| Semantic search | `findEmbedding` + `match_transactions` | [embedding.ts](../src/features/ai/embedding.ts), [setup-vector.sql](../migrations/setup-vector.sql) | `search_transactions` | — | `query≤500 chars, limit≤50` | `Transaction[]` + `similarity` | Common | `transactions:read` | Common, plus an explicit `user_id` filter in the RPC | MCP READY WITH REFACTORING | Put embedding behind `EmbeddingPort`; fix the threshold on the server (caller-controlled today); add a vector index. The **only** model call in the MCP path, and it is an embedding, not an LLM |
| Balance summary | `getBalanceSummary` | [action.ts](../src/features/transaction/action.ts) | `get_balance_summary` | `fina://balance` (optional) | `date_from?, date_to?` | `{total_income, total_expense, savings, currency, period}` | Common | `transactions:read` | Common | MCP READY WITH REFACTORING | SQL aggregate (COR-8); date filter |
| Spending breakdown | — (only as LLM prompt instructions inside `generateChart`) | [generative-content.ts](../src/features/ai/generative-content.ts) | `get_spending_breakdown` | — | `group_by: category\|month\|day\|type, type?, date_from?, date_to?, top_n≤20` | `{groups:[{key,total,count}], others_total, currency}` | Common | `transactions:read` | Common | REQUIRES ARCHITECTURAL CHANGE | Reimplement the LLM-performed grouping as deterministic SQL |
| Create transaction | `createTransaction` (+ `createTransactionDeclaration`) | [action.ts](../src/features/transaction/action.ts), [function-transaction.ts](../src/features/ai/function-transaction.ts) | `create_transaction` | — | Strict `transactionSchema`: `amount>0, type, category∈CATEGORIES, description≤500, date` | Created `Transaction` incl. `id` | Common | `transactions:write` | `user_id` set on the server from the token, never from input | MCP READY WITH REFACTORING | Fix SEC-2 and SEC-7; strict parse; embedding that doesn't block the write |
| Update transaction | `updateTransaction` (+ `updateTransactionDeclaration`) | same | `update_transaction` (annotation: destructive) | — | `id` + partial validated fields | Updated `Transaction` | Common | `transactions:write` | Query requires `id` **and** ownership (today: `id` only) | MCP READY WITH REFACTORING | Ownership check; strict partial schema; stop spreading caller input |
| Delete transaction | `deleteTransaction` (+ `deleteTransactionDeclaration`) | same | `delete_transaction` (annotations: destructive, idempotent) | — | `id` | `{deleted, id}` | Common | `transactions:write` | Query requires `id` **and** ownership | MCP READY WITH REFACTORING | Ownership check; validate `id` (COR-13); client-side confirmation via the destructive annotation |
| Category taxonomy | `CATEGORIES` | [transaction-constant.ts](../src/constants/transaction-constant.ts) | — | `fina://categories` | — | `string[]` | Optional (not sensitive) | — | N/A (global) | **MCP READY** | None |
| Transaction schema | `transactionSchema` | [transaction-constant.ts](../src/constants/transaction-constant.ts) | — | `fina://schema/transaction` | — | JSON Schema (via `z.toJSONSchema`) | Optional | — | N/A | MCP READY WITH REFACTORING | Generate the JSON Schema from zod, a pattern already used in `handleWizardInput` |
| Authentication / tenancy | Supabase SSR clients (not enforcing) | [src/lib/supabase/](../src/lib/supabase/) | N/A (infrastructure) | — | — | — | Not implemented | Not implemented | Not enforced | REQUIRES ARCHITECTURAL CHANGE | OAuth for MCP; user-scoped DB sessions; fix SEC-1, SEC-2, SEC-3 |

## Status legend

- **MCP READY:** can be exposed as it is.
- **MCP READY WITH REFACTORING:** the business logic exists and is mostly provider-independent, but it needs auth, validation, or tenant scoping.
- **REQUIRES ARCHITECTURAL CHANGE:** either the capability doesn't exist yet as deterministic business logic, or it depends on infrastructure that doesn't exist (auth).
- **NOT SUITABLE AS MCP TOOL:** the capability's value is LLM reasoning or generation, which belongs to the customer's Claude.

## Explicitly rejected designs

- **`extract_receipt`, `generate_chart`, `generate_image`, `generate_video`, and `chat` as MCP tools.** Each would wrap a Gemini call inside the MCP server ("LLM inside MCP"). They were rejected for cost, duplicated reasoning, injection surface, and non-determinism.
- **Passing a caller-chosen similarity threshold or unlimited `limit`/`match_count` to tools.** That allows full-table extraction. Fix these values on the server.
