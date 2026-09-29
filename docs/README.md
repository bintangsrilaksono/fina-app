# Documentation Index

This is the documentation set for [fina-app](../), the completed implementation of the "AI Powered Apps Fundamental" curriculum. It is built as a **reference extraction**, not marketing copy: every claim in every document below is traceable to a specific file in the codebase, and every "not implemented" is stated as plainly as every "implemented."

## Purpose

Two audiences, one documentation set:

1. **Understand this app as it actually is** — its architecture, its AI capabilities, its security gaps, its production readiness.
2. **Reuse what was learned here in future AI applications** — SaaS, RAG, agents, tool-based apps, multimodal apps, and MCP/connector-based apps — via the extracted patterns, the engineering playbook, and the reusable PRD template.

## Status labels used throughout

`IMPLEMENTED` / `PARTIALLY IMPLEMENTED` / `NOT IMPLEMENTED` — always describing the actual code, never the curriculum's intent or a future plan. Where something is planned but doesn't exist, it is explicitly marked `FUTURE` (see [PRD/PROJECT-PRD.md](PRD/PROJECT-PRD.md) §24) or `INFERRED` (see [adr/](adr/), where original design rationale was reconstructed from code rather than quoted from a source document).

## Revision history

- **v1:** initial documentation pass.
- **v2:** independent review against the source code.
  - False claims were corrected: the data-flow validation path, the "use client" claim, the upload-limit claim, shared-schema claims, the tag-typo file locations, and the audit severity counts.
  - New security findings were added (SEC-7 to SEC-11).
  - The MCP docs were restructured around **AI capabilities vs. business capabilities**, with no LLM inside the MCP server.
  - The gap analysis was regrouped into seven categories.
  - [AI-APPS-ENGINEERING-STANDARD-v1.0.md](AI-APPS-ENGINEERING-STANDARD-v1.0.md) was added.

  The list of corrections is at the end of [AUDIT-REPORT.md](AUDIT-REPORT.md#corrections-from-v1).

All documents describe `fina-app` at commit `82db444`.

## Start here if you're building something new

[AI-APPS-ENGINEERING-STANDARD-v1.0.md](AI-APPS-ENGINEERING-STANDARD-v1.0.md) answers "how should I architect a new AI application?" on one page. It also defines the terminology used across all these docs: LLM, AI model, AI provider, tool, function calling, MCP server/client, resource, RAG, embedding, vector database, and business logic.

## Recommended reading order

1. [00-project-overview.md](00-project-overview.md) — what this is, in five minutes
2. [01-architecture.md](01-architecture.md) — system architecture with Mermaid diagrams (AI request flow, RAG flow, function-calling flow, data flow, deployment)
3. AI Capabilities — [04-ai-llm-integration.md](04-ai-llm-integration.md), [05-prompt-engineering.md](05-prompt-engineering.md), [06-content-generation.md](06-content-generation.md), [07-rag.md](07-rag.md), [08-function-calling.md](08-function-calling.md), [09-ai-agent-tools.md](09-ai-agent-tools.md), [10-multimodal.md](10-multimodal.md)
4. [AUDIT-REPORT.md](AUDIT-REPORT.md) — every code-quality/security finding, severity-ranked
5. [AI-APPS-ENGINEERING-PLAYBOOK.md](AI-APPS-ENGINEERING-PLAYBOOK.md) — **the most important document**: reusable principles for any future AI application, extracted from what this app got right and wrong
6. [20-api-vs-mcp-architecture.md](20-api-vs-mcp-architecture.md) and [19-mcp-readiness.md](19-mcp-readiness.md) — API mode vs. MCP/connector mode strategy
7. [PRD/PROJECT-PRD.md](PRD/PROJECT-PRD.md) — this project's requirements, reconstructed from code
8. [PRD/AI-APP-PRD-TEMPLATE.md](PRD/AI-APP-PRD-TEMPLATE.md) — reusable PRD template for your next AI project

## Full index

### Project-specific documents (describe *this* app only)
- [00-project-overview.md](00-project-overview.md)
- [01-architecture.md](01-architecture.md)
- [02-tech-stack.md](02-tech-stack.md)
- [03-project-structure.md](03-project-structure.md)
- [COURSE-TO-CODE-MAPPING.md](COURSE-TO-CODE-MAPPING.md) — the 9 curriculum modules mapped to actual code
- [04-ai-llm-integration.md](04-ai-llm-integration.md)
- [05-prompt-engineering.md](05-prompt-engineering.md)
- [06-content-generation.md](06-content-generation.md)
- [07-rag.md](07-rag.md)
- [08-function-calling.md](08-function-calling.md)
- [09-ai-agent-tools.md](09-ai-agent-tools.md)
- [10-multimodal.md](10-multimodal.md)
- [11-database-and-vector-db.md](11-database-and-vector-db.md)
- [12-frontend-patterns.md](12-frontend-patterns.md)
- [13-backend-patterns.md](13-backend-patterns.md)
- [14-error-handling.md](14-error-handling.md)
- [15-security.md](15-security.md)
- [16-testing.md](16-testing.md)
- [17-deployment.md](17-deployment.md)

### Audit documents
- [AUDIT-REPORT.md](AUDIT-REPORT.md) — 28 findings (2 CRITICAL, 4 HIGH, 8 MEDIUM, 8 LOW, 6 INFO), each with location, impact, and recommendation
- [GAP-ANALYSIS.md](GAP-ANALYSIS.md) — gaps in seven categories (course, code, architecture, production, security, MCP, documentation), each judged as acceptable, should-fix, must-fix, or strategic

### Reusable documents (for future projects)
- [AI-APPS-ENGINEERING-STANDARD-v1.0.md](AI-APPS-ENGINEERING-STANDARD-v1.0.md) — **the final high-level standard**: ten rules, reference layering, capability classification, delivery-mode choice, baselines, terminology
- [18-reusable-patterns.md](18-reusable-patterns.md) — patterns and anti-patterns with input/output/error/security/performance for each
- [AI-APPS-ENGINEERING-PLAYBOOK.md](AI-APPS-ENGINEERING-PLAYBOOK.md) — 32-section reusable playbook
- [AI-APP-DEVELOPMENT-CHECKLIST.md](AI-APP-DEVELOPMENT-CHECKLIST.md) — condensed checklist form of the playbook
- [PRD/AI-APP-PRD-TEMPLATE.md](PRD/AI-APP-PRD-TEMPLATE.md) — reusable PRD template covering LLM/API-vs-MCP/RAG/tools/agents/multimodal/multi-tenancy decisions

### MCP documents
- [19-mcp-readiness.md](19-mcp-readiness.md) — MCP readiness audit separating AI capabilities (the customer's Claude does these) from business capabilities (exposed through MCP), with a target layering; **MCP is not implemented anywhere in this repo**
- [20-api-vs-mcp-architecture.md](20-api-vs-mcp-architecture.md) — API mode (current, actual) vs. MCP mode (design projection only)
- [MCP-CAPABILITY-REGISTRY.md](MCP-CAPABILITY-REGISTRY.md) — per-capability registry table (tool/resource candidates, auth, tenant isolation, refactoring needed)

### PRD documents
- [PRD/PROJECT-PRD.md](PRD/PROJECT-PRD.md) — this project's PRD, reconstructed from code, CURRENT vs. FUTURE clearly separated
- [PRD/AI-APP-PRD-TEMPLATE.md](PRD/AI-APP-PRD-TEMPLATE.md) — reusable template (see above)

### Architecture Decision Records
- [adr/001-architecture.md](adr/001-architecture.md) — feature-folder Server Actions
- [adr/002-ai-provider.md](adr/002-ai-provider.md) — single-provider Gemini coupling
- [adr/003-rag.md](adr/003-rag.md) — pgvector-in-Postgres, whole-record embedding
- [adr/004-agent-tools.md](adr/004-agent-tools.md) — hand-rolled tool-calling loop
- [adr/005-database.md](adr/005-database.md) — permissive RLS as an interim (not final) state
- [adr/006-mcp-strategy.md](adr/006-mcp-strategy.md) — no MCP strategy exists yet (explicit record of absence)

All ADRs are marked `INFERRED` — no original design documents exist in the repository; rationale is reconstructed from code evidence and stated as such in each ADR.

## The single most important fact in this entire documentation set

[fina-app](../) has a **CRITICAL, unresolved security gap**, made up of four parts:
- Row-Level Security is enabled, but the active policy is permissive (`USING (true)`, applying to the `anon` role too). Anyone with the public Supabase key can read or write every row through Supabase's REST API.
- `user_id` is never populated on write.
- Authentication is scaffolded but not enforced.
- The mutation Server Actions accept unvalidated payloads.

Read [15-security.md](15-security.md) and [AUDIT-REPORT.md](AUDIT-REPORT.md) (SEC-1, SEC-2, SEC-3, SEC-7) before considering any deployment beyond a single-developer demo.
