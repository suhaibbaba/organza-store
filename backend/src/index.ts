import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";

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

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Organza Store API listening on port ${port}`);
});
