/**
 * WorkSession utilities for teacher change cascade
 * Handles cancelling old teacher's sessions and creating new ones
 */

import * as admin from 'firebase-admin';
import { executeBatch, BatchOperation } from './batchUtils';

const db = admin.firestore();

/**
 * Cancel workSessions chưa xác nhận của GV cũ từ effectiveDate trở đi.
 * Giữ nguyên workSessions đã xác nhận (lịch sử lương đúng).
 */
export async function cancelOldTeacherWorkSessions(
  classId: string,
  oldTeacherName: string,
  effectiveDate: string, // YYYY-MM-DD
  type: 'Dạy chính' | 'Trợ giảng' | 'Dạy thay'
): Promise<{ cancelled: number; keptConfirmed: number }> {
  const snapshot = await db.collection('workSessions')
    .where('classId', '==', classId)
    .where('staffName', '==', oldTeacherName)
    .where('type', '==', type)
    .where('date', '>=', effectiveDate)
    .get();

  let cancelled = 0;
  let keptConfirmed = 0;
  const operations: BatchOperation[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.status === 'Đã xác nhận') {
      keptConfirmed++;
    } else {
      operations.push({ type: 'delete', ref: doc.ref });
      cancelled++;
    }
  }

  if (operations.length > 0) await executeBatch(operations);
  return { cancelled, keptConfirmed };
}

/**
 * Tạo workSessions cho GV mới từ effectiveDate đến today.
 * Chỉ tạo cho buổi đã học, skip nếu đã có workSession trùng.
 */
export async function createNewTeacherWorkSessions(
  classId: string,
  className: string,
  newTeacherName: string,
  newTeacherId: string | null,
  effectiveDate: string,
  type: 'Dạy chính' | 'Trợ giảng',
  position: string
): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  // Lấy sessions đã học từ effectiveDate đến today
  const sessionsSnapshot = await db.collection('classSessions')
    .where('classId', '==', classId)
    .where('date', '>=', effectiveDate)
    .where('date', '<=', today)
    .where('status', '==', 'Đã học')
    .get();

  if (sessionsSnapshot.empty) return 0;

  // Check existing để avoid duplicate
  const existingWS = await db.collection('workSessions')
    .where('classId', '==', classId)
    .where('staffName', '==', newTeacherName)
    .where('date', '>=', effectiveDate)
    .get();

  const existingDates = new Set(existingWS.docs.map(d => d.data().date));

  const operations: BatchOperation[] = [];

  for (const sessionDoc of sessionsSnapshot.docs) {
    const session = sessionDoc.data();
    if (existingDates.has(session.date)) continue;

    const wsRef = db.collection('workSessions').doc();
    operations.push({
      type: 'set',
      ref: wsRef,
      data: {
        staffId: newTeacherId || null,
        staffName: newTeacherName,
        position: position,
        date: session.date,
        timeStart: session.time?.split('-')[0]?.trim() || '',
        timeEnd: session.time?.split('-')[1]?.trim() || '',
        classId: classId,
        className: className,
        type: type,
        status: 'Chờ xác nhận',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: `Auto: đổi GV từ ${effectiveDate}`,
      },
    });
  }

  if (operations.length > 0) await executeBatch(operations);
  return operations.length;
}
