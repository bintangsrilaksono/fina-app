# Backend Patterns

## Purpose

Document how server-side logic is organized: almost entirely Next.js Server Actions, with exactly one traditional REST route.

## Server Actions as the default RPC mechanism

Every file under [src/features/](../src/features/) except `function-transaction.ts` (plain schema constants) and `instance.ts` begins with `"use server"`. Their exported async functions are called directly from client components (see [12-frontend-patterns.md](12-frontend-patterns.md)). This covers both AI orchestration (`features/ai/*.ts`) and plain data access (`features/transaction/action.ts`). There is no split between an API layer and a business-logic layer: the Server Action is both.

**Which actions are actually exposed (v2).** The bundled Next.js docs say to treat Server Actions as public endpoints, and they note that actions no client imports are dead-code-eliminated. By that rule, the client-callable surface is the set of actions imported by client components:

| Exposed action | Imported by |
|---|---|
| `getTransactions`, `createTransaction`, `updateTransaction`, `deleteTransaction`, `getBalanceSummary` | Transaction and dashboard components |
| `handleWizardTools`, and `handleWizardInput` (imported, never called) | `wizard-input.tsx` |
| `extractReceiptData` | `file-dropzone-input.tsx` |
| `generateChart`, `generateImage`, `generateVideo` | `generative-content.tsx` |

`embedding.ts` (`generateEmbedding`, `findEmbedding`) and `chat.ts` (`handleChat`, `handleChatStreaming`) are imported only by server code, so they are not browser-callable. They are still marked `"use server"`, which is a latent risk (AUDIT-REPORT SEC-10). None of the exposed actions checks for a session or validates its input on the server, except the zod parsing inside the wizard's tool dispatch (SEC-3, SEC-7).

Consequences of this choice, as implemented:

- No request/response schema is enforced at a framework level the way an API route with middleware might — each action does its own ad hoc input handling (e.g. reading `FormData` fields with `formData.get("file") as File`, no runtime check that the field actually exists before casting).
- No shared middleware (auth check, rate limiting, logging) wraps Server Actions — each one is an independent entry point. The one place an auth-adjacent check exists at all is the Next.js middleware ([proxy.ts](../src/proxy.ts)) which runs on page navigation, not on Server Action invocation directly.

## The one REST route: `/api/chat`

[src/app/api/chat/route.ts](../src/app/api/chat/route.ts) is the only `route.ts` file with a handler in the app. The route returns a raw `ReadableStream` HTTP response for token-by-token chat streaming.

Why a route and not a Server Action is **INFERRED**; the code doesn't say. Two pieces of evidence:
- The commit message for `092f4c2` reads "fix chat streaming SSR error".
- The streaming generator lives in a `"use server"` file but is consumed only through this route.

Together these suggest the streaming path was moved to a Route Handler to work around a problem. Unlike Server Actions, Route Handlers get no 1 MB default body limit and no Origin check.

```ts
export async function POST(request: NextRequest) {
  const { conversation, isThinking, mode } = await request.json();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of handleChatStreaming(conversation, isThinking, mode)) {
        controller.enqueue(encoder.encode(JSON.stringify({ thought, text }) + "\n"));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
```

This hand-rolls a newline-delimited-JSON streaming protocol; it does not use Server-Sent Events (`text/event-stream`) or the Vercel AI SDK's `streamText`/`toDataStreamResponse` helpers (the `ai` package is not a dependency — see [02-tech-stack.md](02-tech-stack.md)).

## Data access pattern

[features/transaction/action.ts](../src/features/transaction/action.ts) calls the Supabase JS query builder directly inside each exported function — there is no repository/DAO abstraction, no query builder wrapper, and no caching layer. Every function creates its own Supabase client via `createClient()` (from [lib/supabase/server.ts](../src/lib/supabase/server.ts)), which itself re-reads cookies per call.

## AI orchestration pattern

Every `features/ai/*.ts` file follows: `createAI()` → build prompt (template literal) → call one `ai.models.*` method → parse/validate response → return. The only branching complexity is the tool-calling loop duplicated in `chat.ts` and `wizard.ts` (see [08-function-calling.md](08-function-calling.md) and [09-ai-agent-tools.md](09-ai-agent-tools.md)).

## Middleware

[src/proxy.ts](../src/proxy.ts) (Next.js 16's renamed `middleware.ts`) delegates to [lib/supabase/proxy.ts](../src/lib/supabase/proxy.ts), which:

1. Creates a request-scoped Supabase server client wired to `request.cookies`/`supabaseResponse.cookies` (the standard `@supabase/ssr` cookie-refresh dance).
2. Calls `supabase.auth.getUser()`.
3. Has a commented-out redirect-to-`/login` branch — so today this middleware's only real effect is refreshing the Supabase auth cookie; it does not gate any route.

Matcher: `/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|...)$).*)"` — runs on every non-asset request, per [src/proxy.ts](../src/proxy.ts).

## API design characteristics

- No versioning (`/api/v1/...`) — the single route is `/api/chat` with no version segment.
- No OpenAPI/schema documentation of the one REST endpoint.
- No consistent envelope for Server Action return values — some return plain strings (`handleWizardInput` → `"Create transaction success"`), some return objects (`{thought, answer}`), some return `void`/`undefined` implicitly (`handleChat` when `parts` is missing), and errors are communicated exclusively by throwing, caught only at the React Query boundary on the client.

## Error handling

See [14-error-handling.md](14-error-handling.md) for the dedicated write-up; in short, every layer here throws plain `Error` objects with hand-written message strings, with no error codes, no structured error shape, and no centralized handler.

## Security considerations

- Server Actions in Next.js are POST-only, same-origin-protected endpoints by framework default — this is a meaningful baseline protection the app gets "for free" without any code of its own.
- Because there is no per-action auth check, any Server Action reachable from a page a user can load is callable regardless of the (currently disabled) middleware auth gate — see [15-security.md](15-security.md).
- The `/api/chat` route performs no input validation beyond a type assertion (`as {conversation, isThinking, mode}`) — a malformed body would throw inside `handleChatStreaming` and be surfaced via `controller.error(error)`, which the client's `fetch` handling treats as "Failed to get response from AI Advisor" (a generic message, from [chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx)).

## Limitations

- No shared "AI-calling Server Action" wrapper for cross-cutting concerns (auth, rate limiting, logging, cost tracking) — each of the ~9 AI-related Server Actions would need identical changes applied by hand today.
- No background job/queue system — the long-running video generation poll happens synchronously within the Server Action's own execution (bounded only by the platform's function-timeout limits, which are not configured anywhere in this repo).
