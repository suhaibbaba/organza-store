"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
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
  // Fires for every successful read, including repeats of the same barcode
  // while it stays in frame — de-duplication is the caller's business
  // (see hooks/use-add-by-code.ts), not the camera's.
  onDetected: (code: string) => void;
  // The last read, answered on the viewfinder itself: green for something
  // that went into the cart, red for a code nothing matched. The cart is
  // behind this sheet while a run of items is being scanned, so this frame
  // is the only place the acknowledgement can be seen without looking away.
  pulse: ScanFlash | null;
}

// Reason the camera isn't running, as a message key. Kept as a small closed
// set so the cashier gets an instruction ("allow the camera") rather than a
// browser exception nobody at a till can act on.
type ScannerFault = "insecureContext" | "permission" | "unavailable";

class ScannerFaultError extends Error {
  fault: ScannerFault;

  constructor(fault: ScannerFault) {
    super(fault);
    this.name = "ScannerFaultError";
    this.fault = fault;
  }
}

// THE isolated scanner (spec.md "Barcode / QR scanning"): html5-qrcode is
// imported, configured, started and torn down here and nowhere else, so
// swapping the engine (the documented fallback is @zxing/library) means
// rewriting this one file against the same two-prop contract.
//
// The library is loaded with a dynamic import rather than a top-level one
// because it reaches for `navigator`/`document` as it initialises: pulled
// into the server bundle it would break the render, and it is dead weight
// for the ~all of the shift when the camera isn't open.
export function BarcodeScanner({ onDetected, pulse }: BarcodeScannerProps) {
  const t = useTranslations("sell.scanner");
  const [isStarting, setIsStarting] = useState(true);
  const [fault, setFault] = useState<ScannerFault | null>(null);

  // The callback identity changes on every parent render; reading it through
  // a ref keeps the effect from restarting the camera each time, which on a
  // phone means a visible black flash mid-scan.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Camera access needs a secure context — HTTPS or localhost. On iOS
      // Safari this is not negotiable, so say so plainly instead of letting
      // the permission call fail with something cryptic.
      if (!window.isSecureContext) throw new ScannerFaultError("insecureContext");

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelled) return null;

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        verbose: false,
        // Clothing tags carry EAN-13 (CLAUDE.md rule 13); the rest are here
        // because a supplier's own label occasionally isn't. Narrowing the
        // list is what keeps decoding fast enough to feel instant.
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
        // The rear camera, on any phone that has one — a front-facing
        // preview would have the cashier scanning blind.
        { facingMode: "environment" },
        { fps: SCANNER_FPS, qrbox: scanRegion },
        (decodedText) => onDetectedRef.current(decodedText),
        // Fires continuously for every frame without a readable code —
        // that is the normal state while aiming, not an error worth showing.
        () => undefined
      );

      return scanner;
    }

    // Resolved before the cleanup below tears anything down, so stop() is
    // never called on a scanner that is still starting — React mounts
    // effects twice in dev, and that overlap is exactly where html5-qrcode
    // throws.
    const running = start()
      .then((scanner) => {
        if (!cancelled) setIsStarting(false);
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
        if (!scanner) return;
        try {
          await scanner.stop();
          scanner.clear();
        } catch {
          // The camera is going away with the component either way; a
          // failed stop has nothing left to report to.
        }
      });
    };
  }, []);

  if (fault) {
    return <Alert variant="destructive">{t(`fault.${fault}`)}</Alert>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* The overlay is a sibling of the video host, not a child:
          html5-qrcode owns that element's contents and empties it. */}
      <div className="relative w-full">
        {/* html5-qrcode injects the <video> into this element by id. */}
        <div id={SCANNER_ELEMENT_ID} className="w-full overflow-hidden rounded-xl bg-black" />

        {pulse && (
          <span
            // Keyed by the token so a second read of the same tag replays
            // the flash rather than showing an already-faded one.
            key={pulse.token}
            className={cn(
              "animate-scan-pulse pointer-events-none absolute inset-0 rounded-xl ring-4 ring-inset",
              pulse.variant === "success"
                ? "bg-emerald-400/25 ring-emerald-400"
                : "bg-destructive/25 ring-destructive"
            )}
            style={{ animationDuration: `${SCAN_PULSE_MS}ms` }}
            aria-hidden="true"
          />
        )}
      </div>

      {isStarting ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          {t("starting")}
        </p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">{t("hint")}</p>
      )}
    </div>
  );
}

// Only what falls inside this box is decoded, so it is derived from the
// live viewfinder rather than fixed: phone camera feeds vary wildly in
// size, and a box narrower than the barcode never resolves to anything.
function scanRegion(viewfinderWidth: number, viewfinderHeight: number) {
  return {
    width: Math.floor(viewfinderWidth * SCANNER_BOX_WIDTH_RATIO),
    height: Math.floor(viewfinderHeight * SCANNER_BOX_HEIGHT_RATIO),
  };
}

// getUserMedia rejects with a DOMException whose name says whether the user
// refused or the device simply has no camera to offer.
function toFault(error: unknown): ScannerFault {
  if (error instanceof ScannerFaultError) return error.fault;
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  return name === "NotAllowedError" || name === "SecurityError" ? "permission" : "unavailable";
}
