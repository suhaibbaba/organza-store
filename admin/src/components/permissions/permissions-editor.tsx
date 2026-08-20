"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, ShieldCheck } from "lucide-react";
import { isProtectedAction } from "@organza/shared/lib/permissions";
import type { PermissionAction, PermissionMatrixPayload } from "@organza/shared/types/permission";
import type { Role } from "@organza/shared/types/role";
import { PERMISSION_GROUPS, PERMISSION_MATRIX_ROLES } from "@/constants/permissions";
import { useUpdateRolePermissionsMutation } from "@/hooks/use-permissions";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useSession } from "@/components/providers/session-provider";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PermissionLock } from "@/components/permissions/permission-lock";
import { PermissionToggle } from "@/components/permissions/permission-toggle";
import { ApiError } from "@/lib/api/errors";
import type { PermissionLockReason } from "@/types/permission";

// The Permissions screen (spec.md "Editable role permissions").
//
// Two renderings of one model, because the two readers are different:
//
//   * a PHONE, which is ~95% of use (CLAUDE.md): one role at a time, picked
//     with a segmented control, then a plain list of switches grouped by the
//     part of the shop they belong to. A 3-by-45 grid on a 390px screen is
//     not a matrix, it is a wall.
//   * a DESKTOP (lg and up): the actual matrix — actions down, roles across —
//     because that is where "who can do what" is a question you answer by
//     comparing columns.
//
// Both are driven by PERMISSION_GROUPS and by the payload the API served, so
// they cannot disagree about what is on or off.

interface PermissionsEditorProps {
  matrix: PermissionMatrixPayload;
}

export function PermissionsEditor({ matrix }: PermissionsEditorProps) {
  const t = useTranslations("permissions");
  const translateError = useTranslateError();
  const { user } = useSession();
  const mutation = useUpdateRolePermissionsMutation();

  // The role the phone layout is showing. Starts on the one an Admin most
  // often comes here to change — their own is not editable at all.
  const [selectedRole, setSelectedRole] = useState<Role>("EMPLOYEE");
  const [pending, setPending] = useState<{ role: Role; action: PermissionAction } | null>(null);

  const held = useMemo(() => {
    const map = {} as Record<Role, Set<string>>;
    for (const role of PERMISSION_MATRIX_ROLES) map[role] = new Set(matrix.roles?.[role] ?? []);
    return map;
  }, [matrix]);

  const ownRole = (user?.role ?? null) as Role | null;

  function toggle(role: Role, action: PermissionAction, granted: boolean) {
    setPending({ role, action });
    mutation.mutate(
      { role, changes: [{ action, granted }] },
      { onSettled: () => setPending(null) }
    );
  }

  /** Why this cell cannot be tapped — or null when it can. */
  function lockedReason(role: Role, action: PermissionAction): PermissionLockReason | null {
    if (isProtectedAction(action)) return "protected";
    if (role === ownRole) return "ownRole";
    return null;
  }

  const failure = mutation.isError
    ? translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* What this screen will not do, said before anybody looks for it — so
          the padlocks further down read as a design and not as a fault. */}
      <Alert>
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t("intro.title")}</p>
          <p className="text-muted-foreground">{t("intro.body")}</p>
        </div>
      </Alert>

      {failure && (
        <Alert variant="destructive" role="alert">
          <p>{failure}</p>
        </Alert>
      )}

      {/* ---------- phone: one role at a time ---------- */}
      <div className="flex flex-col gap-4 lg:hidden">
        <SegmentedControl
          label={t("rolePicker")}
          value={selectedRole}
          onChange={(role) => setSelectedRole(role as Role)}
          options={PERMISSION_MATRIX_ROLES.map((role) => ({ value: role, label: t(`role.${role}`) }))}
        />

        {selectedRole === ownRole && (
          <Alert>
            <Lock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>{t("ownRole")}</p>
          </Alert>
        )}

        {PERMISSION_GROUPS.map((group) => (
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t(`groups.${group.key}`)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {group.actions.map((action) => {
                const reason = lockedReason(selectedRole, action);
                const label = t(`actions.${action}`);
                return (
                  <div key={action} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      {reason === "protected" && (
                        <span className="text-xs text-muted-foreground">{t("locked.protected")}</span>
                      )}
                    </div>

                    {reason ? (
                      <PermissionLock
                        reason={reason}
                        granted={reason === "ownRole" ? held[selectedRole].has(action) : undefined}
                        className="shrink-0"
                        compact
                      />
                    ) : (
                      <PermissionToggle
                        role={selectedRole}
                        action={action}
                        actionLabel={label}
                        granted={held[selectedRole].has(action)}
                        busy={pending?.role === selectedRole && pending.action === action}
                        onChange={(granted) => toggle(selectedRole, action, granted)}
                      />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---------- desktop: the matrix ---------- */}
      <div className="hidden flex-col gap-4 lg:flex">
        {PERMISSION_GROUPS.map((group) => (
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t(`groups.${group.key}`)}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-5 py-2 text-start font-medium">
                      {t("table.action")}
                    </th>
                    {PERMISSION_MATRIX_ROLES.map((role) => (
                      <th key={role} scope="col" className="w-32 px-5 py-2 text-center font-medium">
                        {t(`role.${role}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.actions.map((action) => {
                    const label = t(`actions.${action}`);
                    const isProtected = isProtectedAction(action);
                    return (
                      <tr key={action} className="border-b border-border last:border-0">
                        <th scope="row" className="px-5 py-3 text-start font-normal text-foreground">
                          {label}
                        </th>

                        {isProtected ? (
                          // One cell across the three roles, carrying the
                          // reason — rather than three padlocks in a row,
                          // which would look like three separate faults.
                          <td colSpan={PERMISSION_MATRIX_ROLES.length} className="px-5 py-3 text-center">
                            <PermissionLock reason="protected" />
                          </td>
                        ) : (
                          PERMISSION_MATRIX_ROLES.map((role) => {
                            const reason = lockedReason(role, action);
                            return (
                              <td key={role} className="px-5 py-3 text-center">
                                <div className="flex items-center justify-center">
                                  {reason ? (
                                    <PermissionLock reason={reason} granted={held[role].has(action)} compact />
                                  ) : (
                                    <PermissionToggle
                                      role={role}
                                      action={action}
                                      actionLabel={label}
                                      granted={held[role].has(action)}
                                      busy={pending?.role === role && pending.action === action}
                                      onChange={(granted) => toggle(role, action, granted)}
                                    />
                                  )}
                                </div>
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}

        <p className="text-sm text-muted-foreground">{t("ownRole")}</p>
      </div>
    </div>
  );
}
