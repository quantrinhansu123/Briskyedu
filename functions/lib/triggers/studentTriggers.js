"use strict";
/**
 * Student Collection Triggers
 *
 * Handles:
 * - Cascade student name changes to attendance
 * - Update class student counts when status changes
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onStudentCreate = exports.onStudentDelete = exports.onStudentUpdate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const batchUtils_1 = require("../utils/batchUtils");
const db = admin.firestore();
const REGION = 'asia-southeast1';
/**
 * Trigger: When a student is updated
 * Actions:
 * - Cascade name changes to attendance records
 * - Update class student counts if status changed
 */
exports.onStudentUpdate = functions
    .region(REGION)
    .firestore
    .document('students/{studentId}')
    .onUpdate(async (change, context) => {
    const studentId = context.params.studentId;
    const before = change.before.data();
    const after = change.after.data();
    console.log(`[onStudentUpdate] Student updated: ${after.fullName} (${studentId})`);
    const updates = [];
    // 1. Cascade name changes to attendance
    if (before.fullName !== after.fullName) {
        console.log(`[onStudentUpdate] Name changed: "${before.fullName}" → "${after.fullName}"`);
        // Update attendance records where this student appears
        // Note: This is more complex as studentName is in an array
        // For now, we'll update attendanceHistory records
        updates.push((0, batchUtils_1.cascadeUpdate)('attendanceHistory', 'studentId', studentId, {
            studentName: after.fullName
        }).then(count => {
            console.log(`[onStudentUpdate] Updated ${count} attendance history records`);
            return count;
        }));
    }
    // 2. Update class student counts if status or classId changed
    const statusChanged = before.status !== after.status;
    const classChanged = before.classId !== after.classId;
    if (statusChanged || classChanged) {
        console.log(`[onStudentUpdate] Status/class changed - updating counts`);
        // Recalculate counts for old class
        if (before.classId) {
            updates.push(updateClassStudentCounts(before.classId));
        }
        // Recalculate counts for new class (if different)
        if (after.classId && after.classId !== before.classId) {
            updates.push(updateClassStudentCounts(after.classId));
        }
    }
    // 3. Auto-calculate bad debt when student status changes to "Nghỉ học"
    if (statusChanged && after.status === 'Nghỉ học') {
        // Step 1: Check for ANY "Nợ xấu" settlement invoice (Option B - Strict)
        const badDebtInvoices = await db.collection('settlementInvoices')
            .where('studentId', '==', studentId)
            .where('status', '==', 'Nợ xấu')
            .limit(1)
            .get();
        if (!badDebtInvoices.empty) {
            // Has at least one "Nợ xấu" invoice → bad debt remains, do nothing
            console.log(`[onStudentUpdate] Student ${after.fullName} has "Nợ xấu" invoice - keeping badDebt`);
            return null;
        }
        // Step 2: Check for paid settlement invoice
        const paidInvoices = await db.collection('settlementInvoices')
            .where('studentId', '==', studentId)
            .where('status', '==', 'Đã thanh toán')
            .limit(1)
            .get();
        if (!paidInvoices.empty) {
            // Has paid invoice (and no bad debt invoices) → ensure badDebt is cleared
            console.log(`[onStudentUpdate] Student ${after.fullName} has paid settlement - ensuring badDebt cleared`);
            // Safety net: Clear if not already cleared
            if (after.badDebt !== false) {
                const invoiceCode = paidInvoices.docs[0].data().invoiceCode || 'N/A';
                await db.collection('students').doc(studentId).update({
                    badDebt: false,
                    badDebtSessions: 0,
                    badDebtAmount: 0,
                    badDebtDate: null,
                    badDebtNote: `Đã tất toán - ${invoiceCode}`,
                });
            }
            return null; // Don't proceed to auto-set bad debt
        }
        // Step 3: No settlement invoice - check if should auto-set bad debt
        const registeredSessions = after.registeredSessions || 0;
        const attendedSessions = after.attendedSessions || 0;
        if (attendedSessions > registeredSessions) {
            const badDebtSessions = attendedSessions - registeredSessions;
            const badDebtAmount = badDebtSessions * 150000; // 150k per session
            console.log(`[onStudentUpdate] Student ${after.fullName} has bad debt (no settlement): ${badDebtSessions} sessions = ${badDebtAmount}đ`);
            // Update student with bad debt info
            await db.collection('students').doc(studentId).update({
                badDebt: true,
                badDebtSessions: badDebtSessions,
                badDebtAmount: badDebtAmount,
                badDebtDate: new Date().toLocaleDateString('vi-VN'),
                badDebtNote: `Nghỉ học khi còn nợ ${badDebtSessions} buổi`,
            });
        }
    }
    // 4. Clear bad debt if student pays and comes back
    if (statusChanged && before.status === 'Nghỉ học' && after.status === 'Đang học') {
        if (before.badDebt) {
            console.log(`[onStudentUpdate] Student ${after.fullName} returned - clearing bad debt flag`);
            await db.collection('students').doc(studentId).update({
                badDebt: false,
                badDebtSessions: 0,
                badDebtAmount: 0,
                badDebtNote: `Đã quay lại học - ${new Date().toLocaleDateString('vi-VN')}`,
            });
        }
    }
    await Promise.all(updates);
    return null;
});
/**
 * Trigger: When a student is deleted
 * Actions:
 * - Update class student counts
 * - Archive attendance records
 */
exports.onStudentDelete = functions
    .region(REGION)
    .firestore
    .document('students/{studentId}')
    .onDelete(async (snap, context) => {
    const studentId = context.params.studentId;
    const studentData = snap.data();
    console.log(`[onStudentDelete] Student deleted: ${studentData.fullName} (${studentId})`);
    // Update class counts
    if (studentData.classId) {
        await updateClassStudentCounts(studentData.classId);
    }
    // Mark attendance history as student deleted
    await (0, batchUtils_1.cascadeUpdate)('attendanceHistory', 'studentId', studentId, {
        studentDeleted: true,
        studentDeletedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return null;
});
/**
 * Trigger: When a student is created
 * Actions:
 * - Update class student counts
 */
exports.onStudentCreate = functions
    .region(REGION)
    .firestore
    .document('students/{studentId}')
    .onCreate(async (snap, context) => {
    const studentId = context.params.studentId;
    const studentData = snap.data();
    console.log(`[onStudentCreate] Student created: ${studentData.fullName} (${studentId})`);
    // Update class counts
    if (studentData.classId) {
        await updateClassStudentCounts(studentData.classId);
    }
    return null;
});
/**
 * Helper: Update student counts for a class
 */
async function updateClassStudentCounts(classId) {
    const studentsSnapshot = await db
        .collection('students')
        .where('classId', '==', classId)
        .get();
    const counts = {
        studentsCount: 0,
        trialStudents: 0,
        activeStudents: 0,
        debtStudents: 0,
        reservedStudents: 0,
    };
    studentsSnapshot.forEach(doc => {
        const student = doc.data();
        counts.studentsCount++;
        const status = normalizeStatus(student.status);
        switch (status) {
            case 'Học thử':
                counts.trialStudents++;
                break;
            case 'Đang học':
                counts.activeStudents++;
                break;
            case 'Nợ phí':
                counts.debtStudents++;
                break;
            case 'Bảo lưu':
                counts.reservedStudents++;
                break;
        }
    });
    await db.collection('classes').doc(classId).update(counts);
    console.log(`[updateClassStudentCounts] Updated counts for class ${classId}:`, counts);
}
/**
 * Helper: Normalize status values
 */
function normalizeStatus(status) {
    const statusMap = {
        'Đã nghỉ': 'Nghỉ học',
        'Active': 'Đang học',
        'Đang hoạt động': 'Đang học',
    };
    return statusMap[status] || status;
}
//# sourceMappingURL=studentTriggers.js.map