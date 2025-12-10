/**
 * Enhanced Gmail client with OAuth token management
 */

import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { logger } from '@/libs/monitoring/logger';

/**
 * Create OAuth2 client with credentials
 */
export function createOAuth2Client(): OAuth2Client {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ID,
    process.env.GOOGLE_SECRET,
    process.env.NEXTAUTH_URL + '/api/auth/callback/google'
  );
  
  return oauth2Client;
}

/**
 * Set credentials for OAuth2 client
 */
export function setOAuth2Credentials(
  oauth2Client: OAuth2Client,
  accessToken: string,
  refreshToken?: string
): void {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiryDate: number }> {
  const oauth2Client = createOAuth2Client();
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });
  
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('No access token returned from refresh');
    }
    
    logger.debug('Access token refreshed successfully');
    
    return {
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date || Date.now() + 3600 * 1000,
    };
    
  } catch (error: any) {
    if (error.message?.includes('invalid_grant')) {
      logger.error('Refresh token invalid or revoked');
      throw new Error('User needs to re-authorize Gmail access');
    }
    
    logger.error('Error refreshing access token', error);
    throw error;
  }
}

/**
 * Create Gmail API client with OAuth
 */
export function createGmailClient(oauth2Client: OAuth2Client) {
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Check if OAuth token is expired
 */
export function isTokenExpired(expiryDate?: number): boolean {
  if (!expiryDate) return true;
  
  // Add 5 minute buffer
  const bufferMs = 5 * 60 * 1000;
  return Date.now() >= (expiryDate - bufferMs);
}

/**
 * Get or refresh access token
 */
export async function getValidAccessToken(
  currentAccessToken: string,
  refreshToken: string | undefined,
  expiryDate: number | undefined
): Promise<string> {
  // Token still valid
  if (!isTokenExpired(expiryDate)) {
    logger.debug('Access token still valid');
    return currentAccessToken;
  }
  
  // Need refresh
  if (!refreshToken) {
    throw new Error('No refresh token available, user needs to re-authorize');
  }
  
  logger.info('Access token expired, refreshing...');
  const { accessToken } = await refreshAccessToken(refreshToken);
  return accessToken;
}

