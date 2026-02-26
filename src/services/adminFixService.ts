/**
 * Admin Fix Service
 * 
 * Provides admin-only functions to fix data integrity issues:
 * - Recalculate student session counts from actual studentAttendance records
 * - Reset class attendance (delete all attendance data and recalculate)
 * - Remove students from classes
 * 
 * These functions exist because of a historical race condition between
 * Cloud Function triggers and client-side code that caused double-counting
 * of attendedSessions. The race condition has been fixed (see saveFullAttendance),
 * but existing data needs repair.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AttendanceStatus, StudentStatus } from '../../types';

// Legacy + current present statuses for backward compatibility with old Firestore data
const ALL_PRESENT_STATUSES = [AttendanceStatus.ON_TIME, AttendanceStatus.LATE, 'Có mặt', 'Đến trễ'];
const ALL_ABSENT_STATUSES = [AttendanceStatus.ABSENT, 'Vắng không phép', 'Nghỉ'];

// ===========================
// TYPES
// ===========================

export interface RecalculateResult {
    studentId: string;
    studentName: string;
    before: {
        attendedSessions: number;
        remainingSessions: number;
        registeredSessions: number;
        status: string;
    };
    after: {
        attendedSessions: number;
        remainingSessions: number;
        registeredSessions: number;
        status: string;
    };
    changed: boolean;
}

export interface ResetResult {
    classId: string;
    className: string;
    attendanceRecordsDeleted: number;
    studentAttendanceDeleted: number;
    sessionsReset: number;
    studentsRecalculated: number;
}

export interface RemoveStudentResult {
    studentId: string;
    studentName: string;
    attendanceDeleted: number;
    success: boolean;
    error?: string;
}

// ===========================
// 1. RECALCULATE STUDENT SESSION DATA
// ===========================

/**
 * Recalculate session data for ALL students in a class
 * by counting actual studentAttendance records.
 * 
 * This is the definitive fix for data that was corrupted
 * by the race condition between Cloud Functions and client-side code.
 * 
 * Flow:
 * 1. Get all students in the class
 * 2. For each student, count studentAttendance records with present status
 * 3. Compare with stored values
 * 4. Update if different
 */
export const recalculateClassStudentData = async (
    classId: string
): Promise<RecalculateResult[]> => {
    const results: RecalculateResult[] = [];

    // Get class info
    const classDoc = await getDoc(doc(db, 'classes', classId));
    if (!classDoc.exists()) {
        throw new Error('Không tìm thấy lớp học');
    }
    const classData = classDoc.data();
    const className = classData.name;

    // Get all students in this class
    const studentsQuery = query(
        collection(db, 'students'),
        where('classId', '==', classId)
    );
    const studentsSnap = await getDocs(studentsQuery);

    // Also check students by className
    const studentsByNameQuery = query(
        collection(db, 'students'),
        where('className', '==', className)
    );
    const studentsByNameSnap = await getDocs(studentsByNameQuery);

    // Merge unique students
    const studentMap = new Map<string, any>();
    studentsSnap.docs.forEach(d => studentMap.set(d.id, { id: d.id, ...d.data() }));
    studentsByNameSnap.docs.forEach(d => {
        if (!studentMap.has(d.id)) {
            studentMap.set(d.id, { id: d.id, ...d.data() });
        }
    });

    const students = Array.from(studentMap.values());
    console.log(`[recalculateClassStudentData] Class "${className}" has ${students.length} students`);

    for (const student of students) {
        const studentId = student.id;
        const studentName = student.fullName || student.name || 'N/A';
        const registeredSessions = student.registeredSessions || 0;

        // Count ACTUAL present attendance from studentAttendance collection
        // for SESSION attendance (has sessionId) - these count toward attendedSessions
        // Include legacy status values ('Có mặt', 'Đến trễ') for backward compatibility
        const sessionAttendanceQuery = query(
            collection(db, 'studentAttendance'),
            where('studentId', '==', studentId),
            where('classId', '==', classId),
            where('status', 'in', ALL_PRESENT_STATUSES)
        );
        const sessionAttendanceSnap = await getDocs(sessionAttendanceQuery);

        // Only count records WITH sessionId as session attendance
        // Records without sessionId are makeup attendance
        let actualAttended = 0;
        let actualMakeup = 0;
        let actualAbsent = 0;

        sessionAttendanceSnap.docs.forEach(d => {
            const data = d.data();
            if (data.sessionId) {
                actualAttended++;
            } else {
                actualMakeup++;
            }
        });

        // Count absent records (include legacy absent values)
        const absentQuery = query(
            collection(db, 'studentAttendance'),
            where('studentId', '==', studentId),
            where('classId', '==', classId),
            where('status', 'in', ALL_ABSENT_STATUSES)
        );
        const absentSnap = await getDocs(absentQuery);
        absentSnap.docs.forEach(d => {
            const data = d.data();
            if (data.sessionId) {
                actualAbsent++;
            }
        });

        // Calculate correct values
        const actualRemaining = registeredSessions - actualAttended;

        // Determine correct status
        let newStatus = student.status;
        const skipStatuses = [StudentStatus.DROPPED, StudentStatus.RESERVED, StudentStatus.TRIAL, StudentStatus.CONTRACT_DEBT];

        if (!skipStatuses.includes(student.status)) {
            if (registeredSessions > 0) {
                if (actualRemaining < 0) {
                    newStatus = StudentStatus.DEBT;
                } else if (actualRemaining === 0) {
                    newStatus = StudentStatus.EXPIRED_FEE;
                } else {
                    newStatus = StudentStatus.ACTIVE;
                }
            }
        }

        const before = {
            attendedSessions: student.attendedSessions || 0,
            remainingSessions: student.remainingSessions ?? (registeredSessions - (student.attendedSessions || 0)),
            registeredSessions,
            status: student.status,
        };

        const after = {
            attendedSessions: actualAttended,
            remainingSessions: actualRemaining,
            registeredSessions,
            status: newStatus,
        };

        const changed =
            before.attendedSessions !== after.attendedSessions ||
            before.remainingSessions !== after.remainingSessions ||
            before.status !== after.status;

        if (changed) {
            // Update student document
            const updateData: Record<string, any> = {
                attendedSessions: actualAttended,
                remainingSessions: actualRemaining,
                makeupSessionsAttended: actualMakeup,
            };

            // Update status if needed
            if (!skipStatuses.includes(student.status)) {
                updateData.status = newStatus;

                if (newStatus === 'Nợ phí') {
                    updateData.debtSessions = Math.abs(actualRemaining);
                    if (!student.debtStartDate) {
                        updateData.debtStartDate = new Date().toISOString();
                    }
                } else {
                    updateData.debtSessions = 0;
                    updateData.debtStartDate = null;
                }
            }

            // Also update classProgress
            updateData[`classProgress.${classId}`] = {
                registeredSessions,
                attendedSessions: actualAttended,
                absentSessions: actualAbsent,
                makeupOwed: Math.max(0, actualAbsent - actualMakeup),
                makeupDone: actualMakeup,
                reservedSessions: 0,
            };

            await updateDoc(doc(db, 'students', studentId), updateData);

            console.log(`[recalculateClassStudentData] Fixed ${studentName}: attended ${before.attendedSessions} → ${after.attendedSessions}, remaining ${before.remainingSessions} → ${after.remainingSessions}, status: ${before.status} → ${after.status}`);
        }

        results.push({
            studentId,
            studentName,
            before,
            after,
            changed,
        });
    }

    return results;
};

// ===========================
// 2. RESET CLASS ATTENDANCE
// ===========================

/**
 * Reset ALL attendance data for a class:
 * - Delete all `attendance` records for the class
 * - Delete all `studentAttendance` records for the class 
 * - Reset all `classSessions` to "Chưa học" status
 * - Recalculate student session counts (will be 0 after reset)
 * 
 * ⚠️ This is DESTRUCTIVE - all attendance history for the class will be lost!
 * After reset, admins should re-enter attendance from scratch.
 */
export const resetClassAttendance = async (
    classId: string
): Promise<ResetResult> => {
    // Get class info
    const classDoc = await getDoc(doc(db, 'classes', classId));
    if (!classDoc.exists()) {
        throw new Error('Không tìm thấy lớp học');
    }
    const classData = classDoc.data();
    const className = classData.name;

    let attendanceRecordsDeleted = 0;
    let studentAttendanceDeleted = 0;
    let sessionsReset = 0;
    let studentsRecalculated = 0;

    // Step 1: Delete all studentAttendance records for this class
    const studentAttendanceQuery = query(
        collection(db, 'studentAttendance'),
        where('classId', '==', classId)
    );
    const studentAttendanceSnap = await getDocs(studentAttendanceQuery);

    // Delete in batches of 400 (Firestore limit is 500)
    const docs = studentAttendanceSnap.docs;
    for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 400);
        chunk.forEach(d => {
            batch.delete(d.ref);
        });
        await batch.commit();
        studentAttendanceDeleted += chunk.length;
    }

    // Step 2: Delete all attendance records for this class
    const attendanceQuery = query(
        collection(db, 'attendance'),
        where('classId', '==', classId)
    );
    const attendanceSnap = await getDocs(attendanceQuery);

    const attendanceDocs = attendanceSnap.docs;
    for (let i = 0; i < attendanceDocs.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = attendanceDocs.slice(i, i + 400);
        chunk.forEach(d => {
            batch.delete(d.ref);
        });
        await batch.commit();
        attendanceRecordsDeleted += chunk.length;
    }

    // Step 3: Reset all classSessions to "Chưa học"
    const sessionsQuery = query(
        collection(db, 'classSessions'),
        where('classId', '==', classId)
    );
    const sessionsSnap = await getDocs(sessionsQuery);

    const sessionDocs = sessionsSnap.docs;
    for (let i = 0; i < sessionDocs.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = sessionDocs.slice(i, i + 400);
        chunk.forEach(d => {
            batch.update(d.ref, {
                status: 'Chưa học',
                attendanceId: null,
            });
        });
        await batch.commit();
        sessionsReset += chunk.length;
    }

    // Step 4: Reset student session counts
    const studentsQuery = query(
        collection(db, 'students'),
        where('classId', '==', classId)
    );
    const studentsSnap = await getDocs(studentsQuery);

    // Also check by className
    const studentsByNameQuery = query(
        collection(db, 'students'),
        where('className', '==', className)
    );
    const studentsByNameSnap = await getDocs(studentsByNameQuery);

    // Merge unique students
    const studentMap = new Map<string, any>();
    studentsSnap.docs.forEach(d => studentMap.set(d.id, d));
    studentsByNameSnap.docs.forEach(d => {
        if (!studentMap.has(d.id)) {
            studentMap.set(d.id, d);
        }
    });

    for (const [studentId, studentDoc] of studentMap) {
        const student = studentDoc.data();
        const registeredSessions = student.registeredSessions || 0;
        const skipStatuses = [StudentStatus.DROPPED, StudentStatus.RESERVED, StudentStatus.TRIAL, StudentStatus.CONTRACT_DEBT];

        const updateData: Record<string, any> = {
            attendedSessions: 0,
            remainingSessions: registeredSessions,
            makeupSessionsAttended: 0,
            processedAttendanceIds: [],
            [`classProgress.${classId}`]: {
                registeredSessions,
                attendedSessions: 0,
                absentSessions: 0,
                makeupOwed: 0,
                makeupDone: 0,
                reservedSessions: 0,
            },
        };

        // Reset status to "Đang học" if not in skip list
        if (!skipStatuses.includes(student.status)) {
            if (registeredSessions > 0) {
                updateData.status = StudentStatus.ACTIVE;
            }
            updateData.debtSessions = 0;
            updateData.debtStartDate = null;
        }

        await updateDoc(doc(db, 'students', studentId), updateData);
        studentsRecalculated++;
    }

    console.log(`[resetClassAttendance] Class "${className}": deleted ${attendanceRecordsDeleted} attendance records, ${studentAttendanceDeleted} student attendance records, reset ${sessionsReset} sessions, recalculated ${studentsRecalculated} students`);

    return {
        classId,
        className,
        attendanceRecordsDeleted,
        studentAttendanceDeleted,
        sessionsReset,
        studentsRecalculated,
    };
};

// ===========================
// 3. REMOVE STUDENT FROM CLASS  
// ===========================

/**
 * Remove a student from a class:
 * - Clear classId, className from student
 * - Delete studentAttendance records for this class
 * - Update status to "Nghỉ học"
 */
export const removeStudentFromClass = async (
    studentId: string,
    classId: string
): Promise<RemoveStudentResult> => {
    try {
        // Get student info
        const studentDoc = await getDoc(doc(db, 'students', studentId));
        if (!studentDoc.exists()) {
            throw new Error('Không tìm thấy học viên');
        }
        const student = studentDoc.data();
        const studentName = student.fullName || student.name || 'N/A';

        // Delete studentAttendance records for this class
        const attendanceQuery = query(
            collection(db, 'studentAttendance'),
            where('studentId', '==', studentId),
            where('classId', '==', classId)
        );
        const attendanceSnap = await getDocs(attendanceQuery);

        let attendanceDeleted = 0;
        const attendanceDocs = attendanceSnap.docs;
        for (let i = 0; i < attendanceDocs.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = attendanceDocs.slice(i, i + 400);
            chunk.forEach(d => {
                batch.delete(d.ref);
            });
            await batch.commit();
            attendanceDeleted += chunk.length;
        }

        // Update student document
        const updateData: Record<string, any> = {
            status: StudentStatus.DROPPED,
            classId: null,
            className: null,
            class: null,
            attendedSessions: 0,
            remainingSessions: 0,
            updatedAt: new Date().toISOString(),
        };

        // Remove from classIds array if exists
        if (student.classIds && Array.isArray(student.classIds)) {
            updateData.classIds = student.classIds.filter((id: string) => id !== classId);
        }

        // Clear classProgress for this class
        updateData[`classProgress.${classId}`] = null;

        await updateDoc(doc(db, 'students', studentId), updateData);

        console.log(`[removeStudentFromClass] Removed ${studentName} from class, deleted ${attendanceDeleted} attendance records`);

        return {
            studentId,
            studentName,
            attendanceDeleted,
            success: true,
        };
    } catch (error: any) {
        console.error('[removeStudentFromClass] Error:', error);
        return {
            studentId,
            studentName: '',
            attendanceDeleted: 0,
            success: false,
            error: error.message,
        };
    }
};

// ===========================
// 4. FIX SPECIFIC STUDENT registeredSessions
// ===========================

/**
 * Manually set registeredSessions for a specific student.
 * Used for cases like "Lê Tuấn Dũng đăng ký 24b nhưng pm tính 48b"
 */
export const fixStudentRegisteredSessions = async (
    studentId: string,
    classId: string,
    correctRegisteredSessions: number
): Promise<{ success: boolean; studentName: string }> => {
    const studentDoc = await getDoc(doc(db, 'students', studentId));
    if (!studentDoc.exists()) {
        throw new Error('Không tìm thấy học viên');
    }
    const student = studentDoc.data();
    const attended = student.attendedSessions || 0;
    const remaining = correctRegisteredSessions - attended;

    const updateData: Record<string, any> = {
        registeredSessions: correctRegisteredSessions,
        remainingSessions: remaining,
    };

    // Update classProgress too
    const classProgress = student.classProgress?.[classId];
    if (classProgress) {
        updateData[`classProgress.${classId}.registeredSessions`] = correctRegisteredSessions;
    }

    // Update debt status (skip if student has special status)
    const skipStatuses = [StudentStatus.DROPPED, StudentStatus.RESERVED, StudentStatus.TRIAL, StudentStatus.CONTRACT_DEBT];
    if (!skipStatuses.includes(student.status)) {
        if (remaining < 0) {
            updateData.status = StudentStatus.DEBT;
            updateData.debtSessions = Math.abs(remaining);
        } else if (remaining === 0) {
            updateData.status = StudentStatus.EXPIRED_FEE;
            updateData.debtSessions = 0;
        } else {
            updateData.status = StudentStatus.ACTIVE;
            updateData.debtSessions = 0;
            updateData.debtStartDate = null;
        }
    }

    await updateDoc(doc(db, 'students', studentId), updateData);

    console.log(`[fixStudentRegisteredSessions] Updated ${student.fullName}: registered=${correctRegisteredSessions}, attended=${attended}, remaining=${remaining}`);

    return {
        success: true,
        studentName: student.fullName || student.name || 'N/A',
    };
};

// ===========================
// 5. BATCH FIX MULTIPLE CLASSES
// ===========================

/**
 * Recalculate session data for multiple classes at once.
 * Useful for fixing multiple classes reported by admin.
 */
export const batchRecalculateClasses = async (
    classIds: string[]
): Promise<{
    totalClasses: number;
    totalStudents: number;
    totalFixed: number;
    results: Array<{
        classId: string;
        className: string;
        studentsChecked: number;
        studentsFixed: number;
        error?: string;
    }>;
}> => {
    const results: Array<{
        classId: string;
        className: string;
        studentsChecked: number;
        studentsFixed: number;
        error?: string;
    }> = [];

    let totalStudents = 0;
    let totalFixed = 0;

    for (const classId of classIds) {
        try {
            const classDoc = await getDoc(doc(db, 'classes', classId));
            const className = classDoc.exists() ? classDoc.data().name : classId;

            const classResults = await recalculateClassStudentData(classId);
            const fixed = classResults.filter(r => r.changed).length;

            results.push({
                classId,
                className,
                studentsChecked: classResults.length,
                studentsFixed: fixed,
            });

            totalStudents += classResults.length;
            totalFixed += fixed;
        } catch (error: any) {
            results.push({
                classId,
                className: classId,
                studentsChecked: 0,
                studentsFixed: 0,
                error: error.message,
            });
        }
    }

    return {
        totalClasses: classIds.length,
        totalStudents,
        totalFixed,
        results,
    };
};
