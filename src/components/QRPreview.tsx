import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { getRedirectUrl } from "@/lib/db";

interface QRPreviewProps {
  url: string;
  shortCode: string;
  name: string;
}

export function QRPreview({ url, shortCode, name }: QRPreviewProps) {
  const [copied, setCopied] = useState(false);
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
      ctx!.fillStyle = "#0f1419";
      ctx?.fillRect(0, 0, 512, 512);
      ctx?.drawImage(img, 32, 32, 448, 448);
      const a = document.createElement("a");
      a.download = `qr-${name || shortCode}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

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
          bgColor="hsl(220, 18%, 10%)"
          fgColor="hsl(174, 72%, 50%)"
          level="H"
          includeMargin={false}
        />
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
