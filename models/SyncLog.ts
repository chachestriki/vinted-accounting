import mongoose from 'mongoose';
import toJSON from './plugins/toJSON';
import type { SyncLogEntry } from '@/types/sync';

/**
 * SyncLog Collection
 * Audit trail for all sync operations
 */
const syncLogSchema = new mongoose.Schema<SyncLogEntry>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    
    // Sync details
    triggeredBy: {
      type: String,
      enum: ['cron', 'manual', 'webhook'],
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    
    // Results
    status: {
      type: String,
      enum: ['success', 'partial', 'failed'],
      required: true,
      index: true,
    },
    newEmailsProcessed: {
      type: Number,
      default: 0,
    },
    salesAdded: {
      type: Number,
      default: 0,
    },
    expensesAdded: {
      type: Number,
      default: 0,
    },
    emailsSkipped: {
      type: Number,
      default: 0,
    },
    
    // API usage tracking
    gmailApiCalls: {
      type: Number,
      default: 0,
    },
    quotaUnitsUsed: {
      type: Number,
      default: 0,
    },
    
    // History tracking
    historyIdBefore: {
      type: String,
      default: null,
    },
    historyIdAfter: {
      type: String,
      required: true,
    },
    
    // Errors
    errors: {
      type: [{
        emailId: String,
        error: String,
        timestamp: Date,
      }],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Compound indexes for queries
syncLogSchema.index({ userId: 1, createdAt: -1 });
syncLogSchema.index({ status: 1, userId: 1 });

// TTL index - automatically delete logs older than 90 days
syncLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 } // 90 days
);

// add plugin that converts mongoose to json
syncLogSchema.plugin(toJSON);

export default (mongoose.models.SyncLog ||
  mongoose.model<SyncLogEntry>('SyncLog', syncLogSchema)) as mongoose.Model<SyncLogEntry>;

