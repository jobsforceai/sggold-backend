import mongoose, { Schema, type Document, type Types } from "mongoose";

export type SchemeStatus = "active" | "completed" | "withdrawn" | "penalized";
export type InstallmentStatus = "pending" | "paid" | "missed" | "advance";

export interface IInstallment {
  dueDate: Date;
  paidDate?: Date;
  amountPaise: number;
  status: InstallmentStatus;
}

export interface IScheme extends Document {
  userId: Types.ObjectId;
  slabAmountPaise: number;
  bonusAmountPaise: number;
  status: SchemeStatus;
  startDate: Date;
  installments: IInstallment[];
  missedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const installmentSchema = new Schema<IInstallment>(
  {
    dueDate: { type: Date, required: true },
    paidDate: { type: Date },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid", "missed", "advance"], default: "pending" },
  },
  { _id: false }
);

const schemeSchema = new Schema<IScheme>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    slabAmountPaise: { type: Number, required: true },
    bonusAmountPaise: { type: Number, required: true },
    status: { type: String, enum: ["active", "completed", "withdrawn", "penalized"], default: "active" },
    startDate: { type: Date, required: true },
    installments: { type: [installmentSchema], default: [] },
    missedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

schemeSchema.index({ userId: 1, status: 1 });

export const Scheme = mongoose.model<IScheme>("Scheme", schemeSchema);
