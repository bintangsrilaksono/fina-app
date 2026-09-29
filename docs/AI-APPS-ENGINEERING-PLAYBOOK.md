# AI Apps Engineering Playbook

This playbook extracts reusable engineering principles from what was actually built in [fina-app](../), including its mistakes. It is meant for future AI SaaS, RAG, agent, tool-based, multimodal, and MCP / connector applications.

**How to read it (v2).** Each section has two clearly separated parts:
- **Current project implementation (fina-app)** is evidence: what this repo actually does, verified against the source.
- **Reusable engineering standard** is guidance that applies to *any* future AI application, whether or not it resembles fina-app.

If you are starting a new project, you can read only the "Reusable engineering standard" paragraphs. The one-page summary is [AI-APPS-ENGINEERING-STANDARD-v1.0.md](AI-APPS-ENGINEERING-STANDARD-v1.0.md), and the terminology it uses is defined there.

---

## 1. Problem Definition

**Current project implementation (fina-app):** solves a narrow, concrete problem, tracking personal transactions, with AI layered on top as an accelerant: faster entry and richer insight. The AI features are conveniences over a CRUD core. **Correction (v2):** that core is *not* independent of AI. `createTransaction` and `updateTransaction` call Gemini synchronously to embed each row, so even a manual transaction entry fails when Gemini is unavailable.

**Reusable engineering standard:**
- Build the non-AI data core first, and make sure it works on its own. Treat AI as an enhancement layer that points at that core.
- Keep AI side effects, such as embeddings, **off the critical write path**: make them asynchronous, or tolerant of failure and backfilled later.
- Together these make the app resilient to AI provider outages and give you a fallback UX.

**Checklist:**
- [ ] Can you describe the product's value in one sentence without mentioning AI?
- [ ] Does the app degrade (not crash) if the AI provider is unreachable?

## 2. User Definition

**Current project implementation (fina-app):** wrote the target user directly into the system prompt (age range, income band, country, persona register — see [chat.ts](../src/features/ai/chat.ts)) rather than leaving it implicit.

**Reusable engineering standard:** an explicit user profile in the prompt materially improves tone/relevance, but only do this once you actually know your user — a wrong persona baked into every prompt is worse than a neutral one.

## 3. Workflow Definition

**Current project implementation (fina-app):** the "Finabot" system prompt encodes an explicit 5-step workflow (extract → analyze → plan → evaluate → respond) as part of the prompt itself, not as separate orchestration code.

**Reusable engineering standard:** for single-call conversational features, an explicit reasoning workflow inside the prompt is cheap and effective. For multi-step *actions* (not just reasoning), don't rely on prompt-only workflow instructions — see the wizard's tool-calling loop, where the actual sequencing is enforced by code (the loop), with the prompt only suggesting an order ("call get_transaction first"). Prompt-only sequencing for actions is a soft suggestion the model can ignore; code-enforced sequencing is a guarantee. Choose deliberately which one a given step needs.

## 4. AI Capability Selection

**Current project implementation (fina-app):** selected a different capability per problem shape — plain generation for chat, structured output for data extraction, function calling for actions, RAG for grounding, vision for receipts, audio for voice input, image/video generation for dashboard insights. No single capability was forced to do a job it's bad at (e.g. it didn't try to make chat *also* generate charts — that's a separate structured-output call).

**Reusable engineering standard:** map each user-facing feature to the *narrowest* AI capability that solves it, and don't reuse one call shape for multiple jobs just for code reuse. Match the tool to the task:

| Task shape | Capability | fina-app example |
|---|---|---|
| Open-ended advice | Plain chat generation | General mode |
| "Turn this into a record" | Structured output (schema-constrained) | Wizard, receipt extraction |
| "Do something to my data" | Function/tool calling | Wizard CRUD, chat's read-only tool |
| "Answer using my own data" | RAG | Personal chat mode, generative content |
| "Understand this file" | Multimodal input | Receipt image, voice recording |
| "Produce this file" | Multimodal output | Chart/image/video generation |

## 5. Architecture Selection

**Current project implementation (fina-app):** feature-folder Server Actions, no layered service/repository split, one API route only where streaming demanded it.

**Reusable engineering standard:** don't build ceremony you don't need, but always keep three seams from day one, because they are cheap and hard to retrofit:
1. **AI provider adapter.** SDK types are imported only here.
2. **Business logic.** Validation, rules, and ownership checks go here, with no AI SDK imports and no framework imports.
3. **Delivery.** Server Actions, routes, and later an MCP server are thin callers of the business logic.

Add the fuller layers (a tool registry, the orchestration layer, the MCP adapter) once a second entry point needs the same logic. An MCP server always counts as a second entry point, and so does a second AI feature that uses tools.

In fina-app, the tool-calling loop should have been extracted the second time it was needed. Use a Route Handler only for what Server Actions do poorly, such as raw streaming responses. When you do, remember that a Route Handler doesn't get the Server Action protections: the Origin check and the 1 MB body limit.

The full layering is in [AI-APPS-ENGINEERING-STANDARD-v1.0.md](AI-APPS-ENGINEERING-STANDARD-v1.0.md).

## 6. LLM Selection

**Current project implementation (fina-app):** used one provider (Gemini) for everything — chat, embeddings, structured output, vision, image gen, video gen — via one thin factory function, but picked *inconsistent model versions* across similar call sites with no documented reason (a real mistake — see [AUDIT-REPORT.md](AUDIT-REPORT.md) COR-4).

**Reusable engineering standard:** centralizing client construction (one factory) is good; centralize *model selection* too, as named constants with a one-line comment justifying each ("this call needs low latency," "this call needs the largest context," etc.). Never let two structurally-similar call sites silently diverge on model choice.

## 7. Prompt Engineering

**Current project implementation (fina-app):** a consistent `<role>/<instruction>/<context>/<constraints>/<outputFormat>` XML-tag structure across most extraction/generation prompts, plus a full role/context/constraints/workflow/format/examples system prompt for the conversational persona.

**Reusable engineering standard:** pick one structured prompt template shape and copy it verbatim (not retyped) into every new prompt — this repo's one recurring typo (`</contraints>`) is a direct consequence of retyping instead of sharing a template function. Extract a `buildPrompt({role, instruction, context, constraints, outputFormat})` helper on day one.

**Checklist:**
- [ ] Is there a single source for your prompt template shape, not copy-pasted strings?
- [ ] Does every prompt that needs "today's date" or similar dynamic context get it injected the same way?

## 8. Structured Output

**Current project implementation (fina-app):** used `responseSchema` (two different authoring styles — hand-written `Type` objects and `z.toJSONSchema()`) plus always re-validating with Zod after parsing, in most but not all places (one call site skipped `responseSchema` entirely and relied on prompt wording alone — a weaker approach that still worked but was less robust).

**Reusable engineering standard:** always derive your AI response schema from the same Zod (or equivalent) schema you'll use to validate the parsed result — one source of truth that can also drive form validation. **fina-app does not do this.** Its forms define their own local zod schemas, in which `amount` is a string and `category` accepts any string, while `transactionSchema` is used only on the AI paths. Never skip setting `responseSchema`/`responseMimeType` just because prompt instructions "should" produce JSON — always set both when the SDK supports it, and always re-validate regardless.

## 9. Streaming

**Current project implementation (fina-app):** hand-rolled a newline-delimited-JSON stream over a raw `ReadableStream` + `fetch` reader, distinguishing "thought" vs "answer" content by a string prefix (`[thought]`) server-side and by array index client-side.

**Reusable engineering standard:** hand-rolling streaming is viable without a library dependency, but tag content by an explicit field (`{kind: "thought"|"answer", text}`), never by array position — position-based coupling between server emission order and client parsing (as this repo does) is a real fragility (AUDIT-REPORT COR-9). If you need streaming with tool-calling, multi-turn state, or resumability, evaluate a dedicated SDK (e.g. Vercel AI SDK) before hand-rolling more than this repo did.

## 10. RAG Decision

**Current project implementation (fina-app):** used RAG for exactly the cases where general model knowledge is useless (the user's own private transaction data) and skipped it everywhere else (general financial-advice mode has no RAG).

**Reusable engineering standard:** RAG is not a default — apply it only when the answer genuinely requires retrieving specific stored data, and offer both integration shapes deliberately (tool-mediated for "sometimes needed," pre-fetch for "always needed" — see [18-reusable-patterns.md](18-reusable-patterns.md)).

## 11. Embedding

**Current project implementation (fina-app):** embeds one whole small record (a transaction) as a single unit; embeds on every write, synchronously.

**Reusable engineering standard:** for small, atomic records, whole-record embedding is fine and avoids chunking complexity entirely. For anything larger (documents, long text), you'd need a chunking strategy this repo never had to build — don't copy the "embed the whole JSON blob" approach for large text. Decide explicitly whether embedding failures should block the write (this repo blocks, which is simple but couples data-write availability to AI-provider availability — know that tradeoff, don't back into it).

## 12. Vector Database

**Current project implementation (fina-app):** used pgvector inside the existing Postgres instance rather than a dedicated vector-DB service.

**Reusable engineering standard:** default to pgvector-in-Postgres when your data already lives in Postgres and your scale is modest — it avoids an entire extra service and keeps transactional consistency between the record and its embedding. Add a vector index (`ivfflat`/`hnsw`) once table size makes sequential scan too slow — this repo never needed to (and didn't), but a bigger deployment would.

## 13. Tool Calling

**Current project implementation (fina-app):** declared tools with tight, purpose-specific schemas but reused one shared "all fields optional" properties object across all four declarations rather than giving each its own minimal schema.

**Reusable engineering standard:** give each tool the *minimal* schema it actually needs (e.g. `get_transaction` shouldn't expose a settable `amount` "filter" that's really meant for creation) — sharing a properties object for DRYness traded away schema precision here.

## 14. Function Calling

**Current project implementation (fina-app):** the wizard re-validates tool arguments with `transactionSchema.parse` and checks for a positive amount inside its tool executor. **Correction (v2):** the human-submitted path is weaker than the AI path. The manual forms validate only in the browser, and the `createTransaction` and `updateTransaction` Server Actions do no validation at all (SEC-7). Validation is forked between the two paths instead of shared.

**Reusable engineering standard:** never trust a function-declaration schema alone. The model can still send malformed arguments, or arguments that break business rules, even in JSON mode. Put validation and business rules **inside the business-logic function itself**, for example `TransactionService.create(input, user)`. Then every caller gets the same checks: a form, an AI tool call, or an MCP client. Don't place checks at the call site, where one path can skip them.

## 15. Agent Decision

**Current project implementation (fina-app):** used a hand-rolled loop for a 4-tool, single-turn-batch surface instead of adopting an agent framework.

**Reusable engineering standard:** don't reach for a framework before you need one — a `while` loop around "call model, execute functionCalls, feed results back" is legitimate for small, fixed tool surfaces. Do reach for a shared, tested helper (not a framework, just your own extracted function) the *second* time you need this loop — this repo needed it twice and wrote it twice, which is the concrete mistake to avoid (AUDIT-REPORT COR-3).

## 16. Multimodal Decision

**Current project implementation (fina-app):** used vision for a task well-suited to it (receipt OCR + structured extraction in one call) and voice input for a task well-suited to it (hands-free transaction entry), rather than defaulting to multimodal everywhere.

**Reusable engineering standard:** multimodal input is worth its complexity when it replaces a whole separate pipeline (OCR + NLP, or STT + NLP) with one model call — as it does here. It's not worth it when a simpler modality (typing) would serve the same job just as well.

## 17. Database Design

**Current project implementation (fina-app):** one table, with a `user_id` FK for future multi-tenancy support and a `vector` column colocated with relational columns — but never actually wired up the `user_id` population or the matching RLS policy (see below).

**Reusable engineering standard:** if you add a `user_id`/tenant column "for later," either wire it up immediately or explicitly flag it as unused/TODO with a tracked issue — leaving it silently unpopulated while RLS is *enabled but permissive* is the most dangerous middle state (it looks secure, isn't). Either enforce it now or don't half-build it.

## 18. API Design

**Current project implementation (fina-app):** Server Actions for everything except the one case needing raw streaming, which got a dedicated route.

**Reusable engineering standard:** let the transport requirement (does this need to stream? does it need to be called from outside your own Next.js app?) decide Server Action vs. REST route — don't default to one or the other dogmatically.

## 19. Frontend Architecture

**Current project implementation (fina-app):** one consistent `useMutation`/`useQuery` + toast + refetch pattern, copy-pasted across every AI-calling component rather than extracted into a shared hook.

**Reusable engineering standard:** the *pattern* (React Query wrapping a Server Action, with a consistent success/error UX) is worth reusing verbatim across your own project. The *copy-paste* is not — extract a `useServerActionMutation(fn, {successMessage})`-style hook once you have 3+ near-identical call sites, as this repo should have.

## 20. Backend Architecture

**Current project implementation (fina-app):** feature-folder Server Actions with no shared middleware layer for cross-cutting concerns.

**Reusable engineering standard:** as soon as you need a second cross-cutting concern (this repo will eventually need auth-gating *and* rate-limiting *and* logging on its AI Server Actions), build a small wrapper (`withAiAction(fn)`) rather than adding each concern to every file by hand.

## 21. Security

**Current project implementation (fina-app):** got secrets-handling right (server-only API key) but left RLS permissive and auth disabled — a case study in "the scaffolding was built, the last step was skipped."

**Reusable engineering standard:** treat "enable RLS" and "write the correct policy" as one atomic task, not two — this repo shipped the first without the second, which is strictly worse than not enabling RLS at all (it creates false confidence). Same for auth middleware: don't merge/ship a commented-out redirect; either finish it or don't scaffold it yet.

## 22. Authentication

**Current project implementation (fina-app):** built all three Supabase Auth client contexts (browser/server/middleware) correctly, but never built a login page and never flipped on the redirect.

**Reusable engineering standard:** auth infrastructure and auth *enforcement* are separate milestones — track them as separate checklist items, because it's easy to consider "I set up the Supabase client" as "done" when the actual security property (gated routes) isn't there yet.

## 23. Multi-tenancy

**Current project implementation (fina-app):** designed for it (schema has `user_id`) but never implemented it (never populated, never enforced).

**Reusable engineering standard:** if you're not ready to enforce tenant isolation yet, don't add the column and the permissive-but-enabled RLS policy — that combination is more dangerous than having neither, because it looks finished in a schema review.

## 24. Error Handling

**Current project implementation (fina-app):** consistent "throw plain Error, catch at UI boundary, toast the message" — simple, works, but leaks internal error strings (e.g. raw Zod messages) to end users and has zero centralized logging.

**Reusable engineering standard:** the throw/catch/toast shape is fine for a small app's UX layer. Add, on top of it (not instead of it): (1) a centralized place errors are logged before being thrown to the boundary, and (2) a translation step between "internal error message" and "user-facing message" so implementation details never reach the toast.

## 25. Testing

**Current project implementation (fina-app):** none. Zero tests, zero eval harness.

**Reusable engineering standard:** for AI features specifically, testing has two halves people often only do one of: (1) ordinary code tests (validation logic, pure functions, DB access with a test database) and (2) AI-output evaluation (does the model still produce schema-valid, on-task output for a fixed set of golden prompts). This repo has neither; a future project should budget for both from day one, since #2 is what catches prompt/model-version regressions that #1 never will.

## 26. AI Evaluation

**Current project implementation (fina-app):** none — no golden dataset, no regression check when models/prompts change.

**Reusable engineering standard:** given this repo already mixes two model versions with no explanation (COR-4), a minimal eval suite (even 10–20 fixed inputs with expected output shape) would have caught whether that inconsistency was safe or a live bug. Build this before you have more than one model version in play, not after.

## 27. Cost Considerations

**Current project implementation (fina-app):** no rate limiting, no cost tracking, an unbounded video-generation path (the most expensive capability) with no guardrails.

**Reusable engineering standard:** rank your AI features by cost-per-call before launch, and put the tightest guardrails on the most expensive one first. Video generation should have been the *first* thing rate-limited here, not left unguarded.

## 28. Performance

**Current project implementation (fina-app):** computed a balance aggregate by pulling every row into application code instead of a SQL aggregate (COR-8); no caching anywhere.

**Reusable engineering standard:** push aggregation into the database whenever the aggregate (not the raw rows) is what the UI needs — this is a correctness-adjacent performance principle, not a premature optimization, because the alternative doesn't scale at all past small datasets.

## 29. Deployment

**Current project implementation (fina-app):** none — no CI, no deployment config of any kind.

**Reusable engineering standard:** even a minimal CI step (type-check + lint on every push) costs little and catches real regressions; this repo had zero automated gate between "code compiles on my machine" and "code is in the repo."

## 30. Monitoring

**Current project implementation (fina-app):** none — no logging, no error tracking, no usage/cost dashboard.

**Reusable engineering standard:** for an AI feature specifically, at minimum log (model, latency, success/failure, and — if feasible — token counts) for every call; this repo has no way to answer "how much is this feature costing us" or "did our error rate change after this prompt edit," which are the two questions that matter most once an AI feature is live.

## 31. MCP Integration

**Current project implementation (fina-app):** no MCP code exists. The four Gemini function declarations and the two `switch` dispatchers are the nearest thing to a tool layer, and they are Gemini-specific and duplicated.

**Reusable engineering standard:**

1. **Classify every capability before you design anything.**
   - **AI capabilities**: generation, reasoning, summarization, extraction, visualization design, image and video generation.
   - **Business capabilities**: CRUD, search, reporting, calculations, knowledge retrieval, external-system actions.

   In MCP mode, the customer's Claude owns the AI capabilities, and your MCP server exposes *only* business capabilities.
2. **No LLM inside the MCP server.** If a proposed tool would call an LLM to produce its result (`generate_chart`, `extract_receipt`, `chat`), redesign it: return the data and let Claude do the reasoning. The only narrow exception is embedding generation for semantic search, and even that is optional.
3. **Return data, not prose.** Tool output should be structured, paginated, and deterministic. Compute business numbers (totals, breakdowns) in the database so Claude reasons over correct figures instead of doing arithmetic.
4. **Build one provider-neutral tool layer** (name, zod schema, handler, annotations). Render it into LLM function declarations for API mode and into MCP tools for MCP mode, so the business rules cannot drift between modes.
5. **Isolation comes first.** Each OAuth token maps to one user or tenant. Run tools with a user-scoped database session under RLS, add explicit ownership predicates, never use a service-role key for tool execution, and never pass tokens through to downstream APIs.
6. **Destructive tools** carry `destructiveHint` annotations so the client can confirm, and the server still enforces ownership. Every tool gets rate limits, result-size caps, and an audit log.
7. **Treat tool output as untrusted input** to the client's model, because it can contain user-written text. Keep it in structured fields.
8. **Personas and workflows become MCP prompts**, which the customer opts into, not hidden server-side system instructions.

The worked example is [19-mcp-readiness.md](19-mcp-readiness.md), and the per-capability table is [MCP-CAPABILITY-REGISTRY.md](MCP-CAPABILITY-REGISTRY.md).

## 32. Production Readiness

**Overall verdict for fina-app, stated plainly:** a strong, feature-complete demonstration of AI-integration *techniques* (RAG, tool calling, multimodal, structured output, streaming all genuinely work), paired with a security/production posture that is pre-production (permissive RLS, no auth enforcement, no tests, no CI, no rate limiting). The two are independent axes — do not let "the AI features work well" stand in for "this is ready for real users," and vice versa: do not let the production gaps make you discount what the AI-technique implementations get right. See [GAP-ANALYSIS.md](GAP-ANALYSIS.md) for the itemized path from one to the other.

---

## Master checklist

See [AI-APP-DEVELOPMENT-CHECKLIST.md](AI-APP-DEVELOPMENT-CHECKLIST.md) for a condensed, reusable checklist form of this entire playbook.
