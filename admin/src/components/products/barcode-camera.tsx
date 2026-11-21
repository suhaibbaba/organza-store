"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Spinner } from "@store/ui";
import {
  SCANNER_BOX_HEIGHT_RATIO,
  SCANNER_BOX_WIDTH_RATIO,
  SCANNER_ELEMENT_ID,
  SCANNER_FPS,
} from "@/constants/barcode";

interface BarcodeCameraProps {
  // Fires on the first read; the caller closes the camera (one field, not a run of items as in the POS).
  onDetected: (code: string) => void;
}

// A message key the user can act on, never a browser exception.
type ScannerFault = "insecureContext" | "permission" | "unavailable";

class ScannerFaultError extends Error {
  fault: ScannerFault;

  constructor(fault: ScannerFault) {
    super(fault);
    this.name = "ScannerFaultError";
    this.fault = fault;
  }
}

// The isolated admin scanner (spec.md "Barcode / QR scanning"): same engine, formats and geometry as the POS, loaded dynamically because it touches navigator.
export function BarcodeCamera({ onDetected }: BarcodeCameraProps) {
  const t = useTranslations("products.form.barcode.camera");
  const [isStarting, setIsStarting] = useState(true);
  const [fault, setFault] = useState<ScannerFault | null>(null);

  // Read through a ref so a parent re-render never restarts the camera (a black flash mid-aim).
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Camera access needs HTTPS or localhost; iOS Safari refuses otherwise.
      if (!window.isSecureContext) {
        throw new ScannerFaultError("insecureContext");
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelled) {
        return null;
      }

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        verbose: false,
        // Wider than our EAN-13 (rule 13) and the same set the POS decodes, so a code that scans here scans at the till.
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
        // Rear camera: a front-facing preview would have the user scanning blind.
        { facingMode: "environment" },
        { fps: SCANNER_FPS, qrbox: scanRegion },
        (decodedText) => onDetectedRef.current(decodedText),
        // Fires on every frame without a code — normal while aiming.
        () => undefined,
      );

      return scanner;
    }

    // Awaited before cleanup so stop() never hits a still-starting scanner (React mounts effects twice in dev).
    const running = start()
      .then((scanner) => {
        if (!cancelled && scanner) {
          setIsStarting(false);
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
        } catch {
          // The camera goes away with the component either way.
        }
      });
    };
  }, []);

  if (fault) {
    return <Alert tone="danger">{t(`fault.${fault}`)}</Alert>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* html5-qrcode owns and empties this element, so nothing of ours may live inside it. */}
      <div id={SCANNER_ELEMENT_ID} className="w-full overflow-hidden rounded-panel bg-ink" />

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

// Derived from the live viewfinder: a box narrower than the barcode never resolves.
function scanRegion(viewfinderWidth: number, viewfinderHeight: number) {
  return {
    width: Math.floor(viewfinderWidth * SCANNER_BOX_WIDTH_RATIO),
    height: Math.floor(viewfinderHeight * SCANNER_BOX_HEIGHT_RATIO),
  };
}

// html5-qrcode rejects with a STRING, so the reason is read from the text too, or every refusal looks like "no camera".
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
