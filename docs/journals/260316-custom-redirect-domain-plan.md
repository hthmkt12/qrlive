# Custom Redirect Domain — Plan Created but Never Executed

**Date**: 2026-03-16 01:19
**Severity**: Medium
**Component**: QR Code Redirect System
**Status**: Archived (All Tasks Todo)

## What Happened

Created a 3-phase plan to solve GFW blocking of Supabase redirect URLs (`supabase.co/functions/v1/redirect`), preventing QR codes from working in China. Plan designed but never executed — all phases remain in Todo state.

## The Brutal Truth

This plan sat unstarted because it felt premature. No actual customer pain reports from China market yet, no explicit feature request from product. Built it defensively as a "what if" architecture without clear ROI signal. Good intentions, zero follow-through. Now it's dead weight in the plans directory taking up mental load.

## Technical Details

**Problem**: Supabase.co domain blocked by Great Firewall → QR codes fail in China.

**Solution**: `VITE_REDIRECT_BASE_URL` env var + proxy layer:
- Client generates QR with custom domain instead of Supabase URL
- Custom domain (Cloudflare Worker/Alibaba/HK VPS) proxies requests to Supabase
- Preserves `cf-ipcountry` header for geo-routing logic
- Fallback to Supabase URL if env var not set (backward compatible)

**Architecture**:
```
QR Code → yourdomain.com/r/CODE
           ↓ (Cloudflare Worker / Alibaba / HK Proxy)
        supabase.co/functions/v1/redirect/CODE
```

**3 Phases**:
1. Env var in `db.ts` + `.env.example` — getRedirectUrl() function
2. Cloudflare Worker proxy (`cloudflare-worker/redirect-proxy.js`) — new file
3. Deployment guide section in `docs/deployment-guide.md`

## Why Archived

- No customer demand signal
- Scope creep on China market expansion (not committed roadmap)
- Simpler to wait for actual requirement before implementing
- Team bandwidth allocated to other priorities
- Plan was "complete" architecturally but never got exec buy-in to implement

## Key Insights for Future

**Good Decisions**:
- Env var approach allows operator flexibility without code changes
- Backward compatible fallback prevents breaking existing QR codes
- Header forwarding consideration shows attention to geo-routing details
- Three deployment options (Cloudflare/Alibaba/HK VPS) give different tradeoffs

**Lessons**:
1. **Defensiveness without demand = waste**: Architecture planning for hypothetical markets creates technical debt of "should we implement this?" decisions. Document it, yes. Plan it fully, maybe not.
2. **Cloudflare Workers unreliable for GFW**: Note even mentions "not guaranteed" accessible from TQ. Should've bumped this earlier if pursuing seriously.
3. **Better trigger**: Execute only when actual China user reports "QR broken" or product explicitly prioritizes TQ market expansion.

## Next Steps

If China market becomes priority:
1. Retrieve this plan from `/plans/260316-0119-custom-redirect-domain/`
2. Verify Cloudflare Worker reliability assumptions (test from TQ VPS)
3. Validate env var approach against current `db.ts` structure
4. Execute phases 1→2→3 sequentially
5. Test QR generation with custom domain before full rollout

**Unresolved**: Is Cloudflare Worker availability in TQ actually current? Note is 6+ months old. Should test at execution time.

