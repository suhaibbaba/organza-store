"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Spinner } from "@store/ui";
import {
  SCANNER_BOX_HEIGHT_RATIO,
  SCANNER_BOX_WIDTH_RATIO,
  SCANNER_ELEMENT_ID,
  SCANNER_FPS,
  SCAN_PULSE_MS,
} from "@/constants/pos";
import { cn } from "@/lib/utils";
import type { ScanFlash } from "@/types/feedback";

interface BarcodeScannerProps {
  // Fires for every read, repeats included; de-duplication is the caller's (hooks/use-add-by-code.ts).
  onDetected: (code: string) => void;
  // The last read flashed on the viewfinder, the only acknowledgement visible while the cart is behind the sheet.
  pulse: ScanFlash | null;
  // Fires once the camera is live; the caller re-takes the iOS audio unlock there.
  onStarted?: () => void;
}

// A closed set so the cashier gets an instruction, not a browser exception.
type ScannerFault = "insecureContext" | "permission" | "unavailable";

class ScannerFaultError extends Error {
  fault: ScannerFault;

  constructor(fault: ScannerFault) {
    super(fault);
    this.name = "ScannerFaultError";
    this.fault = fault;
  }
}

// THE isolated scanner (spec.md): html5-qrcode lives only here, loaded dynamically because it touches navigator/document on import.
export function BarcodeScanner({ onDetected, pulse, onStarted }: BarcodeScannerProps) {
  const t = useTranslations("sell.scanner");
  const [isStarting, setIsStarting] = useState(true);
  const [fault, setFault] = useState<ScannerFault | null>(null);

  // Callbacks read through refs so a parent render never restarts the camera (a black flash mid-scan).
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const onStartedRef = useRef(onStarted);
  useEffect(() => {
    onStartedRef.current = onStarted;
  }, [onStarted]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Camera access needs a secure context (HTTPS or localhost); say so plainly.
      if (!window.isSecureContext) {
        throw new ScannerFaultError("insecureContext");
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelled) {
        return null;
      }

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        verbose: false,
        // EAN-13 is ours (rule 13), the rest cover supplier labels; a narrow list keeps decoding instant.
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });

      await scanner.start(
        { facingMode: "environment" },
        { fps: SCANNER_FPS, qrbox: scanRegion },
        (decodedText) => onDetectedRef.current(decodedText),
        // Fires for every frame without a code: normal while aiming.
        () => undefined,
      );

      return scanner;
    }

    // Awaited before cleanup: stop() on a still-starting scanner throws (React mounts effects twice in dev).
    const running = start()
      .then((scanner) => {
        if (!cancelled && scanner) {
          setIsStarting(false);
          onStartedRef.current?.();
        }
        return scanner;
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFault(toFault(error));
          setIsStarting(false);
        }
        return null;
      });

    return () => {
      cancelled = true;
      void running.then(async (scanner) => {
        if (!scanner) {
          return;
        }
        try {
          await scanner.stop();
          scanner.clear();
        } catch {}
      });
    };
  }, []);

  if (fault) {
    return (
      <Alert tone="danger" data-testid="alert-destructive">
        {t(`fault.${fault}`)}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* A sibling of the video host: html5-qrcode owns and empties that element. */}
      <div className="relative w-full">
        {/* html5-qrcode injects the <video> into this element by id. */}
        <div id={SCANNER_ELEMENT_ID} className="w-full overflow-hidden rounded-panel bg-black" />

        {pulse && (
          <span
            // Keyed by token so a repeat read replays the flash.
            key={pulse.token}
            className={cn(
              "animate-scan-pulse pointer-events-none absolute inset-0 rounded-panel ring-4 ring-inset",
              pulse.variant === "success" ? "bg-success-400/25 ring-success-400" : "bg-danger-500/25 ring-danger-500",
            )}
            style={{ animationDuration: `${SCAN_PULSE_MS}ms` }}
            aria-hidden="true"
          />
        )}
      </div>

      {isStarting ? (
        <p className="flex items-center gap-2 text-label text-ink-muted">
          <Spinner />
          {t("starting")}
        </p>
      ) : (
        <p className="text-center text-label text-ink-muted">{t("hint")}</p>
      )}
    </div>
  );
}

// Derived from the live viewfinder: feeds vary and a box narrower than the barcode never resolves.
function scanRegion(viewfinderWidth: number, viewfinderHeight: number) {
  return {
    width: Math.floor(viewfinderWidth * SCANNER_BOX_WIDTH_RATIO),
    height: Math.floor(viewfinderHeight * SCANNER_BOX_HEIGHT_RATIO),
  };
}

// html5-qrcode rejects with a string, so a refused permission is read from the text as well as the name.
function toFault(error: unknown): ScannerFault {
  if (error instanceof ScannerFaultError) {
    return error.fault;
  }

  const described =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null
        ? `${String((error as { name?: unknown }).name ?? "")} ${String((error as { message?: unknown }).message ?? "")}`
        : "";

  return /NotAllowedError|SecurityError|Permission ?denied/i.test(described) ? "permission" : "unavailable";
}
