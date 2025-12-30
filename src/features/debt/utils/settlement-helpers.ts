/**
 * Settlement Helper Utilities
 * Extracted for testability and reusability
 */

import { SettlementStatus } from '../../../../types';

/**
 * Prepare student update object based on settlement type
 * @param settlementType - 'Đã thanh toán' or 'Nợ xấu'
 * @param debtSessions - Number of debt sessions
 * @param totalAmount - Total debt amount
 * @param note - Optional note
 * @returns Student update object for Firestore
 */
export function prepareStudentUpdate(
  settlementType: SettlementStatus,
  debtSessions: number,
  totalAmount: number,
  note?: string
): Record<string, unknown> {
  // Base update - always set status to "Nghỉ học" and clear class
  const studentUpdate: Record<string, unknown> = {
    status: 'Nghỉ học',
    classId: null,
    classIds: [],
    class: null,
  };

  // Clear bad debt fields when PAID
  if (settlementType === 'Đã thanh toán') {
    studentUpdate.badDebt = false;
    studentUpdate.badDebtSessions = 0;
    studentUpdate.badDebtAmount = 0;
    studentUpdate.badDebtDate = null;
    studentUpdate.badDebtNote = null;
  }

  // Set bad debt fields when NOT PAID
  if (settlementType === 'Nợ xấu') {
    studentUpdate.badDebt = true;
    studentUpdate.badDebtSessions = debtSessions;
    studentUpdate.badDebtAmount = totalAmount;
    studentUpdate.badDebtDate = new Date().toISOString();
    studentUpdate.badDebtNote = note || `Nợ ${debtSessions} buổi - Tất toán`;
  }

  return studentUpdate;
}

/**
 * Calculate debt sessions from student attendance
 */
export function calculateDebtSessions(
  attendedSessions: number,
  registeredSessions: number
): number {
  return Math.max(0, attendedSessions - registeredSessions);
}

/**
 * Calculate total debt amount
 */
export function calculateDebtAmount(
  debtSessions: number,
  pricePerSession: number = 150000
): number {
  return debtSessions * pricePerSession;
}
