import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { Download, Copy, Check, Image as ImageIcon, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { getRedirectUrl } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { QrConfig } from "@/lib/db/models";

interface QRPreviewProps {
  url: string;
  shortCode: string;
  name: string;
  /** Saved QR config — used as initial state. null/undefined = use defaults */
  qrConfig?: QrConfig | null;
  /** Called whenever the user changes any QR customization setting */
  onConfigChange?: (config: QrConfig) => void;
}

type ErrorLevel = "L" | "M" | "Q" | "H";

// Preset color themes for quick QR styling
const PRESETS = [
  { label: "Mặc định", fg: "#14D4C0", bg: "#0f1419" },
  { label: "Trắng",    fg: "#1a1a2e", bg: "#ffffff" },
  { label: "Tím",      fg: "#7c3aed", bg: "#1e1b4b" },
  { label: "Cam",      fg: "#f97316", bg: "#1c1008" },
  { label: "Xanh lá", fg: "#22c55e", bg: "#0a1f0f" },
] as const;

// Border style presets for QR container
const BORDER_STYLES = [
  { label: "Glow",      className: "rounded-xl border border-border bg-card p-6 glow-primary" },
  { label: "Không",     className: "p-4 bg-transparent" },
  { label: "Đậm",       className: "rounded-xl border-2 border-primary bg-card p-6" },
  { label: "Đổ bóng",  className: "rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/20" },
] as const;

const DEFAULT_FG = PRESETS[0].fg;
const DEFAULT_BG = PRESETS[0].bg;
const DEFAULT_BORDER = BORDER_STYLES[0].className;
const DEFAULT_ERROR_LEVEL: ErrorLevel = "H";

function triggerDownload(filename: string, href: string) {
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = href;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function QRPreview({ url, shortCode, name, qrConfig, onConfigChange }: QRPreviewProps) {
  const [copied, setCopied] = useState(false);
  // Initialize from saved config or defaults
  const [fgColor, setFgColor] = useState(qrConfig?.fgColor ?? DEFAULT_FG);
  const [bgColor, setBgColor] = useState(qrConfig?.bgColor ?? DEFAULT_BG);
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>((qrConfig?.errorLevel as ErrorLevel) ?? DEFAULT_ERROR_LEVEL);
  const [borderStyle, setBorderStyle] = useState(qrConfig?.borderStyle ?? DEFAULT_BORDER);
  const [logoUrl, setLogoUrl] = useState(qrConfig?.logoUrl ?? "");
  const [showLogoInput, setShowLogoInput] = useState(Boolean(qrConfig?.logoUrl));
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);

  const wrapperUrl = getRedirectUrl(shortCode);

  /** Notify parent of config changes after any state update */
  const notifyChange = (patch: Partial<QrConfig>) => {
    onConfigChange?.({
      fgColor,
      bgColor,
      errorLevel,
      borderStyle,
      logoUrl: logoUrl || undefined,
      ...patch,
    });
  };

  const handleFgChange = (v: string) => { setFgColor(v); notifyChange({ fgColor: v }); };
  const handleBgChange = (v: string) => { setBgColor(v); notifyChange({ bgColor: v }); };
  const handleErrorChange = (v: ErrorLevel) => { setErrorLevel(v); notifyChange({ errorLevel: v }); };
  const handleBorderChange = (v: string) => { setBorderStyle(v); notifyChange({ borderStyle: v }); };
  const handleLogoChange = (v: string) => { setLogoUrl(v); notifyChange({ logoUrl: v || undefined }); };

  const handlePreset = (fg: string, bg: string) => {
    setFgColor(fg);
    setBgColor(bg);
    notifyChange({ fgColor: fg, bgColor: bg });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wrapperUrl);
    setCopied(true);
    toast({ title: "Đã copy link!" });
    setTimeout(() => setCopied(false), 2000);
  };

  /** Download QR as PNG (rasterized via canvas) */
  const handleDownloadPng = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      ctx!.fillStyle = bgColor;
      ctx?.fillRect(0, 0, 512, 512);
      ctx?.drawImage(img, 32, 32, 448, 448);
      triggerDownload(`qr-${name || shortCode}.png`, canvas.toDataURL("image/png"));
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  /** Download QR as SVG (serialize directly — no canvas needed) */
  const handleDownloadSvg = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(`qr-${name || shortCode}.svg`, url);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const activePreset = PRESETS.find((p) => p.fg === fgColor && p.bg === bgColor);

  // Logo image settings — only applied when URL is provided
  const imageSettings = logoUrl
    ? { src: logoUrl, height: 40, width: 40, excavate: true }
    : undefined;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center gap-4"
    >
      <div ref={qrRef} className={borderStyle} data-testid="qr-preview">
        <QRCodeSVG
          value={wrapperUrl}
          size={200}
          bgColor={bgColor}
          fgColor={fgColor}
          level={errorLevel}
          includeMargin={false}
          imageSettings={imageSettings}
        />
      </div>

      {/* Customization controls */}
      <div className="w-full space-y-2">
        {/* Preset theme dots */}
        <div className="flex justify-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              title={p.label}
              aria-label={p.label}
              onClick={() => handlePreset(p.fg, p.bg)}
              className={cn(
                "w-7 h-7 rounded-full border-2 transition-all",
                activePreset?.label === p.label
                  ? "border-primary scale-110 shadow-md"
                  : "border-border hover:scale-105"
              )}
              style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.fg} 50%)` }}
            />
          ))}
        </div>

        {/* Color pickers + error level */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1 cursor-pointer">
            QR
            <input
              type="color"
              value={fgColor}
              onChange={(e) => handleFgChange(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0.5"
            />
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            Nền
            <input
              type="color"
              value={bgColor}
              onChange={(e) => handleBgChange(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0.5"
            />
          </label>
          <select
            value={errorLevel}
            onChange={(e) => handleErrorChange(e.target.value as ErrorLevel)}
            className="ml-auto h-7 rounded border border-border bg-secondary px-2 text-xs"
          >
            <option value="L">Mức L</option>
            <option value="M">Mức M</option>
            <option value="Q">Mức Q</option>
            <option value="H">Mức H</option>
          </select>
        </div>

        {/* Border style selector */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">Viền:</span>
          {BORDER_STYLES.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => handleBorderChange(b.className)}
              className={cn(
                "px-2 py-0.5 rounded border text-xs transition-colors",
                borderStyle === b.className
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              {b.label}
            </button>
          ))}
          {/* Logo toggle */}
          <button
            type="button"
            onClick={() => setShowLogoInput((v) => !v)}
            className={cn(
              "ml-auto flex items-center gap-1 px-2 py-0.5 rounded border text-xs transition-colors",
              showLogoInput
                ? "border-primary text-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            )}
            title="Thêm logo vào giữa QR"
          >
            <ImageIcon className="h-3 w-3" /> Logo
          </button>
        </div>

        {/* Logo URL input — shown when toggle is active */}
        {showLogoInput && (
          <div className="flex gap-2 items-center">
            <Input
              placeholder="URL logo (https://...)"
              value={logoUrl}
              onChange={(e) => handleLogoChange(e.target.value)}
              className="h-7 text-xs"
            />
            {logoUrl && (
              <button
                type="button"
                onClick={() => handleLogoChange("")}
                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                Xóa
              </button>
            )}
          </div>
        )}
      </div>

      <div className="w-full rounded-lg border border-border bg-secondary/50 p-3">
        <p className="text-xs text-muted-foreground mb-1">Link QR (luôn sống)</p>
        <p className="font-mono text-xs text-primary break-all">{wrapperUrl}</p>
      </div>

      <div className="flex gap-2 w-full">
        <Button variant="outline" size="sm" className="flex-1" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? "Đã copy" : "Copy link"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadPng} title="Tải PNG">
          <Download className="h-4 w-4 mr-1" />
          PNG
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadSvg} title="Tải SVG">
          <FileImage className="h-4 w-4 mr-1" />
          SVG
        </Button>
      </div>
    </motion.div>
  );
}
