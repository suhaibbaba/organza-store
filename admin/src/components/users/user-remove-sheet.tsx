"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, UserX } from "lucide-react";
import { Alert, Button, Drawer } from "@store/ui";
import type { User } from "@organza/shared/types/user";
import { useUserDisplay } from "@/lib/user-display";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteUserMutation, useToggleUserActiveMutation } from "@/hooks/use-users";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

type Removal = "deactivate" | "delete";

// Deactivate keeps every record naming the person (anti-theft, spec.md) and is the primary path; delete is offered only for a never-used account and only its final confirm is red.
export function UserRemoveSheet({
  user,
  open,
  onOpenChange,
}: {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("users.remove");
  const { name } = useUserDisplay()(user);
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const { user: currentUser } = useSession();

  const deactivate = useToggleUserActiveMutation();
  const remove = useDeleteUserMutation();

  const [confirming, setConfirming] = useState<Removal | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reopened on somebody else, the drawer must drop the last person's half-made decision.
  const target = `${user?.id ?? ""}:${open}`;
  const [shownFor, setShownFor] = useState(target);
  if (shownFor !== target) {
    setShownFor(target);
    setConfirming(null);
    setError(null);
  }

  if (!user) return null;

  const isSelf = currentUser?.id === user.id;
  const mayDelete = !user.hasHistory && !isSelf;
  const pending = deactivate.isPending || remove.isPending;

  async function run(kind: Removal) {
    if (!user) return;
    setError(null);
    try {
      if (kind === "deactivate") await deactivate.mutateAsync({ id: user.id, isActive: false });
      else await remove.mutateAsync(user.id);
      onOpenChange(false);
    } catch (err) {
      setConfirming(null);
      setError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      data-testid="sheet-user-remove"
      title={t("title", { name })}
      descriptionKey="users.subtitle"
    >
      <div className="flex flex-col gap-4">
        <p className="truncate text-label text-ink-muted" dir="ltr">
          {user.email}
        </p>

        {error && (
          <Alert tone="danger" data-testid="alert-destructive">
            {error}
          </Alert>
        )}

        {isSelf ? (
          <Alert tone="danger" data-testid="alert-destructive">
            {t("selfHint")}
          </Alert>
        ) : (
          <>
            <section className="flex flex-col gap-3 rounded-panel border border-line p-4">
              <div className="flex items-start gap-3">
                <UserX className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  <h3 className="text-label font-semibold text-ink">{t("deactivate.heading")}</h3>
                  <p className="text-label text-ink-muted">{t("deactivate.body")}</p>
                </div>
              </div>

              {confirming === "deactivate" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-label font-medium text-ink">{t("deactivate.confirmQuestion")}</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      isLoading={pending}
                      onClick={() => void run("deactivate")}
                    >
                      {t("deactivate.confirm", { name })}
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      className="w-full sm:w-auto"
                      disabled={pending}
                      onClick={() => setConfirming(null)}
                    >
                      {tCommon("cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  className="w-full sm:w-auto sm:self-start"
                  disabled={pending}
                  onClick={() => setConfirming("deactivate")}
                >
                  {t("deactivate.action")}
                </Button>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-panel border border-line p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  <h3 className="text-label font-semibold text-ink">{t("delete.heading")}</h3>
                  <p className="text-label text-ink-muted">
                    {mayDelete ? t("delete.body") : t("delete.unavailable")}
                  </p>
                </div>
              </div>

              {mayDelete &&
                (confirming === "delete" ? (
                  <div className="flex flex-col gap-2">
                    <Alert tone="danger" data-testid="alert-destructive" icon="alert">
                      {t("delete.confirmQuestion", { email: user.email })}
                    </Alert>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="danger"
                        className="h-auto min-h-(--control-h) w-full whitespace-normal break-words sm:w-auto"
                        isLoading={pending}
                        onClick={() => void run("delete")}
                      >
                        {t("delete.confirm", { name })}
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        className="w-full sm:w-auto"
                        disabled={pending}
                        onClick={() => setConfirming(null)}
                      >
                        {tCommon("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto sm:self-start"
                    disabled={pending}
                    onClick={() => setConfirming("delete")}
                  >
                    {t("delete.action")}
                  </Button>
                ))}
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}
