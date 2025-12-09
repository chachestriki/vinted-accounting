import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Expense from "@/models/Expense";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// POST - Crear gasto manual
export async function POST(req: NextRequest) {
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

    // Obtener datos del cuerpo de la solicitud
    const body = await req.json();
    const { category, amount, discount = 0, description, itemCount = 0, expenseDate } = body;

    // Validar campos requeridos
    if (!category || !amount || !expenseDate) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: category, amount, expenseDate" },
        { status: 400 }
      );
    }

    // Validar categoría
    if (!["destacado", "armario", "otros"].includes(category)) {
      return NextResponse.json(
        { error: "Categoría inválida. Debe ser: destacado, armario u otros" },
        { status: 400 }
      );
    }

    // Calcular total
    const totalAmount = amount - discount;

    // Crear gasto manual
    // Usar timestamp como gmailMessageId para gastos manuales
    const gmailMessageId = `manual-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const expense = await Expense.create({
      userId: user._id,
      category,
      amount: parseFloat(amount),
      discount: parseFloat(discount),
      totalAmount,
      description: description || `Gasto ${category}`,
      itemCount: parseInt(itemCount) || 0,
      expenseDate: new Date(expenseDate),
      gmailMessageId,
      snippet: "Gasto añadido manualmente",
    });

    return NextResponse.json({
      success: true,
      message: "Gasto añadido exitosamente",
      expense,
    });
  } catch (error: any) {
    console.error("Error creando gasto manual:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear el gasto" },
      { status: 500 }
    );
  }
}

