/**
 * Test Gmail Sync Locally
 * Usage: npx tsx scripts/test-sync.ts --userId=<user_id>
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { orchestrateSync } from '../libs/sync/sync-orchestrator';
import { logger } from '../libs/monitoring/logger';
import connectMongo from '../libs/mongoose';

async function testSync() {
  try {
    const args = process.argv.slice(2);
    const userIdArg = args.find(arg => arg.startsWith('--userId='));
    
    if (!userIdArg) {
      console.error('❌ Please provide userId: --userId=<user_id>');
      process.exit(1);
    }
    
    const userId = userIdArg.split('=')[1];
    
    console.log(`🧪 Testing sync for user: ${userId}\n`);
    
    await connectMongo();
    
    const result = await orchestrateSync(userId, 'manual');
    
    console.log('\n📊 Sync Result:');
    console.log('─────────────────────────────────────');
    console.log(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`New Emails: ${result.newEmailsProcessed}`);
    console.log(`Sales Added: ${result.salesAdded}`);
    console.log(`Expenses Added: ${result.expensesAdded}`);
    console.log(`Emails Skipped: ${result.emailsSkipped}`);
    console.log(`Gmail API Calls: ${result.gmailApiCalls}`);
    console.log(`Quota Used: ${result.quotaUnitsUsed} units`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️ Errors (${result.errors.length}):`);
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.error}`);
      });
    }
    
    console.log('─────────────────────────────────────\n');
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error: any) {
    console.error('❌ Test sync failed:', error.message);
    process.exit(1);
  }
}

testSync();

