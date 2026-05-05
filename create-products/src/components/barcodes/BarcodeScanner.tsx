"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (!mounted || !divRef.current) return;
      const scanner = new Html5Qrcode("barcode-scanner-div");
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (text) => {
            onScan(text);
            onClose();
          },
          undefined
        )
        .catch((err) => {
          setError(String(err));
        });
    });

    return () => {
      mounted = false;
      if (scannerRef.current) {
        (scannerRef.current as { stop: () => Promise<void> }).stop().catch(() => {});
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Scan Barcode</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        {error ? (
          <p className="text-red-500 text-sm text-center py-8">{error}</p>
        ) : (
          <div id="barcode-scanner-div" ref={divRef} className="rounded-xl overflow-hidden" />
        )}
      </div>
    </div>
  );
}
