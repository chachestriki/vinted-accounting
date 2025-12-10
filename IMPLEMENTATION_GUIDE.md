# Gmail Sync Implementation Guide

## Quick Start

### 1. Environment Setup

Copy the environment variables template and fill in your values:

```bash
# Add to .env.local
CRON_SECRET=$(openssl rand -base64 32)
```

**Required Environment Variables:**
- `MONGODB_URI` - Your MongoDB connection string
- `GOOGLE_ID` - Google OAuth Client ID
- `GOOGLE_SECRET` - Google OAuth Client Secret
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 in dev)
- `NEXTAUTH_SECRET` - NextAuth secret
- `CRON_SECRET` - Secret for Vercel cron authentication

### 2. Update User Model

Add Gmail OAuth token fields to your User model:

```typescript
// models/User.ts
const userSchema = new mongoose.Schema({
  // ... existing fields ...
  
  // Gmail OAuth tokens
  gmailAccessToken: {
    type: String,
    default: null,
  },
  gmailRefreshToken: {
    type: String,
    default: null,
  },
  gmailTokenExpiry: {
    type: Number,
    default: null,
  },
  gmailConnectedAt: {
    type: Date,
    default: null,
  },
});
```

### 3. Install Dependencies

```bash
npm install
```

All dependencies should already be in your `package.json` (googleapis, mongoose, etc.)

### 4. Create MongoDB Indexes

```bash
npx tsx scripts/create-indexes.ts
```

This creates all necessary indexes for optimal performance.

### 5. Test Locally

```bash
# Start dev server
npm run dev

# In another terminal, test sync for a user
npx tsx scripts/test-sync.ts --userId=<your_user_id>
```

### 6. Update Dashboard to Use Sync Components

```typescript
// app/dashboard/page.tsx
import SyncButton from '@/components/sync/SyncButton';
import SyncStatus from '@/components/sync/SyncStatus';

export default function DashboardPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Dashboard</h1>
        <div className="flex gap-4 items-center">
          <SyncStatus />
          <SyncButton />
        </div>
      </div>
      
      {/* Rest of dashboard */}
    </div>
  );
}
```

### 7. Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Verify cron is registered
vercel cron ls

# Manually trigger cron to test
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://yourdomain.com/api/cron/sync-gmail
```

---

## Architecture Overview

### How Incremental Sync Works

1. **First Sync (Full Sync)**:
   - Fetches all Vinted emails from Gmail
   - Parses and stores in MongoDB
   - Saves current `historyId` in SyncMeta collection

2. **Subsequent Syncs (Incremental)**:
   - Calls Gmail History API with last `historyId`
   - Only fetches emails that changed since last sync
   - Updates `historyId` for next sync

3. **Benefits**:
   - 10-100x faster than full sync
   - Uses 10-100x less Gmail API quota
   - Scales to 1000s of users with hourly sync

### Sync Flow

```
User clicks "Sync" button
  ↓
POST /api/sync
  ↓
orchestrateSync(userId, 'manual')
  ↓
Acquire lock (prevent duplicate syncs)
  ↓
Get user OAuth tokens
  ↓
incrementalSync() → Gmail History API
  ↓
Parse new/changed emails
  ↓
Upsert to MongoDB (Sales/Expenses)
  ↓
Log to SyncLog collection
  ↓
Release lock
  ↓
Revalidate Next.js cache
  ↓
Return results to UI
```

### Cron Flow (Production)

```
Vercel Cron triggers hourly
  ↓
GET /api/cron/sync-gmail
  ↓
Verify cron secret
  ↓
Get all users with Gmail connected
  ↓
Enqueue sync jobs to SyncQueue
  ↓
Process queue (max 5 concurrent)
  ↓
orchestrateSync() for each user
  ↓
Return summary
```

---

## Key Components

### 1. Sync Service (`libs/sync/sync-service.ts`)

Core logic for incremental and full sync.

**Key Functions**:
- `incrementalSync()` - Uses Gmail History API
- `fullSync()` - Initial sync or fallback

### 2. Sync Orchestrator (`libs/sync/sync-orchestrator.ts`)

Coordinates sync operations with lock management.

**Key Functions**:
- `orchestrateSync()` - Single user sync
- `orchestrateBatchSync()` - Multiple users

### 3. Sync Lock (`libs/sync/sync-lock.ts`)

Distributed lock using MongoDB to prevent concurrent syncs.

**Key Functions**:
- `acquire()` - Acquire lock for user
- `release()` - Release lock
- `clearStaleLocks()` - Cleanup utility

### 4. Sync Queue (`libs/sync/sync-queue.ts`)

Queue management for processing multiple users.

**Key Functions**:
- `enqueue()` - Add user to queue
- `getNextJob()` - Get next job to process
- `completeJob()` / `failJob()` - Mark job status

### 5. Gmail History (`libs/gmail/gmail-history.ts`)

Gmail History API wrapper for incremental changes.

**Key Functions**:
- `getGmailHistory()` - Fetch history changes
- `getCurrentHistoryId()` - Get current historyId

---

## Database Schema

### SyncMeta Collection

Stores sync state per user.

```javascript
{
  userId: String (unique),
  historyId: String,              // Critical for incremental sync
  lastSyncAt: Date,
  syncInProgress: Boolean,        // Distributed lock
  syncStartedAt: Date,
  syncLockedBy: String,
  totalEmailsProcessed: Number,
  totalSalesFound: Number,
  totalExpensesFound: Number,
  consecutiveErrors: Number,
  lastError: String,
  lastErrorAt: Date,
}
```

### SyncLog Collection

Audit trail for all sync operations (TTL: 90 days).

```javascript
{
  userId: String,
  triggeredBy: 'cron' | 'manual',
  startedAt: Date,
  completedAt: Date,
  duration: Number,
  status: 'success' | 'partial' | 'failed',
  newEmailsProcessed: Number,
  salesAdded: Number,
  expensesAdded: Number,
  gmailApiCalls: Number,
  quotaUnitsUsed: Number,
  errors: Array<{ emailId, error, timestamp }>,
}
```

### SyncQueue Collection

Queue for processing sync jobs (TTL: 7 days).

```javascript
{
  userId: String,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  priority: Number,
  attempts: Number,
  scheduledFor: Date,
  triggeredBy: 'cron' | 'manual',
}
```

---

## Configuration

All settings in `config/sync-config.ts`:

```typescript
export const SYNC_CONFIG = {
  // Timing
  SYNC_INTERVAL_HOURS: 1,
  SYNC_TIMEOUT_MS: 5 * 60 * 1000,
  STALE_LOCK_THRESHOLD_MS: 10 * 60 * 1000,
  
  // Queue
  MAX_CONCURRENT_SYNCS: 5,
  BATCH_SIZE: 10,
  MAX_RETRY_ATTEMPTS: 3,
  
  // Gmail API
  MAX_HISTORY_RESULTS: 500,
  HISTORY_EXPIRY_DAYS: 7,
  
  // Rate limiting
  REQUEST_DELAY_MS: 100,
  
  // Monitoring
  SLOW_SYNC_THRESHOLD_MS: 30_000,
};
```

---

## API Endpoints

### POST /api/sync

Manual sync trigger from UI.

**Auth**: NextAuth session required

**Response**:
```json
{
  "success": true,
  "message": "Sync completed successfully",
  "stats": {
    "newEmails": 15,
    "salesAdded": 10,
    "expensesAdded": 5,
    "duration": 2341
  }
}
```

### GET /api/sync/status

Get current sync status.

**Auth**: NextAuth session required

**Response**:
```json
{
  "syncing": false,
  "lastSyncAt": "2024-01-15T10:30:00Z",
  "totalEmailsProcessed": 1234,
  "totalSalesFound": 890,
  "totalExpensesFound": 344,
  "lastSync": {
    "status": "success",
    "duration": 2341,
    "newEmails": 15,
    "salesAdded": 10,
    "expensesAdded": 5
  }
}
```

### GET /api/cron/sync-gmail

Vercel cron endpoint (production only).

**Auth**: Vercel cron secret (Bearer token)

**Response**:
```json
{
  "success": true,
  "totalUsers": 100,
  "processed": 95,
  "failed": 5,
  "duration": 45123
}
```

---

## Gmail API Quota Management

### Quota Limits (Per Project, Per Day)

- **Total quota**: 1,000,000,000 units
- **Per-user**: 250 units/second
- **Queries per day**: 1,000,000,000

### Cost per Operation

- `users.messages.list`: 5 units
- `users.messages.get`: 5 units
- `users.history.list`: **2 units** (much cheaper!)

### Example Calculation

**Scenario**: 1000 users, hourly sync, 10 new emails/user average

**With Full Sync** (not recommended):
- List: 5 units × 1000 users = 5,000 units
- Get 10 emails × 5 units × 1000 = 50,000 units
- **Total per hour**: 55,000 units
- **Total per day**: 1,320,000 units ✅ (fits in quota)

**With History API** (recommended):
- History: 2 units × 1000 users = 2,000 units
- Get 10 emails × 5 units × 1000 = 50,000 units
- **Total per hour**: 52,000 units
- **Total per day**: 1,248,000 units ✅ (fits in quota)

**Improvement**: 5% quota savings (more significant when fewer changes)

### Rate Limiting Strategies

1. **Delay between requests**: 100ms (configurable)
2. **Batch processing**: Max 5 concurrent users
3. **Exponential backoff**: On 429 errors
4. **Error tracking**: Pause after 5 consecutive errors

---

## Monitoring & Debugging

### View Sync Logs

```typescript
// Get logs for a user
const logs = await SyncLog.find({ userId })
  .sort({ createdAt: -1 })
  .limit(10);

// Get failed syncs
const failed = await SyncLog.find({ status: 'failed' })
  .sort({ createdAt: -1 });
```

### Check Sync Status

```typescript
// Check if user is syncing
const syncMeta = await SyncMeta.findOne({ userId });
console.log(syncMeta.syncInProgress);

// Get last sync time
console.log(syncMeta.lastSyncAt);

// Check for errors
console.log(syncMeta.consecutiveErrors);
console.log(syncMeta.lastError);
```

### Clear Stale Locks

```bash
npx tsx scripts/cleanup-stale-locks.ts
```

### Monitor Quota Usage

```typescript
// Total quota used today
const today = new Date();
today.setHours(0, 0, 0, 0);

const logs = await SyncLog.aggregate([
  { $match: { createdAt: { $gte: today } } },
  { $group: { 
    _id: null, 
    totalQuota: { $sum: '$quotaUnitsUsed' },
    totalSyncs: { $sum: 1 }
  }},
]);

console.log(`Quota used today: ${logs[0].totalQuota} units`);
```

---

## Error Handling

### Common Errors and Solutions

#### 1. "Sync already in progress"
**Cause**: Lock not released or duplicate sync attempt
**Solution**: Wait or run `cleanup-stale-locks.ts`

#### 2. "Gmail history expired"
**Cause**: More than 7 days since last sync
**Solution**: Automatic fallback to full sync

#### 3. "invalid_grant"
**Cause**: User revoked OAuth access or token expired
**Solution**: User needs to reconnect Gmail account

#### 4. "Rate limit exceeded" (429)
**Cause**: Too many API requests
**Solution**: Automatic retry with exponential backoff

#### 5. "No historyId returned"
**Cause**: First sync or Gmail API issue
**Solution**: Falls back to full sync

### Error Recovery

All errors are logged to:
- `SyncLog` collection (persistent)
- `SyncMeta.lastError` (for user notification)
- Console logs (for debugging)

Retry logic:
- Max 3 attempts per sync
- Exponential backoff: 1s, 5s, 15s
- Cooldown after 5 consecutive errors

---

## Performance Optimization

### MongoDB Indexes

All critical queries are indexed:

```javascript
// SyncMeta
{ userId: 1 } (unique)
{ nextScheduledSync: 1 }
{ syncInProgress: 1, syncStartedAt: 1 }

// Sales
{ userId: 1, transactionId: 1 } (unique)
{ userId: 1, saleDate: -1 }

// Expenses
{ userId: 1, gmailMessageId: 1 } (unique)
{ userId: 1, expenseDate: -1 }

// SyncLog (with TTL)
{ userId: 1, createdAt: -1 }
{ createdAt: 1 } (expires after 90 days)
```

### Query Optimization

```typescript
// ✅ Fast: Uses index, projection, lean
const sales = await Sale.find({ userId })
  .select('amount date vendor')
  .sort({ date: -1 })
  .limit(100)
  .lean();

// ❌ Slow: No index, full collection scan
const sales = await Sale.find({ vendor: 'Vinted' });
```

### Batch Operations

```typescript
// ✅ Fast: Single batch insert
await Sale.insertMany(sales, { ordered: false });

// ❌ Slow: N individual inserts
for (const sale of sales) {
  await Sale.create(sale);
}
```

---

## Local vs Production Behavior

### Local Development

- **Sync trigger**: Manual button only (no cron)
- **Environment**: `NODE_ENV=development`
- **Vercel**: `VERCEL` env var not set
- **Cron endpoint**: Returns 403 Forbidden

### Production (Vercel)

- **Sync trigger**: Automatic hourly cron + manual button
- **Environment**: `VERCEL_ENV=production`
- **Vercel**: `VERCEL=1`
- **Cron endpoint**: Runs hourly automatically

### Conditional Logic

```typescript
import { isProduction, isLocalDev } from '@/config/sync-config';

if (isProduction()) {
  // Auto-sync via cron
} else {
  // Manual sync only
}
```

---

## Deployment Checklist

### Before Deploying

- [ ] Set `CRON_SECRET` in Vercel environment variables
- [ ] Verify `GOOGLE_ID` and `GOOGLE_SECRET` are correct
- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Run `create-indexes.ts` on production MongoDB
- [ ] Test manual sync in dev environment
- [ ] Review sync configuration in `sync-config.ts`

### After Deploying

- [ ] Verify cron is registered: `vercel cron ls`
- [ ] Manually trigger cron to test
- [ ] Check Vercel logs for cron execution
- [ ] Monitor first few automatic syncs
- [ ] Verify data is syncing correctly
- [ ] Set up error alerting (optional)

### Monitoring Setup

- [ ] Set up Sentry for error tracking (optional)
- [ ] Configure Slack webhook for alerts (optional)
- [ ] Create admin dashboard at `/admin/sync-monitor`
- [ ] Set up MongoDB monitoring (Atlas)
- [ ] Monitor Gmail API quota usage

---

## Troubleshooting

### Sync Not Running

**Check**:
1. Is `CRON_SECRET` set in Vercel?
2. Is cron registered? Run `vercel cron ls`
3. Check Vercel logs for errors
4. Verify user has `gmailAccessToken` in database

**Fix**:
```bash
# Redeploy to register cron
vercel --prod

# Manually trigger to test
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://yourdomain.com/api/cron/sync-gmail
```

### Slow Dashboard Queries

**Check**:
1. Are indexes created? Run `create-indexes.ts`
2. Are you using `.lean()` for read-only queries?
3. Are you projecting only needed fields?

**Fix**:
```typescript
// Add .lean() and .select()
const sales = await Sale.find({ userId })
  .select('amount date vendor')
  .lean();
```

### High Gmail API Quota Usage

**Check**:
1. Are you using History API? (should be in logs)
2. How many users are syncing hourly?
3. Average emails per sync?

**Fix**:
- Increase sync interval (from 1 hour to 2 hours)
- Reduce concurrent syncs (from 5 to 3)
- Check for users with errors causing retries

### Locks Getting Stuck

**Check**:
```typescript
const stuckLocks = await SyncMeta.find({
  syncInProgress: true,
  syncStartedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) }
});
```

**Fix**:
```bash
npx tsx scripts/cleanup-stale-locks.ts
```

---

## Next Steps

### Phase 1: Basic Implementation (Current)
✅ Incremental sync with Gmail History API
✅ Vercel cron for hourly automatic sync
✅ Queue-based processing
✅ Lock mechanism to prevent duplicates
✅ Logging and monitoring

### Phase 2: Enhancements (Future)

1. **Real-time Sync via Gmail Push Notifications**
   - Set up Google Cloud Pub/Sub
   - Receive webhooks when new emails arrive
   - Near-instant sync instead of hourly

2. **ML-Powered Categorization**
   - Train model on parsed emails
   - Auto-categorize with confidence scores
   - Flag low-confidence items for review

3. **Multi-Account Support**
   - Allow users to connect multiple Gmail accounts
   - Separate sync per account
   - Unified dashboard view

4. **Advanced Analytics**
   - Sync performance dashboard
   - Quota usage trends
   - Error rate monitoring
   - User sync health scores

5. **Webhook API**
   - Allow third-party integrations
   - Trigger sync from external systems
   - Real-time notifications

---

## Support

For issues or questions:
1. Check this guide first
2. Review logs in MongoDB (`SyncLog` collection)
3. Check Vercel logs for cron execution
4. Test locally with `test-sync.ts` script

**Common Commands**:
```bash
# Test sync locally
npx tsx scripts/test-sync.ts --userId=<user_id>

# Create indexes
npx tsx scripts/create-indexes.ts

# Clear stuck locks
npx tsx scripts/cleanup-stale-locks.ts

# Deploy to production
vercel --prod

# View cron jobs
vercel cron ls

# View Vercel logs
vercel logs --follow
```

---

**Last Updated**: December 2024
**Version**: 1.0.0

