/**
 * Sync Orchestrator
 * Main coordinator for sync operations
 */

import type { SyncResult, SyncTrigger } from '@/types/sync';
import { createOAuth2Client, setOAuth2Credentials, getValidAccessToken } from '@/libs/gmail/gmail-client';
import { incrementalSync } from './sync-service';
import { SyncLock } from './sync-lock';
import { logger } from '@/libs/monitoring/logger';
import { metrics } from '@/libs/monitoring/metrics';
import { SYNC_CONFIG } from '@/config/sync-config';
import SyncLog from '@/models/SyncLog';
import SyncMeta from '@/models/SyncMeta';
import User from '@/models/User';
import connectMongo from '@/libs/mongoose';

/**
 * Orchestrate sync for a single user
 */
export async function orchestrateSync(
  userId: string,
  triggeredBy: SyncTrigger
): Promise<SyncResult> {
  const lockId = `${triggeredBy}-${Date.now()}`;
  
  try {
    await connectMongo();
    
    // Check consecutive errors threshold
    const syncMeta = await SyncMeta.findOne({ userId });
    if (syncMeta && syncMeta.consecutiveErrors >= SYNC_CONFIG.MAX_CONSECUTIVE_ERRORS) {
      // Check if cooldown period has passed
      if (syncMeta.lastErrorAt) {
        const timeSinceLastError = Date.now() - syncMeta.lastErrorAt.getTime();
        if (timeSinceLastError < SYNC_CONFIG.ERROR_COOLDOWN_MS) {
          throw new Error(`Sync paused due to repeated errors. Try again in ${Math.ceil((SYNC_CONFIG.ERROR_COOLDOWN_MS - timeSinceLastError) / 60000)} minutes`);
        }
      }
    }
    
    // Acquire lock
    const lockAcquired = await SyncLock.acquire(userId, lockId);
    if (!lockAcquired) {
      throw new Error('Sync already in progress for this user');
    }
    
    try {
      // Get user OAuth tokens
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // TODO: You'll need to store OAuth tokens in User model
      // For now, using session-based access token
      const accessToken = user.gmailAccessToken;
      const refreshToken = user.gmailRefreshToken;
      const expiryDate = user.gmailTokenExpiry;
      
      if (!accessToken) {
        throw new Error('User has not connected Gmail');
      }
      
      // Get or refresh valid access token
      const validAccessToken = await getValidAccessToken(
        accessToken,
        refreshToken,
        expiryDate
      );
      
      // Create OAuth2 client
      const oauth2Client = createOAuth2Client();
      setOAuth2Credentials(oauth2Client, validAccessToken, refreshToken);
      
      // Run sync
      const result = await incrementalSync(userId, oauth2Client, triggeredBy);
      
      // Log sync result
      await SyncLog.create({
        userId: result.userId,
        triggeredBy: result.triggeredBy,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        duration: result.duration,
        status: result.status,
        newEmailsProcessed: result.newEmailsProcessed,
        salesAdded: result.salesAdded,
        expensesAdded: result.expensesAdded,
        emailsSkipped: result.emailsSkipped,
        gmailApiCalls: result.gmailApiCalls,
        quotaUnitsUsed: result.quotaUnitsUsed,
        historyIdBefore: result.historyIdBefore,
        historyIdAfter: result.historyIdAfter,
        errors: result.errors,
      });
      
      // Track metrics
      await metrics.trackSyncCompleted(result);
      
      // Check for slow sync
      if (result.duration > SYNC_CONFIG.SLOW_SYNC_THRESHOLD_MS) {
        await metrics.trackSlowSync(
          userId,
          result.duration,
          SYNC_CONFIG.SLOW_SYNC_THRESHOLD_MS
        );
      }
      
      // Release lock
      await SyncLock.release(userId);
      
      return result;
      
    } catch (error) {
      // Release lock on error
      await SyncLock.release(userId);
      throw error;
    }
    
  } catch (error: any) {
    logger.syncFailed(userId, error);
    
    // Track failure
    await metrics.trackSyncFailed(userId, error.message, 0);
    
    // Return error result
    return {
      success: false,
      userId,
      triggeredBy,
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 0,
      newEmailsProcessed: 0,
      salesAdded: 0,
      expensesAdded: 0,
      emailsSkipped: 0,
      gmailApiCalls: 0,
      quotaUnitsUsed: 0,
      historyIdBefore: null,
      historyIdAfter: '',
      status: 'failed',
      errors: [{
        emailId: 'N/A',
        error: error.message || String(error),
        timestamp: new Date(),
      }],
    };
  }
}

/**
 * Orchestrate sync for multiple users (batch)
 */
export async function orchestrateBatchSync(
  userIds: string[],
  triggeredBy: SyncTrigger
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  
  logger.info('Starting batch sync', {
    userCount: userIds.length,
    triggeredBy,
  });
  
  // Process in batches to respect concurrency limit
  for (let i = 0; i < userIds.length; i += SYNC_CONFIG.MAX_CONCURRENT_SYNCS) {
    const batch = userIds.slice(i, i + SYNC_CONFIG.MAX_CONCURRENT_SYNCS);
    
    const batchPromises = batch.map(userId => 
      orchestrateSync(userId, triggeredBy)
        .catch(error => {
          logger.error('Batch sync failed for user', error, { userId });
          return {
            success: false,
            userId,
            triggeredBy,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 0,
            newEmailsProcessed: 0,
            salesAdded: 0,
            expensesAdded: 0,
            emailsSkipped: 0,
            gmailApiCalls: 0,
            quotaUnitsUsed: 0,
            historyIdBefore: null,
            historyIdAfter: '',
            status: 'failed' as const,
            errors: [{
              emailId: 'N/A',
              error: error.message || String(error),
              timestamp: new Date(),
            }],
          };
        })
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    logger.info('Batch sync progress', {
      processed: Math.min(i + SYNC_CONFIG.MAX_CONCURRENT_SYNCS, userIds.length),
      total: userIds.length,
    });
    
    // Small delay between batches
    if (i + SYNC_CONFIG.MAX_CONCURRENT_SYNCS < userIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  
  logger.info('Batch sync completed', {
    total: results.length,
    success: successCount,
    failed: failureCount,
  });
  
  return results;
}

