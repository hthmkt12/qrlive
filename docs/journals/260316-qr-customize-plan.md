# QR Code Customization Plan: Unstarted, Waiting in Backlog

**Date**: 2026-03-16
**Severity**: Low
**Component**: QRPreview.tsx (frontend only)
**Status**: Archived — Never executed

## What Happened

Planned a straightforward QR code customization feature. 3-phase plan drafted, scoped tightly, zero infrastructure work needed. All phases marked Todo. Plan never got executed — deprioritized in backlog.

## The Brutal Truth

This is a classic case of good planning that solved a real UX problem but couldn't compete for dev resources. The feature was well-designed and low-risk (single file, pure frontend, no migrations), yet it languished unstarted. Frustrating because it would've taken ~2-3 hours to execute end-to-end but required the right prioritization window.

## Technical Details

**Scope:**
- 5 color presets (Vietnamese-labeled themes: Mặc định, Trắng, Tím, Cam, Xanh lá)
- Custom fg/bg color pickers (HTML5 `<input type="color">`)
- Error correction level selector (L/M/Q/H)
- Download respects chosen colors

**Design decisions:**
- Preset dots with gradient visualization (half bg, half fg)
- Active preset shown with ring highlight + scale up
- Controls row: preset buttons → color pickers → error level dropdown
- Single component change (`QRPreview.tsx`): add 3 state vars, replace hardcoded colors, fix download handler

**Out of scope:**
- Logo embedding (deferred as separate feature requiring file upload infrastructure)

## What We Tried

Nothing. Plan was ready but never claimed by any dev/agent. No blockers identified.

## Root Cause Analysis

Competing priorities. The feature was low-impact cosmetic improvement vs. ongoing core system work (auth, performance, testing). No time window opened up. Classic backlog story: well-intentioned, properly designed, just never reached the execution queue.

## Lessons Learned

1. **Tight scoping works** — Plan stayed focused (1 file, no DB), made it low-risk and estimable. Shows the value of "KISS + YAGNI" upfront.

2. **Good plans ≠ execution** — A clean, executable design doesn't guarantee resources. Prioritization triumphed. Not a failure of the plan itself, just reality of finite capacity.

3. **Frontend polish features are vulnerable** — Color customization felt like "nice-to-have" vs. "must-have". Even low-effort UX improvements compete poorly against functional gaps.

4. **Preset design was thoughtful** — Vietnamese labels + color names showed intent to match user base. Gradient visualization trick was clever.

## Next Steps

If resurrecting:
- Claims ~2-3 hours implementation
- Risk: minimal (no DB, no migrations, no API changes)
- Testing: manual (5 presets + freeform picker verification, download check)
- Could be good "first contribution" or "weekend polish" task

If deferring indefinitely:
- Document decision somewhere user-facing (e.g., roadmap/future ideas section)
- Consider stripping from backlog to reduce cognitive load

---

**Unresolved:**
- Was there a specific reason QR customization was deprioritized beyond "other things more urgent"?
- Should "nice-to-have" UX features get a dedicated dev window, or always lose to core work?
