import mongoose from 'mongoose';
import toJSON from './plugins/toJSON';
import type { SyncMetadata } from '@/types/sync';

/**
 * SyncMeta Collection
 * Stores sync metadata per user including historyId for incremental sync
 */
const syncMetaSchema = new mongoose.Schema<SyncMetadata>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    
    // Gmail state for incremental sync
    historyId: {
      type: String,
      default: null,
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    nextScheduledSync: {
      type: Date,
      default: null,
      index: true, // For cron queries
    },
    
    // Statistics
    totalEmailsProcessed: {
      type: Number,
      default: 0,
    },
    totalSalesFound: {
      type: Number,
      default: 0,
    },
    totalExpensesFound: {
      type: Number,
      default: 0,
    },
    
    // Distributed lock mechanism
    syncInProgress: {
      type: Boolean,
      default: false,
      index: true,
    },
    syncStartedAt: {
      type: Date,
      default: null,
    },
    syncLockedBy: {
      type: String,
      default: null,
    },
    
    // Error tracking
    consecutiveErrors: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    lastErrorAt: {
      type: Date,
      default: null,
    },
    
    // Parser version tracking
    currentParserVersion: {
      type: String,
      default: 'v2',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Index for detecting stuck syncs
syncMetaSchema.index({ syncInProgress: 1, syncStartedAt: 1 });

// add plugin that converts mongoose to json
syncMetaSchema.plugin(toJSON);

export default (mongoose.models.SyncMeta ||
  mongoose.model<SyncMetadata>('SyncMeta', syncMetaSchema)) as mongoose.Model<SyncMetadata>;

