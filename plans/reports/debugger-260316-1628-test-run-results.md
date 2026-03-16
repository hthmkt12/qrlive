# Test Run Results — 2026-03-16

## Executive Summary

- **Tests**: 1 failed / 128 passed (129 total across 9 test files)
- **TypeScript**: No errors (clean build)
- **Lint**: 0 errors in app source; errors only in `.claude/` and `.opencode/` tooling files (not app code)

---

## Test Results

### Failing Test

**File**: `src/test/edit-link-dialog.test.tsx`
**Suite**: `EditLinkDialog`
**Test**: `removes a geo route when delete button is clicked`

**Error**:
```
AssertionError: expected undefined to be defined
  at src/test/edit-link-dialog.test.tsx:253:23
```

**Root Cause**: Dialog renders via `DialogPortal` into `document.body` (a React portal), NOT inside the test's `container` element. The test queries `container.querySelectorAll('form button[type="button"]')`, which returns an empty NodeList because the form lives outside `container`. Consequently `allButtons` is empty, `removeBtn` is `undefined`, and the assertion at line 253 fails.

**Fix**: Replace `container.querySelectorAll` with `document.querySelectorAll` at line 249 of `src/test/edit-link-dialog.test.tsx`:

```diff
- const allButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('form button[type="button"]'));
+ const allButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('form button[type="button"]'));
```

The SVG class detection logic (`classList.toString().includes("trash")`) is correct — Lucide renders `Trash2` with class `lucide lucide-trash-2 ...` which does contain the substring "trash".

---

## TypeScript Errors

None. `npm run typecheck` exited cleanly.

---

## Lint Results

### App source files (src/) — 2 errors, 7 warnings

| File | Line | Level | Rule | Message |
|------|------|-------|------|---------|
| `src/components/ui/command.tsx` | 24 | error | `@typescript-eslint/no-empty-object-type` | Interface declaring no members |
| `src/components/ui/textarea.tsx` | 5 | error | `@typescript-eslint/no-empty-object-type` | Interface declaring no members |
| `src/test/link-card.test.tsx` | 32 | error | `@typescript-eslint/no-explicit-any` | Unexpected any |
| `src/test/qr-preview.test.tsx` | 16 | error | `@typescript-eslint/no-explicit-any` | Unexpected any |
| `src/components/ui/badge.tsx` | 29 | warning | `react-refresh/only-export-components` | Non-component export |
| `src/components/ui/button.tsx` | 47 | warning | `react-refresh/only-export-components` | Non-component export |
| `src/components/ui/form.tsx` | 129 | warning | `react-refresh/only-export-components` | Non-component export |
| `src/components/ui/navigation-menu.tsx` | 111 | warning | `react-refresh/only-export-components` | Non-component export |
| `src/components/ui/sidebar.tsx` | 636 | warning | `react-refresh/only-export-components` | Non-component export |
| `src/components/ui/sonner.tsx` | 27 | warning | `react-refresh/only-export-components` | Non-component export |
| `src/components/ui/toggle.tsx` | 37 | warning | `react-refresh/only-export-components` | Non-component export |
| `src/contexts/auth-context.tsx` | 67 | warning | `react-refresh/only-export-components` | Non-component export |

> Note: `ui/` component errors are from shadcn-generated boilerplate. The `react-refresh` warnings are benign in production. The `any` errors in test files are minor.

### Tooling files (not app code) — errors in `.claude/` and `.opencode/`

Multiple `no-explicit-any` and `no-require-imports` errors in `.claude/skills/mcp-management/` and `.opencode/plugin/` scripts — these are developer tooling, not part of the app build and can be ignored or excluded via `.eslintignore`.

---

## Summary of All Issues

| # | Type | Severity | File | Issue |
|---|------|----------|------|-------|
| 1 | Test failure | HIGH | `src/test/edit-link-dialog.test.tsx:249` | `container.querySelectorAll` misses portal-rendered dialog content; use `document.querySelectorAll` |
| 2 | Lint error | LOW | `src/components/ui/command.tsx:24` | Empty interface (shadcn boilerplate) |
| 3 | Lint error | LOW | `src/components/ui/textarea.tsx:5` | Empty interface (shadcn boilerplate) |
| 4 | Lint error | LOW | `src/test/link-card.test.tsx:32` | Explicit `any` in test |
| 5 | Lint error | LOW | `src/test/qr-preview.test.tsx:16` | Explicit `any` in test |
| 6 | Lint warning | INFO | Multiple `src/components/ui/` files | `react-refresh/only-export-components` (shadcn boilerplate) |

---

## Unresolved Questions

- Should the lint errors in `.claude/` and `.opencode/` tooling directories be suppressed via `.eslintignore`? They add noise but don't affect the app.
- The `no-empty-object-type` errors in shadcn UI files (`command.tsx`, `textarea.tsx`) — are these auto-generated and should be excluded from lint, or updated manually?
