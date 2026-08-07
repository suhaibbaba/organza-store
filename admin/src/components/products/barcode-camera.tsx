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
} from "@/constants/barcode";

interface BarcodeCameraProps {
  // Fires on the first successful read and then stops mattering — the caller
  // closes the camera, since here a scan fills one field rather than starting
  // a run of items (which is the POS's job).
  onDetected: (code: string) => void;
}

// Reason the camera isn't running, as a message key — an instruction the user
// can act on ("allow the camera"), never a browser exception.
type ScannerFault = "insecureContext" | "permission" | "unavailable";

class ScannerFaultError extends Error {
  fault: ScannerFault;

  constructor(fault: ScannerFault) {
    super(fault);
    this.name = "ScannerFaultError";
    this.fault = fault;
  }
}

// THE isolated scanner for the admin (spec.md "Barcode / QR scanning"):
// html5-qrcode is imported, configured, started and torn down here and nowhere
// else, so swapping the engine (the documented fallback is @zxing/library)
// means rewriting this one file. It is deliberately the same engine, formats
// and geometry as the POS's own scanner component — a tag that reads at the
// counter has to read here too.
//
// The library is loaded with a dynamic import rather than a top-level one
// because it reaches for `navigator`/`document` as it initialises: pulled into
// the server bundle it would break the render, and it is dead weight on every
// screen where nobody opens a camera.
export function BarcodeCamera({ onDetected }: BarcodeCameraProps) {
  const t = useTranslations("products.form.barcode.camera");
  const [isStarting, setIsStarting] = useState(true);
  const [fault, setFault] = useState<ScannerFault | null>(null);

  // Read through a ref so a parent re-render never restarts the camera, which
  // on a phone shows as a black flash mid-aim.
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
        // A supplier's tag is whatever the supplier printed, so this list is
        // wider than our own EAN-13 (CLAUDE.md rule 13) — it is the same set
        // the POS decodes, which is what makes "it scanned when I saved it"
        // mean "it will scan at the till".
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
        // The rear camera on any phone that has one — a front-facing preview
        // would have the user scanning blind.
        { facingMode: "environment" },
        { fps: SCANNER_FPS, qrbox: scanRegion },
        (decodedText) => onDetectedRef.current(decodedText),
        // Fires for every frame without a readable code, which is the normal
        // state while aiming rather than an error worth showing.
        () => undefined
      );

      return scanner;
    }

    // Resolved before the cleanup below tears anything down, so stop() is
    // never called on a scanner that is still starting — React mounts effects
    // twice in dev, and that overlap is exactly where html5-qrcode throws.
    const running = start()
      .then((scanner) => {
        if (!cancelled && scanner) setIsStarting(false);
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
          // The camera is going away with the component either way; a failed
          // stop has nothing left to report to.
        }
      });
    };
  }, []);

  if (fault) {
    return <Alert variant="destructive">{t(`fault.${fault}`)}</Alert>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* html5-qrcode owns this element's contents and empties it, so nothing
          of ours may live inside it. */}
      <div id={SCANNER_ELEMENT_ID} className="w-full overflow-hidden rounded-xl bg-black" />

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

// Only what falls inside this box is decoded, derived from the live viewfinder
// rather than fixed: a box narrower than the barcode never resolves.
function scanRegion(viewfinderWidth: number, viewfinderHeight: number) {
  return {
    width: Math.floor(viewfinderWidth * SCANNER_BOX_WIDTH_RATIO),
    height: Math.floor(viewfinderHeight * SCANNER_BOX_HEIGHT_RATIO),
  };
}

// getUserMedia rejects with a DOMException whose name says whether the user
// refused or the device has no camera to offer.
function toFault(error: unknown): ScannerFault {
  if (error instanceof ScannerFaultError) return error.fault;
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  return name === "NotAllowedError" || name === "SecurityError" ? "permission" : "unavailable";
}
