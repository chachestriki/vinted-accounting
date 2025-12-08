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

    // Convert base64url to base64 and then to buffer
    const base64 = attachmentData.replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(base64, "base64");

    // Return PDF file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
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
      accessToken = await refreshAccessToken(session.refreshToken);
    }

    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_ID,
      process.env.GOOGLE_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Get all labels
    const labels: Array<{ saleId: string; filename: string; data: string }> = [];

    for (const sale of sales) {
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
            labels.push({
              saleId: sale._id.toString(),
              filename,
              data: attachmentResponse.data.data,
            });
          }
        }
      } catch (err) {
        console.error(`Error getting label for sale ${sale._id}:`, err);
      }
    }

    if (labels.length === 0) {
      return NextResponse.json(
        { error: "Failed to get any labels" },
        { status: 500 }
      );
    }

    // Return labels info (frontend will handle individual downloads)
    return NextResponse.json({
      success: true,
      labels: labels.map((l) => ({
        saleId: l.saleId,
        filename: l.filename,
        // For security, we return a download URL instead of raw data
        downloadUrl: `/api/sales/label?saleId=${l.saleId}`,
      })),
    });
  } catch (error: any) {
    console.error("Error getting labels:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get shipping labels" },
      { status: 500 }
    );
  }
}

