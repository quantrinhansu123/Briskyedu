/**
 * Bad Debt Logic Unit Tests
 * Tests the pure business logic for Cloud Function bad debt handling
 * These functions are used by functions/src/triggers/studentTriggers.ts
 */

import { describe, it, expect } from 'vitest';

// Type definitions (mirroring the Cloud Function helpers)
interface SettlementCheckResult {
  hasBadDebtInvoice: boolean;
  hasPaidInvoice: boolean;
  paidInvoiceCode?: string;
}

/**
 * Pure logic function - determines action for bad debt
 */
function shouldAutoSetBadDebt(
  attendedSessions: number,
  registeredSessions: number,
  settlementResult: SettlementCheckResult
): 'keep-bad-debt' | 'clear-bad-debt' | 'auto-set-bad-debt' | 'no-action' {
  // Has bad debt invoice → keep bad debt
  if (settlementResult.hasBadDebtInvoice) {
    return 'keep-bad-debt';
  }

  // Has paid invoice → clear bad debt
  if (settlementResult.hasPaidInvoice) {
    return 'clear-bad-debt';
  }

  // No invoice, check if has debt
  if (attendedSessions > registeredSessions) {
    return 'auto-set-bad-debt';
  }

  return 'no-action';
}

describe('bad-debt-logic', () => {
  describe('shouldAutoSetBadDebt', () => {
    describe('when student has "Nợ xấu" settlement invoice', () => {
      it('should return "keep-bad-debt" even if attended > registered', () => {
        const result = shouldAutoSetBadDebt(12, 10, {
          hasBadDebtInvoice: true,
          hasPaidInvoice: false,
        });

        expect(result).toBe('keep-bad-debt');
      });

      it('should return "keep-bad-debt" regardless of sessions', () => {
        const result = shouldAutoSetBadDebt(10, 10, {
          hasBadDebtInvoice: true,
          hasPaidInvoice: false,
        });

        expect(result).toBe('keep-bad-debt');
      });
    });

    describe('when student has paid settlement invoice', () => {
      it('should return "clear-bad-debt" even if attended > registered', () => {
        const result = shouldAutoSetBadDebt(12, 10, {
          hasBadDebtInvoice: false,
          hasPaidInvoice: true,
          paidInvoiceCode: 'STL-TEST-001',
        });

        expect(result).toBe('clear-bad-debt');
      });

      it('should return "clear-bad-debt" regardless of sessions', () => {
        const result = shouldAutoSetBadDebt(10, 10, {
          hasBadDebtInvoice: false,
          hasPaidInvoice: true,
        });

        expect(result).toBe('clear-bad-debt');
      });
    });

    describe('when student has NO settlement invoice', () => {
      it('should return "auto-set-bad-debt" if attended > registered', () => {
        const result = shouldAutoSetBadDebt(12, 10, {
          hasBadDebtInvoice: false,
          hasPaidInvoice: false,
        });

        expect(result).toBe('auto-set-bad-debt');
      });

      it('should return "no-action" if attended = registered', () => {
        const result = shouldAutoSetBadDebt(10, 10, {
          hasBadDebtInvoice: false,
          hasPaidInvoice: false,
        });

        expect(result).toBe('no-action');
      });

      it('should return "no-action" if attended < registered', () => {
        const result = shouldAutoSetBadDebt(8, 10, {
          hasBadDebtInvoice: false,
          hasPaidInvoice: false,
        });

        expect(result).toBe('no-action');
      });
    });

    describe('Option B (Strict) logic - bad debt takes priority', () => {
      it('should return "keep-bad-debt" even if also has paid invoice', () => {
        // Edge case: has both bad debt and paid invoices
        // Option B: Any bad debt invoice = keep bad debt
        const result = shouldAutoSetBadDebt(12, 10, {
          hasBadDebtInvoice: true,
          hasPaidInvoice: true, // Even with paid, bad debt takes priority
        });

        expect(result).toBe('keep-bad-debt');
      });
    });
  });

  describe('Integration scenarios', () => {
    it('Scenario 1: Annie - paid settlement should clear bad debt', () => {
      // Annie has:
      // - registeredSessions: 1
      // - attendedSessions: 2
      // - Settlement invoice: "Đã thanh toán"
      const result = shouldAutoSetBadDebt(2, 1, {
        hasBadDebtInvoice: false,
        hasPaidInvoice: true,
        paidInvoiceCode: 'STL-20251229-217',
      });

      expect(result).toBe('clear-bad-debt');
    });

    it('Scenario 2: Student drops out without settlement', () => {
      // Student just changes status to "Nghỉ học" without any settlement
      const result = shouldAutoSetBadDebt(15, 12, {
        hasBadDebtInvoice: false,
        hasPaidInvoice: false,
      });

      expect(result).toBe('auto-set-bad-debt');
    });

    it('Scenario 3: Student settles with "Nợ xấu"', () => {
      // Student doesn't pay, creates "Nợ xấu" invoice
      const result = shouldAutoSetBadDebt(15, 12, {
        hasBadDebtInvoice: true,
        hasPaidInvoice: false,
      });

      expect(result).toBe('keep-bad-debt');
    });

    it('Scenario 4: Student with no debt drops out', () => {
      // Student has no debt (attended <= registered)
      const result = shouldAutoSetBadDebt(10, 15, {
        hasBadDebtInvoice: false,
        hasPaidInvoice: false,
      });

      expect(result).toBe('no-action');
    });
  });
});
