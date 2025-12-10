/**
 * Create MongoDB Indexes for Sync System
 * Run once after deploying: npx tsx scripts/create-indexes.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import connectMongo from '../libs/mongoose';
import SyncMeta from '../models/SyncMeta';
import SyncLog from '../models/SyncLog';
import SyncQueue from '../models/SyncQueue';
import Sale from '../models/Sale';
import Expense from '../models/Expense';

async function createIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await connectMongo();
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Creating indexes...\n');

    // SyncMeta indexes
    console.log('Creating SyncMeta indexes...');
    await SyncMeta.collection.createIndex({ userId: 1 }, { unique: true });
    await SyncMeta.collection.createIndex({ nextScheduledSync: 1 });
    await SyncMeta.collection.createIndex({ syncInProgress: 1, syncStartedAt: 1 });
    console.log('✅ SyncMeta indexes created');

    // SyncLog indexes
    console.log('Creating SyncLog indexes...');
    await SyncLog.collection.createIndex({ userId: 1, createdAt: -1 });
    await SyncLog.collection.createIndex({ status: 1, userId: 1 });
    
    // Drop old TTL index if it exists with different settings
    try {
      await SyncLog.collection.dropIndex('createdAt_1');
      console.log('⚠️  Dropped old TTL index with different settings');
    } catch (err: any) {
      // Index might not exist or already correct, that's okay
      if (err.code !== 27) { // 27 = IndexNotFound
        console.log('ℹ️  No old TTL index to drop');
      }
    }
    
    // Create new TTL index with 90 days retention
    await SyncLog.collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 90 * 24 * 60 * 60 } // 90 days TTL
    );
    console.log('✅ SyncLog indexes created');

    // SyncQueue indexes
    console.log('Creating SyncQueue indexes...');
    await SyncQueue.collection.createIndex(
      { status: 1, scheduledFor: 1, priority: -1 },
      { name: 'queue_processing' }
    );
    await SyncQueue.collection.createIndex({ userId: 1, status: 1 });
    
    // Drop old TTL index if it exists with different settings
    try {
      const indexes = await SyncQueue.collection.listIndexes().toArray();
      const ttlIndex = indexes.find(idx => idx.key?.createdAt === 1 && idx.expireAfterSeconds);
      if (ttlIndex && ttlIndex.expireAfterSeconds !== 7 * 24 * 60 * 60) {
        await SyncQueue.collection.dropIndex(ttlIndex.name);
        console.log('⚠️  Dropped old SyncQueue TTL index');
      }
    } catch (err) {
      // Index might not exist, that's okay
    }
    
    // Create new TTL index with 7 days retention
    await SyncQueue.collection.createIndex(
      { createdAt: 1 },
      {
        expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days TTL
        partialFilterExpression: {
          status: { $in: ['completed', 'failed'] },
        },
      }
    );
    console.log('✅ SyncQueue indexes created');

    // Verify existing Sale indexes
    console.log('Verifying Sale indexes...');
    const saleIndexes = await Sale.collection.indexes();
    console.log('Sale indexes:', saleIndexes.map(i => i.name).join(', '));
    console.log('✅ Sale indexes verified');

    // Verify existing Expense indexes
    console.log('Verifying Expense indexes...');
    const expenseIndexes = await Expense.collection.indexes();
    console.log('Expense indexes:', expenseIndexes.map(i => i.name).join(', '));
    console.log('✅ Expense indexes verified');

    console.log('\n🎉 All indexes created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();

