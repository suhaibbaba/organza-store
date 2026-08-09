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
import imagesRouter from "@/routes/images";
import pushRouter from "@/routes/push";
import versionRouter from "@/routes/version";
import { errorHandler } from "@/middleware/errorHandler";
import { AppError, sendError } from "@/lib/response";
import { UPLOAD_DIR, checkUploadDirWritable } from "@/lib/image";
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
// address (see backend/.env.example).
const trustProxy = process.env.TRUST_PROXY?.trim();
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
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

app.get("/health", (_req, res) => {
  // `uploads` is the one piece of state a container cannot rebuild for
  // itself, so it is worth being able to ask after a deploy — from the
  // outside, without an upload and without shell access. A boolean and
  // nothing more: this route is public, and the absolute path on the VPS is
  // not the internet's business.
  res.json({ success: true, data: { status: "ok", uploadsWritable }, meta: null });
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
app.use("/api/images", imagesRouter);
app.use("/api/push", pushRouter);

app.use((_req, res) => {
  sendError(res, new AppError(404, ERROR_CODES.NOT_FOUND));
});

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, async () => {
  console.log(`Organza Store API listening on port ${port}`);

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
