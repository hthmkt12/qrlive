# Phase 1: State + Presets

**File:** `src/components/QRPreview.tsx`

## State to add

```ts
const [fgColor, setFgColor] = useState("#14D4C0");    // current teal
const [bgColor, setBgColor] = useState("#0f1419");    // current dark
const [errorLevel, setErrorLevel] = useState<"L"|"M"|"Q"|"H">("H");
```

## Presets

```ts
const PRESETS = [
  { label: "Mặc định",  fg: "#14D4C0", bg: "#0f1419" },
  { label: "Trắng",     fg: "#1a1a2e", bg: "#ffffff" },
  { label: "Tím",       fg: "#7c3aed", bg: "#1e1b4b" },
  { label: "Cam",       fg: "#f97316", bg: "#1c1008" },
  { label: "Xanh lá",  fg: "#22c55e", bg: "#0a1f0f" },
];
```

## QRCodeSVG props

Replace hardcoded values:
```tsx
<QRCodeSVG
  value={wrapperUrl}
  size={200}
  bgColor={bgColor}
  fgColor={fgColor}
  level={errorLevel}
  includeMargin={false}
/>
```
