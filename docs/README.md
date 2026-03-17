# QRLive Documentation Index

Welcome to the QRLive documentation repository. All files provide comprehensive guidance for development, deployment, and project management.

---

## Documentation Files

### 1. [README.md](../README.md) — Project Overview
**Audience**: Everyone (GitHub visitors, stakeholders, new team members)
**Purpose**: Quick introduction with features, stack, setup, and quick commands
**Start here** if you're new to the project.

---

### 2. [project-overview-pdr.md](./project-overview-pdr.md) — Project Definition & Requirements
**Audience**: Architects, product managers, stakeholders
**Purpose**: Comprehensive project definition with goals, features, user stories, requirements
**Read this** to understand what QRLive does and why.

---

### 3. [system-architecture.md](./system-architecture.md) — Technical Architecture
**Audience**: Architects, senior developers, DevOps
**Purpose**: Deep dive into system design, data flow, database schema, and components
**Read this** to understand how QRLive works internally.

---

### 4. [code-standards.md](./code-standards.md) — Development Standards & Patterns
**Audience**: Developers writing code
**Purpose**: Practical reference for writing code that fits QRLive standards
**Read this** before implementing features or fixing bugs.

---

### 5. [deployment-guide.md](./deployment-guide.md) — Step-by-Step Deployment
**Audience**: DevOps, operations, developers deploying changes
**Purpose**: Copy-paste deployment guide for all environments
**Read this** before deploying to development, staging, or production.

---

### 6. [project-roadmap.md](./project-roadmap.md) — Status, Progress & Future Plans
**Audience**: Project managers, team leads, stakeholders
**Purpose**: Track project status, completed features, known issues, and future roadmap
**Read this** to understand what's done, what's planned, and what's blocked.

---

### 7. [codebase-summary.md](./codebase-summary.md) — Quick Reference Guide
**Audience**: Developers, LLMs, AI assistants
**Purpose**: Fast lookup reference for the entire codebase
**Read this** when you need quick answers about the codebase.

---

### 8. [openapi.yaml](./openapi.yaml) - API & Webhook Contract
**Audience**: Integrators, backend developers, QA, tooling
**Purpose**: Machine-readable OpenAPI 3.1 spec for redirect endpoints, proxy surfaces, and the `click.created` webhook payload
**Read this** when you need request/response schemas, headers, or webhook examples.

---

## Quick Start Paths

### I'm a New Developer
1. Read [README.md](../README.md) (5 min)
2. Read [codebase-summary.md](./codebase-summary.md) (10 min)
3. Follow "Development Setup" in [deployment-guide.md](./deployment-guide.md) (15 min)
4. Read [code-standards.md](./code-standards.md) (20 min)
5. Start coding!

**Total**: ~50 minutes

### I'm an Architect
1. Read [project-overview-pdr.md](./project-overview-pdr.md) (15 min)
2. Read [system-architecture.md](./system-architecture.md) (25 min)
3. Review [project-roadmap.md](./project-roadmap.md) for evolution plans (10 min)

**Total**: ~50 minutes

### I'm Deploying This Project
1. Read [README.md](../README.md) (5 min)
2. Follow [deployment-guide.md](./deployment-guide.md) step-by-step (60 min)
3. Reference troubleshooting section if needed

**Total**: ~65 minutes

### I'm Contributing to This Project
1. Read [code-standards.md](./code-standards.md) (20 min)
2. Read [system-architecture.md](./system-architecture.md) for context (15 min)
3. Check [project-roadmap.md](./project-roadmap.md) for what's planned (5 min)
4. Make changes following standards
5. Run tests: `npm run test`

**Total**: ~40 minutes + implementation

---

## File Statistics

- 8 core documentation files plus a machine-readable OpenAPI spec
- Human-readable status and architecture live in Markdown under `docs/`
- HTTP contract and webhook payload schemas live in `docs/openapi.yaml`
- For the latest project metrics, use [codebase-summary.md](./codebase-summary.md)

All files under 800 LOC limit ✅

---

## Key Concepts

### QRLive in One Sentence
A production-ready web app that creates short, scannable QR links routing visitors to different URLs based on geographic location, with detailed analytics.

### Core Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **State**: React Query v5
- **Forms**: react-hook-form + Zod
- **Backend**: Supabase (Postgres + Auth + Edge Functions)
- **Deploy**: Vercel (frontend) + Supabase (backend)

### Key Features
1. Email/password auth (signup, login, logout)
2. QR link management (create, edit, delete)
3. Geo-routing (15 countries)
4. Bypass URLs (for geo-blocking)
5. Click analytics (charts, stats, referers)
6. Vietnamese UI with dark/light theme
7. Rate limiting (1 click/IP/60s)
8. Bot filtering (crawlers excluded)
9. RLS security (data isolation)
10. URL validation (no injection attacks)

### Key Metrics
- **Status**: MVP complete, production-ready
- **Tests**: 308 unit/integration passing + 30 Playwright E2E
- **Live**: https://qrlive.vercel.app
- **Load Time**: ~1.5s
- **Redirect Latency**: ~50ms
- **Uptime**: 100% (current)
- **Known Issues**: analytics rollups and deployed webhook monitoring remain the main follow-ups

---

## How to Use This Documentation

### For Daily Development
- Reference [code-standards.md](./code-standards.md) for patterns
- Check [codebase-summary.md](./codebase-summary.md) for quick lookups
- Use [system-architecture.md](./system-architecture.md) for data flow

### For Deployment
- Follow [deployment-guide.md](./deployment-guide.md) step-by-step
- Use troubleshooting section for common issues
- Reference checklist before going live

### For Planning
- Review [project-roadmap.md](./project-roadmap.md) for status
- Check [project-overview-pdr.md](./project-overview-pdr.md) for requirements
- Plan new features against roadmap

### For API Integration
- Start with [openapi.yaml](./openapi.yaml)
- Cross-check behavior details in [system-architecture.md](./system-architecture.md)
- Use [deployment-guide.md](./deployment-guide.md) for environment and secret setup

### For Onboarding
- New developers start with Quick Start path above
- Share relevant docs based on role
- Use codebase-summary.md as LLM context

---

## Updating Documentation

When code changes:

1. **Features Added**: Update project-roadmap.md
2. **Architecture Changes**: Update system-architecture.md
3. **Code Patterns Change**: Update code-standards.md
4. **Deployment Changes**: Update deployment-guide.md
5. **Project Scope Changes**: Update project-overview-pdr.md
6. **Everything**: Update codebase-summary.md
7. **HTTP Contract Changes**: Update openapi.yaml

Keep docs in sync with code — don't let them fall out of date.

---

## Support & Questions

- **About the project?** → project-overview-pdr.md
- **About the code?** → system-architecture.md
- **Writing code?** → code-standards.md
- **Deploying?** → deployment-guide.md
- **What's planned?** → project-roadmap.md
- **Quick answer?** → codebase-summary.md
- **Stuck?** → deployment-guide.md troubleshooting

---

## Resources

- **Repository**: https://github.com/hthmkt12/qrlive
- **Live App**: https://qrlive.vercel.app
- **Supabase**: https://app.supabase.com/projects
- **Vercel**: https://vercel.com/dashboard
- **Docs**: https://supabase.com/docs, https://react.dev

---

**Last Updated**: 2026-03-17 | **Status**: Complete & Production-Ready
