# Prompt Engineering

## Purpose

Document the actual prompt-construction patterns used across the AI features — all of which build prompts as plain template literals, not via any templating library.

## Pattern 1: Persona system-instruction ("Finabot")

File: [src/features/ai/chat.ts](../src/features/ai/chat.ts), `generalChat`.

The general-mode chat passes a large `systemInstruction` string structured with bracketed section headers, entirely in Indonesian:

```
[Role]        — "Finabot", a polite financial advisor persona
[Instruction] — answer only finance-related questions
[Context]     — target user demographic (age, income, platform)
[Input]       — expected user question types
[Constraints] — tone, no assumptions, refuse off-topic questions
[Workflow Steps] — 5-step reasoning process (extract → analyze → plan → evaluate → respond)
[Response Format] — required 2-part answer structure
[Example]     — two worked few-shot examples
```

This is a full prompt-engineering template (role, instructions, context, constraints, explicit workflow, output format, few-shot examples) applied to a single system instruction — the most complete prompt in the codebase.

## Pattern 2: XML-tag structured prompt (repeated across 4 files)

Files: [wizard.ts](../src/features/ai/wizard.ts) (`handleWizardInput`, `handleWizardTools`), [multimodal.ts](../src/features/ai/multimodal.ts) (`extractReceiptData`), [generative-content.ts](../src/features/ai/generative-content.ts) (`generateChart`, `generateImage`, `generateVideo`).

Common shape:

```
<role>...</role>
<instruction>...</instruction>
<context>Current Date: ...</context>
<input>...</input>          (sometimes)
<constraints>...</constraints>   (sometimes, occasionally misspelled </contraints> — see below)
<outputFormat>...</outputFormat> (sometimes)
```

This is a real, reusable convention worth keeping: it visually delimits sections for the model and for future maintainers reading the source. It is not a library — each file hand-writes its own literal string.

**Tag typo in two prompts:** the closing tag is misspelled `</contraints>` (missing "s") in two places:
- `generateChart` in [generative-content.ts](../src/features/ai/generative-content.ts)
- the personal-mode prompt in [chat.ts](../src/features/ai/chat.ts)

Both open with a correctly spelled `<constraints>`, so each tag pair is mismatched. The model doesn't parse prompts as XML, so behavior is unaffected; see [AUDIT-REPORT.md](AUDIT-REPORT.md) COR-7.

## Pattern 3: Dynamic context injection

Every prompt template interpolates `new Date().toISOString()` as "Current Date" so the model can resolve relative dates like "today"/"just now" (explicit instruction to do so appears in [multimodal.ts](../src/features/ai/multimodal.ts) and [wizard.ts](../src/features/ai/wizard.ts)). RAG results are injected as either a joined-JSON-lines context block ([generative-content.ts](../src/features/ai/generative-content.ts): `data.map(t => JSON.stringify(t)).join("\n")`) or as a tool response (chat.ts personal mode).

## Sampling parameters

Only [chat.ts](../src/features/ai/chat.ts) `generalChat` sets explicit sampling controls:

```ts
temperature: 0.2, topK: 5, topP: 0.1,
maxOutputTokens: 2048,
stopSequences: ["\n\n\n", "###", "User:", "Pengguna:"]
```

No other AI call site in the codebase sets `temperature`/`topK`/`topP`/`maxOutputTokens` — they run on SDK defaults. This is an inconsistency, not a deliberate per-feature tuning strategy (there's no comment explaining why only this one call is tuned).

## Safety settings

Two different, inconsistent configurations exist, both scoped only to `HARM_CATEGORY_HATE_SPEECH`:

- General chat: `HarmBlockThreshold.BLOCK_LOW_AND_ABOVE` ([chat.ts](../src/features/ai/chat.ts) `generalChat`)
- Personal (RAG) chat: `HarmBlockThreshold.BLOCK_ONLY_HIGH` ([chat.ts](../src/features/ai/chat.ts) `handleChatStreaming`, personal branch)

No other harm categories (harassment, dangerous content, sexually explicit) are configured anywhere — they run on SDK defaults.

## Structured output enforcement

Two different mechanisms are used to force JSON output:

1. **Hand-written `Type`-based schema** passed to `responseSchema` — [generative-content.ts](../src/features/ai/generative-content.ts) `generateChart`.
2. **Zod-derived schema** via `z.toJSONSchema(transactionSchema)` — [wizard.ts](../src/features/ai/wizard.ts) `handleWizardInput`.
3. **Prompt-instruction only, no `responseSchema`** — [multimodal.ts](../src/features/ai/multimodal.ts) `extractReceiptData` relies purely on the instruction "Respond with only the raw JSON object" plus a post-hoc `transactionSchema.parse(JSON.parse(response.text))`, with no `responseMimeType`/`responseSchema` set on the request at all.

All three paths eventually validate the parsed result against the shared zod `transactionSchema`, which is the actual safety net — not the prompt wording. See [06-content-generation.md](06-content-generation.md).

## Limitations

- No prompt versioning, no prompt template files separated from code, no A/B testing of prompt variants.
- No automated evaluation of prompt output quality (see [16-testing.md](16-testing.md)).
- Prompts mix Indonesian (user-facing instructions/persona) and English (technical instructions) inconsistently within the same file (e.g. [wizard.ts](../src/features/ai/wizard.ts)) — a minor but real maintainability note for a team that may not be bilingual.
