# ADR 001: Feature-Folder Server Actions Instead of a Layered API/Service Architecture

**Status:** INFERRED (no original design document exists; this ADR reconstructs the decision from the code's structure in [src](../../src/))

## Context

The app needs to call both an LLM provider and a Postgres database from a Next.js App Router frontend, with one feature (chat) requiring token-level streaming.

## Decision (as implemented)

Almost all server-side logic is written as Next.js Server Actions (`"use server"` files under [src/features/](../../src/features/)), called directly from client components as if they were local async functions. There is no separate API layer, no service/repository split, and no shared middleware wrapping these actions. Exactly one traditional REST route exists ([src/app/api/chat/route.ts](../../src/app/api/chat/route.ts)), used only because Server Actions do not fit the raw-`ReadableStream` response this app's chat streaming needs.

## Evidence this was a deliberate (if implicit) choice, not an oversight

- The one place a REST route *was* used is precisely the one place Server Actions were structurally insufficient (streaming) — suggesting the developer defaulted to Server Actions and reached for a route only when forced to.
- Feature folders (`features/ai/`, `features/transaction/`) consistently group by domain, not by technical layer (no `controllers/`, `services/`, `repositories/` folders exist anywhere).

## Consequences

- Fast to build, low boilerplate for a small app.
- No shared place to add cross-cutting concerns (auth, rate limiting, logging) later without touching every file — realized as a real gap in [AUDIT-REPORT.md](../AUDIT-REPORT.md) and [GAP-ANALYSIS.md](../GAP-ANALYSIS.md).
- Business logic (e.g. the tool-calling loop) that's needed in more than one place was duplicated rather than shared, because no service layer existed to hold a shared implementation (see ADR 004).

## Alternatives not taken (inferred, not confirmed as considered)

A layered architecture (routes → services → repositories) would have made cross-cutting concerns and code reuse easier at the cost of more upfront boilerplate for what is, today, a small app. Given the app's actual size, the Server Actions choice is reasonable — see [18-reusable-patterns.md](../18-reusable-patterns.md) for guidance on when to introduce a shared layer instead.
