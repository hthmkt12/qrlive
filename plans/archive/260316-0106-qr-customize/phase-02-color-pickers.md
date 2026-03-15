# Phase 2: Color Picker UI

**File:** `src/components/QRPreview.tsx`

## Layout (insert between QR and link URL block)

```
[ ○ ○ ○ ○ ○ ]  ← preset dots (active = ring)
[ QR màu ] [BG màu] [Mức lỗi ▾]  ← controls row
```

### Preset row

```tsx
<div className="flex gap-2">
  {PRESETS.map((p) => (
    <button
      key={p.label}
      title={p.label}
      onClick={() => { setFgColor(p.fg); setBgColor(p.bg); }}
      className={cn(
        "w-7 h-7 rounded-full border-2 transition-all",
        fgColor === p.fg && bgColor === p.bg
          ? "border-primary scale-110"
          : "border-border"
      )}
      style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.fg} 50%)` }}
    />
  ))}
</div>
```

### Controls row

```tsx
<div className="flex gap-2 items-center text-xs">
  <label className="flex items-center gap-1 text-muted-foreground cursor-pointer">
    QR
    <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)}
      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
  </label>
  <label className="flex items-center gap-1 text-muted-foreground cursor-pointer">
    BG
    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
  </label>
  <select
    value={errorLevel}
    onChange={(e) => setErrorLevel(e.target.value as "L"|"M"|"Q"|"H")}
    className="ml-auto h-7 rounded border border-border bg-secondary px-2 text-xs"
  >
    <option value="L">Mức L</option>
    <option value="M">Mức M</option>
    <option value="Q">Mức Q</option>
    <option value="H">Mức H (tốt nhất)</option>
  </select>
</div>
```

## Import additions
- `cn` from `@/lib/utils` (likely already imported)
