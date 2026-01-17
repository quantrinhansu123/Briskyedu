/**
 * Fix Duplicate Sessions Script
 * Xóa sessions trùng lặp, giữ lại session có attendanceId
 *
 * Run dry-run first: npx tsx scripts/fix-duplicate-sessions.ts --dry-run
 * Run fix:           npx tsx scripts/fix-duplicate-sessions.ts --fix
 */

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Init Firebase Admin
const serviceAccountPath = join(__dirname, '../service-account.json');
if (existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
} else {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    credential: applicationDefault()
  });
}
const db = getFirestore();

// Target classes - same as audit script
const TARGET_CLASSES = [
  'Cam 4.2', 'Sunny 5', 'Kindy 4', 'Cam 4.3', 'Ket 1C', 'Ket 2B',
  'Pre - Starters 27', 'English 3.2', 'Pet 1A', 'Let 2A',
  'Starter 28', 'Cam 3.1', 'Kindy 12', 'Cam 4.1', 'Kindy 15', 'Starter 23'
];

interface SessionData {
  id: string;
  classId: string;
  className: string;
  sessionNumber: number;
  date: string;
  dayOfWeek: string;
  time?: string;
  status: string;
  attendanceId?: string;
  createdAt?: string;
}

interface FixAction {
  action: 'DELETE' | 'KEEP' | 'RENUMBER';
  sessionId: string;
  classId: string;
  className: string;
  date: string;
  sessionNumber: number;
  newSessionNumber?: number;
  reason: string;
  hasAttendance: boolean;
}

async function fixDuplicateSessions(dryRun: boolean) {
  console.log(`\n🔧 Fix Duplicate Sessions - ${dryRun ? 'DRY RUN' : '⚠️ LIVE FIX'}\n`);

  // Fetch target classes
  const classesSnap = await db.collection('classes').get();
  const targetClasses = classesSnap.docs
    .map(doc => ({ id: doc.id, name: doc.data().name as string }))
    .filter(c => TARGET_CLASSES.some(name => c.name.toLowerCase() === name.toLowerCase()));

  console.log(`📚 Found ${targetClasses.length} target classes\n`);

  const classIds = targetClasses.map(c => c.id);
  const classNameMap = new Map(targetClasses.map(c => [c.id, c.name]));

  // Fetch all sessions for target classes
  const sessionsSnap = await db.collection('classSessions').get();
  const allSessions: SessionData[] = sessionsSnap.docs
    .filter(doc => classIds.includes(doc.data().classId))
    .map(doc => ({ id: doc.id, ...doc.data() } as SessionData));

  console.log(`📅 Found ${allSessions.length} sessions\n`);

  // Group sessions by classId
  const sessionsByClass = new Map<string, SessionData[]>();
  allSessions.forEach(s => {
    const existing = sessionsByClass.get(s.classId) || [];
    existing.push(s);
    sessionsByClass.set(s.classId, existing);
  });

  const actions: FixAction[] = [];
  let totalToDelete = 0;
  let totalToRenumber = 0;

  // Process each class
  for (const [classId, sessions] of sessionsByClass) {
    const className = classNameMap.get(classId) || classId;

    // Sort by date, then by createdAt for stable ordering
    sessions.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    // Group by date to find duplicates
    const byDate = new Map<string, SessionData[]>();
    sessions.forEach(s => {
      if (!s.date) return;
      const existing = byDate.get(s.date) || [];
      existing.push(s);
      byDate.set(s.date, existing);
    });

    // Find duplicates and decide what to keep/delete
    const toKeep: SessionData[] = [];
    const toDelete: SessionData[] = [];

    for (const [date, dateSessions] of byDate) {
      if (dateSessions.length === 1) {
        toKeep.push(dateSessions[0]);
      } else {
        // Multiple sessions for same date - pick best one to keep
        // Priority: 1) Has attendanceId, 2) First by createdAt
        const sorted = dateSessions.sort((a, b) => {
          // Has attendance comes first
          if (a.attendanceId && !b.attendanceId) return -1;
          if (!a.attendanceId && b.attendanceId) return 1;
          // Then by createdAt
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        });

        toKeep.push(sorted[0]);

        // Mark rest for deletion
        for (let i = 1; i < sorted.length; i++) {
          toDelete.push(sorted[i]);
          actions.push({
            action: 'DELETE',
            sessionId: sorted[i].id,
            classId,
            className,
            date,
            sessionNumber: sorted[i].sessionNumber,
            reason: `Duplicate date - keeping session ${sorted[0].id}${sorted[0].attendanceId ? ' (has attendance)' : ''}`,
            hasAttendance: !!sorted[i].attendanceId
          });
        }
      }
    }

    totalToDelete += toDelete.length;

    // Now renumber kept sessions sequentially
    toKeep.sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 0; i < toKeep.length; i++) {
      const expectedNumber = i + 1;
      const session = toKeep[i];

      if (session.sessionNumber !== expectedNumber) {
        actions.push({
          action: 'RENUMBER',
          sessionId: session.id,
          classId,
          className,
          date: session.date,
          sessionNumber: session.sessionNumber,
          newSessionNumber: expectedNumber,
          reason: `Renumber from ${session.sessionNumber} to ${expectedNumber}`,
          hasAttendance: !!session.attendanceId
        });
        totalToRenumber++;
      }
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('📊 FIX SUMMARY');
  console.log('='.repeat(60));
  console.log(`Sessions to DELETE: ${totalToDelete}`);
  console.log(`Sessions to RENUMBER: ${totalToRenumber}`);
  console.log();

  // Group actions by class for display
  const actionsByClass = new Map<string, FixAction[]>();
  actions.forEach(a => {
    const existing = actionsByClass.get(a.className) || [];
    existing.push(a);
    actionsByClass.set(a.className, existing);
  });

  for (const [className, classActions] of actionsByClass) {
    const deletes = classActions.filter(a => a.action === 'DELETE');
    const renumbers = classActions.filter(a => a.action === 'RENUMBER');
    console.log(`\n📘 ${className}:`);
    console.log(`   DELETE: ${deletes.length}, RENUMBER: ${renumbers.length}`);

    // Show first few actions
    deletes.slice(0, 3).forEach(a => {
      console.log(`   🗑️ Delete session ${a.sessionNumber} (${a.date})${a.hasAttendance ? ' ⚠️ HAS ATTENDANCE!' : ''}`);
    });
    if (deletes.length > 3) console.log(`   ... and ${deletes.length - 3} more deletes`);
  }

  // Check for dangerous actions (deleting sessions with attendance)
  const dangerousDeletes = actions.filter(a => a.action === 'DELETE' && a.hasAttendance);
  if (dangerousDeletes.length > 0) {
    console.log('\n⚠️⚠️⚠️ WARNING: About to delete sessions WITH ATTENDANCE ⚠️⚠️⚠️');
    dangerousDeletes.forEach(a => {
      console.log(`   - ${a.className} | ${a.date} | Session #${a.sessionNumber}`);
    });
    console.log('\nThese sessions have attendance records linked. Proceed with caution!');
  }

  // Execute if not dry run
  if (!dryRun) {
    console.log('\n⏳ Executing fixes...\n');

    const batch = db.batch();
    let batchCount = 0;

    for (const action of actions) {
      const docRef = db.collection('classSessions').doc(action.sessionId);

      if (action.action === 'DELETE') {
        batch.delete(docRef);
      } else if (action.action === 'RENUMBER' && action.newSessionNumber !== undefined) {
        batch.update(docRef, {
          sessionNumber: action.newSessionNumber,
          updatedAt: new Date().toISOString()
        });
      }

      batchCount++;

      // Commit every 400 operations (Firestore limit is 500)
      if (batchCount >= 400) {
        await batch.commit();
        console.log(`   Committed ${batchCount} operations...`);
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   Committed final ${batchCount} operations`);
    }

    console.log('\n✅ Fix completed!');
  } else {
    console.log('\n📝 DRY RUN - No changes made');
    console.log('Run with --fix to apply changes');
  }

  // Save action log
  const logPath = join(__dirname, `../plans/reports/fix-sessions-log-${new Date().toISOString().slice(0,10)}.json`);
  writeFileSync(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun,
    totalDelete: totalToDelete,
    totalRenumber: totalToRenumber,
    dangerousDeletes: dangerousDeletes.length,
    actions
  }, null, 2));
  console.log(`\n📄 Action log saved: ${logPath}`);
}

// Parse args
const args = process.argv.slice(2);
const dryRun = !args.includes('--fix');

if (args.includes('--help')) {
  console.log(`
Usage: npx tsx scripts/fix-duplicate-sessions.ts [options]

Options:
  --dry-run   Show what would be changed (default)
  --fix       Actually apply the fixes
  --help      Show this help
`);
  process.exit(0);
}

fixDuplicateSessions(dryRun)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
