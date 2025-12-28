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
import { Holiday, ClassModel, AttendanceRecord } from '../../types';

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
      return allClasses.filter(c => c.status === 'Đang hoạt động');

    case 'specific_classes':
      return allClasses.filter(c => holiday.classIds?.includes(c.id));

    case 'specific_branch':
      return allClasses.filter(c =>
        c.branch === holiday.branch && c.status === 'Đang hoạt động'
      );

    default:
      return [];
  }
}

/**
 * Check if attendance record already exists for a class on a date
 */
async function checkExistingRecord(
  classId: string,
  date: string
): Promise<boolean> {
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('classId', '==', classId),
    where('date', '==', date)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Apply holiday - Create attendance records for all affected classes/dates
 *
 * IMPORTANT: Holiday records are created with status "LỊCH NGHỈ CHUNG" and:
 * - totalStudents, present, absent = 0 (no student attendance data)
 * - Do NOT create studentAttendance records (prevents session counting)
 * - Cloud Functions skip records with this status (see studentAttendanceTriggers.ts)
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

  let created = 0;
  let skipped = 0;

  // Process each class/date combination
  for (const cls of affectedClasses) {
    for (const date of dates) {
      // Check if record already exists - don't overwrite
      const exists = await checkExistingRecord(cls.id, date);
      if (exists) {
        skipped++;
        continue;
      }

      // Create batch for this record
      const batch = writeBatch(db);
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      batch.set(recordRef, recordData);
      await batch.commit();
      created++;
    }
  }

  return { created, skipped };
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
