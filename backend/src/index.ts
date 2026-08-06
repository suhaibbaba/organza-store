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
import settingsRouter from "@/routes/settings";
import imagesRouter from "@/routes/images";
import pushRouter from "@/routes/push";
import versionRouter from "@/routes/version";
import { errorHandler } from "@/middleware/errorHandler";
import { AppError, sendError } from "@/lib/response";
import { UPLOAD_DIR } from "@/lib/image";
import { ERROR_CODES } from "@/constants";

const app = express();

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
  res.json({ success: true, data: { status: "ok" }, meta: null });
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
app.use("/api/settings", settingsRouter);
app.use("/api/images", imagesRouter);
app.use("/api/push", pushRouter);

app.use((_req, res) => {
  sendError(res, new AppError(404, ERROR_CODES.NOT_FOUND));
});

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Organza Store API listening on port ${port}`);
});
