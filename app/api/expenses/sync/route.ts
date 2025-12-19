import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Expense from "@/models/Expense";
import User from "@/models/User";
import {
  getGmailClient,
  refreshAccessToken,
  searchVintedExpenses,
  getExpenseDetails,
  processEmailsBatch,
} from "@/libs/gmail-api";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutos para sincronización completa

// POST - Sincronizar gastos desde Gmail a MongoDB
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "No autorizado - Por favor inicia sesión" },
        { status: 401 }
      );
    }

    if (!session.accessToken) {
      return NextResponse.json(
        { error: "No se encontró token de acceso de Gmail. Por favor inicia sesión con Google." },
        { status: 400 }
      );
    }

    await connectMongo();

    // Buscar o crear usuario
    let user = await User.findOne({ email: session.user.email });
    if (!user) {
      user = await User.create({
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      });
    }

    let accessToken = session.accessToken;

    // Refresh token if expired
    if (session.accessTokenExpires && Date.now() >= session.accessTokenExpires) {
      if (!session.refreshToken) {
        return NextResponse.json(
          { error: "Token de acceso expirado. Por favor inicia sesión de nuevo." },
          { status: 403 }
        );
      }
      accessToken = await refreshAccessToken(session.refreshToken);
    }

    const gmail = getGmailClient(accessToken);

    // 1. Buscar correos de gastos de Vinted
    console.log("🔍 Buscando gastos de Vinted...");
    const expenseMessageIds = await searchVintedExpenses(gmail);

    // 2. Procesar gastos
    console.log("💰 Procesando gastos...");
    const expenseDetails = await processEmailsBatch(
      gmail,
      expenseMessageIds,
      getExpenseDetails,
      15
    );

    // 3. Guardar/actualizar gastos en MongoDB
    let newExpenses = 0;
    let updatedExpenses = 0;
    let errors = 0;

    for (const expense of expenseDetails) {
      try {
        const expenseData = {
          userId: user._id,
          emailId: expense.messageId, // Gmail messageId - PRIMARY KEY
          type: expense.type,
          description: expense.description,
          amount: expense.amount,
          expenseDate: new Date(expense.date),
          snippet: expense.snippet,
          isManual: false,
        };

        const result = await Expense.findOneAndUpdate(
          { emailId: expense.messageId },
          { $set: expenseData },
          { upsert: true, new: true }
        );

        if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
          newExpenses++;
        } else {
          updatedExpenses++;
        }
      } catch (err) {
        console.error(`Error guardando gasto ${expense.messageId}:`, err);
        errors++;
      }
    }

    // Obtener estadísticas actualizadas
    const stats = await Expense.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const destacadoStats = stats.find((s) => s._id === "destacado") || { count: 0, totalAmount: 0 };
    const armarioStats = stats.find((s) => s._id === "armario") || { count: 0, totalAmount: 0 };

    console.log(`✅ Sincronización completada:`);
    console.log(`   📧 Correos encontrados: ${expenseMessageIds.length}`);
    console.log(`   💾 Nuevos gastos: ${newExpenses}, Actualizados: ${updatedExpenses}, Errores: ${errors}`);

    return NextResponse.json({
      success: true,
      message: "Sincronización completada",
      summary: {
        emailsFound: expenseMessageIds.length,
        newExpenses,
        updatedExpenses,
        errors,
      },
      stats: {
        destacado: destacadoStats,
        armario: armarioStats,
      },
    });
  } catch (error: any) {
    console.error("Error de sincronización:", error);
    return NextResponse.json(
      { error: error.message || "Error al sincronizar gastos" },
      { status: 500 }
    );
  }
}

