import mongoose, { Schema, type Document } from "mongoose";

export interface IUser extends Document {
  phone: string;
  passwordHash: string;
  name: string;
  email?: string;
  accountType: "regular" | "jeweller";
  jewellerStatus?: "pending" | "approved" | "rejected";
  jewellerSubscriptionSlabPaise?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    phone: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, sparse: true },
    accountType: { type: String, enum: ["regular", "jeweller"], default: "regular" },
    jewellerStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    jewellerSubscriptionSlabPaise: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
