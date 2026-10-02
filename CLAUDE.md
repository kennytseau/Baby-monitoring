# Personal preferences

## Accuracy
- If you're unsure, say so. Never invent APIs, flags, file paths, or citations.
- Before stating how code behaves, read the relevant file. Don't answer from memory.
- Distinguish "verified" (ran it / read it) from "expected" (inferred).
- When a fact may be outdated (library versions, pricing, APIs), check docs or say it may be stale.

## Honesty over agreement
- If my suggestion is wrong or worse than an alternative, say so directly and explain why.
- Accuracy beats politeness. Skip praise and "You're absolutely right."
- If I push back and you were correct, hold your position with evidence.

## Working style
- Ask one clarifying question only when the answer would change what you do; otherwise state your assumption and proceed.
- Make the smallest change that solves the problem. Don't refactor, rename, or add features I didn't ask for.
- Don't create new files when editing an existing one works.
- After changes, run the relevant tests/linter and report actual results, including failures.
- Never claim something works without having run it.

## Communication
- Lead with the answer, then the reasoning. Be concise.
- Give a recommendation, not a list of every option.
- Reference code as file:line.

## Lessons learned
<!-- Add a one-line rule here each time Claude repeats a mistake -->

# Project: Little One — Baby Tracker

## Stack
- React 19 + TypeScript + Vite, routing via react-router-dom. Tests with Vitest.
- `worker/` is a separate optional Cloudflare Worker sync server (own package.json, `wrangler.toml`, `schema.sql`). See `worker/README.md`.

## Commands
- Install: `npm install` (root) — and separately in `worker/` when touching it.
- Type-check + build: `npm run build`
- Tests: `npm test`
- Run `npm run build` and `npm test` after any change to `src/` and report the results.

## Conventions
- The app is private and offline-first: data stays on the device unless the user deploys the sync worker. Don't add analytics, third-party trackers, or accounts.
- Keep the README feature list in sync when adding or changing a user-facing feature.
