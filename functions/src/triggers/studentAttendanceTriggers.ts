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

const db = admin.firestore();
const REGION = 'asia-southeast1';

// Valid "present" statuses
const PRESENT_STATUSES = ['Có mặt', 'Đã bồi', 'Đến trễ'];

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
  startDate?: string;
  expectedEndDate?: string;
}

interface ClassData {
  id?: string;
  name: string;
  schedule?: string;
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
    
    console.log(`[onStudentAttendanceCreate] New attendance: ${docId}, student: ${data.studentName}, status: ${data.status}`);

    // Skip holiday records - they should not count as attended sessions
    // Holiday records have status "LỊCH NGHỈ CHUNG" and are auto-created by the system
    if (data.status === 'LỊCH NGHỈ CHUNG') {
      console.log(`[onStudentAttendanceCreate] Holiday record detected, skipping session count`);
      return null;
    }

    // Only process if student was present
    if (!PRESENT_STATUSES.includes(data.status)) {
      console.log(`[onStudentAttendanceCreate] Status "${data.status}" is not present, skipping count update`);
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
    
    // Calculate remaining and expected end date
    const remaining = Math.max(0, registeredSessions - newAttended);
    const expectedEndDate = calculateExpectedEndDate(
      remaining,
      daysPerWeek,
      studentData.startDate || data.date
    );
    
    // Prepare update data
    const updateData: Record<string, any> = {
      attendedSessions: newAttended,
      remainingSessions: remaining,
      expectedEndDate: expectedEndDate,
      lastAttendanceDate: data.date || new Date().toISOString().split('T')[0]
    };
    
    // Set startDate if not set and this is first attendance
    if (!studentData.startDate && newAttended === 1) {
      updateData.startDate = data.date || new Date().toISOString().split('T')[0];
    }
    
    // Check debt status
    if (registeredSessions > 0 && newAttended > registeredSessions && studentData.status === 'Đang học') {
      updateData.status = 'Nợ phí';
      updateData.debtStartDate = new Date().toISOString();
      updateData.debtSessions = newAttended - registeredSessions;
      console.log(`[onStudentAttendanceCreate] Student ${studentId} changed to "Nợ phí" (attended: ${newAttended}, registered: ${registeredSessions})`);
    }
    
    await studentRef.update(updateData);
    console.log(`[onStudentAttendanceCreate] Updated student ${studentId}: attended=${newAttended}, remaining=${remaining}`);
    
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
    
    // Calculate new attended count
    let newAttended: number;
    if (isPresentAfter && !wasPresentBefore) {
      // Changed from absent to present
      newAttended = currentAttended + 1;
    } else {
      // Changed from present to absent
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
    
    // Calculate expected end date
    const remaining = Math.max(0, registeredSessions - newAttended);
    const expectedEndDate = calculateExpectedEndDate(remaining, daysPerWeek, studentData.startDate);
    
    // Prepare update
    const updateData: Record<string, any> = {
      attendedSessions: newAttended,
      remainingSessions: remaining,
      expectedEndDate: expectedEndDate
    };
    
    // Check debt status
    if (registeredSessions > 0 && newAttended > registeredSessions && studentData.status === 'Đang học') {
      updateData.status = 'Nợ phí';
      updateData.debtStartDate = new Date().toISOString();
      updateData.debtSessions = newAttended - registeredSessions;
    } else if (newAttended <= registeredSessions && studentData.status === 'Nợ phí') {
      // Potentially restore to active if no longer in debt
      updateData.status = 'Đang học';
      updateData.debtSessions = admin.firestore.FieldValue.delete();
    }
    
    await studentRef.update(updateData);
    console.log(`[onStudentAttendanceUpdate] Updated student ${studentId}: attended=${newAttended}`);
    
    return null;
  });

/**
 * Trigger: When student attendance record is deleted
 * Actions:
 * - Decrement attendedSessions if was present
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

    // Only decrement if was present
    if (!PRESENT_STATUSES.includes(data.status)) {
      return null;
    }
    
    const studentId = data.studentId;
    const studentRef = db.collection('students').doc(studentId);
    const studentDoc = await studentRef.get();
    
    if (!studentDoc.exists) {
      return null;
    }
    
    const studentData = studentDoc.data() as StudentData;
    const currentAttended = studentData.attendedSessions || 0;
    const newAttended = Math.max(0, currentAttended - 1);
    
    await studentRef.update({
      attendedSessions: newAttended
    });
    
    console.log(`[onStudentAttendanceDelete] Decremented attended for student ${studentId}: ${currentAttended} → ${newAttended}`);
    
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
