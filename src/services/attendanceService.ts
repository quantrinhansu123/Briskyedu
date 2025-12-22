/**
 * Attendance Service
 * Handle attendance CRUD operations with Firestore
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AttendanceRecord, StudentAttendance, AttendanceStatus, StudentStatus } from '../../types';

const ATTENDANCE_COLLECTION = 'attendance';
const STUDENT_ATTENDANCE_COLLECTION = 'studentAttendance';
const TUTORING_COLLECTION = 'tutoring';

/**
 * Create attendance record for a class session
 */
export const createAttendanceRecord = async (
  data: Omit<AttendanceRecord, 'id'>
): Promise<string> => {
  try {
    const recordData = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), recordData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating attendance record:', error);
    throw new Error('Không thể tạo bản ghi điểm danh');
  }
};

/**
 * Get attendance record by ID
 */
export const getAttendanceRecord = async (id: string): Promise<AttendanceRecord | null> => {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return { id: docSnap.id, ...docSnap.data() } as AttendanceRecord;
  } catch (error) {
    console.error('Error getting attendance record:', error);
    throw new Error('Không thể tải bản ghi điểm danh');
  }
};

/**
 * Get attendance records with optional filters
 */
export const getAttendanceRecords = async (filters?: {
  classId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceRecord[]> => {
  try {
    const constraints: QueryConstraint[] = [orderBy('date', 'desc')];
    
    if (filters?.classId) {
      constraints.unshift(where('classId', '==', filters.classId));
    }
    
    if (filters?.date) {
      constraints.unshift(where('date', '==', filters.date));
    }
    
    const q = query(collection(db, ATTENDANCE_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    
    let records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as AttendanceRecord));
    
    // Client-side date range filter
    if (filters?.startDate) {
      records = records.filter(r => r.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      records = records.filter(r => r.date <= filters.endDate!);
    }
    
    return records;
  } catch (error) {
    console.error('Error getting attendance records:', error);
    throw new Error('Không thể tải danh sách điểm danh');
  }
};

/**
 * Check if attendance already exists for class + date
 */
export const checkExistingAttendance = async (
  classId: string,
  date: string
): Promise<AttendanceRecord | null> => {
  try {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('classId', '==', classId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as AttendanceRecord;
  } catch (error) {
    console.error('Error checking existing attendance:', error);
    throw new Error('Lỗi kiểm tra điểm danh');
  }
};

/**
 * Save student attendance details
 */
export const saveStudentAttendance = async (
  attendanceId: string,
  students: Omit<StudentAttendance, 'id' | 'attendanceId'>[],
  classId?: string,
  className?: string,
  date?: string,
  sessionNumber?: number,
  sessionId?: string
): Promise<void> => {
  try {
    console.log('[saveStudentAttendance] Starting...', { attendanceId, studentsCount: students.length });
    
    if (students.length === 0) {
      console.warn('[saveStudentAttendance] No students to save!');
      return;
    }
    
    const batch = writeBatch(db);
    
    // Delete existing records for this attendance
    const existingQuery = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('attendanceId', '==', attendanceId)
    );
    const existingDocs = await getDocs(existingQuery);
    console.log('[saveStudentAttendance] Deleting existing:', existingDocs.size);
    existingDocs.docs.forEach(d => batch.delete(d.ref));
    
    // Add new records with extended fields
    console.log('[saveStudentAttendance] Adding', students.length, 'new records...');
    students.forEach((student, i) => {
      const docRef = doc(collection(db, STUDENT_ATTENDANCE_COLLECTION));
      
      // Build record, excluding undefined values (Firestore doesn't accept undefined)
      const record: Record<string, unknown> = {
        studentId: student.studentId,
        studentName: student.studentName,
        studentCode: student.studentCode,
        status: student.status,
        attendanceId,
        classId: classId || null,
        className: className || null,
        date: date || null,
        sessionNumber: sessionNumber || null,
        sessionId: sessionId || null,
        createdAt: new Date().toISOString(),
      };
      
      // Add optional fields only if they have values
      if (student.note) record.note = student.note;
      if (student.homeworkCompletion !== undefined) record.homeworkCompletion = student.homeworkCompletion;
      if (student.testName) record.testName = student.testName;
      if (student.score !== undefined) record.score = student.score;
      if (student.bonusPoints !== undefined) record.bonusPoints = student.bonusPoints;
      if (student.punctuality) record.punctuality = student.punctuality;
      if (student.isLate !== undefined) record.isLate = student.isLate;
      
      batch.set(docRef, record);
    });
    
    console.log('[saveStudentAttendance] Committing batch...');
    try {
      await batch.commit();
      console.log('[saveStudentAttendance] Batch committed successfully!');
    } catch (commitError) {
      console.error('[saveStudentAttendance] Batch commit failed:', commitError);
      throw commitError;
    }
    console.log('[saveStudentAttendance] Saved', students.length, 'students');
  } catch (error) {
    console.error('[saveStudentAttendance] Error:', error);
    throw new Error('Không thể lưu điểm danh học sinh');
  }
};

/**
 * Get student attendance for a record
 */
export const getStudentAttendance = async (
  attendanceId: string
): Promise<StudentAttendance[]> => {
  try {
    const q = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('attendanceId', '==', attendanceId)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as StudentAttendance));
  } catch (error) {
    console.error('Error getting student attendance:', error);
    throw new Error('Không thể tải điểm danh chi tiết');
  }
};

/**
 * Update attendance record summary
 */
export const updateAttendanceRecord = async (
  id: string,
  data: Partial<AttendanceRecord>
): Promise<void> => {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating attendance record:', error);
    throw new Error('Không thể cập nhật bản ghi điểm danh');
  }
};

/**
 * Delete attendance record and related student records
 */
export const deleteAttendanceRecord = async (id: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    // Delete main record
    batch.delete(doc(db, ATTENDANCE_COLLECTION, id));
    
    // Delete related student attendance
    const studentQuery = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('attendanceId', '==', id)
    );
    const studentDocs = await getDocs(studentQuery);
    studentDocs.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
  } catch (error) {
    console.error('Error deleting attendance record:', error);
    throw new Error('Không thể xóa bản ghi điểm danh');
  }
};

/**
 * Create tutoring record for absent student (auto-create khi vắng)
 */
export const createTutoringFromAbsent = async (data: {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  absentDate: string;
  type: 'Nghỉ học' | 'Học yếu';
}): Promise<string> => {
  try {
    const tutoringData = {
      ...data,
      status: 'Chưa bồi',
      scheduledDate: null,
      tutor: null,
      note: `Vắng buổi học ngày ${new Date(data.absentDate).toLocaleDateString('vi-VN')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const docRef = await addDoc(collection(db, TUTORING_COLLECTION), tutoringData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating tutoring record:', error);
    throw new Error('Không thể tạo lịch bồi bài');
  }
};

/**
 * Count student's attended sessions for a specific class
 */
export const countStudentAttendedSessions = async (
  studentId: string,
  classId: string
): Promise<number> => {
  try {
    const q = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      where('status', 'in', [AttendanceStatus.ON_TIME, AttendanceStatus.LATE])
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error counting attended sessions:', error);
    return 0;
  }
};

/**
 * Check and update student debt status
 * If attendedSessions === registeredSessions => status = "Đã học hết phí"
 * If attendedSessions > registeredSessions => status = "Nợ phí"
 */
export const checkAndUpdateStudentDebtStatus = async (
  studentId: string,
  classId: string
): Promise<void> => {
  try {
    // Get student data
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) return;

    const studentData = studentSnap.data();
    const registeredSessions = studentData.registeredSessions || 0;
    const currentStatus = studentData.status;

    // Skip if student has already dropped, reserved, or is in trial
    const skipStatuses = [StudentStatus.DROPPED, StudentStatus.RESERVED, StudentStatus.TRIAL];
    if (skipStatuses.includes(currentStatus)) return;

    // Count attended sessions from attendance records
    const countedAttended = await countStudentAttendedSessions(studentId, classId);
    const currentAttended = studentData.attendedSessions || 0;

    // Use MAX of current and counted (never decrease, handles legacy data)
    const attendedSessions = Math.max(currentAttended, countedAttended);

    // Calculate remaining sessions
    const remainingSessions = registeredSessions - attendedSessions;

    // Always update attendedSessions and remainingSessions fields
    await updateDoc(studentRef, { attendedSessions, remainingSessions });

    // Check status based on remaining sessions
    if (registeredSessions > 0) {
      if (remainingSessions < 0) {
        // Negative remaining = "Nợ phí" (debt)
        if (currentStatus !== StudentStatus.DEBT) {
          await updateDoc(studentRef, {
            status: StudentStatus.DEBT,
            debtStartDate: new Date().toISOString(),
            debtSessions: Math.abs(remainingSessions)
          });
          console.log(`[checkDebtStatus] Student ${studentId} status changed to "Nợ phí" (attended: ${attendedSessions}, registered: ${registeredSessions}, remaining: ${remainingSessions})`);
        } else {
          // Already in debt, just update debtSessions
          await updateDoc(studentRef, {
            debtSessions: Math.abs(remainingSessions)
          });
        }
      } else if (remainingSessions === 0 && currentStatus === StudentStatus.ACTIVE) {
        // Exactly 0 remaining = "Đã học hết phí"
        await updateDoc(studentRef, {
          status: StudentStatus.EXPIRED_FEE
        });
        console.log(`[checkDebtStatus] Student ${studentId} status changed to "Đã học hết phí" (attended: ${attendedSessions}, registered: ${registeredSessions})`);
      }
    }
  } catch (error) {
    console.error('Error checking student debt status:', error);
  }
};

/**
 * Full attendance save with auto tutoring creation
 */
export const saveFullAttendance = async (
  attendanceData: Omit<AttendanceRecord, 'id'> & { sessionId?: string },
  students: Array<{
    studentId: string;
    studentName: string;
    studentCode: string;
    status: AttendanceStatus;
    note?: string;
    homeworkCompletion?: number;
    testName?: string;
    score?: number;
    bonusPoints?: number;
    punctuality?: 'onTime' | 'late' | '';
    isLate?: boolean;
  }>
): Promise<string> => {
  try {
    console.log('[saveFullAttendance] Input students:', students.length);
    console.log('[saveFullAttendance] Student statuses:', students.map(s => ({ name: s.studentName, status: s.status })));
    
    // Filter out students with PENDING status (not yet marked)
    const markedStudents = students.filter(s => s.status && s.status !== AttendanceStatus.PENDING);
    console.log('[saveFullAttendance] Marked students after filter:', markedStudents.length);
    
    // Calculate summary from marked students only (ON_TIME + LATE = present)
    const present = markedStudents.filter(s => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE).length;
    const absent = markedStudents.filter(s => s.status === AttendanceStatus.ABSENT).length;
    const reserved = markedStudents.filter(s => s.status === AttendanceStatus.RESERVED).length;
    const tutored = markedStudents.filter(s => s.status === AttendanceStatus.TUTORED).length;
    
    // Check existing
    const existing = await checkExistingAttendance(attendanceData.classId, attendanceData.date);
    
    let attendanceId: string;
    
    if (existing) {
      // Update existing
      await updateAttendanceRecord(existing.id, {
        ...attendanceData,
        present,
        absent,
        reserved,
        tutored,
        status: 'Đã điểm danh',
      });
      attendanceId = existing.id;
    } else {
      // Create new
      attendanceId = await createAttendanceRecord({
        ...attendanceData,
        present,
        absent,
        reserved,
        tutored,
        status: 'Đã điểm danh',
      });
    }
    
    // Save student attendance with extended fields for monthly report (only marked students)
    console.log('[saveFullAttendance] Saving student attendance...');
    await saveStudentAttendance(
      attendanceId, 
      markedStudents, 
      attendanceData.classId,
      attendanceData.className,
      attendanceData.date,
      attendanceData.sessionNumber,
      attendanceData.sessionId
    );
    console.log('[saveFullAttendance] Student attendance saved!');
    
    // Auto create tutoring for absent students
    const absentStudents = markedStudents.filter(s => s.status === AttendanceStatus.ABSENT);
    console.log('[saveFullAttendance] Creating tutoring for', absentStudents.length, 'absent students...');
    for (const student of absentStudents) {
      await createTutoringFromAbsent({
        studentId: student.studentId,
        studentName: student.studentName,
        classId: attendanceData.classId,
        className: attendanceData.className,
        absentDate: attendanceData.date,
        type: 'Nghỉ học',
      });
    }
    console.log('[saveFullAttendance] Tutoring created!');
    
    // Check and update debt status for present students (ON_TIME or LATE)
    const presentStudents = markedStudents.filter(s => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE);
    console.log('[saveFullAttendance] Checking debt for', presentStudents.length, 'present students...');
    for (const student of presentStudents) {
      await checkAndUpdateStudentDebtStatus(student.studentId, attendanceData.classId);
    }
    
    console.log('[saveFullAttendance] All done! Returning attendanceId:', attendanceId);
    return attendanceId;
  } catch (error) {
    console.error('Error saving full attendance:', error);
    throw new Error('Không thể lưu điểm danh');
  }
};

/**
 * Manually recalculate student's attended sessions and update status
 * Used to fix existing data or trigger status update manually
 */
export const recalculateStudentStatus = async (
  studentId: string,
  classId: string
): Promise<{ attended: number; registered: number; remaining: number; newStatus: string }> => {
  try {
    // Get student data
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      throw new Error('Không tìm thấy học viên');
    }

    const studentData = studentSnap.data();
    const registeredSessions = studentData.registeredSessions || 0;
    const currentAttended = studentData.attendedSessions || 0;

    // Count attended sessions from studentAttendance collection
    const countedAttended = await countStudentAttendedSessions(studentId, classId);

    // Use MAX of current value and counted value (never decrease attendance)
    // This handles cases where historical attendance wasn't saved in studentAttendance collection
    const attendedSessions = Math.max(currentAttended, countedAttended);
    const remainingSessions = registeredSessions - attendedSessions;

    console.log(`[recalculateStudentStatus] Student ${studentId}: current=${currentAttended}, counted=${countedAttended}, using=${attendedSessions}, registered=${registeredSessions}, remaining=${remainingSessions}`);

    // Determine new status
    let newStatus = studentData.status;
    const updateData: Record<string, unknown> = {
      attendedSessions,
      remainingSessions, // Also update remainingSessions for UI display
    };

    if (registeredSessions > 0) {
      if (remainingSessions < 0) {
        newStatus = StudentStatus.DEBT;
        updateData.status = StudentStatus.DEBT;
        updateData.debtSessions = Math.abs(remainingSessions);
        if (!studentData.debtStartDate) {
          updateData.debtStartDate = new Date().toISOString();
        }
      } else if (remainingSessions === 0) {
        newStatus = StudentStatus.EXPIRED_FEE;
        updateData.status = StudentStatus.EXPIRED_FEE;
      } else {
        // Still has remaining sessions - status should be ACTIVE
        if (studentData.status === StudentStatus.EXPIRED_FEE || studentData.status === StudentStatus.DEBT) {
          newStatus = StudentStatus.ACTIVE;
          updateData.status = StudentStatus.ACTIVE;
        }
      }
    }

    // Update student
    await updateDoc(studentRef, updateData);

    return {
      attended: attendedSessions,
      registered: registeredSessions,
      remaining: remainingSessions,
      newStatus,
    };
  } catch (error) {
    console.error('Error recalculating student status:', error);
    throw error;
  }
};
