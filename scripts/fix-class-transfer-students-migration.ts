/**
 * Fix Class Transfer Bug - Data Migration Script
 *
 * Script này tìm và fix những students đã bị ảnh hưởng bởi bug chuyển lớp:
 * - Khi chuyển lớp, attendedSessions không được reset về 0
 * - Gây ra attendedSessions > registeredSessions → trạng thái "Nợ phí" sai
 *
 * Logic:
 * 1. Tìm tất cả enrollments có type='Chuyển lớp'
 * 2. Với mỗi student có transfers:
 *    - Kiểm tra nếu attendedSessions > registeredSessions (debt condition sai)
 *    - Reset attendedSessions về 0 cho lớp hiện tại
 *    - Init classProgress nếu chưa có
 *
 * Usage:
 *   npx tsx scripts/fix-class-transfer-students-migration.ts --dry-run   # Preview changes
 *   npx tsx scripts/fix-class-transfer-students-migration.ts --execute   # Apply changes
 *
 * NOTE: Script này cần Firestore security rules cho phép read/write.
 * Có thể cần chạy với Firebase emulator hoặc tạm thời mở rules trong dev environment.
 * Hoặc sử dụng Firebase Admin SDK với service account để bypass security rules.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where, writeBatch } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Firebase config từ .env.local
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error('Error: Firebase config not found. Make sure .env.local exists.');
  process.exit(1);
}

console.log(`Connecting to: ${firebaseConfig.projectId}`);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// TypeScript interfaces
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
  class?: string;
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
  currentClassId: string;
  registered: number;
  attended: number;
  issue: string;
  enrollments: EnrollmentRecord[];
}

/**
 * Tìm students có transfers và bị ảnh hưởng bởi bug
 */
async function findAffectedStudents(): Promise<AffectedStudent[]> {
  console.log('\n📋 Finding students with class transfers...');

  // Step 1: Query enrollments với type = 'Chuyển lớp'
  const enrollQ = query(
    collection(db, 'enrollments'),
    where('type', '==', 'Chuyển lớp')
  );
  const enrollSnap = await getDocs(enrollQ);
  console.log(`   Found ${enrollSnap.size} transfer enrollment records`);

  if (enrollSnap.empty) {
    console.log('   No transfer enrollments found.');
    return [];
  }

  // Step 2: Group by studentId
  const transfersByStudent = new Map<string, EnrollmentRecord[]>();
  for (const docSnap of enrollSnap.docs) {
    const data = docSnap.data() as Omit<EnrollmentRecord, 'id'>;
    const record: EnrollmentRecord = { ...data, id: docSnap.id };
    const list = transfersByStudent.get(record.studentId) || [];
    list.push(record);
    transfersByStudent.set(record.studentId, list);
  }
  console.log(`   ${transfersByStudent.size} unique students have transfers`);

  // Step 3: Fetch and check each student
  const affected: AffectedStudent[] = [];
  const studentsSnap = await getDocs(collection(db, 'students'));
  const studentsMap = new Map<string, Student>();
  for (const docSnap of studentsSnap.docs) {
    const data = docSnap.data() as Omit<Student, 'id'>;
    studentsMap.set(docSnap.id, { ...data, id: docSnap.id });
  }

  for (const [studentId, enrollments] of transfersByStudent) {
    const student = studentsMap.get(studentId);
    if (!student) {
      console.log(`   ⚠️ Student ${studentId} not found (may have been deleted)`);
      continue;
    }

    const registered = student.registeredSessions || 0;
    const attended = student.attendedSessions || 0;

    // Check if in incorrect debt state (attended > registered after transfer)
    if (attended > registered) {
      affected.push({
        id: studentId,
        fullName: student.fullName,
        currentClassId: student.classId || '',
        registered,
        attended,
        issue: `attended(${attended}) > registered(${registered}) = debt of ${attended - registered} sessions`,
        enrollments
      });
    }
  }

  return affected;
}

/**
 * Build correct classProgress for a student
 */
function buildCorrectClassProgress(
  student: Student,
  enrollments: EnrollmentRecord[]
): Record<string, ClassProgress> {
  const progress: Record<string, ClassProgress> = { ...student.classProgress };

  // Sort enrollments by date (oldest first)
  const sorted = [...enrollments].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });

  // Latest transfer = current class
  const latestTransfer = sorted[sorted.length - 1];
  const currentClassId = student.classId || latestTransfer.classId;

  // Init current class with 0 attended (Cloud Functions sẽ fill từ attendance)
  if (currentClassId) {
    progress[currentClassId] = {
      registeredSessions: student.registeredSessions || latestTransfer.sessions || 0,
      attendedSessions: 0, // Reset!
      absentSessions: 0,
      makeupOwed: 0,
      makeupDone: 0,
      reservedSessions: 0
    };
  }

  return progress;
}

/**
 * Fix affected students
 */
async function fixAffectedStudents(
  affected: AffectedStudent[],
  dryRun: boolean
): Promise<void> {
  console.log(`\n${dryRun ? '🔍 [DRY RUN]' : '🔧 [EXECUTE]'} Fixing ${affected.length} students...\n`);

  if (affected.length === 0) {
    console.log('✅ No students need fixing!');
    return;
  }

  // Display affected students
  console.log('Affected students:');
  console.log('─'.repeat(80));
  for (const a of affected) {
    console.log(`  📛 ${a.fullName} (${a.id})`);
    console.log(`     Current class: ${a.currentClassId || 'N/A'}`);
    console.log(`     Issue: ${a.issue}`);
    console.log(`     Transfers: ${a.enrollments.length}`);
    console.log('');
  }
  console.log('─'.repeat(80));

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes made.');
    console.log('   Run with --execute to apply changes.');
    return;
  }

  // Apply fixes using batch writes with fresh data fetch
  const BATCH_SIZE = 400; // Firestore limit is 500
  let batchCount = 0;
  let batch = writeBatch(db);

  for (const affectedStudent of affected) {
    // Fetch fresh student data to avoid stale writes (Cloud Functions may have modified)
    const studentDocSnap = await getDocs(
      query(collection(db, 'students'), where('__name__', '==', affectedStudent.id))
    );
    if (studentDocSnap.empty) {
      console.log(`   ⚠️ Skipping ${affectedStudent.id} - not found`);
      continue;
    }
    const studentData = studentDocSnap.docs[0].data() as Omit<Student, 'id'>;
    const student: Student = { ...studentData, id: affectedStudent.id };

    const correctProgress = buildCorrectClassProgress(student, affectedStudent.enrollments);

    batch.update(doc(db, 'students', affectedStudent.id), {
      attendedSessions: 0,          // Reset legacy field
      classProgress: correctProgress // Set correct classProgress
    });

    batchCount++;

    // Commit batch if reaching limit
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   ✓ Committed batch of ${batchCount} updates`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ✓ Committed final batch of ${batchCount} updates`);
  }

  console.log(`\n✅ Successfully fixed ${affected.length} students!`);
}

/**
 * Main entry point
 */
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('   Fix Class Transfer Bug - Data Migration Script');
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  // Parse CLI args
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || !args.includes('--execute');

  if (!args.includes('--dry-run') && !args.includes('--execute')) {
    console.log('\n⚠️  No mode specified. Defaulting to --dry-run for safety.');
    console.log('   Use --execute to apply changes.');
  }

  console.log(`\nMode: ${dryRun ? 'DRY RUN (preview only)' : 'EXECUTE (will modify data)'}`);

  try {
    const affected = await findAffectedStudents();
    console.log(`\n📊 Found ${affected.length} affected students`);

    await fixAffectedStudents(affected, dryRun);

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('   Migration Complete!');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    process.exit(1);
  }
}

main();
