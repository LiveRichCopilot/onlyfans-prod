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
