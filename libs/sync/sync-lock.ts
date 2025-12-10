/**
 * Distributed lock mechanism using MongoDB
 * Prevents concurrent syncs for the same user
 */

import SyncMeta from '@/models/SyncMeta';
import { SYNC_CONFIG } from '@/config/sync-config';
import { logger } from '@/libs/monitoring/logger';
import connectMongo from '@/libs/mongoose';

export class SyncLock {
  /**
   * Acquire sync lock for a user
   */
  static async acquire(userId: string, lockedBy: string): Promise<boolean> {
    try {
      await connectMongo();
      
      // Check if sync is already in progress
      const syncMeta = await SyncMeta.findOne({ userId });
      
      if (syncMeta?.syncInProgress) {
        // Check if lock is stale (older than threshold)
        if (syncMeta.syncStartedAt) {
          const lockAge = Date.now() - syncMeta.syncStartedAt.getTime();
          
          if (lockAge < SYNC_CONFIG.STALE_LOCK_THRESHOLD_MS) {
            logger.warn('Sync already in progress', {
              userId,
              lockAge,
              lockedBy: syncMeta.syncLockedBy,
            });
            return false;
          }
          
          // Stale lock detected - clear it
          logger.warn('Stale lock detected, clearing', {
            userId,
            lockAge,
            threshold: SYNC_CONFIG.STALE_LOCK_THRESHOLD_MS,
          });
          
          await this.release(userId);
        }
      }
      
      // Acquire lock
      const result = await SyncMeta.updateOne(
        { userId },
        {
          $set: {
            syncInProgress: true,
            syncStartedAt: new Date(),
            syncLockedBy: lockedBy,
          },
          $setOnInsert: {
            userId,
            historyId: null,
            lastSyncAt: null,
            nextScheduledSync: null,
            totalEmailsProcessed: 0,
            totalSalesFound: 0,
            totalExpensesFound: 0,
            consecutiveErrors: 0,
            lastError: null,
            lastErrorAt: null,
            currentParserVersion: SYNC_CONFIG.CURRENT_PARSER_VERSION,
          },
        },
        { upsert: true }
      );
      
      logger.debug('Lock acquired', { userId, lockedBy });
      return true;
      
    } catch (error) {
      logger.error('Error acquiring lock', error, { userId });
      return false;
    }
  }
  
  /**
   * Release sync lock for a user
   */
  static async release(userId: string): Promise<void> {
    try {
      await connectMongo();
      
      await SyncMeta.updateOne(
        { userId },
        {
          $set: {
            syncInProgress: false,
            syncStartedAt: null,
            syncLockedBy: null,
          },
        }
      );
      
      logger.debug('Lock released', { userId });
      
    } catch (error) {
      logger.error('Error releasing lock', error, { userId });
    }
  }
  
  /**
   * Check if user has active lock
   */
  static async isLocked(userId: string): Promise<boolean> {
    try {
      await connectMongo();
      
      const syncMeta = await SyncMeta.findOne({ userId });
      
      if (!syncMeta?.syncInProgress) {
        return false;
      }
      
      // Check if lock is stale
      if (syncMeta.syncStartedAt) {
        const lockAge = Date.now() - syncMeta.syncStartedAt.getTime();
        if (lockAge >= SYNC_CONFIG.STALE_LOCK_THRESHOLD_MS) {
          return false; // Stale lock = not locked
        }
      }
      
      return true;
      
    } catch (error) {
      logger.error('Error checking lock', error, { userId });
      return false;
    }
  }
  
  /**
   * Clear all stale locks (cleanup utility)
   */
  static async clearStaleLocks(): Promise<number> {
    try {
      await connectMongo();
      
      const staleTime = new Date(Date.now() - SYNC_CONFIG.STALE_LOCK_THRESHOLD_MS);
      
      const result = await SyncMeta.updateMany(
        {
          syncInProgress: true,
          syncStartedAt: { $lt: staleTime },
        },
        {
          $set: {
            syncInProgress: false,
            syncStartedAt: null,
            syncLockedBy: null,
          },
        }
      );
      
      if (result.modifiedCount > 0) {
        logger.info('Cleared stale locks', { count: result.modifiedCount });
      }
      
      return result.modifiedCount;
      
    } catch (error) {
      logger.error('Error clearing stale locks', error);
      return 0;
    }
  }
}

