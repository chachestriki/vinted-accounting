import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Sale from "@/models/Sale";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// POST - Añadir venta manual
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
    const { itemName, purchasePrice, salePrice, saleDate } = body;

    // Validaciones
    if (!itemName || itemName.trim() === "") {
      return NextResponse.json(
        { error: "El nombre del artículo es requerido" },
        { status: 400 }
      );
    }

    // Generar un emailId único para ventas manuales (usando timestamp + random)
    const manualEmailId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const manualTransactionId = `MANUAL-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const saleData = {
      userId: user._id,
      emailId: manualEmailId, // PRIMARY KEY
      transactionId: manualTransactionId,
      itemName: itemName.trim(),
      amount: salePrice || 0,
      purchasePrice: purchasePrice || 0,
      status: "completed",
      shippingCarrier: "unknown",
      saleDate: saleDate ? new Date(saleDate) : new Date(),
      completedDate: saleDate ? new Date(saleDate) : new Date(),
      hasLabel: false,
      isManual: true, // Marcar como venta manual
    };

    const newSale = await Sale.create(saleData);

    return NextResponse.json({
      success: true,
      message: "Venta añadida correctamente",
      sale: newSale,
    });
  } catch (error: any) {
    console.error("Error adding manual sale:", error);
    return NextResponse.json(
      { error: error.message || "Error al añadir la venta" },
      { status: 500 }
    );
  }
}

