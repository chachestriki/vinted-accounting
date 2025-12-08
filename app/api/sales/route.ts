import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Sale from "@/models/Sale";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET - Obtener todas las ventas del usuario desde MongoDB (SIN LÍMITE)
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
    const status = searchParams.get("status"); // "pending", "completed", "all"
    const startDate = searchParams.get("startDate"); // ISO date string
    const endDate = searchParams.get("endDate"); // ISO date string

    // Construir query
    const query: any = { userId: user._id };
    
    if (status && status !== "all") {
      query.status = status;
    }

    // Filtrar por rango de fechas si se proporciona
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) {
        query.saleDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.saleDate.$lte = new Date(endDate);
      }
    }

    // Obtener TODAS las ventas sin límite
    const sales = await Sale.find(query)
      .sort({ saleDate: -1 })
      .lean();

    const total = sales.length;

    // Calcular estadísticas
    const stats = await Sale.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const pendingStats = stats.find((s) => s._id === "pending") || { count: 0, totalAmount: 0 };
    const completedStats = stats.find((s) => s._id === "completed") || { count: 0, totalAmount: 0 };

    return NextResponse.json({
      sales,
      total,
      stats: {
        pending: pendingStats,
        completed: completedStats,
        total: {
          count: pendingStats.count + completedStats.count,
          totalAmount: pendingStats.totalAmount + completedStats.totalAmount,
        },
      },
    });
  } catch (error: any) {
    console.error("Error getting sales:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get sales" },
      { status: 500 }
    );
  }
}
