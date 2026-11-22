"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FormField, PasscodeInput, Spinner, useToast } from "@store/ui";
import { PASSCODE_LENGTH } from "@store/shared/constants/posLock";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { useSession } from "@/components/providers/session-provider";
import { savePasscode } from "@/lib/api/pos-device";
import { ApiError } from "@/lib/api/errors";
import { errorMessageKey } from "@/hooks/use-translate-error";

const FIELD_ID = "pos-passcode";

// Typed twice, saved when the second matches: a passcode nobody can type again locks its owner out.
export function PasscodeForm({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations("passcode");
  const toast = useToast();
  const { passcodeSaved } = useSession();
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Saving disables the box, which drops focus; a failure puts it straight back.
  useEffect(() => {
    if (!isSaving && errorKey) {
      inputRef.current?.focus();
    }
  }, [isSaving, errorKey]);

  async function handleComplete(entered: string) {
    if (first === null) {
      setFirst(entered);
      setValue("");
      setErrorKey(null);
      inputRef.current?.focus();
      return;
    }
    if (entered !== first) {
      setFirst(null);
      setValue("");
      setErrorKey("passcode.mismatch");
      inputRef.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      await savePasscode(entered);
      passcodeSaved();
      toast.success("passcode.saved");
      onSaved();
    } catch (error) {
      setFirst(null);
      setValue("");
      setErrorKey(errorMessageKey(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3" data-test-selector="pos-passcode-form">
      <FormField
        label={first === null ? "passcode.enter" : "passcode.confirm"}
        htmlFor={FIELD_ID}
        note={first === null ? "passcode.enterNote" : "passcode.confirmNote"}
        noteValues={{ length: PASSCODE_LENGTH }}
        error={errorKey ? { type: "manual", message: errorKey } : undefined}
        errorKey={errorKey ?? undefined}
      >
        <div className="flex items-center gap-3">
          <PasscodeInput
            ref={inputRef}
            id={FIELD_ID}
            key={first === null ? "enter" : "confirm"}
            value={value}
            onChange={setValue}
            onComplete={(entered) => void handleComplete(entered)}
            length={PASSCODE_LENGTH}
            label={t(first === null ? "enter" : "confirm")}
            hasError={errorKey !== null}
            disabled={isSaving}
            autoFocus
            data-testid="pos-passcode-input"
          />
          {isSaving && <Spinner label={t("saving")} />}
        </div>
      </FormField>
    </div>
  );
}
