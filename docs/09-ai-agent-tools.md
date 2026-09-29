# AI Agent & Tools

## What "agent" means in this codebase

There is no agent framework, agent class, planner, or multi-agent orchestration anywhere in the repository. What the curriculum calls "AI Agent & Tools" is implemented as **two independent, hand-rolled tool-calling loops** — see [08-function-calling.md](08-function-calling.md) for the mechanics. This document evaluates them specifically as agents: their degree of autonomy, tool surface, and control flow.

Status: **PARTIALLY IMPLEMENTED** relative to a general "AI agent" capability — the pattern proves out single-turn-per-tool-batch tool use with a stop condition, but there is no persistent agent identity, memory beyond the request, planning step, or ability to hand off between specialized sub-agents.

## The two agents

### Agent A — "Personal advisor" (read-only)

- File: [chat.ts](../src/features/ai/chat.ts), `handleChatStreaming`, `mode === "personal"` branch.
- Tool surface: `get_transaction` only.
- Autonomy: the model decides *whether* to call the tool at all; if it doesn't, it just answers from the conversation. It cannot mutate any data — its worst-case blast radius is a bad answer, not a bad write.
- Termination condition: no more `functionCalls` in the latest response.
- Streaming: yields text/thought chunks as they arrive, including through tool-call turns.

### Agent B — "Wizard" (full CRUD)

- File: [wizard.ts](../src/features/ai/wizard.ts), `handleWizardTools`.
- Tool surface: all four transaction tools (`get_transaction`, `create_transaction`, `update_transaction`, `delete_transaction`).
- Autonomy: this is the more "agentic" of the two — the prompt explicitly instructs it to chain tools itself ("If request is to update or delete transaction, you must call function get_transaction first to find out which transaction will be updated or deleted"), i.e. the model is expected to plan a short multi-step tool sequence on its own, with no code-level orchestration of *which* tool to call when.
- Termination condition: same shape as Agent A (no more `functionCalls`).
- Not streamed: uses `generateContent` (not `Stream`), returning only when the loop finishes.

## Native ("built-in") tools vs. custom function declarations

General-mode chat ([chat.ts](../src/features/ai/chat.ts) `generalChat`) uses Gemini's **built-in** tools — `googleSearch: {}` and `urlContext: {}` — which the SDK/API executes server-side on Google's infrastructure, not via the app's own function-calling loop. This is architecturally distinct from the custom `functionDeclarations` tools: the app never sees or controls what `googleSearch`/`urlContext` retrieve, and there is no equivalent execution loop for them in application code (there's nothing to execute — Gemini handles it internally). General mode is never combined with the custom transaction tools in the same call.

## Comparison table

| Property | Agent A (personal chat) | Agent B (wizard) | Native tools (general chat) |
|---|---|---|---|
| Can read data | Yes | Yes | No (only web search/URL fetch) |
| Can write data | No | Yes | No |
| Streams output | Yes | No | Yes |
| Multi-step planning | Model-only (single tool) | Model-only (multi-tool, prompt-instructed ordering) | N/A (handled by Google infra) |
| Max loop iterations enforced by code | None | None | N/A |
| Human approval before mutation | None | None | N/A |

## Reusable pattern extracted

Despite the duplication, the **shape** of the loop (call model → collect `functionCalls` → execute in parallel → push `functionResponse` → repeat until none) is a legitimate, reusable "manual agent loop" pattern for small, fixed tool surfaces where a full agent framework would be overkill. It is written up generically in [18-reusable-patterns.md](18-reusable-patterns.md) ("Manual Tool-Calling Loop") and evaluated for MCP fit in [19-mcp-readiness.md](19-mcp-readiness.md).

## Limitations / gaps as an "agent" implementation

- No shared/abstracted loop — two copies, drifted apart (streaming vs. non-streaming, different tool sets, different error-message strings for the same failure).
- No maximum iteration guard (see [08-function-calling.md](08-function-calling.md)).
- No agent memory beyond the in-request `contents` array — nothing persists between separate chat sessions or wizard invocations.
- No tool-use logging/tracing — there is no record of which tools were called, with what arguments, or how many turns a given request took.
- No human-in-the-loop confirmation before destructive tool calls (`delete_transaction`, `update_transaction`) execute.
- No planner/router that selects which agent (or which tool subset) to use — mode/tool selection is a hardcoded UI toggle (`mode` state in [chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx)), not an AI decision.
