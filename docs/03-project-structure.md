# Project Structure

All application code lives in this repository, [fina-app](../). The documentation is in `docs/`.

```
fina-app/
├── docs/                            # This documentation set
├── migrations/                      # Hand-run SQL, no migration tool/CLI
│   ├── setup-db.sql                 # transactions table + RLS policy
│   └── setup-vector.sql             # pgvector match_transactions() RPC
├── public/                          # Static assets (default create-next-app SVGs)
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── page.tsx                 # Landing page ("/")
│   │   ├── layout.tsx               # Root layout: fonts, QueryProvider, TooltipProvider, Toaster
│   │   ├── globals.css
│   │   ├── favicon.ico
│   │   ├── types/
│   │   │   ├── ai.d.ts              # Conversation type
│   │   │   └── transaction.d.ts     # Transaction type
│   │   ├── api/
│   │   │   └── chat/route.ts        # The ONLY REST route — streams chat via ReadableStream
│   │   └── dashboard/
│   │       ├── layout.tsx           # Sidebar + ChatbotDrawer wrapper
│   │       ├── page.tsx
│   │       ├── _components/         # Dashboard-scoped client components
│   │       │   ├── balance-cards.tsx
│   │       │   ├── chatbot-drawer.tsx
│   │       │   ├── chatbot-textarea.tsx
│   │       │   ├── dashboard-content.tsx
│   │       │   ├── file-dropzone-input.tsx   # Receipt upload (multimodal)
│   │       │   ├── generative-content.tsx    # AI chart/image/video widget
│   │       │   └── wizard-input.tsx          # Text/voice → transaction wizard
│   │       └── transaction/
│   │           ├── page.tsx
│   │           └── _components/
│   │               ├── transaction.tsx
│   │               ├── transaction-table.tsx
│   │               ├── create-transaction-card.tsx
│   │               ├── update-transaction-dialog.tsx
│   │               └── delete-transaction-dialog.tsx
│   ├── components/ui/               # shadcn/radix-ui generated primitives + app-sidebar
│   ├── config/
│   │   └── environment.ts           # Single source of truth for env var names
│   ├── constants/
│   │   └── transaction-constant.ts  # CATEGORIES + zod transactionSchema (shared client/server)
│   ├── features/                    # Server-side business + AI logic ("use server")
│   │   ├── ai/
│   │   │   ├── instance.ts          # createAI() — GoogleGenAI client factory
│   │   │   ├── chat.ts              # Streaming chat (general + personal/RAG modes)
│   │   │   ├── embedding.ts         # generateEmbedding / findEmbedding (RAG)
│   │   │   ├── function-transaction.ts  # Gemini FunctionDeclaration schemas
│   │   │   ├── wizard.ts            # Text/voice → structured transaction, tool-calling loop
│   │   │   ├── multimodal.ts        # Receipt image/PDF → structured transaction
│   │   │   └── generative-content.ts    # generateChart / generateImage / generateVideo
│   │   └── transaction/
│   │       └── action.ts            # Supabase CRUD + embedding-on-write
│   ├── hooks/
│   │   └── use-mobile.ts
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts            # Browser Supabase client
│   │   │   ├── server.ts            # Server (cookie-based) Supabase client
│   │   │   └── proxy.ts             # Middleware Supabase client + auth check (redirect disabled)
│   │   └── utils.ts                 # cn(), convertToIDR()
│   ├── providers/
│   │   └── query-client.tsx         # React Query provider
│   └── proxy.ts                     # Next.js 16 middleware entry (delegates to lib/supabase/proxy.ts)
├── .env.example                     # 3 env var names only, no values
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── components.json                  # shadcn config
├── package.json
└── CLAUDE.md / AGENTS.md            # Points agents at node_modules/next/dist/docs for this Next.js version's breaking changes
```

## Layering convention actually used

The codebase follows a **feature-folder + server-actions** convention rather than a layered `controller/service/repository` split:

- `src/features/<domain>/*.ts` files are marked `"use server"` and contain both AI orchestration (`features/ai/`) and plain data access (`features/transaction/action.ts`). There is no separate "repository" or "service" abstraction layer — Supabase calls and Gemini calls sit directly in these action files.
- `src/app/**/_components/` folders hold client components scoped to a route. Some declare `"use client"`, and others are client code only because a client parent imports them (see [12-frontend-patterns.md](12-frontend-patterns.md)). the leading underscore excludes them from routing, per Next.js convention.
- `src/components/ui/` holds generic, route-agnostic shadcn primitives.
- `src/config/environment.ts` is the only place `process.env` is read for app config — see [15-security.md](15-security.md) for why this matters.
- `src/constants/transaction-constant.ts` holds two things:
  - `CATEGORIES`, which the forms and the AI prompts share, so the category list can't drift between them.
  - `transactionSchema`, which only the AI paths use (wizard and receipt extraction). The manual forms define their own local schemas, so validation itself is not shared (see AUDIT-REPORT SEC-7).

## Where AI code physically lives vs. where it's called from

AI logic never lives inside a component or route file — it is always imported from `src/features/ai/*` into either a client component (as a server action) or the one API route. This is the one architectural convention that should be preserved in any refactor (see [18-reusable-patterns.md](18-reusable-patterns.md), pattern "AI Service Abstraction").
