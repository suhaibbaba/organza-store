import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@/lib/auth";
import dashboardRouter from "@/routes/dashboard";
import productsRouter from "@/routes/products";
import variantTypesRouter from "@/routes/variantTypes";
import categoriesRouter from "@/routes/categories";
import inventoryRouter from "@/routes/inventory";
import changeRequestsRouter from "@/routes/changeRequests";
import ordersRouter from "@/routes/orders";
import expensesRouter from "@/routes/expenses";
import expenseCategoriesRouter from "@/routes/expenseCategories";
import cashSessionsRouter from "@/routes/cashSessions";
import reportsRouter from "@/routes/reports";
import usersRouter from "@/routes/users";
import passwordSetupRouter from "@/routes/passwordSetup";
import settingsRouter from "@/routes/settings";
import permissionsRouter from "@/routes/permissions";
import imagesRouter from "@/routes/images";
import pushRouter from "@/routes/push";
import versionRouter from "@/routes/version";
import { errorHandler } from "@/middleware/errorHandler";
import { AppError, sendError } from "@/lib/response";
import { UPLOAD_DIR, checkUploadDirWritable } from "@/lib/image";
import { getBackupHealth, startBackupStalenessWatch } from "@/lib/backups";
import { loadPermissionConfig } from "@/lib/permissionConfig";
import { TRUST_PROXY_SETTING, describeProxyTrust } from "@/lib/proxyTrust";
import { captureException } from "@/lib/logger";
import { ERROR_CODES } from "@/constants";

const app = express();

// Whether this process can actually keep an uploaded photo, established once
// at startup and reported by /health (see the listen callback at the bottom).
// Optimistic until proven otherwise so /health answers during the moment
// between listening and the check completing.
let uploadsWritable = true;

// Behind the VPS's TLS-terminating reverse proxy, req.ip is the proxy unless
// express is told how many hops to look through — and the password endpoints'
// rate limit is only worth anything if it counts real callers rather than
// counting nginx once. Off unless configured, because trusting
// X-Forwarded-For with nothing in front of the app lets any caller claim any
// address. Parsed in lib/proxyTrust.ts, which owns both halves of this
// question and says out loud what it decided (see the listen callback).
if (TRUST_PROXY_SETTING !== null) {
  app.set("trust proxy", TRUST_PROXY_SETTING);
}

const corsOrigins = (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(helmet());

// Better Auth handles its own request body parsing, so it must be mounted
// before express.json() touches the request stream.
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());

// Processed product/variant images (thumbnail/medium/full WebP), served
// directly off disk — CLAUDE.md: images stored locally on the VPS.
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/health", async (_req, res) => {
  // `uploads` is the one piece of state a container cannot rebuild for
  // itself, so it is worth being able to ask after a deploy — from the
  // outside, without an upload and without shell access. A boolean and
  // nothing more: this route is public, and the absolute path on the VPS is
  // not the internet's business.
  //
  // `backup` is here for the mirror-image reason. The uploads volume can be
  // lost by a deploy; everything in the stack can be lost by the disk, and
  // the only thing standing between the shop and that is a cron entry on the
  // host that nothing in this codebase can see. A schedule that stopped
  // firing raises no error anywhere — so the age of the last successful run
  // is served next to the thing every uptime check already reads. Two fields,
  // no figures from the shop's books, no path and no bucket.
  //
  // Read live rather than cached, and never allowed to fail the route: if the
  // database is unreachable, that is a much louder problem than a backup
  // question, and /health still has to answer it (see lib/backups.ts).
  let backup: { lastSuccessAt: string | null; stale: boolean } | null = null;
  try {
    const health = await getBackupHealth();
    backup = { lastSuccessAt: health.lastSuccessAt?.toISOString() ?? null, stale: health.stale };
  } catch {
    // Left null: "we could not tell you" rather than a reassuring false.
  }

  res.json({ success: true, data: { status: "ok", uploadsWritable, backup }, meta: null });
});

// Open, like /health above — see routes/version.ts for why.
app.use("/api/version", versionRouter);

app.use("/api/dashboard", dashboardRouter);
app.use("/api/products", productsRouter);
app.use("/api/variant-types", variantTypesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/change-requests", changeRequestsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/expense-categories", expenseCategoriesRouter);
app.use("/api/cash-sessions", cashSessionsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/users", usersRouter);
// Unauthenticated by design — somebody with no password cannot sign in to
// ask for one. Every route on it is rate-limited and none of them confirms
// that an account exists (see routes/passwordSetup.ts).
app.use("/api/password-setup", passwordSetupRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/permissions", permissionsRouter);
app.use("/api/images", imagesRouter);
app.use("/api/push", pushRouter);

app.use((_req, res) => {
  sendError(res, new AppError(404, ERROR_CODES.NOT_FOUND));
});

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, async () => {
  console.log(`Organza Store API listening on port ${port}`);

  // WHO MAY DO WHAT, read into memory before the first request arrives
  // (lib/permissionConfig.ts). Awaited rather than fired off: until it lands,
  // `can()` answers from the shipped defaults, and a shop that has switched an
  // Employee permission off should not get one request's worth of it back
  // every time the API restarts. A failure here is reported and NOT fatal —
  // the defaults are a working shop, and the next request's freshness check
  // tries again.
  await loadPermissionConfig();

  // The one alarm nothing else can raise. ops/backup.sh reports its own
  // failures, but a backup that stopped being *run* — a cron entry lost in a
  // server move, a host rebuilt without it — fails silently by definition,
  // because nothing runs to fail. This is the process that is always up, so
  // this is where the question gets asked (lib/backups.ts). Started before
  // the uploads check below, which returns early on the happy path.
  startBackupStalenessWatch();

  // WHO THE CALLERS LOOK LIKE, said out loud on every start — next to the
  // uploads path below, and for the same reason: it is a question that cannot
  // be answered from outside the process, whose wrong answer breaks nothing
  // visibly, and whose symptom arrives weeks later as "nobody can sign in".
  //
  // A deployed build that has been told nothing gets the paragraph and an
  // entry in error tracking, because at that point every per-caller rate
  // limit in the system is one shared bucket (lib/proxyTrust.ts).
  const proxyTrust = describeProxyTrust();
  if (proxyTrust.level === "warn") {
    console.error(proxyTrust.lines.join("\n"));
    captureException(new Error("Proxy trust is not configured on a deployed build"), {
      trustProxy: TRUST_PROXY_SETTING,
      hint: proxyTrust.lines.join(" "),
    });
  } else {
    console.log(proxyTrust.lines.join("\n"));
  }

  // Where the photographs go, said out loud on every start. One line in
  // `docker compose logs backend` that answers "is the volume actually
  // mounted where the app is writing?" — the question behind every uploaded
  // image the shop has lost.
  const uploads = await checkUploadDirWritable();
  uploadsWritable = uploads.ok;

  if (uploads.ok) {
    console.log(`Uploads directory: ${UPLOAD_DIR} (writable)`);
    return;
  }

  // Not fatal (see checkUploadDirWritable) — but it must be impossible to
  // miss, and it goes to error tracking as well, because the alternative is
  // finding out from a member of staff a week later.
  captureException(uploads.error, {
    uploadDir: UPLOAD_DIR,
    hint:
      "The API cannot write uploaded images here. Check that the volume is mounted at this exact " +
      "path and that the container's user owns it (docker-compose.sandbox.yml sets UPLOAD_DIR).",
  });
  console.error(`Uploads directory: ${UPLOAD_DIR} is NOT WRITABLE — image uploads will fail.`);
});
