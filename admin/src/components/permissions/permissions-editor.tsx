"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Card, SegmentedControl } from "@store/ui";
import { isFixedRole, isProtectedAction } from "@store/shared/lib/permissions";
import type { PermissionAction, PermissionMatrixPayload } from "@store/shared/types/permission";
import type { Role } from "@store/shared/types/role";
import { PERMISSION_GROUPS, PERMISSION_MATRIX_ROLES } from "@/constants/permissions";
import { useUpdateRolePermissionsMutation } from "@/hooks/use-permissions";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useSession } from "@/components/providers/session-provider";
import { PermissionLock } from "@/components/permissions/permission-lock";
import { PermissionToggle } from "@/components/permissions/permission-toggle";
import { ApiError } from "@/lib/api/errors";
import type { PermissionLockReason } from "@/types/permission";

// Phone shows one role at a time, desktop the full matrix; both render the same payload so they cannot disagree.

interface PermissionsEditorProps {
  matrix: PermissionMatrixPayload;
}

export function PermissionsEditor({ matrix }: PermissionsEditorProps) {
  const t = useTranslations("permissions");
  const translateError = useTranslateError();
  const { user } = useSession();
  const mutation = useUpdateRolePermissionsMutation();

  // Starts on the role an Admin most often changes; their own is not editable.
  const [selectedRole, setSelectedRole] = useState<Role>("EMPLOYEE");
  const [pending, setPending] = useState<{ role: Role; action: PermissionAction } | null>(null);

  const held = useMemo(() => {
    const map = {} as Record<Role, Set<string>>;
    for (const role of PERMISSION_MATRIX_ROLES) {
      map[role] = new Set(matrix.roles?.[role] ?? []);
    }
    return map;
  }, [matrix]);

  const ownRole = (user?.role ?? null) as Role | null;

  function toggle(role: Role, action: PermissionAction, granted: boolean) {
    setPending({ role, action });
    mutation.mutate({ role, changes: [{ action, granted }] }, { onSettled: () => setPending(null) });
  }

  /** Why this cell cannot be tapped — or null when it can. */
  function lockedReason(role: Role, action: PermissionAction): PermissionLockReason | null {
    if (isProtectedAction(action)) {
      return "protected";
    }
    if (role === ownRole) {
      return "ownRole";
    }
    if (isFixedRole(role)) {
      return "adminRole";
    }
    return null;
  }

  const failure = mutation.isError
    ? translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Said up front so the padlocks below read as design, not a fault. */}
      <Alert tone="info" icon="shield" title={t("intro.title")} data-testid="alert-default">
        {t("intro.body")}
      </Alert>

      {failure && (
        <Alert tone="danger" data-testid="alert-destructive">
          {failure}
        </Alert>
      )}

      {/* ---------- phone: one role at a time ---------- */}
      <div className="flex flex-col gap-4 lg:hidden">
        <SegmentedControl
          data-testid="segmented"
          label={t("rolePicker")}
          value={selectedRole}
          onChange={(role) => setSelectedRole(role as Role)}
          options={PERMISSION_MATRIX_ROLES.map((role) => ({ value: role, label: t(`role.${role}`) }))}
        />

        {selectedRole === ownRole ? (
          <Alert tone="neutral" icon="lock" data-testid="alert-default">
            {t("ownRole")}
          </Alert>
        ) : (
          isFixedRole(selectedRole) && (
            <Alert tone="neutral" icon="lock" data-testid="alert-default">
              {t("adminRole")}
            </Alert>
          )
        )}

        {PERMISSION_GROUPS.map((group) => (
          <Card key={group.key} className="flex flex-col gap-3">
            <h3 className="text-section font-semibold text-ink">{t(`groups.${group.key}`)}</h3>
            <div className="flex flex-col divide-y divide-line">
              {group.actions.map((action) => {
                const reason = lockedReason(selectedRole, action);
                const label = t(`actions.${action}`);
                return (
                  <div key={action} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-label font-medium text-ink">{label}</span>
                      {reason === "protected" && (
                        <span className="text-meta text-ink-muted">{t("locked.protected")}</span>
                      )}
                    </div>

                    {reason ? (
                      <PermissionLock
                        reason={reason}
                        granted={reason === "protected" ? undefined : held[selectedRole].has(action)}
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
            </div>
          </Card>
        ))}
      </div>

      {/* ---------- desktop: the matrix ---------- */}
      <div className="hidden flex-col gap-4 lg:flex">
        {PERMISSION_GROUPS.map((group) => (
          <Card key={group.key} flush className="overflow-hidden">
            <h3 className="px-5 pb-3 pt-4 text-section font-semibold text-ink">{t(`groups.${group.key}`)}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-label">
                <thead>
                  <tr className="border-b border-line bg-table-head text-meta uppercase tracking-wide text-ink-muted">
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
                      <tr key={action} className="border-b border-line last:border-0 hover:bg-row-hover">
                        <th scope="row" className="px-5 py-3 text-start font-normal text-ink">
                          {label}
                        </th>

                        {isProtected ? (
                          // One cell across all roles: three padlocks in a row would look like three faults.
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
            </div>
          </Card>
        ))}

        <p className="text-label text-ink-muted">
          {ownRole && isFixedRole(ownRole) ? t("adminRole") : `${t("ownRole")} ${t("adminRole")}`}
        </p>
      </div>
    </div>
  );
}
