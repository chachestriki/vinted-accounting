import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// Tipos de gasto
export type ExpenseType = "armario" | "destacado";

// Interface para TypeScript
export interface IExpense {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  emailId: string; // Gmail messageId - PRIMARY KEY
  type: ExpenseType;
  description: string;
  amount: number;
  expenseDate: Date;
  snippet?: string;
  isManual?: boolean; // Si fue añadido manualmente
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
    // ID del mensaje de Gmail (PRIMARY KEY - único por email)
    emailId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Tipo de gasto
    type: {
      type: String,
      enum: ["armario", "destacado"],
      required: true,
      index: true,
    },
    // Descripción del gasto
    description: {
      type: String,
      required: true,
      trim: true,
    },
    // Monto del gasto en EUR
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    // Fecha del gasto
    expenseDate: {
      type: Date,
      required: true,
      index: true,
    },
    // Snippet del correo para referencia
    snippet: {
      type: String,
    },
    // Si fue añadido manualmente
    isManual: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Índice compuesto para búsquedas por usuario y emailId
expenseSchema.index({ userId: 1, emailId: 1 });

// Índice para búsquedas por fecha
expenseSchema.index({ userId: 1, expenseDate: -1 });

// add plugin that converts mongoose to json
expenseSchema.plugin(toJSON);

export default (mongoose.models.Expense || mongoose.model("Expense", expenseSchema)) as mongoose.Model<IExpense>;

