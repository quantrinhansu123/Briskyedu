/**
 * Rollback Script: Revert Session Migration
 *
 * Deletes sessions created during migration based on timestamp.
 * Only deletes sessions without attendanceId (safe deletion).
 *
 * Usage:
 *   npx tsx scripts/rollback-session-migration.ts --after "2026-01-17T10:00:00.000Z" --dry-run
 *   npx tsx scripts/rollback-session-migration.ts --after "2026-01-17T10:00:00.000Z"
 */

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Init Firebase Admin SDK
const serviceAccountPath = join(__dirname, '../service-account.json');
try {
  if (existsSync(serviceAccountPath)) {
    const serviceAccountRaw = readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountRaw);
    // Validate required service account fields
    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      throw new Error('Invalid service account: missing project_id or private_key');
    }
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      credential: applicationDefault()
    });
  }
} catch (err) {
  console.error('Failed to initialize Firebase Admin:', err);
  process.exit(1);
}
const db = getFirestore();

// Parse args
const DRY_RUN = process.argv.includes('--dry-run');
const afterIndex = process.argv.indexOf('--after');
const AFTER_TIMESTAMP = afterIndex !== -1 ? process.argv[afterIndex + 1] : null;

async function rollbackMigration() {
  console.log('=== Session Migration Rollback ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  console.log('');

  if (!AFTER_TIMESTAMP) {
    console.error('Error: --after timestamp is required');
    console.error('Usage: npx tsx scripts/rollback-session-migration.ts --after "2026-01-17T10:00:00.000Z"');
    process.exit(1);
  }

  console.log(`Rollback sessions created after: ${AFTER_TIMESTAMP}`);
  console.log('');

  // Query sessions created after timestamp
  const sessionsSnap = await db.collection('classSessions')
    .where('createdAt', '>=', AFTER_TIMESTAMP)
    .get();

  console.log(`Found ${sessionsSnap.size} sessions created after ${AFTER_TIMESTAMP}`);

  // Filter to only sessions without attendance
  const toRollback = sessionsSnap.docs.filter(d => {
    const data = d.data();
    return !data.attendanceId;
  });

  const preserved = sessionsSnap.size - toRollback.length;

  console.log(`Sessions to rollback: ${toRollback.length}`);
  console.log(`Sessions preserved (has attendance): ${preserved}`);
  console.log('');

  if (toRollback.length === 0) {
    console.log('No sessions to rollback.');
    return;
  }

  // Group by class for logging
  const byClass = new Map<string, number>();
  toRollback.forEach(d => {
    const className = d.data().className || 'Unknown';
    byClass.set(className, (byClass.get(className) || 0) + 1);
  });

  console.log('Sessions to delete by class:');
  byClass.forEach((count, className) => {
    console.log(`  - ${className}: ${count}`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('[DRY RUN] No changes made.');
    console.log('Run without --dry-run to execute rollback.');
    return;
  }

  // Execute deletion in batches
  console.log('Executing rollback...');

  const BATCH_SIZE = 400;
  let deleted = 0;

  for (let i = 0; i < toRollback.length; i += BATCH_SIZE) {
    const batchDocs = toRollback.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    batchDocs.forEach(d => {
      batch.delete(db.collection('classSessions').doc(d.id));
    });

    await batch.commit();
    deleted += batchDocs.length;
    console.log(`Deleted ${deleted}/${toRollback.length} sessions...`);
  }

  console.log('');
  console.log('=== Rollback Complete ===');
  console.log(`Deleted: ${deleted} sessions`);
  console.log(`Preserved: ${preserved} sessions (had attendance)`);
}

// Run
rollbackMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Rollback failed:', err);
    process.exit(1);
  });
