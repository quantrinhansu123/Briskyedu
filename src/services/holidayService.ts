/**
 * Holiday Service
 * Handle holiday-related operations including auto-creating attendance records
 */

import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Holiday, ClassModel, AttendanceRecord, ClassStatus } from '../../types';

const ATTENDANCE_COLLECTION = 'attendance';

/**
 * Get all dates in a range (inclusive)
 */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Get affected classes based on holiday apply type
 */
function getAffectedClasses(
  holiday: Holiday,
  allClasses: ClassModel[]
): ClassModel[] {
  switch (holiday.applyType) {
    case 'all_classes':
    case 'all_branches':
      return allClasses.filter(c => c.status === ClassStatus.STUDYING);

    case 'specific_classes':
      return allClasses.filter(c => holiday.classIds?.includes(c.id));

    case 'specific_branch':
      return allClasses.filter(c =>
        c.branch === holiday.branch && c.status === ClassStatus.STUDYING
      );

    default:
      return [];
  }
}

/**
 * Get all existing attendance records for given classes and date range
 * Returns a Set of "classId|date" keys for O(1) lookup
 *
 * Uses date-only query to avoid composite index requirement
 */
async function getExistingRecords(
  classIds: string[],
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const existingKeys = new Set<string>();
  const classIdSet = new Set(classIds);

  // Query by date range only, filter classId in JS (avoids composite index)
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  const snapshot = await getDocs(q);

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // Only include records for our target classes
    if (classIdSet.has(data.classId)) {
      existingKeys.add(`${data.classId}|${data.date}`);
    }
  });

  return existingKeys;
}

/**
 * Apply holiday - Create attendance records for all affected classes/dates
 *
 * IMPORTANT: Holiday records are created with status "LỊCH NGHỈ CHUNG" and:
 * - totalStudents, present, absent = 0 (no student attendance data)
 * - Do NOT create studentAttendance records (prevents session counting)
 * - Cloud Functions skip records with this status (see studentAttendanceTriggers.ts)
 *
 * OPTIMIZED: Batch queries and writes for better performance
 *
 * @param holiday - The holiday to apply
 * @param allClasses - All classes in the system
 * @returns Object with created and skipped counts
 */
export async function applyHoliday(
  holiday: Holiday,
  allClasses: ClassModel[]
): Promise<{ created: number; skipped: number }> {
  const dates = getDateRange(holiday.startDate, holiday.endDate);
  const affectedClasses = getAffectedClasses(holiday, allClasses);

  if (affectedClasses.length === 0 || dates.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Batch check existing records (1 query per 30 classes instead of N queries)
  const classIds = affectedClasses.map(c => c.id);
  const existingKeys = await getExistingRecords(classIds, holiday.startDate, holiday.endDate);

  // Prepare all records to create
  const recordsToCreate: Array<{ cls: ClassModel; date: string }> = [];
  let skipped = 0;

  for (const cls of affectedClasses) {
    for (const date of dates) {
      const key = `${cls.id}|${date}`;
      if (existingKeys.has(key)) {
        skipped++;
      } else {
        recordsToCreate.push({ cls, date });
      }
    }
  }

  // Batch write (max 450 per batch for safety)
  const batchSize = 450;
  const now = new Date().toISOString();

  for (let i = 0; i < recordsToCreate.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = recordsToCreate.slice(i, i + batchSize);

    for (const { cls, date } of chunk) {
      const recordRef = doc(collection(db, ATTENDANCE_COLLECTION));
      const recordData: Omit<AttendanceRecord, 'id'> = {
        classId: cls.id,
        className: cls.name,
        date: date,
        status: 'LỊCH NGHỈ CHUNG',
        holidayId: holiday.id,
        holidayName: holiday.name,
        totalStudents: 0,
        present: 0,
        absent: 0,
        reserved: 0,
        tutored: 0,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
      };
      batch.set(recordRef, recordData);
    }

    await batch.commit();
  }

  return { created: recordsToCreate.length, skipped };
}

/**
 * Unapply holiday - Delete all auto-created attendance records for this holiday
 * @param holidayId - The ID of the holiday to unapply
 * @returns Number of records deleted
 */
export async function unapplyHoliday(holidayId: string): Promise<number> {
  // Find all records created by this holiday
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('holidayId', '==', holidayId)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return 0;

  // Delete records in batches (max 500 per batch)
  let deleted = 0;
  const batchSize = 450;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + batchSize);

    for (const docSnap of chunk) {
      batch.delete(docSnap.ref);
      deleted++;
    }

    await batch.commit();
  }

  return deleted;
}
