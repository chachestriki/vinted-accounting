import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Sale from "@/models/Sale";
import User from "@/models/User";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// PATCH - Actualizar venta
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
        { error: "ID de venta inválido" },
        { status: 400 }
      );
    }

    // Obtener datos del cuerpo
    const body = await req.json();
    const { itemName, amount, purchasePrice, status, saleDate, shippingCarrier } = body;

    // Buscar venta
    const sale = await Sale.findOne({
      _id: id,
      userId: user._id,
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      );
    }

    // Actualizar campos
    if (itemName !== undefined) sale.itemName = itemName;
    if (amount !== undefined) sale.amount = parseFloat(amount);
    if (purchasePrice !== undefined) sale.purchasePrice = parseFloat(purchasePrice);
    if (status !== undefined) {
      if (!["pending", "completed", "cancelled"].includes(status)) {
        return NextResponse.json(
          { error: "Estado inválido" },
          { status: 400 }
        );
      }
      sale.status = status;
      // Si se marca como completada, agregar fecha de completado
      if (status === "completed" && !sale.completedDate) {
        sale.completedDate = new Date();
      }
    }
    if (saleDate !== undefined) sale.saleDate = new Date(saleDate);
    if (shippingCarrier !== undefined) {
      if (!["correos", "inpost", "seur", "vintedgo", "unknown"].includes(shippingCarrier)) {
        return NextResponse.json(
          { error: "Compañía de envío inválida" },
          { status: 400 }
        );
      }
      sale.shippingCarrier = shippingCarrier;
    }

    await sale.save();

    return NextResponse.json({
      success: true,
      message: "Venta actualizada exitosamente",
      sale,
    });
  } catch (error: any) {
    console.error("Error actualizando venta:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar la venta" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar venta
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
        { error: "ID de venta inválido" },
        { status: 400 }
      );
    }

    // Buscar y eliminar venta
    const sale = await Sale.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Venta eliminada exitosamente",
    });
  } catch (error: any) {
    console.error("Error eliminando venta:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar la venta" },
      { status: 500 }
    );
  }
}

