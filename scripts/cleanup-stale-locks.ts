/**
 * Cleanup Stale Sync Locks
 * Run manually if locks get stuck: npx tsx scripts/cleanup-stale-locks.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { SyncLock } from '../libs/sync/sync-lock';
import connectMongo from '../libs/mongoose';

async function cleanup() {
  try {
    console.log('🧹 Cleaning up stale sync locks...\n');
    
    await connectMongo();
    
    const clearedCount = await SyncLock.clearStaleLocks();
    
    if (clearedCount > 0) {
      console.log(`✅ Cleared ${clearedCount} stale locks`);
    } else {
      console.log('✅ No stale locks found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up locks:', error);
    process.exit(1);
  }
}

cleanup();

