/**
 * Attendance Triggers
 * 
 * Handles:
 * - Update attendedSessions count when attendance is recorded
 * - Calculate expectedEndDate based on remaining sessions and class schedule
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();
const REGION = 'asia-southeast1';

interface AttendanceRecord {
  classId: string;
  sessionId: string;
  date: string;
  students: {
    studentId: string;
    studentName: string;
    status: string; // 'Có mặt' | 'Vắng' | 'Có phép' | 'Đến trễ' | 'Nghỉ'
    note?: string;
  }[];
}

interface StudentData {
  id?: string;
  fullName: string;
  classId?: string;
  class?: string;
  registeredSessions?: number;
  attendedSessions?: number;
  legacyAttendedSessions?: number;
  startDate?: string;
  expectedEndDate?: string;
}

interface ClassData {
  id?: string;
  name: string;
  schedule?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Parse schedule to get days per week
 * Examples: "Thứ 2, 4, 6" -> 3, "T2, T4" -> 2
 */
function getDaysPerWeek(schedule?: string): number {
  if (!schedule) return 2; // Default 2 days per week
  
  // Count occurrences of day patterns
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
 * Calculate expected end date based on:
 * - Remaining sessions
 * - Days per week from class schedule
 * - Current date or start date
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
 * Trigger: When attendance record is created/updated
 * Actions:
 * - Update attendedSessions for each student
 * - Recalculate expectedEndDate
 */
export const onAttendanceWrite = functions
  .region(REGION)
  .firestore
  .document('attendanceRecords/{recordId}')
  .onWrite(async (change, context) => {
    const recordId = context.params.recordId;
    
    // Handle delete
    if (!change.after.exists) {
      console.log(`[onAttendanceWrite] Record deleted: ${recordId}`);
      // Could implement recount here if needed
      return null;
    }
    
    const record = change.after.data() as AttendanceRecord;
    const beforeRecord = change.before.exists ? change.before.data() as AttendanceRecord : null;
    
    console.log(`[onAttendanceWrite] Processing record: ${recordId}, date: ${record.date}`);
    
    // Get class info for schedule
    let classData: ClassData | null = null;
    if (record.classId) {
      const classDoc = await db.collection('classes').doc(record.classId).get();
      if (classDoc.exists) {
        classData = { id: classDoc.id, ...classDoc.data() } as ClassData;
      }
    }
    
    const daysPerWeek = getDaysPerWeek(classData?.schedule);
    console.log(`[onAttendanceWrite] Days per week: ${daysPerWeek}`);
    
    // Process each student in the attendance record
    const batch = db.batch();
    const studentUpdates: string[] = [];
    
    for (const studentEntry of record.students) {
      const { studentId, status } = studentEntry;
      
      // Only count if student was present (Có mặt, Đến trễ)
      const wasPresent = status === 'Có mặt' || status === 'Đến trễ';
      
      // Check if status changed from before (if update)
      let wasPresentBefore = false;
      if (beforeRecord) {
        const beforeStudent = beforeRecord.students.find(s => s.studentId === studentId);
        if (beforeStudent) {
          wasPresentBefore = beforeStudent.status === 'Có mặt' || beforeStudent.status === 'Đến trễ';
        }
      }
      
      // Skip if no change
      if (beforeRecord && wasPresent === wasPresentBefore) {
        continue;
      }
      
      // Get student data
      const studentDoc = await db.collection('students').doc(studentId).get();
      if (!studentDoc.exists) {
        console.log(`[onAttendanceWrite] Student not found: ${studentId}`);
        continue;
      }
      
      const studentData = studentDoc.data() as StudentData;
      const currentAttended = studentData.attendedSessions || 0;
      const registeredSessions = studentData.registeredSessions || 0;

      // Calculate new attended count and prepare update
      let attendedIncrement = 0;
      let newAttended = currentAttended;

      if (wasPresent && !wasPresentBefore) {
        attendedIncrement = 1;
        newAttended = currentAttended + 1;
      } else if (!wasPresent && wasPresentBefore) {
        attendedIncrement = -1;
        newAttended = Math.max(0, currentAttended - 1);
      }

      // Calculate remaining and expected end date
      const remaining = Math.max(0, registeredSessions - newAttended);
      const expectedEndDate = calculateExpectedEndDate(
        remaining,
        daysPerWeek,
        studentData.startDate || record.date
      );

      // Update student using atomic increment
      const updateData: Record<string, any> = {
        attendedSessions: FieldValue.increment(attendedIncrement),
        expectedEndDate: expectedEndDate
      };
      
      // Set startDate if not set and this is first attendance
      if (!studentData.startDate && newAttended === 1) {
        updateData.startDate = record.date;
      }
      
      batch.update(db.collection('students').doc(studentId), updateData);
      studentUpdates.push(`${studentId}: attended=${newAttended}, remaining=${remaining}, endDate=${expectedEndDate}`);
    }
    
    if (studentUpdates.length > 0) {
      await batch.commit();
      console.log(`[onAttendanceWrite] Updated ${studentUpdates.length} students:`, studentUpdates);
    }
    
    return null;
  });

/**
 * Trigger: When a class session status changes to completed
 * Actions:
 * - Recalculate expectedEndDate for students who missed (need makeup)
 */
export const onSessionComplete = functions
  .region(REGION)
  .firestore
  .document('classSessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const sessionId = context.params.sessionId;
    const before = change.before.data();
    const after = change.after.data();
    
    // Only process if session became completed
    if (before.status === after.status || after.status !== 'Đã học') {
      return null;
    }
    
    console.log(`[onSessionComplete] Session completed: ${sessionId}`);
    
    // Get attendance for this session
    const attendanceSnap = await db.collection('attendanceRecords')
      .where('sessionId', '==', sessionId)
      .limit(1)
      .get();
    
    if (attendanceSnap.empty) {
      console.log(`[onSessionComplete] No attendance record for session ${sessionId}`);
      return null;
    }
    
    const attendance = attendanceSnap.docs[0].data() as AttendanceRecord;
    const classId = attendance.classId;
    
    // Get class schedule
    const classDoc = await db.collection('classes').doc(classId).get();
    const classData = classDoc.exists ? classDoc.data() as ClassData : null;
    const daysPerWeek = getDaysPerWeek(classData?.schedule);
    
    // Find students who were absent
    const absentStudents = attendance.students.filter(s => 
      s.status === 'Vắng' || s.status === 'Có phép' || s.status === 'Nghỉ'
    );
    
    if (absentStudents.length === 0) {
      console.log(`[onSessionComplete] No absent students`);
      return null;
    }
    
    // Update expectedEndDate for absent students (add 1 makeup session)
    const batch = db.batch();
    
    for (const absentStudent of absentStudents) {
      const studentDoc = await db.collection('students').doc(absentStudent.studentId).get();
      if (!studentDoc.exists) continue;
      
      const studentData = studentDoc.data() as StudentData;
      const registeredSessions = studentData.registeredSessions || 0;
      const attendedSessions = studentData.attendedSessions || 0;
      const legacyAttended = studentData.legacyAttendedSessions || 0;

      // Remaining = registered - attended - legacy (absent sessions need makeup = add more days)
      const remaining = Math.max(0, registeredSessions - attendedSessions - legacyAttended);
      const expectedEndDate = calculateExpectedEndDate(remaining, daysPerWeek, studentData.startDate);

      batch.update(studentDoc.ref, { expectedEndDate });
    }
    
    await batch.commit();
    console.log(`[onSessionComplete] Updated expectedEndDate for ${absentStudents.length} absent students`);
    
    return null;
  });

/**
 * Scheduled function: Recalculate all student stats daily
 * Runs at 2 AM every day
 */
export const recalculateStudentStats = functions
  .region(REGION)
  .pubsub
  .schedule('0 2 * * *')
  .timeZone('Asia/Ho_Chi_Minh')
  .onRun(async (context) => {
    console.log('[recalculateStudentStats] Starting daily recalculation...');
    
    // Get all active students
    const studentsSnap = await db.collection('students')
      .where('status', 'in', ['Đang học', 'Học thử', 'Nợ phí'])
      .get();
    
    console.log(`[recalculateStudentStats] Processing ${studentsSnap.size} students`);
    
    let batchCount = 0;
    let batch = db.batch();
    
    for (const studentDoc of studentsSnap.docs) {
      const studentData = studentDoc.data() as StudentData;
      
      // Recalculate expectedEndDate based on current attendedSessions
      const registeredSessions = studentData.registeredSessions || 0;
      const attendedSessions = studentData.attendedSessions || 0;
      const legacyAttended = studentData.legacyAttendedSessions || 0;
      const remaining = Math.max(0, registeredSessions - attendedSessions - legacyAttended);
      
      // Get class for schedule
      let daysPerWeek = 2;
      if (studentData.classId) {
        const classDoc = await db.collection('classes').doc(studentData.classId).get();
        if (classDoc.exists) {
          const classData = classDoc.data() as ClassData;
          daysPerWeek = getDaysPerWeek(classData.schedule);
        }
      }
      
      const expectedEndDate = calculateExpectedEndDate(remaining, daysPerWeek, studentData.startDate);
      
      // Only update if changed
      if (expectedEndDate !== studentData.expectedEndDate) {
        batch.update(studentDoc.ref, { expectedEndDate });
        batchCount++;
        
        // Commit batch every 400 operations
        if (batchCount >= 400) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log('[recalculateStudentStats] Completed');
    return null;
  });
