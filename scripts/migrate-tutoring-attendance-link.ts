/**
 * Migration: Link existing tutoring records to studentAttendance
 *
 * This script backfills the studentAttendanceId field for existing tutoring records
 * by finding the matching studentAttendance record based on studentId, classId, and absentDate.
 *
 * Run: npx tsx scripts/migrate-tutoring-attendance-link.ts
 * Or:  npx vite-node scripts/migrate-tutoring-attendance-link.ts
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  limit
} from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Dry run mode - set to false to actually update records
const DRY_RUN = process.argv.includes('--dry-run');

interface TutoringRecord {
  id: string;
  studentId?: string;
  classId?: string;
  absentDate?: string;
  studentName?: string;
  studentAttendanceId?: string;
  deletedAt?: string | null;
  statusHistory?: Array<{
    status: string;
    changedAt: string;
    changedBy: string;
  }>;
}

/**
 * Find studentAttendance record by student, class, and date
 */
async function findStudentAttendance(
  studentId: string,
  classId: string,
  date: string
): Promise<string | null> {
  try {
    const q = query(
      collection(db, 'studentAttendance'),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      where('date', '==', date),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : snapshot.docs[0].id;
  } catch (error) {
    console.error(`  Error finding attendance for ${studentId}/${classId}/${date}:`, error);
    return null;
  }
}

/**
 * Main migration function
 */
async function migrateTutoringRecords() {
  console.log('\n========================================');
  console.log('Tutoring → StudentAttendance Link Migration');
  console.log('========================================');

  if (DRY_RUN) {
    console.log('\n*** DRY RUN MODE - No changes will be made ***\n');
  }

  console.log('Fetching all tutoring records...');
  const tutoringSnapshot = await getDocs(collection(db, 'tutoring'));
  console.log(`Found ${tutoringSnapshot.size} tutoring records\n`);

  let stats = {
    total: tutoringSnapshot.size,
    alreadyLinked: 0,
    updated: 0,
    missingFields: 0,
    notFound: 0,
    errors: 0
  };

  for (const docSnap of tutoringSnapshot.docs) {
    const data = docSnap.data() as TutoringRecord;
    const id = docSnap.id;

    // Skip if already has studentAttendanceId
    if (data.studentAttendanceId) {
      stats.alreadyLinked++;
      continue;
    }

    // Skip if missing required fields
    if (!data.studentId || !data.classId || !data.absentDate) {
      console.log(`[SKIP] ${id}: Missing studentId/classId/absentDate`);
      stats.missingFields++;
      continue;
    }

    // Find matching studentAttendance
    const attendanceId = await findStudentAttendance(
      data.studentId,
      data.classId,
      data.absentDate
    );

    if (attendanceId) {
      if (!DRY_RUN) {
        try {
          const now = new Date().toISOString();

          // Build update data
          const updateData: Record<string, any> = {
            studentAttendanceId: attendanceId,
            updatedAt: now
          };

          // Add deletedAt: null if not present (for soft delete filtering)
          if (data.deletedAt === undefined) {
            updateData.deletedAt = null;
          }

          // Initialize statusHistory if not present
          if (!data.statusHistory) {
            updateData.statusHistory = [{
              status: 'Migrated',
              changedAt: now,
              changedBy: 'migration-script'
            }];
          }

          await updateDoc(doc(db, 'tutoring', id), updateData);
          console.log(`[OK] ${id} → ${attendanceId} (${data.studentName})`);
        } catch (error) {
          console.error(`[ERROR] ${id}: Failed to update`, error);
          stats.errors++;
          continue;
        }
      } else {
        console.log(`[DRY] ${id} → ${attendanceId} (${data.studentName})`);
      }
      stats.updated++;
    } else {
      console.log(`[NOT FOUND] ${id}: No attendance for ${data.studentName} on ${data.absentDate}`);
      stats.notFound++;
    }
  }

  // Print summary
  console.log('\n========================================');
  console.log('Migration Summary');
  console.log('========================================');
  console.log(`Total records:     ${stats.total}`);
  console.log(`Already linked:    ${stats.alreadyLinked}`);
  console.log(`Updated:           ${stats.updated}`);
  console.log(`Missing fields:    ${stats.missingFields}`);
  console.log(`Not found:         ${stats.notFound}`);
  console.log(`Errors:            ${stats.errors}`);
  console.log('========================================');

  if (DRY_RUN) {
    console.log('\n*** DRY RUN - Run without --dry-run to apply changes ***');
  }
}

// Run migration
migrateTutoringRecords()
  .then(() => {
    console.log('\nMigration completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nMigration failed:', err);
    process.exit(1);
  });
