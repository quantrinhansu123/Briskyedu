/**
 * Backfill Session-Attendance Links
 *
 * This script finds sessions that have `status: 'Chưa học'` but have matching
 * attendance records, and updates them to `status: 'Đã học'` with the correct attendanceId.
 *
 * Usage:
 *   npx tsx scripts/backfill-session-attendance-links.ts --dry-run   # Preview changes
 *   npx tsx scripts/backfill-session-attendance-links.ts --execute   # Apply changes
 *
 * Note: Run with Firebase emulator or ensure you're authenticated via browser first.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ESM compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Firebase config from environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error('Error: Firebase config not found. Make sure .env.local exists with VITE_FIREBASE_* variables.');
  process.exit(1);
}

console.log(`Connecting to Firebase project: ${firebaseConfig.projectId}`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
  const sessionsQuery = query(
    collection(db, 'classSessions'),
    where('status', '==', 'Chưa học')
  );
  const sessionsSnap = await getDocs(sessionsQuery);
  console.log(`Found ${sessionsSnap.size} incomplete sessions\n`);

  // 2. Get all attendance records (for matching)
  console.log('Fetching attendance records...');
  const attendanceSnap = await getDocs(collection(db, 'attendance'));
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
          await updateDoc(doc(db, 'classSessions', sessionDoc.id), {
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
    if (err.code === 'permission-denied') {
      console.log('\nTip: Run with Firebase emulator or temporarily adjust Firestore rules');
      console.log('  firebase emulators:start --only firestore');
    }
    process.exit(1);
  });
