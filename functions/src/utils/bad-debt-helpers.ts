/**
 * Bad Debt Helper Utilities for Cloud Functions
 * Extracted for testability
 */

import * as admin from 'firebase-admin';

const PRICE_PER_SESSION = 150000;

export interface SettlementCheckResult {
  hasBadDebtInvoice: boolean;
  hasPaidInvoice: boolean;
  paidInvoiceCode?: string;
}

/**
 * Check student's settlement invoice status
 * Returns info about paid and bad debt invoices
 */
export async function checkSettlementStatus(
  db: admin.firestore.Firestore,
  studentId: string
): Promise<SettlementCheckResult> {
  // Check for "Nợ xấu" invoices first (Option B - Strict)
  const badDebtInvoices = await db.collection('settlementInvoices')
    .where('studentId', '==', studentId)
    .where('status', '==', 'Nợ xấu')
    .limit(1)
    .get();

  if (!badDebtInvoices.empty) {
    return {
      hasBadDebtInvoice: true,
      hasPaidInvoice: false,
    };
  }

  // Check for paid invoices
  const paidInvoices = await db.collection('settlementInvoices')
    .where('studentId', '==', studentId)
    .where('status', '==', 'Đã thanh toán')
    .limit(1)
    .get();

  if (!paidInvoices.empty) {
    return {
      hasBadDebtInvoice: false,
      hasPaidInvoice: true,
      paidInvoiceCode: paidInvoices.docs[0].data().invoiceCode || 'N/A',
    };
  }

  return {
    hasBadDebtInvoice: false,
    hasPaidInvoice: false,
  };
}

/**
 * Prepare bad debt update object
 */
export function prepareBadDebtUpdate(
  debtSessions: number
): Record<string, unknown> {
  return {
    badDebt: true,
    badDebtSessions: debtSessions,
    badDebtAmount: debtSessions * PRICE_PER_SESSION,
    badDebtDate: new Date().toLocaleDateString('vi-VN'),
    badDebtNote: `Nghỉ học khi còn nợ ${debtSessions} buổi`,
  };
}

/**
 * Prepare clear bad debt update object
 */
export function prepareClearBadDebtUpdate(
  invoiceCode: string
): Record<string, unknown> {
  return {
    badDebt: false,
    badDebtSessions: 0,
    badDebtAmount: 0,
    badDebtDate: null,
    badDebtNote: `Đã tất toán - ${invoiceCode}`,
  };
}

/**
 * Determine if student should have bad debt auto-set
 */
export function shouldAutoSetBadDebt(
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
