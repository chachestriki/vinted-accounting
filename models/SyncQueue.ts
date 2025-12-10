import mongoose from 'mongoose';
import toJSON from './plugins/toJSON';
import type { SyncQueueItem } from '@/types/sync';

/**
 * SyncQueue Collection
 * Queue for managing sync jobs across multiple users
 */
const syncQueueSchema = new mongoose.Schema<SyncQueueItem>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    
    // Queue control
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    
    // Timing
    enqueuedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    scheduledFor: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    
    // Context
    triggeredBy: {
      type: String,
      enum: ['cron', 'manual', 'webhook'],
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    
    // Error tracking
    lastError: {
      type: String,
      default: null,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Compound index for queue processing (most important)
syncQueueSchema.index(
  { status: 1, scheduledFor: 1, priority: -1 },
  { name: 'queue_processing' }
);

// User status index
syncQueueSchema.index({ userId: 1, status: 1 });

// TTL index - automatically delete completed/failed items after 7 days
syncQueueSchema.index(
  { createdAt: 1 },
  { 
    expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    partialFilterExpression: { 
      status: { $in: ['completed', 'failed'] } 
    }
  }
);

// add plugin that converts mongoose to json
syncQueueSchema.plugin(toJSON);

export default (mongoose.models.SyncQueue ||
  mongoose.model<SyncQueueItem>('SyncQueue', syncQueueSchema)) as mongoose.Model<SyncQueueItem>;

