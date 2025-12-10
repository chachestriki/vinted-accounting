/**
 * Gmail API type definitions
 */

import type { gmail_v1 } from 'googleapis';

export type GmailMessage = gmail_v1.Schema$Message;
export type GmailHistory = gmail_v1.Schema$History;
export type GmailHistoryList = gmail_v1.Schema$ListHistoryResponse;

export interface ParsedEmail {
  emailId: string;
  type: 'sale' | 'expense' | 'unknown';
  date: Date;
  snippet: string;
  
  // Sale-specific fields
  transactionId?: string;
  itemName?: string;
  amount?: number;
  shippingCarrier?: string;
  trackingNumber?: string;
  shippingDeadline?: Date;
  
  // Expense-specific fields
  category?: string;
  discount?: number;
  totalAmount?: number;
  description?: string;
  itemCount?: number;
  
  // Metadata
  parserVersion: string;
  confidence: number;
  needsReview: boolean;
}

export interface GmailOAuthTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

export interface GmailSyncStats {
  totalMessagesChecked: number;
  newMessagesFound: number;
  messagesDeleted: number;
  quotaUnitsUsed: number;
}

