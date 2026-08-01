import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import productsRouter from "./routes/products";
import variantTypesRouter from "./routes/variantTypes";
import categoriesRouter from "./routes/categories";
import { errorHandler } from "./middleware/errorHandler";
import { AppError, sendError } from "./lib/response";

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

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" }, meta: null });
});

app.use("/api/products", productsRouter);
app.use("/api/variant-types", variantTypesRouter);
app.use("/api/categories", categoriesRouter);

app.use((_req, res) => {
  sendError(res, new AppError(404, "error.not_found"));
});

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Organza Store API listening on port ${port}`);
});
