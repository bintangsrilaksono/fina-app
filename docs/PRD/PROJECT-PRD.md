# PRD: Fina — AI-Powered Personal Finance Tracker

This PRD describes the **current, actual** state of [fina-app](../../) as reconstructed from its code, since no original PRD exists in the repository. Every "CURRENT" section is verifiable against a specific file. "FUTURE" sections are explicitly speculative and are marked as such.

## 1. Product Overview

**CURRENT:** Fina is a web application ([src/app/page.tsx](../../src/app/page.tsx): "Your personal finance app with AI") for tracking income/expense transactions, enhanced with several Google Gemini AI features: a conversational financial advisor, a text/voice transaction-entry wizard, receipt-scanning, and AI-generated dashboard insights (charts, images, videos).

## 2. Problem Statement

**CURRENT (inferred from the chat persona's stated target user, [chat.ts](../../src/features/ai/chat.ts)):** young entrepreneurs in Indonesia (18–30 years old, Rp 30–60 million/month income) who are beginning to think about investing need an approachable way to log transactions and get financial guidance without manual bookkeeping friction.

## 3. Objectives

**CURRENT, as evidenced by implemented features:**
- Reduce transaction-entry friction (text/voice wizard, receipt scan) below manual form-filling.
- Provide contextual financial advice grounded in the user's actual spending (personal RAG chat mode).
- Surface spending patterns visually without the user building charts themselves (generative content).

## 4. Users

**CURRENT:** a single implicit user persona baked into the chat system prompt (see Problem Statement). **There is no user segmentation, role system, or admin/user distinction in the code** — everyone who reaches `/dashboard` (currently anyone, since auth is unenforced — see [15-security.md](../15-security.md)) has identical access to every feature.

## 5. User Journeys

**CURRENT, each traceable to code:**

1. **Manual entry:** User opens `/dashboard/transaction`, fills [create-transaction-card.tsx](../../src/app/dashboard/transaction/_components/create-transaction-card.tsx), submits → `createTransaction`.
2. **Wizard entry (text):** User types into [wizard-input.tsx](../../src/app/dashboard/_components/wizard-input.tsx) → `handleWizardTools` → model extracts + calls `create_transaction` (or `update_transaction`/`delete_transaction` if the text implies a change) → toast confirmation.
3. **Wizard entry (voice):** User holds the mic button, speaks, releases → `MediaRecorder` blob → same `handleWizardTools` path with `type: "audio"`.
4. **Receipt scan:** User drags/drops or clicks to upload a receipt image/PDF in [file-dropzone-input.tsx](../../src/app/dashboard/_components/file-dropzone-input.tsx) → `extractReceiptData` → form pre-filled → user reviews and submits manually (auto-save is implemented but disabled — see [multimodal.ts](../../src/features/ai/multimodal.ts) lines 68–69).
5. **Chat advisory (general):** User opens the drawer ([chatbot-drawer.tsx](../../src/app/dashboard/_components/chatbot-drawer.tsx)), asks a general finance question in "general" mode → streamed persona-driven answer, optionally grounded by live web search.
6. **Chat advisory (personal):** Same drawer, "personal" mode → answers grounded in the user's own transactions via the `get_transaction` RAG tool.
7. **Generative insight:** User opens the "Generative AI Insight" card, types a request, picks chart/image/video → sees a generated artifact.

## 6. Scope

**CURRENT in scope:** transaction CRUD, chat advisor (2 modes), wizard (text+voice, full CRUD via tools), receipt scanning, chart/image/video generation, balance summary dashboard.

**CURRENT explicitly out of scope (not implemented, not partially built toward):** multi-account/multi-currency tracking, budgeting/goal-setting, recurring transactions, notifications, data export, admin/reporting tools, mobile app.

## 7. Functional Requirements

**CURRENT (derived from what's implemented, not aspirational):**

- FR-1: The system must allow creating, listing (paginated, with search on the description), updating, and deleting transactions. *(Implemented in [transaction/action.ts](../../src/features/transaction/action.ts). Validation is client-side only on the manual path, and there are no ownership checks; see [AUDIT-REPORT.md](../AUDIT-REPORT.md) SEC-7.)*
- FR-2: The system must compute and display total income, total expense, and savings. *(Implemented — `getBalanceSummary`)*
- FR-3: The system must let a user extract a transaction from free text, a voice recording, or a receipt image/PDF. *(Implemented — wizard, multimodal)*
- FR-4: The system must provide a streaming chat interface with a general-advice mode and a personal-data-grounded mode. *(Implemented — chat.ts, /api/chat)*
- FR-5: The system must generate a chart, image, or video summarizing the user's transaction data on request. *(Implemented — generative-content.ts)*

## 8. AI Requirements

**CURRENT:** see [04-ai-llm-integration.md](../04-ai-llm-integration.md) for the full model/capability inventory. In summary: single provider (Google Gemini via `@google/genai`), five distinct model identifiers in use, no provider abstraction, no fallback provider.

## 9. Prompt Requirements

**CURRENT:** see [05-prompt-engineering.md](../05-prompt-engineering.md). All prompts are template literals; the persona prompt (general chat) is the only fully-elaborated role/context/constraints/workflow/example prompt; all extraction/generation prompts follow a shared (if inconsistently spelled) XML-tag convention.

## 10. RAG Requirements

**CURRENT:** see [07-rag.md](../07-rag.md). Whole-transaction embedding via `gemini-embedding-2` (768-dim), cosine similarity via a Supabase pgvector RPC, two integration styles (tool-mediated and pre-fetch), **not currently scoped to the authenticated user** (a requirement that is unmet, not merely unimplemented — see Known Limitations).

## 11. Agent Requirements

**CURRENT:** see [09-ai-agent-tools.md](../09-ai-agent-tools.md). Two independent hand-rolled tool-calling loops (read-only in chat's personal mode, full CRUD in the wizard); no agent framework; no persistent agent memory.

## 12. Tool Requirements

**CURRENT:** see [08-function-calling.md](../08-function-calling.md). Four Gemini function declarations covering the full transaction CRUD surface, plus Gemini's built-in `googleSearch`/`urlContext` tools in general chat mode only.

## 13. Multimodal Requirements

**CURRENT:** see [10-multimodal.md](../10-multimodal.md). Image/PDF input (receipt), audio input (voice wizard), image output (dashboard insight), video output (dashboard insight). Video *input* and general audio Q&A are not implemented.

## 14. Data Requirements

**CURRENT:** a single Postgres table (`transactions`) with a `vector(768)` embedding column. See [11-database-and-vector-db.md](../11-database-and-vector-db.md). No other persisted entities exist — chat history and generated-content results are ephemeral client state only.

## 15. UI Requirements

**CURRENT:** Next.js App Router pages (`/`, `/dashboard`, `/dashboard/transaction`), shadcn/Radix component library, Tailwind CSS 4, and `next-themes` (used only by the toast component's `useTheme()`). No `ThemeProvider` is mounted and there is no toggle, so theme switching is **NOT IMPLEMENTED**.

## 16. API Requirements

**CURRENT:** one REST route (`POST /api/chat`, streaming NDJSON); all other operations are Next.js Server Actions, not REST endpoints. See [13-backend-patterns.md](../13-backend-patterns.md).

## 17. Security

**CURRENT (see [15-security.md](../15-security.md) for full detail):** RLS is enabled but permissive (`USING (true)`); `user_id` is never populated; authentication scaffolding exists but is not enforced (no login page, redirect disabled); no rate limiting exists on any AI-calling path. **The application currently provides no per-user data isolation and no enforced authentication.**

## 18. Error Handling

**CURRENT:** see [14-error-handling.md](../14-error-handling.md). Uniform throw/catch/toast pattern; no retries, no centralized logging, no error boundaries found.

## 19. Performance

**CURRENT:** no caching anywhere; `getBalanceSummary` fetches the full table and aggregates in application code rather than SQL; no vector index on the `embedding` column. Acceptable at the current expected data scale (a single user's personal transactions); not verified against, and not designed for, larger datasets.

## 20. Testing

**CURRENT:** none. See [16-testing.md](../16-testing.md).

## 21. Deployment

**CURRENT:** no deployment configuration exists in the repository. See [17-deployment.md](../17-deployment.md).

## 22. Acceptance Criteria

**CURRENT, as verifiable against the running feature set (not a future target):**
- A user can create a transaction via form, text wizard, or voice wizard, and see it reflected in the transaction table and balance cards.
- A user can upload a receipt image and see the create-transaction form pre-filled with extracted data.
- A user can ask the chat advisor a general finance question and receive a streamed, persona-consistent answer.
- A user can ask the chat advisor about their own spending and receive an answer grounded in matching transaction rows.
- A user can request a chart, image, or video summarizing their transactions and see it rendered on the dashboard.

## 23. Known Limitations

Directly restating the CRITICAL/HIGH findings from [AUDIT-REPORT.md](../AUDIT-REPORT.md) and [15-security.md](../15-security.md), because they are load-bearing for any deployment decision:

- No enforced authentication — the dashboard is reachable by anyone.
- No per-user data isolation — RLS is permissive and `user_id` is never set, so all users' data is functionally shared.
- No rate limiting — AI feature usage (especially video generation) is unbounded per caller.
- No automated tests, no CI/CD.
- Mixed/inconsistent Gemini model versions across similar call sites with no documented rationale.
- Video-generation temp files are never cleaned up.
- The manual create and update Server Actions accept unvalidated payloads, and update and delete have no ownership check (SEC-7).
- Descriptions returned by the RAG tool are fed back to a model that can delete or update data without asking the user to confirm (SEC-8).
- Receipt photos and voice recordings over 1 MB fail, because of the default Server Action body limit (COR-12).
- Creating any transaction, including manually, fails if Gemini is unavailable, because embedding happens synchronously on write.

## 23.1 Capability classification (CURRENT → MCP readiness)

| Capability | Type | Where it runs today | In a future MCP mode |
|---|---|---|---|
| Chat advice, wizard extraction and planning, receipt vision, chart design, image and video generation | AI | Server, with Gemini | Customer's Claude. Not MCP tools. |
| Transaction CRUD, search, balance summary, category list | Business | Server, with Supabase | MCP tools and resources, after the SEC-1, SEC-2, SEC-3, and SEC-7 fixes |
| Spending breakdown (grouping and totals) | Business, but **currently done by the LLM** inside `generateChart` | Gemini | A deterministic SQL tool |

Details are in [../19-mcp-readiness.md](../19-mcp-readiness.md).

## 24. Future Enhancements

**FUTURE (explicitly speculative — none of this exists today):**
- Real authentication + enforced per-tenant RLS (prerequisite for any multi-user deployment).
- Rate limiting and AI cost tracking/dashboards.
- A shared, single implementation of the tool-calling loop.
- An MCP server exposing transaction data/actions to external Claude clients — see [19-mcp-readiness.md](../19-mcp-readiness.md) for what this would require; not started.
- Automated testing and an AI-output evaluation harness.
- CI/CD pipeline.
