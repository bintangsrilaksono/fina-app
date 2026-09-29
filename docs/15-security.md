# Security

This is the descriptive security review of [fina-app](../). Findings with severity ratings and recommendations are in [AUDIT-REPORT.md](AUDIT-REPORT.md). IDs such as SEC-1 refer to that report.

**Revision:** v2, independently re-verified against the source. It describes commit `82db444`.

## Bottom line

The app is suitable as a **single-developer demo**. It is **not safe for more than one real user's financial data**, for three reasons:
- There is no per-user data isolation at the database layer (SEC-1, SEC-2).
- Authentication is not enforced anywhere (SEC-3).
- Mutation endpoints trust caller input (SEC-7).

These three must be fixed together. Fixing any one of them alone still leaves the data exposed.

---

## 1. Secrets and API keys

The app declares three environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `GOOGLE_GEN_AI_API_KEY`. Only their names appear in [.env.example](../.env.example) and [src/config/environment.ts](../src/config/environment.ts).

- **`.env*` files are not committed.** [.gitignore](../.gitignore) ignores `.env*`, and `git ls-files` confirms no env file is tracked. `.env.local` exists locally; this review did not open it.
- **The Gemini key never reaches the browser.** `GOOGLE_GEN_AI_API_KEY` is read only in [instance.ts](../src/features/ai/instance.ts). That file is imported only by server modules, so the key is not bundled into client code.
- **The Supabase publishable key is public by design.** This is safe only when RLS actually protects the data. Today it does not (see section 3).
- **No secrets are hardcoded** anywhere in `src/` or `migrations/`.

## 2. Authentication

- **Supabase SSR clients exist** for the browser ([client.ts](../src/lib/supabase/client.ts)), the server ([server.ts](../src/lib/supabase/server.ts)), and the proxy ([lib/supabase/proxy.ts](../src/lib/supabase/proxy.ts)).
- **No login or signup UI exists.** There is no auth route anywhere in [src/app](../src/app/).
- **The proxy does not gate anything.** It calls `auth.getUser()`, but the redirect is commented out, so its only real effect is refreshing the session cookie.
- **No Server Action checks for a session.** Next.js's own guidance, in the bundled `authentication.md`, is to treat Server Actions like public API endpoints and to verify authorization inside each one.
- **Verdict:** authentication is not enforced (SEC-3).

## 3. Authorization, tenant isolation, and database access

- **RLS is enabled but permissive.** The policy is `FOR ALL USING (true)` with no `TO` clause, so it applies to `anon` as well ([setup-db.sql](../migrations/setup-db.sql)). Anyone with the public Supabase URL and key can read or modify the whole `transactions` table through Supabase's REST API, completely bypassing the Next.js app (SEC-1).
- **`user_id` is never set on insert (SEC-2).** Even the correct policy, which exists only as a comment, would currently hide every row.
- **No application-level ownership checks exist.** `updateTransaction` and `deleteTransaction` filter only by `id`, and nothing adds a user filter to list, summary, or vector-search queries.
- **The vector-search function runs as the caller.** `match_transactions` uses the Postgres default, `SECURITY INVOKER`. That is the right choice, because RLS will apply to it once RLS is fixed. It scans all rows only because the policy allows it.
- **The server uses the caller's session, not the service-role key.** [server.ts](../src/lib/supabase/server.ts) forwards the user's cookie. This is the correct basis for RLS-based isolation, and it must be kept in any refactor, including any future MCP server.

## 4. User input validation and mass assignment

| Entry point | Server-side validation |
|---|---|
| Manual create/update forms → `createTransaction` / `updateTransaction` | **None.** The zod schema runs only in the browser. The server spreads the caller's object straight into `insert`/`update`, so any column can be set (SEC-7). |
| Wizard (`handleWizardTools`) | Arguments are parsed with `transactionSchema.parse` and checked for a positive amount. There is no ownership check. |
| Receipt extraction (`extractReceiptData`) | The model's output is parsed with zod. The uploaded file is not validated on the server. |
| `/api/chat` | Only a type assertion; no schema validation and no size limit. The client can forge `model` turns in the history (SEC-9). |
| Chart, image, and video generation | Free-text requests with no length limit. |

Because Server Actions go through Next.js, uploads are capped by the framework's **default 1 MB Server Action body limit**; `bodySizeLimit` is not configured. That limit prevents very large payloads, but it also breaks ordinary phone-photo receipts (COR-12, SEC-6).

## 5. Prompt injection

| Vector | Where | Blast radius today |
|---|---|---|
| **Direct:** user text inserted into prompt templates | Every AI feature | Low. The user can only affect their own request, except in the wizard, whose tools can mutate data. |
| **Indirect, from the web:** `googleSearch` and `urlContext` | General chat mode ([chat.ts](../src/features/ai/chat.ts)) | Manipulated advice. This mode has no tools that change data (SEC-5). |
| **Stored:** attacker-written `description` text returned to the model through `get_transaction` | Wizard and personal chat | **High in the wizard.** The same model turn can call `update_transaction` or `delete_transaction` with no confirmation. Because of SEC-1, the injected row can come from another user (SEC-8). |
| **History forgery:** fake `model` turns in the client-supplied conversation | `/api/chat` | Steers the model's behavior and inflates token cost (SEC-9). |

## 6. Tool execution risks

- **No human confirmation before destructive tools.** The wizard's `delete_transaction` and `update_transaction` run as soon as the model calls them. The manual delete button does show a confirmation dialog, so the AI path is weaker than the manual path.
- **No limit on tool-loop iterations** (COR-10).
- **Tool arguments are checked for shape, not permission.** The wizard applies zod parsing and the amount rule, but never checks that the transaction belongs to the caller.
- **An unknown tool name aborts the whole batch.** Tool calls run together in `Promise.all`, so this fails safe, but it also discards the other results.

## 7. File access

- `generateVideo` writes to `os.tmpdir()` using a name the app generates (`temp-video-${Date.now()}.mp4`). No user input reaches the path, so there is no path traversal. The file is never deleted (COR-2).
- No other code in the app reads or writes the filesystem.

## 8. External API access

- **Gemini** is called with one app-wide key for every user. There is no per-user quota and no cost ceiling (SEC-4).
- **Gemini's built-in web tools** fetch URLs on Google's infrastructure, not from this server. The app therefore has no server-side request forgery (SSRF) exposure from them; the concern is untrusted content entering the model's context (section 5).
- **No other outbound HTTP calls** are made by application code.

## 9. Privilege escalation and sensitive data exposure

- **Horizontal privilege escalation is currently trivial.** Any caller can read or modify any user's rows (SEC-1, SEC-7). Once RLS is fixed, the database's `WITH CHECK` will stop a caller from forging `user_id`, but the application should still build the insert payload explicitly rather than spreading caller input.
- **Financial data is sent to Google.** Transaction descriptions and amounts go to Google for embeddings and generation. Users would need to be told this in a real product.
- **Error messages reach the user as written.** Server errors are thrown with their `message` and shown in a toast. How much Next.js masks thrown Server Action messages in a production build was not verified (COR-14).
- **No security headers are configured** (SEC-11).

## 10. Framework protections the app relies on

- **Origin/Host check on Server Actions.** Next.js compares the two headers, which blocks cross-site browser CSRF. It does not stop a scripted client.
- **Dead-code elimination of unused Server Actions.** Server modules that no client component imports, such as `embedding.ts` and `handleChat`, are not reachable from the browser. They are still marked `"use server"`, which is a latent risk if a client component ever imports them (SEC-10).
- **1 MB default body limit on Server Actions.** Route Handlers such as `/api/chat` do not get this limit.

## 11. MCP security (forward-looking; no MCP code exists)

The app has no MCP server. If one is built (see [19-mcp-readiness.md](19-mcp-readiness.md)), it inherits every data-layer gap listed above, and it adds the following requirements:

1. **Fix SEC-1, SEC-2, and SEC-7 first.** An MCP server gives external clients a programmatic surface. Any isolation gap becomes easier to exploit, not harder.
2. **Use OAuth-based authorization for a remote MCP server,** as the MCP authorization spec describes. Map each access token to exactly one tenant or user. Run database access with that user's scoped Supabase session so RLS enforces isolation. Never use the service-role key for tool execution.
3. **Don't pass tokens through.** The MCP server must not forward the MCP client's token to downstream APIs.
4. **Treat tool output as untrusted data.** Transaction descriptions returned to the customer's Claude are attacker-controllable. Return data in structured fields, not as instruction-like prose. Mark destructive tools with `destructiveHint` so MCP clients can ask the user to confirm, and keep enforcing ownership on the server regardless.
5. **Limit what each tool call can cost.** Apply per-token rate limits, cap result sizes, and paginate list and search tools.
6. **Keep an audit log.** Record every tool invocation with the tenant, tool name, arguments hash, and result status.
7. **Don't put a second LLM inside the MCP server** to reinterpret requests. It widens the injection surface and puts inference cost back on the provider; see [20-api-vs-mcp-architecture.md](20-api-vs-mcp-architecture.md).
