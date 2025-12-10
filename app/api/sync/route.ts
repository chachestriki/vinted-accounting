/**
 * Manual Sync Endpoint
 * Allows users to trigger sync manually from UI
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/libs/next-auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import { orchestrateSync } from '@/libs/sync/sync-orchestrator';
import { logger } from '@/libs/monitoring/logger';

export async function POST(req: Request) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    logger.info('Manual sync triggered', { userId });
    
    // 2. Trigger sync
    const result = await orchestrateSync(userId, 'manual');
    
    // 3. Revalidate cached data (Next.js ISR)
    revalidatePath('/dashboard');
    revalidatePath('/sales');
    revalidatePath('/expenses');
    revalidateTag('sales');
    revalidateTag('expenses');
    revalidateTag('dashboard-stats');
    
    // 4. Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Sync completed successfully',
        stats: {
          newEmails: result.newEmailsProcessed,
          salesAdded: result.salesAdded,
          expensesAdded: result.expensesAdded,
          duration: result.duration,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Sync completed with errors',
          stats: {
            newEmails: result.newEmailsProcessed,
            salesAdded: result.salesAdded,
            expensesAdded: result.expensesAdded,
            duration: result.duration,
          },
          errors: result.errors.map(e => e.error),
        },
        { status: 207 } // Multi-Status (partial success)
      );
    }
    
  } catch (error: any) {
    logger.error('Manual sync error', error);
    
    // User-friendly error messages
    let errorMessage = 'Sync failed';
    let statusCode = 500;
    
    if (error.message?.includes('already in progress')) {
      errorMessage = 'A sync is already in progress. Please wait.';
      statusCode = 409; // Conflict
    } else if (error.message?.includes('not connected Gmail')) {
      errorMessage = 'Please connect your Gmail account first';
      statusCode = 400;
    } else if (error.message?.includes('repeated errors')) {
      errorMessage = error.message;
      statusCode = 429; // Too Many Requests
    } else if (error.message?.includes('invalid_grant')) {
      errorMessage = 'Gmail access expired. Please reconnect your account.';
      statusCode = 401;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: statusCode }
    );
  }
}

