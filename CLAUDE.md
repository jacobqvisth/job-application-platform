# CLAUDE.md — Job Application Platform

## Project Overview
All-in-one job application command center. Next.js 16 (App Router) + Supabase + Tailwind CSS 4 + shadcn/ui.

## Tech Stack
- **Framework:** Next.js 16 with App Router, TypeScript, `src/` directory
- **Database:** Supabase (Postgres + Auth + Storage) — project ref: `gvfixrxpwmdslsiftmtv`
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York style, Zinc base)
- **AI:** Anthropic Claude API (Haiku for classification, Sonnet for generation)
- **Hosting:** Vercel (CLI deploys via `vercel --prod --yes`, GitHub auto-deploy disconnected)
- **Auth:** Supabase Auth with Google OAuth
- **Email:** Gmail API (OAuth 2.0, separate from Supabase Auth)
- **PDF:** pdf-parse v1.1.1 (MUST stay on v1 — v2 breaks with DOMMatrix error on Vercel)
- **Export:** @react-pdf/renderer (PDF), docx (DOCX)
- **Testing:** Playwright E2E (26 tests)

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
- API routes should return 400 for user/input errors, not 500
- API routes handle their own auth checks (middleware skips `/api` paths)
- Never import Node.js-only packages (pdf-parse, googleapis, etc.) in client components

## File Structure
```
src/
├── app/           # Next.js App Router pages and layouts
│   ├── (auth)/    # Login page
│   ├── (protected)/dashboard/  # All dashboard pages
│   ├── api/       # API routes (gmail, resume, cron, e2e-login)
│   └── auth/      # OAuth callback
├── components/    # React components (ui/ for shadcn, feature folders)
├── lib/           # Utilities, Supabase clients, data layer, types
│   ├── data/      # Database query functions
│   ├── gmail/     # Gmail sync, auth, classification
│   ├── resume/    # PDF/DOCX generators
│   ├── supabase/  # Supabase client + middleware
│   └── types/     # TypeScript type definitions
└── middleware.ts  # Auth middleware (skips /api and /auth paths)
e2e/               # Playwright E2E tests
├── smoke.spec.ts          # Public page tests (no auth needed)
├── dashboard.spec.ts      # All dashboard pages + navigation
├── profile.spec.ts        # Profile form, save, PDF upload
├── resumes.spec.ts        # Resume list page
├── applications.spec.ts   # Kanban board, add dialog
├── api-health.spec.ts     # API endpoint status codes
├── auth.setup.ts          # Test user creation + login
└── fixtures/              # Test PDF for upload testing
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY     # For E2E test user creation (never expose client-side)
GOOGLE_CLIENT_ID              # Google OAuth client ID
GOOGLE_CLIENT_SECRET          # Google OAuth client secret
NEXT_PUBLIC_APP_URL           # https://job-application-platform-lake.vercel.app
ANTHROPIC_API_KEY             # Claude API key
CRON_SECRET                   # Vercel Cron job auth + E2E login secret
E2E_SECRET                    # E2E test auth (fallback: CRON_SECRET)
TEST_USER_EMAIL               # E2E test user email
```

## Common Commands
```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Run ESLint
npm run test:e2e         # Run full Playwright test suite (26 tests)
npm run test:e2e:smoke   # Quick smoke tests only (3 tests, no auth)
npm run test:e2e:ui      # Interactive Playwright UI
npm run test:e2e:report  # Open HTML test report
```

## Testing
Run E2E tests against production after every deploy:
```bash
TEST_BASE_URL=https://job-application-platform-lake.vercel.app npm run test:e2e
```
All 26 tests should pass. If any fail, fix before moving on.

## Git Workflow
- Commit with clear, descriptive messages
- Push to `main` branch
- Deploy with `vercel --prod --yes` (GitHub auto-deploy is disconnected)
- Run E2E tests after deploy to verify

## Current State (Phase 3 + QA complete)
- Auth: Google OAuth via Supabase ✓
- Dashboard: Sidebar navigation, all pages render ✓
- Applications: Kanban board with drag-and-drop ✓
- Gmail: OAuth connect, sync (Primary only), AI classification, reply drafting ✓
- Profile: Form with all sections, PDF resume import + parse ✓
- Resumes: List, editor, 3 templates (Clean/Modern/Compact), AI tailoring, PDF/DOCX export ✓
- Email sync: Vercel Cron every 5 minutes, keyword pre-filter + Claude classification ✓
- E2E Tests: 26 Playwright tests covering smoke, dashboard, profile, resumes, applications, API ✓

## Database Tables
- `profiles` — user profiles
- `applications` — job applications (kanban)
- `application_events` — timeline events
- `gmail_connections` — Gmail OAuth tokens
- `emails` — synced emails with classification
- `user_profile_data` — resume source data (work history, education, skills, etc.)
- `resumes` — saved resumes (JSONB content, template selection)
