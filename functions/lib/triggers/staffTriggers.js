"use strict";
/**
 * Staff Cloud Functions
 *
 * Handles staff account management that requires Admin SDK:
 * - Password updates by admin
 * - Account deletion
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
exports.registerStaffWithAccount = exports.createStaffAccount = exports.updateStaffPassword = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const auth = admin.auth();
const REGION = 'asia-southeast1';
/**
 * FK reference configurations for staff document migration
 * Lists all collections and fields that reference staffId
 */
const STAFF_FK_REFERENCES = [
    { collection: 'classes', field: 'teacherId' },
    { collection: 'classes', field: 'assistantId' },
    { collection: 'workSessions', field: 'staffId' },
    { collection: 'leaveRequests', field: 'staffId' },
    { collection: 'leaveRequests', field: 'approvedBy' },
    { collection: 'leaveBalances', field: 'staffId' },
    { collection: 'staffAttendance', field: 'staffId' },
    { collection: 'staffSalaries', field: 'staffId' },
    { collection: 'actualSalaries', field: 'staffId' },
    { collection: 'homeworkRecords', field: 'assignedBy' },
    { collection: 'monthlyComments', field: 'staffId' },
];
/**
 * Update all FK references from oldId to newId
 * Collects all updates and adds them to the batch
 * @returns number of documents updated
 */
async function collectStaffReferenceUpdates(batch, oldId, newId) {
    let updateCount = 0;
    for (const { collection, field } of STAFF_FK_REFERENCES) {
        const snapshot = await db.collection(collection)
            .where(field, '==', oldId)
            .get();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { [field]: newId });
            updateCount++;
        });
    }
    return updateCount;
}
/**
 * Migrate staff document ID to new Auth UID
 * Creates new doc with Auth UID, updates all FK references, deletes old doc
 * All operations in single batch for atomicity
 */
async function migrateStaffDocId(staffId, newAuthUid, staffData, email, password, // Plain password to store for admin viewing
callerUid, callerName) {
    const batch = db.batch();
    // 1. Create new staff doc with Auth UID as ID
    const newStaffRef = db.collection('staff').doc(newAuthUid);
    batch.set(newStaffRef, {
        ...staffData,
        uid: newAuthUid,
        email: email,
        plainPassword: password, // Store plain password for admin viewing (internal use only)
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // 2. Collect all FK reference updates
    const updatedRefs = await collectStaffReferenceUpdates(batch, staffId, newAuthUid);
    // Check batch limit (max 500 ops: 1 new doc + N refs + 1 delete + 1 audit)
    const MAX_BATCH_OPS = 500;
    const totalOps = 1 + updatedRefs + 1 + 1; // new + refs + delete + audit
    if (totalOps > MAX_BATCH_OPS) {
        throw new Error(`Too many FK references (${updatedRefs}). Max allowed: ${MAX_BATCH_OPS - 3}. ` +
            'Please contact admin to manually migrate this staff.');
    }
    // 3. Delete old staff doc
    const oldStaffRef = db.collection('staff').doc(staffId);
    batch.delete(oldStaffRef);
    // 4. Add audit log
    const auditRef = db.collection('auditLogs').doc();
    batch.set(auditRef, {
        action: 'STAFF_DOC_MIGRATED',
        oldStaffId: staffId,
        newStaffId: newAuthUid,
        updatedReferences: updatedRefs,
        performedBy: callerUid,
        performedByName: callerName,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    // 5. Commit all changes atomically
    await batch.commit();
    return { success: true, updatedRefs };
}
/**
 * Update staff password (callable by admin)
 * Required: caller must have admin/manager role
 */
exports.updateStaffPassword = functions.region(REGION).https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Bạn cần đăng nhập để thực hiện thao tác này.');
    }
    // Check caller permissions
    const callerDoc = await db.collection('staff').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Không tìm thấy thông tin người dùng.');
    }
    const callerData = callerDoc.data();
    const callerRole = (callerData === null || callerData === void 0 ? void 0 : callerData.role) || '';
    const allowedRoles = ['Quản trị viên', 'Quản lý'];
    if (!allowedRoles.includes(callerRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền đổi mật khẩu nhân viên.');
    }
    // Validate input
    const { staffId, newPassword } = data;
    if (!staffId || typeof staffId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Thiếu ID nhân viên.');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Mật khẩu phải có ít nhất 6 ký tự.');
    }
    try {
        // Get staff document to find UID
        const staffDoc = await db.collection('staff').doc(staffId).get();
        if (!staffDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Không tìm thấy nhân viên.');
        }
        const staffData = staffDoc.data();
        const uid = (staffData === null || staffData === void 0 ? void 0 : staffData.uid) || staffId;
        // Update password in Firebase Auth
        await auth.updateUser(uid, {
            password: newPassword,
        });
        // Update plain password in Firestore for admin viewing
        await db.collection('staff').doc(staffId).update({
            plainPassword: newPassword,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Log the action
        await db.collection('auditLogs').add({
            action: 'PASSWORD_UPDATED',
            targetStaffId: staffId,
            targetStaffName: (staffData === null || staffData === void 0 ? void 0 : staffData.name) || '',
            performedBy: context.auth.uid,
            performedByName: (callerData === null || callerData === void 0 ? void 0 : callerData.name) || '',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, message: 'Đã cập nhật mật khẩu thành công!' };
    }
    catch (error) {
        console.error('Error updating password:', error);
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'Tài khoản chưa được tạo hoặc đã bị xóa.');
        }
        throw new functions.https.HttpsError('internal', error.message || 'Có lỗi xảy ra khi đổi mật khẩu.');
    }
});
/**
 * Create staff account for existing staff document (callable by admin)
 * Use when staff was created without account
 */
exports.createStaffAccount = functions.region(REGION).https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Bạn cần đăng nhập để thực hiện thao tác này.');
    }
    // Check caller permissions
    const callerDoc = await db.collection('staff').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Không tìm thấy thông tin người dùng.');
    }
    const callerData = callerDoc.data();
    const callerRole = (callerData === null || callerData === void 0 ? void 0 : callerData.role) || '';
    const allowedRoles = ['Quản trị viên', 'Quản lý'];
    if (!allowedRoles.includes(callerRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền tạo tài khoản nhân viên.');
    }
    // Validate input
    const { staffId, email, password } = data;
    if (!staffId || typeof staffId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Thiếu ID nhân viên.');
    }
    if (!email || typeof email !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Thiếu email đăng nhập.');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Mật khẩu phải có ít nhất 6 ký tự.');
    }
    try {
        // Get staff document
        const staffDoc = await db.collection('staff').doc(staffId).get();
        if (!staffDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Không tìm thấy nhân viên.');
        }
        const staffData = staffDoc.data();
        // Check if already has account
        if (staffData === null || staffData === void 0 ? void 0 : staffData.uid) {
            throw new functions.https.HttpsError('already-exists', 'Nhân viên đã có tài khoản.');
        }
        // Check if email is already used by another staff
        const existingStaffWithEmail = await db.collection('staff')
            .where('email', '==', email)
            .limit(1)
            .get();
        if (!existingStaffWithEmail.empty) {
            const existingDoc = existingStaffWithEmail.docs[0];
            if (existingDoc.id !== staffId) {
                throw new functions.https.HttpsError('already-exists', 'Email này đã được sử dụng bởi nhân viên khác.');
            }
        }
        // Create Firebase Auth user
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: (staffData === null || staffData === void 0 ? void 0 : staffData.name) || '',
        });
        try {
            // Migrate staff doc ID to Auth UID (instead of just updating uid field)
            // This ensures isStaff() rule works: exists(staff/{auth.uid})
            const migrationResult = await migrateStaffDocId(staffId, userRecord.uid, staffData, email, password, // Pass plain password to store
            context.auth.uid, (callerData === null || callerData === void 0 ? void 0 : callerData.name) || '');
            // Log the account creation action
            await db.collection('auditLogs').add({
                action: 'ACCOUNT_CREATED',
                targetStaffId: userRecord.uid, // New ID after migration
                oldStaffId: staffId,
                targetStaffName: (staffData === null || staffData === void 0 ? void 0 : staffData.name) || '',
                updatedReferences: migrationResult.updatedRefs,
                performedBy: context.auth.uid,
                performedByName: (callerData === null || callerData === void 0 ? void 0 : callerData.name) || '',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return {
                success: true,
                message: `Đã tạo tài khoản thành công! (${migrationResult.updatedRefs} references updated)`,
                uid: userRecord.uid,
            };
        }
        catch (migrationError) {
            // If migration fails, delete the created Auth user to avoid orphan
            console.error('Migration failed, rolling back Auth user:', migrationError);
            await auth.deleteUser(userRecord.uid);
            throw new functions.https.HttpsError('internal', 'Không thể migrate staff document. Vui lòng thử lại.');
        }
    }
    catch (error) {
        console.error('Error creating account:', error);
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'Email này đã được sử dụng.');
        }
        if (error.code === 'auth/invalid-email') {
            throw new functions.https.HttpsError('invalid-argument', 'Email không hợp lệ.');
        }
        throw new functions.https.HttpsError('internal', error.message || 'Có lỗi xảy ra khi tạo tài khoản.');
    }
});
/**
 * Register new staff WITH account in one step (callable by admin)
 * Creates both Auth user and Firestore staff document atomically
 * Uses Admin SDK so no auto-login occurs on client
 */
exports.registerStaffWithAccount = functions.region(REGION).https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Bạn cần đăng nhập để thực hiện thao tác này.');
    }
    // Check caller permissions
    const callerDoc = await db.collection('staff').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Không tìm thấy thông tin người dùng.');
    }
    const callerData = callerDoc.data();
    const callerRole = (callerData === null || callerData === void 0 ? void 0 : callerData.role) || '';
    const allowedRoles = ['Quản trị viên', 'Quản lý'];
    if (!allowedRoles.includes(callerRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền tạo nhân viên.');
    }
    // Validate input
    const { email, password, staffData } = data;
    if (!email || typeof email !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Thiếu email đăng nhập.');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Mật khẩu phải có ít nhất 6 ký tự.');
    }
    if (!staffData || !staffData.name) {
        throw new functions.https.HttpsError('invalid-argument', 'Thiếu thông tin nhân viên.');
    }
    try {
        // Check if email is already used
        const existingStaffWithEmail = await db.collection('staff')
            .where('email', '==', email)
            .limit(1)
            .get();
        if (!existingStaffWithEmail.empty) {
            throw new functions.https.HttpsError('already-exists', 'Email này đã được sử dụng.');
        }
        // Create Firebase Auth user (Admin SDK - no auto-login!)
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: staffData.name,
        });
        try {
            // Determine permissions based on role
            const isAdmin = staffData.role === 'Quản trị viên' || staffData.role === 'Quản lý';
            // Create staff document with Auth UID as document ID
            await db.collection('staff').doc(userRecord.uid).set({
                uid: userRecord.uid,
                email: email,
                plainPassword: password, // Store plain password for admin viewing (internal use only)
                name: staffData.name,
                code: staffData.code || `NV${Date.now().toString().slice(-6)}`,
                role: staffData.role || 'Nhân viên',
                roles: staffData.roles || [staffData.role || 'Nhân viên'],
                department: staffData.department || 'Văn phòng',
                position: staffData.position || 'Nhân viên',
                phone: staffData.phone || '',
                dob: staffData.dob || '',
                startDate: staffData.startDate || new Date().toISOString().split('T')[0],
                branch: staffData.branch || '',
                status: 'Active',
                permissions: {
                    canManageStudents: isAdmin,
                    canManageClasses: isAdmin,
                    canManageStaff: isAdmin,
                    canManageFinance: isAdmin,
                    canViewReports: true,
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Log the action
            await db.collection('auditLogs').add({
                action: 'STAFF_REGISTERED_WITH_ACCOUNT',
                targetStaffId: userRecord.uid,
                targetStaffName: staffData.name,
                performedBy: context.auth.uid,
                performedByName: (callerData === null || callerData === void 0 ? void 0 : callerData.name) || '',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return {
                success: true,
                message: 'Đã tạo nhân viên với tài khoản đăng nhập thành công!',
                uid: userRecord.uid,
            };
        }
        catch (firestoreError) {
            // If Firestore fails, delete the created Auth user to avoid orphan
            console.error('Firestore failed, rolling back Auth user:', firestoreError);
            await auth.deleteUser(userRecord.uid);
            throw new functions.https.HttpsError('internal', 'Không thể tạo staff document. Vui lòng thử lại.');
        }
    }
    catch (error) {
        console.error('Error registering staff with account:', error);
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'Email này đã được sử dụng trong Firebase Auth.');
        }
        if (error.code === 'auth/invalid-email') {
            throw new functions.https.HttpsError('invalid-argument', 'Email không hợp lệ.');
        }
        // Re-throw HttpsError as-is
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Có lỗi xảy ra khi tạo tài khoản.');
    }
});
//# sourceMappingURL=staffTriggers.js.map