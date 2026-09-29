# Testing

## Status: NOT IMPLEMENTED

This is a factual statement, verified by:

- No test runner in [package.json](../package.json) `devDependencies` (no `jest`, `vitest`, `@testing-library/*`, `playwright`, `cypress`).
- No files matching `*.test.*` or `*.spec.*` anywhere in the repository.
- No `test`/`e2e` script in `package.json`'s `scripts` block (only `dev`, `build`, `start`, `lint`).
- No CI configuration that would run tests (no `.github/workflows`, no other CI config found).

## What exists instead

- **Static type checking**: TypeScript `strict: true` ([tsconfig.json](../tsconfig.json)) catches a class of bugs at compile time but is not a substitute for behavioral tests, and `next build`/`tsc` is not wired into any pre-commit or CI hook found in this repo.
- **Linting**: ESLint flat config extending `eslint-config-next`'s `core-web-vitals` and `typescript` rule sets ([eslint.config.mjs](../eslint.config.mjs)) — catches style/correctness issues, not behavior.
- **Runtime validation as a quasi-test**: zod schemas (`transactionSchema`) validate AI output shape at runtime in production, which catches malformed model responses but is not a repeatable, offline test.

## What would be needed for even minimal coverage

Not a recommendation to implement now, just a factual gap list against what a production AI application in this space typically has:

- Unit tests for pure logic: `convertToIDR()`, the reduce in `getBalanceSummary`, zod schema edge cases (negative/zero amounts, invalid categories).
- Integration tests for Server Actions against a test Supabase project/local Postgres, especially `createTransaction`/`updateTransaction`/`deleteTransaction` and the RLS policy behavior itself (currently unverified by any automated check).
- A prompt/model evaluation harness — golden inputs with expected structured-output shapes for `handleWizardInput`, `extractReceiptData`, and `generateChart`, run against the real model (or a mocked one) to catch prompt regressions. None of this exists; see [05-prompt-engineering.md](05-prompt-engineering.md) for why this matters given the mixed model versions and inconsistent sampling/safety settings already observed.
- Mocking strategy for `@google/genai` and `@supabase/*` clients so tests don't require live API credentials or a live database.
- End-to-end tests for the streaming chat flow (the manual NDJSON parser in [chatbot-drawer.tsx](../src/app/dashboard/_components/chatbot-drawer.tsx) is exactly the kind of hand-rolled protocol logic that regresses silently without a test).

## Reusable guidance

A generic "AI Evaluation" checklist for future projects (not specific to this repo, since none of it exists here to extract from) is provided in [AI-APPS-ENGINEERING-PLAYBOOK.md](AI-APPS-ENGINEERING-PLAYBOOK.md) and [AI-APP-DEVELOPMENT-CHECKLIST.md](AI-APP-DEVELOPMENT-CHECKLIST.md).
