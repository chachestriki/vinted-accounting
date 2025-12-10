/**
 * Type definitions for Gmail sync system
 */

import type { ObjectId } from 'mongoose';

export type SyncTrigger = 'cron' | 'manual' | 'webhook';
export type SyncStatus = 'success' | 'partial' | 'failed';
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SyncResult {
  success: boolean;
  userId: string;
  triggeredBy: SyncTrigger;
  startedAt: Date;
  completedAt: Date;
  duration: number; // milliseconds
  
  // Stats
  newEmailsProcessed: number;
  salesAdded: number;
  expensesAdded: number;
  emailsSkipped: number;
  
  // API usage
  gmailApiCalls: number;
  quotaUnitsUsed: number;
  
  // State
  historyIdBefore: string | null;
  historyIdAfter: string;
  
  // Errors
  status: SyncStatus;
  errors: SyncError[];
}

export interface SyncError {
  emailId: string;
  error: string;
  timestamp: Date;
}

export interface SyncMetadata {
  _id?: ObjectId;
  userId: string;
  
  // Gmail state
  historyId: string | null;
  lastSyncAt: Date | null;
  nextScheduledSync: Date | null;
  
  // Stats
  totalEmailsProcessed: number;
  totalSalesFound: number;
  totalExpensesFound: number;
  
  // Sync control (distributed lock)
  syncInProgress: boolean;
  syncStartedAt: Date | null;
  syncLockedBy: string | null;
  
  // Error tracking
  consecutiveErrors: number;
  lastError: string | null;
  lastErrorAt: Date | null;
  
  // Version tracking
  currentParserVersion: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SyncLogEntry {
  _id?: ObjectId;
  userId: string;
  
  // Sync details
  triggeredBy: SyncTrigger;
  startedAt: Date;
  completedAt: Date;
  duration: number;
  
  // Results
  status: SyncStatus;
  newEmailsProcessed: number;
  salesAdded: number;
  expensesAdded: number;
  emailsSkipped: number;
  
  // API usage
  gmailApiCalls: number;
  quotaUnitsUsed: number;
  
  // History tracking
  historyIdBefore: string | null;
  historyIdAfter: string;
  
  // Errors
  errors: SyncError[];
  
  createdAt?: Date;
}

export interface SyncQueueItem {
  _id?: ObjectId;
  userId: string;
  
  // Queue control
  status: QueueStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  
  // Timing
  enqueuedAt: Date;
  scheduledFor: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  
  // Context
  triggeredBy: SyncTrigger;
  metadata: Record<string, any>;
  
  // Error tracking
  lastError: string | null;
  lastAttemptAt: Date | null;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IncrementalSyncOptions {
  userId: string;
  accessToken: string;
  triggeredBy: SyncTrigger;
  forceFull?: boolean; // Force full sync even if history exists
}

export interface FullSyncOptions {
  userId: string;
  accessToken: string;
  triggeredBy: SyncTrigger;
}

export interface GmailHistoryChange {
  historyId: string;
  messagesAdded: string[];
  messagesDeleted: string[];
  labelsAdded: Map<string, string[]>; // messageId -> labels
  labelsRemoved: Map<string, string[]>; // messageId -> labels
}

