/**
 * LeaveBalance Service - Track leave quota per staff per year
 * Auto-calculates from approved leave requests
 */
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { LeaveBalance, LeaveRequest, Staff } from '../../types';

const COLLECTION = 'leaveBalances';
const DEFAULT_QUOTA = 12; // Default annual leave days

export class LeaveBalanceService {
  /**
   * Get balance for a staff for current year
   * Auto-creates if not exists
   */
  static async getBalance(staffId: string, staffName: string, year?: number): Promise<LeaveBalance> {
    const currentYear = year || new Date().getFullYear();
    const balanceId = `${staffId}_${currentYear}`;

    const docRef = doc(db, COLLECTION, balanceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as LeaveBalance;
    }

    // Get staff's custom quota if set
    const staffDoc = await getDoc(doc(db, 'staff', staffId));
    const staffQuota = staffDoc.exists() ? staffDoc.data()?.leaveQuota : undefined;

    // Auto-create balance
    const newBalance: Omit<LeaveBalance, 'id'> = {
      staffId,
      staffName,
      year: currentYear,
      quota: staffQuota ?? DEFAULT_QUOTA,
      used: 0,
      pending: 0,
      remaining: staffQuota ?? DEFAULT_QUOTA,
      lastUpdated: new Date().toISOString(),
    };

    await setDoc(docRef, newBalance);
    return { id: balanceId, ...newBalance };
  }

  /**
   * Recalculate balance from leave requests
   * Call this to sync balance with actual data
   */
  static async recalculateBalance(staffId: string, staffName: string, year?: number): Promise<LeaveBalance> {
    const currentYear = year || new Date().getFullYear();
    const balanceId = `${staffId}_${currentYear}`;

    // Get all leave requests for this staff in this year
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const q = query(
      collection(db, 'leaveRequests'),
      where('staffId', '==', staffId)
    );
    const snapshot = await getDocs(q);

    let usedDays = 0;
    let pendingDays = 0;

    snapshot.docs.forEach(doc => {
      const leave = doc.data() as LeaveRequest;

      // Only count if overlaps with current year and is paid leave (Nghỉ phép)
      if (leave.leaveType !== 'Nghỉ phép') return;
      if (leave.endDate < yearStart || leave.startDate > yearEnd) return;

      const days = LeaveBalanceService.calculateDays(leave.startDate, leave.endDate);

      if (leave.status === 'Đã phê duyệt') {
        usedDays += days;
      } else if (leave.status === 'Chờ phê duyệt') {
        pendingDays += days;
      }
    });

    // Get staff's custom quota
    const staffDoc = await getDoc(doc(db, 'staff', staffId));
    const staffQuota = staffDoc.exists() ? staffDoc.data()?.leaveQuota : undefined;
    const quota = staffQuota ?? DEFAULT_QUOTA;

    const balance: Omit<LeaveBalance, 'id'> = {
      staffId,
      staffName,
      year: currentYear,
      quota,
      used: usedDays,
      pending: pendingDays,
      remaining: quota - usedDays - pendingDays,
      lastUpdated: new Date().toISOString(),
    };

    await setDoc(doc(db, COLLECTION, balanceId), balance);
    return { id: balanceId, ...balance };
  }

  /**
   * Check if staff has enough balance for leave request
   */
  static async hasEnoughBalance(
    staffId: string,
    staffName: string,
    startDate: string,
    endDate: string,
    leaveType: string
  ): Promise<{ hasBalance: boolean; remaining: number; requested: number }> {
    // Only check balance for "Nghỉ phép" (paid leave)
    if (leaveType !== 'Nghỉ phép') {
      return { hasBalance: true, remaining: 999, requested: 0 };
    }

    const balance = await LeaveBalanceService.getBalance(staffId, staffName);
    const requestedDays = LeaveBalanceService.calculateDays(startDate, endDate);

    return {
      hasBalance: balance.remaining >= requestedDays,
      remaining: balance.remaining,
      requested: requestedDays,
    };
  }

  /**
   * Update balance when leave status changes
   */
  static async updateOnLeaveChange(
    staffId: string,
    staffName: string,
    action: 'submit' | 'approve' | 'reject' | 'cancel',
    days: number,
    leaveType: string
  ): Promise<void> {
    // Only update balance for paid leave
    if (leaveType !== 'Nghỉ phép') return;

    const balance = await LeaveBalanceService.getBalance(staffId, staffName);

    let updates: Partial<LeaveBalance> = { lastUpdated: new Date().toISOString() };

    switch (action) {
      case 'submit':
        updates.pending = balance.pending + days;
        updates.remaining = balance.remaining - days;
        break;
      case 'approve':
        updates.pending = Math.max(0, balance.pending - days);
        updates.used = balance.used + days;
        break;
      case 'reject':
        updates.pending = Math.max(0, balance.pending - days);
        updates.remaining = balance.remaining + days;
        break;
      case 'cancel':
        // If was pending: reduce pending, add back remaining
        // If was approved: reduce used, add back remaining
        updates.used = Math.max(0, balance.used - days);
        updates.remaining = balance.remaining + days;
        break;
    }

    await updateDoc(doc(db, COLLECTION, balance.id), updates);
  }

  /**
   * Calculate days between two dates (inclusive)
   */
  static calculateDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Get global default quota from settings
   */
  static async getDefaultQuota(): Promise<number> {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'leave_config'));
      if (docSnap.exists()) {
        return docSnap.data()?.defaultQuota ?? DEFAULT_QUOTA;
      }
    } catch (e) {
      console.error('Error getting leave config:', e);
    }
    return DEFAULT_QUOTA;
  }
}

export default LeaveBalanceService;
