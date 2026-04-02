# CLAUDE.md — Job Application Platform

## Project Overview
All-in-one job application command center. Next.js 16 (App Router) + Supabase + Tailwind CSS 4 + shadcn/ui.

## Tech Stack
- **Framework:** Next.js 16 with App Router, TypeScript, `src/` directory
- **Database:** Supabase (Postgres + Auth + Storage) — project ref: `gvfixrxpwmdslsiftmtv`
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York style, Zinc base)
- **AI:** Anthropic Claude API (Haiku for classification, Sonnet for generation)
- **Hosting:** Vercel (CLI deploys via `vercel --prod --yes`, GitHub auto-deploy disconnected)
- **Auth:** Supabase Auth with Google OAuth + LinkedIn OIDC
- **Email:** Gmail API (OAuth 2.0, separate from Supabase Auth)
- **PDF:** pdf-parse v1.1.1 (MUST stay on v1 — v2 breaks with DOMMatrix error on Vercel)
- **Export:** @react-pdf/renderer (PDF), docx (DOCX)
- **Testing:** Playwright E2E (111 tests)

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
│   │   ├── actions/            # Shared server actions (email-actions, etc.)
│   │   ├── answers/            # Answer Library
│   │   ├── applications/       # Kanban board
│   │   ├── chat/               # AI chat interface
│   │   ├── draft/              # Cover letter drafting
│   │   ├── emails/             # Gmail inbox
│   │   ├── extension/          # Chrome extension settings
│   │   ├── job-leads/          # Job leads pipeline
│   │   ├── jobs/               # Job discovery (Platsbanken + Adzuna)
│   │   ├── knowledge/          # Knowledge system
│   │   ├── profile/            # User profile + resume import
│   │   ├── resumes/            # Resume editor + templates
│   │   ├── review/             # Application review
│   │   └── settings/           # Market + account settings
│   ├── api/       # API routes
│   │   ├── answers/            # Answer library endpoints
│   │   ├── application/        # Application CRUD
│   │   ├── chat/               # Chat streaming + tools
│   │   ├── context-sidebar/    # Context sidebar data
│   │   ├── cron/               # Vercel cron jobs
│   │   ├── e2e-login/          # E2E test auth
│   │   ├── emails/             # Email sync + actions
│   │   ├── extension/          # Chrome extension API
│   │   ├── gmail/              # Gmail OAuth + sync
│   │   ├── job-email-sources/  # Learned email source patterns
│   │   ├── jobs/               # Job search (Platsbanken/Adzuna)
│   │   ├── linkedin/           # LinkedIn OAuth
│   │   └── resume/             # Resume parse + generate
│   └── auth/      # OAuth callback
├── components/    # React components
│   ├── answers/   # Answer library components
│   ├── applications/  # Kanban board components
│   ├── chat/      # Chat UI + message components
│   ├── dashboard/ # Dashboard layout components
│   ├── draft/     # Cover letter composer
│   ├── emails/    # Email list + detail
│   ├── extension/ # Extension settings UI
│   ├── job-leads/ # Job leads pipeline UI
│   ├── jobs/      # Job discovery UI
│   ├── knowledge/ # Knowledge system UI
│   ├── layout/    # Nav rail, context sidebar, shared layout
│   ├── profile/   # Profile form sections
│   ├── resumes/   # Resume editor + template components
│   ├── review/    # Review UI
│   ├── settings/  # Settings UI
│   ├── share/     # LinkedIn share components
│   └── ui/        # shadcn/ui primitives
├── lib/           # Utilities, Supabase clients, data layer, types
│   ├── chat/      # Chat tools, flow context, adaptive intelligence
│   ├── data/      # Database query functions
│   ├── gmail/     # Gmail sync, auth, classification
│   ├── jobs/      # Job search clients (Platsbanken, Adzuna)
│   ├── knowledge/ # Knowledge system logic
│   ├── linkedin/  # LinkedIn OAuth + share API
│   ├── markets/   # Multi-market settings (SE/NO/GB/US/DE)
│   ├── resume/    # PDF/DOCX generators, templates
│   ├── supabase/  # Supabase client + middleware
│   ├── types/     # TypeScript type definitions
│   └── utils/     # Shared utilities
└── middleware.ts  # Auth middleware (skips /api and /auth paths)
e2e/               # Playwright E2E tests (111 tests, 12 spec files)
├── smoke.spec.ts          # Public page tests (no auth needed)
├── dashboard.spec.ts      # All dashboard pages + navigation
├── profile.spec.ts        # Profile form, save, PDF upload
├── resumes.spec.ts        # Resume list + editor
├── applications.spec.ts   # Kanban board, add dialog
├── api-health.spec.ts     # API endpoint status codes
├── draft.spec.ts          # Cover letter drafting
├── jobs.spec.ts           # Job discovery
├── job-leads.spec.ts      # Job leads pipeline
├── knowledge.spec.ts      # Knowledge system
├── market-settings.spec.ts # Market settings
├── extension-api.spec.ts  # Extension API endpoints
├── auth.setup.ts          # Test user creation + login
├── auth.teardown.ts       # Test user cleanup
└── fixtures/              # Test PDF for upload testing
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY     # For E2E test user creation (never expose client-side)
GOOGLE_CLIENT_ID              # Google OAuth client ID
GOOGLE_CLIENT_SECRET          # Google OAuth client secret
LINKEDIN_CLIENT_ID            # LinkedIn OAuth client ID
LINKEDIN_CLIENT_SECRET        # LinkedIn OAuth client secret
ANTHROPIC_API_KEY             # Claude API key
ADZUNA_APP_ID                 # Adzuna job search API ID
ADZUNA_APP_KEY                # Adzuna job search API key
NEXT_PUBLIC_APP_URL           # https://job-application-platform-lake.vercel.app
CRON_SECRET                   # Vercel Cron job auth + E2E login secret
E2E_SECRET                    # E2E test auth (fallback: CRON_SECRET)
TEST_USER_EMAIL               # E2E test user email
```

## Common Commands
```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Run ESLint
npm run test:e2e         # Run full Playwright test suite (111 tests)
npm run test:e2e:smoke   # Quick smoke tests only (3 tests, no auth)
npm run test:e2e:ui      # Interactive Playwright UI
npm run test:e2e:report  # Open HTML test report
```

## Testing
Run E2E tests against production after every deploy:
```bash
TEST_BASE_URL=https://job-application-platform-lake.vercel.app npm run test:e2e
```
All 111 tests should pass. If any fail, fix before moving on.

## Git Workflow
- Commit with clear, descriptive messages
- Push to `main` branch
- Deploy with `vercel --prod --yes` (GitHub auto-deploy is disconnected)
- Run E2E tests after deploy to verify

## Current State (Phase H1 complete)
- **Auth:** Google OAuth + LinkedIn OIDC via Supabase ✓
- **Layout:** Three-panel — icon nav rail (left) + conversational canvas (center) + context sidebar (right, collapsible). Mobile: bottom tab bar ✓
- **Applications:** Kanban board with drag-and-drop, AI job scoring ✓
- **Gmail:** OAuth connect, sync (Primary only), AI classification (7 categories incl. `job_alert`), reply drafting, full `body_text` storage ✓
- **Email sync:** Vercel Cron every 5 minutes, keyword pre-filter + Claude classification ✓
- **Profile:** Form with all sections, PDF resume import + parse, LinkedIn PDF import with merge UI ✓
- **Resumes:** List, editor, 3 templates (Clean/Modern/Compact), AI tailoring, PDF/DOCX export, Swedish CV + Personligt Brev ✓
- **Answer Library:** Canonical questions, answer variants, rating/tone, orphan linking, auto-categorize ✓
- **Knowledge System:** Document upload, AI interview, profile summary ✓
- **Chat:** 14+ tools, morning brief, smart suggestions, flow context system, adaptive intelligence (stage detection, pattern detection), conversation persistence ✓
- **Job Discovery:** JobTechDev API (Platsbanken) for Swedish jobs, Adzuna for international, saved searches with daily cron ✓
- **Job Leads Pipeline:** Email extraction (manual + auto), approve/reject with bulk actions, learned sources, preference analysis (Sonnet), rule-based scoring, auto-approve for trusted sources ✓
- **Extension:** Chrome MV3 — Greenhouse, Lever, Workday, Teamtailor, Varbi, Jobylon, ReachMee, LinkedIn (ShadowDOM sidebar, search page save, Easy Apply detection, match scoring, Varbi Quick Apply, Jobylon screening, ReachMee cover letter autofill) ✓
- **LinkedIn:** Enhanced extension, PDF profile import (EN+SV), Sign in with LinkedIn (OIDC), OAuth Share API (milestones), `shareOnLinkedIn` chat tool ✓
- **Multi-market:** SE/NO/GB/US/DE market settings ✓
- **Design:** Nexus-inspired light UI, deep purple #5347CE primary, Inter font ✓
- **Tests:** 111 Playwright E2E tests (12 spec files) ✓

## Database Tables
- `profiles` — user profiles
- `applications` — job applications (kanban)
- `application_events` — timeline events
- `gmail_connections` — Gmail OAuth tokens
- `emails` — synced emails with classification + body_text
- `user_profile_data` — resume source data (work history, education, skills)
- `resumes` — saved resumes (JSONB content, template selection)
- `canonical_questions` — library of canonical screening questions
- `screening_answers` — answer variants linked to canonical questions
- `job_listings` — job listings with lead status, scoring, auto-approve
- `saved_searches` — saved job searches for daily cron
- `form_field_mappings` — ATS form field mappings for extension
- `interview_prep_packs` — interview preparation materials
- `interview_sessions` — knowledge system interview sessions
- `chat_conversations` — chat conversation metadata
- `chat_messages` — individual chat messages
- `chat_interactions` — adaptive intelligence interaction tracking
- `knowledge_items` — knowledge system items
- `knowledge_profile_summary` — AI-generated profile summaries
- `uploaded_documents` — uploaded document metadata
- `linkedin_connections` — LinkedIn OAuth connections
- `user_market_settings` — multi-market preferences (SE/NO/GB/US/DE)
- `job_listing_sources` — job listing source tracking
- `job_email_sources` — learned email sender patterns for job alerts
- `job_lead_preferences` — AI-analyzed job lead preferences
