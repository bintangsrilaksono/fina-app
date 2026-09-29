# Project Overview

## What this repository is

This repository, [fina-app](../), holds a Next.js 16 application named **Fina** ("Your personal finance app with AI"; see [src/app/page.tsx](../src/app/page.tsx)). It is the sole implementation artifact of the "AI Powered Apps Fundamental" curriculum. These docs live in the repository's `docs/` folder, alongside the code they describe.

`fina-app` is a personal finance tracker for a single user persona (see the chatbot system prompt in [src/features/ai/chat.ts](../src/features/ai/chat.ts): Indonesian entrepreneurs aged 18–30 earning Rp 30–60 million/month) that layers several Google Gemini AI capabilities on top of ordinary CRUD financial-transaction management:

- A streaming AI chat advisor with two modes (general financial advice, and personal RAG-grounded Q&A over the user's own transactions).
- A "wizard" input that turns free text or a voice recording into a transaction record, using tool-calling to read/create/update/delete data.
- Receipt scanning (image/PDF) that extracts a transaction via a vision model.
- Generative dashboard insights: AI-generated charts (structured JSON), AI-generated images, and AI-generated videos summarizing the user's spending.

## Purpose of this documentation set

This `docs/` tree is a **reference extraction**, not marketing copy. Every claim in it is traceable to a file in [fina-app](../). Its two audiences are:

1. Anyone who needs to understand *this* app's actual current behavior (not what the course intended, not what would be nice to have).
2. Future AI-application projects that want to reuse the patterns proven out here — see [18-reusable-patterns.md](18-reusable-patterns.md) and [AI-APPS-ENGINEERING-PLAYBOOK.md](AI-APPS-ENGINEERING-PLAYBOOK.md).

Status labels used throughout (`IMPLEMENTED`, `PARTIALLY IMPLEMENTED`, `NOT IMPLEMENTED`) always describe the code as of the last read at documentation time, not the course curriculum's aspirations.

## One-paragraph architecture summary

Fina is a single Next.js App Router project. AI calls go through one thin factory ([src/features/ai/instance.ts](../src/features/ai/instance.ts)) directly to the `@google/genai` SDK — there is no provider-abstraction layer, so every AI feature is coupled to Gemini. Persistence is Supabase Postgres with the `pgvector` extension enabled on one table (`transactions`). Retrieval-augmented generation is implemented by embedding each transaction on write and running a cosine-similarity RPC (`match_transactions`) at query time. Tool/function calling is hand-rolled (a `while` loop around `generateContent`/`generateContentStream` that inspects `functionCalls` and feeds `functionResponse` parts back in) rather than built on an agent framework. Authentication scaffolding exists (Supabase SSR clients, a proxy/middleware) but route protection is commented out and Row-Level Security is set to permissive (`USING (true)`), so today the app has no enforced multi-tenancy — see [15-security.md](15-security.md).

## Known scope limits (do not assume otherwise)

- No automated tests exist anywhere in the repository.
- No CI/CD configuration exists (no `.github/workflows`, no `vercel.json`, no Dockerfile).
- No Supabase CLI project (`supabase/` folder) — the two SQL files in [migrations/](../migrations/) are run manually.
- No login/signup page exists despite auth client scaffolding.
- Curriculum topics "Introduction", "Setup Environment", and "Road To AI Apps" have no dedicated code artifacts — they map to no files (see [COURSE-TO-CODE-MAPPING.md](COURSE-TO-CODE-MAPPING.md)).

## Reading order

Start with [README.md](README.md) for the full documentation index and recommended reading order.
