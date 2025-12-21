/**
 * Validators Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  validatePhone,
  validateEmail,
  validateDateOfBirth,
  validateContractCode,
  validateStudentData,
  validateContractData
} from './validators';

describe('validatePhone', () => {
  it('should accept valid Vietnamese phone numbers', () => {
    expect(validatePhone('0901234567')).toBe(true);
    expect(validatePhone('0381234567')).toBe(true);
    expect(validatePhone('0581234567')).toBe(true);
    expect(validatePhone('0781234567')).toBe(true);
    expect(validatePhone('0851234567')).toBe(true);
  });

  it('should accept +84 and 84 prefixes', () => {
    expect(validatePhone('+84901234567')).toBe(true);
    expect(validatePhone('84901234567')).toBe(true);
  });

  it('should reject invalid phone numbers', () => {
    expect(validatePhone('')).toBe(false);
    expect(validatePhone('123')).toBe(false);
    expect(validatePhone('0123456789')).toBe(false); // Wrong prefix (01)
    expect(validatePhone('abc')).toBe(false);
  });

  it('should handle phone numbers with spaces/dashes', () => {
    expect(validatePhone('090 123 4567')).toBe(true);
    expect(validatePhone('090-123-4567')).toBe(true);
  });
});

describe('validateEmail', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@domain.vn')).toBe(true);
    expect(validateEmail('user+tag@domain.co.uk')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('notanemail')).toBe(false);
    expect(validateEmail('@nodomain')).toBe(false);
    expect(validateEmail('no@tld')).toBe(false);
    expect(validateEmail('spaces in@email.com')).toBe(false);
  });

  it('should allow empty email (optional field)', () => {
    expect(validateEmail('')).toBe(true);
  });
});

describe('validateDateOfBirth', () => {
  it('should accept valid DOB', () => {
    expect(validateDateOfBirth('2000-01-15')).toBe(true);
    expect(validateDateOfBirth('1990-12-31')).toBe(true);
    expect(validateDateOfBirth('2010-06-15')).toBe(true);
  });

  it('should reject future dates', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    expect(validateDateOfBirth(futureDate.toISOString())).toBe(false);
  });

  it('should reject unreasonable ages (>120 years)', () => {
    expect(validateDateOfBirth('1800-01-01')).toBe(false);
    expect(validateDateOfBirth('1890-01-01')).toBe(false);
  });

  it('should reject empty or invalid date formats', () => {
    expect(validateDateOfBirth('')).toBe(false);
    expect(validateDateOfBirth('not-a-date')).toBe(false);
    expect(validateDateOfBirth('invalid')).toBe(false);
  });
});

describe('validateContractCode', () => {
  it('should accept valid contract codes', () => {
    expect(validateContractCode('HD-20231215-0001')).toBe(true);
    expect(validateContractCode('HD-20241231-9999')).toBe(true);
    expect(validateContractCode('HD-20250101-0123')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(validateContractCode('')).toBe(false);
    expect(validateContractCode('HD-123-456')).toBe(false);
    expect(validateContractCode('CONTRACT-20231215-0001')).toBe(false);
    expect(validateContractCode('HD20231215-0001')).toBe(false);
    expect(validateContractCode('HD-2023121-0001')).toBe(false); // 7 digits date
  });
});

describe('validateStudentData', () => {
  it('should return valid for correct data', () => {
    const result = validateStudentData({
      fullName: 'Nguyen Van A',
      phone: '0901234567',
      email: 'test@example.com',
      dob: '2000-01-15'
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept data with name field instead of fullName', () => {
    const result = validateStudentData({
      name: 'Nguyen Van A',
      phone: '0901234567'
    });
    expect(result.valid).toBe(true);
  });

  it('should require name', () => {
    const result = validateStudentData({
      phone: '0901234567'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Tên học viên không được để trống');
  });

  it('should collect multiple errors', () => {
    const result = validateStudentData({
      fullName: '',
      phone: 'invalid',
      email: 'notanemail',
      dob: 'invalid-date'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('should allow optional fields when empty', () => {
    const result = validateStudentData({
      fullName: 'Test Student'
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateContractData', () => {
  it('should return valid for correct data', () => {
    const result = validateContractData({
      studentId: 'student-123',
      classId: 'class-456',
      amount: 1000000
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require studentId', () => {
    const result = validateContractData({
      classId: 'class-456'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Phải chọn học viên');
  });

  it('should require classId', () => {
    const result = validateContractData({
      studentId: 'student-123'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Phải chọn lớp học');
  });

  it('should reject negative amounts', () => {
    const result = validateContractData({
      studentId: 'student-123',
      classId: 'class-456',
      amount: -1000
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Số tiền không hợp lệ');
  });
});
