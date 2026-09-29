# AI App Development Checklist

A condensed, reusable checklist for future AI applications, distilled from [AI-APPS-ENGINEERING-PLAYBOOK.md](AI-APPS-ENGINEERING-PLAYBOOK.md) and the concrete gaps found in [fina-app](../) (see [AUDIT-REPORT.md](AUDIT-REPORT.md), [GAP-ANALYSIS.md](GAP-ANALYSIS.md)). Use this per-project, not per-PR.

## Definition
- [ ] Problem defined in one sentence, without mentioning AI
- [ ] User defined (persona, or explicitly "no segmentation")
- [ ] Workflow defined (which steps are prompt-suggested vs. code-enforced)

## AI Capability Selection
- [ ] AI required? (state what breaks if you remove it)
- [ ] LLM selected, with a named-constant model per capability and a one-line reason each (never leave two similar call sites on different model versions with no comment)
- [ ] Prompt template shape defined once and shared (not retyped per file)
- [ ] Structured output required? → schema derived from one source (e.g. Zod), used for both `responseSchema` and post-parse validation
- [ ] Streaming required? → content tagged by field, not array position, if multiple content types are interleaved

## RAG / Retrieval
- [ ] RAG required? (only if the answer needs data the model shouldn't have parametrically)
- [ ] Embedding model + dimensionality chosen, with a documented re-embedding plan if it ever changes
- [ ] Vector DB choice justified by scale (pgvector-in-place vs. dedicated service)
- [ ] **Retrieval scoped to the calling tenant/user — verified, not assumed**
- [ ] Vector index (ivfflat/hnsw) planned for the row count where sequential scan becomes too slow

## Tools / Agents
- [ ] Tool required? → each tool has its own minimal schema (not a shared "everything optional" object)
- [ ] Agent required? → hand-rolled loop only for small/fixed tool surfaces; extracted as a shared helper on first reuse, not the second time it's needed
- [ ] Max-iteration guard defined on any tool-calling loop
- [ ] Human-approval gate defined for every destructive/costly tool

## Multimodal
- [ ] Multimodal required per modality? (justify vs. a simpler modality, e.g. typing instead of voice)
- [ ] File-size limits enforced before base64 encoding/upload

## Data / Database
- [ ] Database designed
- [ ] Tenant/user column present **and** populated on every write **and** enforced by RLS or equivalent — all three, not just one
- [ ] Aggregates computed in SQL, not pulled row-by-row into application code
- [ ] Migration tooling chosen (even a documented manual-SQL-file order beats undocumented ad hoc execution)

## Auth / Security
- [ ] Authentication enforcement verified by an actual rejected-request check, not just "the client is configured"
- [ ] Authorization: per-row ownership check on every mutating action
- [ ] Multi-tenancy: cross-tenant access verified blocked by an actual test
- [ ] Secrets: server-only, never bundled client-side — verified by inspecting the client bundle if in doubt
- [ ] Rate limiting on every AI-calling endpoint, prioritized by cost-per-call
- [ ] Prompt-injection surface identified for any feature ingesting untrusted external content (web search, URLs, uploaded files)
- [ ] File upload size/type limits enforced server-side, not just client-side

## Error Handling
- [ ] Errors logged centrally before being thrown to a UI boundary
- [ ] User-facing messages translated from internal errors (no raw Zod/SDK error strings shown to end users)
- [ ] Timeout/max-attempts guard on any long-running polling loop (e.g. async generation operations)
- [ ] Temp files/resources cleaned up in a `finally` block, not just on the happy path

## Evaluation / Testing
- [ ] Unit tests for pure logic and validation
- [ ] Integration tests for DB access, including tenant-isolation tests
- [ ] AI evaluation harness with a fixed golden set, run on every prompt/model change
- [ ] Mocking strategy for LLM/DB clients so tests don't require live credentials

## Cost / Performance
- [ ] AI capabilities ranked by cost-per-call; most expensive one has the tightest guardrail
- [ ] Caching considered wherever a request would otherwise regenerate identical output
- [ ] No AI client re-constructed per call at high traffic volumes (memoize if needed)

## Deployment
- [ ] CI gate: lint + type-check minimum, tests once they exist
- [ ] Required env vars documented (names only) and validated at startup, not lazily inside a deep call
- [ ] Deployment target chosen and its constraints (function timeout limits, etc.) checked against your longest-running AI call

## Monitoring
- [ ] Per-AI-call logging: model, latency, success/failure, cost/tokens if available
- [ ] Error tracking wired up before launch, not after the first incident

## MCP Opportunity
- [ ] Evaluated whether this app's capabilities could be exposed via MCP (see [19-mcp-readiness.md](19-mcp-readiness.md) for the evaluation questions)
- [ ] If yes: data/action layer kept free of provider-specific imports from the start

## Production Readiness (final gate)
- [ ] Every item above is verified, not just present in code
- [ ] Known limitations documented explicitly (see [PRD/PROJECT-PRD.md](PRD/PROJECT-PRD.md) §23 for the format)
