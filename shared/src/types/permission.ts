import type { PERMISSION_ACTIONS } from "@/constants/permissions";

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
