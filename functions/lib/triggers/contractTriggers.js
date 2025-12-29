"use strict";
/**
 * Contract Triggers
 *
 * Handles:
 * - Add sessions to student when renewal/migration contract is paid
 * - Update student status when new contract is created
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
exports.onContractCreate = exports.onContractUpdate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const REGION = 'asia-southeast1';
/**
 * Trigger: When a contract status changes to PAID
 * Actions:
 * - For renewal/migration contracts: Add sessions to student
 * - For new contracts: Ensure student has sessions
 */
exports.onContractUpdate = functions
    .region(REGION)
    .firestore
    .document('contracts/{contractId}')
    .onUpdate(async (change, context) => {
    var _a, _b;
    const contractId = context.params.contractId;
    const before = change.before.data();
    const after = change.after.data();
    console.log(`[onContractUpdate] Contract updated: ${contractId}`);
    console.log(`[onContractUpdate] Status: ${before.status} → ${after.status}`);
    // Only process if status changed to PAID or PARTIAL (Nợ hợp đồng)
    const isPaidOrPartial = after.status === 'Đã thanh toán' || after.status === 'Nợ hợp đồng';
    if (before.status === after.status || !isPaidOrPartial) {
        console.log('[onContractUpdate] Status not changed to PAID/PARTIAL, skipping');
        return null;
    }
    // Only process student contracts
    if (after.type !== 'Học viên' || !after.studentId) {
        console.log('[onContractUpdate] Not a student contract, skipping');
        return null;
    }
    // Calculate total sessions from course items
    const totalSessions = after.items
        .filter(item => item.type === 'course')
        .reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (totalSessions === 0) {
        console.log('[onContractUpdate] No course items, skipping');
        return null;
    }
    // Calculate PAID sessions based on payment ratio
    // For PARTIAL contracts, only count sessions proportional to paid amount
    const paidAmount = after.paidAmount || 0;
    const totalAmount = after.totalAmount || 1;
    const paidSessions = after.status === 'Nợ hợp đồng'
        ? Math.floor(totalSessions * (paidAmount / totalAmount))
        : totalSessions;
    console.log(`[onContractUpdate] Total sessions: ${totalSessions}, Paid sessions: ${paidSessions}`);
    console.log(`[onContractUpdate] Payment: ${paidAmount}/${totalAmount} = ${Math.round(paidAmount / totalAmount * 100)}%`);
    console.log(`[onContractUpdate] Contract category: ${after.category}`);
    // Get student data
    const studentRef = db.collection('students').doc(after.studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
        console.log('[onContractUpdate] Student not found');
        return null;
    }
    const studentData = studentSnap.data();
    const currentSessions = (studentData === null || studentData === void 0 ? void 0 : studentData.registeredSessions) || 0;
    // Handle based on contract category
    // Use paidSessions (not totalSessions) to reflect actual paid amount
    let newSessions = currentSessions;
    if (after.category === 'Hợp đồng tái phí' || after.category === 'Hợp đồng liên kết') {
        // Add paid sessions to existing
        newSessions = currentSessions + paidSessions;
        console.log(`[onContractUpdate] Adding ${paidSessions} paid sessions. New total: ${newSessions}`);
    }
    else {
        // New contract - set sessions if not already set
        if (currentSessions === 0) {
            newSessions = paidSessions;
            console.log(`[onContractUpdate] Setting initial paid sessions: ${newSessions}`);
        }
        else {
            // Student already has sessions, add more paid sessions
            newSessions = currentSessions + paidSessions;
            console.log(`[onContractUpdate] Student has ${currentSessions} sessions, adding ${paidSessions} paid. New: ${newSessions}`);
        }
    }
    // Update student
    const attendedSessions = (studentData === null || studentData === void 0 ? void 0 : studentData.attendedSessions) || 0;
    const updateData = {
        registeredSessions: newSessions,
        remainingSessions: newSessions - attendedSessions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    // Update student status based on contract status
    if (after.status === 'Nợ hợp đồng') {
        // Set student status to CONTRACT_DEBT
        updateData.status = 'Nợ hợp đồng';
        updateData.contractDebt = after.remainingAmount || 0;
        if (after.nextPaymentDate) {
            updateData.nextPaymentDate = after.nextPaymentDate;
        }
        console.log(`[onContractUpdate] Updating student status to Nợ hợp đồng (${after.remainingAmount}đ)`);
    }
    else if (after.category === 'Hợp đồng mới' && (studentData === null || studentData === void 0 ? void 0 : studentData.status) === 'Học thử') {
        // If new contract and student was in TRIAL status, update to ACTIVE
        updateData.status = 'Đang học';
        console.log('[onContractUpdate] Updating student status from Học thử to Đang học');
    }
    await studentRef.update(updateData);
    console.log(`[onContractUpdate] Updated student ${after.studentId} with ${newSessions} sessions`);
    // Check if enrollment already exists for this contract (avoid duplicate)
    // Use studentId + contractId for duplicate check (matches client-side logic)
    const existingEnrollment = await db.collection('enrollments')
        .where('studentId', '==', after.studentId)
        .where('contractId', '==', contractId)
        .limit(1)
        .get();
    if (existingEnrollment.empty) {
        // Create enrollment record with PAID sessions (not total)
        // Use actual contract code if available, fallback to document ID
        const actualContractCode = after.code || contractId;
        const enrollmentData = {
            studentId: after.studentId,
            studentName: after.studentName || '',
            // Use contract.classId (from dropdown), fallback to items[0] for backward compatibility
            classId: after.classId || ((_a = after.items[0]) === null || _a === void 0 ? void 0 : _a.id) || '',
            className: after.className || ((_b = after.items[0]) === null || _b === void 0 ? void 0 : _b.name) || '',
            sessions: paidSessions, // Use paidSessions, not totalSessions
            type: after.category || 'Hợp đồng mới',
            contractCode: actualContractCode,
            contractId: contractId,
            originalAmount: after.totalAmount,
            finalAmount: after.paidAmount || after.totalAmount,
            createdDate: new Date().toLocaleDateString('vi-VN'),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: after.createdBy || 'System',
            note: after.status === 'Nợ hợp đồng'
                ? `HĐ ${contractId} - Thanh toán ${Math.round((paidAmount / totalAmount) * 100)}% (${paidSessions}/${totalSessions} buổi)`
                : `HĐ ${contractId} - ${after.category || 'Hợp đồng mới'}`,
        };
        await db.collection('enrollments').add(enrollmentData);
        console.log(`[onContractUpdate] Created enrollment: ${paidSessions} sessions`);
    }
    else {
        console.log(`[onContractUpdate] Enrollment already exists for ${contractId}, skipping`);
    }
    return null;
});
/**
 * Trigger: When a contract is created (for immediate PAID status)
 */
exports.onContractCreate = functions
    .region(REGION)
    .firestore
    .document('contracts/{contractId}')
    .onCreate(async (snap, context) => {
    var _a, _b;
    const contractId = context.params.contractId;
    const contract = snap.data();
    console.log(`[onContractCreate] Contract created: ${contractId}`);
    // Only process if already PAID or PARTIAL
    const isPaidOrPartial = contract.status === 'Đã thanh toán' || contract.status === 'Nợ hợp đồng';
    if (!isPaidOrPartial) {
        console.log('[onContractCreate] Not PAID/PARTIAL status, skipping');
        return null;
    }
    // Process same as update
    if (contract.type !== 'Học viên' || !contract.studentId) {
        return null;
    }
    const totalSessions = contract.items
        .filter(item => item.type === 'course')
        .reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (totalSessions === 0) {
        return null;
    }
    // Calculate PAID sessions based on payment ratio
    const paidAmount = contract.paidAmount || 0;
    const totalAmount = contract.totalAmount || 1;
    const paidSessions = contract.status === 'Nợ hợp đồng'
        ? Math.floor(totalSessions * (paidAmount / totalAmount))
        : totalSessions;
    console.log(`[onContractCreate] Total: ${totalSessions}, Paid: ${paidSessions} (${Math.round(paidAmount / totalAmount * 100)}%)`);
    const studentRef = db.collection('students').doc(contract.studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
        return null;
    }
    const studentData = studentSnap.data();
    const currentSessions = (studentData === null || studentData === void 0 ? void 0 : studentData.registeredSessions) || 0;
    // Use paidSessions (not totalSessions) to reflect actual paid amount
    let newSessions = currentSessions;
    if (contract.category === 'Hợp đồng tái phí' || contract.category === 'Hợp đồng liên kết') {
        newSessions = currentSessions + paidSessions;
    }
    else {
        newSessions = currentSessions === 0 ? paidSessions : currentSessions + paidSessions;
    }
    const attendedSessions = (studentData === null || studentData === void 0 ? void 0 : studentData.attendedSessions) || 0;
    const updateData = {
        registeredSessions: newSessions,
        remainingSessions: newSessions - attendedSessions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    // Update student status based on contract status
    if (contract.status === 'Nợ hợp đồng') {
        updateData.status = 'Nợ hợp đồng';
        updateData.contractDebt = contract.remainingAmount || 0;
        if (contract.nextPaymentDate) {
            updateData.nextPaymentDate = contract.nextPaymentDate;
        }
        console.log(`[onContractCreate] Setting student status to Nợ hợp đồng (${contract.remainingAmount}đ)`);
    }
    else if (contract.category === 'Hợp đồng mới' && (studentData === null || studentData === void 0 ? void 0 : studentData.status) === 'Học thử') {
        updateData.status = 'Đang học';
    }
    await studentRef.update(updateData);
    console.log(`[onContractCreate] Updated student ${contract.studentId} with ${newSessions} sessions`);
    // Check if enrollment already exists (avoid duplicate)
    // Use studentId + contractId for duplicate check (matches client-side logic)
    const existingEnrollment = await db.collection('enrollments')
        .where('studentId', '==', contract.studentId)
        .where('contractId', '==', contractId)
        .limit(1)
        .get();
    if (existingEnrollment.empty) {
        // Create enrollment record with PAID sessions
        // Use actual contract code if available, fallback to document ID
        const actualContractCode = contract.code || contractId;
        const enrollmentData = {
            studentId: contract.studentId,
            studentName: contract.studentName || '',
            // Use contract.classId (from dropdown), fallback to items[0] for backward compatibility
            classId: contract.classId || ((_a = contract.items[0]) === null || _a === void 0 ? void 0 : _a.id) || '',
            className: contract.className || ((_b = contract.items[0]) === null || _b === void 0 ? void 0 : _b.name) || '',
            sessions: paidSessions,
            type: contract.category || 'Hợp đồng mới',
            contractCode: actualContractCode,
            contractId: contractId,
            originalAmount: contract.totalAmount,
            finalAmount: contract.paidAmount || contract.totalAmount,
            createdDate: new Date().toLocaleDateString('vi-VN'),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: contract.createdBy || 'System',
            note: contract.status === 'Nợ hợp đồng'
                ? `HĐ ${contractId} - Thanh toán ${Math.round((paidAmount / totalAmount) * 100)}% (${paidSessions}/${totalSessions} buổi)`
                : `HĐ ${contractId} - ${contract.category || 'Hợp đồng mới'}`,
        };
        await db.collection('enrollments').add(enrollmentData);
        console.log(`[onContractCreate] Created enrollment: ${paidSessions} sessions`);
    }
    else {
        console.log(`[onContractCreate] Enrollment already exists for ${contractId}, skipping`);
    }
    return null;
});
//# sourceMappingURL=contractTriggers.js.map