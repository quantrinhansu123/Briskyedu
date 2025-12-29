/**
 * Staff Cloud Functions
 *
 * Handles staff account management that requires Admin SDK:
 * - Password updates by admin
 * - Account deletion
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const auth = admin.auth();

/**
 * Update staff password (callable by admin)
 * Required: caller must have admin/manager role
 */
export const updateStaffPassword = functions.https.onCall(async (data, context) => {
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
  const callerRole = callerData?.role || '';
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
    const uid = staffData?.uid || staffId;

    // Update password in Firebase Auth
    await auth.updateUser(uid, {
      password: newPassword,
    });

    // Log the action
    await db.collection('auditLogs').add({
      action: 'PASSWORD_UPDATED',
      targetStaffId: staffId,
      targetStaffName: staffData?.name || '',
      performedBy: context.auth.uid,
      performedByName: callerData?.name || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: 'Đã cập nhật mật khẩu thành công!' };
  } catch (error: any) {
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
export const createStaffAccount = functions.https.onCall(async (data, context) => {
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
  const callerRole = callerData?.role || '';
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
    if (staffData?.uid) {
      throw new functions.https.HttpsError('already-exists', 'Nhân viên đã có tài khoản.');
    }

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: staffData?.name || '',
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
      targetStaffName: staffData?.name || '',
      performedBy: context.auth.uid,
      performedByName: callerData?.name || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: 'Đã tạo tài khoản thành công!', uid: userRecord.uid };
  } catch (error: any) {
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
