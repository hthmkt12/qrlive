# Phase 3: Download Fix

**File:** `src/components/QRPreview.tsx`

## Problem

`handleDownload` hardcodes `#0f1419` as canvas fill:
```ts
ctx!.fillStyle = "#0f1419";  // ← must use bgColor state
```

## Fix

```ts
ctx!.fillStyle = bgColor;
```

Simple one-line change — ensures downloaded PNG matches the chosen theme.
