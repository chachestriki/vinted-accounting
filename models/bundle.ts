import mongoose from "mongoose";

// Interface para TypeScript
export interface IBundle {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  provider: string;
  price: number;
  quantity: number; // Cantidad actual (restante)
  initialQuantity: number; // Cantidad inicial al crear el bundle
  returnRate: number; // Total retorno conseguido por el bundle
  salesLinked: number; // Número de ventas vinculadas
  createdAt?: Date;
  updatedAt?: Date;
  // Virtuals
  roiMultiplier?: number;
  soldCount?: number;
  costPerItem?: number;
}

// BUNDLE SCHEMA
const bundleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    initialQuantity: {
      type: Number,
      required: true,
    },
    returnRate: {
      type: Number,
      default: 0, // Total de ingresos de ventas vinculadas
    },
    salesLinked: {
      type: Number,
      default: 0, // Contador de ventas vinculadas
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: ROI Multiplier (retorno / precio invertido)
bundleSchema.virtual("roiMultiplier").get(function () {
  if (this.price === 0) return 0;
  return this.returnRate / this.price;
});

// Virtual: Cantidad vendida
bundleSchema.virtual("soldCount").get(function () {
  return this.initialQuantity - this.quantity;
});

// Virtual: Coste por prenda
bundleSchema.virtual("costPerItem").get(function () {
  if (this.initialQuantity === 0) return 0;
  return this.price / this.initialQuantity;
});

export default (mongoose.models.Bundle || mongoose.model("Bundle", bundleSchema)) as mongoose.Model<IBundle>;