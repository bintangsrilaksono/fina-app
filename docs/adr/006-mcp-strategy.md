# ADR 006: No MCP Strategy Exists Yet

**Status:** INFERRED — and in this case, the inference is that **no decision was made at all**, not that one was made and left undocumented.

## Context

The broader initiative this documentation set supports includes a future goal of exposing app capabilities via MCP so customers can bring their own Claude client/inference cost (see [19-mcp-readiness.md](../19-mcp-readiness.md), [20-api-vs-mcp-architecture.md](../20-api-vs-mcp-architecture.md)).

## Decision

**There is no MCP-related code, dependency, or design artifact anywhere in [fina-app](../../).** This ADR exists to record that fact explicitly, rather than let its absence be mistaken for an oversight in this documentation effort.

## Evidence

- No MCP SDK dependency in [package.json](../../package.json).
- No `mcp/`, `tools/`, or similar server-definition folder.
- The existing tool declarations ([function-transaction.ts](../../src/features/ai/function-transaction.ts)) are Gemini `FunctionDeclaration` objects, coupled to `@google/genai`'s `Type` enum — not MCP tool schemas, though structurally adjacent (see ADR 002, and [19-mcp-readiness.md](../19-mcp-readiness.md) item 3 for how close/far this is from portable).

## Consequences

Because provider-agnostic separation was never a design goal (ADR 002), the codebase is not currently in a state where an MCP server could be added without refactoring the AI feature files — the required refactoring is scoped in [19-mcp-readiness.md](../19-mcp-readiness.md) item 7.

## Proposed decision (v2) — status: PROPOSED, not implemented

This section is a recommendation from the documentation review. It was not taken from the repository.

1. **Split capabilities.** AI capabilities (advice, extraction, planning, visualization, and image and video generation) remain the customer's Claude's responsibility in MCP mode. The MCP server exposes only business capabilities: transaction CRUD, search, balance and breakdown reporting, and the categories resource.
2. **No LLM inside the MCP server.** The only permitted model call is query embedding for optional semantic search, behind an `EmbeddingPort`.
3. **Shared tool layer.** One provider-neutral registry (zod schema plus handler plus annotations) serves both the API-mode orchestrator (rendered as Gemini function declarations) and the MCP server (rendered as MCP tools).
4. **Isolation prerequisites.** Nothing is exposed until SEC-1, SEC-2, SEC-3, and SEC-7 are fixed. MCP authorization uses OAuth with user-scoped database sessions under RLS.
5. **Hybrid commercial model.** API mode, where the provider pays for inference, is kept for the web app. MCP mode, where the customer brings their own Claude, is offered on the same business layer.

The rationale is in [19-mcp-readiness.md](../19-mcp-readiness.md) and [20-api-vs-mcp-architecture.md](../20-api-vs-mcp-architecture.md).

## What this ADR is not

This is not a recommendation against building MCP support — the capability registry in [MCP-CAPABILITY-REGISTRY.md](../MCP-CAPABILITY-REGISTRY.md) finds several capabilities "MCP READY WITH REFACTORING," meaning the gap is real but not enormous for the transaction CRUD surface specifically. It is a factual record that, as of this documentation, that work has not begun.
