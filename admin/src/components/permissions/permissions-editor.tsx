"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Alert, Button, EmptyState, SaveBar, SearchField, SegmentedControl, useToast } from "@store/ui";
import { DEFAULT_ROLE_PERMISSIONS } from "@store/shared/constants/permissions";
import { isProtectedAction } from "@store/shared/lib/permissions";
import type { PermissionAction, PermissionMatrixPayload } from "@store/shared/types/permission";
import { EDITABLE_ROLES, PERMISSION_GROUPS } from "@/constants/permissions";
import { useUpdateRolePermissionsMutation } from "@/hooks/use-permissions";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useSession } from "@/components/providers/session-provider";
import { PermissionGroupSection } from "@/components/permissions/permission-group-section";
import { ApiError } from "@/lib/api/errors";
import type { EditableRole, PermissionGrid, PermissionLockReason } from "@/types/permission";

type Staged = Partial<Record<EditableRole, Partial<Record<PermissionAction, boolean>>>>;

function savedGrid(matrix: PermissionMatrixPayload): PermissionGrid {
  return {
    MANAGER: new Set(matrix.roles.MANAGER ?? []),
    EMPLOYEE: new Set(matrix.roles.EMPLOYEE ?? []),
  };
}

// Lower-cased and stripped of Arabic diacritics, so "صلاحية" finds "صَلاحية".
function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/[ً-ْـ]/g, "");
}

interface PermissionsEditorProps {
  matrix: PermissionMatrixPayload;
}

// Edits are staged and written together from the SaveBar: a slip must never change what staff can do at once.
export function PermissionsEditor({ matrix }: PermissionsEditorProps) {
  const t = useTranslations("permissions");
  const toast = useToast();
  const translateError = useTranslateError();
  const { user } = useSession();
  const mutation = useUpdateRolePermissionsMutation();

  const [staged, setStaged] = useState<Staged>({});
  const [phoneRole, setPhoneRole] = useState<EditableRole>("EMPLOYEE");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const saved = useMemo(() => savedGrid(matrix), [matrix]);
  const grid = useMemo<PermissionGrid>(() => {
    const next = { MANAGER: new Set(saved.MANAGER), EMPLOYEE: new Set(saved.EMPLOYEE) };
    for (const role of EDITABLE_ROLES) {
      for (const [action, granted] of Object.entries(staged[role] ?? {})) {
        if (granted) {
          next[role].add(action as PermissionAction);
        } else {
          next[role].delete(action as PermissionAction);
        }
      }
    }
    return next;
  }, [saved, staged]);

  const ownRole = user?.role;
  const ownRoleIsEditable = EDITABLE_ROLES.some((role) => role === ownRole);

  function lockedReason(role: EditableRole, action: PermissionAction): PermissionLockReason | null {
    if (isProtectedAction(action)) {
      return "protected";
    }
    return role === ownRole ? "ownRole" : null;
  }

  // Staging the saved value again drops the entry, so the change count stays honest.
  function setGrant(next: Staged, role: EditableRole, action: PermissionAction, granted: boolean) {
    const forRole = { ...next[role] };
    if (saved[role].has(action) === granted) {
      delete forRole[action];
    } else {
      forRole[action] = granted;
    }
    return { ...next, [role]: forRole };
  }

  function toggle(role: EditableRole, action: PermissionAction, granted: boolean) {
    setFailure(null);
    setStaged((current) => setGrant(current, role, action, granted));
  }

  function restoreDefaults() {
    setFailure(null);
    setStaged(() => {
      let next: Staged = {};
      for (const role of EDITABLE_ROLES) {
        const defaults = new Set<PermissionAction>(DEFAULT_ROLE_PERMISSIONS[role]);
        for (const group of PERMISSION_GROUPS) {
          for (const action of group.actions) {
            if (!lockedReason(role, action)) {
              next = setGrant(next, role, action, defaults.has(action));
            }
          }
        }
      }
      return next;
    });
  }

  const changeCount = EDITABLE_ROLES.reduce((sum, role) => sum + Object.keys(staged[role] ?? {}).length, 0);

  async function save() {
    setSaving(true);
    setFailure(null);
    try {
      for (const role of EDITABLE_ROLES) {
        const changes = Object.entries(staged[role] ?? {}).map(([action, granted]) => ({ action, granted: !!granted }));
        if (changes.length === 0) {
          continue;
        }
        await mutation.mutateAsync({ role, changes });
        // A role that landed is cleared at once, so a later failure leaves only what is still unsaved.
        setStaged((current) => ({ ...current, [role]: {} }));
      }
      toast.success("permissions.saved");
    } catch (error) {
      setFailure(translateError(error instanceof ApiError ? error.code : "error.internal"));
    } finally {
      setSaving(false);
    }
  }

  const needle = normalize(query.trim());
  const groups = PERMISSION_GROUPS.map((group) => ({
    group,
    actions: needle
      ? group.actions.filter((action) =>
          normalize(`${t(`actions.${action}`)} ${t(`groups.${group.key}`)}`).includes(needle),
        )
      : group.actions,
  })).filter((entry) => entry.actions.length > 0);

  return (
    <div className="flex flex-col gap-4 pb-24">
      {ownRoleIsEditable && (
        <Alert tone="neutral" icon="lock" data-testid="permissions-own-role">
          {t("ownRole")}
        </Alert>
      )}

      {failure && (
        <Alert tone="danger" data-testid="permissions-error">
          {failure}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-64 flex-1 sm:max-w-md">
          <SearchField
            data-testid="permissions-search"
            label={t("search.label")}
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            clearLabel={t("search.clear")}
          />
        </div>
        <Button
          variant="secondary"
          data-test-selector="permissions-restore-defaults"
          icon={<RotateCcw className="size-4" aria-hidden="true" />}
          onClick={restoreDefaults}
        >
          {t("restoreDefaults")}
        </Button>
        <div className="w-full lg:hidden">
          <SegmentedControl
            data-testid="permissions-role"
            label={t("rolePicker")}
            value={phoneRole}
            onChange={(role) => setPhoneRole(role as EditableRole)}
            options={EDITABLE_ROLES.map((role) => ({ value: role, label: t(`role.${role}`) }))}
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          data-testid="permissions-no-match"
          icon="search"
          title="permissions.empty.title"
          hint="permissions.empty.hint"
        />
      ) : (
        groups.map(({ group, actions }, index) => (
          <PermissionGroupSection
            key={group.key}
            group={group}
            actions={actions}
            grid={grid}
            saved={saved}
            phoneRole={phoneRole}
            forceOpen={needle.length > 0}
            defaultOpen={index === 0}
            lockedReason={lockedReason}
            onToggle={toggle}
          />
        ))
      )}

      <SaveBar
        data-testid="permissions-save-bar"
        visible={changeCount > 0}
        saving={saving}
        message={t("changes", { count: changeCount })}
        onDiscard={() => {
          setFailure(null);
          setStaged({});
        }}
        onSave={() => void save()}
      />
    </div>
  );
}
