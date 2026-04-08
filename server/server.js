import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "lifepilot-dev-only-change-in-production";
  console.warn("Using default JWT_SECRET (set JWT_SECRET in .env for production)");
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:8080",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFound);
app.use(errorHandler);

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lifepilot";

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("MongoDB connected");
    console.log(
      "Note: This API does not create Supabase/Postgres tables. Use: npm run db:sync (from repo root) or Supabase SQL Editor."
    );
    app.listen(PORT, () => console.log(`Optional Mongo API: http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed — optional API not started:", err.message);
    console.error("The LifePilot web app uses Supabase; start MongoDB only if you need this REST API.");
  });
