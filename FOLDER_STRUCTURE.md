# Gmail Sync - Detailed Folder Structure

```
accounting/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   └── sync-gmail/
│   │   │       └── route.ts              # Vercel cron endpoint (hourly trigger)
│   │   ├── sync/
│   │   │   ├── route.ts                  # Manual sync endpoint (POST /api/sync)
│   │   │   └── status/
│   │   │       └── route.ts              # Get sync status (GET /api/sync/status)
│   │   ├── gmail/
│   │   │   ├── auth/
│   │   │   │   └── route.ts              # Gmail OAuth callback
│   │   │   └── reauthorize/
│   │   │       └── route.ts              # Re-auth for expired tokens
│   │   ├── sales/
│   │   │   └── route.ts                  # GET /api/sales (query sales)
│   │   ├── expenses/
│   │   │   └── route.ts                  # GET /api/expenses
│   │   └── dashboard/
│   │       └── stats/
│   │           └── route.ts              # GET /api/dashboard/stats
│   │
│   ├── dashboard/
│   │   ├── page.tsx                      # Main dashboard (server component)
│   │   ├── layout.tsx
│   │   └── loading.tsx
│   │
│   └── admin/
│       └── sync-monitor/
│           └── page.tsx                  # Admin panel for monitoring syncs
│
├── components/
│   ├── sync/
│   │   ├── sync-button.tsx               # Manual sync button (client component)
│   │   ├── sync-status-badge.tsx         # Shows last sync time
│   │   └── sync-progress.tsx             # Progress indicator during sync
│   │
│   ├── dashboard/
│   │   ├── sales-chart.tsx
│   │   ├── expenses-chart.tsx
│   │   └── stats-cards.tsx
│   │
│   └── gmail/
│       ├── gmail-connect-button.tsx      # OAuth connection button
│       └── gmail-disconnect-button.tsx
│
├── libs/
│   ├── gmail/
│   │   ├── gmail-client.ts               # Gmail API client wrapper
│   │   ├── gmail-auth.ts                 # OAuth token management
│   │   ├── gmail-sync.ts                 # Core incremental sync logic
│   │   ├── gmail-history.ts              # History API wrapper
│   │   └── gmail-parser.ts               # Email parsing orchestrator
│   │
│   ├── parsers/
│   │   ├── index.ts                      # Parser version router
│   │   ├── v1-parser.ts                  # Original parser (legacy)
│   │   ├── v2-parser.ts                  # Current parser
│   │   ├── base-parser.ts                # Shared parser utilities
│   │   └── types.ts                      # Parser result types
│   │
│   ├── sync/
│   │   ├── sync-orchestrator.ts          # Main sync coordinator
│   │   ├── sync-queue.ts                 # Queue manager with concurrency control
│   │   ├── sync-lock.ts                  # MongoDB-based distributed lock
│   │   └── sync-scheduler.ts             # Determines which users to sync
│   │
│   ├── db/
│   │   ├── mongodb.ts                    # MongoDB connection (existing)
│   │   ├── indexes.ts                    # Index creation script
│   │   └── migrations.ts                 # Database migration utilities
│   │
│   └── monitoring/
│       ├── logger.ts                     # Structured logging
│       ├── metrics.ts                    # Metrics tracking
│       └── alerts.ts                     # Error alerting (email, Slack)
│
├── models/
│   ├── Sale.ts                           # Sale schema with indexes
│   ├── Expense.ts                        # Expense schema
│   ├── SyncMeta.ts                       # Sync metadata per user
│   ├── SyncLog.ts                        # Sync audit logs
│   └── SyncQueue.ts                      # Sync queue items
│
├── types/
│   ├── gmail.ts                          # Gmail API types
│   ├── sync.ts                           # Sync operation types
│   ├── parser.ts                         # Parser input/output types
│   └── dashboard.ts                      # Dashboard data types
│
├── scripts/
│   ├── create-indexes.ts                 # Run once to create MongoDB indexes
│   ├── migrate-parser-v1-to-v2.ts        # Re-parse old emails with new parser
│   ├── test-sync.ts                      # Local testing script
│   └── cleanup-stale-locks.ts            # Clear stuck sync locks
│
├── config/
│   └── sync-config.ts                    # Sync configuration (intervals, limits)
│
├── vercel.json                           # Vercel cron configuration
├── .env.local                            # Local development env vars
├── .env.example                          # Example env vars
├── GMAIL_SYNC_ARCHITECTURE.md            # This document
└── FOLDER_STRUCTURE.md                   # This file
```

## Key Files Explained

### API Routes

#### `/app/api/cron/sync-gmail/route.ts`
- **Purpose**: Vercel cron trigger endpoint (runs hourly in production)
- **Auth**: Vercel cron secret header
- **Function**: Processes all users needing sync via queue
- **Time limit**: Must complete within 10s (Hobby) or 60s (Pro)

#### `/app/api/sync/route.ts`
- **Purpose**: Manual sync trigger (user clicks button)
- **Auth**: NextAuth session
- **Function**: Enqueues single user sync job
- **Response**: Returns immediately, sync happens async

#### `/app/api/sync/status/route.ts`
- **Purpose**: Get current sync status for user
- **Returns**: `{ syncing: boolean, lastSyncAt: Date, progress: number }`

### Core Libraries

#### `/libs/gmail/gmail-sync.ts`
- **Main export**: `incrementalSync(userId, oauth2Client)`
- **Logic**: 
  1. Fetch historyId from SyncMeta
  2. Call Gmail History API
  3. Extract changed email IDs
  4. Batch fetch full messages
  5. Parse and categorize
  6. Upsert to MongoDB
  7. Update historyId

#### `/libs/sync/sync-orchestrator.ts`
- **Main export**: `orchestrateSync(userId, triggeredBy)`
- **Logic**:
  1. Acquire distributed lock (MongoDB)
  2. Check if sync already running
  3. Call `incrementalSync()`
  4. Log results to SyncLog
  5. Release lock
  6. Trigger revalidation

#### `/libs/sync/sync-queue.ts`
- **Main export**: `SyncQueueManager` class
- **Features**:
  - Max concurrent syncs (5 users at once)
  - In-memory queue (no external service needed)
  - Automatic retry with exponential backoff
  - Dead letter queue for failed jobs

#### `/libs/parsers/v2-parser.ts`
- **Main export**: `parseEmailV2(gmailMessage)`
- **Returns**: `{ type: 'sale' | 'expense', amount, date, vendor, category }`
- **Logic**:
  - Extract email body (plain text + HTML)
  - Regex patterns for amounts, dates
  - Vendor detection from sender domain
  - Category classification (ML or rule-based)

### MongoDB Models

#### `/models/SyncMeta.ts`
```typescript
{
  userId: string (unique),
  historyId: string,           // Critical: Last Gmail historyId
  lastSyncAt: Date,
  syncInProgress: boolean,     // Distributed lock flag
  syncStartedAt: Date | null,
  consecutiveErrors: number,
  lastError: string | null,
}
```

#### `/models/Sale.ts` & `/models/Expense.ts`
```typescript
{
  userId: string,
  emailId: string,             // Gmail message ID (unique per user)
  amount: number,
  date: Date,
  vendor: string,
  category: string,
  parserVersion: string,       // "v1", "v2" for migration
  needsReview: boolean,
}
```

### Scripts

#### `/scripts/create-indexes.ts`
Run once after deployment:
```bash
npx tsx scripts/create-indexes.ts
```

Creates all required MongoDB indexes for optimal performance.

#### `/scripts/migrate-parser-v1-to-v2.ts`
Run when parser improves:
```bash
npx tsx scripts/migrate-parser-v1-to-v2.ts --userId=<user_id>
```

Re-parses all v1 emails with v2 parser.

## Environment Variables

### Required in Production

```bash
# Gmail OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/gmail/auth

# Vercel Cron
CRON_SECRET=random_secret_string  # Generate with: openssl rand -base64 32

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/accounting

# NextAuth (existing)
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=https://yourdomain.com

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
SLACK_WEBHOOK_URL=your_slack_webhook

# Token encryption (generate secure keys)
ENCRYPTION_KEY=64_char_hex_string  # openssl rand -hex 32
ENCRYPTION_IV=32_char_hex_string   # openssl rand -hex 16
```

## Development Workflow

### 1. Initial Setup
```bash
npm install
cp .env.example .env.local
# Fill in .env.local with dev credentials
npx tsx scripts/create-indexes.ts
```

### 2. Test Gmail Sync Locally
```bash
# Start dev server
npm run dev

# Navigate to app
# Click "Connect Gmail" button
# Click "Sync Now" button manually

# Or test via script
npx tsx scripts/test-sync.ts --userId=<your_user_id>
```

### 3. Deploy to Vercel
```bash
vercel --prod

# Verify cron is registered
vercel cron ls

# Trigger cron manually for testing
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://yourdomain.com/api/cron/sync-gmail
```

### 4. Monitor Sync Activity
- Visit `/admin/sync-monitor` dashboard
- Check SyncLogs collection in MongoDB
- View Vercel logs for cron executions

## File Creation Order

When implementing, create files in this order to minimize errors:

### Phase 1: Database Layer
1. `types/sync.ts`
2. `types/gmail.ts`
3. `models/SyncMeta.ts`
4. `models/SyncLog.ts`
5. `models/Sale.ts`
6. `models/Expense.ts`
7. `libs/db/indexes.ts`
8. `scripts/create-indexes.ts`

### Phase 2: Gmail Integration
9. `libs/gmail/gmail-client.ts`
10. `libs/gmail/gmail-auth.ts`
11. `libs/gmail/gmail-history.ts`
12. `libs/parsers/base-parser.ts`
13. `libs/parsers/v2-parser.ts`
14. `libs/parsers/index.ts`
15. `libs/gmail/gmail-parser.ts`
16. `libs/gmail/gmail-sync.ts`

### Phase 3: Sync Orchestration
17. `libs/sync/sync-lock.ts`
18. `libs/sync/sync-queue.ts`
19. `libs/sync/sync-orchestrator.ts`
20. `libs/sync/sync-scheduler.ts`

### Phase 4: API Routes
21. `app/api/sync/route.ts`
22. `app/api/sync/status/route.ts`
23. `app/api/cron/sync-gmail/route.ts`
24. `app/api/sales/route.ts`
25. `app/api/expenses/route.ts`

### Phase 5: UI Components
26. `components/sync/sync-button.tsx`
27. `components/sync/sync-status-badge.tsx`
28. `app/dashboard/page.tsx` (update existing)

### Phase 6: Testing & Monitoring
29. `scripts/test-sync.ts`
30. `libs/monitoring/logger.ts`
31. `libs/monitoring/metrics.ts`
32. `app/admin/sync-monitor/page.tsx`

## Next Steps

Ready to implement? Let's start with:

1. **Create TypeScript types** (`types/sync.ts`, `types/gmail.ts`)
2. **Build MongoDB models** with proper schemas and indexes
3. **Implement Gmail client** wrapper for API calls
4. **Build incremental sync** logic with History API
5. **Create orchestrator** with queue and locking
6. **Set up API routes** for cron and manual sync
7. **Update UI** with sync button and status
8. **Test locally** with real Gmail data
9. **Deploy to Vercel** and configure cron
10. **Monitor and optimize** based on real usage

Shall I proceed with implementation?

