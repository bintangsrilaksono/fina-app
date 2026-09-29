# ADR 004: Hand-Rolled Tool-Calling Loop Instead of an Agent Framework

**Status:** INFERRED (reconstructed from [chat.ts](../../src/features/ai/chat.ts) and [wizard.ts](../../src/features/ai/wizard.ts); no framework dependency exists to confirm or deny an alternative was evaluated)

## Context

Two features need the model to invoke real backend operations mid-conversation: a read-only "personal advisor" chat and a full-CRUD "wizard."

## Decision (as implemented)

Write a plain `while (running)` loop around `generateContent`/`generateContentStream` in each of the two files independently, inspecting `response.functionCalls`, executing matching backend logic, and feeding `functionResponse` parts back in — rather than adopting LangChain, an agent SDK, or any other framework (none is a dependency).

## Evidence

- No agent-framework dependency exists in `package.json`.
- The loop is implemented **twice**, independently, with different tool sets and slightly different error-handling and streaming behavior — strong evidence this was written ad hoc per-feature rather than designed once and reused, which in turn suggests no framework (which would have naturally centralized this) was ever adopted.

## Consequences

- Minimal dependency footprint; full control over the loop's behavior.
- No shared abstraction meant the two implementations drifted (different error message text for the same failure, no shared max-iteration guard, streaming vs. non-streaming inconsistently) — see [AUDIT-REPORT.md](../AUDIT-REPORT.md) COR-3.
- The pattern itself (documented generically in [18-reusable-patterns.md](../18-reusable-patterns.md)) is sound for a small, fixed tool surface; the *duplication* is the actual issue, not the absence of a framework.

## Alternatives not taken (inferred)

An agent framework would have been over-engineering for a 1–4 tool surface with no planning/multi-agent needs — not adopting one was likely the right call. A shared, hand-written helper function (not a framework) should have been extracted the second time the loop was needed, and was not.
