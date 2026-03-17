# Phase 02 — Fix Lint Errors
**Priority:** P0 | **Status:** Todo

## Issues

### 1. `no-empty-object-type` in shadcn boilerplate
**Files:**
- `src/components/ui/command.tsx:24`
- `src/components/ui/textarea.tsx:5`

**Pattern:** `interface Foo extends Bar {}` → empty interface extending another type.
**Fix:** Replace with `type Foo = Bar` or add `// eslint-disable-next-line no-empty-object-type` if the component is generated shadcn code that shouldn't be modified.

Preferred: inline disable comment since these are generated shadcn files:
```ts
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CommandProps extends ... {}
```

### 2. `no-explicit-any` in test files
**Files:**
- `src/test/link-card.test.tsx:32` — replace `any` with proper type
- `src/test/qr-preview.test.tsx:16` — replace `any` with proper type

Need to read those lines first to determine the correct type replacement.

## Todo
- [x] Read `src/components/ui/command.tsx` around line 24
- [x] Read `src/components/ui/textarea.tsx` around line 5
- [x] Fix `no-empty-object-type` (eslint-disable comment preferred for shadcn)
- [x] Read `src/test/link-card.test.tsx:32`
- [x] Read `src/test/qr-preview.test.tsx:16`
- [x] Fix `no-explicit-any` with correct types
- [x] Run `npm run lint` → 0 errors

## Success Criteria
`npm run lint` → 0 errors (warnings on shadcn ok)
