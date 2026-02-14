import mongoose, { Schema, type Document } from "mongoose";

export interface IStateMarkup {
  stateCode: string;
  stateName: string;
  markupPercent: number;
}

export interface IPriceConfig extends Document {
  goldPricePerGramPaise: number | null;
  silverPricePerGramPaise: number | null;
  buyPremiumPercent: number;
  sellDiscountPercent: number;
  gstPercent: number;
  importDutyPercent: number;
  aidcPercent: number;
  localPremiumPercent: number;
  stateMarkups: IStateMarkup[];
  updatedAt: Date;
}

const stateMarkupSchema = new Schema<IStateMarkup>(
  {
    stateCode: { type: String, required: true },
    stateName: { type: String, required: true },
    markupPercent: { type: Number, default: 0 },
  },
  { _id: false }
);

const priceConfigSchema = new Schema<IPriceConfig>(
  {
    goldPricePerGramPaise: { type: Number, default: null },
    silverPricePerGramPaise: { type: Number, default: null },
    buyPremiumPercent: { type: Number, default: 0 },
    sellDiscountPercent: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 3 },
    importDutyPercent: { type: Number, default: 6 },
    aidcPercent: { type: Number, default: 1 },
    localPremiumPercent: { type: Number, default: 1 },
    stateMarkups: { type: [stateMarkupSchema], default: [] },
  },
  { timestamps: true }
);

export const PriceConfig = mongoose.model<IPriceConfig>("PriceConfig", priceConfigSchema);
