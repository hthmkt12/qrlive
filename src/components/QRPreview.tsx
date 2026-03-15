import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { getRedirectUrl } from "@/lib/db";
import { cn } from "@/lib/utils";

interface QRPreviewProps {
  url: string;
  shortCode: string;
  name: string;
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

export function QRPreview({ url, shortCode, name }: QRPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [fgColor, setFgColor] = useState(PRESETS[0].fg);
  const [bgColor, setBgColor] = useState(PRESETS[0].bg);
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>("H");
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);

  const wrapperUrl = getRedirectUrl(shortCode);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wrapperUrl);
    setCopied(true);
    toast({ title: "Đã copy link!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
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
      const a = document.createElement("a");
      a.download = `qr-${name || shortCode}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const activePreset = PRESETS.find((p) => p.fg === fgColor && p.bg === bgColor);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center gap-4"
    >
      <div ref={qrRef} className="rounded-xl border border-border bg-card p-6 glow-primary">
        <QRCodeSVG
          value={wrapperUrl}
          size={200}
          bgColor={bgColor}
          fgColor={fgColor}
          level={errorLevel}
          includeMargin={false}
        />
      </div>

      {/* Customization controls */}
      <div className="w-full space-y-2">
        {/* Preset theme dots */}
        <div className="flex justify-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              title={p.label}
              onClick={() => { setFgColor(p.fg); setBgColor(p.bg); }}
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
              onChange={(e) => setFgColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0.5"
            />
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            Nền
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0.5"
            />
          </label>
          <select
            value={errorLevel}
            onChange={(e) => setErrorLevel(e.target.value as ErrorLevel)}
            className="ml-auto h-7 rounded border border-border bg-secondary px-2 text-xs"
          >
            <option value="L">Mức L</option>
            <option value="M">Mức M</option>
            <option value="Q">Mức Q</option>
            <option value="H">Mức H</option>
          </select>
        </div>
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
        <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />
          Tải QR
        </Button>
      </div>
    </motion.div>
  );
}
