import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Expense from "@/models/Expense";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET - Obtener todos los gastos del usuario desde MongoDB
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    await connectMongo();

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Obtener parámetros de consulta
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate"); // ISO date string
    const endDate = searchParams.get("endDate"); // ISO date string
    const type = searchParams.get("type"); // "armario" | "destacado" | null (all)

    // Construir query
    const query: any = { userId: user._id };
    
    if (type && (type === "armario" || type === "destacado")) {
      query.type = type;
    }

    // Filtrar por rango de fechas si se proporciona
    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) {
        query.expenseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.expenseDate.$lte = end;
      }
    }

    // Obtener TODOS los gastos sin límite (la paginación se hace en el frontend)
    const expenses = await Expense.find(query)
      .sort({ expenseDate: -1 })
      .lean();

    const total = expenses.length;

    // Calcular estadísticas
    const stats = await Expense.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalStats = stats[0] || { count: 0, totalAmount: 0 };

    // Estadísticas por tipo
    const typeStats = await Expense.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Aplicar filtros de fecha a las estadísticas si existen
    let filteredStats = totalStats;
    let filteredTypeStats = typeStats;
    
    if (startDate || endDate) {
      const dateFilter: any = { userId: user._id };
      if (startDate || endDate) {
        dateFilter.expenseDate = {};
        if (startDate) {
          dateFilter.expenseDate.$gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.expenseDate.$lte = end;
        }
      }

      filteredStats = await Expense.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);
      filteredStats = filteredStats[0] || { count: 0, totalAmount: 0 };

      filteredTypeStats = await Expense.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]);
    }

    return NextResponse.json({
      expenses,
      total,
      stats: {
        total: filteredStats,
        byType: filteredTypeStats,
      },
    });
  } catch (error: any) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

