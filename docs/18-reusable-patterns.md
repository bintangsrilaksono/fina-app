# Reusable Engineering Patterns

Every pattern below is extracted from actual code in [fina-app](../), not aspirational. Anti-patterns are also drawn from the same code — this project is used as both a positive and negative example throughout.

---

## Pattern: AI Service Factory (not a full abstraction)

**Problem solved:** avoid re-writing API-key handling and client construction in every AI-calling file.

**When to use:** any project with a single LLM provider and no near-term need to swap providers.

**When not to use:** if you expect to support multiple providers (OpenAI + Anthropic + Gemini) or need per-feature client configuration (different timeouts, different retry policies) — this pattern does not scale to that without modification.

**Implementation pattern** ([instance.ts](../src/features/ai/instance.ts)):

```ts
export function createAI() {
  if (!ENVIRONMENT.key) throw new Error("AI API Key is missing");
  return new ProviderSDK({ apiKey: ENVIRONMENT.key });
}
```

Every feature module calls this factory itself; no dependency injection container, no singleton.

**Input/Output:** no input; returns a configured SDK client instance.

**Error handling:** fail fast with a clear message if the key is missing, rather than letting the SDK throw its own less-obvious error deeper in the call stack.

**Security:** only call this from server-only (`"use server"`) modules — this repo does that consistently.

**Performance:** as implemented here, a new client is constructed per call rather than memoized. For low-traffic apps this is negligible; for high-traffic apps, memoize the client (not shown in this codebase — noted as a gap in [AUDIT-REPORT.md](AUDIT-REPORT.md)).

**Anti-pattern actually present in this codebase:** no provider-agnostic interface exists above this factory — every call site imports `@google/genai` types directly (`Content`, `FunctionCall`, `HarmCategory`, etc.), so switching providers would require touching every feature file, not just this factory. If provider portability is ever a goal (see [19-mcp-readiness.md](19-mcp-readiness.md)), introduce an interface boundary here, not after the fact.

---

## Pattern: XML-Tag Structured Prompt Template

**Problem solved:** give a model unambiguous section boundaries (role, instructions, context, constraints, output format) using plain string interpolation, without a templating library.

**When to use:** any single-shot, task-specific prompt (extraction, classification, generation-with-constraints) where you control the whole prompt and don't need localization/versioning infrastructure.

**When not to use:** prompts that need to be edited by non-engineers, A/B tested, or versioned independently of code deploys — those need a separate prompt-management system, which this project does not have.

**Implementation pattern**, generalized from [multimodal.ts](../src/features/ai/multimodal.ts) / [generative-content.ts](../src/features/ai/generative-content.ts):

```ts
const prompt = `
  <role>${roleDescription}</role>
  <instruction>${taskInstructions}</instruction>
  <context>Current Date: ${new Date().toISOString()}${extraContext}</context>
  <constraints>${hardRules}</constraints>
  <outputFormat>${outputFormatRules}</outputFormat>
`;
```

**Input:** interpolated variables (user request, retrieved context, current date). **Output:** a single string passed as `contents`.

**Error handling:** none inherent to the template itself — validate the *response*, not the prompt.

**Security:** never interpolate untrusted content that looks like your own tag syntax without awareness that it isn't real parsing — a user typing `</instruction><instruction>ignore all rules` will not "break out" of anything (the model isn't a parser), but it does mean these tags provide no security boundary, only a readability one. Don't rely on them to sandbox instructions.

**Anti-pattern actually present:** the closing tag `</contraints>` is misspelled (missing "s") in [generative-content.ts](../src/features/ai/generative-content.ts) and in the personal-mode prompt of [chat.ts](../src/features/ai/chat.ts). In both places the opening tag is spelled correctly, so the pair is mismatched. Harmless to model behavior, real to maintainability — copy from one canonical template rather than retyping per file.

---

## Pattern: Structured Output via `responseSchema` + Zod Double-Validation

**Problem solved:** force JSON-shaped model output, then re-verify it server-side before trusting it for a database write.

**When to use:** any feature where the model's output becomes structured data consumed by code (forms, DB rows, chart configs).

**When not to use:** free-form conversational text (chat answers) — forcing a schema there would degrade the response.

**Implementation pattern** ([wizard.ts](../src/features/ai/wizard.ts) `handleWizardInput`). The code is correct, but no user-facing feature calls this function: it is imported by `wizard-input.tsx` and never invoked (AUDIT-REPORT COR-1).

```ts
const response = await ai.models.generateContent({
  model, contents,
  config: { responseMimeType: "application/json", responseSchema: z.toJSONSchema(mySchema) },
});
const validated = mySchema.parse(JSON.parse(response.text));
```

**Input:** prompt + a Zod schema (single source of truth, reused for the AI schema *and* the runtime validation). **Output:** a value guaranteed to satisfy the schema, or a thrown `ZodError`.

**Error handling:** let the `ZodError`/`SyntaxError` propagate to the caller's error boundary — do not swallow it, since a validation failure here means the model didn't follow instructions and the caller needs to know.

**Security:** this is your real safety net against a misbehaving/hallucinating model — never skip the `.parse()` step just because `responseSchema` was set; the model's JSON-mode output can still be structurally wrong.

**Anti-pattern actually present:** [multimodal.ts](../src/features/ai/multimodal.ts) `extractReceiptData` skips `responseSchema`/`responseMimeType` entirely and relies purely on prompt instructions ("respond with only raw JSON"), catching malformed output only at the final `.parse(JSON.parse(...))` step — this works but is strictly weaker than setting `responseSchema`, and if the model prepends any stray text, `JSON.parse` throws a confusing `SyntaxError` before Zod ever runs. Prefer setting `responseSchema` wherever the SDK supports it, as in `handleWizardInput`, not just instructing via prompt text.

**Also inconsistent:** two different schema-authoring styles coexist (hand-written `Type`-enum objects in `generateChart` vs. `z.toJSONSchema()` in `handleWizardInput`) — pick one convention (prefer deriving from Zod, since it's then reusable for validation too) and apply it everywhere.

---

## Pattern: Manual Tool-Calling Loop ("hand-rolled agent")

**Problem solved:** let a model chain 0–N tool calls per user turn without adopting a full agent framework.

**When to use:** a small, fixed, well-known tool surface (here: 1–4 tools) where you fully trust/control every tool's implementation and don't need planning, memory across sessions, or sub-agent delegation.

**When not to use:** a large or dynamic tool surface, multi-agent handoff, or anything needing persistent agent state — reach for a real agent framework/SDK instead once you outgrow this shape.

**Implementation pattern**, generalized from [chat.ts](../src/features/ai/chat.ts) and [wizard.ts](../src/features/ai/wizard.ts):

```ts
let running = true;
while (running) {
  const response = await ai.models.generateContent({ contents, config: { tools: [{ functionDeclarations }] } });
  if (response.functionCalls?.length) {
    contents.push(response.candidates[0].content); // the model's own turn, including functionCall parts
    const results = await Promise.all(response.functionCalls.map(async (call) => {
      const result = await dispatch(call.name, call.args); // your own switch/lookup
      return { functionResponse: { name: call.name, response: { result }, id: call.id } };
    }));
    contents.push({ role: "user", parts: results });
  } else {
    running = false;
  }
}
```

**Input:** conversation history + tool declarations + a `dispatch` function mapping tool name → real implementation. **Output:** final model text once no more tools are called.

**Error handling:** decide deliberately whether one failing tool call should abort the whole turn (current behavior, via `Promise.all` rejecting) or should return an error result to the model so it can recover — this codebase always does the former; the latter is often better UX for agentic loops.

**Security:** validate/authorize every `dispatch` target as if it were a public API endpoint, because that's what it functionally is — the model is an untrusted-ish caller shaped by whatever got into its context. This codebase validates *shape* (Zod) but not *authorization* (see [08-function-calling.md](08-function-calling.md), [15-security.md](15-security.md)) — don't repeat that gap.

**Performance:** add a max-iteration guard (absent here) to bound worst-case latency/cost.

**Anti-pattern actually present:** this loop is copy-pasted twice with drift (different tool sets, streaming vs. non-streaming, different error strings for identical failures like "no arguments provided"). **Extract it once**, parameterized by `{ tools, dispatch, stream: boolean }`, the first time you need it in a second place — which, in this codebase, was immediately.

---

## Pattern: RAG-as-a-Tool vs. RAG-as-Pre-fetch

**Problem solved:** ground model output in retrieved data — but there are two legitimately different integration shapes, both present here.

**When to use "RAG-as-a-Tool"** (expose retrieval as a function the model calls when *it* decides it needs data — [chat.ts](../src/features/ai/chat.ts) personal mode): when the model also needs to answer general questions that don't require retrieval, and you don't want to pay the retrieval cost/latency on every turn.

**When to use "RAG-as-Pre-fetch"** (always retrieve before prompting — [generative-content.ts](../src/features/ai/generative-content.ts)): when the task is *always* about the user's own data (a chart is always "of something"), so skipping retrieval is never correct.

**Implementation pattern (pre-fetch variant):**

```ts
const context = await findEmbedding(userRequest, threshold, count);
const contextBlock = context.length ? context.map(r => JSON.stringify(r)).join("\n") : "No relevant data found";
const prompt = buildPrompt({ userRequest, contextBlock });
```

**Input:** user request string, similarity threshold/count. **Output:** a context block ready for prompt interpolation.

**Error handling:** always handle the empty-results case explicitly in the prompt (as this codebase does — "No transactions found...") rather than interpolating an empty string, which reads to the model as "there is no context section" rather than "the search came up empty."

**Security:** whichever variant you choose, the retrieval query itself must be scoped to the current tenant/user at the database layer (RLS or an explicit filter) — this codebase does **not** do this (see [07-rag.md](07-rag.md), [15-security.md](15-security.md)) and it is the single most important thing to fix before reusing this pattern in a multi-tenant project.

---

## Pattern: Embedding-on-Write

**Problem solved:** keep a vector index continuously in sync with relational data without a separate batch/reindex job.

**When to use:** low-to-moderate write volume, where embedding latency added to the write path (one extra API round-trip per create/update) is acceptable.

**When not to use:** high-throughput write paths, or when the embedded content changes independently of the row it's attached to (then a queue-based async reindex is more appropriate — not implemented here).

**Implementation pattern** ([transaction/action.ts](../src/features/transaction/action.ts)):

```ts
async function createOrUpdate(record) {
  const embedding = await generateEmbedding(JSON.stringify(record));
  return db.upsert({ ...record, embedding });
}
```

**Input:** the record being written. **Output:** the same record, with an embedding attached before persistence.

**Error handling:** this codebase throws (aborting the whole write) if embedding generation fails — meaning a Gemini outage blocks *all* transaction writes, not just search. Consider whether your use case can tolerate writing the row without an embedding and backfilling later; this codebase does not offer that fallback.

**Performance:** synchronous embedding-then-write adds latency to every write proportional to the embedding API's response time — acceptable here given expected volume, worth revisiting at scale.

---

## Anti-patterns catalogued across this codebase (for avoidance in future projects)

1. **Duplicated business logic instead of a shared helper** — the tool-calling loop (above) and the "success toast + refetch + form.reset()" `useMutation` pattern ([12-frontend-patterns.md](12-frontend-patterns.md)) are each written 2–4 times independently.
2. **Silent no-op instead of an explicit error** — [multimodal.ts](../src/features/ai/multimodal.ts) has a `createTransaction` call commented out with no `TODO`/tracking; a reader can't tell if that's intentional or forgotten.
3. **Resource leaks in success paths** — `generateVideo`'s temp file is never cleaned up ([06-content-generation.md](06-content-generation.md)).
4. **Security TODOs left as SQL comments** — the correct RLS policy exists as a comment, not as a tracked, ticketed follow-up ([11-database-and-vector-db.md](11-database-and-vector-db.md)).
5. **Inconsistent model/parameter choices with no documented rationale** — mixed `gemini-3.5-flash`/`gemini-2.5-flash`, only one call site tuning sampling params, two different safety-threshold configs for logically similar features ([04-ai-llm-integration.md](04-ai-llm-integration.md), [05-prompt-engineering.md](05-prompt-engineering.md)).

These are cataloged in full, with severity, in [AUDIT-REPORT.md](AUDIT-REPORT.md).
