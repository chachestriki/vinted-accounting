import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Expense from "@/models/Expense";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET - Obtener gastos con estadísticas
export async function GET(req: NextRequest) {
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

    // Obtener parámetros de consulta
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get("category");

    // Construir filtro
    const filter: any = { userId: user._id };
    if (category && category !== "all") {
      filter.category = category;
    }

    // Obtener todos los gastos
    const expenses = await Expense.find(filter)
      .sort({ expenseDate: -1 })
      .lean();

    // Calcular estadísticas
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const stats = {
      total: {
        count: 0,
        totalAmount: 0,
      },
      thisMonth: {
        count: 0,
        totalAmount: 0,
      },
      destacado: {
        count: 0,
        totalAmount: 0,
      },
      armario: {
        count: 0,
        totalAmount: 0,
      },
      otros: {
        count: 0,
        totalAmount: 0,
      },
    };

    // Calcular estadísticas
    for (const expense of expenses) {
      stats.total.count++;
      stats.total.totalAmount += expense.totalAmount;

      const expenseDate = new Date(expense.expenseDate);
      if (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      ) {
        stats.thisMonth.count++;
        stats.thisMonth.totalAmount += expense.totalAmount;
      }

      if (expense.category === "destacado") {
        stats.destacado.count++;
        stats.destacado.totalAmount += expense.totalAmount;
      } else if (expense.category === "armario") {
        stats.armario.count++;
        stats.armario.totalAmount += expense.totalAmount;
      } else {
        stats.otros.count++;
        stats.otros.totalAmount += expense.totalAmount;
      }
    }

    return NextResponse.json({
      expenses,
      total: expenses.length,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { error: error.message || "Error al cargar los gastos" },
      { status: 500 }
    );
  }
}

