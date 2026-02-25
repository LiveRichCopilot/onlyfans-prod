# Project Rules

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
