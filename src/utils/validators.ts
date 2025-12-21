/**
 * Input Validation Utilities
 * Validate user input before processing
 */

/**
 * Vietnamese phone number validation
 * Supports: 0xx, +84xx, 84xx formats
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s-]/g, '');
  // Vietnamese phone: starts with 0, +84, or 84, followed by 9-10 digits
  const phoneRegex = /^(\+?84|0)(3|5|7|8|9)\d{8}$/;
  return phoneRegex.test(cleaned);
};

/**
 * Email format validation
 */
export const validateEmail = (email: string): boolean => {
  if (!email) return true; // Email may be optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Date of birth validation
 * Must be in past, reasonable age range (1-120 years)
 */
export const validateDateOfBirth = (dob: string): boolean => {
  if (!dob) return false;
  const date = new Date(dob);
  if (isNaN(date.getTime())) return false;

  const now = new Date();
  const age = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return age > 0 && age < 120;
};

/**
 * Contract code format validation
 * Format: HD-YYYYMMDD-XXXX
 */
export const validateContractCode = (code: string): boolean => {
  if (!code) return false;
  const codeRegex = /^HD-\d{8}-\d{4}$/;
  return codeRegex.test(code);
};

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate student data before creation
 */
export const validateStudentData = (data: {
  fullName?: string;
  name?: string;
  phone?: string;
  email?: string;
  dob?: string;
}): ValidationResult => {
  const errors: string[] = [];
  const name = data.fullName || data.name;

  if (!name?.trim()) {
    errors.push('Tên học viên không được để trống');
  }

  if (data.phone && !validatePhone(data.phone)) {
    errors.push('Số điện thoại không hợp lệ');
  }

  if (data.email && !validateEmail(data.email)) {
    errors.push('Email không hợp lệ');
  }

  if (data.dob && !validateDateOfBirth(data.dob)) {
    errors.push('Ngày sinh không hợp lệ');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate contract data before creation
 */
export const validateContractData = (data: {
  contractCode?: string;
  studentId?: string;
  classId?: string;
  amount?: number;
}): ValidationResult => {
  const errors: string[] = [];

  if (!data.studentId?.trim()) {
    errors.push('Phải chọn học viên');
  }

  if (!data.classId?.trim()) {
    errors.push('Phải chọn lớp học');
  }

  if (data.amount !== undefined && data.amount < 0) {
    errors.push('Số tiền không hợp lệ');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
