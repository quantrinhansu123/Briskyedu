/**
 * useLeaveBalance Hook - Track staff's leave balance
 */
import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { LeaveBalance } from '../../types';
import { LeaveBalanceService } from '../services/leaveBalanceService';

interface UseLeaveBalanceReturn {
  balance: LeaveBalance | null;
  loading: boolean;
  error: string | null;
  checkBalance: (startDate: string, endDate: string, leaveType: string) => Promise<{
    hasBalance: boolean;
    remaining: number;
    requested: number;
  }>;
  refreshBalance: () => Promise<void>;
}

export const useLeaveBalance = (
  staffId: string | undefined,
  staffName: string | undefined
): UseLeaveBalanceReturn => {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load balance on mount
  useEffect(() => {
    // Wait for auth to be ready
    const auth = getAuth();
    if (!auth.currentUser || !staffId || !staffName) {
      setLoading(false);
      return;
    }

    const loadBalance = async () => {
      try {
        setLoading(true);
        // Recalculate to ensure accuracy
        const bal = await LeaveBalanceService.recalculateBalance(staffId, staffName);
        setBalance(bal);
        setError(null);
      } catch (err: any) {
        console.error('Error loading leave balance:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBalance();
  }, [staffId, staffName]);

  // Check if has enough balance for a request
  const checkBalance = useCallback(async (
    startDate: string,
    endDate: string,
    leaveType: string
  ) => {
    if (!staffId || !staffName) {
      return { hasBalance: false, remaining: 0, requested: 0 };
    }
    return await LeaveBalanceService.hasEnoughBalance(
      staffId,
      staffName,
      startDate,
      endDate,
      leaveType
    );
  }, [staffId, staffName]);

  // Refresh balance (recalculate)
  const refreshBalance = useCallback(async () => {
    if (!staffId || !staffName) return;
    try {
      const bal = await LeaveBalanceService.recalculateBalance(staffId, staffName);
      setBalance(bal);
    } catch (err: any) {
      console.error('Error refreshing balance:', err);
    }
  }, [staffId, staffName]);

  return {
    balance,
    loading,
    error,
    checkBalance,
    refreshBalance,
  };
};

export default useLeaveBalance;
