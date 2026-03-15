# Custom Short Code Feature

**Date:** 2026-03-16 | **Status:** Ready to implement
**Complexity:** Simple — 4 files, no migration needed

---

## Overview

Allow users to optionally set a custom short code when creating a link.
If left blank, system auto-generates a 6-char random code (current behavior).

**Rules:**
- Format: `[A-Za-z0-9_-]{3,20}` (alphanumeric + hyphen/underscore, 3–20 chars)
- Stored as UPPERCASE for consistency with auto-generated codes
- Uniqueness checked on submit (not real-time — KISS)
- DB column `short_code` already exists, no migration needed

---

## Phase Overview

| # | Phase | File | Status |
|---|-------|------|--------|
| 1 | [Schema validation](./phase-01-schema.md) | `src/lib/schemas.ts` | Todo |
| 2 | [DB function](./phase-02-db.md) | `src/lib/db.ts` | Todo |
| 3 | [Mutation hook](./phase-03-mutation.md) | `src/hooks/use-link-mutations.ts` | Todo |
| 4 | [UI form field](./phase-04-ui.md) | `src/components/CreateLinkDialog.tsx` | Todo |
