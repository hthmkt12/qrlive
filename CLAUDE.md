# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: QRLive — Dynamic QR Code Link Shortener

React 18 + TypeScript + Vite frontend with Supabase backend (Auth, Postgres, Edge Functions on Deno). Deployed to Vercel (frontend) + Supabase (backend). UI is Vietnamese-localized.

## Key Commands

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # Production build
npm run typecheck    # TypeScript type checking (no emit)
npm run lint         # ESLint
npm run test         # Vitest test suite (199 tests)
npm run test:watch   # Watch mode

# Supabase edge functions
supabase functions deploy redirect --no-verify-jwt

# Proxy gateway (optional bypass feature)
npm run gateway:dev
npm run gateway:test
```

Run a single test file: `npx vitest run src/test/schemas.test.ts`

## Architecture

### Data Flow

```
Browser → Vercel (React SPA) → Supabase (Auth + DB)
QR scan → Supabase Edge Function (redirect/{shortCode}) → 302 to target URL
```

### Frontend Structure

- **`src/App.tsx`** — root with providers: ThemeProvider, QueryClientProvider, AuthProvider, BrowserRouter. Three routes: `/auth`, `/` (protected), `*` (NotFound).
- **`src/contexts/auth-context.tsx`** — Supabase Auth session management; resolves loading state to prevent flash.
- **`src/hooks/use-links.ts`** — TanStack Query hook fetching `qr_links` with analytics summaries.
- **`src/hooks/use-link-mutations.ts`** — create/update/delete mutations with query invalidation.
- **`src/lib/db.ts`** — barrel re-export; actual logic split into:
  - `src/lib/db/models.ts` — TypeScript interfaces (QRLinkRow, GeoRouteRow, ClickEventRow, analytics rows)
  - `src/lib/db/queries.ts` — read operations (fetchLinks, fetchLinkAnalyticsSummaries, fetchLinkAnalyticsDetail)
  - `src/lib/db/mutations.ts` — write operations (createLinkInDB, updateLinkInDB, updateGeoRoutesInDB, deleteLinkInDB, generateShortCode)
  - `src/lib/db/utils.ts` — getRedirectUrl, normalizeAnalyticsRows
- **`src/lib/schemas.ts`** — Zod schemas for form validation (link creation/editing, auth).
- **`src/lib/query-keys.ts`** — centralized TanStack Query key factory.

### Edge Function (`supabase/functions/redirect/index.ts`)

Deno runtime. Handles all QR code redirect requests:
1. Validates short code format (`^[A-Z0-9_-]{3,20}$`)
2. Checks link expiration (`expires_at`)
3. Serves password form (GET) or verifies password (POST) for protected links — PBKDF2-HMAC-SHA256 (new) with legacy SHA-256 backward compat
4. Determines redirect target: `bypass_url → geo target_url → default_url` (country via `cf-ipcountry` header)
5. Rate-limits clicks (1 per IP per 60s), filters bots, records click events
6. Returns 302 with `Cache-Control: no-store`

Uses service role key (bypasses RLS) for `click_events` INSERT.

### Database Schema (Supabase Postgres)

- `qr_links` — user's links (short_code, default_url, is_active, expires_at, password_hash, password_salt, has_password)
- `geo_routes` — per-link country routing (country_code, target_url, bypass_url)
- `click_events` — analytics raw events (link_id, country_code, ip_address, referer, user_agent)
- RLS on all tables; owner-only access for user data; service role for click_events INSERT
- Atomic geo route updates via Postgres RPC function (`update_geo_routes`)
- Analytics via server-side RPCs: `get_link_click_summaries`, `get_link_click_detail`

### Password Protection

- Client: `src/lib/password-utils.ts` — PBKDF2-HMAC-SHA256 (600k iterations, Web Crypto API). Self-describing hash format; legacy SHA-256 backward compat.
- Edge function: verifies submitted password via constant-time comparison; opportunistically rehashes legacy SHA-256 to PBKDF2 on success.
- `password_hash` / `password_salt` never returned to frontend by `fetchLinks` (server-side `has_password` generated column instead).

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.claude/rules/primary-workflow.md`
- Development rules: `./.claude/rules/development-rules.md`
- Orchestration protocols: `./.claude/rules/orchestration-protocol.md`
- Documentation management: `./.claude/rules/documentation-management.md`
- And other workflows: `./.claude/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You must follow strictly the development rules in `./.claude/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read the `./README.md` file first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

**Example AskUserQuestion call:**
```json
{
  "questions": [{
    "question": "I need to read \".env\" which may contain sensitive data. Do you approve?",
    "header": "File Access",
    "options": [
      { "label": "Yes, approve access", "description": "Allow reading .env this time" },
      { "label": "No, skip this file", "description": "Continue without accessing this file" }
    ],
    "multiSelect": false
  }]
}
```

**IMPORTANT:** Always ask the user via `AskUserQuestion` first. Never try to work around the privacy block without explicit user approval.

## Python Scripts (Skills)

When running Python scripts from `.claude/skills/`, use the venv Python interpreter:
- **Linux/macOS:** `.claude/skills/.venv/bin/python3 scripts/xxx.py`
- **Windows:** `.claude\skills\.venv\Scripts\python.exe scripts\xxx.py`

This ensures packages installed by `install.sh` (google-genai, pypdf, etc.) are available.

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

**IMPORTANT:** *MUST READ* and *MUST COMPLY* all *INSTRUCTIONS* in project `./CLAUDE.md`, especially *WORKFLOWS* section is *CRITICALLY IMPORTANT*, this rule is *MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!*