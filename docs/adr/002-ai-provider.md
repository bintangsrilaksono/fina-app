# ADR 002: Google Gemini as the Sole AI Provider

**Status:** INFERRED (no original design document exists; reconstructed from [package.json](../../package.json) and every file under [src/features/ai/](../../src/features/ai/))

## Context

The app needs text generation, structured output, embeddings, vision input, audio input, image generation, and video generation.

## Decision (as implemented)

Use `@google/genai` exclusively for every AI capability, accessed through one factory function ([instance.ts](../../src/features/ai/instance.ts)). No other AI provider SDK is a dependency.

## Evidence

- A single vendor SDK covers text, structured output, embeddings, vision, audio, image generation (`gemini-3.1-flash-image`), and video generation (`veo-3.1-lite-generate-preview`) — one provider satisfying every modality need is very likely *why* it was chosen (fewer integrations, one billing relationship, one auth key).
- Every AI-feature file imports Gemini-specific types (`Content`, `FunctionCall`, `HarmCategory`, `Type`) directly rather than through an adapter, confirming no abstraction layer was intended.

## Consequences

- Fastest path to a working multimodal feature set with one vendor relationship.
- Full provider lock-in: swapping providers would require touching every file in `features/ai/`, not just the factory.
- Inconsistent model-version selection across call sites (`gemini-3.5-flash` vs. `gemini-2.5-flash`) went unnoticed longer than it might have with an abstraction layer forcing explicit, centralized model configuration — see [AUDIT-REPORT.md](../AUDIT-REPORT.md) COR-4.
- This lock-in is also the primary blocker for MCP-mode portability — see [19-mcp-readiness.md](../19-mcp-readiness.md) and ADR 006.

## Alternatives not taken (inferred)

A provider-abstraction interface (even a thin one) would have cost little extra at build time and would have prevented the model-version drift and eased any future MCP/multi-provider work. Not doing so was a reasonable simplification for a course project's scope, but is the first thing to revisit if this codebase is extended.
