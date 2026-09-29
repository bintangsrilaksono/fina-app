# AI / LLM Integration

## Purpose

Provide a single, consistent way for server-side code to talk to Google Gemini. In practice this is one factory function, not a full abstraction layer.

## Actual implementation

[src/features/ai/instance.ts](../src/features/ai/instance.ts):

```ts
export function createAI() {
  if (!ENVIRONMENT.googleGenAIKey) {
    throw new Error("AI API Key is missing");
  }
  return new GoogleGenAI({ apiKey: ENVIRONMENT.googleGenAIKey });
}
```

Every AI-calling module (`chat.ts`, `wizard.ts`, `multimodal.ts`, `generative-content.ts`, `embedding.ts`) calls `createAI()` itself, at the top of each server action that needs it — a new `GoogleGenAI` client instance is constructed per call, not memoized or shared across requests.

## Models actually used in code

| Model string (as written in code) | Used by | Purpose |
|---|---|---|
| `gemini-3.5-flash` | [chat.ts](../src/features/ai/chat.ts) `handleChat` (non-streaming, unused — see below) and personal-mode loop; [multimodal.ts](../src/features/ai/multimodal.ts) `extractReceiptData`; [generative-content.ts](../src/features/ai/generative-content.ts) `generateChart`; [wizard.ts](../src/features/ai/wizard.ts) `handleWizardInput` | Text generation, structured JSON, vision extraction |
| `gemini-2.5-flash` | [chat.ts](../src/features/ai/chat.ts) `generalChat`; [wizard.ts](../src/features/ai/wizard.ts) `handleWizardTools` | Streaming general chat with native tools; tool-calling loop |
| `gemini-embedding-2` | [embedding.ts](../src/features/ai/embedding.ts) `generateEmbedding` | 768-dim embeddings |
| `gemini-3.1-flash-image` | [generative-content.ts](../src/features/ai/generative-content.ts) `generateImage` | Image generation |
| `veo-3.1-lite-generate-preview` | [generative-content.ts](../src/features/ai/generative-content.ts) `generateVideo` | Video generation |

**Observation, not a claim about correctness:** the codebase mixes `gemini-3.5-flash` and `gemini-2.5-flash` across otherwise-similar call sites with no apparent intentional distinction documented in code or comments. This is flagged as an audit finding in [AUDIT-REPORT.md](AUDIT-REPORT.md) rather than resolved here, since resolving it would require knowledge of which model strings are actually valid/available on the account this was built against, which cannot be verified from static code alone.

## Dead / unreferenced code

`handleChat` in [chat.ts](../src/features/ai/chat.ts) (lines 15–54, non-streaming chat with `thinkingConfig`) has no caller found anywhere in [src/](../src/) outside its own file. The UI ([chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx)) exclusively calls `fetch("/api/chat")`, which routes to `handleChatStreaming`, not `handleChat`. Treat `handleChat` as dead code. No client component imports it, so Next.js drops it from the client bundle and it can't be called from the browser.

A second dead export was found in v2: `handleWizardInput` in [wizard.ts](../src/features/ai/wizard.ts). [wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx) imports it, but only `handleWizardTools` is ever called. See [AUDIT-REPORT.md](AUDIT-REPORT.md) COR-1.

**Server-only modules marked `"use server"`:** `embedding.ts` and `chat.ts` carry the `"use server"` directive even though only server code imports them. They are not reachable from the browser today, but a future client import would turn them into public endpoints (SEC-10). Internal modules should use `import "server-only"` instead.

## Inputs / outputs by call site

| Function | Input | Output |
|---|---|---|
| `handleChatStreaming(conversation, isThinking, mode)` | `Content[]` conversation history, thinking flag, mode | Async generator of text chunks (thought-prefixed with `[thought]`) |
| `generateEmbedding(contents)` | Arbitrary string | `number[]` (768 floats) |
| `findEmbedding(query, threshold?, count?)` | Query string, similarity threshold, row limit | Rows from `match_transactions` RPC |
| `generateChart(request)` | Free-text request | `{chartType, data}` parsed from `responseSchema`-constrained JSON |
| `generateImage(request)` | Free-text request | Base64 data URI (PNG) |
| `generateVideo(request)` | Free-text request | Base64 data URI (MP4), after polling a long-running operation |
| `extractReceiptData(formData)` | `FormData` with a `file` | Zod-validated `Transaction`-shaped object |
| `handleWizardInput(message)` | Free text | Side effect: creates a transaction; returns a success string |
| `handleWizardTools(formData)` | `FormData` with `type` (`text`/`audio`), `file`, `request` | Side effect: CRUD via tools; returns final model text |

## Error handling

Consistently minimal: most functions `throw new Error("...")` with a fixed message on missing input or a failed SDK call; `embedding.ts` `generateEmbedding` re-throws the original SDK error unchanged inside a try/catch that adds no information. There is no retry logic, no exponential backoff, and no distinction between transient (rate limit, timeout) and permanent (invalid key, bad request) failures anywhere in the AI layer. See [14-error-handling.md](14-error-handling.md).

## Security considerations

- `GOOGLE_GEN_AI_API_KEY` is read only inside files marked `"use server"`, so it is never bundled to the client — this is correct and should be preserved in any refactor.
- No per-user or per-IP rate limiting exists on any AI-calling server action or the `/api/chat` route — every call is billed against the single configured API key with no usage ceiling. See [15-security.md](15-security.md).
- User-supplied free text is interpolated directly into prompt template strings (template literals) across every AI feature; combined with `googleSearch`/`urlContext` tools in general chat mode, this creates a prompt-injection surface (see [15-security.md](15-security.md)).

## Limitations

- No streaming abstraction shared between the two chat modes and the wizard — each hand-rolls its own loop/stream handling.
- No token/cost accounting or logging anywhere.
- No fallback provider or graceful degradation if Gemini is unavailable — every feature simply throws.
