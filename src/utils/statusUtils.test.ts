/**
 * Status Utilities Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeStudentStatus,
  getStudentStatusColor,
  getClassStatusColor
} from './statusUtils';
import { StudentStatus, ClassStatus } from '../../types';

describe('normalizeStudentStatus', () => {
  it('should return enum value for Vietnamese status strings', () => {
    expect(normalizeStudentStatus('Đang học')).toBe(StudentStatus.ACTIVE);
    expect(normalizeStudentStatus('Nợ phí')).toBe(StudentStatus.DEBT);
    expect(normalizeStudentStatus('Nợ hợp đồng')).toBe(StudentStatus.CONTRACT_DEBT);
    expect(normalizeStudentStatus('Bảo lưu')).toBe(StudentStatus.RESERVED);
    expect(normalizeStudentStatus('Nghỉ học')).toBe(StudentStatus.DROPPED);
    expect(normalizeStudentStatus('Học thử')).toBe(StudentStatus.TRIAL);
    expect(normalizeStudentStatus('Đã học hết phí')).toBe(StudentStatus.EXPIRED_FEE);
  });

  it('should handle English legacy values', () => {
    expect(normalizeStudentStatus('active')).toBe(StudentStatus.ACTIVE);
    expect(normalizeStudentStatus('debt')).toBe(StudentStatus.DEBT);
    expect(normalizeStudentStatus('reserved')).toBe(StudentStatus.RESERVED);
    expect(normalizeStudentStatus('dropped')).toBe(StudentStatus.DROPPED);
    expect(normalizeStudentStatus('trial')).toBe(StudentStatus.TRIAL);
  });

  it('should pass through existing enum values', () => {
    expect(normalizeStudentStatus(StudentStatus.ACTIVE)).toBe(StudentStatus.ACTIVE);
    expect(normalizeStudentStatus(StudentStatus.DEBT)).toBe(StudentStatus.DEBT);
    expect(normalizeStudentStatus(StudentStatus.TRIAL)).toBe(StudentStatus.TRIAL);
  });

  it('should default to ACTIVE for undefined/empty', () => {
    expect(normalizeStudentStatus(undefined)).toBe(StudentStatus.ACTIVE);
    expect(normalizeStudentStatus('')).toBe(StudentStatus.ACTIVE);
  });

  it('should default to ACTIVE for unknown values', () => {
    expect(normalizeStudentStatus('unknown-status')).toBe(StudentStatus.ACTIVE);
    expect(normalizeStudentStatus('random')).toBe(StudentStatus.ACTIVE);
  });
});

describe('getStudentStatusColor', () => {
  it('should return correct color classes for each status', () => {
    expect(getStudentStatusColor(StudentStatus.ACTIVE)).toContain('green');
    expect(getStudentStatusColor(StudentStatus.DEBT)).toContain('red');
    expect(getStudentStatusColor(StudentStatus.CONTRACT_DEBT)).toContain('orange');
    expect(getStudentStatusColor(StudentStatus.RESERVED)).toContain('yellow');
    expect(getStudentStatusColor(StudentStatus.DROPPED)).toContain('gray');
    expect(getStudentStatusColor(StudentStatus.TRIAL)).toContain('blue');
    expect(getStudentStatusColor(StudentStatus.EXPIRED_FEE)).toContain('purple');
  });

  it('should return Tailwind class format', () => {
    const color = getStudentStatusColor(StudentStatus.ACTIVE);
    expect(color).toMatch(/bg-\w+-\d+ text-\w+-\d+/);
  });
});

describe('getClassStatusColor', () => {
  it('should return correct color classes for each status', () => {
    expect(getClassStatusColor(ClassStatus.STUDYING)).toContain('green');
    expect(getClassStatusColor(ClassStatus.FINISHED)).toContain('gray');
    expect(getClassStatusColor(ClassStatus.PAUSED)).toContain('yellow');
    expect(getClassStatusColor(ClassStatus.PENDING)).toContain('blue');
  });

  it('should return Tailwind class format', () => {
    const color = getClassStatusColor(ClassStatus.STUDYING);
    expect(color).toMatch(/bg-\w+-\d+ text-\w+-\d+/);
  });
});
