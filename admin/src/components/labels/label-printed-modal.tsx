"use client";

import { useTranslations } from "next-intl";
import { Alert, Button, Modal, Typography } from "@store/ui";
import { useTranslateError } from "@/hooks/use-translate-error";
import type { LabelPrintedModalProps } from "@/types/label";

// The browser never says whether anything printed, so the shop is asked once its dialog closes.
export function LabelPrintedModal({ open, isPending, errorCode, onConfirm, onClose }: LabelPrintedModalProps) {
  const t = useTranslations("labels.print");
  const translateError = useTranslateError();

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      data-testid="labels-printed-modal"
      title="labels.print.confirmTitle"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending} data-test-selector="labels-printed-no">
            {t("confirmNo")}
          </Button>
          <Button onClick={onConfirm} isLoading={isPending} data-test-selector="labels-printed-yes">
            {t("confirmYes")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {errorCode && (
          <Alert tone="danger" data-testid="labels-printed-error">
            {translateError(errorCode)}
          </Alert>
        )}
        <Typography variant="body" as="p">
          {t("confirmDescription")}
        </Typography>
      </div>
    </Modal>
  );
}
