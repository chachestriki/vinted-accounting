import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Sale from "@/models/Sale";
import Bundle from "@/models/bundle";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// POST - Vincular venta a bundle
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
        const { saleId, bundleId } = body;

        if (!saleId) {
            return NextResponse.json(
                { error: "El ID de la venta es requerido" },
                { status: 400 }
            );
        }

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

        // Si se está desvinculando (bundleId es null o undefined)
        if (!bundleId) {
            // Si la venta estaba vinculada a un bundle, revertir los cambios
            if (sale.bundleId) {
                const oldBundle = await Bundle.findById(sale.bundleId);
                if (oldBundle) {
                    // Revertir: aumentar quantity, reducir returnRate y salesLinked
                    await Bundle.findByIdAndUpdate(sale.bundleId, {
                        $inc: {
                            quantity: 1,
                            returnRate: -sale.amount,
                            salesLinked: -1,
                        },
                    });
                }
            }

            // Desvincular la venta y resetear el coste
            sale.bundleId = undefined;
            sale.purchasePrice = 0;
            await sale.save();

            return NextResponse.json({
                success: true,
                message: "Venta desvinculada correctamente",
                sale,
            });
        }

        // Verificar que el bundle existe y pertenece al usuario
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

        // Verificar que el bundle tiene stock disponible (solo si es una nueva vinculación)
        if (!sale.bundleId && bundle.quantity <= 0) {
            return NextResponse.json(
                { error: "El bundle no tiene stock disponible" },
                { status: 400 }
            );
        }

        // Calculate cost per item from the bundle
        const costPerItem = bundle.initialQuantity > 0 ? bundle.price / bundle.initialQuantity : 0;

        // Si la venta estaba vinculada a otro bundle, revertir los cambios
        if (sale.bundleId && sale.bundleId.toString() !== bundleId) {
            const oldBundle = await Bundle.findById(sale.bundleId);
            if (oldBundle) {
                await Bundle.findByIdAndUpdate(sale.bundleId, {
                    $inc: {
                        quantity: 1,
                        returnRate: -sale.amount,
                        salesLinked: -1,
                    },
                });
            }

            // Actualizar el nuevo bundle
            await Bundle.findByIdAndUpdate(bundleId, {
                $inc: {
                    quantity: -1,
                    returnRate: sale.amount,
                    salesLinked: 1,
                },
            });
        } else if (!sale.bundleId) {
            // Nueva vinculación: decrementar quantity, incrementar returnRate y salesLinked
            await Bundle.findByIdAndUpdate(bundleId, {
                $inc: {
                    quantity: -1,
                    returnRate: sale.amount,
                    salesLinked: 1,
                },
            });
        }

        // Actualizar la venta con el bundleId y el coste por prenda
        sale.bundleId = bundleId;
        sale.purchasePrice = costPerItem;
        await sale.save();

        // Obtener el bundle actualizado
        const updatedBundle = await Bundle.findById(bundleId).lean({ virtuals: true });

        return NextResponse.json({
            success: true,
            message: "Venta vinculada al bundle correctamente",
            sale,
            bundle: updatedBundle,
            costPerItem,
        });
    } catch (error: any) {
        console.error("Error linking sale to bundle:", error);
        return NextResponse.json(
            { error: error.message || "Error al vincular la venta al bundle" },
            { status: 500 }
        );
    }
}
