/**
 * Sync Status Endpoint
 * Get current sync status for authenticated user
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/libs/next-auth';
import SyncMeta from '@/models/SyncMeta';
import SyncLog from '@/models/SyncLog';
import connectMongo from '@/libs/mongoose';

export async function GET(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    await connectMongo();
    
    // Get sync metadata
    const syncMeta = await SyncMeta.findOne({ userId }).lean();
    
    // Get last sync log
    const lastSync = await SyncLog.findOne({ userId })
      .sort({ createdAt: -1 })
      .lean();
    
    // Check if sync is currently in progress
    const isSyncing = syncMeta?.syncInProgress || false;
    
    // Calculate next sync time (if applicable)
    let nextSyncIn: number | null = null;
    if (syncMeta?.nextScheduledSync) {
      nextSyncIn = Math.max(0, syncMeta.nextScheduledSync.getTime() - Date.now());
    }
    
    return NextResponse.json({
      syncing: isSyncing,
      lastSyncAt: syncMeta?.lastSyncAt || null,
      nextScheduledSync: syncMeta?.nextScheduledSync || null,
      nextSyncInMs: nextSyncIn,
      totalEmailsProcessed: syncMeta?.totalEmailsProcessed || 0,
      totalSalesFound: syncMeta?.totalSalesFound || 0,
      totalExpensesFound: syncMeta?.totalExpensesFound || 0,
      consecutiveErrors: syncMeta?.consecutiveErrors || 0,
      lastError: syncMeta?.lastError || null,
      lastSync: lastSync ? {
        status: lastSync.status,
        duration: lastSync.duration,
        newEmails: lastSync.newEmailsProcessed,
        salesAdded: lastSync.salesAdded,
        expensesAdded: lastSync.expensesAdded,
        triggeredBy: lastSync.triggeredBy,
        completedAt: lastSync.completedAt,
      } : null,
    });
    
  } catch (error: any) {
    console.error('Error getting sync status:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get sync status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

