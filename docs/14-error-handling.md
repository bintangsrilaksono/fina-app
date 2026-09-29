# Error Handling

## Purpose

Document the actual error-handling strategy across the app. There is exactly one strategy, applied inconsistently in its details: **throw a plain `Error` with a hand-written string message, catch it at the nearest UI boundary, show `error.message` in a toast.**

## Server-side pattern

Every `features/**/*.ts` function that can fail throws a `new Error("...")` with a fixed English or Indonesian string. Examples, verbatim from the code:

- `"AI API Key is missing"` — [instance.ts](../src/features/ai/instance.ts)
- `"Failed to generate embedding"` — [embedding.ts](../src/features/ai/embedding.ts) and (separately, same wording) [transaction/action.ts](../src/features/transaction/action.ts)
- `"Failed to perform vector search."` — [embedding.ts](../src/features/ai/embedding.ts)
- `"No arguments provided for action"` / `"Unknown function call"` — [chat.ts](../src/features/ai/chat.ts), [wizard.ts](../src/features/ai/wizard.ts) (duplicated verbatim in both files)
- `"Cannot create transaction with invalid amount"` / `"Cannot update transaction with invalid amount"` — [wizard.ts](../src/features/ai/wizard.ts)
- `"No file uploaded"` — [multimodal.ts](../src/features/ai/multimodal.ts)
- `"Failed to generate chart"` / `"Failed to generate image"` / `"Failed to generate video"` — [generative-content.ts](../src/features/ai/generative-content.ts)

None of these errors carry a machine-readable code, a cause chain (`Error.cause`), or structured metadata — they are display strings doubling as the only error identity.

## Client-side pattern

Every `useMutation` call follows:

```ts
onError: (error) => {
  toast.error(error instanceof Error ? error.message : "Failed to process your request");
}
```

This repeats near-verbatim across [wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx), [file-dropzone-input.tsx](../src/app/dashboard/_components/file-dropzone-input.tsx), and [generative-content.tsx](../src/app/dashboard/_components/generative-content.tsx). The one exception is chat, which appends an error message directly into the conversation transcript instead of a toast ([chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx): `"Terjadi kesalahan: " + error.message`).

**Corrected in v2.** The bundled Next.js docs (`01-getting-started/10-error-handling.md`) recommend a specific split:
- **Expected errors**, such as validation failures, should be returned as values (for example with `useActionState`).
- **Throwing** should be reserved for uncaught exceptions, which Next.js handles through error boundaries. For Server Component errors, Next.js replaces the message with a generic one plus a `digest`.

This app throws for expected errors ("Cannot create transaction with invalid amount", "No file uploaded"). What text a production build actually shows for these thrown Server Action errors was **not verified**, and v1's claim of an opt-in mechanism is removed as unsupported. The risk is two-sided:
- Friendly messages may be replaced by generic text.
- In development, internal messages (such as raw Zod errors) reach the toast verbatim.

See AUDIT-REPORT COR-14.

## What is *not* handled

- **No retries.** No AI call, DB call, or embedding call retries on transient failure (network blip, rate limit, 5xx).
- **No error boundaries.** No React `error.tsx`/`ErrorBoundary` was found for the dashboard route tree — an unexpected render-time exception would fall through to Next.js's default error UI.
- **No centralized logging.** Errors are never `console.error`'d or sent to any logging/monitoring service (none is a dependency — see [02-tech-stack.md](02-tech-stack.md)) before being thrown; if a server action throws, the only record is whatever the hosting platform's own function logs happen to capture.
- **No distinction between user-facing and internal errors.** Internal failures (e.g. a malformed Supabase RPC error, a JSON parse failure on a model response) surface their raw `.message` directly to the toast in most paths, which can leak implementation detail to the end user (e.g. a raw Zod validation error string) — see [multimodal.ts](../src/features/ai/multimodal.ts) and [15-security.md](15-security.md) for the information-disclosure angle.
- **No loop-level error isolation** in the tool-calling loops: a single failing tool call inside `Promise.all(functionCalls.map(...))` rejects the whole batch for that turn (see [08-function-calling.md](08-function-calling.md)).

## Video generation is the one place with an unbounded wait, not a caught error

The `generateVideo` polling loop ([generative-content.ts](../src/features/ai/generative-content.ts)) has no timeout — if the operation never completes, the Server Action simply hangs (until the hosting platform's own execution-time limit, if any, kills it), rather than surfacing a clean "generation timed out" error to the user.

## Recommendations are covered in the audit, not here

This document only describes current behavior. See [AUDIT-REPORT.md](AUDIT-REPORT.md) for severity-ranked findings and [18-reusable-patterns.md](18-reusable-patterns.md) for a proposed reusable error-handling pattern for future projects.
