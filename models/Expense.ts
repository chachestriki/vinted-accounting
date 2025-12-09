import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// Categorías de gastos
export type ExpenseCategory = "destacado" | "armario" | "otros";

// Interface para TypeScript
export interface IExpense {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  category: ExpenseCategory;
  amount: number;
  discount?: number;
  totalAmount: number; // amount - discount
  description?: string;
  itemCount?: number; // Cantidad de artículos (para destacado)
  expenseDate: Date;
  gmailMessageId: string;
  snippet?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// EXPENSE SCHEMA
const expenseSchema = new mongoose.Schema(
  {
    // Usuario dueño del gasto
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Categoría del gasto
    category: {
      type: String,
      enum: ["destacado", "armario", "otros"],
      required: true,
      index: true,
    },
    // Monto del gasto en EUR
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    // Descuento aplicado (si existe)
    discount: {
      type: Number,
      default: 0,
    },
    // Monto total (amount - discount)
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    // Descripción del gasto
    description: {
      type: String,
      trim: true,
    },
    // Cantidad de artículos (para destacados)
    itemCount: {
      type: Number,
      default: 0,
    },
    // Fecha del gasto
    expenseDate: {
      type: Date,
      required: true,
      index: true,
    },
    // ID del mensaje de Gmail (para evitar duplicados)
    gmailMessageId: {
      type: String,
      required: true,
      index: true,
    },
    // Snippet del correo para referencia
    snippet: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Índice compuesto para evitar duplicados por usuario y mensaje
expenseSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true });

// Índice para búsquedas por fecha
expenseSchema.index({ userId: 1, expenseDate: -1 });

// add plugin that converts mongoose to json
expenseSchema.plugin(toJSON);

export default (mongoose.models.Expense || mongoose.model("Expense", expenseSchema)) as mongoose.Model<IExpense>;

