# Project Rules

## OWNER CONTEXT — Read this first
- The owner operates entirely by voice. No manual code edits. No manual terminal commands. No manual env var changes.
- All code, config, deployments, and debugging are handled by Claude (terminal or web).
- Never say "you added" or "you changed" — the owner does not touch code or settings directly.
- If something is misconfigured, Claude did it or it was already there. Investigate and fix it, don't blame the owner.
- Push directly to `main` via `github-direct` remote. The proxy remote blocks `main` pushes — always use `github-direct`.

## HARD RULES — Never break these

### 1. One branch only: `main`
- All work goes directly on `main`. No feature branches. No PRs.
- Build one thing at a time. Push it. Move on.
- Every push should leave the site working. Never push broken code.

### 2. No file over 400 lines
- Every page, every component, every button gets its own file.
- If a file is approaching 400 lines, split it up before adding more.
- Check line counts before committing.

### 3. One thing at a time
- Work on one button, one feature, one add-on at a time.
- Finish it. Test it. Push it. Then start the next thing.
- Don't batch up multiple features in one go.

### 4. Don't break what's working
- Read existing code before changing anything.
- If the page is working, don't touch things that aren't related to the current task.
- Keep changes minimal and focused.

### 5. Cloud database only — never local
- Always use the real cloud Supabase/PostgreSQL database. Never local databases.
- Database migrations must run against production (via `prisma db push` in the build script).
- Never attempt to run Prisma commands locally without POSTGRES_URL — all DB operations happen through Vercel deployments.
- Store real data only. No mock data, no local dev databases.

## AI Models — Rulebook (Feb 2026)

### Current model assignments
| File | Model | Provider | Why |
|------|-------|----------|-----|
| `lib/ai-classifier.ts` | `gpt-5-mini` | OpenAI | Fast classification, JSON output |
| `lib/ai-closing-hints.ts` | `gpt-5-mini` | OpenAI | Speed matters for live hints |
| `lib/ai-ghost-writer.ts` | `gpt-5-mini` | OpenAI | Creative writing, fast |
| `lib/ai-vault-tagger.ts` | `gpt-5-mini` | OpenAI | Quick tagging |
| `lib/chatter-scoring-prompt.ts` | `kimi-k2.5` | Moonshot | 256K context for long convos, cheap bulk scoring |
| `lib/chatter-story-analyzer.ts` | `kimi-k2.5` | Moonshot | 256K context for story analysis |
| `lib/ai-revenue.ts` | `gpt-5.2` | OpenAI | Flagship model, strong math reasoning |
| `app/api/inbox/qa-score/route.ts` | `gpt-5-mini` | OpenAI | QA review scoring |
| `app/api/cron/follow-ups/route.ts` | `gpt-5-mini` | OpenAI | Follow-up message generation |

### Cost tiers
- **gpt-5-mini** ($0.25/M in, $2/M out) — fast, cheap, for well-defined tasks
- **kimi-k2.5** ($0.60/M in, $3/M out) — huge 256K context, cheap for bulk analytical work
- **gpt-5.2** (flagship pricing) — only for tasks needing top-tier reasoning

### Rules
- **Never revert model upgrades without first verifying model names are valid** on platform.openai.com/docs/models or platform.moonshot.ai
- **Never downgrade back to deprecated models** (gpt-4o-mini, gpt-4o are retired Feb 2026)
- OpenAI base URL: `https://api.openai.com/v1/chat/completions` with `OPENAI_API_KEY`
- Moonshot base URL: `https://api.moonshot.ai/v1/chat/completions` with `MOONSHOT_API_KEY`
- Kimi calls need `thinking: { type: "disabled" }` for structured JSON output

## Tech stack
- Next.js (App Router) + Tailwind CSS + Prisma + PostgreSQL
- iOS 26 Liquid Glass design system (see `app/globals.css`)
- UK timezone for all time calculations
- Auth via NextAuth with Google provider
- Roles: AGENCY, CFO, EMPLOYEE, UNASSIGNED

## Styling
- Use existing glass classes: `glass-panel`, `glass-card`, `glass-button`, `glass-prominent`, `glass-inset`
- Dark theme only. White text on dark backgrounds.
- Teal accent color for positive/active states.
- Proxy avatars through `/api/proxy-media?url=...`
