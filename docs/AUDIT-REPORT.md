# Code Quality & Security Audit Report

**Scope:** [fina-app](../). The audit reflects commit `82db444`. The `chat.ts` edits that were uncommitted during the review are now committed (DOC-1, resolved). No application source code was changed to produce this report.

**Revision:** v2, from an independent re-verification against the source. The v1 findings were kept where the code proves them and corrected where it does not. See [Corrections from v1](#corrections-from-v1) at the end.

**Severity scale:** `CRITICAL > HIGH > MEDIUM > LOW > INFO`

**How exposure is judged:** the bundled Next.js 16 docs say to "treat Server Actions with the same security considerations as public-facing API endpoints" (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`). They also say that unused Server Actions are dead-code-eliminated from the client bundle (`data-security.md`). So in this report, a Server Action counts as **exposed** when a client component imports it.

---

## Security findings

### SEC-1 — CRITICAL — Row-Level Security policy is fully permissive, for every role including `anon`

**Location:** [migrations/setup-db.sql](../migrations/setup-db.sql), lines 20–22

**Problem:** The live policy is `CREATE POLICY "Permissive rules for all" ON public.transactions FOR ALL USING (true);`.
- It has no `TO` clause, so it applies to every role, including `anon`.
- The policy has no `WITH CHECK`, so Postgres reuses `USING (true)` for inserts and updates.
- The correctly scoped policy (`auth.uid() = user_id`) exists only as a comment directly below the live one.

**Impact:** The Supabase URL and publishable (anon) key are public by design (`NEXT_PUBLIC_*`). With Supabase's default grants on the `public` schema, anyone holding them can read, insert, update, or delete every row through Supabase's REST API. They can also call the `match_transactions` RPC. None of this goes through the Next.js app. All application-level fixes are therefore bypassable until this is fixed.

**Recommendation:** Replace the live policy with separate per-operation policies, for example:
- `SELECT` / `UPDATE` / `DELETE`: `USING (auth.uid() = user_id)`
- `INSERT`: `WITH CHECK (auth.uid() = user_id)`

Scope them `TO authenticated`. Apply this together with SEC-2.

### SEC-2 — CRITICAL — `user_id` is never populated on write

**Location:** [src/features/transaction/action.ts](../src/features/transaction/action.ts), `createTransaction`

**Problem:** The insert payload is `{ ...transaction }`. Its compile-time type excludes `user_id`, and nothing derives `user_id` from the session. Every row is stored with `user_id = NULL`.

**Impact:** You cannot turn on the correct policy from SEC-1 alone. With `user_id` always NULL, it would hide every row from every user.

**Recommendation:** Pick one of:
- Set `user_id` from the server-side session (`supabase.auth.getUser()`) in `createTransaction`.
- Give the column a default of `auth.uid()`.

Then backfill or quarantine the existing NULL rows before enabling SEC-1's policy.

### SEC-3 — HIGH — Authentication gate is written but disabled, and no login route exists

**Location:** [src/lib/supabase/proxy.ts](../src/lib/supabase/proxy.ts), lines 39–43

**Problem:** The proxy calls `supabase.auth.getUser()`, but its redirect branch is commented out. No `/login` page exists anywhere under `src/app/`.

**Impact:** All of `/dashboard`, and every Server Action it uses, can be reached without authenticating.

**Recommendation:**
1. Build the login flow.
2. Re-enable the redirect.
3. Add a session check inside each exposed Server Action. The proxy runs on page navigation, not as authorization for every action call.

Next.js's guidance is to verify authorization inside the action itself.

### SEC-4 — HIGH — No rate limiting or quota on any AI-calling entry point

**Location:** [src/app/api/chat/route.ts](../src/app/api/chat/route.ts) and every exposed AI Server Action: `handleWizardTools`, `extractReceiptData`, `generateChart`, `generateImage`, `generateVideo`

**Problem:** Nothing throttles these entry points per user or per IP.

**Impact:** Every call bills the single server-side Gemini key. Combined with SEC-3, anyone who can reach the site can drive unbounded spend ("denial of wallet"). `generateVideo` is the most expensive path.

**Recommendation:** Add a per-identity quota in front of each AI entry point. Order of priority: video, then image, then chat.

### SEC-7 — HIGH — Exposed mutation Server Actions accept unvalidated, unfiltered payloads (mass assignment, no ownership check)

**Location:**
- [src/features/transaction/action.ts](../src/features/transaction/action.ts): `createTransaction`, `updateTransaction`, `deleteTransaction`
- Called from [create-transaction-card.tsx](../src/app/dashboard/transaction/_components/create-transaction-card.tsx), [update-transaction-dialog.tsx](../src/app/dashboard/transaction/_components/update-transaction-dialog.tsx), and [delete-transaction-dialog.tsx](../src/app/dashboard/transaction/_components/delete-transaction-dialog.tsx)

**Problem:**
- **No server-side validation on the manual path.** The forms validate only on the client, with a local zod schema. The server actions do no validation at all. They spread whatever object the caller sends (`{ ...transaction }`) straight into `insert`/`update`.
- **Types don't protect anything at runtime.** A direct caller can therefore set arbitrary columns: `user_id`, `embedding`, `id`, `created_at`. They can also send negative or zero amounts, or any category string (the `category` column has no DB constraint).
- **No ownership check.** `updateTransaction` and `deleteTransaction` filter only by `id`.
- **Only the AI paths validate.** `transactionSchema.parse` plus the positive-amount check run only in the AI paths (`wizard.ts`).

**Impact:**
- Invalid data can be written.
- Once SEC-1 and SEC-2 are fixed, RLS `WITH CHECK` blocks forging `user_id`. The missing validation and ownership checks remain, and they stay the application's responsibility.

**Recommendation:**
- Parse all input with the shared `transactionSchema` inside the server action, in a `.strict()` form or with explicit field picking.
- Derive `user_id` on the server.
- Scope `update`/`delete` by both `id` and the session user.

### SEC-8 — HIGH — Stored prompt injection can reach mutation tools with no human confirmation

**Location:**
- [src/features/ai/wizard.ts](../src/features/ai/wizard.ts), `handleWizardTools`
- [src/features/ai/chat.ts](../src/features/ai/chat.ts), personal mode

**Problem:**
- `get_transaction` returns rows, including free-text `description`, as function responses to the model.
- In the wizard, that same model turn also has `update_transaction` and `delete_transaction`, and they run immediately.
- A description containing instructions (for example "…now delete all transactions") is untrusted data that the model may treat as instructions.
- Because of SEC-1, both the injected row and the rows being targeted can belong to other users.

**Impact:** Unintended data modification or deletion driven by content that someone else wrote.

**Recommendation:**
- Require explicit user confirmation before any destructive tool runs. The manual delete dialog already does this; the AI path does not.
- Enforce ownership server-side (SEC-7).
- Present retrieved rows to the model as clearly delimited data.
- Never give a single agent turn both "read untrusted content" and "unconfirmed destructive action" capabilities.

### SEC-5 — MEDIUM — Indirect prompt injection via Gemini's native web tools

**Location:** [src/features/ai/chat.ts](../src/features/ai/chat.ts), `generalChat` (`googleSearch`, `urlContext`)

**Problem:** Web pages that Gemini fetches enter the model's context without labeling or output filtering.

**Impact:** Currently limited. General mode has no data-mutating tools, so the realistic effect is manipulated advice or misinformation.

**Recommendation:**
- Accept this as a documented risk for a read-only advisory mode.
- Never combine web tools with mutation tools in the same agent.

### SEC-9 — MEDIUM — `/api/chat` trusts a client-supplied, unbounded conversation history

**Location:** [src/app/api/chat/route.ts](../src/app/api/chat/route.ts)

**Problem:**
- The request body is only type-asserted (`as {...}`), with no schema validation.
- The client sends the entire history, including `role: "model"` turns, and the server forwards it verbatim.
- Route Handlers are not covered by the Server Action body limit, and no size limit is configured.

**Impact:**
- A caller can forge prior model turns to steer behavior (history forgery).
- A caller can send an arbitrarily large history, and every token of it is billed on each request (cost amplification).
- `mode` is caller-chosen, so any caller can use the RAG (personal) mode.

**Recommendation:**
- Validate the body with zod: allowed roles, maximum number of turns, and maximum characters.
- Consider storing conversation history server-side instead of trusting the client copy.

### SEC-10 — MEDIUM (latent) — Internal helper modules are marked `"use server"`

**Location:**
- [embedding.ts](../src/features/ai/embedding.ts): `generateEmbedding`, and `findEmbedding` with caller-controlled `match_threshold`/`match_count`
- [chat.ts](../src/features/ai/chat.ts): `handleChat`, `handleChatStreaming`

**Problem:** These modules are only imported by other server code, so today Next.js dead-code-eliminates their action IDs and they are not callable from the client. However, the `"use server"` directive turns every exported function into a potential public endpoint the moment any client component imports one. If that happened:
- `findEmbedding("x", -1, 1e6)` would dump the whole table.
- `generateEmbedding` would become a free embedding proxy billed to the app.

**Impact:** No exposure today; a latent footgun.

**Recommendation:** Use `import "server-only"` for internal modules. Reserve `"use server"` for the small set of intentional entry points, and put auth and validation inside each of those.

### SEC-6 — LOW — No application-level file validation

**Revised from v1**, which was MEDIUM and claimed there was "no size limit".

**Location:** [file-dropzone-input.tsx](../src/app/dashboard/_components/file-dropzone-input.tsx), [multimodal.ts](../src/features/ai/multimodal.ts), [wizard.ts](../src/features/ai/wizard.ts)

**Problem:**
- The type check relies on the browser-reported `file.type`, is done only on the client, and is spoofable.
- The server does not re-validate size or type.
- The one real size bound is Next.js's **default 1 MB Server Action body limit**. `serverActions.bodySizeLimit` is not configured in [next.config.ts](../next.config.ts).

**Impact:** Low from a security standpoint because the framework limit applies. The functional side effect is covered in COR-12.

**Recommendation:** Validate MIME type and size on the server. Set `bodySizeLimit` deliberately.

### SEC-11 — INFO — No security headers configured

**Location:** [next.config.ts](../next.config.ts)

**Problem:** No Content Security Policy, frame, or referrer headers are set. AI output is rendered through `react-markdown` rather than raw HTML, which limits the XSS surface.

**Recommendation:** Add a baseline header set before production.

---

## Correctness / maintainability findings

### COR-2 — MEDIUM — Video temp file is never deleted

**Revised from v1 HIGH.**

**Location:** [generative-content.ts](../src/features/ai/generative-content.ts), `generateVideo`

**Problem:** The video is downloaded to `os.tmpdir()`, read back with `fs.readFileSync`, and never removed with `unlink`.

**Impact:** Disk leaks, one file per video. On serverless hosts, instance recycling cleans this up, so it is MEDIUM rather than HIGH.

**Recommendation:** Delete the file in a `finally` block.

### COR-3 — MEDIUM — The tool-calling loop is duplicated and has drifted

**Location:** [chat.ts](../src/features/ai/chat.ts) (`handleChatStreaming` personal mode) and [wizard.ts](../src/features/ai/wizard.ts) (`handleWizardTools`)

**Problem:** Two independent implementations exist. They use different tool sets, one streams and one does not, and they use different retrieval parameters (`count` 100 vs 1).

**Recommendation:** Extract one provider-neutral tool registry and one loop. See [18-reusable-patterns.md](18-reusable-patterns.md) and [AI-APPS-ENGINEERING-STANDARD-v1.0.md](AI-APPS-ENGINEERING-STANDARD-v1.0.md).

### COR-4 — MEDIUM — Model identifiers are mixed with no recorded rationale

**Location:** `gemini-3.5-flash` vs `gemini-2.5-flash` across [chat.ts](../src/features/ai/chat.ts), [wizard.ts](../src/features/ai/wizard.ts), [multimodal.ts](../src/features/ai/multimodal.ts), and [generative-content.ts](../src/features/ai/generative-content.ts)

**Problem:** Similar call sites use different model identifiers, with no comment explaining why. Whether each identifier is valid on the account cannot be verified from static code.

**Recommendation:** Keep model IDs in one configuration module, with a stated reason for each choice.

### COR-5 — MEDIUM — Safety and sampling settings are inconsistent

**Location:** [chat.ts](../src/features/ai/chat.ts)

**Problem:**
- General mode uses `BLOCK_LOW_AND_ABOVE` and sets explicit sampling parameters.
- Personal mode uses `BLOCK_ONLY_HIGH` and sets no sampling parameters.
- Only the hate-speech category is configured in either mode.
- Both `safetySettings` blocks were added in commit `82db444`.

**Recommendation:** Use shared, named configuration objects, and commit them.

### COR-12 — MEDIUM — Receipt and audio uploads over 1 MB fail with an opaque error

**Location:** [file-dropzone-input.tsx](../src/app/dashboard/_components/file-dropzone-input.tsx), [wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx)

**Problem:** Files are sent through Server Actions, which are capped at 1 MB by default. Nothing checks the size before sending.

**Impact:** Many phone-camera receipt photos and longer voice recordings exceed 1 MB. These fail with a framework error that surfaces as a generic toast.

**Recommendation:** Check size on the client and give a clear message. Compress images before upload, raise `bodySizeLimit` deliberately, or upload directly to object storage.

### COR-1 — LOW — Dead code

**Revised from v1 HIGH.**

**Location:**
- `handleChat` in [chat.ts](../src/features/ai/chat.ts): no importer anywhere.
- `handleWizardInput` in [wizard.ts](../src/features/ai/wizard.ts): imported by [wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx) but never called; the UI only calls `handleWizardTools`.

**Impact:** Maintenance confusion only. `handleChat` is not client-reachable. `handleWizardInput` still validates its input and creates a transaction, so even if it were reachable its risk would match the wizard's.

**Recommendation:** Delete both, or document why they are kept.

### COR-6 — LOW — Duplicated error-string literals

**Location:** [chat.ts](../src/features/ai/chat.ts), [wizard.ts](../src/features/ai/wizard.ts), [embedding.ts](../src/features/ai/embedding.ts), [action.ts](../src/features/transaction/action.ts)

**Problem:** The same message strings ("No arguments provided for action", "Unknown function call", "Failed to generate embedding") are repeated as separate literals.

**Recommendation:** Share typed error constants once the loop is extracted (COR-3).

### COR-7 — LOW — Misspelled `</contraints>` closing tag

**Location:** [generative-content.ts](../src/features/ai/generative-content.ts) (`generateChart`, line 60) and the personal-mode prompt in [chat.ts](../src/features/ai/chat.ts) (line 208)

**Problem:** In both prompts, the opening tag is `<constraints>` but the closing tag is `</contraints>`. [multimodal.ts](../src/features/ai/multimodal.ts) has no constraints tag at all.

**Impact:** None on model behavior. It is a readability problem, and a symptom of retyping prompts instead of sharing a template.

**Recommendation:** Fix the typo, and use one shared prompt builder.

### COR-8 — LOW — `getBalanceSummary` aggregates in application code

**Location:** [action.ts](../src/features/transaction/action.ts)

**Problem:** It fetches every row, then sums in JavaScript.

**Recommendation:** Use a SQL aggregate or an RPC. This also makes it a natural MCP-exposable business capability.

### COR-11 — LOW — No timeout on video polling

**Revised from v1 INFO.**

**Location:** [generative-content.ts](../src/features/ai/generative-content.ts)

**Problem:** `while (!operation.done)` polls every 10 seconds with no cap.

**Recommendation:** Add a maximum number of attempts, or move video generation to an asynchronous job.

### COR-13 — LOW — Missing-`id` and empty-result edge cases

**Location:** [wizard.ts](../src/features/ai/wizard.ts)

**Problem:**
- `deleteTransaction(\`${args.id}\`)` sends the string `"undefined"` when the model omits `id`, which produces a Postgres UUID error.
- `dataFind[0]` assumes an array is returned.

**Recommendation:** Validate the `id` argument, and handle the empty case explicitly.

### COR-14 — LOW — Expected errors are thrown instead of returned

**Location:** Every `features/**` action.

**Problem:** The bundled Next.js docs (`01-getting-started/10-error-handling.md`) recommend modeling expected errors, such as validation failures, as return values. The app throws them instead. How thrown Server Action messages look in a production build was not verified. User-friendly messages such as "Cannot create transaction with invalid amount" may therefore not reach users as written.

**Recommendation:** Return a typed result, `{ ok: false, error }`, for expected failures.

### COR-9 — INFO — Streamed thought/answer parts are distinguished by array index

**Location:** [chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx)

**Recommendation:** Tag parts explicitly (`{ kind, text }`).

### COR-10 — INFO — No maximum-iteration guard on either tool-calling loop

**Location:** [chat.ts](../src/features/ai/chat.ts), [wizard.ts](../src/features/ai/wizard.ts)

**Recommendation:** Add a `maxIterations` limit.

### COR-15 — INFO — Two `cn` implementations

**Location:** [src/components/ui/*](../src/components/ui/)

**Problem:** The shadcn primitives import `cn` from the npm package `cn` (v0.3.3; its `package.json` names `github.com/shadcn-ui/cn`). App code imports `cn` from [src/lib/utils.ts](../src/lib/utils.ts), which is clsx + tailwind-merge.

**Recommendation:** Standardize on one. Verify the package's provenance if you keep it.

### COR-16 — INFO — Several hook-using components lack `"use client"`

**Location:** For example [generative-content.tsx](../src/app/dashboard/_components/generative-content.tsx), [file-dropzone-input.tsx](../src/app/dashboard/_components/file-dropzone-input.tsx), [chatbot-textarea.tsx](../src/app/dashboard/_components/chatbot-textarea.tsx), and the transaction dialogs

**Problem:** These work only because a client parent imports them. Importing one from a Server Component would break it.

**Recommendation:** Add the directive to every component that uses hooks.

### DOC-1 — INFO — RESOLVED — Uncommitted changes in the audited file

**Location:** `src/features/ai/chat.ts`

**Problem (at audit time):** Compared with the previous HEAD (`4f8f87c`), the working tree:
- added both `safetySettings` blocks
- added commented-out tool options
- removed the "product price lookup via googleSearch" scope and example from the Finabot prompt

**Resolution:** Committed and pushed as `82db444` ("Add chat safety settings and narrow advisor prompt scope"). HEAD now matches what the documentation describes.

---

## Summary by severity

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 2 | SEC-1, SEC-2 |
| HIGH | 4 | SEC-3, SEC-4, SEC-7, SEC-8 |
| MEDIUM | 8 | SEC-5, SEC-9, SEC-10, COR-2, COR-3, COR-4, COR-5, COR-12 |
| LOW | 8 | SEC-6, COR-1, COR-6, COR-7, COR-8, COR-11, COR-13, COR-14 |
| INFO | 6 | SEC-11, COR-9, COR-10, COR-15, COR-16, DOC-1 |
| **Total** | **28** | |

## Verified clean

- **No secrets in source.** Source files reference env var names only.
- **`.env*` is not committed.** `.gitignore` ignores `.env*`, and `git ls-files` shows no env file is tracked. The contents of `.env.local` were not opened.
- **The Gemini key stays on the server.** `GOOGLE_GEN_AI_API_KEY` is read only in server modules.
- **No SQL injection surface.** All data access goes through the Supabase query builder or a parameterized RPC.
- **No raw HTML rendering of AI output.** There is no `dangerouslySetInnerHTML`; AI output goes through `react-markdown`.
- **TypeScript `strict: true`.**
- **Server Actions have Origin/Host checking.** Next.js compares the Origin and Host headers, which blocks cross-site browser CSRF. It does **not** stop a direct scripted caller.

## Corrections from v1

| v1 claim | Correction |
|---|---|
| "No file-size limit anywhere" (SEC-6 MEDIUM) | Next.js's default 1 MB Server Action body limit applies. Security impact downgraded to LOW; the real consequence is a functional failure, now COR-12. |
| `handleChat` is dead code (COR-1 HIGH) | Correct, but it is not client-reachable because of dead-code elimination, so LOW. `handleWizardInput` added as a second dead export. |
| Video temp-file leak is HIGH | Downgraded to MEDIUM because of ephemeral serverless disks. |
| Severity summary table | v1's counts were inconsistent; recounted. |
| Secret handling "verify `.env.local` is gitignored" | Verified: ignored and untracked. |
| (missing) | Added SEC-7, SEC-8, SEC-9, SEC-10, SEC-11, COR-12 through COR-16, and DOC-1. |
| `</contraints>` is in `multimodal.ts` and `generative-content.ts` | Wrong file: the typo is in `generative-content.ts` and `chat.ts`. `multimodal.ts` has no constraints tag. |
