import { Student } from '@/types';

/**
 * StudentSessionData - Dữ liệu session đã được normalize
 * Trả về số buổi đăng ký, đã học (mới + cũ), và còn lại cho học sinh
 */
export interface StudentSessionData {
  registered: number;      // Số buổi đăng ký/đóng tiền
  attended: number;        // Số buổi đã học (hệ thống mới)
  legacyAttended: number;  // Số buổi đã học (hệ thống cũ)
  remaining: number;       // Số buổi còn lại (âm = nợ)
}

/**
 * Lấy dữ liệu session của học sinh từ classProgress (ưu tiên) hoặc legacy fields (fallback)
 *
 * Flow:
 * 1. Nếu có classProgress[classId] → dùng dữ liệu từ đó
 * 2. Nếu không → fallback về registeredSessions/attendedSessions (legacy)
 * 3. Nếu student null → trả về zeros
 *
 * @param student - Student object (có thể null)
 * @returns StudentSessionData với registered, attended, legacyAttended, remaining
 *
 * @example
 * const { registered, attended, legacyAttended, remaining } = getStudentSessionData(student);
 * if (remaining < 0) showDebtWarning();
 */
export function getStudentSessionData(student: Student | null): StudentSessionData {
  if (!student) {
    return { registered: 0, attended: 0, legacyAttended: 0, remaining: 0 };
  }

  const legacyAttended = student.legacyAttendedSessions || 0;
  const classId = student.classId;

  // Ưu tiên: đọc từ classProgress nếu classId valid và có data
  const progress = (classId && student.classProgress) ? student.classProgress[classId] : null;

  if (progress) {
    const registered = progress.registeredSessions || 0;
    const attended = progress.attendedSessions || 0;
    return {
      registered,
      attended,
      legacyAttended,
      remaining: registered - attended - legacyAttended
    };
  }

  // Fallback: dùng legacy fields
  const registered = student.registeredSessions || 0;
  const attended = student.attendedSessions || 0;
  return {
    registered,
    attended,
    legacyAttended,
    remaining: registered - attended - legacyAttended
  };
}
