# QR Code Customization

**Date:** 2026-03-16 | **Status:** Ready to implement
**Complexity:** Simple — 1 file, pure frontend, no DB/migration

---

## Overview

Let users customize the QR code appearance before downloading.
Currently `bgColor`/`fgColor` are hardcoded in `QRPreview.tsx`.

**Scope (KISS):**
- Color presets (5 themes) — one-click, looks great
- Custom fg/bg color pickers — for power users
- Error correction level selector (L/M/Q/H) — useful for logos
- Download respects chosen colors

**Out of scope:** Logo embedding (needs file upload, separate feature)

---

## Phase Overview

| # | Phase | File | Status |
|---|-------|------|--------|
| 1 | [State + presets](./phase-01-state-and-presets.md) | `QRPreview.tsx` | Todo |
| 2 | [Color picker UI](./phase-02-color-pickers.md) | `QRPreview.tsx` | Todo |
| 3 | [Download fix](./phase-03-download.md) | `QRPreview.tsx` | Todo |
