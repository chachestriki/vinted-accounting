import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Bundle from "@/models/bundle";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET - Obtener todos los bundles del usuario
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

        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        const bundles = await Bundle.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .lean({ virtuals: true });

        // Calculate stats
        const totalStockValue = bundles.reduce((sum, b) => sum + b.price, 0);
        const totalItems = bundles.reduce((sum, b) => sum + b.quantity, 0);
        const totalInitialItems = bundles.reduce((sum, b) => sum + b.initialQuantity, 0);
        const totalReturnRate = bundles.reduce((sum, b) => sum + b.returnRate, 0);

        return NextResponse.json({
            bundles,
            stats: {
                totalBundles: bundles.length,
                totalStockValue,
                totalItems,
                totalInitialItems,
                totalReturnRate,
                overallROI: totalStockValue > 0 ? totalReturnRate / totalStockValue : 0,
            },
        });
    } catch (error: any) {
        console.error("Error getting bundles:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get bundles" },
            { status: 500 }
        );
    }
}

// POST - Crear un nuevo bundle
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
        const { name, provider, price, quantity } = body;

        // Validaciones
        if (!name || name.trim() === "") {
            return NextResponse.json(
                { error: "El nombre del bundle es requerido" },
                { status: 400 }
            );
        }

        if (!provider || provider.trim() === "") {
            return NextResponse.json(
                { error: "El proveedor es requerido" },
                { status: 400 }
            );
        }

        if (price === undefined || price < 0) {
            return NextResponse.json(
                { error: "El precio debe ser un número positivo" },
                { status: 400 }
            );
        }

        if (quantity === undefined || quantity < 1) {
            return NextResponse.json(
                { error: "La cantidad debe ser al menos 1" },
                { status: 400 }
            );
        }

        const bundleData = {
            userId: user._id,
            name: name.trim(),
            provider: provider.trim(),
            price: parseFloat(price),
            quantity: parseInt(quantity),
            initialQuantity: parseInt(quantity), // Guardar cantidad inicial
            returnRate: 0,
            salesLinked: 0,
        };

        const newBundle = await Bundle.create(bundleData);

        return NextResponse.json({
            success: true,
            message: "Bundle creado correctamente",
            bundle: newBundle,
        });
    } catch (error: any) {
        console.error("Error creating bundle:", error);
        return NextResponse.json(
            { error: error.message || "Error al crear el bundle" },
            { status: 500 }
        );
    }
}
