"use client";

import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Alert, Badge, Button, Icon, IconButton, Skeleton, Typography, useConfirm, useToast } from "@store/ui";
import type { ProfilePasskey } from "@store/shared/types/profile";
import { ProfileSection } from "@/components/profile/profile-section";
import { useAddPasskeyMutation, useProfilePasskeysQuery, useRemovePasskeyMutation } from "@/hooks/use-profile";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { PasskeyError } from "@/lib/auth/passkey";
import { PASSKEY_ERROR_MESSAGE_KEYS } from "@/constants/auth";
import { formatDate } from "@/lib/format";
import { errorMessageKey } from "@/lib/error-message-key";
import type { PasskeyRowProps } from "@/types/profile";

const TEST_PREFIX = "profile-passkey";

function PasskeyRow({ passkey, onRemove }: PasskeyRowProps) {
  const t = useTranslations("profile.passkeys");
  const locale = useLocale();
  const name = passkey.name ?? passkey.provider ?? t("unnamed");

  return (
    <li
      data-test-selector={`${TEST_PREFIX}-${passkey.id}`}
      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-panel bg-sunken text-ink-muted">
        <Icon name="passkey" className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Typography variant="body" weight="medium">
            {name}
          </Typography>
          <Badge tone={passkey.synced ? "info" : "neutral"} plain>
            {t(passkey.synced ? "synced" : "oneDevice")}
          </Badge>
        </div>
        {passkey.createdAt && (
          <Typography variant="caption" tone="muted">
            {t("added", { when: formatDate(passkey.createdAt, locale) })}
          </Typography>
        )}
      </div>
      <IconButton
        label={t("remove", { name })}
        icon={<Trash2 aria-hidden="true" />}
        tone="danger"
        onClick={() => onRemove(passkey)}
        data-testid={`${TEST_PREFIX}-remove-${passkey.id}`}
      />
    </li>
  );
}

// Sign in with Face ID, a fingerprint or Windows Hello; the password stays as the way back in.
export function ProfilePasskeysSection() {
  const t = useTranslations("profile.passkeys");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const supported = usePasskeySupport();
  const { data: passkeys, isLoading, isError, refetch } = useProfilePasskeysQuery();
  const add = useAddPasskeyMutation();
  const remove = useRemovePasskeyMutation();
  const { confirm, dialog } = useConfirm(`${TEST_PREFIX}-confirm`);

  async function addPasskey() {
    try {
      await add.mutateAsync();
      toast.success("profile.passkeys.addedToast");
    } catch (error) {
      const failure = error instanceof PasskeyError ? error.failure : "failed";
      if (failure !== "cancelled") {
        toast.error(PASSKEY_ERROR_MESSAGE_KEYS[failure]);
      }
    }
  }

  function removePasskey(passkey: ProfilePasskey) {
    confirm({
      title: "profile.passkeys.removeTitle",
      consequences: [t("removeConsequence")],
      confirmLabel: "profile.passkeys.removeConfirm",
      onConfirm: async () => {
        try {
          await remove.mutateAsync(passkey.id);
          toast.success("profile.passkeys.removedToast");
        } catch (cause) {
          toast.error(errorMessageKey(cause));
        }
      },
    });
  }

  return (
    <ProfileSection name="passkeys">
      {isLoading ? (
        <Skeleton className="h-12 rounded-panel" />
      ) : isError || !passkeys ? (
        <Alert
          tone="danger"
          data-testid={`${TEST_PREFIX}s-error`}
          action={
            <Button type="button" variant="secondary" onClick={() => void refetch()}>
              {tCommon("retry")}
            </Button>
          }
        >
          {t("loadFailed")}
        </Alert>
      ) : passkeys.length > 0 ? (
        <ul data-test-selector={`${TEST_PREFIX}s`} className="flex flex-col divide-y divide-line">
          {passkeys.map((passkey) => (
            <PasskeyRow key={passkey.id} passkey={passkey} onRemove={removePasskey} />
          ))}
        </ul>
      ) : (
        <Typography variant="caption" tone="muted" data-test-selector={`${TEST_PREFIX}s-empty`}>
          {t("empty")}
        </Typography>
      )}
      {supported ? (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          icon={<Icon name="passkey" aria-hidden="true" />}
          isLoading={add.isPending}
          onClick={() => void addPasskey()}
          data-test-selector={`${TEST_PREFIX}-add`}
        >
          {t("add")}
        </Button>
      ) : (
        <Typography variant="caption" tone="muted">
          {t("unsupported")}
        </Typography>
      )}
      {dialog}
    </ProfileSection>
  );
}
