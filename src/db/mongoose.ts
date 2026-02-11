import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 1500 });
    console.log("[mongo] connected");
  } catch {
    console.warn("[mongo] unavailable, continuing in stateless mode");
  }
}
