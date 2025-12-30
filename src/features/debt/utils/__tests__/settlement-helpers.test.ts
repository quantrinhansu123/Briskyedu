/**
 * Settlement Helpers Unit Tests
 * Tests business logic for student update preparation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  prepareStudentUpdate,
  calculateDebtSessions,
  calculateDebtAmount,
} from '../settlement-helpers';

describe('settlement-helpers', () => {
  describe('prepareStudentUpdate', () => {
    describe('when settlementType is "Đã thanh toán"', () => {
      it('should set badDebt to false', () => {
        const result = prepareStudentUpdate('Đã thanh toán', 2, 300000);

        expect(result.badDebt).toBe(false);
      });

      it('should clear all badDebt fields', () => {
        const result = prepareStudentUpdate('Đã thanh toán', 2, 300000, 'Test note');

        expect(result.badDebt).toBe(false);
        expect(result.badDebtSessions).toBe(0);
        expect(result.badDebtAmount).toBe(0);
        expect(result.badDebtDate).toBeNull();
        expect(result.badDebtNote).toBeNull();
      });

      it('should set status to "Nghỉ học"', () => {
        const result = prepareStudentUpdate('Đã thanh toán', 2, 300000);

        expect(result.status).toBe('Nghỉ học');
      });

      it('should clear class fields', () => {
        const result = prepareStudentUpdate('Đã thanh toán', 2, 300000);

        expect(result.classId).toBeNull();
        expect(result.classIds).toEqual([]);
        expect(result.class).toBeNull();
      });

      it('should NOT modify registeredSessions', () => {
        const result = prepareStudentUpdate('Đã thanh toán', 2, 300000);

        expect(result.registeredSessions).toBeUndefined();
      });
    });

    describe('when settlementType is "Nợ xấu"', () => {
      it('should set badDebt to true', () => {
        const result = prepareStudentUpdate('Nợ xấu', 2, 300000);

        expect(result.badDebt).toBe(true);
      });

      it('should set all badDebt fields correctly', () => {
        const result = prepareStudentUpdate('Nợ xấu', 2, 300000, 'Custom note');

        expect(result.badDebt).toBe(true);
        expect(result.badDebtSessions).toBe(2);
        expect(result.badDebtAmount).toBe(300000);
        expect(result.badDebtDate).toBeDefined();
        expect(result.badDebtNote).toBe('Custom note');
      });

      it('should use default note if not provided', () => {
        const result = prepareStudentUpdate('Nợ xấu', 3, 450000);

        expect(result.badDebtNote).toBe('Nợ 3 buổi - Tất toán');
      });

      it('should set status to "Nghỉ học"', () => {
        const result = prepareStudentUpdate('Nợ xấu', 2, 300000);

        expect(result.status).toBe('Nghỉ học');
      });

      it('should clear class fields', () => {
        const result = prepareStudentUpdate('Nợ xấu', 2, 300000);

        expect(result.classId).toBeNull();
        expect(result.classIds).toEqual([]);
        expect(result.class).toBeNull();
      });

      it('should set badDebtDate to ISO string format', () => {
        const result = prepareStudentUpdate('Nợ xấu', 2, 300000);

        // Verify it's a valid ISO date string
        const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        expect(result.badDebtDate).toMatch(dateRegex);
      });
    });
  });

  describe('calculateDebtSessions', () => {
    it('should return positive debt when attended > registered', () => {
      expect(calculateDebtSessions(12, 10)).toBe(2);
    });

    it('should return 0 when attended <= registered', () => {
      expect(calculateDebtSessions(10, 10)).toBe(0);
      expect(calculateDebtSessions(8, 10)).toBe(0);
    });

    it('should handle 0 values', () => {
      expect(calculateDebtSessions(0, 0)).toBe(0);
      expect(calculateDebtSessions(5, 0)).toBe(5);
    });
  });

  describe('calculateDebtAmount', () => {
    it('should calculate with default price (150000)', () => {
      expect(calculateDebtAmount(2)).toBe(300000);
      expect(calculateDebtAmount(1)).toBe(150000);
    });

    it('should calculate with custom price', () => {
      expect(calculateDebtAmount(2, 200000)).toBe(400000);
    });

    it('should return 0 for 0 sessions', () => {
      expect(calculateDebtAmount(0)).toBe(0);
    });
  });
});
