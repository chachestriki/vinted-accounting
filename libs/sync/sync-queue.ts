/**
 * Sync Queue Manager
 * Manages concurrent sync operations across multiple users
 */

import type { SyncTrigger } from '@/types/sync';
import { SYNC_CONFIG } from '@/config/sync-config';
import { logger } from '@/libs/monitoring/logger';
import SyncQueue from '@/models/SyncQueue';
import connectMongo from '@/libs/mongoose';

export class SyncQueueManager {
  private activeJobs = new Map<string, Promise<any>>();
  
  /**
   * Enqueue a sync job
   */
  async enqueue(
    userId: string,
    triggeredBy: SyncTrigger,
    priority: number = 0,
    scheduledFor?: Date
  ): Promise<string> {
    try {
      await connectMongo();
      
      // Check if user already has pending job
      const existingJob = await SyncQueue.findOne({
        userId,
        status: { $in: ['pending', 'processing'] },
      });
      
      if (existingJob) {
        logger.warn('User already has pending sync job', { userId });
        return existingJob._id!.toString();
      }
      
      // Create new queue item
      const queueItem = await SyncQueue.create({
        userId,
        status: 'pending',
        priority,
        attempts: 0,
        maxAttempts: SYNC_CONFIG.MAX_RETRY_ATTEMPTS,
        enqueuedAt: new Date(),
        scheduledFor: scheduledFor || new Date(),
        triggeredBy,
        metadata: {},
      });
      
      logger.queueOperation('enqueued', userId, {
        queueId: queueItem._id,
        priority,
        triggeredBy,
      });
      
      return queueItem._id!.toString();
      
    } catch (error) {
      logger.error('Error enqueueing sync job', error, { userId });
      throw error;
    }
  }
  
  /**
   * Get next job to process
   */
  async getNextJob(): Promise<any> {
    try {
      await connectMongo();
      
      // Find highest priority pending job that's scheduled to run
      const job = await SyncQueue.findOneAndUpdate(
        {
          status: 'pending',
          scheduledFor: { $lte: new Date() },
        },
        {
          $set: {
            status: 'processing',
            startedAt: new Date(),
          },
          $inc: { attempts: 1 },
        },
        {
          sort: { priority: -1, enqueuedAt: 1 },
          new: true,
        }
      );
      
      if (job) {
        logger.queueOperation('processing', job.userId, {
          queueId: job._id,
          attempt: job.attempts,
        });
      }
      
      return job;
      
    } catch (error) {
      logger.error('Error getting next job', error);
      return null;
    }
  }
  
  /**
   * Mark job as completed
   */
  async completeJob(queueId: string): Promise<void> {
    try {
      await connectMongo();
      
      await SyncQueue.updateOne(
        { _id: queueId },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
          },
        }
      );
      
      logger.queueOperation('completed', '', { queueId });
      
    } catch (error) {
      logger.error('Error completing job', error, { queueId });
    }
  }
  
  /**
   * Mark job as failed
   */
  async failJob(queueId: string, error: string): Promise<void> {
    try {
      await connectMongo();
      
      const job = await SyncQueue.findById(queueId);
      
      if (!job) {
        logger.error('Job not found', undefined, { queueId });
        return;
      }
      
      // Check if should retry
      if (job.attempts < job.maxAttempts) {
        // Schedule retry with exponential backoff
        const backoffMs = SYNC_CONFIG.RETRY_BACKOFF_MS[job.attempts - 1] || 15000;
        const scheduledFor = new Date(Date.now() + backoffMs);
        
        await SyncQueue.updateOne(
          { _id: queueId },
          {
            $set: {
              status: 'pending',
              lastError: error,
              lastAttemptAt: new Date(),
              scheduledFor,
            },
          }
        );
        
        logger.queueOperation('retry', job.userId, {
          queueId,
          attempt: job.attempts,
          nextAttemptIn: backoffMs,
        });
        
      } else {
        // Max attempts reached - mark as failed
        await SyncQueue.updateOne(
          { _id: queueId },
          {
            $set: {
              status: 'failed',
              lastError: error,
              lastAttemptAt: new Date(),
              completedAt: new Date(),
            },
          }
        );
        
        logger.error('Job failed after max attempts', undefined, {
          queueId,
          userId: job.userId,
          attempts: job.attempts,
          error,
        });
      }
      
    } catch (error) {
      logger.error('Error failing job', error, { queueId });
    }
  }
  
  /**
   * Get pending job count
   */
  async getPendingCount(): Promise<number> {
    try {
      await connectMongo();
      return await SyncQueue.countDocuments({ status: 'pending' });
    } catch (error) {
      logger.error('Error getting pending count', error);
      return 0;
    }
  }
  
  /**
   * Get processing job count
   */
  async getProcessingCount(): Promise<number> {
    try {
      await connectMongo();
      return await SyncQueue.countDocuments({ status: 'processing' });
    } catch (error) {
      logger.error('Error getting processing count', error);
      return 0;
    }
  }
  
  /**
   * Cancel pending job
   */
  async cancelJob(queueId: string): Promise<boolean> {
    try {
      await connectMongo();
      
      const result = await SyncQueue.updateOne(
        { _id: queueId, status: 'pending' },
        {
          $set: {
            status: 'failed',
            lastError: 'Cancelled by user',
            completedAt: new Date(),
          },
        }
      );
      
      return result.modifiedCount > 0;
      
    } catch (error) {
      logger.error('Error cancelling job', error, { queueId });
      return false;
    }
  }
  
  /**
   * Clean up old completed/failed jobs
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    try {
      await connectMongo();
      
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      
      const result = await SyncQueue.deleteMany({
        status: { $in: ['completed', 'failed'] },
        completedAt: { $lt: cutoffDate },
      });
      
      if (result.deletedCount > 0) {
        logger.info('Cleaned up old queue items', { count: result.deletedCount });
      }
      
      return result.deletedCount;
      
    } catch (error) {
      logger.error('Error cleaning up queue', error);
      return 0;
    }
  }
}

// Singleton instance
export const syncQueue = new SyncQueueManager();

