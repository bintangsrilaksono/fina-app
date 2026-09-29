# Course → Code Mapping

This maps the 9 curriculum modules to what actually exists in [fina-app](../). Status values are strictly `IMPLEMENTED`, `PARTIALLY IMPLEMENTED`, or `NOT IMPLEMENTED` — never fabricated.

## 1. Introduction

| Topic | Status | Files | Notes |
|---|---|---|---|
| Course introduction / orientation | NOT IMPLEMENTED | — | Conceptual module; no code artifact exists or is expected. |

## 2. Setup Environment

| Topic | Status | Files | Notes |
|---|---|---|---|
| Project scaffolding | IMPLEMENTED | [package.json](../package.json), [tsconfig.json](../tsconfig.json), [next.config.ts](../next.config.ts) | Standard `create-next-app` bootstrap (see [README.md](../README.md), unmodified boilerplate) plus Tailwind 4, shadcn, ESLint flat config. |
| Environment variable management | PARTIALLY IMPLEMENTED | [.env.example](../.env.example), [src/config/environment.ts](../src/config/environment.ts) | Three variables declared (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_GEN_AI_API_KEY`); centralized into one `ENVIRONMENT` object. No runtime validation (e.g. no zod-parsed env) — a missing var only throws when a feature that needs it runs ([instance.ts](../src/features/ai/instance.ts) throws on missing key; the two Supabase keys are non-null-asserted with `!` and are not validated at all). |

## 3. Road To AI Apps

| Topic | Status | Files | Notes |
|---|---|---|---|
| Conceptual AI-app architecture planning | NOT IMPLEMENTED | — | No design docs, ADRs, or planning artifacts predate this documentation effort. Architectural decisions are inferred from code in [adr/](adr/) and marked `INFERRED`. |

## 4. Content Generation

| Topic | Status | Files | Notes |
|---|---|---|---|
| Text generation | IMPLEMENTED | [src/features/ai/chat.ts](../src/features/ai/chat.ts), [src/features/ai/wizard.ts](../src/features/ai/wizard.ts) | `generateContent`/`generateContentStream` with Gemini text models. |
| Structured/JSON generation | IMPLEMENTED | [src/features/ai/generative-content.ts](../src/features/ai/generative-content.ts) (`generateChart`), [wizard.ts](../src/features/ai/wizard.ts) (`handleWizardInput`) | Two different schema mechanisms are used: a hand-written `Type`-based schema object in `generateChart`, and `z.toJSONSchema()` in `handleWizardInput`. See [06-content-generation.md](06-content-generation.md). **Note (v2):** `handleWizardInput` is imported by `wizard-input.tsx` but never called, so the `z.toJSONSchema` pattern exists in code but no user-facing feature exercises it. |
| Image generation | IMPLEMENTED | [generative-content.ts](../src/features/ai/generative-content.ts) (`generateImage`) | Model `gemini-3.1-flash-image`, returns base64 data URI. |
| Video generation | IMPLEMENTED | [generative-content.ts](../src/features/ai/generative-content.ts) (`generateVideo`) | Model `veo-3.1-lite-generate-preview`, long-running operation polled every 10s, downloaded to local tmpdir, returned as base64. |

## 5. Prompt Engineering

| Topic | Status | Files | Notes |
|---|---|---|---|
| System-instruction / persona prompting | IMPLEMENTED | [chat.ts](../src/features/ai/chat.ts) `generalChat` | Full role/instruction/context/constraints/workflow/example prompt template ("Finabot" persona) with `systemInstruction`. |
| Structured prompt templates (XML-tag style) | IMPLEMENTED | [wizard.ts](../src/features/ai/wizard.ts), [multimodal.ts](../src/features/ai/multimodal.ts), [generative-content.ts](../src/features/ai/generative-content.ts) | Consistent `<role>/<instruction>/<context>/<constraints>/<outputFormat>` tag pattern repeated across files — a real, reusable convention. |
| Sampling parameter tuning | IMPLEMENTED | [chat.ts](../src/features/ai/chat.ts) `generalChat` | `temperature: 0.2`, `topK: 5`, `topP: 0.1`, `maxOutputTokens: 2048`, `stopSequences`. Not applied consistently elsewhere (other calls use SDK defaults). |
| Safety settings | IMPLEMENTED | [chat.ts](../src/features/ai/chat.ts) | `safetySettings` set for `HARM_CATEGORY_HATE_SPEECH` only, with two different thresholds in the two chat modes (`BLOCK_LOW_AND_ABOVE` vs `BLOCK_ONLY_HIGH`) — inconsistency noted in [AUDIT-REPORT.md](AUDIT-REPORT.md). |
| Prompt evaluation / testing | NOT IMPLEMENTED | — | No eval harness, golden-set tests, or prompt-regression tooling exists. |

## 6. RAG

| Topic | Status | Files | Notes |
|---|---|---|---|
| Embedding generation | IMPLEMENTED | [embedding.ts](../src/features/ai/embedding.ts) `generateEmbedding` | `gemini-embedding-2`, `outputDimensionality: 768`. |
| Embedding-on-write | IMPLEMENTED | [transaction/action.ts](../src/features/transaction/action.ts) `handleEmbedding`, called from `createTransaction`/`updateTransaction` | Whole transaction JSON-stringified and embedded; not chunked (single small record per embedding). |
| Vector store | IMPLEMENTED | [migrations/setup-vector.sql](../migrations/setup-vector.sql), [migrations/setup-db.sql](../migrations/setup-db.sql) | pgvector `vector(768)` column, cosine-distance (`<=>`) similarity function `match_transactions`. |
| Retrieval + generation integration | IMPLEMENTED | [chat.ts](../src/features/ai/chat.ts) "personal" mode, [generative-content.ts](../src/features/ai/generative-content.ts) | Retrieval is exposed to the model as a callable tool (`get_transaction`) rather than pre-fetched and stuffed into the prompt directly in chat mode; chart/image/video generation instead pre-fetches via `findEmbedding` before building the prompt. Two different RAG integration styles coexist. |
| Chunking strategy | NOT IMPLEMENTED | — | Not applicable at current data granularity (one embedding per transaction record, no long-document chunking). |

## 7. AI Agent & Tools

| Topic | Status | Files | Notes |
|---|---|---|---|
| Tool/function declarations | IMPLEMENTED | [function-transaction.ts](../src/features/ai/function-transaction.ts) | 4 declarations: `get_transaction`, `create_transaction`, `update_transaction`, `delete_transaction`. |
| Tool-calling loop (agentic loop) | IMPLEMENTED | [chat.ts](../src/features/ai/chat.ts) `handleChatStreaming` (personal mode), [wizard.ts](../src/features/ai/wizard.ts) `handleWizardTools` | Hand-rolled `while(running)` loop: call model → inspect `functionCalls` → execute matching server action → push `functionResponse` → loop until the model stops calling tools. Not built on any agent SDK/framework. |
| Multi-tool agent (full CRUD) | IMPLEMENTED | [wizard.ts](../src/features/ai/wizard.ts) | All 4 tools wired; chat.ts personal mode only wires the read tool (`get_transaction`). |
| Native model tools (search/browsing) | IMPLEMENTED | [chat.ts](../src/features/ai/chat.ts) `generalChat` | `googleSearch: {}` and `urlContext: {}` passed as Gemini built-in tools (general mode only). |
| Agent framework / multi-agent orchestration | NOT IMPLEMENTED | — | No LangChain/LlamaIndex/agent-SDK dependency; no planner/sub-agent architecture; no persistent agent memory beyond the in-request `contents` array. |

## 8. Multimodal

| Topic | Status | Files | Notes |
|---|---|---|---|
| Image input (vision) | IMPLEMENTED | [multimodal.ts](../src/features/ai/multimodal.ts) `extractReceiptData` | Base64 `inlineData`, accepts image/PDF via [file-dropzone-input.tsx](../src/app/dashboard/_components/file-dropzone-input.tsx). |
| Audio input (voice) | IMPLEMENTED | [wizard.ts](../src/features/ai/wizard.ts) `handleWizardTools`, [wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx) | Browser `MediaRecorder` records `audio/webm`, sent as `inlineData` to Gemini for combined transcription + extraction + tool-calling. |
| Image output (generation) | IMPLEMENTED | [generative-content.ts](../src/features/ai/generative-content.ts) `generateImage` | See Content Generation above. |
| Video output (generation) | IMPLEMENTED | [generative-content.ts](../src/features/ai/generative-content.ts) `generateVideo` | See Content Generation above. |
| PDF input | PARTIALLY IMPLEMENTED | [file-dropzone-input.tsx](../src/app/dashboard/_components/file-dropzone-input.tsx) | Dropzone accepts `.pdf` and routes it through the same `extractReceiptData` image path (raw `inlineData` with the PDF's mime type); no PDF-specific handling (e.g. page splitting) exists. |
| Video/audio understanding (input) | NOT IMPLEMENTED | — | No feature analyzes an uploaded video; audio *input* is used only for the wizard's speech-to-transaction path, not general audio Q&A. |

## 9. Utility & Deploy

| Topic | Status | Files | Notes |
|---|---|---|---|
| Utility helpers | IMPLEMENTED | [src/lib/utils.ts](../src/lib/utils.ts) | `cn()` (class merge), `convertToIDR()` (currency formatting). |
| Deployment configuration | NOT IMPLEMENTED | — | No Dockerfile, no `vercel.json`, no `.github/workflows`, no other CI/CD config found in the repository. `README.md` retains generic, unmodified `create-next-app` Vercel-deploy boilerplate text — it does not reflect a configured deployment. |
| Testing | NOT IMPLEMENTED | — | No test files, no test runner dependency (no Jest/Vitest/Playwright/Cypress) anywhere in the repo. |
| Monitoring/observability | NOT IMPLEMENTED | — | No logging framework, error tracker, or analytics SDK dependency. |
