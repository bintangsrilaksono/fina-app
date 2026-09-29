# Gap Analysis

**Revision:** v2. Reorganized into seven gap categories.

This document compares four things:
- **(A)** what the curriculum covers
- **(B)** what [fina-app](../) implements
- **(C)** what a production, multi-tenant AI application requires
- **(D)** what MCP / connector mode requires

**Not every gap is a defect.** Each row carries a judgment:

| Judgment | Meaning |
|---|---|
| **Acceptable** | Fine for a course capstone or demo. |
| **Should fix** | Fix before real users or sustained use. |
| **Must fix** | Blocks any multi-user deployment. |
| **Strategic** | Only matters if you pursue a specific direction, such as MCP or multiple providers. |

Finding IDs refer to [AUDIT-REPORT.md](AUDIT-REPORT.md).

---

## 1. Course gaps

The curriculum covered topics that have no code artifact, or only a thin one.

| Gap | Evidence | Judgment |
|---|---|---|
| Introduction, Setup Environment, and Road To AI Apps have no artifacts | Conceptual modules ([COURSE-TO-CODE-MAPPING.md](COURSE-TO-CODE-MAPPING.md)) | Acceptable |
| No AI evaluation practice in code | No eval harness, golden set, or regression tests | Acceptable for the course; **should fix** before iterating on prompts or models |
| No provider abstraction taught or applied | Direct `@google/genai` use everywhere | Acceptable for the course; **strategic** for MCP or multi-provider support |
| Agents taught as a hand-rolled loop, not a framework | [09-ai-agent-tools.md](09-ai-agent-tools.md) | Acceptable; this is a legitimate pattern at this scale |
| Deployment and utilities topic produced helpers only | No CI or deployment config ([17-deployment.md](17-deployment.md)) | Acceptable for the course |

## 2. Code gaps

These are incomplete or buggy relative to what the app itself intends.

| Gap | Evidence of intent | Judgment |
|---|---|---|
| Correct RLS policy never activated | A commented-out `auth.uid() = user_id` policy sits next to the permissive one | **Must fix** (SEC-1) |
| `user_id` never populated | A column with a foreign key exists, but the write path excludes it | **Must fix** (SEC-2) |
| Auth redirect disabled; no login page | Redirect written but commented out | **Must fix** (SEC-3) |
| Manual create/update do no server-side validation | The wizard path validates; the manual path doesn't | **Must fix** (SEC-7) |
| Receipt scan doesn't auto-save | `createTransaction` call commented out in `multimodal.ts` | Acceptable. Reviewing before saving is arguably the better UX; record the decision. |
| Uploads over 1 MB fail | Default Server Action body limit, with no client-side check | **Should fix** (COR-12) |
| Video temp file leaks | No `unlink` | **Should fix** (COR-2) |
| Dead exports `handleChat` and `handleWizardInput` | No callers | Acceptable; clean up (COR-1) |
| Uncommitted `chat.ts` changes | Committed as `82db444` | Resolved (DOC-1) |
| Edge cases: missing `id`, empty RAG results | `"undefined"` sent as an id | Should fix (COR-13) |

## 3. Architecture gaps

| Gap | Current state | Judgment |
|---|---|---|
| No AI provider layer (ports and adapters) | Gemini types and calls in every AI file | **Strategic.** Required for MCP, multiple providers, or testability. |
| Orchestration mixed with business logic | Tool dispatch `switch` statements and business rules live inside the AI loops | **Should fix** before adding features |
| No provider-neutral tool layer | Tools exist only as Gemini `FunctionDeclaration`s; dispatch is duplicated (COR-3) | **Strategic.** This is the seed of the MCP tool layer. |
| Write path depends on the AI provider | `createTransaction`/`updateTransaction` embed synchronously, so writes fail when Gemini is down | **Should fix.** Embed asynchronously or tolerate failure. |
| Business calculations done by the LLM | `generateChart` asks Gemini to group and sum | **Should fix:** deterministic SQL (and required for MCP) |
| No shared wrapper for Server Actions | Auth, rate limiting, and logging would each need adding to about 10 actions | **Should fix** before adding cross-cutting concerns |
| Aggregation in application code | `getBalanceSummary` pulls every row (COR-8) | Acceptable at demo scale; **should fix** for growth |

Target layering: [01-architecture.md §7](01-architecture.md#7-architecture-assessment-and-recommended-layering-assessment-not-current-code).

## 4. Production gaps

| Gap | Current | Required | Judgment |
|---|---|---|---|
| Automated tests | None | Unit, integration (including tenant isolation), and AI evaluation | Should fix |
| CI/CD | None | At minimum: lint, type-check, and tests as a merge gate | Should fix |
| Observability | None | Per-AI-call logs (model, latency, outcome, tokens), error tracking | Should fix |
| Rate limiting and cost control | None | Per-user quotas, prioritizing video generation | **Must fix** (SEC-4) |
| Retry and timeout | None; unbounded video poll (COR-11) | Backoff for transient errors; caps on long operations | Should fix |
| Migrations | Two SQL files run by hand | Versioned migrations (for example, the Supabase CLI) | Should fix |
| Background jobs | Video generation runs inside the request | Job queue for long-running generation | Should fix if video is kept |
| Security headers | None (SEC-11) | Baseline CSP and related headers | Should fix |

## 5. Security gaps

Full detail is in [15-security.md](15-security.md).

| Gap | IDs | Judgment |
|---|---|---|
| No tenant isolation; anon role can read and write through Supabase's REST API | SEC-1, SEC-2 | **Must fix** |
| No authentication enforcement | SEC-3 | **Must fix** |
| Mass assignment, no server validation, no ownership checks | SEC-7 | **Must fix** |
| Stored prompt injection can reach destructive tools without confirmation | SEC-8 | **Must fix** before real users |
| No rate limits | SEC-4 | **Must fix** |
| Web-tool indirect injection | SEC-5 | Acceptable as a documented risk (read-only mode) |
| Unvalidated, forgeable chat history | SEC-9 | Should fix |
| Internal modules marked `"use server"` | SEC-10 | Should fix (latent) |

## 6. MCP gaps

MCP mode is **not implemented**. These gaps matter only if MCP mode is pursued; they are **strategic** unless noted.

| Gap | Current | Needed | Judgment |
|---|---|---|---|
| No MCP server | — | MCP server adapter over Streamable HTTP | Strategic |
| No MCP authentication | Supabase cookie session only | OAuth 2.1 authorization for the MCP server, with each token mapped to a user | Strategic; depends on the SEC-3 fix |
| Tenant isolation | None | User-scoped DB session with RLS, plus ownership checks | **Must fix first** (the same fix as SEC-1, SEC-2, SEC-7) |
| Business logic tied to Gemini | Embedding in the write path | Business layer free of provider code; embedding behind a port | Strategic |
| Deterministic reporting tools | Grouping done by the LLM | `get_balance_summary` and `get_spending_breakdown` in SQL | Strategic (also an architecture gap) |
| Tool contract | Gemini-only schemas | zod-based registry that can be rendered as MCP tools | Strategic |
| Destructive-action safety | No confirmation | `destructiveHint` annotations plus server-side ownership checks | Strategic |
| Onboarding | None | Signup, consent screen, connector setup guide, usage view | Strategic |
| Separating AI capabilities from business capabilities | AI and business logic are mixed | Claude does the reasoning; the server provides only business capabilities, with no LLM inside the MCP server | Strategic. The design is in [19-mcp-readiness.md](19-mcp-readiness.md). |

## 7. Documentation gaps

| Gap | State | Judgment |
|---|---|---|
| Original design rationale | None existed; ADRs are reconstructed and marked `INFERRED` | Acceptable; the ADRs now capture it |
| README | Unmodified `create-next-app` boilerplate | Should fix: point it at `docs/` |
| Environment setup and migration order | Only inferred in [17-deployment.md](17-deployment.md) | Should fix: a short setup guide |
| API contract for `/api/chat` (the NDJSON stream) | Described only in [13-backend-patterns.md](13-backend-patterns.md) | Acceptable |
| Undocumented working-tree changes | Resolved: committed as `82db444` | Resolved (DOC-1) |

## Not gaps

These look like gaps but are deliberate and sound choices:

- Server Actions instead of a REST API, for a single-client app.
- pgvector inside the existing Postgres instead of a separate vector database, at this scale.
- A hand-rolled tool loop instead of an agent framework, for a surface of four tools. The duplication is the problem, not the approach.
- Having the user review receipt extractions before saving.
