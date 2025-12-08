import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Sale from "@/models/Sale";
import User from "@/models/User";
import {
  getGmailClient,
  refreshAccessToken,
  searchVintedCompletedSales,
  searchVintedPendingSales,
  getCompletedSaleDetails,
  getPendingSaleDetails,
  processEmailsBatch,
} from "@/libs/gmail-api";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutos para sincronización completa

// POST - Sincronizar ventas desde Gmail a MongoDB
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    if (!session.accessToken) {
      return NextResponse.json(
        { error: "No Gmail access token found. Please sign in with Google." },
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
          { error: "Access token expired. Please sign in again." },
          { status: 403 }
        );
      }
      accessToken = await refreshAccessToken(session.refreshToken);
    }

    const gmail = getGmailClient(accessToken);
    const now = new Date();

    // 1. Buscar ventas pendientes (etiquetas de envío)
    console.log("🔍 Buscando ventas pendientes (etiquetas de envío)...");
    const pendingMessageIds = await searchVintedPendingSales(gmail);
    
    // 2. Buscar ventas completadas (transferencias)
    console.log("🔍 Buscando ventas completadas (transferencias)...");
    const completedMessageIds = await searchVintedCompletedSales(gmail);

    // 3. Procesar ventas pendientes
    console.log("📦 Procesando ventas pendientes...");
    const pendingSales = await processEmailsBatch(
      gmail,
      pendingMessageIds,
      getPendingSaleDetails,
      15
    );

    // 4. Procesar ventas completadas
    console.log("💰 Procesando ventas completadas...");
    const completedSales = await processEmailsBatch(
      gmail,
      completedMessageIds,
      getCompletedSaleDetails,
      15
    );

    // 5. Crear mapa de ventas completadas por transactionId
    const completedMap = new Map<string, typeof completedSales[0]>();
    for (const sale of completedSales) {
      completedMap.set(sale.transactionId, sale);
    }

    // 6. Guardar/actualizar ventas en MongoDB
    let newSales = 0;
    let updatedSales = 0;
    let expiredSales = 0;
    let errors = 0;

    // Procesar ventas pendientes (etiquetas)
    for (const pending of pendingSales) {
      try {
        const completed = completedMap.get(pending.transactionId);
        const isCompleted = !!completed;
        
        // Determinar si la venta está vencida (la fecha límite ya pasó)
        let status: "pending" | "completed" = "pending";
        let completedDate: Date | undefined;
        
        if (isCompleted) {
          // Si hay correo de transferencia, está completada
          status = "completed";
          completedDate = new Date(completed!.date);
        } else if (pending.shippingDeadline) {
          // Si la fecha límite ya pasó, marcar como completada (asumimos que se envió)
          const deadline = new Date(pending.shippingDeadline);
          if (now > deadline) {
            status = "completed";
            completedDate = deadline; // Usar la fecha límite como fecha de completado
            expiredSales++;
          }
        }

        const saleData = {
          userId: user._id,
          transactionId: pending.transactionId,
          itemName: pending.itemName,
          amount: completed?.amount || 0,
          status,
          shippingCarrier: pending.shippingCarrier as any,
          trackingNumber: pending.trackingNumber,
          shippingDeadline: pending.shippingDeadline ? new Date(pending.shippingDeadline) : undefined,
          saleDate: new Date(pending.date),
          completedDate,
          gmailMessageId: pending.messageId,
          labelMessageId: pending.messageId,
          hasLabel: pending.hasAttachment,
          snippet: pending.snippet,
        };

        const result = await Sale.findOneAndUpdate(
          { userId: user._id, transactionId: pending.transactionId },
          { $set: saleData },
          { upsert: true, new: true }
        );

        if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
          newSales++;
        } else {
          updatedSales++;
        }

        // Remover del mapa de completadas para detectar las que no tienen etiqueta
        completedMap.delete(pending.transactionId);
      } catch (err) {
        console.error(`Error saving pending sale ${pending.transactionId}:`, err);
        errors++;
      }
    }

    // Procesar ventas completadas que no tienen etiqueta de envío
    for (const [transactionId, completed] of completedMap) {
      try {
        const saleData = {
          userId: user._id,
          transactionId: completed.transactionId,
          itemName: completed.itemName,
          amount: completed.amount,
          status: "completed" as const,
          shippingCarrier: "unknown" as const,
          saleDate: new Date(completed.date),
          completedDate: new Date(completed.date),
          gmailMessageId: completed.messageId,
          hasLabel: false,
          snippet: completed.snippet,
        };

        const result = await Sale.findOneAndUpdate(
          { userId: user._id, transactionId: completed.transactionId },
          { $set: saleData },
          { upsert: true, new: true }
        );

        if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
          newSales++;
        } else {
          updatedSales++;
        }
      } catch (err) {
        console.error(`Error saving completed sale ${transactionId}:`, err);
        errors++;
      }
    }

    // Obtener estadísticas actualizadas
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

    console.log(`✅ Sincronización completada:`);
    console.log(`   📧 Correos encontrados: ${pendingMessageIds.length} etiquetas, ${completedMessageIds.length} transferencias`);
    console.log(`   💾 Nuevas ventas: ${newSales}, Actualizadas: ${updatedSales}, Vencidas: ${expiredSales}, Errores: ${errors}`);

    return NextResponse.json({
      success: true,
      message: "Sincronización completada",
      summary: {
        pendingEmailsFound: pendingMessageIds.length,
        completedEmailsFound: completedMessageIds.length,
        newSales,
        updatedSales,
        expiredSales,
        errors,
      },
      stats: {
        pending: pendingStats,
        completed: completedStats,
      },
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync sales" },
      { status: 500 }
    );
  }
}
