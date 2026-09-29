# Frontend Patterns

## Purpose

Document the actual client-side conventions used across [src/app/dashboard/_components/](../src/app/dashboard/_components/) and [src/components/ui/](../src/components/ui/).

## Component organization

- Route-scoped client components live in `_components` folders next to the route that uses them (Next.js App Router convention: leading underscore opts the folder out of routing). E.g. [dashboard/_components/](../src/app/dashboard/_components/) and [dashboard/transaction/_components/](../src/app/dashboard/transaction/_components/).
- Generic, reusable primitives (button, card, dialog, drawer, table, etc.) live in [src/components/ui/](../src/components/ui/) — these are shadcn-generated wrappers around Radix primitives, not hand-written from scratch.
- Only some components declare `"use client"`. **Corrected in v2:** v1 said every hook-using component was marked, which is wrong.
  - Marked: [chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx), [wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx), [dashboard-content.tsx](../src/app/dashboard/_components/dashboard-content.tsx), and [transaction.tsx](../src/app/dashboard/transaction/_components/transaction.tsx).
  - Not marked, despite using hooks: [generative-content.tsx](../src/app/dashboard/_components/generative-content.tsx), [file-dropzone-input.tsx](../src/app/dashboard/_components/file-dropzone-input.tsx), [chatbot-textarea.tsx](../src/app/dashboard/_components/chatbot-textarea.tsx), and the create, update, and delete transaction components.
  - The unmarked components still work because a client parent imports them, so they run as client code by inheritance. Importing one from a Server Component would break it (AUDIT-REPORT COR-16).
  - Layouts and pages are Server Components.

## Server-state pattern: React Query wrapping Server Actions

Every data-fetching or AI-calling component follows the same shape:

```ts
const { mutate, isPending } = useMutation({
  mutationFn: someServerAction,       // imported directly, e.g. handleWizardTools, extractReceiptData
  onSuccess: (response) => { toast.success(...); refetch(); form.reset(); },
  onError: (error) => { toast.error(error instanceof Error ? error.message : "..."); },
});
```

This exact pattern repeats in [wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx), [file-dropzone-input.tsx](../src/app/dashboard/_components/file-dropzone-input.tsx), and [generative-content.tsx](../src/app/dashboard/_components/generative-content.tsx). Read-side data uses `useQuery` the same way ([dashboard-content.tsx](../src/app/dashboard/_components/dashboard-content.tsx) `getBalanceSummary`, [transaction.tsx](../src/app/dashboard/transaction/_components/transaction.tsx) `getTransactions`). Server Actions are called as if they were plain async functions — no fetch/axios boilerplate, since Next.js Server Actions handle the RPC transport.

The one exception is streaming chat ([chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx)), which cannot use a Server Action directly (Server Actions don't stream to the client the way this app needs); it instead uses `useMutation` with a `mutationFn` that does a raw `fetch("/api/chat")` and manually reads the `ReadableStream` — see [13-backend-patterns.md](13-backend-patterns.md).

## Forms: react-hook-form + zod, always

Every form in the app ([wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx), [chatbot-textarea.tsx](../src/app/dashboard/_components/chatbot-textarea.tsx), [generative-content.tsx](../src/app/dashboard/_components/generative-content.tsx), transaction create/update dialogs) uses the same triad: a local `z.object({...})` schema, `useForm({ resolver: zodResolver(formSchema) })`, and `<Controller>` wrapping shadcn `<Field>`/`<Input>` components rather than native uncontrolled inputs. Enter-to-submit is implemented manually in every form via an `onKeyDown` handler checking `e.key === "Enter" && !e.shiftKey"` — this is duplicated logic, not a shared hook.

## Streaming UI consumption (chat only)

[chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx) manually parses a newline-delimited JSON stream:

```ts
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) { /* parse one JSON line, update state */ }
}
```

State updates append streamed text into the last message's `parts` array, distinguishing "thought" vs "answer" parts by array index (`parts[0]` for thought, `parts[1]` for answer) rather than by a tagged field — a fragile coupling between the client's assumed message shape and the server's actual emission order (see [AUDIT-REPORT.md](AUDIT-REPORT.md)).

## Rendering AI text

All AI-produced text (chat answers, thoughts, wizard success toasts) is rendered through `react-markdown`'s `<Markdown>` component rather than `dangerouslySetInnerHTML` or plain text — a sound default against injection from model output containing HTML-like content.

## Feedback patterns

- `sonner` toasts for every mutation's success/error (`toast.success`/`toast.error`), including rendering a `<Markdown>` element *inside* a toast for the wizard's tool-calling result ([wizard-input.tsx](../src/app/dashboard/_components/wizard-input.tsx)).
- Loading states use `isPending` from React Query to swap in `Loader2Icon` spinners and disable inputs — consistent across every mutation-driven component.
- Empty/error states are hand-written per component (e.g. [balance-cards.tsx](../src/app/dashboard/_components/balance-cards.tsx) renders a fixed red error box on `error`), not a shared `<ErrorState>`/`<EmptyState>` component.

## Currency/formatting

[src/lib/utils.ts](../src/lib/utils.ts) exports `convertToIDR()`, used consistently everywhere a monetary value is displayed (balance cards, transaction table, chart tooltips/axes) — a good example of a small shared utility avoiding formatting drift.

## Limitations

- No shared "AI mutation" hook — the `useMutation` + toast + refetch/reset pattern is copy-pasted rather than extracted into e.g. a `useAiAction()` hook.
- No optimistic updates anywhere — every mutation waits for the server action to resolve, then calls `refetch()`.
- No accessibility-specific code was observed beyond what Radix primitives provide by default (no explicit `aria-*` authored in the reviewed components).
- Chat conversation state is ephemeral (component-local `useState`) — refreshing the page loses the entire conversation; there is no persistence layer for chat history.
