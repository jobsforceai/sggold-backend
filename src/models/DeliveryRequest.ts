import mongoose, { Schema, type Document, type Types } from "mongoose";

export type DeliveryStatus = "pending" | "processing" | "ready" | "collected" | "cancelled";

export interface IDeliveryRequest extends Document {
  userId: Types.ObjectId;
  amountMg: number;
  productType: "coin" | "bar";
  productWeightMg: number;
  coinChargePaise: number;
  gstPaise: number;
  totalChargePaise: number;
  pickupStoreId: string;
  status: DeliveryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const deliveryRequestSchema = new Schema<IDeliveryRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountMg: { type: Number, required: true },
    productType: { type: String, enum: ["coin", "bar"], required: true },
    productWeightMg: { type: Number, required: true },
    coinChargePaise: { type: Number, default: 0 },
    gstPaise: { type: Number, default: 0 },
    totalChargePaise: { type: Number, default: 0 },
    pickupStoreId: { type: String, required: true },
    status: { type: String, enum: ["pending", "processing", "ready", "collected", "cancelled"], default: "pending" },
  },
  { timestamps: true }
);

export const DeliveryRequest = mongoose.model<IDeliveryRequest>("DeliveryRequest", deliveryRequestSchema);
