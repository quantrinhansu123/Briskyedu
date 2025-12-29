/**
 * Tutoring Service
 * Handle tutoring CRUD operations with Firestore
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AttendanceStatus } from '../../types';

const TUTORING_COLLECTION = 'tutoring';

// Types
export type TutoringType = 'Nghỉ học' | 'Học yếu';
export type TutoringStatus =
  | 'Chưa bồi'
  | 'Đã hẹn'
  | 'Đã bồi'
  | 'Nghỉ tính phí'  // NEW: Student refused, still charged
  | 'Nghỉ bảo lưu'   // NEW: Valid reason, course extended
  | 'Hủy';

// Status history entry for audit trail
export interface TutoringStatusHistoryEntry {
  status: TutoringStatus;
  changedAt: string;
  changedBy: string;
  reason?: string;
}

export interface TutoringData {
  id?: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  type: TutoringType;
  status: TutoringStatus;

  // Link to original attendance date
  absentDate?: string;

  // Direct link to studentAttendance record (NEW)
  studentAttendanceId?: string;

  // Scheduling
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  tutor?: string | null;
  tutorName?: string | null;

  // Completion
  completedAt?: string;
  completedBy?: string;  // NEW: Who marked as complete

  // Charged absence reason (NEW: for Nghỉ tính phí)
  chargedReason?: string;

  // Soft delete (NEW)
  deletedAt?: string | null;
  deletedBy?: string | null;

  // Audit trail (NEW)
  statusHistory?: TutoringStatusHistoryEntry[];

  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Terminal statuses that can be undone
const TERMINAL_STATUSES: TutoringStatus[] = ['Đã bồi', 'Nghỉ tính phí', 'Nghỉ bảo lưu'];

/**
 * Create new tutoring record
 */
export const createTutoring = async (data: Omit<TutoringData, 'id'>): Promise<string> => {
  try {
    const now = new Date().toISOString();
    const tutoringData = {
      ...data,
      status: data.status || 'Chưa bồi',
      deletedAt: null,
      statusHistory: data.statusHistory || [{
        status: data.status || 'Chưa bồi',
        changedAt: now,
        changedBy: 'system',
        reason: 'Created'
      }],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, TUTORING_COLLECTION), tutoringData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating tutoring:', error);
    throw new Error('Không thể tạo lịch bồi bài');
  }
};

/**
 * Get tutoring by ID
 */
export const getTutoring = async (id: string): Promise<TutoringData | null> => {
  try {
    const docRef = doc(db, TUTORING_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    return { id: docSnap.id, ...docSnap.data() } as TutoringData;
  } catch (error) {
    console.error('Error getting tutoring:', error);
    throw new Error('Không thể tải thông tin bồi bài');
  }
};

/**
 * Get tutoring records with filters
 * By default, excludes soft-deleted records
 */
export const getTutoringList = async (filters?: {
  type?: TutoringType;
  status?: TutoringStatus;
  studentId?: string;
  classId?: string;
  includeDeleted?: boolean;  // NEW: Include soft-deleted records
  onlyDeleted?: boolean;     // NEW: Only show deleted (for trash view)
}): Promise<TutoringData[]> => {
  try {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    if (filters?.type) {
      constraints.unshift(where('type', '==', filters.type));
    }

    if (filters?.status) {
      constraints.unshift(where('status', '==', filters.status));
    }

    if (filters?.studentId) {
      constraints.unshift(where('studentId', '==', filters.studentId));
    }

    if (filters?.classId) {
      constraints.unshift(where('classId', '==', filters.classId));
    }

    const q = query(collection(db, TUTORING_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    let results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as TutoringData));

    // Filter deleted records (client-side to avoid composite index)
    if (filters?.onlyDeleted) {
      results = results.filter(r => r.deletedAt !== null && r.deletedAt !== undefined);
    } else if (!filters?.includeDeleted) {
      results = results.filter(r => !r.deletedAt);
    }

    return results;
  } catch (error) {
    console.error('Error getting tutoring list:', error);
    throw new Error('Không thể tải danh sách bồi bài');
  }
};

/**
 * Update tutoring record
 */
export const updateTutoring = async (id: string, data: Partial<TutoringData>): Promise<void> => {
  try {
    const docRef = doc(db, TUTORING_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating tutoring:', error);
    throw new Error('Không thể cập nhật lịch bồi bài');
  }
};

/**
 * Schedule tutoring session
 */
export const scheduleTutoring = async (
  id: string,
  date: string,
  time: string,
  tutorId: string,
  tutorName: string,
  userId?: string
): Promise<void> => {
  try {
    const tutoring = await getTutoring(id);
    if (!tutoring) throw new Error('Tutoring record not found');

    const now = new Date().toISOString();
    const historyEntry: TutoringStatusHistoryEntry = {
      status: 'Đã hẹn',
      changedAt: now,
      changedBy: userId || 'system'
    };

    await updateTutoring(id, {
      scheduledDate: date,
      scheduledTime: time,
      tutor: tutorId,
      tutorName: tutorName,
      status: 'Đã hẹn',
      statusHistory: [...(tutoring.statusHistory || []), historyEntry],
    });
  } catch (error) {
    console.error('Error scheduling tutoring:', error);
    throw new Error('Không thể đặt lịch bồi bài');
  }
};

/**
 * Mark tutoring as completed (Đã bồi)
 * Also updates the linked studentAttendance to trigger Cloud Function
 */
export const completeTutoring = async (
  id: string,
  userId: string,
  note?: string
): Promise<void> => {
  try {
    console.log('completeTutoring called with id:', id);

    // Get tutoring record
    const tutoring = await getTutoring(id);
    if (!tutoring) throw new Error('Tutoring record not found');

    const now = new Date().toISOString();
    const docRef = doc(db, TUTORING_COLLECTION, id);

    const historyEntry: TutoringStatusHistoryEntry = {
      status: 'Đã bồi',
      changedAt: now,
      changedBy: userId,
    };

    // Update tutoring record
    await updateDoc(docRef, {
      status: 'Đã bồi',
      completedAt: now,
      completedBy: userId,
      ...(note && { note }),
      statusHistory: [...(tutoring.statusHistory || []), historyEntry],
      updatedAt: now,
    });

    // Update linked studentAttendance if exists
    if (tutoring.studentAttendanceId) {
      await updateStudentAttendanceStatusInternal(
        tutoring.studentAttendanceId,
        AttendanceStatus.TUTORED
      );
      console.log('Updated studentAttendance to Đã bồi');
    } else if (tutoring.absentDate && tutoring.studentId && tutoring.classId) {
      // Fallback: Find and update by query
      const attendance = await findStudentAttendanceRecordInternal(
        tutoring.studentId,
        tutoring.classId,
        tutoring.absentDate
      );
      if (attendance) {
        await updateStudentAttendanceStatusInternal(attendance.id, AttendanceStatus.TUTORED);
        // Also update tutoring with the found ID
        await updateDoc(docRef, { studentAttendanceId: attendance.id });
        console.log('Found and updated studentAttendance');
      }
    }

    console.log('completeTutoring success');
  } catch (error: any) {
    console.error('Error completing tutoring:', error);
    throw new Error(`Không thể hoàn thành bồi bài: ${error?.message || 'Unknown'}`);
  }
};

/**
 * Mark tutoring as charged absence (Nghỉ tính phí)
 * Student refused to come - still charged for the missed session
 * Does NOT update studentAttendance - stays as "Vắng"
 */
export const markChargedAbsence = async (
  id: string,
  userId: string,
  reason: string
): Promise<void> => {
  if (!reason || reason.trim().length === 0) {
    throw new Error('Lý do nghỉ tính phí là bắt buộc');
  }

  try {
    const tutoring = await getTutoring(id);
    if (!tutoring) throw new Error('Tutoring record not found');

    const now = new Date().toISOString();
    const docRef = doc(db, TUTORING_COLLECTION, id);

    const historyEntry: TutoringStatusHistoryEntry = {
      status: 'Nghỉ tính phí',
      changedAt: now,
      changedBy: userId,
      reason: reason.trim()
    };

    await updateDoc(docRef, {
      status: 'Nghỉ tính phí',
      chargedReason: reason.trim(),
      completedAt: now,
      completedBy: userId,
      statusHistory: [...(tutoring.statusHistory || []), historyEntry],
      updatedAt: now,
    });

    // Note: studentAttendance stays as "Vắng" - session is counted as used
    console.log('markChargedAbsence success');
  } catch (error: any) {
    console.error('Error marking charged absence:', error);
    throw new Error(`Không thể đánh dấu nghỉ tính phí: ${error?.message || 'Unknown'}`);
  }
};

/**
 * Mark tutoring as reserved absence (Nghỉ bảo lưu)
 * Student has valid reason - NOT charged, course end date extends
 */
export const markReservedAbsence = async (
  id: string,
  userId: string,
  note?: string
): Promise<void> => {
  try {
    const tutoring = await getTutoring(id);
    if (!tutoring) throw new Error('Tutoring record not found');

    const now = new Date().toISOString();
    const docRef = doc(db, TUTORING_COLLECTION, id);

    const historyEntry: TutoringStatusHistoryEntry = {
      status: 'Nghỉ bảo lưu',
      changedAt: now,
      changedBy: userId,
      reason: note
    };

    // Update tutoring record
    await updateDoc(docRef, {
      status: 'Nghỉ bảo lưu',
      completedAt: now,
      completedBy: userId,
      ...(note && { note }),
      statusHistory: [...(tutoring.statusHistory || []), historyEntry],
      updatedAt: now,
    });

    // Update studentAttendance to "Bảo lưu"
    if (tutoring.studentAttendanceId) {
      await updateStudentAttendanceStatusInternal(
        tutoring.studentAttendanceId,
        AttendanceStatus.RESERVED
      );
    } else if (tutoring.absentDate && tutoring.studentId && tutoring.classId) {
      const attendance = await findStudentAttendanceRecordInternal(
        tutoring.studentId,
        tutoring.classId,
        tutoring.absentDate
      );
      if (attendance) {
        await updateStudentAttendanceStatusInternal(attendance.id, AttendanceStatus.RESERVED);
        await updateDoc(docRef, { studentAttendanceId: attendance.id });
      }
    }

    // Extend student's expectedEndDate
    await extendStudentCourse(tutoring.studentId, tutoring.classId);

    console.log('markReservedAbsence success');
  } catch (error: any) {
    console.error('Error marking reserved absence:', error);
    throw new Error(`Không thể đánh dấu nghỉ bảo lưu: ${error?.message || 'Unknown'}`);
  }
};

/**
 * Undo tutoring completion - revert to "Đã hẹn"
 * Only Admin/Manager can call this (check in UI)
 */
export const undoTutoring = async (
  id: string,
  userId: string
): Promise<void> => {
  try {
    const tutoring = await getTutoring(id);
    if (!tutoring) throw new Error('Tutoring record not found');

    const previousStatus = tutoring.status;

    // Only allow undo from terminal states
    if (!TERMINAL_STATUSES.includes(previousStatus)) {
      throw new Error('Chỉ có thể hoàn tác từ trạng thái đã hoàn thành');
    }

    const now = new Date().toISOString();
    const docRef = doc(db, TUTORING_COLLECTION, id);

    const historyEntry: TutoringStatusHistoryEntry = {
      status: 'Đã hẹn',
      changedAt: now,
      changedBy: userId,
      reason: `Hoàn tác từ "${previousStatus}"`
    };

    // Update tutoring record
    await updateDoc(docRef, {
      status: 'Đã hẹn',
      completedAt: null,
      completedBy: null,
      chargedReason: null,
      statusHistory: [...(tutoring.statusHistory || []), historyEntry],
      updatedAt: now,
    });

    // Revert studentAttendance based on previous status
    if (previousStatus === 'Đã bồi' || previousStatus === 'Nghỉ bảo lưu') {
      // Revert to "Vắng"
      if (tutoring.studentAttendanceId) {
        await updateStudentAttendanceStatusInternal(
          tutoring.studentAttendanceId,
          AttendanceStatus.ABSENT
        );
      }
    }

    // If was "Nghỉ bảo lưu", expectedEndDate is NOT automatically reverted
    // This would require storing the extension amount - log warning for manual adjustment
    if (previousStatus === 'Nghỉ bảo lưu') {
      console.warn('Undo from Nghỉ bảo lưu - expectedEndDate NOT reverted automatically');
    }

    console.log('undoTutoring success');
  } catch (error: any) {
    console.error('Error undoing tutoring:', error);
    throw new Error(`Không thể hoàn tác: ${error?.message || 'Unknown'}`);
  }
};

/**
 * Soft delete tutoring record
 */
export const softDeleteTutoring = async (
  id: string,
  userId: string
): Promise<void> => {
  try {
    const docRef = doc(db, TUTORING_COLLECTION, id);
    await updateDoc(docRef, {
      deletedAt: new Date().toISOString(),
      deletedBy: userId,
      updatedAt: new Date().toISOString(),
    });
    console.log('softDeleteTutoring success');
  } catch (error: any) {
    console.error('Error soft deleting tutoring:', error);
    throw new Error(`Không thể xóa: ${error?.message || 'Unknown'}`);
  }
};

/**
 * Restore soft-deleted tutoring record
 */
export const restoreTutoring = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, TUTORING_COLLECTION, id);
    await updateDoc(docRef, {
      deletedAt: null,
      deletedBy: null,
      updatedAt: new Date().toISOString(),
    });
    console.log('restoreTutoring success');
  } catch (error: any) {
    console.error('Error restoring tutoring:', error);
    throw new Error(`Không thể khôi phục: ${error?.message || 'Unknown'}`);
  }
};

/**
 * Cancel tutoring
 */
export const cancelTutoring = async (
  id: string,
  reason?: string,
  userId?: string
): Promise<void> => {
  try {
    const tutoring = await getTutoring(id);
    if (!tutoring) throw new Error('Tutoring record not found');

    const now = new Date().toISOString();
    const historyEntry: TutoringStatusHistoryEntry = {
      status: 'Hủy',
      changedAt: now,
      changedBy: userId || 'system',
      reason
    };

    await updateTutoring(id, {
      status: 'Hủy',
      note: reason,
      statusHistory: [...(tutoring.statusHistory || []), historyEntry],
    });
  } catch (error) {
    console.error('Error canceling tutoring:', error);
    throw new Error('Không thể hủy lịch bồi bài');
  }
};

/**
 * Delete tutoring record (hard delete - use softDeleteTutoring instead)
 * @deprecated Use softDeleteTutoring instead
 */
export const deleteTutoring = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, TUTORING_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting tutoring:', error);
    throw new Error('Không thể xóa lịch bồi bài');
  }
};

// ============================================
// Internal Helper Functions
// ============================================

const STUDENT_ATTENDANCE_COLLECTION = 'studentAttendance';

/**
 * Find studentAttendance record by student, class, and date
 * Internal function - used to link tutoring with original attendance
 */
async function findStudentAttendanceRecordInternal(
  studentId: string,
  classId: string,
  date: string
): Promise<{ id: string; status: AttendanceStatus } | null> {
  try {
    const q = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const docData = snapshot.docs[0];
    return {
      id: docData.id,
      status: docData.data().status as AttendanceStatus
    };
  } catch (error) {
    console.error('Error finding student attendance:', error);
    return null;
  }
}

/**
 * Update a single studentAttendance record status
 * Internal function
 */
async function updateStudentAttendanceStatusInternal(
  id: string,
  status: AttendanceStatus
): Promise<void> {
  try {
    const docRef = doc(db, STUDENT_ATTENDANCE_COLLECTION, id);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating student attendance status:', error);
    throw new Error('Không thể cập nhật trạng thái điểm danh');
  }
}

/**
 * Get days per week from class schedule string
 */
function getDaysPerWeekFromSchedule(schedule?: string): number {
  if (!schedule) return 2;

  const dayPatterns = [
    /thứ\s*[2-7]/gi,
    /t[2-7]/gi,
    /chủ\s*nhật/gi,
    /cn/gi,
  ];

  let dayCount = 0;
  for (const pattern of dayPatterns) {
    const matches = schedule.match(pattern);
    if (matches) dayCount += matches.length;
  }

  return Math.max(dayCount, 1);
}

/**
 * Extend student's expectedEndDate by one session worth of days
 */
async function extendStudentCourse(
  studentId: string,
  classId: string
): Promise<void> {
  try {
    // Get class schedule
    const classDoc = await getDoc(doc(db, 'classes', classId));
    const classData = classDoc.data();
    const daysPerWeek = getDaysPerWeekFromSchedule(classData?.schedule);

    // Calculate extension (1 session = 7/daysPerWeek days)
    const extensionDays = Math.ceil(7 / daysPerWeek);

    // Get student
    const studentDoc = await getDoc(doc(db, 'students', studentId));
    if (!studentDoc.exists()) return;

    const studentData = studentDoc.data();
    const currentEndDate = studentData?.expectedEndDate
      ? new Date(studentData.expectedEndDate)
      : new Date();

    // Add extension days
    currentEndDate.setDate(currentEndDate.getDate() + extensionDays);

    await updateDoc(doc(db, 'students', studentId), {
      expectedEndDate: currentEndDate.toISOString().split('T')[0]
    });

    console.log(`Extended student ${studentId} expectedEndDate by ${extensionDays} days`);
  } catch (error) {
    console.error('Error extending student course:', error);
    // Don't throw - this is a side effect, tutoring status still updated
  }
}

// Export helper functions for external use
export {
  findStudentAttendanceRecordInternal as findStudentAttendanceRecord,
  updateStudentAttendanceStatusInternal as updateStudentAttendanceStatus,
  getDaysPerWeekFromSchedule,
  TERMINAL_STATUSES
};
