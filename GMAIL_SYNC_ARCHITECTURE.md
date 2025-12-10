# Gmail Sync Architecture - Production-Ready Design

## Executive Summary

**Solution**: Hybrid incremental sync with Vercel Cron + Gmail History API + Queue-based processing

**Key Features**:
- ✅ Incremental sync using Gmail History API (only new/changed emails)
- ✅ Automatic hourly sync via Vercel Cron (production) + manual sync (local)
- ✅ Zero-quota waste with history-based tracking
- ✅ Offline-safe for localhost development
- ✅ Queue-based processing for multi-user scenarios
- ✅ Sub-50ms dashboard queries via optimized MongoDB indexes
- ✅ Real-time UI updates with Next.js revalidation
- ✅ Idempotent operations with deduplication
- ✅ Version-controlled parser logic for data migration

---

## 1. Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         TRIGGER LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Production (Vercel):                Local Development:          │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │  Vercel Cron     │              │  Manual Button   │        │
│  │  (hourly)        │              │  /api/sync       │        │
│  └────────┬─────────┘              └────────┬─────────┘        │
│           │                                  │                   │
└───────────┼──────────────────────────────────┼──────────────────┘
            │                                  │
            └──────────────┬───────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │         Sync Orchestrator Service                 │          │
│  │  - Check user sync locks (prevent duplicates)     │          │
│  │  - Queue management (FIFO per user)              │          │
│  │  - Error handling & retry logic                  │          │
│  └────────────────────┬─────────────────────────────┘          │
│                       │                                          │
└───────────────────────┼──────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SYNC EXECUTION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │         Gmail Incremental Sync Service            │          │
│  │  1. Fetch historyId from SyncMeta collection     │          │
│  │  2. Call Gmail History API (only changes)        │          │
│  │  3. Filter messagesAdded/messagesDeleted         │          │
│  │  4. Batch fetch full messages (if needed)        │          │
│  │  5. Pass to Parser Service                       │          │
│  └────────────────────┬─────────────────────────────┘          │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────┐          │
│  │         Email Parser Service (Versioned)          │          │
│  │  - Detect sales emails (invoices, receipts)      │          │
│  │  - Detect expense emails (bills, statements)     │          │
│  │  - Extract amount, date, vendor, category        │          │
│  │  - Tag with parser version (v1, v2, etc.)       │          │
│  └────────────────────┬─────────────────────────────┘          │
│                       │                                          │
└───────────────────────┼──────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  MongoDB Collections:                                            │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ Sales          │  │ Expenses       │  │ SyncMeta         │ │
│  │ - emailId      │  │ - emailId      │  │ - userId         │ │
│  │ - amount       │  │ - amount       │  │ - historyId      │ │
│  │ - date         │  │ - date         │  │ - lastSyncAt     │ │
│  │ - vendor       │  │ - vendor       │  │ - emailCount     │ │
│  │ - parserVer    │  │ - parserVer    │  │ - status         │ │
│  └────────────────┘  └────────────────┘  └──────────────────┘ │
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐                        │
│  │ SyncLogs       │  │ SyncQueue      │                        │
│  │ - userId       │  │ - userId       │                        │
│  │ - duration     │  │ - status       │                        │
│  │ - newEmails    │  │ - priority     │                        │
│  │ - errors       │  │ - attempts     │                        │
│  └────────────────┘  └────────────────┘                        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      UI REFRESH LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Strategy: Next.js revalidatePath + optimistic loading          │
│                                                                   │
│  ┌──────────────────────────────────────────────────┐          │
│  │  After sync completes:                            │          │
│  │  1. revalidatePath('/dashboard')                 │          │
│  │  2. revalidateTag('sales')                       │          │
│  │  3. revalidateTag('expenses')                    │          │
│  │  4. Return sync summary to client                │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                   │
│  Client components use React Query / SWR for stale-while-       │
│  revalidate pattern                                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Design Decisions

### Decision 1: Vercel Cron vs WebSockets vs Firebase
**Choice**: Vercel Cron (vercel.json config)

**Rationale**:
- ✅ Built-in, zero-config cron scheduling
- ✅ Serverless-friendly (no persistent connections)
- ✅ Free tier: 100 cron executions/day (sufficient for hourly sync)
- ✅ No external dependencies (Firebase, Bull Queue, etc.)
- ❌ WebSockets: Requires persistent server (not serverless)
- ❌ Polling: Wastes Gmail quota (1 billion quota units/day limit)

### Decision 2: Gmail History API vs Full Sync
**Choice**: Gmail History API for incremental changes

**Rationale**:
- ✅ Only fetches emails that changed since last `historyId`
- ✅ Dramatically reduces API quota usage (10-100x improvement)
- ✅ Handles label changes, deletions, and new messages
- ✅ Returns lightweight history records first, then fetch full messages
- ⚠️  Requires storing `historyId` per user
- ⚠️  History expires after ~1 week (fallback to full sync if expired)

**API Quota Impact**:
- Full sync (1000 emails): ~5,000 quota units
- History sync (10 new emails): ~100 quota units
- Daily limit: 1,000,000,000 quota units (Gmail default)
- **With history API**: ~10,000 users can sync hourly (24 syncs/day)

### Decision 3: Parse Server-Side vs Client-Side
**Choice**: 100% Server-Side Parsing

**Rationale**:
- ✅ Dashboard loads from Mongo (no Gmail API calls from UI)
- ✅ Consistent parsing logic across all users
- ✅ Version-controlled parsers for data migration
- ✅ Better security (OAuth tokens stay server-side)
- ✅ Faster UI rendering (pre-parsed data)

### Decision 4: UI Refresh Strategy
**Choice**: Next.js `revalidatePath` + `revalidateTag`

**Rationale**:
- ✅ No WebSockets needed (serverless-friendly)
- ✅ Works with Server Components (async data fetching)
- ✅ Automatic ISR (Incremental Static Regeneration)
- ✅ Client components can use React Query for stale-while-revalidate
- ❌ Not real-time (1-2s delay), but acceptable for financial data

### Decision 5: Local Dev Handling
**Choice**: Environment-based conditional sync

**Rationale**:
```typescript
// Cron only runs if VERCEL_ENV === 'production'
// Local dev uses manual /api/sync endpoint
if (process.env.VERCEL_ENV === 'production') {
  // Automatic cron sync
} else {
  // Manual button sync only
}
```

---

## 3. MongoDB Schema Design

### 3.1 Sales Collection
```typescript
interface Sale {
  _id: ObjectId;
  userId: string;                    // Indexed
  emailId: string;                   // Gmail message ID (unique per user)
  threadId: string;
  
  // Financial data
  amount: number;
  currency: string;
  date: Date;                        // Indexed for date range queries
  
  // Metadata
  vendor: string;
  category: string;
  description: string;
  
  // Email details
  subject: string;
  from: string;
  labels: string[];                  // Gmail labels
  
  // Sync metadata
  parserVersion: string;             // "v1", "v2" for migration tracking
  confidence: number;                // 0-1 score for ML accuracy
  needsReview: boolean;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt: Date;
}

// Indexes
db.sales.createIndex({ userId: 1, emailId: 1 }, { unique: true }); // Idempotency
db.sales.createIndex({ userId: 1, date: -1 });                      // Dashboard queries
db.sales.createIndex({ userId: 1, parserVersion: 1 });              // Migration queries
db.sales.createIndex({ needsReview: 1, userId: 1 });                // Review queue
```

### 3.2 Expenses Collection
```typescript
interface Expense {
  _id: ObjectId;
  userId: string;
  emailId: string;
  threadId: string;
  
  // Financial data
  amount: number;
  currency: string;
  date: Date;
  
  // Metadata
  vendor: string;
  category: string;
  description: string;
  expenseType: 'bill' | 'subscription' | 'purchase' | 'other';
  
  // Email details
  subject: string;
  from: string;
  labels: string[];
  
  // Sync metadata
  parserVersion: string;
  confidence: number;
  needsReview: boolean;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt: Date;
}

// Same indexes as Sales
db.expenses.createIndex({ userId: 1, emailId: 1 }, { unique: true });
db.expenses.createIndex({ userId: 1, date: -1 });
db.expenses.createIndex({ userId: 1, parserVersion: 1 });
```

### 3.3 SyncMeta Collection (Critical for Incremental Sync)
```typescript
interface SyncMeta {
  _id: ObjectId;
  userId: string;                    // Indexed, unique
  
  // Gmail state
  historyId: string;                 // Latest Gmail historyId
  lastSyncAt: Date;
  nextScheduledSync: Date;
  
  // Stats
  totalEmailsProcessed: number;
  totalSalesFound: number;
  totalExpensesFound: number;
  
  // Sync control
  syncInProgress: boolean;           // Lock to prevent duplicate syncs
  syncStartedAt: Date | null;
  syncLockedBy: string | null;       // Cron job ID or manual trigger
  
  // Error tracking
  consecutiveErrors: number;
  lastError: string | null;
  lastErrorAt: Date | null;
  
  // Version tracking
  currentParserVersion: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Indexes
db.syncMeta.createIndex({ userId: 1 }, { unique: true });
db.syncMeta.createIndex({ nextScheduledSync: 1 }); // Cron query
db.syncMeta.createIndex({ syncInProgress: 1, syncStartedAt: 1 }); // Detect stuck syncs
```

### 3.4 SyncLogs Collection (Audit Trail)
```typescript
interface SyncLog {
  _id: ObjectId;
  userId: string;
  
  // Sync details
  triggeredBy: 'cron' | 'manual' | 'webhook';
  startedAt: Date;
  completedAt: Date;
  duration: number;                  // milliseconds
  
  // Results
  status: 'success' | 'partial' | 'failed';
  newEmailsProcessed: number;
  salesAdded: number;
  expensesAdded: number;
  emailsSkipped: number;             // Already processed
  
  // API usage
  gmailApiCalls: number;
  quotaUnitsUsed: number;
  
  // Error details
  errors: Array<{
    emailId: string;
    error: string;
    timestamp: Date;
  }>;
  
  // History tracking
  historyIdBefore: string;
  historyIdAfter: string;
  
  createdAt: Date;
}

// Indexes
db.syncLogs.createIndex({ userId: 1, createdAt: -1 });
db.syncLogs.createIndex({ status: 1, userId: 1 });
db.syncLogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // TTL: 90 days
```

### 3.5 SyncQueue Collection (Multi-User Coordination)
```typescript
interface SyncQueueItem {
  _id: ObjectId;
  userId: string;
  
  // Queue control
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;                  // Higher = more urgent
  attempts: number;
  maxAttempts: number;
  
  // Timing
  enqueuedAt: Date;
  scheduledFor: Date;                // Allow delayed execution
  startedAt: Date | null;
  completedAt: Date | null;
  
  // Context
  triggeredBy: 'cron' | 'manual' | 'webhook';
  metadata: Record<string, any>;
  
  // Error tracking
  lastError: string | null;
  lastAttemptAt: Date | null;
  
  createdAt: Date;
  updatedAt: Date;
}

// Indexes
db.syncQueue.createIndex({ status: 1, scheduledFor: 1, priority: -1 }); // Queue processing
db.syncQueue.createIndex({ userId: 1, status: 1 });
db.syncQueue.createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 }); // TTL: 7 days
```

---

## 4. Incremental Sync Logic (Gmail History API)

### How Gmail History API Works

1. **Initial Full Sync**: First time user syncs, fetch all emails and store `historyId`
2. **Subsequent Syncs**: Pass stored `historyId` to `gmail.users.history.list()`
3. **History Response**: Returns only changes since that `historyId`
4. **Update historyId**: Store new `historyId` for next sync

### Incremental Sync Pseudo-Code

```typescript
async function incrementalSync(userId: string, oauth2Client: OAuth2Client) {
  // 1. Get sync metadata
  const syncMeta = await SyncMeta.findOne({ userId });
  
  if (!syncMeta || !syncMeta.historyId) {
    // First sync - do full sync
    return await fullSync(userId, oauth2Client);
  }
  
  // 2. Check if history is still valid (Gmail keeps ~7 days)
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: syncMeta.historyId,
      historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
      maxResults: 500, // Process in batches
    });
    
    // 3. No changes found
    if (!historyResponse.data.history || historyResponse.data.history.length === 0) {
      await SyncMeta.updateOne(
        { userId },
        { 
          lastSyncAt: new Date(),
          historyId: historyResponse.data.historyId || syncMeta.historyId,
        }
      );
      return { newEmails: 0, salesAdded: 0, expensesAdded: 0 };
    }
    
    // 4. Extract email IDs that changed
    const changedEmailIds = new Set<string>();
    const deletedEmailIds = new Set<string>();
    
    for (const historyItem of historyResponse.data.history) {
      // New or updated emails
      if (historyItem.messagesAdded) {
        historyItem.messagesAdded.forEach(msg => {
          if (msg.message?.id) changedEmailIds.add(msg.message.id);
        });
      }
      
      // Deleted emails
      if (historyItem.messagesDeleted) {
        historyItem.messagesDeleted.forEach(msg => {
          if (msg.message?.id) deletedEmailIds.add(msg.message.id);
        });
      }
      
      // Label changes (e.g., moved from spam to inbox)
      if (historyItem.labelsAdded || historyItem.labelsRemoved) {
        const msgId = historyItem.labelsAdded?.[0]?.message?.id || 
                      historyItem.labelsRemoved?.[0]?.message?.id;
        if (msgId) changedEmailIds.add(msgId);
      }
    }
    
    // 5. Remove deleted emails from changed set
    for (const deletedId of deletedEmailIds) {
      changedEmailIds.delete(deletedId);
    }
    
    // 6. Fetch full message details (batch request)
    const messages = await Promise.all(
      Array.from(changedEmailIds).map(async (emailId) => {
        try {
          const message = await gmail.users.messages.get({
            userId: 'me',
            id: emailId,
            format: 'full',
          });
          return message.data;
        } catch (err) {
          console.error(`Error fetching email ${emailId}:`, err);
          return null;
        }
      })
    );
    
    const validMessages = messages.filter(m => m !== null);
    
    // 7. Parse and categorize emails
    const { sales, expenses } = await parseEmails(validMessages, userId);
    
    // 8. Upsert to database (idempotent)
    let salesAdded = 0;
    let expensesAdded = 0;
    
    for (const sale of sales) {
      const result = await Sale.updateOne(
        { userId, emailId: sale.emailId },
        { $set: sale },
        { upsert: true }
      );
      if (result.upsertedCount > 0) salesAdded++;
    }
    
    for (const expense of expenses) {
      const result = await Expense.updateOne(
        { userId, emailId: expense.emailId },
        { $set: expense },
        { upsert: true }
      );
      if (result.upsertedCount > 0) expensesAdded++;
    }
    
    // 9. Handle deletions (soft delete or hard delete)
    await Sale.updateMany(
      { userId, emailId: { $in: Array.from(deletedEmailIds) } },
      { $set: { deleted: true, deletedAt: new Date() } }
    );
    
    await Expense.updateMany(
      { userId, emailId: { $in: Array.from(deletedEmailIds) } },
      { $set: { deleted: true, deletedAt: new Date() } }
    );
    
    // 10. Update sync metadata
    await SyncMeta.updateOne(
      { userId },
      {
        historyId: historyResponse.data.historyId,
        lastSyncAt: new Date(),
        totalEmailsProcessed: syncMeta.totalEmailsProcessed + validMessages.length,
        totalSalesFound: syncMeta.totalSalesFound + salesAdded,
        totalExpensesFound: syncMeta.totalExpensesFound + expensesAdded,
      }
    );
    
    // 11. Log the sync
    await SyncLog.create({
      userId,
      triggeredBy: 'cron',
      startedAt: new Date(),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      status: 'success',
      newEmailsProcessed: validMessages.length,
      salesAdded,
      expensesAdded,
      historyIdBefore: syncMeta.historyId,
      historyIdAfter: historyResponse.data.historyId,
    });
    
    return { newEmails: validMessages.length, salesAdded, expensesAdded };
    
  } catch (error) {
    // History expired or invalid - fall back to full sync
    if (error.code === 404 || error.message?.includes('invalid historyId')) {
      console.log('History expired, performing full sync');
      return await fullSync(userId, oauth2Client);
    }
    
    throw error;
  }
}
```

---

## 5. Queue Management & Concurrency Control

### Problem: Multiple Users Syncing Simultaneously

**Scenario**: Cron triggers at 2:00 PM, needs to sync 100 users
- Without queue: All 100 users hit Gmail API simultaneously → rate limit exceeded
- With queue: Process users sequentially or in batches

### Solution: In-Memory Queue with MongoDB Lock

```typescript
// libs/sync-queue.ts
class SyncQueueManager {
  private activeJobs = new Map<string, Promise<void>>();
  private maxConcurrent = 5; // Process 5 users concurrently
  
  async enqueueSyncJob(userId: string, triggeredBy: 'cron' | 'manual') {
    // Check if user already has active sync
    if (this.activeJobs.has(userId)) {
      throw new Error('Sync already in progress for this user');
    }
    
    // Check MongoDB lock
    const syncMeta = await SyncMeta.findOne({ userId });
    
    if (syncMeta?.syncInProgress) {
      // Check if lock is stale (> 10 minutes old)
      const lockAge = Date.now() - syncMeta.syncStartedAt.getTime();
      if (lockAge < 10 * 60 * 1000) {
        throw new Error('Sync already in progress');
      }
      
      // Clear stale lock
      await SyncMeta.updateOne(
        { userId },
        { syncInProgress: false, syncStartedAt: null, syncLockedBy: null }
      );
    }
    
    // Acquire lock
    await SyncMeta.updateOne(
      { userId },
      {
        syncInProgress: true,
        syncStartedAt: new Date(),
        syncLockedBy: `${triggeredBy}-${Date.now()}`,
      },
      { upsert: true }
    );
    
    // Add to queue
    const syncPromise = this.executeSyncJob(userId, triggeredBy)
      .finally(() => {
        this.activeJobs.delete(userId);
      });
    
    this.activeJobs.set(userId, syncPromise);
    
    // Wait if at max concurrency
    while (this.activeJobs.size >= this.maxConcurrent) {
      await Promise.race(Array.from(this.activeJobs.values()));
    }
    
    return syncPromise;
  }
  
  private async executeSyncJob(userId: string, triggeredBy: string) {
    try {
      // Get user OAuth tokens
      const user = await User.findById(userId);
      const oauth2Client = createOAuthClient(user);
      
      // Run incremental sync
      const result = await incrementalSync(userId, oauth2Client);
      
      // Release lock
      await SyncMeta.updateOne(
        { userId },
        {
          syncInProgress: false,
          syncStartedAt: null,
          syncLockedBy: null,
          consecutiveErrors: 0,
        }
      );
      
      return result;
      
    } catch (error) {
      // Log error and release lock
      await SyncMeta.updateOne(
        { userId },
        {
          syncInProgress: false,
          syncStartedAt: null,
          syncLockedBy: null,
          lastError: error.message,
          lastErrorAt: new Date(),
          $inc: { consecutiveErrors: 1 },
        }
      );
      
      throw error;
    }
  }
}

export const syncQueue = new SyncQueueManager();
```

---

## 6. Vercel Cron Configuration

### vercel.json

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-gmail",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Schedule Format**: Standard cron syntax
- `0 * * * *` = Every hour at minute 0
- `0 */2 * * *` = Every 2 hours
- `*/30 * * * *` = Every 30 minutes

**Important**:
- Cron jobs only run on production (`VERCEL_ENV=production`)
- Free plan: 100 cron invocations/day (sufficient for hourly)
- Max execution time: 10 seconds (Hobby), 60s (Pro), 300s (Enterprise)
- Use queue pattern to process users in batches within time limit

---

## 7. UI Refresh Strategy

### Option A: Polling (Not Recommended)
```typescript
// ❌ Wastes resources, poor UX
setInterval(() => fetchDashboardData(), 5000);
```

### Option B: Server-Sent Events (Complex for Serverless)
```typescript
// ❌ Requires persistent connection (not Vercel-friendly)
```

### Option C: Next.js Revalidation (Recommended ✅)

```typescript
// app/api/sync/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  
  // Trigger sync
  await syncQueue.enqueueSyncJob(session.user.id, 'manual');
  
  // Revalidate cached data
  revalidatePath('/dashboard');
  revalidateTag('sales');
  revalidateTag('expenses');
  
  return NextResponse.json({ success: true });
}

// app/dashboard/page.tsx (Server Component)
export default async function DashboardPage() {
  // This data is automatically revalidated after sync
  const sales = await getSales(); // Fetch from Mongo
  const expenses = await getExpenses();
  
  return <DashboardUI sales={sales} expenses={expenses} />;
}
```

### Option D: React Query with Optimistic Updates (Client Enhancement)

```typescript
// components/sync-button.tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

export function SyncButton() {
  const queryClient = useQueryClient();
  
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sync', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
  
  return (
    <button onClick={() => syncMutation.mutate()}>
      {syncMutation.isPending ? 'Syncing...' : 'Sync Gmail'}
    </button>
  );
}
```

---

## 8. Performance Optimization

### 8.1 MongoDB Query Performance

```typescript
// ❌ Slow: No index, full collection scan
const sales = await Sale.find({ userId }).sort({ date: -1 });

// ✅ Fast: Uses compound index
const sales = await Sale.find({ userId })
  .sort({ date: -1 })
  .limit(100)
  .lean(); // Return plain JS objects (faster)

// ✅ Even faster: Projection (only fetch needed fields)
const sales = await Sale.find({ userId })
  .select('amount date vendor category')
  .sort({ date: -1 })
  .limit(100)
  .lean();
```

### 8.2 Batch Inserts

```typescript
// ❌ Slow: N insert operations
for (const sale of sales) {
  await Sale.create(sale);
}

// ✅ Fast: Single batch insert
await Sale.insertMany(sales, { ordered: false }); // Continue on duplicate key errors
```

### 8.3 Aggregation for Dashboard Stats

```typescript
// app/api/dashboard/stats/route.ts
export async function GET(req: Request) {
  const session = await getServerSession();
  
  const stats = await Sale.aggregate([
    { $match: { userId: session.user.id } },
    { $group: {
      _id: null,
      totalSales: { $sum: '$amount' },
      avgSale: { $avg: '$amount' },
      count: { $sum: 1 },
    }},
  ]);
  
  return NextResponse.json(stats[0]);
}
```

### 8.4 Caching Strategy

```typescript
// Use Next.js built-in cache with revalidation
export async function getSales(userId: string) {
  const sales = await Sale.find({ userId })
    .sort({ date: -1 })
    .limit(100)
    .lean();
  
  return sales;
}

// In Server Component
export const revalidate = 3600; // Cache for 1 hour

// Or use fetch() with cache options
const sales = await fetch(`${API_URL}/sales?userId=${userId}`, {
  next: { revalidate: 3600, tags: ['sales'] }
});
```

---

## 9. Local vs Production Behavior

### Environment Detection

```typescript
// libs/env-utils.ts
export function isProduction() {
  return process.env.VERCEL_ENV === 'production';
}

export function isLocalDev() {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL;
}

// app/api/cron/sync-gmail/route.ts
export async function GET(req: Request) {
  // Cron endpoint only works in production
  if (!isProduction()) {
    return new Response('Cron jobs only run in production', { status: 403 });
  }
  
  // Verify Vercel cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Process sync queue
  await processAllUserSyncs();
  
  return NextResponse.json({ success: true });
}
```

### Local Development Workflow

```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const session = await getServerSession();
  const syncMeta = await getSyncMeta(session.user.id);
  
  return (
    <div>
      {/* Show manual sync button in dev, auto-sync indicator in prod */}
      {isLocalDev() ? (
        <ManualSyncButton />
      ) : (
        <div>Last synced: {syncMeta.lastSyncAt}</div>
      )}
      
      <DashboardContent />
    </div>
  );
}
```

---

## 10. Parser Versioning & Data Migration

### Problem: Parser logic improves over time, need to re-parse old emails

### Solution: Version-tagged parsing with migration scripts

```typescript
// libs/parsers/v1-parser.ts
export async function parseEmailV1(message: gmail_v1.Schema$Message) {
  // Original parser logic
  const amount = extractAmountSimple(message.snippet);
  return { amount, parserVersion: 'v1' };
}

// libs/parsers/v2-parser.ts
export async function parseEmailV2(message: gmail_v1.Schema$Message) {
  // Improved parser with ML, better regex, etc.
  const amount = extractAmountAdvanced(message.payload);
  const vendor = extractVendor(message.payload);
  return { amount, vendor, parserVersion: 'v2' };
}

// libs/parsers/index.ts
export async function parseEmail(message: gmail_v1.Schema$Message) {
  // Always use latest parser for new emails
  return parseEmailV2(message);
}

// scripts/migrate-parser-v1-to-v2.ts
async function migrateOldEmails(userId: string) {
  const oldSales = await Sale.find({ userId, parserVersion: 'v1' }).limit(100);
  
  for (const sale of oldSales) {
    // Re-fetch email from Gmail
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: sale.emailId,
    });
    
    // Re-parse with new parser
    const updated = await parseEmailV2(message.data);
    
    // Update database
    await Sale.updateOne(
      { _id: sale._id },
      { $set: { ...updated, parserVersion: 'v2' } }
    );
  }
}
```

---

## 11. Rate Limits & Error Handling

### Gmail API Quotas (Per Project, Per Day)

| Resource | Limit |
|----------|-------|
| Total quota units | 1,000,000,000 |
| Per-user quota | 250 quota units/sec |
| Queries per day | 1,000,000,000 |
| Queries per 100 seconds | 25,000 |

**Cost per operation**:
- `users.messages.list`: 5 units
- `users.messages.get`: 5 units
- `users.history.list`: 2 units (much cheaper!)
- `users.messages.send`: 100 units

**Example calculation** (hourly sync, 1000 users):
- History API: 2 units × 1000 users = 2,000 units/hour
- Fetch new emails: 5 units × 10 emails/user × 1000 = 50,000 units/hour
- **Total**: 52,000 units/hour × 24 hours = 1,248,000 units/day
- **Result**: Fits within quota! ✅

### Error Handling Strategy

```typescript
async function syncWithRetry(userId: string, maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await incrementalSync(userId, oauth2Client);
      
    } catch (error) {
      attempt++;
      
      // Rate limit error - exponential backoff
      if (error.code === 429) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
        await sleep(backoffMs);
        continue;
      }
      
      // Invalid grant - user revoked OAuth access
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        await User.updateOne(
          { _id: userId },
          { gmailAccessRevoked: true, gmailRevokedAt: new Date() }
        );
        throw new Error('User needs to re-authorize Gmail access');
      }
      
      // History expired - fall back to full sync
      if (error.code === 404) {
        return await fullSync(userId, oauth2Client);
      }
      
      // Other errors - log and retry
      console.error(`Sync attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) throw error;
    }
  }
}
```

---

## 12. Security Considerations

### 12.1 Cron Endpoint Protection

```typescript
// app/api/cron/sync-gmail/route.ts
export async function GET(req: Request) {
  // Verify request is from Vercel cron
  const authHeader = req.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Additional: Check User-Agent (Vercel cron has specific UA)
  const userAgent = req.headers.get('user-agent');
  if (!userAgent?.includes('vercel-cron')) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Process sync...
}
```

### 12.2 OAuth Token Security

```typescript
// ❌ Never expose OAuth tokens to client
// ❌ Never log OAuth tokens

// ✅ Store encrypted in MongoDB
import crypto from 'crypto';

function encryptToken(token: string): string {
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(process.env.ENCRYPTION_IV, 'hex')
  );
  
  return cipher.update(token, 'utf8', 'hex') + cipher.final('hex');
}

function decryptToken(encrypted: string): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(process.env.ENCRYPTION_IV, 'hex')
  );
  
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
```

---

## 13. Monitoring & Observability

### Key Metrics to Track

```typescript
// libs/monitoring.ts
export async function trackSyncMetrics(userId: string, result: SyncResult) {
  // Send to analytics (Vercel Analytics, Mixpanel, etc.)
  await analytics.track({
    userId,
    event: 'gmail_sync_completed',
    properties: {
      duration: result.duration,
      newEmails: result.newEmailsProcessed,
      salesAdded: result.salesAdded,
      expensesAdded: result.expensesAdded,
      triggeredBy: result.triggeredBy,
    },
  });
  
  // Alert if sync took too long
  if (result.duration > 30000) {
    await sendAlert({
      type: 'slow_sync',
      userId,
      duration: result.duration,
    });
  }
  
  // Alert if consecutive errors
  const syncMeta = await SyncMeta.findOne({ userId });
  if (syncMeta.consecutiveErrors >= 3) {
    await sendAlert({
      type: 'repeated_sync_failures',
      userId,
      errorCount: syncMeta.consecutiveErrors,
      lastError: syncMeta.lastError,
    });
  }
}
```

### Dashboard for Admin Monitoring

```typescript
// app/admin/sync-status/page.tsx
export default async function SyncStatusPage() {
  const stats = await SyncMeta.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        usersWithErrors: {
          $sum: { $cond: [{ $gt: ['$consecutiveErrors', 0] }, 1, 0] }
        },
        avgEmailsProcessed: { $avg: '$totalEmailsProcessed' },
        lastSyncAvg: { $avg: '$lastSyncAt' },
      },
    },
  ]);
  
  return <AdminDashboard stats={stats[0]} />;
}
```

---

## 14. Testing Strategy

### Unit Tests
```typescript
// __tests__/sync-service.test.ts
import { incrementalSync } from '@/libs/sync-service';

describe('Incremental Sync', () => {
  it('should handle expired history gracefully', async () => {
    // Mock Gmail API to return 404
    mockGmailAPI.history.list.mockRejectedValue({ code: 404 });
    
    // Should fall back to full sync
    const result = await incrementalSync('user123', mockOAuth);
    expect(result.fullSyncPerformed).toBe(true);
  });
  
  it('should deduplicate emails', async () => {
    // Insert same email twice
    await incrementalSync('user123', mockOAuth);
    await incrementalSync('user123', mockOAuth);
    
    // Should only have 1 record
    const sales = await Sale.find({ userId: 'user123' });
    expect(sales.length).toBe(1);
  });
});
```

### Integration Tests
```typescript
// __tests__/api/sync.test.ts
import { POST } from '@/app/api/sync/route';

describe('POST /api/sync', () => {
  it('should require authentication', async () => {
    const req = new Request('http://localhost/api/sync', { method: 'POST' });
    const res = await POST(req);
    
    expect(res.status).toBe(401);
  });
  
  it('should trigger sync and revalidate', async () => {
    const req = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { cookie: 'session=valid_token' },
    });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

---

## 15. Pitfalls to Avoid

### ❌ Pitfall 1: Not Using History API
**Problem**: Fetching all emails every sync wastes quota and is slow
**Solution**: Always use `gmail.users.history.list()` after initial sync

### ❌ Pitfall 2: No Deduplication
**Problem**: Same email inserted multiple times if sync runs twice
**Solution**: Use unique compound index on `{ userId, emailId }`

### ❌ Pitfall 3: Blocking Cron Execution
**Problem**: Cron times out (10s limit on Hobby plan) if syncing too many users
**Solution**: Use queue pattern, process in batches, return immediately

### ❌ Pitfall 4: Not Handling OAuth Expiry
**Problem**: Sync fails silently when user revokes access
**Solution**: Catch `invalid_grant` errors, mark user for re-auth

### ❌ Pitfall 5: No Stale Lock Cleanup
**Problem**: If server crashes mid-sync, lock stays forever
**Solution**: Check lock age, clear locks > 10 minutes old

### ❌ Pitfall 6: Parsing Client-Side
**Problem**: Exposes Gmail API tokens, inconsistent results
**Solution**: Always parse server-side, cache in MongoDB

### ❌ Pitfall 7: No Error Logging
**Problem**: Silent failures, no way to debug
**Solution**: Use `SyncLogs` collection with detailed error tracking

### ❌ Pitfall 8: Full Collection Scans
**Problem**: Dashboard queries are slow
**Solution**: Create proper indexes on `userId`, `date`, `emailId`

### ❌ Pitfall 9: Hardcoded Parser Logic
**Problem**: Can't improve parsing without losing old data
**Solution**: Version-tag all parsed data, build migration scripts

### ❌ Pitfall 10: No Rate Limit Handling
**Problem**: App breaks when hitting Gmail quota
**Solution**: Exponential backoff, queue-based throttling

---

## 16. Deployment Checklist

### Before Production Launch

- [ ] Set `CRON_SECRET` in Vercel environment variables
- [ ] Configure MongoDB indexes (run index creation script)
- [ ] Test cron endpoint with Postman (manual trigger)
- [ ] Set up error alerting (email, Slack, etc.)
- [ ] Create admin dashboard for monitoring sync status
- [ ] Document OAuth re-authorization flow for users
- [ ] Set up quota monitoring in Google Cloud Console
- [ ] Test with multiple users simultaneously
- [ ] Verify revalidation works (cache clears after sync)
- [ ] Load test dashboard queries with 10k+ records
- [ ] Set up daily backup for MongoDB
- [ ] Create rollback plan for parser version updates
- [ ] Document incident response for quota exhaustion
- [ ] Test sync recovery after prolonged downtime (> 7 days)

---

## 17. Future Enhancements

### Phase 2 Improvements
1. **Real-time sync** via Gmail Push Notifications (Pub/Sub webhooks)
2. **ML-powered categorization** for smarter expense/sale detection
3. **Multi-inbox support** (link multiple Gmail accounts)
4. **Smart retry** with adaptive backoff based on error types
5. **Sync priority queue** (VIP users sync first)
6. **Webhook API** for third-party integrations
7. **Audit log UI** for users to see sync history
8. **Manual re-parse** button for individual emails
9. **Bulk email re-categorization** if parser improves
10. **Export to CSV/PDF** for accounting software

---

## Conclusion

This architecture provides:
- ✅ **Scalable**: Handles 10,000+ users with hourly sync
- ✅ **Efficient**: Uses 100x less quota than full sync
- ✅ **Reliable**: Queue-based, idempotent, retry logic
- ✅ **Fast**: Sub-50ms dashboard queries with proper indexing
- ✅ **Maintainable**: Version-controlled parsers, detailed logging
- ✅ **Serverless-friendly**: No persistent connections or servers
- ✅ **Dev-friendly**: Local manual sync, production auto-sync

**Next Steps**:
1. Implement folder structure (next section)
2. Code the core services
3. Set up Vercel cron
4. Test with real Gmail data
5. Monitor and optimize

---

**Total Development Time Estimate**: 20-30 hours
- Core sync service: 8 hours
- Queue + concurrency: 4 hours
- API endpoints: 3 hours
- UI components: 3 hours
- Testing: 4 hours
- Documentation: 2 hours
- Monitoring/logging: 3 hours

