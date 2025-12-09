import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { 
  parseVintedAmount, 
  parseShippingCarrier, 
  parseTrackingNumber, 
  parseShippingDeadline, 
  parseTransactionId,
  parseExpenseCategory,
  parseExpenseAmount,
  parseItemCount
} from "./gmail-utils";

/**
 * Get Gmail API client with OAuth2
 */
export function getGmailClient(accessToken: string): any {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ID,
    process.env.GOOGLE_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<string> {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ID,
    process.env.GOOGLE_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token!;
}

/**
 * Search Gmail for emails with pagination - SIN LÍMITE
 */
export async function searchGmailEmails(
  gmail: any,
  query: string
): Promise<string[]> {
  try {
    const allMessageIds: string[] = [];
    let nextPageToken: string | undefined = undefined;

    console.log(`🔍 Buscando correos: "${query}"`);

    do {
      const response = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 500,
        pageToken: nextPageToken,
      });

      const messages = response.data.messages || [];
      const messageIds = messages.map((msg: any) => msg.id);
      allMessageIds.push(...messageIds);

      nextPageToken = response.data.nextPageToken;

      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (nextPageToken);

    console.log(`✅ Encontrados: ${allMessageIds.length} correos`);
    return allMessageIds;
  } catch (error) {
    console.error("Error searching Gmail:", error);
    throw error;
  }
}

/**
 * Search for Vinted completed sales (transfers)
 */
export async function searchVintedCompletedSales(gmail: any): Promise<string[]> {
  return searchGmailEmails(
    gmail,
    'from:no-reply@vinted.es "Transferencia a tu saldo Vinted"'
  );
}

/**
 * Search for Vinted pending sales (shipping labels)
 */
export async function searchVintedPendingSales(gmail: any): Promise<string[]> {
  return searchGmailEmails(
    gmail,
    'from:no-reply@vinted.es "Etiqueta de envío para"'
  );
}

// Tipo para detalles de venta completada
export interface CompletedSaleDetails {
  messageId: string;
  transactionId: string;
  itemName: string;
  amount: number;
  date: string;
  snippet: string;
}

// Tipo para detalles de venta pendiente (etiqueta de envío)
export interface PendingSaleDetails {
  messageId: string;
  transactionId: string;
  itemName: string;
  shippingCarrier: string;
  trackingNumber: string;
  shippingDeadline: string;
  date: string;
  hasAttachment: boolean;
  attachmentId?: string;
  snippet: string;
}

/**
 * Get completed sale details from email
 */
export async function getCompletedSaleDetails(
  gmail: any,
  messageId: string
): Promise<CompletedSaleDetails | null> {
  try {
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    const dateHeader = headers.find((h: any) => h.name === "Date");
    const date = dateHeader?.value || message.internalDate || "";

    // Get email body
    let bodyText = extractTextFromMessage(message);
    const text = bodyText || message.snippet || "";

    // Parse amount
    const amount = parseVintedAmount(text);
    if (amount === null) {
      return null;
    }

    // Extract item name
    const itemNameMatch = text.match(/El pedido de "([^"]+)"/);
    const itemName = itemNameMatch ? itemNameMatch[1] : "Artículo desconocido";

    // Extract transaction ID - usar función mejorada
    const transactionId = parseTransactionId(text);
    
    // Si no se encuentra el transactionId, no es una venta válida
    if (!transactionId) {
      console.log(`⚠️ No se encontró transactionId en correo ${messageId}`);
      return null;
    }

    return {
      messageId,
      transactionId,
      itemName,
      amount,
      date: new Date(date).toISOString(),
      snippet: message.snippet || text.substring(0, 200),
    };
  } catch (error) {
    console.error(`Error getting completed sale ${messageId}:`, error);
    return null;
  }
}

/**
 * Get pending sale details from shipping label email
 */
export async function getPendingSaleDetails(
  gmail: any,
  messageId: string
): Promise<PendingSaleDetails | null> {
  try {
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    const dateHeader = headers.find((h: any) => h.name === "Date");
    const subjectHeader = headers.find((h: any) => h.name === "Subject");
    const date = dateHeader?.value || message.internalDate || "";
    const subject = subjectHeader?.value || "";

    // Get email body
    let bodyText = extractTextFromMessage(message);
    const text = bodyText || message.snippet || "";

    // Extract item name from subject or body
    let itemName = "Artículo desconocido";
    const subjectMatch = subject.match(/Etiqueta de envío para ([^.]+)/);
    if (subjectMatch) {
      itemName = subjectMatch[1].trim();
    } else {
      const bodyMatch = text.match(/Pedido:\s*([^\n|]+)/);
      if (bodyMatch) {
        itemName = bodyMatch[1].trim();
      }
    }

    // Extract transaction ID - usar función mejorada
    const transactionId = parseTransactionId(text);
    
    // Si no se encuentra el transactionId, no es una venta válida
    if (!transactionId) {
      console.log(`⚠️ No se encontró transactionId en correo de etiqueta ${messageId}`);
      return null;
    }

    // Extract shipping carrier
    const shippingCarrier = parseShippingCarrier(text);

    // Extract tracking number
    const trackingNumber = parseTrackingNumber(text);

    // Extract shipping deadline
    const shippingDeadline = parseShippingDeadline(text);

    // Check for PDF attachment
    let hasAttachment = false;
    let attachmentId: string | undefined;
    
    const findAttachment = (parts: any[]): void => {
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
          hasAttachment = true;
          attachmentId = part.body?.attachmentId;
        }
        if (part.parts) {
          findAttachment(part.parts);
        }
      }
    };

    if (message.payload?.parts) {
      findAttachment(message.payload.parts);
    }

    return {
      messageId,
      transactionId,
      itemName,
      shippingCarrier,
      trackingNumber,
      shippingDeadline,
      date: new Date(date).toISOString(),
      hasAttachment,
      attachmentId,
      snippet: message.snippet || text.substring(0, 200),
    };
  } catch (error) {
    console.error(`Error getting pending sale ${messageId}:`, error);
    return null;
  }
}

/**
 * Get attachment (shipping label) from email
 */
export async function getEmailAttachment(
  gmail: any,
  messageId: string,
  attachmentId: string
): Promise<{ data: string; filename: string } | null> {
  try {
    const response = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    });

    return {
      data: response.data.data, // Base64 encoded
      filename: `etiqueta-${messageId}.pdf`,
    };
  } catch (error) {
    console.error(`Error getting attachment ${attachmentId}:`, error);
    return null;
  }
}

/**
 * Extract text from email message parts
 */
function extractTextFromMessage(message: any): string {
  let bodyText = "";

  const extractText = (parts: any[]): string => {
    let text = "";
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text += Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.mimeType === "text/html" && part.body?.data) {
        const htmlText = Buffer.from(part.body.data, "base64").toString("utf-8");
        text += htmlText;
      } else if (part.parts) {
        text += extractText(part.parts);
      }
    }
    return text;
  };

  if (message.payload?.body?.data) {
    bodyText = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
  } else if (message.payload?.parts) {
    bodyText = extractText(message.payload.parts);
  }

  return bodyText;
}

/**
 * Process emails in batches
 */
export async function processEmailsBatch<T>(
  gmail: any,
  messageIds: string[],
  processor: (gmail: any, messageId: string) => Promise<T | null>,
  batchSize: number = 10
): Promise<T[]> {
  const results: T[] = [];

  console.log(`📧 Procesando ${messageIds.length} correos en lotes de ${batchSize}...`);

  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);
    const batchPromises = batch.map((id) => processor(gmail, id));
    const batchResults = await Promise.all(batchPromises);
    
    const validResults = batchResults.filter((r): r is NonNullable<typeof r> => r !== null);
    results.push(...validResults);

    const processed = Math.min(i + batchSize, messageIds.length);
    console.log(`📊 Progreso: ${processed}/${messageIds.length} (${Math.round(processed/messageIds.length * 100)}%)`);

    if (i + batchSize < messageIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * Search for Vinted expenses (Destacado, Armario, etc.)
 */
export async function searchVintedExpenses(gmail: any): Promise<string[]> {
  return searchGmailEmails(
    gmail,
    'from:no-reply@vinted.es ("Tu factura" OR "destacado" OR "armario")'
  );
}

// Tipo para detalles de gasto
export interface ExpenseDetails {
  messageId: string;
  category: "destacado" | "armario" | "otros";
  amount: number;
  discount: number;
  totalAmount: number;
  description: string;
  itemCount: number;
  date: string;
  snippet: string;
}

/**
 * Get expense details from Vinted email
 */
export async function getExpenseDetails(
  gmail: any,
  messageId: string
): Promise<ExpenseDetails | null> {
  try {
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    const dateHeader = headers.find((h: any) => h.name === "Date");
    const subjectHeader = headers.find((h: any) => h.name === "Subject");
    const date = dateHeader?.value || message.internalDate || "";
    const subject = subjectHeader?.value || "";

    // Get email body
    let bodyText = extractTextFromMessage(message);
    const text = bodyText || message.snippet || "";

    // Parse category
    const category = parseExpenseCategory(text, subject);

    // Parse amounts
    const amounts = parseExpenseAmount(text);
    if (!amounts) {
      return null;
    }

    // Parse item count
    const itemCount = parseItemCount(text);

    // Build description
    let description = "";
    if (category === "destacado") {
      description = itemCount > 0 
        ? `Destacado internacional de 3 días (${itemCount} artículos)`
        : "Destacado internacional de 3 días";
    } else if (category === "armario") {
      description = "Armario";
    } else {
      // Extract from subject or body
      description = subject || "Gasto Vinted";
    }

    return {
      messageId,
      category,
      amount: amounts.amount,
      discount: amounts.discount,
      totalAmount: amounts.total,
      description,
      itemCount,
      date: new Date(date).toISOString(),
      snippet: message.snippet || text.substring(0, 200),
    };
  } catch (error) {
    console.error(`Error getting expense ${messageId}:`, error);
    return null;
  }
}
