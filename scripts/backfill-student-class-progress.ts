/**
 * Backfill Student Class Progress
 *
 * Aggregates studentAttendance records to compute classProgress for each student.
 *
 * Usage:
 *   npx tsx scripts/backfill-student-class-progress.ts --dry-run   # Preview
 *   npx tsx scripts/backfill-student-class-progress.ts --execute   # Apply
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error('Error: Firebase config not found.');
  process.exit(1);
}

console.log(`Connecting to: ${firebaseConfig.projectId}`);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PRESENT_STATUSES = ['Có mặt', 'Đã bồi', 'Đến trễ'];
const ABSENT_STATUSES = ['Vắng', 'Vắng không phép', 'Nghỉ'];

interface ClassProgress {
  registeredSessions: number;
  attendedSessions: number;
  absentSessions: number;
  makeupOwed: number;
  makeupDone: number;
  reservedSessions: number;
}

async function backfillClassProgress(dryRun: boolean) {
  console.log(`\n=== Backfill Student Class Progress (${dryRun ? 'DRY RUN' : 'EXECUTE'}) ===\n`);

  // 1. Get all studentAttendance records
  const attendanceSnap = await getDocs(collection(db, 'studentAttendance'));
  console.log(`Found ${attendanceSnap.size} studentAttendance records`);

  // 2. Aggregate by studentId + classId
  const progressMap: Map<string, Map<string, ClassProgress>> = new Map();

  for (const doc of attendanceSnap.docs) {
    const data = doc.data();
    const studentId = data.studentId;
    const classId = data.classId;
    const status = data.status;
    const hasSessionId = !!data.sessionId;

    if (!studentId || !classId || status === 'LỊCH NGHỈ CHUNG') continue;

    if (!progressMap.has(studentId)) {
      progressMap.set(studentId, new Map());
    }
    const studentProgress = progressMap.get(studentId)!;

    if (!studentProgress.has(classId)) {
      studentProgress.set(classId, {
        registeredSessions: 0,
        attendedSessions: 0,
        absentSessions: 0,
        makeupOwed: 0,
        makeupDone: 0,
        reservedSessions: 0
      });
    }
    const progress = studentProgress.get(classId)!;

    const isPresent = PRESENT_STATUSES.includes(status);
    const isAbsent = ABSENT_STATUSES.includes(status);
    const isMakeup = !hasSessionId;

    if (isPresent) {
      if (isMakeup) {
        progress.makeupDone++;
      } else {
        progress.attendedSessions++;
      }
    } else if (isAbsent && !isMakeup) {
      progress.absentSessions++;
      progress.makeupOwed++;
    }
  }

  // 3. Get registered sessions from enrollments
  const enrollmentsSnap = await getDocs(collection(db, 'enrollments'));
  for (const doc of enrollmentsSnap.docs) {
    const data = doc.data();
    const studentId = data.studentId;
    const classId = data.classId;
    const sessions = data.sessions || 0;

    if (!studentId || !classId) continue;

    if (!progressMap.has(studentId)) {
      progressMap.set(studentId, new Map());
    }
    const studentProgress = progressMap.get(studentId)!;

    if (!studentProgress.has(classId)) {
      studentProgress.set(classId, {
        registeredSessions: 0,
        attendedSessions: 0,
        absentSessions: 0,
        makeupOwed: 0,
        makeupDone: 0,
        reservedSessions: 0
      });
    }
    studentProgress.get(classId)!.registeredSessions += sessions;
  }

  // 4. Recalculate makeupOwed (absent - makeupDone)
  for (const [, studentProgress] of progressMap) {
    for (const [, progress] of studentProgress) {
      progress.makeupOwed = Math.max(0, progress.absentSessions - progress.makeupDone);
    }
  }

  // 5. Update students
  let updated = 0;
  for (const [studentId, studentProgress] of progressMap) {
    const classProgressObj: Record<string, ClassProgress> = {};
    for (const [classId, progress] of studentProgress) {
      classProgressObj[classId] = progress;
    }

    console.log(`Student ${studentId}: ${studentProgress.size} classes`);
    for (const [classId, progress] of studentProgress) {
      console.log(`  ${classId}: attended=${progress.attendedSessions}, absent=${progress.absentSessions}, makeupOwed=${progress.makeupOwed}`);
    }

    if (!dryRun) {
      try {
        await updateDoc(doc(db, 'students', studentId), { classProgress: classProgressObj });
        updated++;
      } catch (err) {
        console.error(`  Error updating ${studentId}:`, err);
      }
    } else {
      updated++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Students processed: ${progressMap.size}`);
  console.log(`${dryRun ? 'Would update' : 'Updated'}: ${updated}`);
}

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--execute');

if (dryRun && !args.includes('--dry-run')) {
  console.log('Tip: Use --execute to apply changes, --dry-run to preview.');
}

backfillClassProgress(dryRun).then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
