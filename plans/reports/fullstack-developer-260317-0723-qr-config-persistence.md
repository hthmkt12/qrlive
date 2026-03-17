# Phase Implementation Report

## Executed Phase
- Phase: QR Code Customization — Persist QR Config to Database
- Plan: plans/260317-prod-readiness/
- Status: completed

## Files Modified

| File | Change |
|------|--------|
| `src/lib/db/models.ts` | +10 lines — added `QrConfig` interface, `qr_config` field to `QRLinkRow` |
| `src/lib/db/queries.ts` | +1 line — added `qr_config` to fetchLinks SELECT clause |
| `src/lib/db/mutations.ts` | +5 lines — added `qrConfig` param to `createLinkInDB`, `qr_config` field in insert payload, `qr_config` to `updateLinkInDB` updates type |
| `src/lib/db.ts` | +1 line — re-exported `QrConfig` from barrel |
| `src/hooks/use-link-mutations.ts` | +5 lines — added `qrConfig` to `useCreateLink` mutationFn type + call, `qr_config` to `useUpdateLink` updates type |
| `src/components/QRPreview.tsx` | Rewritten — added `qrConfig` prop (initializes state from saved config), `onConfigChange` callback, SVG download button, changed PNG download to use `encodeURIComponent`/`unescape` for Unicode safety |
| `src/components/CreateLinkDialog.tsx` | +5 lines — added `useRef<QrConfig>`, passes `qrConfigRef.current` to mutation, resets ref on dialog close |
| `src/components/EditLinkDialog.tsx` | +6 lines — added `useRef<QrConfig>`, initializes ref from `link.qr_config` in useEffect, passes ref to updateLink mutation |
| `supabase/migrations/20260317_add_qr_config.sql` | New file — `ALTER TABLE qr_links ADD COLUMN IF NOT EXISTS qr_config JSONB DEFAULT NULL` |

## Tasks Completed
- [x] `QrConfig` interface added to `models.ts`
- [x] `qr_config: QrConfig | null` added to `QRLinkRow`
- [x] `qr_config` added to fetchLinks SELECT in `queries.ts`
- [x] `createLinkInDB` accepts and persists `qrConfig`
- [x] `updateLinkInDB` updates type includes `qr_config`
- [x] `useCreateLink` / `useUpdateLink` pass `qrConfig` through
- [x] `QRPreview` accepts `qrConfig` prop as initial state, fires `onConfigChange` on every change
- [x] SVG download added alongside existing PNG download
- [x] `CreateLinkDialog` wires up `qrConfigRef` (ready for `onConfigChange` hookup when QRPreview is embedded in dialog)
- [x] `EditLinkDialog` loads `link.qr_config` into ref and submits it on save
- [x] Migration SQL file created

## Tests Status
- Type check: not runnable (Bash permission denied) — manual review complete, no type errors found
- Unit tests: not runnable (Bash permission denied)

## Issues Encountered
- `use-link-mutations.ts` received an automatic linter injection of `import type { GroupedLink } from "@/lib/bulk-operations-schemas"` (from another parallel phase). File verified to exist — no conflict.
- Bash permission denied; could not run `npm run typecheck` or `npm test`.

## Notes on Design Decisions
- `qrConfigRef` in dialogs is a ref (not state) to avoid re-renders on every color picker drag; it captures the final value at submit time.
- `CreateLinkDialog` does not yet embed `QRPreview` inline (the existing UX keeps QR preview in the dashboard card). The ref + `onConfigChange` prop are wired up so a future step can embed QRPreview in the dialog form without any further plumbing changes.
- SVG download uses `URL.createObjectURL` + revoke to avoid memory leaks; PNG download fixed to use `encodeURIComponent`/`unescape` for proper Unicode SVG serialization.
- Migration uses `IF NOT EXISTS` so it is safe to re-run.

## Next Steps
- Run `npm run typecheck && npm run test` once Bash is available to confirm zero type errors and green tests
- Apply migration to Supabase: `supabase db push` or deploy via dashboard
- Optionally embed `<QRPreview onConfigChange={(c) => { qrConfigRef.current = c; }} ... />` inside `CreateLinkDialog` to let users preview and set QR style before creation

## Unresolved Questions
- None blocking. Bash permission needed to formally verify type check and test pass.
