# Function Calling

## Purpose

Let the Gemini model invoke real backend operations (read/create/update/delete a transaction) mid-conversation, rather than only producing text.

## Actual implementation

### Declarations

[src/features/ai/function-transaction.ts](../src/features/ai/function-transaction.ts) defines four `FunctionDeclaration` objects using `@google/genai`'s `Type` enum (not JSON Schema directly, though structurally equivalent):

| Declaration | Purpose | Required fields |
|---|---|---|
| `getTransactionDeclaration` (`get_transaction`) | Look up existing transaction(s) | none required (all optional filters) |
| `createTransactionDeclaration` (`create_transaction`) | Create a transaction | `amount, description, type, category, date` |
| `deleteTransactionDeclaration` (`delete_transaction`) | Delete a transaction | none declared as required (relies on `id` being present in practice) |
| `updateTransactionDeclaration` (`update_transaction`) | Update a transaction | none declared as required |

All four share the same `transactionProperties` object, so every declaration technically exposes every field even when a given operation doesn't need it (e.g. `get_transaction` exposes `id`, `amount`, `type`, etc. as optional filter fields).

### Where declarations are wired to a model call

| Call site | Tools wired | Notes |
|---|---|---|
| [chat.ts](../src/features/ai/chat.ts) `handleChatStreaming` personal mode | `[getTransactionDeclaration]` only | Read-only — chat can never mutate data. |
| [wizard.ts](../src/features/ai/wizard.ts) `handleWizardTools` | All four declarations | Full CRUD agent. |

### Execution loop (identical shape, duplicated in two files)

```ts
// simplified, as implemented independently in chat.ts and wizard.ts
while (running) {
  const response = await ai.models.generateContent{,Stream}({ contents, config: { tools: [...] } });
  if (response has functionCalls) {
    contents.push(model's content);
    const functionResponseParts = await Promise.all(functionCalls.map(async (call) => {
      switch (call.name) {
        case "get_transaction": /* findEmbedding(...) */ break;
        case "create_transaction": /* zod parse → createTransaction() */ break;
        case "update_transaction": /* zod parse → updateTransaction() */ break;
        case "delete_transaction": /* deleteTransaction() */ break;
        default: throw new Error("Unknown function call");
      }
      return { functionResponse: { name, response: { result }, id } };
    }));
    contents.push({ role: "user", parts: functionResponseParts });
  } else {
    running = false;
  }
}
```

Both implementations execute *all* returned function calls in parallel via `Promise.all`, then feed all responses back in a single `user` turn before the next model call.

### Validation inside tool execution

`create_transaction` and `update_transaction` both re-validate arguments with the shared zod `transactionSchema` and explicitly reject non-positive amounts (`throw new Error("Cannot create/update transaction with invalid amount")`) — this is a real safety check preventing the model from writing a zero/negative-amount row, independent of whatever the function declaration schema allowed.

## Data flow

See the Function-Calling Flow diagram in [01-architecture.md](01-architecture.md#4-functiontool-calling-flow).

## Inputs / Outputs

| Tool | Input (from model) | Executed action | Result returned to model |
|---|---|---|---|
| `get_transaction` | Partial transaction filter | `findEmbedding(JSON.stringify(args), threshold, count)` | Matched row(s) or `[]`/`{}` |
| `create_transaction` | Full transaction | `transactionSchema.parse` → `createTransaction` | `{}` (no data echoed back) |
| `update_transaction` | `id` + fields | `transactionSchema.parse` → `updateTransaction(id, ...)` | `{}` |
| `delete_transaction` | `id` | `deleteTransaction(id)` | `{}` |

## Error handling

- Missing `args` on any function call throws `"No arguments provided for action"`, aborting the whole request (not just that one call).
- An unrecognized function name throws `"Unknown function call"` — since this happens inside `Promise.all`, one bad call fails the entire batch of parallel tool executions for that turn.
- Zod validation failures on `create_transaction`/`update_transaction` throw and propagate up uncaught by the loop itself — the caller (`handleWizardTools`'s consumer, or the streaming route) is responsible for surfacing this as a user-facing error.

## Security considerations

- The `get_transaction` tool in chat.ts personal mode is retrieval-only and cannot mutate data — a deliberate, sound boundary between the advisory chat and the wizard's mutation capability.
- No confirmation step exists before `delete_transaction` or `update_transaction` execute — if the model decides to call them, they run immediately against the real database with no human-in-the-loop approval. Given the current RLS policy is permissive (see [11-database-and-vector-db.md](11-database-and-vector-db.md)), this means a prompt-injected or hallucinated tool call could delete/modify data belonging to any user, not just the caller.
- Tool arguments are trusted after only zod shape/type validation — there is no authorization check (e.g. "does this transaction belong to the current session's user?") anywhere in `delete_transaction`/`update_transaction`'s execution path in either `wizard.ts` or `transaction/action.ts`.

## Limitations

- The loop has no maximum iteration count — a model that keeps calling functions could loop indefinitely (bounded in practice only by Gemini's own behavior, not by application code).
- No shared helper exists for "the tool-calling loop" — logic is copy-pasted between `chat.ts` and `wizard.ts` with slightly different tool sets, error messages, and streaming vs. non-streaming shapes. See [09-ai-agent-tools.md](09-ai-agent-tools.md) and [18-reusable-patterns.md](18-reusable-patterns.md) for the reusable extraction of this pattern.
