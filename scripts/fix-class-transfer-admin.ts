/**
 * Fix Class Transfer Bug - Admin SDK Version
 *
 * Sử dụng Firebase Admin SDK để bypass security rules.
 * Yêu cầu: GOOGLE_APPLICATION_CREDENTIALS env var hoặc đang chạy trên GCP.
 *
 * Usage:
 *   npx tsx scripts/fix-class-transfer-admin.ts --dry-run
 *   npx tsx scripts/fix-class-transfer-admin.ts --execute
 */

import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();
console.log(`Connected to: ${process.env.VITE_FIREBASE_PROJECT_ID}`);

interface ClassProgress {
  registeredSessions: number;
  attendedSessions: number;
  absentSessions: number;
  makeupOwed: number;
  makeupDone: number;
  reservedSessions: number;
}

interface Student {
  id: string;
  fullName: string;
  classId?: string;
  registeredSessions?: number;
  attendedSessions?: number;
  classProgress?: Record<string, ClassProgress>;
}

interface EnrollmentRecord {
  id: string;
  studentId: string;
  classId: string;
  type: string;
  sessions?: number;
  createdAt?: string;
}

interface AffectedStudent {
  id: string;
  fullName: string;
  registered: number;
  attended: number;
  issue: string;
  enrollments: EnrollmentRecord[];
}

async function findAffectedStudents(): Promise<AffectedStudent[]> {
  console.log('\n📋 Finding students with class transfers...');

  const enrollSnap = await db.collection('enrollments')
    .where('type', '==', 'Chuyển lớp')
    .get();

  console.log(`   Found ${enrollSnap.size} transfer records`);
  if (enrollSnap.empty) return [];

  // Group by student
  const transfersByStudent = new Map<string, EnrollmentRecord[]>();
  for (const doc of enrollSnap.docs) {
    const data = doc.data() as Omit<EnrollmentRecord, 'id'>;
    const record = { ...data, id: doc.id };
    const list = transfersByStudent.get(record.studentId) || [];
    list.push(record);
    transfersByStudent.set(record.studentId, list);
  }
  console.log(`   ${transfersByStudent.size} students have transfers`);

  // Check each student
  const affected: AffectedStudent[] = [];
  for (const [studentId, enrollments] of transfersByStudent) {
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) continue;

    const student = { id: studentDoc.id, ...studentDoc.data() } as Student;
    const registered = student.registeredSessions || 0;
    const attended = student.attendedSessions || 0;

    if (attended > registered) {
      affected.push({
        id: studentId,
        fullName: student.fullName,
        registered,
        attended,
        issue: `attended(${attended}) > registered(${registered})`,
        enrollments
      });
    }
  }

  return affected;
}

function buildCorrectClassProgress(
  student: Student,
  enrollments: EnrollmentRecord[]
): Record<string, ClassProgress> {
  const progress: Record<string, ClassProgress> = { ...student.classProgress };
  const currentClassId = student.classId;

  if (currentClassId) {
    progress[currentClassId] = {
      registeredSessions: student.registeredSessions || 0,
      attendedSessions: 0,
      absentSessions: 0,
      makeupOwed: 0,
      makeupDone: 0,
      reservedSessions: 0
    };
  }

  return progress;
}

const PRESENT_STATUSES = ['Có mặt', 'Đúng giờ', 'Đến trễ', 'Đã bồi'];

async function fixAffectedStudents(affected: AffectedStudent[], dryRun: boolean): Promise<void> {
  console.log(`\n${dryRun ? '🔍 [DRY RUN]' : '🔧 [EXECUTE]'} ${affected.length} students\n`);

  if (affected.length === 0) {
    console.log('✅ No students need fixing!');
    return;
  }

  // Display and prepare fixes
  const fixes: { id: string; name: string; oldAttended: number; correctAttended: number }[] = [];

  for (const a of affected) {
    const studentDoc = await db.collection('students').doc(a.id).get();
    if (!studentDoc.exists) continue;

    const student = { id: studentDoc.id, ...studentDoc.data() } as Student;
    const currentClassId = student.classId;

    // Đếm số buổi thực tế từ studentAttendance (source of truth)
    let correctAttended = 0;
    if (currentClassId) {
      const attendanceSnap = await db.collection('studentAttendance')
        .where('studentId', '==', a.id)
        .where('classId', '==', currentClassId)
        .get();

      correctAttended = attendanceSnap.docs.filter(d =>
        PRESENT_STATUSES.includes(d.data().status)
      ).length;
    }

    console.log(`  📛 ${a.fullName} (${a.id})`);
    console.log(`     Current classId: ${currentClassId}`);
    console.log(`     Legacy attendedSessions: ${a.attended} (SAI)`);
    console.log(`     Actual attendance records: ${correctAttended} (ĐÚNG)`);
    console.log(`     → Fix: set attendedSessions = ${correctAttended}\n`);

    fixes.push({ id: a.id, name: a.fullName, oldAttended: a.attended, correctAttended });
  }

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes. Use --execute to apply.');
    return;
  }

  // Apply fixes
  const batch = db.batch();
  for (const fix of fixes) {
    batch.update(db.collection('students').doc(fix.id), {
      attendedSessions: fix.correctAttended
    });
  }

  await batch.commit();
  console.log(`\n✅ Fixed ${fixes.length} students!`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   Fix Class Transfer Bug - Admin SDK');
  console.log('═══════════════════════════════════════════════════════════════');

  const dryRun = !process.argv.includes('apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);

  try {
    const affected = await findAffectedStudents();
    console.log(`\n📊 Found ${affected.length} affected students`);
    await fixAffectedStudents(affected, dryRun);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
