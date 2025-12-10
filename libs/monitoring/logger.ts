/**
 * Structured logging utility for sync operations
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  emailId?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

class SyncLogger {
  private logLevel: LogLevel = 'info';

  constructor() {
    // Set log level based on environment
    this.logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
      console.error(this.formatMessage('error', message, errorContext));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  /**
   * Log sync start
   */
  syncStarted(userId: string, triggeredBy: string): void {
    this.info('Sync started', { userId, triggeredBy });
  }

  /**
   * Log sync completion
   */
  syncCompleted(userId: string, duration: number, stats: Record<string, any>): void {
    this.info('Sync completed', { userId, duration, ...stats });
  }

  /**
   * Log sync error
   */
  syncFailed(userId: string, error: Error | unknown): void {
    this.error('Sync failed', error, { userId });
  }

  /**
   * Log Gmail API call
   */
  gmailApiCall(method: string, userId: string, quotaUnits: number): void {
    this.debug('Gmail API call', { method, userId, quotaUnits });
  }

  /**
   * Log queue operation
   */
  queueOperation(operation: string, userId: string, details?: Record<string, any>): void {
    this.debug('Queue operation', { operation, userId, ...details });
  }

  /**
   * Log performance warning
   */
  performanceWarning(operation: string, duration: number, threshold: number): void {
    this.warn('Slow operation detected', { operation, duration, threshold });
  }
}

// Singleton instance
export const logger = new SyncLogger();

/**
 * Measure execution time of async function
 */
export async function measureTime<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.debug(`${operation} completed`, { duration, ...context });
    return { result, duration };
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`${operation} failed`, error, { duration, ...context });
    throw error;
  }
}

