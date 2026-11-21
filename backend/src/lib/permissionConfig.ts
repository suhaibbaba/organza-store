import { Prisma } from "@prisma/client";
import { isConfigurableAction, setConfigurablePermissions } from "@store/shared/lib/permissions";
import type { ConfigurableAction, ConfigurablePermissionMatrix } from "@store/shared/types/permission";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import { PERMISSION_CACHE_TTL_MS } from "@/constants";

// can() is synchronous, so grants are cached in memory and refreshed via a cheap digest probe, never a query per call.

type VersionLoader = () => Promise<string>;
type MatrixLoader = () => Promise<ConfigurablePermissionMatrix>;

export interface PermissionCacheOptions {
  loadVersion: VersionLoader;
  loadMatrix: MatrixLoader;
  /** Injected so tests can move time without waiting for it. */
  now?: () => number;
  ttlMs?: number;
  onError?: (error: unknown) => void;
}

/** The cache with injected dependencies, so its staleness promises are testable without a database or clock. */
export class PermissionCache {
  private readonly loadVersion: VersionLoader;
  private readonly loadMatrix: MatrixLoader;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly onError: (error: unknown) => void;

  private version: string | null = null;
  private lastProbeAt = 0;
  /** Whether the window has ever started — told apart from "at time zero". */
  private hasProbed = false;
  private loaded = false;
  /** In-flight refresh, so a burst of concurrent requests causes one read. */
  private pending: Promise<void> | null = null;

  constructor(options: PermissionCacheOptions) {
    this.loadVersion = options.loadVersion;
    this.loadMatrix = options.loadMatrix;
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? PERMISSION_CACHE_TTL_MS;
    this.onError = options.onError ?? ((error) => captureException(error));
  }

  /** True once a matrix has actually been read from the database. */
  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Read the table and publish it to `can()`, whatever the version says. */
  async reload(): Promise<void> {
    if (this.pending) {
      return this.pending;
    }
    this.pending = (async () => {
      try {
        const [matrix, version] = await Promise.all([this.loadMatrix(), this.loadVersion()]);
        setConfigurablePermissions(matrix);
        this.version = version;
        this.loaded = true;
      } catch (error) {
        // Keeps the last good rules while the database is unreachable; retried once per window, not per request.
        this.onError(error);
      } finally {
        this.lastProbeAt = this.now();
        this.hasProbed = true;
        this.pending = null;
      }
    })();
    return this.pending;
  }

  /** The per-request call: nothing inside the window, one cheap probe outside it. */
  async ensureFresh(): Promise<void> {
    if (this.pending) {
      return this.pending;
    }
    // One attempt per window whether the last succeeded or failed, so a down database is not hammered.
    if (this.hasProbed && this.now() - this.lastProbeAt < this.ttlMs) {
      return;
    }
    if (!this.loaded) {
      return this.reload();
    }

    this.pending = (async () => {
      try {
        const version = await this.loadVersion();
        if (version !== this.version) {
          setConfigurablePermissions(await this.loadMatrix());
          this.version = version;
        }
      } catch (error) {
        this.onError(error);
      } finally {
        this.lastProbeAt = this.now();
        this.hasProbed = true;
        this.pending = null;
      }
    })();
    return this.pending;
  }

  /** After a write in THIS process: re-read now, and restart the window. */
  async invalidate(): Promise<void> {
    this.loaded = false;
    this.version = null;
    this.hasProbed = false;
    await this.reload();
  }
}

// --- the real loaders -------------------------------------------------------

/** A digest of every stored grant computed in Postgres, ordered so equal grants always give the same string. */
async function loadStoredVersion(): Promise<string> {
  const rows = await prisma.$queryRaw<{ digest: string }[]>(Prisma.sql`
    SELECT coalesce(
             md5(string_agg("role"::text || ':' || "action" || ':' || "granted"::text, ',' ORDER BY "role", "action")),
             'empty'
           ) AS digest
    FROM "RolePermission"
  `);
  return rows[0]?.digest ?? "empty";
}

/** Stored rows for non-configurable actions are ignored: a protected action is never negotiable. */
async function loadStoredMatrix(): Promise<ConfigurablePermissionMatrix> {
  const rows = await prisma.rolePermission.findMany({ select: { role: true, action: true, granted: true } });
  const matrix: ConfigurablePermissionMatrix = {};
  for (const row of rows) {
    if (!isConfigurableAction(row.action)) {
      continue;
    }
    const forRole = (matrix[row.role] ??= {} as Partial<Record<ConfigurableAction, boolean>>);
    forRole[row.action] = row.granted;
  }
  return matrix;
}

export const permissionCache = new PermissionCache({
  loadVersion: loadStoredVersion,
  loadMatrix: loadStoredMatrix,
});

/** Called once on boot (src/index.ts), before the first request arrives. */
export async function loadPermissionConfig(): Promise<void> {
  await permissionCache.reload();
}

/** Called from requireAuth, on the request path. */
export async function ensurePermissionConfigFresh(): Promise<void> {
  await permissionCache.ensureFresh();
}

/** Called by the route that just changed a grant. */
export async function invalidatePermissionConfig(): Promise<void> {
  await permissionCache.invalidate();
}
