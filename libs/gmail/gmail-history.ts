/**
 * Gmail History API wrapper for incremental sync
 */

import { google, gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GmailHistoryChange } from '@/types/gmail';
import { SYNC_CONFIG } from '@/config/sync-config';
import { logger } from '@/libs/monitoring/logger';

/**
 * Get changes since last historyId using Gmail History API
 */
export async function getGmailHistory(
  oauth2Client: OAuth2Client,
  startHistoryId: string
): Promise<GmailHistoryChange> {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  const messagesAdded = new Set<string>();
  const messagesDeleted = new Set<string>();
  const labelsAdded = new Map<string, string[]>();
  const labelsRemoved = new Map<string, string[]>();
  
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;
  let apiCalls = 0;
  
  logger.debug('Fetching Gmail history', { startHistoryId });
  
  try {
    do {
      const response: gmail_v1.Schema$ListHistoryResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: startHistoryId,
        historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
        maxResults: SYNC_CONFIG.MAX_HISTORY_RESULTS,
        pageToken,
      });
      
      apiCalls++;
      
      // Update latest historyId
      if (response.data.historyId) {
        latestHistoryId = response.data.historyId;
      }
      
      // No history changes
      if (!response.data.history || response.data.history.length === 0) {
        logger.debug('No history changes found');
        break;
      }
      
      // Process each history record
      for (const historyItem of response.data.history) {
        // Messages added
        if (historyItem.messagesAdded) {
          for (const added of historyItem.messagesAdded) {
            if (added.message?.id) {
              messagesAdded.add(added.message.id);
            }
          }
        }
        
        // Messages deleted
        if (historyItem.messagesDeleted) {
          for (const deleted of historyItem.messagesDeleted) {
            if (deleted.message?.id) {
              messagesDeleted.add(deleted.message.id);
            }
          }
        }
        
        // Labels added
        if (historyItem.labelsAdded) {
          for (const labelChange of historyItem.labelsAdded) {
            const msgId = labelChange.message?.id;
            const labels = labelChange.labelIds || [];
            if (msgId) {
              labelsAdded.set(msgId, labels);
              // Also mark as potentially changed
              messagesAdded.add(msgId);
            }
          }
        }
        
        // Labels removed
        if (historyItem.labelsRemoved) {
          for (const labelChange of historyItem.labelsRemoved) {
            const msgId = labelChange.message?.id;
            const labels = labelChange.labelIds || [];
            if (msgId) {
              labelsRemoved.set(msgId, labels);
              // Also mark as potentially changed
              messagesAdded.add(msgId);
            }
          }
        }
      }
      
      pageToken = response.data.nextPageToken || undefined;
      
      // Safety: Add delay between requests
      if (pageToken) {
        await new Promise(resolve => setTimeout(resolve, SYNC_CONFIG.REQUEST_DELAY_MS));
      }
      
    } while (pageToken);
    
    logger.info('Gmail history fetched', {
      apiCalls,
      messagesAdded: messagesAdded.size,
      messagesDeleted: messagesDeleted.size,
      latestHistoryId,
    });
    
    return {
      historyId: latestHistoryId,
      messagesAdded: Array.from(messagesAdded),
      messagesDeleted: Array.from(messagesDeleted),
      labelsAdded,
      labelsRemoved,
    };
    
  } catch (error: any) {
    // History expired or invalid (404)
    if (error.code === 404 || error.message?.includes('invalid')) {
      logger.warn('Gmail history expired or invalid', { startHistoryId });
      throw new HistoryExpiredError('Gmail history expired, need full sync');
    }
    
    // Rate limit error (429)
    if (error.code === 429) {
      logger.error('Gmail API rate limit exceeded');
      throw new RateLimitError('Gmail API rate limit exceeded');
    }
    
    // Invalid grant (401) - OAuth token issue
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      logger.error('Gmail OAuth token invalid or revoked');
      throw new AuthError('Gmail access token invalid or revoked');
    }
    
    logger.error('Error fetching Gmail history', error);
    throw error;
  }
}

/**
 * Check if history is still valid (not expired)
 */
export async function isHistoryValid(
  oauth2Client: OAuth2Client,
  historyId: string
): Promise<boolean> {
  try {
    await getGmailHistory(oauth2Client, historyId);
    return true;
  } catch (error) {
    if (error instanceof HistoryExpiredError) {
      return false;
    }
    throw error;
  }
}

/**
 * Get current profile historyId
 */
export async function getCurrentHistoryId(
  oauth2Client: OAuth2Client
): Promise<string> {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  try {
    const response = await gmail.users.getProfile({
      userId: 'me',
    });
    
    const historyId = response.data.historyId;
    if (!historyId) {
      throw new Error('No historyId returned from Gmail profile');
    }
    
    logger.debug('Current Gmail historyId', { historyId });
    return historyId;
    
  } catch (error) {
    logger.error('Error getting current historyId', error);
    throw error;
  }
}

/**
 * Custom error classes
 */
export class HistoryExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoryExpiredError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

