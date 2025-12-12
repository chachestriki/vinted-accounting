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

// Tipo para detalles de gasto (armario o destacado)
export interface ExpenseDetails {
  messageId: string;
  type: "armario" | "destacado";
  description: string;
  amount: number;
  date: string;
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

    // Extract item name - formato exacto: "El pedido de "nombre del artículo" ha finalizado"
    let itemName = "Artículo desconocido";
    
    // Limpiar HTML y CSS del texto antes de procesar
    let cleanText = text
      // Eliminar etiquetas HTML
      .replace(/<[^>]+>/g, " ")
      // Eliminar estilos CSS inline (style="...")
      .replace(/style\s*=\s*"[^"]*"/gi, " ")
      // Eliminar propiedades CSS sueltas (line-height: 1.5;)
      .replace(/[a-z-]+\s*:\s*[^;]+;/gi, " ")
      // Eliminar llaves CSS
      .replace(/[{}]/g, " ")
      // Normalizar espacios
      .replace(/\s+/g, " ")
      .replace(/\n/g, " ")
      .trim();
    
    const itemNamePatterns = [
      // Patrón exacto del formato: "El pedido de "nombre" ha finalizado"
      /El pedido de\s+"([^"]+)"\s+ha finalizado/i,
      // Patrón sin "ha finalizado" al final
      /El pedido de\s+"([^"]+)"/i,
      // Variaciones sin mayúsculas
      /el pedido de\s+"([^"]+)"/i,
      // Con espacios o saltos de línea entre "de" y las comillas
      /El pedido de\s*"([^"]+)"/i,
      // Patrón más flexible que busca cualquier texto entre comillas después de "pedido de"
      /pedido\s+de\s*"([^"]+)"/i,
    ];
    
    for (const pattern of itemNamePatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1] && match[1].trim().length > 0) {
        const extractedName = match[1].trim();
        // Validar que no sea CSS, HTML o texto genérico
        const isInvalid = 
          extractedName.toLowerCase() === "artículo" ||
          extractedName.toLowerCase() === "pedido" ||
          extractedName.length <= 2 ||
          extractedName.match(/^\d+$/) || // Solo números
          extractedName.includes(":") || // Propiedades CSS
          extractedName.includes(";") || // Propiedades CSS
          extractedName.includes("{") || // CSS
          extractedName.includes("}") || // CSS
          extractedName.match(/^[a-z-]+:\s*[^;]+$/i); // Patrón CSS (propiedad: valor)
        
        if (!isInvalid) {
          itemName = extractedName;
          break;
        }
      }
    }
    
    // Si aún no se encontró, buscar cualquier texto entre comillas después de "El pedido"
    if (itemName === "Artículo desconocido") {
      const fallbackMatch = cleanText.match(/El pedido[^"]*"([^"]{3,})"/i);
      if (fallbackMatch && fallbackMatch[1]) {
        const fallbackName = fallbackMatch[1].trim();
        const isInvalid = 
          fallbackName.length <= 2 || 
          fallbackName.toLowerCase() === "artículo" || 
          fallbackName.toLowerCase() === "pedido" ||
          fallbackName.includes(":") ||
          fallbackName.includes(";") ||
          fallbackName.match(/^[a-z-]+:\s*[^;]+$/i);
        
        if (!isInvalid) {
          itemName = fallbackName;
        }
      }
    }

    // Extract transaction ID - usar messageId como fallback si no se encuentra
    const transactionId = parseTransactionId(text) || messageId;

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

    // Extract transaction ID - usar messageId como fallback si no se encuentra
    const transactionId = parseTransactionId(text) || messageId;

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
 * Prioriza texto plano sobre HTML para evitar CSS inline
 */
function extractTextFromMessage(message: any): string {
  let bodyText = "";
  let plainText = "";
  let htmlText = "";

  const extractText = (parts: any[]): { plain: string; html: string } => {
    let plain = "";
    let html = "";
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        plain += Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html += Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.parts) {
        const result = extractText(part.parts);
        plain += result.plain;
        html += result.html;
      }
    }
    return { plain, html };
  };

  if (message.payload?.body?.data) {
    const mimeType = message.payload?.mimeType || "";
    if (mimeType === "text/plain") {
      plainText = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
    } else {
      htmlText = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
    }
  } else if (message.payload?.parts) {
    const result = extractText(message.payload.parts);
    plainText = result.plain;
    htmlText = result.html;
  }

  // Priorizar texto plano, si no existe usar HTML limpiado
  if (plainText) {
    bodyText = plainText;
  } else if (htmlText) {
    // Limpiar HTML básico: eliminar etiquetas y estilos
    bodyText = htmlText
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ") // Eliminar bloques <style>
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ") // Eliminar bloques <script>
      .replace(/<[^>]+>/g, " ") // Eliminar todas las etiquetas HTML
      .replace(/&nbsp;/g, " ") // Reemplazar &nbsp;
      .replace(/&[a-z]+;/gi, " ") // Reemplazar otras entidades HTML
      .replace(/\s+/g, " ") // Normalizar espacios
      .trim();
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
    
    const validResults = batchResults.filter((r) => r !== null) as T[];
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
