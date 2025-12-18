import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Bundle from "@/models/bundle";
import Sale from "@/models/Sale";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET - Obtener un bundle por ID
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
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

        const bundleId = (await params).id;
        const bundle = await Bundle.findOne({
            _id: bundleId,
            userId: user._id,
        }).lean({ virtuals: true });

        if (!bundle) {
            return NextResponse.json(
                { error: "Bundle no encontrado" },
                { status: 404 }
            );
        }

        // Obtener ventas vinculadas al bundle
        const linkedSales = await Sale.find({ bundleId: bundleId })
            .sort({ saleDate: -1 })
            .lean();

        return NextResponse.json({
            bundle,
            linkedSales,
        });
    } catch (error: any) {
        console.error("Error getting bundle:", error);
        return NextResponse.json(
            { error: error.message || "Error al obtener el bundle" },
            { status: 500 }
        );
    }
}

// PUT - Actualizar bundle
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
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

        const bundleId = (await params).id;
        const body = await req.json();
        const { name, provider, price, quantity } = body;

        const bundle = await Bundle.findOne({
            _id: bundleId,
            userId: user._id,
        });

        if (!bundle) {
            return NextResponse.json(
                { error: "Bundle no encontrado" },
                { status: 404 }
            );
        }

        // Validaciones
        if (name && name.trim() === "") {
            return NextResponse.json(
                { error: "El nombre no puede estar vacío" },
                { status: 400 }
            );
        }

        if (provider && provider.trim() === "") {
            return NextResponse.json(
                { error: "El proveedor no puede estar vacío" },
                { status: 400 }
            );
        }

        if (price !== undefined && price < 0) {
            return NextResponse.json(
                { error: "El precio no puede ser negativo" },
                { status: 400 }
            );
        }

        if (quantity !== undefined && quantity < 0) {
            return NextResponse.json(
                { error: "La cantidad no puede ser negativa" },
                { status: 400 }
            );
        }

        // Actualizar solo los campos proporcionados
        const updateData: any = {};
        if (name) updateData.name = name.trim();
        if (provider) updateData.provider = provider.trim();
        if (price !== undefined) updateData.price = parseFloat(price);
        if (quantity !== undefined) {
            updateData.quantity = parseInt(quantity);
            // Si se está aumentando la cantidad inicial
            if (parseInt(quantity) > bundle.initialQuantity) {
                updateData.initialQuantity = parseInt(quantity);
            }
        }

        const updatedBundle = await Bundle.findByIdAndUpdate(
            bundleId,
            { $set: updateData },
            { new: true }
        ).lean({ virtuals: true });

        return NextResponse.json({
            success: true,
            message: "Bundle actualizado correctamente",
            bundle: updatedBundle,
        });
    } catch (error: any) {
        console.error("Error updating bundle:", error);
        return NextResponse.json(
            { error: error.message || "Error al actualizar el bundle" },
            { status: 500 }
        );
    }
}

// DELETE - Eliminar bundle
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
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

        const bundleId = (await params).id;
        const bundle = await Bundle.findOne({
            _id: bundleId,
            userId: user._id,
        });

        if (!bundle) {
            return NextResponse.json(
                { error: "Bundle no encontrado" },
                { status: 404 }
            );
        }

        // Desvincular ventas asociadas (poner bundleId en null)
        await Sale.updateMany(
            { bundleId: bundleId },
            { $unset: { bundleId: "" } }
        );

        // Eliminar el bundle
        await Bundle.findByIdAndDelete(bundleId);

        return NextResponse.json({
            success: true,
            message: "Bundle eliminado correctamente",
        });
    } catch (error: any) {
        console.error("Error deleting bundle:", error);
        return NextResponse.json(
            { error: error.message || "Error al eliminar el bundle" },
            { status: 500 }
        );
    }
}
