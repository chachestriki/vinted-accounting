import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Expense from "@/models/Expense";
import User from "@/models/User";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// PATCH - Actualizar gasto
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "No autorizado - Por favor inicia sesión" },
        { status: 401 }
      );
    }

    await connectMongo();

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const { id } = params;

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "ID de gasto inválido" },
        { status: 400 }
      );
    }

    // Obtener datos del cuerpo
    const body = await req.json();
    const { category, amount, discount, description, itemCount, expenseDate } = body;

    // Buscar gasto
    const expense = await Expense.findOne({
      _id: id,
      userId: user._id,
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Gasto no encontrado" },
        { status: 404 }
      );
    }

    // Actualizar campos
    if (category !== undefined) {
      if (!["destacado", "armario", "otros"].includes(category)) {
        return NextResponse.json(
          { error: "Categoría inválida" },
          { status: 400 }
        );
      }
      expense.category = category;
    }
    if (amount !== undefined) expense.amount = parseFloat(amount);
    if (discount !== undefined) expense.discount = parseFloat(discount);
    if (description !== undefined) expense.description = description;
    if (itemCount !== undefined) expense.itemCount = parseInt(itemCount);
    if (expenseDate !== undefined) expense.expenseDate = new Date(expenseDate);

    // Recalcular total
    expense.totalAmount = expense.amount - expense.discount;

    await expense.save();

    return NextResponse.json({
      success: true,
      message: "Gasto actualizado exitosamente",
      expense,
    });
  } catch (error: any) {
    console.error("Error actualizando gasto:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar el gasto" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar gasto
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "No autorizado - Por favor inicia sesión" },
        { status: 401 }
      );
    }

    await connectMongo();

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const { id } = params;

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "ID de gasto inválido" },
        { status: 400 }
      );
    }

    // Buscar y eliminar gasto
    const expense = await Expense.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Gasto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Gasto eliminado exitosamente",
    });
  } catch (error: any) {
    console.error("Error eliminando gasto:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar el gasto" },
      { status: 500 }
    );
  }
}

