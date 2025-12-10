/**
 * Main Gmail Sync Service with Incremental Sync
 */

import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { SyncResult, SyncError } from '@/types/sync';
import type { GmailMessage } from '@/types/gmail';
import { SYNC_CONFIG } from '@/config/sync-config';
import { logger, measureTime } from '@/libs/monitoring/logger';
import { getGmailHistory, getCurrentHistoryId, HistoryExpiredError } from '@/libs/gmail/gmail-history';
import { 
  searchVintedCompletedSales, 
  searchVintedPendingSales,
  searchVintedExpenses,
  getCompletedSaleDetails,
  getPendingSaleDetails,
  getExpenseDetails,
  processEmailsBatch
} from '@/libs/gmail-api';
import SyncMeta from '@/models/SyncMeta';
import Sale from '@/models/Sale';
import Expense from '@/models/Expense';
import connectMongo from '@/libs/mongoose';

/**
 * Incremental sync using Gmail History API
 */
export async function incrementalSync(
  userId: string,
  oauth2Client: OAuth2Client,
  triggeredBy: 'cron' | 'manual' | 'webhook'
): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: SyncError[] = [];
  let gmailApiCalls = 0;
  let quotaUnitsUsed = 0;
  
  logger.syncStarted(userId, triggeredBy);
  
  try {
    await connectMongo();
    
    // Get sync metadata
    const syncMeta = await SyncMeta.findOne({ userId });
    
    // First sync - do full sync
    if (!syncMeta || !syncMeta.historyId) {
      logger.info('No history found, performing full sync', { userId });
      return await fullSync(userId, oauth2Client, triggeredBy);
    }
    
    const historyIdBefore = syncMeta.historyId;
    
    // Get history changes
    let historyChanges;
    try {
      historyChanges = await getGmailHistory(oauth2Client, historyIdBefore);
      gmailApiCalls++;
      quotaUnitsUsed += SYNC_CONFIG.QUOTA_UNITS.HISTORY_LIST;
    } catch (error) {
      if (error instanceof HistoryExpiredError) {
        logger.warn('History expired, falling back to full sync', { userId });
        return await fullSync(userId, oauth2Client, triggeredBy);
      }
      throw error;
    }
    
    // No changes
    if (historyChanges.messagesAdded.length === 0 && historyChanges.messagesDeleted.length === 0) {
      logger.info('No new changes found', { userId });
      
      // Update lastSyncAt even with no changes
      await SyncMeta.updateOne(
        { userId },
        { 
          lastSyncAt: new Date(),
          historyId: historyChanges.historyId,
        }
      );
      
      return {
        success: true,
        userId,
        triggeredBy,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        newEmailsProcessed: 0,
        salesAdded: 0,
        expensesAdded: 0,
        emailsSkipped: 0,
        gmailApiCalls,
        quotaUnitsUsed,
        historyIdBefore,
        historyIdAfter: historyChanges.historyId,
        status: 'success',
        errors: [],
      };
    }
    
    logger.info('Processing history changes', {
      userId,
      messagesAdded: historyChanges.messagesAdded.length,
      messagesDeleted: historyChanges.messagesDeleted.length,
    });
    
    // Remove deleted messages from added set
    const changedEmailIds = new Set(historyChanges.messagesAdded);
    for (const deletedId of historyChanges.messagesDeleted) {
      changedEmailIds.delete(deletedId);
    }
    
    // Fetch full message details for changed emails
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const messages: GmailMessage[] = [];
    
    for (const emailId of Array.from(changedEmailIds)) {
      try {
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: emailId,
          format: 'full',
        });
        
        messages.push(response.data);
        gmailApiCalls++;
        quotaUnitsUsed += SYNC_CONFIG.QUOTA_UNITS.MESSAGE_GET;
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, SYNC_CONFIG.REQUEST_DELAY_MS));
        
      } catch (error: any) {
        logger.error('Error fetching message', error, { userId, emailId });
        errors.push({
          emailId,
          error: error.message || String(error),
          timestamp: new Date(),
        });
      }
    }
    
    // Filter Vinted emails and parse them
    const { salesAdded, expensesAdded, emailsSkipped } = await processVintedEmails(
      gmail,
      messages,
      userId,
      errors
    );
    
    // Handle deletions (soft delete)
    if (historyChanges.messagesDeleted.length > 0) {
      await Sale.updateMany(
        { userId, gmailMessageId: { $in: historyChanges.messagesDeleted } },
        { $set: { deleted: true, deletedAt: new Date() } }
      );
      
      await Expense.updateMany(
        { userId, gmailMessageId: { $in: historyChanges.messagesDeleted } },
        { $set: { deleted: true, deletedAt: new Date() } }
      );
    }
    
    // Update sync metadata
    await SyncMeta.updateOne(
      { userId },
      {
        historyId: historyChanges.historyId,
        lastSyncAt: new Date(),
        totalEmailsProcessed: syncMeta.totalEmailsProcessed + messages.length,
        totalSalesFound: syncMeta.totalSalesFound + salesAdded,
        totalExpensesFound: syncMeta.totalExpensesFound + expensesAdded,
        consecutiveErrors: errors.length > 0 ? syncMeta.consecutiveErrors + 1 : 0,
        lastError: errors.length > 0 ? errors[0].error : null,
        lastErrorAt: errors.length > 0 ? new Date() : syncMeta.lastErrorAt,
      }
    );
    
    const result: SyncResult = {
      success: errors.length === 0,
      userId,
      triggeredBy,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      newEmailsProcessed: messages.length,
      salesAdded,
      expensesAdded,
      emailsSkipped,
      gmailApiCalls,
      quotaUnitsUsed,
      historyIdBefore,
      historyIdAfter: historyChanges.historyId,
      status: errors.length === 0 ? 'success' : (errors.length < messages.length ? 'partial' : 'failed'),
      errors,
    };
    
    logger.syncCompleted(userId, result.duration, {
      newEmails: messages.length,
      salesAdded,
      expensesAdded,
      quotaUsed: quotaUnitsUsed,
    });
    
    return result;
    
  } catch (error: any) {
    logger.syncFailed(userId, error);
    
    return {
      success: false,
      userId,
      triggeredBy,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      newEmailsProcessed: 0,
      salesAdded: 0,
      expensesAdded: 0,
      emailsSkipped: 0,
      gmailApiCalls,
      quotaUnitsUsed,
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
 * Full sync (initial or fallback)
 */
export async function fullSync(
  userId: string,
  oauth2Client: OAuth2Client,
  triggeredBy: 'cron' | 'manual' | 'webhook'
): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: SyncError[] = [];
  let gmailApiCalls = 0;
  let quotaUnitsUsed = 0;
  
  logger.info('Starting full sync', { userId });
  
  try {
    await connectMongo();
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Search for all Vinted emails
    const [completedSaleIds, pendingSaleIds, expenseIds] = await Promise.all([
      searchVintedCompletedSales(gmail),
      searchVintedPendingSales(gmail),
      searchVintedExpenses(gmail),
    ]);
    
    gmailApiCalls += 3;
    quotaUnitsUsed += 3 * SYNC_CONFIG.QUOTA_UNITS.MESSAGE_LIST;
    
    logger.info('Full sync search results', {
      userId,
      completedSales: completedSaleIds.length,
      pendingSales: pendingSaleIds.length,
      expenses: expenseIds.length,
    });
    
    let salesAdded = 0;
    let expensesAdded = 0;
    let emailsSkipped = 0;
    
    // Process completed sales
    const completedSales = await processEmailsBatch(
      gmail,
      completedSaleIds,
      getCompletedSaleDetails
    );
    gmailApiCalls += completedSaleIds.length;
    quotaUnitsUsed += completedSaleIds.length * SYNC_CONFIG.QUOTA_UNITS.MESSAGE_GET;
    
    for (const saleData of completedSales) {
      try {
        const result = await Sale.updateOne(
          { userId, transactionId: saleData.transactionId },
          {
            $set: {
              userId,
              transactionId: saleData.transactionId,
              itemName: saleData.itemName,
              amount: saleData.amount,
              status: 'completed',
              saleDate: new Date(saleData.date),
              completedDate: new Date(saleData.date),
              gmailMessageId: saleData.messageId,
              snippet: saleData.snippet,
              hasLabel: false,
              isManual: false,
            },
          },
          { upsert: true }
        );
        
        if (result.upsertedCount && result.upsertedCount > 0) {
          salesAdded++;
        } else {
          emailsSkipped++;
        }
      } catch (error: any) {
        logger.error('Error saving sale', error, { userId, emailId: saleData.messageId });
        errors.push({
          emailId: saleData.messageId,
          error: error.message || String(error),
          timestamp: new Date(),
        });
      }
    }
    
    // Process pending sales (shipping labels)
    const pendingSales = await processEmailsBatch(
      gmail,
      pendingSaleIds,
      getPendingSaleDetails
    );
    gmailApiCalls += pendingSaleIds.length;
    quotaUnitsUsed += pendingSaleIds.length * SYNC_CONFIG.QUOTA_UNITS.MESSAGE_GET;
    
    for (const saleData of pendingSales) {
      try {
        const result = await Sale.updateOne(
          { userId, transactionId: saleData.transactionId },
          {
            $set: {
              userId,
              transactionId: saleData.transactionId,
              itemName: saleData.itemName,
              status: 'pending',
              saleDate: new Date(saleData.date),
              shippingCarrier: saleData.shippingCarrier as any,
              trackingNumber: saleData.trackingNumber,
              shippingDeadline: new Date(saleData.shippingDeadline),
              gmailMessageId: saleData.messageId,
              labelMessageId: saleData.messageId,
              hasLabel: saleData.hasAttachment,
              snippet: saleData.snippet,
              isManual: false,
            },
          },
          { upsert: true }
        );
        
        if (result.upsertedCount && result.upsertedCount > 0) {
          salesAdded++;
        } else {
          emailsSkipped++;
        }
      } catch (error: any) {
        logger.error('Error saving pending sale', error, { userId, emailId: saleData.messageId });
        errors.push({
          emailId: saleData.messageId,
          error: error.message || String(error),
          timestamp: new Date(),
        });
      }
    }
    
    // Process expenses
    const expenses = await processEmailsBatch(
      gmail,
      expenseIds,
      getExpenseDetails
    );
    gmailApiCalls += expenseIds.length;
    quotaUnitsUsed += expenseIds.length * SYNC_CONFIG.QUOTA_UNITS.MESSAGE_GET;
    
    for (const expenseData of expenses) {
      try {
        const result = await Expense.updateOne(
          { userId, gmailMessageId: expenseData.messageId },
          {
            $set: {
              userId,
              category: expenseData.category as any,
              amount: expenseData.amount,
              discount: expenseData.discount,
              totalAmount: expenseData.totalAmount,
              description: expenseData.description,
              itemCount: expenseData.itemCount,
              expenseDate: new Date(expenseData.date),
              gmailMessageId: expenseData.messageId,
              snippet: expenseData.snippet,
            },
          },
          { upsert: true }
        );
        
        if (result.upsertedCount && result.upsertedCount > 0) {
          expensesAdded++;
        } else {
          emailsSkipped++;
        }
      } catch (error: any) {
        logger.error('Error saving expense', error, { userId, emailId: expenseData.messageId });
        errors.push({
          emailId: expenseData.messageId,
          error: error.message || String(error),
          timestamp: new Date(),
        });
      }
    }
    
    // Get current historyId for next incremental sync
    const currentHistoryId = await getCurrentHistoryId(oauth2Client);
    gmailApiCalls++;
    quotaUnitsUsed += 5; // getProfile call
    
    // Save sync metadata
    await SyncMeta.updateOne(
      { userId },
      {
        userId,
        historyId: currentHistoryId,
        lastSyncAt: new Date(),
        totalEmailsProcessed: completedSaleIds.length + pendingSaleIds.length + expenseIds.length,
        totalSalesFound: salesAdded,
        totalExpensesFound: expensesAdded,
        consecutiveErrors: errors.length > 0 ? 1 : 0,
        lastError: errors.length > 0 ? errors[0].error : null,
        lastErrorAt: errors.length > 0 ? new Date() : null,
        currentParserVersion: SYNC_CONFIG.CURRENT_PARSER_VERSION,
      },
      { upsert: true }
    );
    
    const result: SyncResult = {
      success: errors.length === 0,
      userId,
      triggeredBy,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      newEmailsProcessed: completedSaleIds.length + pendingSaleIds.length + expenseIds.length,
      salesAdded,
      expensesAdded,
      emailsSkipped,
      gmailApiCalls,
      quotaUnitsUsed,
      historyIdBefore: null,
      historyIdAfter: currentHistoryId,
      status: errors.length === 0 ? 'success' : 'partial',
      errors,
    };
    
    logger.syncCompleted(userId, result.duration, {
      newEmails: result.newEmailsProcessed,
      salesAdded,
      expensesAdded,
      quotaUsed: quotaUnitsUsed,
    });
    
    return result;
    
  } catch (error: any) {
    logger.syncFailed(userId, error);
    throw error;
  }
}

/**
 * Process Vinted emails from Gmail messages
 */
async function processVintedEmails(
  gmail: any,
  messages: GmailMessage[],
  userId: string,
  errors: SyncError[]
): Promise<{ salesAdded: number; expensesAdded: number; emailsSkipped: number }> {
  let salesAdded = 0;
  let expensesAdded = 0;
  let emailsSkipped = 0;
  
  for (const message of messages) {
    const messageId = message.id!;
    const headers = message.payload?.headers || [];
    const fromHeader = headers.find((h: any) => h.name === 'From');
    const from = fromHeader?.value || '';
    
    // Only process Vinted emails
    if (!from.includes('vinted.es')) {
      emailsSkipped++;
      continue;
    }
    
    const subjectHeader = headers.find((h: any) => h.name === 'Subject');
    const subject = subjectHeader?.value || '';
    
    try {
      // Determine email type and process accordingly
      if (subject.includes('Transferencia a tu saldo Vinted')) {
        // Completed sale
        const saleData = await getCompletedSaleDetails(gmail, messageId);
        if (saleData) {
          const result = await Sale.updateOne(
            { userId, transactionId: saleData.transactionId },
            {
              $set: {
                userId,
                transactionId: saleData.transactionId,
                itemName: saleData.itemName,
                amount: saleData.amount,
                status: 'completed',
                saleDate: new Date(saleData.date),
                completedDate: new Date(saleData.date),
                gmailMessageId: saleData.messageId,
                snippet: saleData.snippet,
                hasLabel: false,
                isManual: false,
              },
            },
            { upsert: true }
          );
          
          if (result.upsertedCount && result.upsertedCount > 0) {
            salesAdded++;
          } else {
            emailsSkipped++;
          }
        }
      } else if (subject.includes('Etiqueta de envío para')) {
        // Pending sale with shipping label
        const saleData = await getPendingSaleDetails(gmail, messageId);
        if (saleData) {
          const result = await Sale.updateOne(
            { userId, transactionId: saleData.transactionId },
            {
              $set: {
                userId,
                transactionId: saleData.transactionId,
                itemName: saleData.itemName,
                status: 'pending',
                saleDate: new Date(saleData.date),
                shippingCarrier: saleData.shippingCarrier as any,
                trackingNumber: saleData.trackingNumber,
                shippingDeadline: new Date(saleData.shippingDeadline),
                gmailMessageId: saleData.messageId,
                labelMessageId: saleData.messageId,
                hasLabel: saleData.hasAttachment,
                snippet: saleData.snippet,
                isManual: false,
              },
            },
            { upsert: true }
          );
          
          if (result.upsertedCount && result.upsertedCount > 0) {
            salesAdded++;
          } else {
            emailsSkipped++;
          }
        }
      } else if (subject.includes('Tu factura') || subject.toLowerCase().includes('destacado') || subject.toLowerCase().includes('armario')) {
        // Expense
        const expenseData = await getExpenseDetails(gmail, messageId);
        if (expenseData) {
          const result = await Expense.updateOne(
            { userId, gmailMessageId: expenseData.messageId },
            {
              $set: {
                userId,
                category: expenseData.category as any,
                amount: expenseData.amount,
                discount: expenseData.discount,
                totalAmount: expenseData.totalAmount,
                description: expenseData.description,
                itemCount: expenseData.itemCount,
                expenseDate: new Date(expenseData.date),
                gmailMessageId: expenseData.messageId,
                snippet: expenseData.snippet,
              },
            },
            { upsert: true }
          );
          
          if (result.upsertedCount && result.upsertedCount > 0) {
            expensesAdded++;
          } else {
            emailsSkipped++;
          }
        }
      } else {
        emailsSkipped++;
      }
    } catch (error: any) {
      logger.error('Error processing Vinted email', error, { userId, messageId });
      errors.push({
        emailId: messageId,
        error: error.message || String(error),
        timestamp: new Date(),
      });
    }
  }
  
  return { salesAdded, expensesAdded, emailsSkipped };
}

