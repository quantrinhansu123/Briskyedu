/**
 * Student Attendance Triggers
 * 
 * Handles:
 * - Update attendedSessions when student attendance is recorded
 * - Sync data integrity for monthly reports
 * - Update debt status when sessions exceed registered
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();
const REGION = 'asia-southeast1';

// Valid "present" statuses (both current enum values + legacy values for backward compatibility)
const PRESENT_STATUSES = ['Đúng giờ', 'Trễ giờ', 'Đã bồi', 'Có mặt', 'Đến trễ'];

interface StudentAttendanceData {
  attendanceId: string;
  sessionId?: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  classId?: string;
  className?: string;
  date?: string;
  sessionNumber?: number;
  status: string;
  note?: string;
  homeworkCompletion?: number;
  testName?: string;
  score?: number;
  bonusPoints?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface StudentData {
  id?: string;
  fullName: string;
  classId?: string;
  classIds?: string[];
  status: string;
  registeredSessions?: number;
  attendedSessions?: number;
  legacyAttendedSessions?: number;
  makeupSessionsAttended?: number;
  startDate?: string;
  expectedEndDate?: string;
}

interface ClassData {
  id?: string;
  name: string;
  schedule?: string;
}

// ClassProgress interface matching frontend types.ts
interface ClassProgress {
  registeredSessions: number;
  attendedSessions: number;
  absentSessions: number;
  makeupOwed: number;
  makeupDone: number;
  reservedSessions: number;
}

// Absent statuses that count as missed sessions
const ABSENT_STATUSES = ['Vắng', 'Vắng không phép', 'Nghỉ'];

/**
 * Helper: Get or initialize classProgress for a student
 */
function getOrInitClassProgress(
  studentData: StudentData,
  classId: string,
  registeredSessions: number = 0
): ClassProgress {
  const existing = (studentData as any).classProgress?.[classId];
  if (existing) {
    return existing as ClassProgress;
  }
  return {
    registeredSessions,
    attendedSessions: 0,
    absentSessions: 0,
    makeupOwed: 0,
    makeupDone: 0,
    reservedSessions: 0
  };
}

/**
 * Parse schedule to get days per week
 */
function getDaysPerWeek(schedule?: string): number {
  if (!schedule) return 2;

  const dayPatterns = [
    /thứ\s*[2-7]/gi,
    /t[2-7]/gi,
    /chủ\s*nhật/gi,
    /cn/gi,
    /\b[2-7]\b/g
  ];

  let dayCount = 0;
  for (const pattern of dayPatterns) {
    const matches = schedule.match(pattern);
    if (matches) {
      dayCount += matches.length;
    }
  }

  return Math.max(dayCount, 1);
}

/**
 * Calculate expected end date
 */
function calculateExpectedEndDate(
  remainingSessions: number,
  daysPerWeek: number,
  startDate?: string
): string {
  if (remainingSessions <= 0) {
    return new Date().toISOString().split('T')[0];
  }

  const weeksNeeded = Math.ceil(remainingSessions / daysPerWeek);
  const daysNeeded = weeksNeeded * 7;

  const start = startDate ? new Date(startDate) : new Date();
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + daysNeeded);

  return endDate.toISOString().split('T')[0];
}

/**
 * Trigger: When student attendance record is created
 * Actions:
 * - Update student's attendedSessions count
 * - Check and update debt status
 * - Calculate expectedEndDate
 */
export const onStudentAttendanceCreate = functions
  .region(REGION)
  .firestore
  .document('studentAttendance/{docId}')
  .onCreate(async (snap, context) => {
    const docId = context.params.docId;
    const data = snap.data() as StudentAttendanceData;

    console.log(`[onStudentAttendanceCreate] New attendance: ${docId}, student: ${data.studentName}, status: ${data.status}, sessionId: ${data.sessionId || 'null'}`);

    // Skip holiday records - they should not count as attended sessions
    // Holiday records have status "LỊCH NGHỈ CHUNG" and are auto-created by the system
    if (data.status === 'LỊCH NGHỈ CHUNG') {
      console.log(`[onStudentAttendanceCreate] Holiday record detected, skipping session count`);
      return null;
    }

    const isPresent = PRESENT_STATUSES.includes(data.status);
    const isAbsent = ABSENT_STATUSES.includes(data.status);

    console.log(`[onStudentAttendanceCreate] isPresent: ${isPresent}, isAbsent: ${isAbsent}, status: "${data.status}"`);

    // Skip if neither present nor absent (e.g., pending status)
    if (!isPresent && !isAbsent) {
      console.log(`[onStudentAttendanceCreate] Status "${data.status}" is neither present nor absent, skipping`);
      return null;
    }

    const studentId = data.studentId;
    const classId = data.classId;

    // Get student data
    const studentRef = db.collection('students').doc(studentId);
    const studentDoc = await studentRef.get();

    if (!studentDoc.exists) {
      console.log(`[onStudentAttendanceCreate] Student not found: ${studentId}`);
      return null;
    }

    const studentData = studentDoc.data() as StudentData;
    const currentAttended = studentData.attendedSessions || 0;
    const registeredSessions = studentData.registeredSessions || 0;
    const legacyAttended = studentData.legacyAttendedSessions || 0;

    // Phân loại: buổi chính thức (có sessionId) vs buổi học bù (không có sessionId)
    const isSessionAttendance = !!data.sessionId;
    
    console.log(`[onStudentAttendanceCreate] isSessionAttendance: ${isSessionAttendance}, sessionId: ${data.sessionId || 'null'}`);

    // Prepare update data based on attendance type
    const updateData: Record<string, any> = {
      lastAttendanceDate: data.date || new Date().toISOString().split('T')[0]
    };

    // Only update legacy session counts for PRESENT status
    if (isPresent) {
      // CẢ buổi chính thức VÀ học bù đều tính vào attendedSessions
      // Vì học bù cũng là buổi học đã tham gia
      const newAttended = currentAttended + 1;

      // Get class schedule for expected end date calculation
      let daysPerWeek = 2;
      if (classId) {
        const classDoc = await db.collection('classes').doc(classId).get();
        if (classDoc.exists) {
          const classData = classDoc.data() as ClassData;
          daysPerWeek = getDaysPerWeek(classData.schedule);
        }
      }

      // Calculate remaining sessions (can be negative = debt)
      const remaining = registeredSessions - newAttended - legacyAttended;
      const expectedEndDate = calculateExpectedEndDate(
        Math.max(0, remaining),
        daysPerWeek,
        studentData.startDate || data.date
      );

      // Tính vào attendedSessions cho CẢ buổi chính thức và học bù
      updateData.attendedSessions = FieldValue.increment(1);
      updateData.remainingSessions = remaining;
      updateData.expectedEndDate = expectedEndDate;

      // Set startDate if not set and this is first attendance
      if (!studentData.startDate && newAttended === 1) {
        updateData.startDate = data.date || new Date().toISOString().split('T')[0];
      }

      // Check debt/expired status
      if (registeredSessions > 0 && studentData.status === 'Đang học') {
        if ((newAttended + legacyAttended) > registeredSessions) {
          updateData.status = 'Nợ phí';
          updateData.debtStartDate = new Date().toISOString();
          updateData.debtSessions = (newAttended + legacyAttended) - registeredSessions;
          console.log(`[onStudentAttendanceCreate] Student ${studentId} changed to "Nợ phí" (attended: ${newAttended}, legacy: ${legacyAttended}, registered: ${registeredSessions})`);
        } else if ((newAttended + legacyAttended) === registeredSessions) {
          updateData.status = 'Đã học hết phí';
          updateData.debtSessions = 0;
          console.log(`[onStudentAttendanceCreate] Student ${studentId} changed to "Đã học hết phí" (attended: ${newAttended}, registered: ${registeredSessions})`);
        }
      }

      // Track makeup separately for reporting, but still count toward attendedSessions
      if (!isSessionAttendance) {
        // Buổi học bù → cũng tính makeupSessionsAttended để tracking
        const currentMakeup = studentData.makeupSessionsAttended || 0;
        updateData.makeupSessionsAttended = FieldValue.increment(1);
        console.log(`[onStudentAttendanceCreate] Makeup attendance for ${studentId} - counted in attendedSessions, makeup total: ${currentMakeup + 1}`);
      } else {
        console.log(`[onStudentAttendanceCreate] Session attendance - Updated student ${studentId}: attended=${newAttended}, remaining=${remaining}`);
      }
    }
    // Note: For absent status, we don't update legacy fields - only classProgress

    // === Phase 3.2: Update classProgress[classId] ===
    if (classId) {
      const progress = getOrInitClassProgress(studentData, classId, registeredSessions);
      const isMakeup = !data.sessionId; // No sessionId = makeup attendance

      if (isPresent) {
        if (isMakeup) {
          // Makeup + present → increment makeupDone, decrement makeupOwed
          progress.makeupDone++;
          progress.makeupOwed = Math.max(0, progress.makeupOwed - 1);
        } else {
          // Regular session + present → increment attendedSessions
          progress.attendedSessions++;
        }
      } else if (isAbsent && !isMakeup) {
        // Absent on regular session → increment absent + makeupOwed
        progress.absentSessions++;
        progress.makeupOwed++;
      }
      // Bảo lưu status handled separately if needed

      updateData[`classProgress.${classId}`] = progress;
      console.log(`[onStudentAttendanceCreate] classProgress[${classId}]:`, progress);
    }

    await studentRef.update(updateData);

    return null;
  });

/**
 * Trigger: When student attendance record is updated
 * Actions:
 * - Recalculate attendedSessions if status changed
 * - Sync grade data
 */
export const onStudentAttendanceUpdate = functions
  .region(REGION)
  .firestore
  .document('studentAttendance/{docId}')
  .onUpdate(async (change, context) => {
    const docId = context.params.docId;
    const before = change.before.data() as StudentAttendanceData;
    const after = change.after.data() as StudentAttendanceData;

    // Skip holiday records - they should not count as attended sessions
    if (after.status === 'LỊCH NGHỈ CHUNG' || before.status === 'LỊCH NGHỈ CHUNG') {
      console.log(`[onStudentAttendanceUpdate] Holiday record detected, skipping session count`);
      return null;
    }

    const wasPresentBefore = PRESENT_STATUSES.includes(before.status);
    const isPresentAfter = PRESENT_STATUSES.includes(after.status);

    // If status didn't change between present/absent, nothing to update
    if (wasPresentBefore === isPresentAfter) {
      console.log(`[onStudentAttendanceUpdate] Status category unchanged for ${docId}, skipping`);
      return null;
    }

    console.log(`[onStudentAttendanceUpdate] Status changed: ${before.status} → ${after.status}`);

    const studentId = after.studentId;
    const classId = after.classId;

    // Get student data
    const studentRef = db.collection('students').doc(studentId);
    const studentDoc = await studentRef.get();

    if (!studentDoc.exists) {
      console.log(`[onStudentAttendanceUpdate] Student not found: ${studentId}`);
      return null;
    }

    const studentData = studentDoc.data() as StudentData;
    const currentAttended = studentData.attendedSessions || 0;
    const registeredSessions = studentData.registeredSessions || 0;
    const legacyAttended = studentData.legacyAttendedSessions || 0;

    // Phân loại: buổi chính thức vs buổi học bù
    const isSessionAttendance = !!after.sessionId;

    // Prepare update based on attendance type
    const updateData: Record<string, any> = {};

    // CẢ buổi chính thức VÀ học bù đều tính vào attendedSessions
    // Vì học bù cũng là buổi học đã tham gia
    let attendedIncrement: number;
    let newAttended: number;
    if (isPresentAfter && !wasPresentBefore) {
      attendedIncrement = 1;
      newAttended = currentAttended + 1;
    } else {
      attendedIncrement = -1;
      newAttended = Math.max(0, currentAttended - 1);
    }

    // Get class schedule
    let daysPerWeek = 2;
    if (classId) {
      const classDoc = await db.collection('classes').doc(classId).get();
      if (classDoc.exists) {
        const classData = classDoc.data() as ClassData;
        daysPerWeek = getDaysPerWeek(classData.schedule);
      }
    }

    // Calculate remaining sessions (can be negative = debt)
    const remaining = registeredSessions - newAttended - legacyAttended;
    const expectedEndDate = calculateExpectedEndDate(Math.max(0, remaining), daysPerWeek, studentData.startDate);

    // Tính vào attendedSessions cho CẢ buổi chính thức và học bù
    updateData.attendedSessions = FieldValue.increment(attendedIncrement);
    updateData.remainingSessions = remaining;
    updateData.expectedEndDate = expectedEndDate;

    // Check debt status
    if (registeredSessions > 0 && (newAttended + legacyAttended) > registeredSessions && studentData.status === 'Đang học') {
      updateData.status = 'Nợ phí';
      updateData.debtStartDate = new Date().toISOString();
      updateData.debtSessions = (newAttended + legacyAttended) - registeredSessions;
    } else if ((newAttended + legacyAttended) <= registeredSessions && studentData.status === 'Nợ phí') {
      updateData.status = 'Đang học';
      updateData.debtSessions = admin.firestore.FieldValue.delete();
    }

    // Track makeup separately for reporting
    if (!isSessionAttendance) {
      // Buổi học bù → cũng tính makeupSessionsAttended để tracking
      let makeupIncrement: number;
      if (isPresentAfter && !wasPresentBefore) {
        makeupIncrement = 1;
      } else {
        makeupIncrement = -1;
      }
      updateData.makeupSessionsAttended = FieldValue.increment(makeupIncrement);
      console.log(`[onStudentAttendanceUpdate] Makeup attendance - Updated student ${studentId}: attended=${newAttended}, makeup increment=${makeupIncrement}`);
    } else {
      console.log(`[onStudentAttendanceUpdate] Session attendance - Updated student ${studentId}: attended=${newAttended}`);
    }

    // === Phase 3.2: Update classProgress[classId] ===
    if (classId) {
      const progress = getOrInitClassProgress(studentData, classId, registeredSessions);
      const isMakeup = !after.sessionId;
      const wasAbsentBefore = ABSENT_STATUSES.includes(before.status);
      const isAbsentAfter = ABSENT_STATUSES.includes(after.status);

      // Handle status change: absent ↔ present
      if (isPresentAfter && !wasPresentBefore) {
        // Changed to present
        if (isMakeup) {
          progress.makeupDone++;
          progress.makeupOwed = Math.max(0, progress.makeupOwed - 1);
        } else {
          progress.attendedSessions++;
          if (wasAbsentBefore) {
            progress.absentSessions = Math.max(0, progress.absentSessions - 1);
            progress.makeupOwed = Math.max(0, progress.makeupOwed - 1);
          }
        }
      } else if (!isPresentAfter && wasPresentBefore) {
        // Changed from present to absent/other
        if (isMakeup) {
          progress.makeupDone = Math.max(0, progress.makeupDone - 1);
          if (isAbsentAfter) progress.makeupOwed++;
        } else {
          progress.attendedSessions = Math.max(0, progress.attendedSessions - 1);
          if (isAbsentAfter) {
            progress.absentSessions++;
            progress.makeupOwed++;
          }
        }
      }

      updateData[`classProgress.${classId}`] = progress;
      console.log(`[onStudentAttendanceUpdate] classProgress[${classId}]:`, progress);
    }

    await studentRef.update(updateData);

    return null;
  });

/**
 * Trigger: When student attendance record is deleted
 * Actions:
 * - Decrement attendedSessions if was present
 * - Update classProgress
 */
export const onStudentAttendanceDelete = functions
  .region(REGION)
  .firestore
  .document('studentAttendance/{docId}')
  .onDelete(async (snap, context) => {
    const docId = context.params.docId;
    const data = snap.data() as StudentAttendanceData;

    console.log(`[onStudentAttendanceDelete] Attendance deleted: ${docId}`);

    // Skip holiday records - they should not count as attended sessions
    if (data.status === 'LỊCH NGHỈ CHUNG') {
      console.log(`[onStudentAttendanceDelete] Holiday record detected, skipping session count`);
      return null;
    }

    const wasPresent = PRESENT_STATUSES.includes(data.status);
    const wasAbsent = ABSENT_STATUSES.includes(data.status);

    // Skip if neither present nor absent
    if (!wasPresent && !wasAbsent) {
      return null;
    }

    const studentId = data.studentId;
    const classId = data.classId;
    const studentRef = db.collection('students').doc(studentId);
    const studentDoc = await studentRef.get();

    if (!studentDoc.exists) {
      return null;
    }

    const studentData = studentDoc.data() as StudentData;
    const isSessionAttendance = !!data.sessionId;
    const updateData: Record<string, any> = {};

    // Update legacy fields
    // CẢ buổi chính thức VÀ học bù đều tính vào attendedSessions
    // Khi xóa, cũng giảm attendedSessions cho cả hai loại
    if (wasPresent) {
      updateData.attendedSessions = FieldValue.increment(-1);

      // Recalculate remainingSessions and debt status
      const currentAttended = studentData.attendedSessions || 0;
      const registeredSessions = studentData.registeredSessions || 0;
      const legacyAttended = studentData.legacyAttendedSessions || 0;
      const newAttended = Math.max(0, currentAttended - 1);
      const remaining = registeredSessions - newAttended - legacyAttended;
      updateData.remainingSessions = remaining;

      // Restore status if no longer in debt
      if (remaining > 0 && studentData.status === 'Nợ phí') {
        updateData.status = 'Đang học';
        updateData.debtSessions = 0;
      } else if (remaining === 0 && studentData.status === 'Nợ phí') {
        updateData.status = 'Đã học hết phí';
        updateData.debtSessions = 0;
      } else if (remaining < 0) {
        updateData.debtSessions = Math.abs(remaining);
      }

      // Track makeup separately for reporting
      if (!isSessionAttendance) {
        updateData.makeupSessionsAttended = FieldValue.increment(-1);
        console.log(`[onStudentAttendanceDelete] Makeup attendance - Decremented attended and makeup for student ${studentId}, remaining=${remaining}`);
      } else {
        console.log(`[onStudentAttendanceDelete] Session attendance - Decremented attended for student ${studentId}, remaining=${remaining}`);
      }
    }

    // === Phase 3.2: Update classProgress[classId] ===
    if (classId) {
      const progress = getOrInitClassProgress(studentData, classId, studentData.registeredSessions || 0);

      if (wasPresent) {
        if (isSessionAttendance) {
          progress.attendedSessions = Math.max(0, progress.attendedSessions - 1);
        } else {
          // Makeup was done, now undone → decrement makeupDone, increment makeupOwed
          progress.makeupDone = Math.max(0, progress.makeupDone - 1);
          progress.makeupOwed++;
        }
      } else if (wasAbsent && isSessionAttendance) {
        // Was absent, now deleted → decrement absent + makeupOwed
        progress.absentSessions = Math.max(0, progress.absentSessions - 1);
        progress.makeupOwed = Math.max(0, progress.makeupOwed - 1);
      }

      updateData[`classProgress.${classId}`] = progress;
      console.log(`[onStudentAttendanceDelete] classProgress[${classId}]:`, progress);
    }

    await studentRef.update(updateData);

    return null;
  });

/**
 * Trigger: When attendance main record is deleted
 * Actions:
 * - Delete all related studentAttendance records
 */
export const onAttendanceRecordDelete = functions
  .region(REGION)
  .firestore
  .document('attendance/{attendanceId}')
  .onDelete(async (snap, context) => {
    const attendanceId = context.params.attendanceId;

    console.log(`[onAttendanceRecordDelete] Attendance record deleted: ${attendanceId}`);

    // Find and delete all related student attendance records
    const studentAttendanceSnap = await db.collection('studentAttendance')
      .where('attendanceId', '==', attendanceId)
      .get();

    if (studentAttendanceSnap.empty) {
      console.log(`[onAttendanceRecordDelete] No student attendance records found`);
      return null;
    }

    const batch = db.batch();
    studentAttendanceSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`[onAttendanceRecordDelete] Deleted ${studentAttendanceSnap.size} student attendance records`);

    return null;
  });

/**
 * Trigger: When class is deleted
 * Actions:
 * - Delete all related studentAttendance records
 */
export const onClassDeleteStudentAttendance = functions
  .region(REGION)
  .firestore
  .document('classes/{classId}')
  .onDelete(async (snap, context) => {
    const classId = context.params.classId;
    const classData = snap.data();

    console.log(`[onClassDeleteStudentAttendance] Class deleted: ${classData?.name} (${classId})`);

    // Delete all student attendance for this class
    const attendanceSnap = await db.collection('studentAttendance')
      .where('classId', '==', classId)
      .get();

    if (attendanceSnap.empty) {
      return null;
    }

    // Delete in batches of 400
    const batches: admin.firestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let count = 0;

    for (const doc of attendanceSnap.docs) {
      currentBatch.delete(doc.ref);
      count++;

      if (count >= 400) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      batches.push(currentBatch);
    }

    await Promise.all(batches.map(b => b.commit()));
    console.log(`[onClassDeleteStudentAttendance] Deleted ${attendanceSnap.size} student attendance records`);

    return null;
  });
