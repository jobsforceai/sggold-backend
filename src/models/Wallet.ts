import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IWallet extends Document {
  userId: Types.ObjectId;
  balanceMg: number;
  totalPurchasedMg: number;
  totalBonusMg: number;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    balanceMg: { type: Number, default: 0 },
    totalPurchasedMg: { type: Number, default: 0 },
    totalBonusMg: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Wallet = mongoose.model<IWallet>("Wallet", walletSchema);
