import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Sale from "@/models/Sale";
import User from "@/models/User";
import {
  getGmailClient,
  refreshAccessToken,
  getEmailAttachment,
} from "@/libs/gmail-api";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { PDFDocument } from "pdf-lib";
import { convertBase64UrlPdfTo4x6 } from "@/libs/pdf-processor";

export const dynamic = "force-dynamic";

// GET - Descargar etiqueta de envío
export async function GET(req: NextRequest) {
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
        { error: "No Gmail access token found." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const saleId = searchParams.get("saleId");
    const messageId = searchParams.get("messageId");

    if (!saleId && !messageId) {
      return NextResponse.json(
        { error: "Sale ID or Message ID is required" },
        { status: 400 }
      );
    }

    await connectMongo();

    let labelMessageId = messageId;

    // Si se proporciona saleId, buscar el messageId de la etiqueta
    if (saleId) {
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const sale = await Sale.findOne({ _id: saleId, userId: user._id });
      if (!sale) {
        return NextResponse.json({ error: "Sale not found" }, { status: 404 });
      }

      if (!sale.labelMessageId) {
        return NextResponse.json(
          { error: "No shipping label available for this sale" },
          { status: 404 }
        );
      }

      labelMessageId = sale.labelMessageId;
      
      // Guardar el carrier para pasarlo al procesador de PDF
      var shippingCarrier = sale.shippingCarrier;
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

      try {
        accessToken = await refreshAccessToken(session.refreshToken);
      } catch (refreshError: any) {
        console.error("Token refresh failed:", refreshError);
        return NextResponse.json(
          {
            error: "Your Gmail access has expired. Please sign out and sign in again to reconnect your account.",
            code: "TOKEN_EXPIRED"
          },
          { status: 401 }
        );
      }
    }

    // Get Gmail client
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_ID,
      process.env.GOOGLE_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Get email with attachments
    const response = await gmail.users.messages.get({
      userId: "me",
      id: labelMessageId!,
      format: "full",
    });

    const message = response.data;

    // Find PDF attachment
    let attachmentId: string | null = null;
    let filename = "etiqueta-envio.pdf";

    const findAttachment = (parts: any[]): void => {
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith(".pdf")) {
          attachmentId = part.body?.attachmentId;
          filename = part.filename;
        }
        if (part.parts) {
          findAttachment(part.parts);
        }
      }
    };

    if (message.payload?.parts) {
      findAttachment(message.payload.parts);
    }

    if (!attachmentId) {
      return NextResponse.json(
        { error: "No PDF attachment found in this email" },
        { status: 404 }
      );
    }

    // Get attachment data
    const attachmentResponse = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: labelMessageId!,
      id: attachmentId,
    });

    const attachmentData = attachmentResponse.data.data;
    if (!attachmentData) {
      return NextResponse.json(
        { error: "Failed to get attachment data" },
        { status: 500 }
      );
    }

    // Convert base64url to base64, then to buffer, and convert to 4x6 inches
    // Para InPost, se recortará 6x4 y se rotará 90°
    const convertedBuffer = await convertBase64UrlPdfTo4x6(
      attachmentData, 
      undefined, 
      shippingCarrier as any
    );

    // Return PDF file
    return new NextResponse(new Uint8Array(convertedBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": convertedBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error getting label:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get shipping label" },
      { status: 500 }
    );
  }
}

// POST - Descargar múltiples etiquetas (como ZIP)
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
        { error: "No Gmail access token found." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { saleIds } = body;

    if (!saleIds || !Array.isArray(saleIds) || saleIds.length === 0) {
      return NextResponse.json(
        { error: "Sale IDs array is required" },
        { status: 400 }
      );
    }

    await connectMongo();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get sales with labels
    const sales = await Sale.find({
      _id: { $in: saleIds },
      userId: user._id,
      hasLabel: true,
      labelMessageId: { $exists: true, $ne: null },
    });

    if (sales.length === 0) {
      return NextResponse.json(
        { error: "No sales with shipping labels found" },
        { status: 404 }
      );
    }

    let accessToken = session.accessToken;

    if (session.accessTokenExpires && Date.now() >= session.accessTokenExpires) {
      if (!session.refreshToken) {
        return NextResponse.json(
          { error: "Access token expired. Please sign in again." },
          { status: 403 }
        );
      }

      try {
        accessToken = await refreshAccessToken(session.refreshToken);
      } catch (refreshError: any) {
        console.error("Token refresh failed:", refreshError);
        return NextResponse.json(
          {
            error: "Your Gmail access has expired. Please sign out and sign in again to reconnect your account.",
            code: "TOKEN_EXPIRED"
          },
          { status: 401 }
        );
      }
    }

    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_ID,
      process.env.GOOGLE_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Get all labels in parallel for better performance
    const labelPromises = sales.map(async (sale) => {
      try {
        const response = await gmail.users.messages.get({
          userId: "me",
          id: sale.labelMessageId!,
          format: "full",
        });

        const message = response.data;
        let attachmentId: string | null = null;
        let filename = `etiqueta-${sale.transactionId}.pdf`;

        const findAttachment = (parts: any[]): void => {
          for (const part of parts) {
            if (part.filename && part.filename.toLowerCase().endsWith(".pdf")) {
              attachmentId = part.body?.attachmentId;
              if (part.filename) {
                filename = part.filename;
              }
            }
            if (part.parts) {
              findAttachment(part.parts);
            }
          }
        };

        if (message.payload?.parts) {
          findAttachment(message.payload.parts);
        }

        if (attachmentId) {
          const attachmentResponse = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: sale.labelMessageId!,
            id: attachmentId,
          });

          if (attachmentResponse.data.data) {
            return {
              saleId: sale._id.toString(),
              filename,
              data: attachmentResponse.data.data,
              carrier: sale.shippingCarrier,
            };
          }
        }
        return null;
      } catch (err) {
        console.error(`Error getting label for sale ${sale._id}:`, err);
        return null;
      }
    });

    const labelResults = await Promise.all(labelPromises);
    const labels = labelResults.filter(label => label !== null) as Array<{ saleId: string; filename: string; data: string; carrier?: any }>;

    if (labels.length === 0) {
      return NextResponse.json(
        { error: "Failed to get any labels" },
        { status: 500 }
      );
    }

    // Concatenar todos los PDFs en uno solo, convirtiéndolos a 4x6 pulgadas
    const mergedPdf = await PDFDocument.create();

    for (const label of labels) {
      try {
        // Convertir base64url a 4x6 pulgadas (InPost se maneja especialmente)
        const convertedBuffer = await convertBase64UrlPdfTo4x6(
          label.data,
          undefined,
          label.carrier as any
        );

        // Cargar el PDF convertido
        const pdf = await PDFDocument.load(convertedBuffer);

        // Copiar todas las páginas al PDF combinado
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        console.error(`Error merging PDF for sale ${label.saleId}:`, err);
        // Continuar con los demás PDFs aunque uno falle
      }
    }

    // Generar el PDF combinado
    const mergedPdfBytes = await mergedPdf.save();
    const mergedPdfBuffer = Buffer.from(mergedPdfBytes);

    // Retornar el PDF combinado
    return new NextResponse(mergedPdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="etiquetas-combinadas-${new Date().toISOString().split("T")[0]}.pdf"`,
        "Content-Length": mergedPdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error getting labels:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get shipping labels" },
      { status: 500 }
    );
  }
}

