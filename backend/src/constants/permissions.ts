export * from "@store/shared/constants/permissions";

/** How long a process serves its cached permission matrix before probing the database for changes (never on can()'s path). */
export const PERMISSION_CACHE_TTL_MS = 5_000;
