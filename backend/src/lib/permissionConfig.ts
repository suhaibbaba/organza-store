import { Prisma } from "@prisma/client";
import { isConfigurableAction, setConfigurablePermissions } from "@organza/shared/lib/permissions";
import type { ConfigurableAction, ConfigurablePermissionMatrix } from "@organza/shared/types/permission";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import { PERMISSION_CACHE_TTL_MS } from "@/constants";

// ===========================================================================
//  The permission cache
// ===========================================================================
//
// `can()` is synchronous and is called dozens of times per request — reading
// the RolePermission table on each of those calls would put a database
// round-trip inside every `if` in the codebase. So the table is read into
// memory (into shared's own `can()` module, via setConfigurablePermissions)
// and answered from there.
//
// Which leaves the only hard part: keeping several processes' copies honest.
// There is no Redis here and nothing to add one for, so the mechanism is the
// database itself, in two halves:
//
//   1. THE PROCESS THAT CHANGES IT refreshes immediately, inside the request
//      that made the change (`invalidatePermissionConfig`). Whoever just
//      unticked a box never sees their own change fail to take.
//
//   2. EVERY OTHER PROCESS checks a VERSION, not the table. The version is a
//      digest of the whole (role, action, granted) set — one row back, from a
//      table of a few dozen rows — and it is only asked for once per
//      PERMISSION_CACHE_TTL_MS, on the way through requireAuth, which is
//      already awaiting a session lookup. When the digest is unchanged (the
//      normal case, all day, every day) nothing else happens; when it moves,
//      the table is re-read once.
//
// A digest rather than MAX(updatedAt) on purpose: a timestamp is only as
// precise as the column (milliseconds), and two edits inside one millisecond
// would leave a process convinced nothing had changed — a permission stuck
// stale until the next unrelated edit. A digest of the actual grants cannot
// miss a change, because it IS the grants.
//
// The failure mode is chosen too: if the database cannot be reached, the last
// good matrix stays in force and the error is reported. Permissions that are
// a few seconds old are a working shop; permissions that evaporate because a
// query timed out are a shop where nobody can sell anything.

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

/**
 * The cache, as a class with its dependencies handed in — so the staleness
 * logic can be tested for what it actually promises (no probe inside the
 * window, a re-read when the version moves, no re-read when it has not,
 * immediate effect on a local change) without a database or a clock.
 */
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
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const [matrix, version] = await Promise.all([this.loadMatrix(), this.loadVersion()]);
        setConfigurablePermissions(matrix);
        this.version = version;
        this.loaded = true;
      } catch (error) {
        // Deliberately does NOT clear what is already published: the last
        // known-good rules keep the shop running while the database is
        // unreachable. `loaded` stays false, so this is retried — once per
        // window, not once per request (see ensureFresh).
        this.onError(error);
      } finally {
        this.lastProbeAt = this.now();
        this.hasProbed = true;
        this.pending = null;
      }
    })();
    return this.pending;
  }

  /**
   * The per-request call. Cheap by design: inside the freshness window it
   * does nothing at all, and outside it, it asks one question whose usual
   * answer is "no change".
   */
  async ensureFresh(): Promise<void> {
    if (this.pending) return this.pending;
    // One attempt per window, whether the last one SUCCEEDED OR FAILED. The
    // failed case is the one that matters: a database that is refusing
    // connections must not be asked again by every request that arrives while
    // it is down, which is exactly when it can least afford the company.
    if (this.hasProbed && this.now() - this.lastProbeAt < this.ttlMs) return;
    if (!this.loaded) return this.reload();

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

/**
 * A digest of every stored grant, ordered, as one row.
 *
 * Ordered inside the aggregate so two databases with the same grants always
 * produce the same string regardless of physical row order, and computed in
 * Postgres so the rows never cross the wire for a check whose answer is
 * almost always "nothing changed". `coalesce` covers the empty table (a
 * database that has not been bootstrapped yet), which is a version like any
 * other rather than a special case.
 */
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

/**
 * The stored grants themselves.
 *
 * Rows for actions that are not configurable are skipped rather than
 * honoured. They cannot be written through the API, so one could only arrive
 * by hand or survive from a release where the action was still configurable —
 * and in both cases the answer is the same: a protected action is not
 * negotiable, and a stale row must not quietly make it look like it is.
 */
async function loadStoredMatrix(): Promise<ConfigurablePermissionMatrix> {
  const rows = await prisma.rolePermission.findMany({ select: { role: true, action: true, granted: true } });
  const matrix: ConfigurablePermissionMatrix = {};
  for (const row of rows) {
    if (!isConfigurableAction(row.action)) continue;
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
