import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Expense from "@/models/Expense";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// POST - Añadir gasto manual
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    await connectMongo();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { type, description, amount, expenseDate } = body;

    // Validaciones
    if (!type || (type !== "armario" && type !== "destacado")) {
      return NextResponse.json(
        { error: "El tipo de gasto es requerido (armario o destacado)" },
        { status: 400 }
      );
    }

    if (!description || description.trim() === "") {
      return NextResponse.json(
        { error: "La descripción es requerida" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    // Generar un emailId único para gastos manuales
    const manualEmailId = `manual-expense-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const expenseData = {
      userId: user._id,
      emailId: manualEmailId, // PRIMARY KEY
      type: type as "armario" | "destacado",
      description: description.trim(),
      amount: parseFloat(amount),
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      isManual: true, // Marcar como gasto manual
    };

    const newExpense = await Expense.create(expenseData);

    return NextResponse.json({
      success: true,
      message: "Gasto añadido correctamente",
      expense: newExpense,
    });
  } catch (error: any) {
    console.error("Error adding manual expense:", error);
    
    // Manejar error de duplicado
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "Ya existe un gasto con este ID" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Error al añadir el gasto" },
      { status: 500 }
    );
  }
}

