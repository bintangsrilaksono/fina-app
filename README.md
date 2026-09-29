# Fina — AI-Powered Personal Finance Tracker

Fina is a learning project from the **AI Powered Apps Fundamental** curriculum. It is a Next.js 16 personal-finance tracker with Google Gemini AI features built on top:

- **Streaming AI advisor chat** in two modes:
  - general financial advice, with Google Search grounding
  - personal Q&A over your own transactions, using RAG
- **Transaction wizard.** Type or speak a sentence, and the model uses function calling to create, update, or delete transactions.
- **Receipt scanning.** Upload a receipt image or PDF, and a vision model pre-fills the transaction form.
- **Generative insights.** AI-generated charts (structured output), images, and short videos summarizing your spending.

> **Learning project — not production-ready.** The database uses a permissive Row-Level Security policy, and authentication is not enforced. Use dummy data only. See [docs/15-security.md](docs/15-security.md).

## Tech stack

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, Zod, Supabase (Postgres + pgvector), and Google Gemini via `@google/genai`. Details are in [docs/02-tech-stack.md](docs/02-tech-stack.md).

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `GOOGLE_GEN_AI_API_KEY`
3. In the Supabase SQL editor, run, in this order:
   1. [migrations/setup-db.sql](migrations/setup-db.sql) (enables pgvector and creates the `transactions` table)
   2. [migrations/setup-vector.sql](migrations/setup-vector.sql) (creates the `match_transactions` similarity-search function)
4. Start the dev server:
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000.

## Documentation

The [docs/](docs/README.md) folder contains a full engineering reference extracted from this codebase:

- **Architecture and AI capabilities:** [architecture](docs/01-architecture.md), [RAG](docs/07-rag.md), [function calling](docs/08-function-calling.md), [agents and tools](docs/09-ai-agent-tools.md), [multimodal](docs/10-multimodal.md)
- **Audit:** [code and security audit](docs/AUDIT-REPORT.md), [gap analysis](docs/GAP-ANALYSIS.md)
- **Reusable for future AI apps:** [AI Apps Engineering Standard v1.0](docs/AI-APPS-ENGINEERING-STANDARD-v1.0.md), [playbook](docs/AI-APPS-ENGINEERING-PLAYBOOK.md), [checklist](docs/AI-APP-DEVELOPMENT-CHECKLIST.md), [PRD template](docs/PRD/AI-APP-PRD-TEMPLATE.md)
- **MCP strategy:** [MCP readiness](docs/19-mcp-readiness.md) and [API vs. MCP architecture](docs/20-api-vs-mcp-architecture.md)

Start with [docs/README.md](docs/README.md) for the recommended reading order.
