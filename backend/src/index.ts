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
import customersRouter from "@/routes/customers";
import suppliersRouter from "@/routes/suppliers";
import expensesRouter from "@/routes/expenses";
import expenseCategoriesRouter from "@/routes/expenseCategories";
import cashSessionsRouter from "@/routes/cashSessions";
import reportsRouter from "@/routes/reports";
import usersRouter from "@/routes/users";
import meRouter from "@/routes/me";
import passwordSetupRouter from "@/routes/passwordSetup";
import settingsRouter from "@/routes/settings";
import permissionsRouter from "@/routes/permissions";
import imagesRouter from "@/routes/images";
import pushRouter from "@/routes/push";
import versionRouter from "@/routes/version";
import brandingRouter from "@/routes/branding";
import { errorHandler } from "@/middleware/errorHandler";
import { AppError, sendError } from "@/lib/response";
import { UPLOAD_DIR, checkUploadDirWritable } from "@/lib/image";
import { getBackupHealth, startBackupStalenessWatch } from "@/lib/backups";
import { searchEngineStatus } from "@/lib/search";
import { loadPermissionConfig } from "@/lib/permissionConfig";
import { TRUST_PROXY_SETTING, describeProxyTrust } from "@/lib/proxyTrust";
import { captureException } from "@/lib/logger";
import { ERROR_CODES } from "@/constants";

const app = express();

// Whether uploads can be written, checked once at startup and reported by /health; optimistic until the check lands.
let uploadsWritable = true;

// Trust X-Forwarded-For only when configured (lib/proxyTrust.ts), so rate limits count real callers, not nginx.
if (TRUST_PROXY_SETTING !== null) {
  app.set("trust proxy", TRUST_PROXY_SETTING);
}

const corsOrigins = (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(helmet());

// Better Auth parses its own bodies, so it is mounted before express.json().
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());

// Images served from disk; CORP is cross-origin on this mount only, because the admin and POS load them from another origin.
app.use(
  "/uploads",
  (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(UPLOAD_DIR),
);

app.get("/health", async (_req, res) => {
  // Public health facts: uploads writable and backup staleness, as booleans only, never paths.
  let backup: { lastSuccessAt: string | null; stale: boolean } | null = null;
  try {
    const health = await getBackupHealth();
    backup = { lastSuccessAt: health.lastSuccessAt?.toISOString() ?? null, stale: health.stale };
  } catch {
    // Left null: "we could not tell you" rather than a reassuring false.
  }

  // Which engine answers search, and whether it is up; a down Meilisearch silently degrades to pg_trgm.
  const search = await searchEngineStatus();

  res.json({ success: true, data: { status: "ok", uploadsWritable, backup, search }, meta: null });
});

// Open, like /health above — see routes/version.ts for why.
app.use("/api/version", versionRouter);
app.use("/api/branding", brandingRouter);

app.use("/api/dashboard", dashboardRouter);
app.use("/api/products", productsRouter);
app.use("/api/variant-types", variantTypesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/change-requests", changeRequestsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/expense-categories", expenseCategoriesRouter);
app.use("/api/cash-sessions", cashSessionsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/users", usersRouter);
app.use("/api/me", meRouter);
// Unauthenticated by design and rate-limited; never confirms that an account exists.
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
  console.log(`Store Management API listening on port ${port}`);

  // Permission rules loaded before the first request; a failure falls back to the shipped defaults.
  await loadPermissionConfig();

  // Raises the alarm when backups stop being run at all, which nothing else can notice (lib/backups.ts).
  startBackupStalenessWatch();

  // Logs how callers are identified on every start; a wrong answer only shows weeks later as failed sign-ins.
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

  // Logs where photographs are written on every start, to confirm the volume is mounted.
  const uploads = await checkUploadDirWritable();
  uploadsWritable = uploads.ok;

  if (uploads.ok) {
    console.log(`Uploads directory: ${UPLOAD_DIR} (writable)`);
    return;
  }

  // Not fatal, but reported to error tracking so a lost upload volume is noticed at once.
  captureException(uploads.error, {
    uploadDir: UPLOAD_DIR,
    hint:
      "The API cannot write uploaded images here. Check that the volume is mounted at this exact " +
      "path and that the container's user owns it (docker-compose.sandbox.yml sets UPLOAD_DIR).",
  });
  console.error(`Uploads directory: ${UPLOAD_DIR} is NOT WRITABLE — image uploads will fail.`);
});
