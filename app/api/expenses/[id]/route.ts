import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Expense from "@/models/Expense";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// PUT - Editar gasto manual
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const expenseId = params.id;
    const body = await req.json();
    const { type, description, amount, expenseDate } = body;

    // Buscar el gasto
    const expense = await Expense.findOne({
      _id: expenseId,
      userId: user._id,
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Gasto no encontrado" },
        { status: 404 }
      );
    }

    // Solo permitir editar gastos manuales
    if (!expense.isManual) {
      return NextResponse.json(
        { error: "Solo se pueden editar gastos creados manualmente" },
        { status: 403 }
      );
    }

    // Validaciones
    if (type && type !== "armario" && type !== "destacado") {
      return NextResponse.json(
        { error: "El tipo de gasto debe ser 'armario' o 'destacado'" },
        { status: 400 }
      );
    }

    if (description && description.trim() === "") {
      return NextResponse.json(
        { error: "La descripción no puede estar vacía" },
        { status: 400 }
      );
    }

    if (amount !== undefined && amount <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    // Actualizar solo los campos proporcionados
    const updateData: any = {};
    if (type) updateData.type = type;
    if (description) updateData.description = description.trim();
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (expenseDate) updateData.expenseDate = new Date(expenseDate);

    const updatedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      { $set: updateData },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      message: "Gasto actualizado correctamente",
      expense: updatedExpense,
    });
  } catch (error: any) {
    console.error("Error updating expense:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar el gasto" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar gasto manual
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const expenseId = params.id;

    // Buscar el gasto
    const expense = await Expense.findOne({
      _id: expenseId,
      userId: user._id,
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Gasto no encontrado" },
        { status: 404 }
      );
    }

    // Solo permitir eliminar gastos manuales
    if (!expense.isManual) {
      return NextResponse.json(
        { error: "Solo se pueden eliminar gastos creados manualmente" },
        { status: 403 }
      );
    }

    await Expense.findByIdAndDelete(expenseId);

    return NextResponse.json({
      success: true,
      message: "Gasto eliminado correctamente",
    });
  } catch (error: any) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar el gasto" },
      { status: 500 }
    );
  }
}

