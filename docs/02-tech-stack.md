# Tech Stack

Source: [package.json](../package.json), [tsconfig.json](../tsconfig.json), [next.config.ts](../next.config.ts), [eslint.config.mjs](../eslint.config.mjs), [components.json](../components.json).

## Runtime / framework

| Technology | Version | Notes |
|---|---|---|
| Next.js | 16.2.6 | App Router. `reactCompiler: true` is enabled in [next.config.ts](../next.config.ts). |
| React / React DOM | 19.2.4 | |
| TypeScript | ^5 | `strict: true` in [tsconfig.json](../tsconfig.json). |
| Node middleware entry | — | Next 16 renamed `middleware.ts` to `proxy.ts` ([src/proxy.ts](../src/proxy.ts)) — a breaking change from earlier Next.js versions, called out explicitly in [AGENTS.md](../AGENTS.md). |

## AI provider

| Technology | Version | Purpose |
|---|---|---|
| `@google/genai` | ^2.6.0 | Sole LLM/embedding/image/video SDK. See [04-ai-llm-integration.md](04-ai-llm-integration.md). No other AI provider SDK (no OpenAI, Anthropic, LangChain, Vercel AI SDK) is a dependency. |

## Data / backend

| Technology | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | ^2.105.3 | Postgres client. |
| `@supabase/ssr` | ^0.10.2 | Cookie-based SSR/browser Supabase clients ([src/lib/supabase/](../src/lib/supabase/)). |
| Supabase Postgres + `pgvector` | — | One table, `transactions`, with a `vector(768)` column. See [11-database-and-vector-db.md](11-database-and-vector-db.md). |

There is no ORM (no Prisma, no Drizzle). All queries go through the Supabase JS query builder or a single hand-written SQL RPC function ([migrations/setup-vector.sql](../migrations/setup-vector.sql)).

## Forms / validation

| Technology | Version |
|---|---|
| `react-hook-form` | ^7.75.0 |
| `@hookform/resolvers` | ^5.2.2 (Zod resolver) |
| `zod` | ^4.4.3 |

Zod is used in three separate ways:
- **Client-side form validation**, with local schemas defined in each form component.
- **Validation of AI output and tool arguments**, using the shared `transactionSchema` in [src/constants/transaction-constant.ts](../src/constants/transaction-constant.ts).
- **A Gemini `responseSchema`**, in one place, via `z.toJSONSchema()` ([src/features/ai/wizard.ts](../src/features/ai/wizard.ts)).

The form schemas and `transactionSchema` are independent, and the manual write path does no server-side validation.

## Data fetching / client state

| Technology | Version |
|---|---|
| `@tanstack/react-query` | ^5.100.9 |

`QueryClient` is configured with `staleTime: 60_000` in [src/providers/query-client.tsx](../src/providers/query-client.tsx). All AI calls and DB mutations from client components go through `useMutation`/`useQuery`, not raw `useEffect` fetching.

## UI

| Technology | Version | Notes |
|---|---|---|
| `radix-ui` | ^1.6.7 | Primitives, wrapped by shadcn-generated components in [src/components/ui/](../src/components/ui/). |
| `shadcn` (CLI) | ^4.7.0 | Config in [components.json](../components.json): style `radix-luma`, base color `mist`. |
| `lucide-react` | ^1.47.0 | Icon set. |
| `tailwindcss` | ^4 (via `@tailwindcss/postcss`) | |
| `tw-animate-css` | ^1.4.0 | |
| `recharts` | ^3.8.1 | Renders AI-generated chart data (bar/pie) in [generative-content.tsx](../src/app/dashboard/_components/generative-content.tsx). |
| `react-markdown` | ^10.1.0 | Renders AI chat/wizard text responses. |
| `sonner` | ^2.0.8 | Toast notifications for AI mutation success/error. |
| `vaul` | ^1.1.2 | Drawer primitive used by the chat drawer. |
| `next-themes` | ^0.4.6 | Used only by `useTheme()` in [sonner.tsx](../src/components/ui/sonner.tsx). No `ThemeProvider` is mounted in [layout.tsx](../src/app/layout.tsx), and there is no theme toggle, so theme switching is not implemented. |
| `cn` | ^0.3.3 | npm package whose `package.json` points to `shadcn-ui/cn`. The shadcn primitives in `src/components/ui/*` import `cn` from it. App code uses its own `cn` from [lib/utils.ts](../src/lib/utils.ts) (clsx + tailwind-merge), so two implementations exist (AUDIT-REPORT COR-15). |
| `react-day-picker` / `date-fns` | ^10.0.1 / ^4.4.0 | Date picker for transaction forms. |

## Tooling

| Technology | Version |
|---|---|
| ESLint | ^9, `eslint-config-next` 16.2.6 (flat config) |
| `babel-plugin-react-compiler` | 1.0.0 |

No test runner (Jest/Vitest/Playwright/Cypress) is present in `devDependencies`. No Prettier config was found. Package manager is npm (`package-lock.json` is the only lockfile present).

## Explicitly absent

These are commonly expected in an "AI SaaS" stack but are **not** dependencies of this project — do not assume they exist when reading other docs in this set:

- Vercel AI SDK (`ai` package) — streaming is hand-rolled instead (see [13-backend-patterns.md](13-backend-patterns.md)).
- Any vector-DB-as-a-service (Pinecone, Weaviate, Qdrant) — vector search is pgvector inside the same Postgres instance.
- Any agent framework (LangChain, LlamaIndex, OpenAI Agents SDK, Mastra) — see [09-ai-agent-tools.md](09-ai-agent-tools.md).
- Any observability/monitoring SDK (Sentry, PostHog, OpenTelemetry).
- Any auth provider beyond Supabase's own (no NextAuth/Clerk/Auth.js).
