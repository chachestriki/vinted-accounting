/**
 * Vercel Cron Endpoint - Automated Gmail Sync
 * Runs hourly in production to sync all users
 */

import { NextResponse } from 'next/server';
import { isProduction, getCronSecret } from '@/config/sync-config';
import { syncQueue } from '@/libs/sync/sync-queue';
import { orchestrateSync } from '@/libs/sync/sync-orchestrator';
import { SyncLock } from '@/libs/sync/sync-lock';
import { logger } from '@/libs/monitoring/logger';
import SyncMeta from '@/models/SyncMeta';
import User from '@/models/User';
import connectMongo from '@/libs/mongoose';

export const maxDuration = 60; // 60 seconds for Pro plan, 10s for Hobby

export async function GET(req: Request) {
  const startTime = Date.now();
  
  try {
    // 1. Verify this is production (cron only runs in prod)
    if (!isProduction()) {
      return NextResponse.json(
        { error: 'Cron jobs only run in production' },
        { status: 403 }
      );
    }
    
    // 2. Verify Vercel cron secret
    const authHeader = req.headers.get('authorization');
    const expectedAuth = `Bearer ${getCronSecret()}`;
    
    if (authHeader !== expectedAuth) {
      logger.error('Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // 3. Optional: Verify User-Agent (Vercel cron has specific UA)
    const userAgent = req.headers.get('user-agent') || '';
    if (!userAgent.includes('vercel')) {
      logger.warn('Suspicious cron request - invalid user agent', { userAgent });
    }
    
    logger.info('Cron sync started');
    
    await connectMongo();
    
    // 4. Clear any stale locks first
    await SyncLock.clearStaleLocks();
    
    // 5. Get all users who need sync (have Gmail connected)
    // TODO: Adjust query based on how you track Gmail connection status
    const users = await User.find({
      gmailAccessToken: { $exists: true, $ne: null },
    }).select('_id').lean();
    
    if (!users || users.length === 0) {
      logger.info('No users to sync');
      return NextResponse.json({
        success: true,
        message: 'No users to sync',
        usersProcessed: 0,
        duration: Date.now() - startTime,
      });
    }
    
    logger.info('Users found for sync', { count: users.length });
    
    // 6. Enqueue all users for sync via queue
    // This ensures we don't exceed execution time limit
    const queuedCount = 0;
    
    for (const user of users) {
      try {
        await syncQueue.enqueue(user._id.toString(), 'cron', 0);
      } catch (error) {
        logger.error('Error enqueueing user', error, { userId: user._id.toString() });
      }
    }
    
    // 7. Process queue (as many as possible within time limit)
    const processed: string[] = [];
    const failed: string[] = [];
    const timeLimit = (maxDuration - 5) * 1000; // Leave 5s buffer
    
    while (Date.now() - startTime < timeLimit) {
      const job = await syncQueue.getNextJob();
      
      if (!job) {
        break; // No more jobs
      }
      
      try {
        const result = await orchestrateSync(job.userId, 'cron');
        
        if (result.success) {
          await syncQueue.completeJob(job._id.toString());
          processed.push(job.userId);
        } else {
          await syncQueue.failJob(job._id.toString(), result.errors[0]?.error || 'Unknown error');
          failed.push(job.userId);
        }
        
      } catch (error: any) {
        logger.error('Sync failed for queued user', error, { userId: job.userId });
        await syncQueue.failJob(job._id.toString(), error.message);
        failed.push(job.userId);
      }
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('Cron sync completed', {
      totalUsers: users.length,
      processed: processed.length,
      failed: failed.length,
      duration,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Cron sync completed',
      totalUsers: users.length,
      processed: processed.length,
      failed: failed.length,
      duration,
    });
    
  } catch (error: any) {
    logger.error('Cron sync error', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

