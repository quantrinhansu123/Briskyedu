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
exports.createStaffAccount = exports.updateStaffPassword = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const auth = admin.auth();
/**
 * Update staff password (callable by admin)
 * Required: caller must have admin/manager role
 */
exports.updateStaffPassword = functions.https.onCall(async (data, context) => {
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
exports.createStaffAccount = functions.https.onCall(async (data, context) => {
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
        // Create Firebase Auth user
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: (staffData === null || staffData === void 0 ? void 0 : staffData.name) || '',
        });
        // Update staff document with UID
        await db.collection('staff').doc(staffId).update({
            uid: userRecord.uid,
            email: email,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Log the action
        await db.collection('auditLogs').add({
            action: 'ACCOUNT_CREATED',
            targetStaffId: staffId,
            targetStaffName: (staffData === null || staffData === void 0 ? void 0 : staffData.name) || '',
            performedBy: context.auth.uid,
            performedByName: (callerData === null || callerData === void 0 ? void 0 : callerData.name) || '',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, message: 'Đã tạo tài khoản thành công!', uid: userRecord.uid };
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
//# sourceMappingURL=staffTriggers.js.map