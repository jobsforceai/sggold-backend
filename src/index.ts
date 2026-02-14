import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongoose.js";
import { requireApiKey } from "./middleware/requireApiKey.js";
import assetRoutes from "./routes/assetRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import tradeRoutes from "./routes/tradeRoutes.js";
import schemeRoutes from "./routes/schemeRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/assets", requireApiKey, assetRoutes);
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/trade", tradeRoutes);
app.use("/api/v1/scheme", schemeRoutes);
app.use("/api/v1/delivery", deliveryRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ message: "Invalid request", issues: error.issues });
  }

  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
});

async function bootstrap() {
  await connectMongo();

  app.listen(env.PORT, () => {
    console.log(`[server] running on http://localhost:${env.PORT}`);
  });
}

bootstrap();
