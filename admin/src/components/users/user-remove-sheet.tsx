"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useUserDisplay } from "@/lib/user-display";
import { AlertTriangle, Trash2, UserX } from "lucide-react";
import type { User } from "@organza/shared/types/user";
import { useSession } from "@/components/providers/session-provider";
import { useDeleteUserMutation, useToggleUserActiveMutation } from "@/hooks/use-users";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

// Removing somebody from the shop.
//
// TWO DIFFERENT THINGS BEHIND ONE WORD, which is exactly why they are on one
// screen with the difference spelled out rather than behind two buttons
// somebody has to already understand:
//
//   DEACTIVATE — the normal one, and the one this sheet leads with. They can
//     no longer sign in and every device they are signed in on is signed out
//     on the spot, but every order they took, every expense they recorded and
//     every drawer they counted still carries their name. That naming is the
//     anti-theft design (spec.md "Security rationale"), so for anybody who has
//     actually worked here it is the ONLY honest meaning of "remove".
//
//   DELETE — erasing the account itself. Offered only for an account that has
//     never done anything: a typo'd email, a duplicate, somebody set up who
//     never started. The API refuses the rest (`error.user.has_history`), and
//     this screen does not offer what the API would refuse.
//
// The wording is the feature. "Remove" on its own is what makes somebody
// expect history to disappear, so neither button says it: one says the person
// can no longer sign in and their history stays, the other says the account
// and its password are erased. And because they read similarly at a glance on
// a phone, each is confirmed a second time by a button that NAMES the account
// — you cannot tap twice through this by muscle memory.
//
// PROMINENCE AND DANGER ARE SIGNALLED SEPARATELY, which is why deactivate —
// the recommended path — is the PRIMARY button and not a red one. Red here
// would be backwards: deactivating is reversible by the button that replaces
// it, and painting it as the scary option while the irreversible delete sat
// underneath in a quiet outline would tell somebody scanning the sheet the
// exact opposite of the truth. Red is kept for the step that cannot be
// undone, and only for its final confirmation.
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
  // Named the way every other screen names them (lib/user-display.ts) — a
  // confirmation that asks you to delete "Admin mt0grbxoqx7nbf" is a
  // confirmation nobody can check.
  const { name } = useUserDisplay()(user);
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const { user: currentUser } = useSession();

  const deactivate = useToggleUserActiveMutation();
  const remove = useDeleteUserMutation();

  // Which of the two has been chosen and is waiting for its second tap.
  // Null while the sheet is still asking which.
  const [confirming, setConfirming] = useState<"deactivate" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A sheet reopened on somebody else must not still be holding the last
  // person's half-made decision, or the confirm button would name one account
  // while acting on another.
  useEffect(() => {
    setConfirming(null);
    setError(null);
  }, [user?.id, open]);

  if (!user) return null;

  const isSelf = currentUser?.id === user.id;
  // Offered only when the API would allow it. `hasHistory` comes from the
  // list payload and the API re-checks it regardless (CLAUDE.md rule 5) —
  // this only decides whether to put the choice in front of somebody.
  const mayDelete = !user.hasHistory && !isSelf;
  const pending = deactivate.isPending || remove.isPending;

  async function run(kind: "deactivate" | "delete") {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent name="user-remove" side="end" closeLabel={tCommon("close")} className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("title", { name })}</SheetTitle>
          <p className="truncate text-sm text-muted-foreground" dir="ltr">
            {user.email}
          </p>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-5 pb-5">
          {error && <Alert variant="destructive">{error}</Alert>}

          {isSelf ? (
            // You cannot remove yourself, and the backend refuses it
            // (error.user.self_removal). Said here rather than discovered by
            // tapping, because there is nothing useful to offer on this sheet.
            <Alert variant="destructive">{t("selfHint")}</Alert>
          ) : (
            <>
              {/* --- the normal path, first and visually primary --- */}
              <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <UserX className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-foreground">{t("deactivate.heading")}</h3>
                    <p className="text-sm text-muted-foreground">{t("deactivate.body")}</p>
                  </div>
                </div>

                {confirming === "deactivate" ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-foreground">{t("deactivate.confirmQuestion")}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        className="w-full sm:w-auto"
                        disabled={pending}
                        onClick={() => void run("deactivate")}
                      >
                        {pending ? <Spinner /> : null}
                        {t("deactivate.confirm", { name })}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
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

              {/* --- the narrow path --- */}
              <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <Trash2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-foreground">{t("delete.heading")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {mayDelete ? t("delete.body") : t("delete.unavailable")}
                    </p>
                  </div>
                </div>

                {mayDelete &&
                  (confirming === "delete" ? (
                    <div className="flex flex-col gap-2">
                      <Alert variant="destructive">
                        <span className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          {t("delete.confirmQuestion", { email: user.email })}
                        </span>
                      </Alert>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          variant="destructive"
                          className="w-full break-words sm:w-auto"
                          disabled={pending}
                          onClick={() => void run("delete")}
                        >
                          {pending ? <Spinner /> : null}
                          {t("delete.confirm", { name })}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
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
                      variant="outline"
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
      </SheetContent>
    </Sheet>
  );
}
