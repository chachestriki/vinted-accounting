import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Sale from "@/models/Sale";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<any> }
) {
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

    const { id: saleId } = await context.params;
    const body = await req.json();
    const { itemName, purchasePrice, salePrice, saleDate, status } = body;

    // Buscar la venta
    const sale = await Sale.findOne({
      _id: saleId,
      userId: user._id,
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      );
    }

    // Si la venta NO es manual, solo permitir editar el coste
    if (!sale.isManual) {
      const allowedFields = ["purchasePrice"];
      const receivedFields = Object.keys(body);

      const invalidFields = receivedFields.filter(
        (field) => !allowedFields.includes(field)
      );

      if (invalidFields.length > 0) {
        return NextResponse.json(
          {
            error:
              "Las ventas importadas de Gmail solo permiten editar el coste",
          },
          { status: 403 }
        );
      }
    }


    // Validaciones
    if (itemName && itemName.trim() === "") {
      return NextResponse.json(
        { error: "El nombre del artículo no puede estar vacío" },
        { status: 400 }
      );
    }

    if (salePrice !== undefined && salePrice < 0) {
      return NextResponse.json(
        { error: "El precio de venta no puede ser negativo" },
        { status: 400 }
      );
    }

    if (purchasePrice !== undefined && purchasePrice < 0) {
      return NextResponse.json(
        { error: "El precio de compra no puede ser negativo" },
        { status: 400 }
      );
    }

    if (status && !["pending", "completed", "cancelled"].includes(status)) {
      return NextResponse.json(
        { error: "Estado inválido" },
        { status: 400 }
      );
    }

    // Actualizar solo los campos proporcionados
    const updateData: any = {};
    if (itemName) updateData.itemName = itemName.trim();
    if (salePrice !== undefined) updateData.amount = parseFloat(salePrice);
    if (purchasePrice !== undefined) updateData.purchasePrice = parseFloat(purchasePrice);
    if (saleDate) {
      updateData.saleDate = new Date(saleDate);
      if (status === "completed" || sale.status === "completed") {
        updateData.completedDate = new Date(saleDate);
      }
    }
    if (status) {
      updateData.status = status;
      if (status === "completed" && !updateData.completedDate) {
        updateData.completedDate = updateData.saleDate || sale.saleDate;
      }
    }

    const updatedSale = await Sale.findByIdAndUpdate(
      saleId,
      { $set: updateData },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      message: "Venta actualizada correctamente",
      sale: updatedSale,
    });
  } catch (error: any) {
    console.error("Error updating sale:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar la venta" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar venta manual
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<any> }
) {
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

    const { id: saleId } = await context.params;

    // Buscar la venta
    const sale = await Sale.findOne({
      _id: saleId,
      userId: user._id,
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 }
      );
    }

    // Solo permitir eliminar ventas manuales
    if (!sale.isManual) {
      return NextResponse.json(
        { error: "Solo se pueden eliminar ventas creadas manualmente" },
        { status: 403 }
      );
    }

    await Sale.findByIdAndDelete(saleId);

    return NextResponse.json({
      success: true,
      message: "Venta eliminada correctamente",
    });
  } catch (error: any) {
    console.error("Error deleting sale:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar la venta" },
      { status: 500 }
    );
  }
}

