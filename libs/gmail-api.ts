import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { parseVintedAmount } from "./gmail-utils";

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
 * Search Gmail for Vinted emails
 */
export async function searchVintedEmails(
  gmail: any,
  query: string = 'from:no-reply@vinted.es "Transferencia a tu saldo Vinted"'
): Promise<string[]> {
  try {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 50,
    });

    const messages = response.data.messages || [];
    return messages.map((msg: any) => msg.id);
  } catch (error) {
    console.error("Error searching Gmail:", error);
    throw error;
  }
}

/**
 * Get email message details
 */
export async function getEmailDetails(
  gmail: any,
  messageId: string
): Promise<{
  messageId: string;
  amount: number;
  date: string;
  snippet: string;
} | null> {
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
    let bodyText = "";
    if (message.payload?.body?.data) {
      bodyText = Buffer.from(message.payload.body.data, "base64").toString(
        "utf-8"
      );
    } else if (message.payload?.parts) {
      // Try to find text/plain part
      for (const part of message.payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
          break;
        }
      }
    }

    // Use snippet if body is empty
    const text = bodyText || message.snippet || "";

    // Parse amount from email
    const amount = parseVintedAmount(text);

    if (amount === null) {
      return null;
    }

    return {
      messageId,
      amount,
      date: new Date(date).toISOString(),
      snippet: message.snippet || text.substring(0, 200),
    };
  } catch (error) {
    console.error(`Error getting email ${messageId}:`, error);
    return null;
  }
}

