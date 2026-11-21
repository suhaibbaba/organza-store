"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, Icon, Modal, Typography, useToast, type IconName } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { useUserDisplay } from "@/lib/user-display";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteUserMutation, useToggleUserActiveMutation } from "@/hooks/use-users";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import type { UserRemoveModalProps } from "@/types/user";

type Removal = "deactivate" | "delete";

function RemovalOption({ name, icon, heading, body, children }: { name: string; icon: IconName; heading: string; body: string; children?: ReactNode }) {
  return (
    <section data-test-selector={`user-remove-${name}`} className="flex flex-col gap-3 rounded-panel border border-line p-4">
      <div className="flex items-start gap-3">
        <Icon name={icon} className="mt-0.5 size-5 shrink-0 text-primary-700" />
        <div className="flex flex-col gap-1">
          <Typography variant="body" weight="medium" as="h3">
            {heading}
          </Typography>
          <Typography variant="small" tone="muted">
            {body}
          </Typography>
        </div>
      </div>
      {children}
    </section>
  );
}

// Deactivate keeps every record naming the person (anti-theft, spec.md) and is the usual path; erase is only for a never-used account.
export function UserRemoveModal({ user, open, onOpenChange }: UserRemoveModalProps) {
  const t = useTranslations("users.remove");
  const tCommon = useTranslations("common");
  const { name } = useUserDisplay()(user);
  const translateError = useTranslateError();
  const toast = useToast();
  const { user: currentUser } = useSession();

  const deactivate = useToggleUserActiveMutation();
  const remove = useDeleteUserMutation();

  const [confirming, setConfirming] = useState<Removal | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reopened on somebody else, the modal drops the last person's half-made decision.
  const target = `${user?.id ?? ""}:${open}`;
  const [shownFor, setShownFor] = useState(target);
  if (shownFor !== target) {
    setShownFor(target);
    setConfirming(null);
    setError(null);
  }

  const isSelf = currentUser?.id === user?.id;
  const canDelete = can(currentUser, "user.delete");
  const mayDelete = canDelete && Boolean(user) && !user?.hasHistory && !isSelf;
  const pending = deactivate.isPending || remove.isPending;

  async function run(kind: Removal) {
    if (!user) return;
    setError(null);
    try {
      if (kind === "deactivate") await deactivate.mutateAsync({ id: user.id, isActive: false });
      else await remove.mutateAsync(user.id);
      toast.success(kind === "deactivate" ? "users.remove.deactivate.success" : "users.remove.delete.success");
      onOpenChange(false);
    } catch (err) {
      setConfirming(null);
      setError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  function confirmRow(kind: Removal, label: string) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={kind === "delete" ? "danger" : "primary"}
          isLoading={pending}
          onClick={() => void run(kind)}
          data-test-selector={`user-remove-${kind}-confirm`}
        >
          {label}
        </Button>
        <Button type="button" variant="quiet" disabled={pending} onClick={() => setConfirming(null)}>
          {tCommon("cancel")}
        </Button>
      </div>
    );
  }

  return (
    <Modal
      open={open && user !== null}
      onOpenChange={onOpenChange}
      data-testid="user-remove-modal"
      size="lg"
      title="users.remove.title"
      titleValues={{ name }}
      description="users.remove.description"
    >
      {user && (
        <div className="flex flex-col gap-4">
          <Typography variant="small" tone="muted" dir="ltr" className="self-start break-all">
            {user.email}
          </Typography>

          {error && (
            <Alert tone="danger" data-testid="user-remove-error">
              {error}
            </Alert>
          )}

          {isSelf ? (
            <Alert tone="warning" data-testid="user-remove-self">
              {t("selfHint")}
            </Alert>
          ) : (
            <>
              <RemovalOption name="deactivate" icon="lock" heading={t("deactivate.heading")} body={t("deactivate.body")}>
                {confirming === "deactivate" ? (
                  confirmRow("deactivate", t("deactivate.confirm", { name }))
                ) : (
                  <Button type="button" className="self-start" disabled={pending} onClick={() => setConfirming("deactivate")}>
                    {t("deactivate.action")}
                  </Button>
                )}
              </RemovalOption>

              {canDelete && (
              <RemovalOption
                name="delete"
                icon="trash"
                heading={t("delete.heading")}
                body={mayDelete ? t("delete.body") : t("delete.unavailable")}
              >
                {mayDelete &&
                  (confirming === "delete" ? (
                    <div className="flex flex-col gap-3">
                      <Alert tone="danger" data-testid="user-remove-delete-warning">
                        {t("delete.confirmQuestion", { email: user.email })}
                      </Alert>
                      {confirmRow("delete", t("delete.confirm", { name }))}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="self-start"
                      disabled={pending}
                      onClick={() => setConfirming("delete")}
                    >
                      {t("delete.action")}
                    </Button>
                  ))}
              </RemovalOption>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
