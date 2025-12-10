/**
 * Gmail Sync Configuration
 * All sync-related settings in one place
 */

export const SYNC_CONFIG = {
  // Sync timing
  SYNC_INTERVAL_HOURS: 1, // How often to auto-sync in production
  SYNC_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes max per user sync
  STALE_LOCK_THRESHOLD_MS: 10 * 60 * 1000, // 10 minutes - clear locks older than this
  
  // Queue settings
  MAX_CONCURRENT_SYNCS: 5, // Process max 5 users simultaneously
  BATCH_SIZE: 10, // Process emails in batches of 10
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: [1000, 5000, 15000], // Exponential backoff
  
  // Gmail API settings
  MAX_HISTORY_RESULTS: 500, // Gmail history list max results
  MAX_MESSAGES_PER_SYNC: 1000, // Safety limit
  HISTORY_EXPIRY_DAYS: 7, // Gmail keeps history for ~7 days
  
  // Rate limiting
  GMAIL_QUOTA_PER_DAY: 1_000_000_000, // 1 billion quota units
  QUOTA_UNITS: {
    HISTORY_LIST: 2,
    MESSAGE_GET: 5,
    MESSAGE_LIST: 5,
  },
  REQUEST_DELAY_MS: 100, // Delay between API requests
  
  // Parser settings
  CURRENT_PARSER_VERSION: 'v2',
  MIN_CONFIDENCE_THRESHOLD: 0.6, // Mark for review if confidence < 0.6
  
  // Error thresholds
  MAX_CONSECUTIVE_ERRORS: 5, // Pause sync after 5 consecutive errors
  ERROR_COOLDOWN_MS: 30 * 60 * 1000, // 30 minutes cooldown after max errors
  
  // Monitoring
  SLOW_SYNC_THRESHOLD_MS: 30_000, // Alert if sync takes > 30 seconds
  LOG_RETENTION_DAYS: 90,
  QUEUE_RETENTION_DAYS: 7,
} as const;

/**
 * Check if we're in production environment
 */
export function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

/**
 * Check if we're in local development
 */
export function isLocalDev(): boolean {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL;
}

/**
 * Get cron secret for authentication
 */
export function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error('CRON_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Calculate next sync time
 */
export function getNextSyncTime(): Date {
  const now = new Date();
  now.setHours(now.getHours() + SYNC_CONFIG.SYNC_INTERVAL_HOURS);
  return now;
}

