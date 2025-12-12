import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Sale from "@/models/Sale";
import Expense from "@/models/Expense";
import User from "@/models/User";
import {
  getGmailClient,
  refreshAccessToken,
  searchVintedCompletedSales,
  searchVintedPendingSales,
  searchVintedExpenses,
  getCompletedSaleDetails,
  getPendingSaleDetails,
  getExpenseDetails,
  processEmailsBatch,
} from "@/libs/gmail-api";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // 3 minutos para sincronización completa

// POST - Sincronizar ventas desde Gmail a MongoDB
export async function POST(req: NextRequest) {
  console.log("🚀 Iniciando sincronización...");
  const lastSync = new Date();

  try {
    const session = await auth();
    console.log("✅ Sesión obtenida:", session?.user?.email || "No email");

    if (!session?.user?.email) {
      console.error("❌ No hay sesión de usuario");
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    if (!session.accessToken) {
      console.error("❌ No hay access token de Gmail");
      return NextResponse.json(
        { error: "No Gmail access token found. Please sign in with Google." },
        { status: 400 }
      );
    }

    console.log("📦 Conectando a MongoDB...");
    await connectMongo();
    console.log("✅ Conectado a MongoDB");

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
          { error: "Access token expired. Please sign in again." },
          { status: 403 }
        );
      }
      accessToken = await refreshAccessToken(session.refreshToken);
    }

    const gmail = getGmailClient(accessToken);
    const now = new Date();

    // ========== SYNC SALES ==========
    console.log("🔍 Buscando ventas pendientes (etiquetas de envío)...");
    const pendingMessageIds = await searchVintedPendingSales(gmail);
    console.log(`📧 Ventas pendientes encontradas: ${pendingMessageIds.length}`);
    
    console.log("🔍 Buscando ventas completadas (transferencias)...");
    const completedMessageIds = await searchVintedCompletedSales(gmail);
    console.log(`📧 Ventas completadas encontradas: ${completedMessageIds.length}`);

    console.log("📦 Procesando ventas pendientes...");
    const pendingSales = await processEmailsBatch(
      gmail,
      pendingMessageIds,
      getPendingSaleDetails,
      15
    );
    console.log(`✅ Ventas pendientes procesadas: ${pendingSales.length} de ${pendingMessageIds.length}`);

    console.log("💰 Procesando ventas completadas...");
    const completedSales = await processEmailsBatch(
      gmail,
      completedMessageIds,
      getCompletedSaleDetails,
      15
    );
    console.log(`✅ Ventas completadas procesadas: ${completedSales.length} de ${completedMessageIds.length}`);

    // Crear mapa de ventas completadas por transactionId
    const completedMap = new Map<string, typeof completedSales[0]>();
    for (const sale of completedSales) {
      if (sale.transactionId) {
        completedMap.set(sale.transactionId, sale);
      }
    }

    // Guardar/actualizar ventas en MongoDB usando emailId como clave
    let newSales = 0;
    let updatedSales = 0;
    let expiredSales = 0;
    let salesErrors = 0;

    // Procesar ventas pendientes (etiquetas)
    console.log(`💾 Guardando ${pendingSales.length} ventas pendientes...`);
    for (const pending of pendingSales) {
      try {
        if (!pending || !pending.messageId) {
          console.warn("⚠️ Venta pendiente inválida:", pending);
          continue;
        }

        const completed = pending.transactionId ? completedMap.get(pending.transactionId) : null;
        const isCompleted = !!completed;
        
        let status: "pending" | "completed" = "pending";
        let completedDate: Date | undefined;
        
        if (isCompleted) {
          status = "completed";
          completedDate = new Date(completed!.date);
        } else if (pending.shippingDeadline) {
          const deadline = new Date(pending.shippingDeadline);
          if (now > deadline) {
            status = "completed";
            completedDate = deadline;
            expiredSales++;
          }
        }

        const saleData = {
          userId: user._id,
          emailId: pending.messageId, // PRIMARY KEY
          transactionId: pending.transactionId,
          itemName: pending.itemName,
          amount: completed?.amount || 0,
          status,
          shippingCarrier: pending.shippingCarrier as any,
          trackingNumber: pending.trackingNumber,
          shippingDeadline: pending.shippingDeadline ? new Date(pending.shippingDeadline) : undefined,
          saleDate: new Date(pending.date),
          completedDate,
          labelMessageId: pending.messageId,
          hasLabel: pending.hasAttachment,
          snippet: pending.snippet,
        };

        console.log(`💾 Guardando venta: ${pending.messageId} - ${pending.itemName}`);
        
        try {
          const result = await Sale.findOneAndUpdate(
            { emailId: pending.messageId }, // Buscar por emailId
            { $set: saleData },
            { upsert: true, new: true }
          );

          if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
            newSales++;
            console.log(`✅ Nueva venta guardada: ${pending.messageId}`);
          } else {
            updatedSales++;
            console.log(`🔄 Venta actualizada: ${pending.messageId}`);
          }
        } catch (duplicateError: any) {
          // Manejar error de clave duplicada específicamente
          if (duplicateError.code === 11000 || duplicateError.codeName === 'DuplicateKey') {
            console.log(`⚠️ Venta duplicada detectada, actualizando: ${pending.messageId}`);
            // Intentar actualizar sin upsert
            const result = await Sale.findOneAndUpdate(
              { emailId: pending.messageId },
              { $set: saleData },
              { new: true }
            );
            if (result) {
              updatedSales++;
              console.log(`🔄 Venta duplicada actualizada: ${pending.messageId}`);
            } else {
              console.warn(`⚠️ No se pudo actualizar venta duplicada: ${pending.messageId}`);
            }
          } else {
            throw duplicateError; // Re-lanzar si es otro tipo de error
          }
        }

        if (pending.transactionId) {
          completedMap.delete(pending.transactionId);
        }
      } catch (err: any) {
        console.error(`❌ Error saving pending sale ${pending?.messageId}:`, err);
        console.error("Error stack:", err?.stack);
        console.error("Error message:", err?.message);
        salesErrors++;
      }
    }

    // Procesar ventas completadas que no tienen etiqueta de envío
    console.log(`💾 Guardando ${completedMap.size} ventas completadas sin etiqueta...`);
    for (const [transactionId, completed] of completedMap) {
      try {
        if (!completed || !completed.messageId) {
          console.warn("⚠️ Venta completada inválida:", completed);
          continue;
        }

        const saleData = {
          userId: user._id,
          emailId: completed.messageId, // PRIMARY KEY
          transactionId: completed.transactionId,
          itemName: completed.itemName,
          amount: completed.amount,
          status: "completed" as const,
          // No incluir shippingCarrier para ventas completadas sin etiqueta
          saleDate: new Date(completed.date),
          completedDate: new Date(completed.date),
          hasLabel: false,
          snippet: completed.snippet,
        };

        console.log(`💾 Guardando venta completada: ${completed.messageId} - ${completed.itemName}`);
        
        try {
          const result = await Sale.findOneAndUpdate(
            { emailId: completed.messageId }, // Buscar por emailId
            { $set: saleData },
            { upsert: true, new: true }
          );

          if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
            newSales++;
            console.log(`✅ Nueva venta completada guardada: ${completed.messageId}`);
          } else {
            updatedSales++;
            console.log(`🔄 Venta completada actualizada: ${completed.messageId}`);
          }
        } catch (duplicateError: any) {
          // Manejar error de clave duplicada específicamente
          if (duplicateError.code === 11000 || duplicateError.codeName === 'DuplicateKey') {
            console.log(`⚠️ Venta duplicada detectada, actualizando: ${completed.messageId}`);
            const result = await Sale.findOneAndUpdate(
              { emailId: completed.messageId },
              { $set: saleData },
              { new: true }
            );
            if (result) {
              updatedSales++;
              console.log(`🔄 Venta duplicada actualizada: ${completed.messageId}`);
            } else {
              console.warn(`⚠️ No se pudo actualizar venta duplicada: ${completed.messageId}`);
            }
          } else {
            throw duplicateError; // Re-lanzar si es otro tipo de error
          }
        }
      } catch (err: any) {
        console.error(`❌ Error saving completed sale ${completed?.messageId}:`, err);
        console.error("Error stack:", err?.stack);
        console.error("Error message:", err?.message);
        salesErrors++;
      }
    }

    // Obtener estadísticas actualizadas
    const salesStats = await Sale.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const pendingStats = salesStats.find((s) => s._id === "pending") || { count: 0, totalAmount: 0 };
    const completedStats = salesStats.find((s) => s._id === "completed") || { count: 0, totalAmount: 0 };

    // ========== SYNC EXPENSES (Armario y Destacado) ==========
    console.log("🔍 Buscando gastos (armario y destacado)...");
    const expenseMessageIds = await searchVintedExpenses(gmail);
    console.log(`📧 Gastos encontrados: ${expenseMessageIds.length}`);

    console.log("💳 Procesando gastos...");
    const expenses = await processEmailsBatch(
      gmail,
      expenseMessageIds,
      getExpenseDetails,
      15
    );
    console.log(`✅ Gastos procesados: ${expenses.length} de ${expenseMessageIds.length}`);

    // Guardar/actualizar gastos en MongoDB usando emailId como clave
    let newExpenses = 0;
    let updatedExpenses = 0;
    let expensesErrors = 0;

    console.log(`💾 Guardando ${expenses.length} gastos...`);
    for (const expense of expenses) {
      try {
        if (!expense || !expense.messageId) {
          console.warn("⚠️ Gasto inválido:", expense);
          continue;
        }

        const expenseData = {
          userId: user._id,
          emailId: expense.messageId, // PRIMARY KEY
          type: expense.type,
          description: expense.description,
          amount: expense.amount,
          expenseDate: new Date(expense.date),
          snippet: expense.snippet,
        };

        console.log(`💾 Guardando gasto: ${expense.messageId} - ${expense.type} - ${expense.amount}€`);
        
        try {
          const result = await Expense.findOneAndUpdate(
            { emailId: expense.messageId }, // Buscar por emailId
            { $set: expenseData },
            { upsert: true, new: true }
          );

          if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
            newExpenses++;
            console.log(`✅ Nuevo gasto guardado: ${expense.messageId}`);
          } else {
            updatedExpenses++;
            console.log(`🔄 Gasto actualizado: ${expense.messageId}`);
          }
        } catch (duplicateError: any) {
          // Manejar error de clave duplicada específicamente
          if (duplicateError.code === 11000 || duplicateError.codeName === 'DuplicateKey') {
            console.log(`⚠️ Gasto duplicado detectado, actualizando: ${expense.messageId}`);
            // Intentar actualizar sin upsert
            const result = await Expense.findOneAndUpdate(
              { emailId: expense.messageId },
              { $set: expenseData },
              { new: true }
            );
            if (result) {
              updatedExpenses++;
              console.log(`🔄 Gasto duplicado actualizado: ${expense.messageId}`);
            } else {
              console.warn(`⚠️ No se pudo actualizar gasto duplicado: ${expense.messageId}`);
            }
          } else {
            throw duplicateError; // Re-lanzar si es otro tipo de error
          }
        }
      } catch (err: any) {
        console.error(`❌ Error saving expense ${expense?.messageId}:`, err);
        console.error("Error stack:", err?.stack);
        console.error("Error message:", err?.message);
        expensesErrors++;
      }
    }

    console.log(`✅ Sincronización completada:`);
    console.log(`   📧 Ventas: ${pendingMessageIds.length} etiquetas, ${completedMessageIds.length} transferencias`);
    console.log(`   💾 Ventas: ${newSales} nuevas, ${updatedSales} actualizadas, ${expiredSales} vencidas, ${salesErrors} errores`);
    console.log(`   📧 Gastos: ${expenseMessageIds.length} correos encontrados`);
    console.log(`   💾 Gastos: ${newExpenses} nuevos, ${updatedExpenses} actualizados, ${expensesErrors} errores`);

    return NextResponse.json({
      success: true,
      message: "Sincronización completada",
      lastSync: lastSync.toISOString(),
      sales: {
        pendingEmailsFound: pendingMessageIds.length,
        completedEmailsFound: completedMessageIds.length,
        newSales,
        updatedSales,
        expiredSales,
        errors: salesErrors,
        stats: {
          pending: pendingStats,
          completed: completedStats,
        },
      },
      expenses: {
        emailsFound: expenseMessageIds.length,
        processed: expenses.length,
        newExpenses,
        updatedExpenses,
        errors: expensesErrors,
      },
    });
  } catch (error: any) {
    console.error("❌ Sync error:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error message:", error?.message);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: error.message || "Failed to sync" },
      { status: 500 }
    );
  }
}

