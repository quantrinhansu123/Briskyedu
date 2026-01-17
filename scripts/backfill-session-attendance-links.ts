/**
 * Backfill Session-Attendance Links
 *
 * This script finds sessions that have `status: 'Chưa học'` but have matching
 * attendance records, and updates them to `status: 'Đã học'` with the correct attendanceId.
 *
 * Prerequisites:
 *   - Set GOOGLE_APPLICATION_CREDENTIALS environment variable to your service account key
 *   - Or place serviceAccountKey.json in project root
 *
 * Usage:
 *   npx tsx scripts/backfill-session-attendance-links.ts --dry-run   # Preview changes
 *   npx tsx scripts/backfill-session-attendance-links.ts --execute   # Apply changes
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

// ESM compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, '../serviceAccountKey.json');
const hasServiceAccount = existsSync(serviceAccountPath);

if (!admin.apps.length) {
  if (hasServiceAccount) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Initialized Firebase Admin with service account');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log('Initialized Firebase Admin with application default credentials');
  } else {
    console.error(`
Error: No Firebase credentials found.

Option 1: Create serviceAccountKey.json in project root
  - Go to Firebase Console > Project Settings > Service Accounts
  - Generate new private key and save as serviceAccountKey.json

Option 2: Set GOOGLE_APPLICATION_CREDENTIALS environment variable
  - export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
`);
    process.exit(1);
  }
}

const db = admin.firestore();

interface BackfillResult {
  sessionsChecked: number;
  sessionsUpdated: number;
  errors: string[];
}

async function backfillSessionAttendanceLinks(dryRun = true): Promise<BackfillResult> {
  const result: BackfillResult = {
    sessionsChecked: 0,
    sessionsUpdated: 0,
    errors: []
  };

  console.log(`\n=== BACKFILL SESSION-ATTENDANCE LINKS ===`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no changes will be made)' : 'EXECUTE (changes will be applied)'}\n`);

  // 1. Get all sessions with status='Chưa học'
  console.log('Fetching sessions with status="Chưa học"...');
  const sessionsSnap = await db.collection('classSessions')
    .where('status', '==', 'Chưa học')
    .get();
  console.log(`Found ${sessionsSnap.size} incomplete sessions\n`);

  // 2. Get all attendance records (for matching)
  console.log('Fetching attendance records...');
  const attendanceSnap = await db.collection('attendance').get();
  console.log(`Found ${attendanceSnap.size} attendance records\n`);

  // Build lookup maps for matching
  const attendanceByClassDate = new Map<string, { id: string; sessionId?: string }>();
  const attendanceBySessionId = new Map<string, { id: string }>();

  attendanceSnap.docs.forEach(docRef => {
    const data = docRef.data();

    // Map by classId + date
    if (data.classId && data.date) {
      const key = `${data.classId}_${data.date}`;
      attendanceByClassDate.set(key, { id: docRef.id, sessionId: data.sessionId });
    }

    // Also map by sessionId if available
    if (data.sessionId) {
      attendanceBySessionId.set(data.sessionId, { id: docRef.id });
    }
  });

  console.log(`Built lookup maps: ${attendanceByClassDate.size} by classId+date, ${attendanceBySessionId.size} by sessionId\n`);

  // 3. For each unlinked session, find matching attendance
  console.log('Checking sessions for missing links...\n');

  for (const sessionDoc of sessionsSnap.docs) {
    result.sessionsChecked++;
    const sessionData = sessionDoc.data();

    // Skip if already linked
    if (sessionData.attendanceId) {
      continue;
    }

    // Try to find matching attendance
    // Priority 1: Match by sessionId
    let matchedAttendance = attendanceBySessionId.get(sessionDoc.id);

    // Priority 2: Match by classId + date
    if (!matchedAttendance && sessionData.classId && sessionData.date) {
      const key = `${sessionData.classId}_${sessionData.date}`;
      matchedAttendance = attendanceByClassDate.get(key);
    }

    if (matchedAttendance) {
      const logPrefix = dryRun ? '[DRY-RUN]' : '[UPDATE]';
      console.log(`${logPrefix} Session ${sessionDoc.id} (Buổi ${sessionData.sessionNumber}, ${sessionData.date})`);
      console.log(`         -> Attendance ${matchedAttendance.id}`);

      if (!dryRun) {
        try {
          await db.collection('classSessions').doc(sessionDoc.id).update({
            status: 'Đã học',
            attendanceId: matchedAttendance.id
          });
          result.sessionsUpdated++;
          console.log(`         ✓ Updated successfully\n`);
        } catch (err) {
          const errorMsg = `Failed to update session ${sessionDoc.id}: ${err}`;
          result.errors.push(errorMsg);
          console.error(`         ✗ ${errorMsg}\n`);
        }
      } else {
        result.sessionsUpdated++;
        console.log(`         (Would be updated)\n`);
      }
    }
  }

  return result;
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--execute');

if (!args.includes('--dry-run') && !args.includes('--execute')) {
  console.log('Usage:');
  console.log('  npx tsx scripts/backfill-session-attendance-links.ts --dry-run   # Preview changes');
  console.log('  npx tsx scripts/backfill-session-attendance-links.ts --execute   # Apply changes');
  console.log('\nRunning in dry-run mode by default...\n');
}

backfillSessionAttendanceLinks(dryRun)
  .then(result => {
    console.log('\n=== BACKFILL COMPLETE ===');
    console.log(`Sessions checked: ${result.sessionsChecked}`);
    console.log(`Sessions ${dryRun ? 'would be ' : ''}updated: ${result.sessionsUpdated}`);

    if (result.errors.length > 0) {
      console.log(`\nErrors encountered: ${result.errors.length}`);
      result.errors.forEach(e => console.error(`  - ${e}`));
    }

    if (dryRun && result.sessionsUpdated > 0) {
      console.log('\nTo apply these changes, run with --execute flag');
    }

    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
