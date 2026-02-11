import mongoose, { Schema, type Document, type Types } from "mongoose";

export type TransactionType = "buy" | "sell" | "bonus" | "storage_reward" | "scheme_credit" | "withdrawal";
export type TransactionStatus = "pending" | "completed" | "failed" | "cancelled";

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  type: TransactionType;
  amountMg: number;
  pricePerGramPaise: number;
  totalPaise: number;
  bonusMg: number;
  metadata: Record<string, unknown>;
  status: TransactionStatus;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["buy", "sell", "bonus", "storage_reward", "scheme_credit", "withdrawal"], required: true },
    amountMg: { type: Number, required: true },
    pricePerGramPaise: { type: Number, default: 0 },
    totalPaise: { type: Number, default: 0 },
    bonusMg: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["pending", "completed", "failed", "cancelled"], default: "completed" },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>("Transaction", transactionSchema);
