# CLAUDE.md — Job Application Platform

## Project Overview
All-in-one job application command center. Next.js 15 (App Router) + Supabase + Tailwind CSS 4 + shadcn/ui.

## Tech Stack
- **Framework:** Next.js 15 with App Router, TypeScript, `src/` directory
- **Database:** Supabase (Postgres + Auth + Storage) — project ref: `gvfixrxpwmdslsiftmtv`
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York style, Zinc base)
- **AI:** Anthropic Claude API
- **Hosting:** Vercel (auto-deploys from GitHub)
- **Auth:** Supabase Auth with Google OAuth

## Permissions
You have full permission to:
- Create, edit, and delete any files in this project
- Run any npm/npx commands (install, build, dev, lint, etc.)
- Run any git commands (commit, push, pull, branch, etc.)
- Run any shell commands needed for development
- Create and modify database migration files in `supabase/migrations/`

Do NOT run database migrations against Supabase directly — create migration SQL files and they will be applied via Supabase MCP separately.

## Coding Conventions
- Use server components by default, client components only where needed
- Use server actions for mutations
- All database queries through Supabase client, respecting RLS
- Error handling with toast notifications
- Loading states with skeletons/spinners
- Responsive design (desktop + mobile)
- Clean, professional UI — "Notion meets Linear" aesthetic
- Use Tailwind utility classes and shadcn components throughout
- TypeScript strict mode, no `any` types

## File Structure
```
src/
├── app/           # Next.js App Router pages and layouts
├── components/    # React components (ui/ for shadcn, feature folders for the rest)
├── lib/           # Utilities, Supabase clients, data layer, types
└── middleware.ts  # Auth middleware
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anonymous key
GOOGLE_CLIENT_ID              # Google OAuth client ID (same as Supabase OAuth)
GOOGLE_CLIENT_SECRET          # Google OAuth client secret
NEXT_PUBLIC_APP_URL           # App URL (https://job-application-platform-lake.vercel.app)
ANTHROPIC_API_KEY             # Anthropic API key for email classification and reply drafting
CRON_SECRET                   # Secret for Vercel Cron job authentication
```

## Common Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
```

## Git Workflow
- Commit with clear, descriptive messages
- Push to `main` branch (Vercel auto-deploys)
- No need to ask permission for git operations
