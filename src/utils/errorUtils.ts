/**
 * Error Utilities
 * Sanitize error messages for user display
 */

/**
 * Firebase error code to user-friendly Vietnamese message
 */
const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  // Auth errors - generic messages to prevent enumeration
  'auth/user-not-found': 'Email hoặc mật khẩu không chính xác',
  'auth/wrong-password': 'Email hoặc mật khẩu không chính xác',
  'auth/email-already-in-use': 'Email đã được sử dụng',
  'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự',
  'auth/invalid-email': 'Email không hợp lệ',
  'auth/too-many-requests': 'Quá nhiều yêu cầu. Vui lòng thử lại sau',
  'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác',

  // Firestore errors
  'permission-denied': 'Bạn không có quyền thực hiện thao tác này',
  'not-found': 'Dữ liệu không tồn tại',
  'already-exists': 'Dữ liệu đã tồn tại',
  'resource-exhausted': 'Hệ thống quá tải. Vui lòng thử lại sau',
  'unavailable': 'Dịch vụ tạm thời không khả dụng',

  // Generic
  'network-error': 'Lỗi kết nối mạng',
  'timeout': 'Yêu cầu hết thời gian chờ'
};

const DEFAULT_ERROR = 'Đã xảy ra lỗi. Vui lòng thử lại';

/**
 * Convert Firebase/Firestore error to user-friendly message
 */
export const sanitizeFirebaseError = (error: unknown): string => {
  if (!error) return DEFAULT_ERROR;

  // Firebase error with code
  if (typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    return FIREBASE_ERROR_MESSAGES[code] || DEFAULT_ERROR;
  }

  // String error
  if (typeof error === 'string') {
    // Check if it contains a known code
    for (const [code, message] of Object.entries(FIREBASE_ERROR_MESSAGES)) {
      if (error.includes(code)) return message;
    }
  }

  return DEFAULT_ERROR;
};

/**
 * Log error for debugging, return sanitized message for user
 */
export const handleServiceError = (error: unknown, context: string): never => {
  console.error(`[${context}]`, error);
  throw new Error(sanitizeFirebaseError(error));
};
