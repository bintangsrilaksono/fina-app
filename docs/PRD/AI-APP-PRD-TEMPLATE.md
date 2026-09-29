# Reusable PRD Template — AI-Powered Application

**Revision:** v2. Adds §0 (application type profile), §0.1 (AI vs. business capability classification), and an expanded §31 (MCP).

A generic template for future plain-AI, AI SaaS, RAG, agent, tool-based, multimodal, and MCP applications, informed by the concrete decisions and gaps documented in [PROJECT-PRD.md](PROJECT-PRD.md) and [../AI-APPS-ENGINEERING-PLAYBOOK.md](../AI-APPS-ENGINEERING-PLAYBOOK.md). Copy this file per new project and fill in every bracketed section — do not leave a section blank; write "N/A — because ___" if it genuinely doesn't apply, so the decision is recorded rather than silently skipped.

---

## 0. Application Type Profile (fill this in first)

Tick every profile that applies. Each ticked profile makes some later sections **mandatory**.

| Profile | Tick | Mandatory sections |
|---|---|---|
| Plain AI application (generation or extraction, no retrieval, no tools) | [ ] | 8, 9, 0.1, 19, 22, 23 |
| RAG application | [ ] | + 10, 11, 12, and 30 (retrieval tenant scoping) |
| Tool-based AI (the model calls your functions) | [ ] | + 13, 29 (approval gates), 19 (authorization) |
| AI agent (multi-step autonomous tool use) | [ ] | + 14 (loop limits), 29, 22 (evaluation of trajectories, not just final answers) |
| Multimodal (image, audio, video, or PDF in or out) | [ ] | + 15, upload limits in 19 |
| MCP / connector (customer brings their own Claude) | [ ] | + 0.1 (strictly), 30, 31 |

## 0.1 Capability Classification: AI vs. business

List every capability and classify it. This one table decides your architecture, your cost model, and what could be exposed through MCP.

| Capability | Type: AI (generation, reasoning, extraction, visualization) or business (CRUD, search, reporting, calculation, retrieval) | Deterministic? | Who performs it in API mode | Who performs it in MCP mode | Exposed as MCP tool / resource / prompt / none |
|---|---|---|---|---|---|
| [...] | | | Your app plus your LLM | **Customer's Claude** for AI capabilities; **your server** for business capabilities | |

The rules:
- **Business calculations are deterministic and server-side,** never delegated to an LLM.
- **In MCP mode, AI capabilities belong to the customer's Claude.** An MCP tool whose implementation calls an LLM needs a written justification here. The default answer is "redesign it to return data instead."

(Reference example: [../19-mcp-readiness.md](../19-mcp-readiness.md) sections A and B.)

## 1. Product Overview
[One paragraph: what is this, who is it for, what does AI add that non-AI wouldn't.]

## 2. Problem Statement
[The specific problem, for the specific user, in one paragraph. Avoid describing the solution here.]

## 3. Objectives
[Numbered, measurable where possible.]

## 4. Users
[Personas, roles, segmentation if any. State explicitly if there is no role system — that's a real answer.]

## 5. User Journeys
[Numbered, one per distinct flow. Each should name the actual files/functions once built — leave placeholders now.]

## 6. Scope
### In scope
[...]
### Explicitly out of scope
[Say what you're deliberately not building, not just what you haven't gotten to yet.]

## 7. Functional Requirements
[Numbered FR-n list, testable.]

## 8. AI Requirements — Decision Section

**LLM provider decision:**
- [ ] Single provider, no abstraction (fastest to build, least portable — this is what fina-app did)
- [ ] Single provider, behind an abstraction interface (moderate cost, portable later)
- [ ] Multi-provider from day one (highest cost, only justify if you have a concrete near-term second-provider need)

**Model selection:** list every model you'll use and *why*, per capability (chat, embedding, vision, image/video gen). Do not leave "why" blank — fina-app's undocumented mixed model versions across similar call sites is a documented anti-pattern (see [AUDIT-REPORT.md](../AUDIT-REPORT.md) COR-4).

**API mode vs. MCP mode:**
- [ ] API mode only (you pay for all inference)
- [ ] MCP mode only (customer brings their own Claude)
- [ ] Both (hybrid — reuse one data/action layer for both; see [../20-api-vs-mcp-architecture.md](../20-api-vs-mcp-architecture.md))

If MCP mode is selected or planned, complete Section 32 (MCP Integration) now, not later — retrofitting provider-agnostic data access after building provider-coupled code is expensive (see [../19-mcp-readiness.md](../19-mcp-readiness.md)).

## 9. Prompt Requirements
[Which features need a persona/system-instruction vs. a task-specific extraction prompt. Define your prompt template shape (e.g. XML-tag sections) once, here, and reuse it everywhere — don't let each engineer invent their own.]

## 10. RAG Requirements — Decision Section
- [ ] Is RAG needed at all? (Only if the answer requires data the model doesn't and shouldn't have parametrically — e.g. private user data.)
- [ ] Retrieval integration style: tool-mediated (model decides when to retrieve) vs. pre-fetch (always retrieve before prompting) — see [../18-reusable-patterns.md](../18-reusable-patterns.md).
- [ ] Chunking strategy (N/A if embedding whole small records, as fina-app did; required for long documents).
- [ ] **Tenant scoping of retrieval — mandatory if multi-user.** State explicitly how retrieval queries are scoped to the calling user/tenant. fina-app shipped this unscoped; do not repeat that.

## 11. Embedding Requirements
[Model, dimensionality, write-path trigger (on create/update? batch job? queue?), failure behavior (block the write, or write without an embedding and backfill?).]

## 12. Vector Database Requirements
[pgvector-in-existing-Postgres vs. dedicated vector DB — justify by expected scale. Note indexing plan (ivfflat/hnsw) and at what row count you'll add it.]

## 13. Tool Requirements
[List each tool, its minimal schema (not a shared "everything optional" object across tools — see Playbook §13), and whether it's read-only or mutating.]

## 14. Agent Requirements — Decision Section
- [ ] No agent needed (single-call generation/extraction only)
- [ ] Hand-rolled tool-calling loop (small, fixed tool surface — extract as a shared helper from the start, unlike fina-app's duplicated loop)
- [ ] Agent framework (large/dynamic tool surface, multi-agent handoff, persistent memory needed)

If a loop is chosen: define the max-iteration guard now (fina-app had none — AUDIT-REPORT COR-10).

## 15. Multimodal Requirements
[Per modality (image/audio/video/PDF) in and out: which features need it and why a simpler modality wouldn't do.]

## 16. Data Requirements
[Schema sketch. For every table with a tenant/user column: state explicitly, right here, whether it will be populated on write and whether RLS (or equivalent) will be enforced from day one. This is the single highest-leverage question in this template — fina-app's answer was "column exists, neither is true," which was its worst gap.]

## 17. UI Requirements
[Pages, key components, design system.]

## 18. API Requirements
[Server Actions vs. REST — decide per-endpoint based on whether it needs streaming or external (non-same-app) callers, not by default.]

## 19. Security — Decision Section
- [ ] Secrets: server-only env vars, never bundled client-side — non-negotiable baseline.
- [ ] Authentication: provider, and — critically — **the enforcement mechanism must be verified working (e.g. a test that an unauthenticated request is actually rejected) before this section is marked done.** fina-app built the client but never verified/enabled enforcement.
- [ ] Authorization: per-row ownership checks on every mutating tool/action, not just schema validation.
- [ ] Rate limiting: which endpoints, what limits, especially on the most expensive AI capability (rank your capabilities by cost first).
- [ ] Prompt-injection surface: does any AI feature ingest untrusted external content (web search, URLs, user-uploaded documents)? If yes, what's the mitigation?

## 20. Error Handling
[Throw/catch/toast is fine for UX; define separately: (1) where errors are logged before being thrown, (2) how internal error detail is translated to user-facing messages so internals never leak.]

## 21. Testing — Decision Section
- [ ] Unit tests for pure logic and validation schemas
- [ ] Integration tests for DB access (including a test that your RLS/authorization policy actually blocks cross-tenant access — not just that it exists)
- [ ] AI evaluation harness: golden inputs + expected output shape, run on every prompt/model change

## 22. AI Evaluation
[How will you know a prompt or model change is safe to ship? Define this before you have two model versions in flight, unlike fina-app.]

## 23. Cost Considerations
[Rank AI capabilities by cost-per-call. Identify the most expensive one and its guardrail (rate limit, quota, approval step) explicitly.]

## 24. Deployment
[Target platform, CI gate (minimum: lint + type-check), required env vars, migration process.]

## 25. Monitoring
[What gets logged per AI call at minimum: model, latency, success/failure, and cost/token count if available.]

## 26. Acceptance Criteria
[Testable, per user journey.]

## 27. Known Limitations
[State them up front, honestly — this is a strength of good engineering documentation, not a weakness.]

## 28. Future Enhancements
[Explicitly marked as not-yet-started.]

---

## Section 29 — Human Approval Gates

For every tool/action that mutates data or spends money (including AI generation costs), decide explicitly:
- [ ] Fully autonomous (model executes without confirmation) — only for low-risk, easily-reversible actions
- [ ] Requires human confirmation before execution — required for destructive actions (delete, irreversible sends, high-cost generation)

fina-app's `delete_transaction`/`update_transaction` tools are fully autonomous with no confirmation step — acceptable only because the blast radius (a personal finance record) is low; do not default to this for higher-stakes actions.

## Section 30 — Multi-Tenancy

- [ ] Tenant identifier present in schema
- [ ] Tenant identifier populated on every write (verify with a test, not a read-through)
- [ ] Every read/write path scoped to tenant (RLS and/or explicit query filters — defense in depth preferred)
- [ ] Tenant-scoped rate limits/quotas

## Section 31 — MCP Integration (if applicable)

[Complete only if Section 8 selected MCP mode. Otherwise write "N/A — API mode only."]

- **Capability split:** copy the business rows from §0.1. Only these are candidates to expose.
- **No LLM inside the MCP server:** confirm that no tool calls a generative model. Justify any embedding call, which is the only exception.
- **Primitives:**
  - **Tools** are actions and queries.
  - **Resources** are addressable, read-only reference data (for example `app://categories`).
  - **Prompts** are optional personas or workflows the customer opts into.
- **Per tool,** fill in this table:

  | Tool | Input schema (zod) | Output shape (structured data, not prose) | Scope (read/write) | Annotations (readOnly / destructive / idempotent) | Result-size cap | Rate limit |
  |---|---|---|---|---|---|---|

- **Authentication:** OAuth 2.1 authorization for a remote MCP server; name the identity provider. Tokens are never passed through to downstream APIs.
- **Tenant isolation:** each token maps to exactly one tenant. The database is accessed with a user-scoped session and RLS, plus explicit ownership predicates. A service-role key is never used for tool execution.
- **Business rules:** confirm validation lives inside the business function, not in the MCP adapter, so API mode and MCP mode apply identical rules.
- **Prompt injection:** state which tool outputs contain user-authored text, and how they are kept in structured fields.
- **Onboarding:** signup, the consent screen, the connector setup guide, the published tool contract, and a usage view.
- **Commercial model:** state who pays for inference in each mode, and what the provider still pays for (embeddings, storage).

## Section 32 — Production Readiness Gate

Before calling this "production ready," confirm every item below is not just built but *verified*:
- [ ] Authentication enforcement verified by an actual rejected-request test, not just present in code
- [ ] Cross-tenant data isolation verified by an actual cross-tenant-access test
- [ ] Rate limits verified to actually trigger under load
- [ ] CI blocks merge on lint/type-check/test failure
- [ ] At least one AI evaluation run exists and passes
