/**
 * Metrics tracking for sync operations
 * Integrate with your preferred analytics service (Mixpanel, Amplitude, etc.)
 */

import type { SyncResult } from '@/types/sync';
import { logger } from './logger';

interface MetricEvent {
  name: string;
  userId?: string;
  properties: Record<string, any>;
  timestamp: Date;
}

class MetricsTracker {
  /**
   * Track sync completion
   */
  async trackSyncCompleted(result: SyncResult): Promise<void> {
    const event: MetricEvent = {
      name: 'gmail_sync_completed',
      userId: result.userId,
      properties: {
        triggeredBy: result.triggeredBy,
        duration: result.duration,
        newEmails: result.newEmailsProcessed,
        salesAdded: result.salesAdded,
        expensesAdded: result.expensesAdded,
        quotaUsed: result.quotaUnitsUsed,
        status: result.status,
        hasErrors: result.errors.length > 0,
      },
      timestamp: result.completedAt,
    };

    await this.sendEvent(event);
  }

  /**
   * Track sync failure
   */
  async trackSyncFailed(userId: string, error: string, duration: number): Promise<void> {
    const event: MetricEvent = {
      name: 'gmail_sync_failed',
      userId,
      properties: {
        error,
        duration,
      },
      timestamp: new Date(),
    };

    await this.sendEvent(event);
  }

  /**
   * Track slow sync
   */
  async trackSlowSync(userId: string, duration: number, threshold: number): Promise<void> {
    const event: MetricEvent = {
      name: 'gmail_sync_slow',
      userId,
      properties: {
        duration,
        threshold,
      },
      timestamp: new Date(),
    };

    await this.sendEvent(event);
  }

  /**
   * Track quota usage
   */
  async trackQuotaUsage(userId: string, quotaUnits: number): Promise<void> {
    const event: MetricEvent = {
      name: 'gmail_quota_used',
      userId,
      properties: {
        quotaUnits,
      },
      timestamp: new Date(),
    };

    await this.sendEvent(event);
  }

  /**
   * Track repeated errors
   */
  async trackRepeatedErrors(userId: string, errorCount: number): Promise<void> {
    const event: MetricEvent = {
      name: 'gmail_sync_repeated_errors',
      userId,
      properties: {
        errorCount,
      },
      timestamp: new Date(),
    };

    await this.sendEvent(event);
  }

  /**
   * Send event to analytics service
   */
  private async sendEvent(event: MetricEvent): Promise<void> {
    try {
      // Log locally
      logger.debug('Metric tracked', {
        event: event.name,
        userId: event.userId,
        ...event.properties,
      });

      // TODO: Integrate with your analytics service
      // Examples:
      
      // Mixpanel
      // await mixpanel.track(event.name, {
      //   distinct_id: event.userId,
      //   ...event.properties,
      // });

      // Amplitude
      // await amplitude.track({
      //   user_id: event.userId,
      //   event_type: event.name,
      //   event_properties: event.properties,
      // });

      // Vercel Analytics
      // import { track } from '@vercel/analytics';
      // track(event.name, event.properties);

      // Custom backend
      // await fetch('/api/analytics', {
      //   method: 'POST',
      //   body: JSON.stringify(event),
      // });

    } catch (error) {
      logger.error('Failed to send metric', error, { event: event.name });
    }
  }
}

// Singleton instance
export const metrics = new MetricsTracker();

/**
 * Track sync metrics wrapper
 */
export async function withMetrics<T>(
  operation: string,
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    // Track success
    logger.debug(`${operation} succeeded`, { userId, duration });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    // Track failure
    await metrics.trackSyncFailed(
      userId,
      error instanceof Error ? error.message : String(error),
      duration
    );
    
    throw error;
  }
}

