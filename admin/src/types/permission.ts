import type { IconName, SectionTone } from "@store/ui";
import type { PermissionAction } from "@store/shared/types/permission";

export type EditableRole = "MANAGER" | "EMPLOYEE";

export interface PermissionGroup {
  key: string;
  icon: IconName;
  tone: SectionTone;
  actions: readonly PermissionAction[];
}

// What each editable role holds: the saved grants with the staged edits laid over them.
export type PermissionGrid = Record<EditableRole, ReadonlySet<PermissionAction>>;

// Why a cell cannot be switched — never "it is broken".
export type PermissionLockReason = "protected" | "ownRole";

export interface PermissionGroupSectionProps {
  group: PermissionGroup;
  actions: readonly PermissionAction[];
  grid: PermissionGrid;
  saved: PermissionGrid;
  phoneRole: EditableRole;
  forceOpen: boolean;
  defaultOpen: boolean;
  lockedReason: (role: EditableRole, action: PermissionAction) => PermissionLockReason | null;
  onToggle: (role: EditableRole, action: PermissionAction, granted: boolean) => void;
}
