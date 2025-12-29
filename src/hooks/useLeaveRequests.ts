/**
 * useLeaveRequests Hook - Real-time leave request data
 * Pattern: Same as useStaff, useAutoWorkSessions
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';
import { LeaveRequest, LeaveRequestStatus, LeaveType } from '../../types';
import { LeaveRequestService } from '../services/leaveRequestService';

interface UseLeaveRequestsOptions {
  staffId?: string;              // Filter by staff (for non-admin view)
  status?: LeaveRequestStatus;   // Filter by status
}

interface SubmitLeaveData {
  staffId: string;
  staffName: string;
  staffCode?: string;
  position?: string;
  branch?: string;
  startDate: string;
  endDate: string;
  leaveType: LeaveType;
  reason: string;
}

interface UseLeaveRequestsReturn {
  requests: LeaveRequest[];
  loading: boolean;
  error: string | null;
  // Actions
  submitRequest: (data: SubmitLeaveData) => Promise<string>;
  approveRequest: (id: string, approvedBy: string, approvedByName: string) => Promise<void>;
  rejectRequest: (id: string, approvedBy: string, approvedByName: string, reason: string) => Promise<void>;
  deleteRequest: (id: string) => Promise<void>;
  updateRequest: (id: string, data: Partial<LeaveRequest>) => Promise<void>;
}

export const useLeaveRequests = (options?: UseLeaveRequestsOptions): UseLeaveRequestsReturn => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time listener
  useEffect(() => {
    // Wait for auth to be ready before querying
    const auth = getAuth();
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    // Build query based on options
    // Note: Firestore requires composite indexes for multiple where clauses
    // For simplicity, we filter client-side after fetching all
    const q = query(collection(db, 'leaveRequests'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LeaveRequest[];

        // Client-side filtering
        if (options?.staffId) {
          data = data.filter(r => r.staffId === options.staffId);
        }
        if (options?.status) {
          data = data.filter(r => r.status === options.status);
        }

        setRequests(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('LeaveRequests listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [options?.staffId, options?.status]);

  // Submit new request
  const submitRequest = useCallback(async (data: SubmitLeaveData): Promise<string> => {
    return await LeaveRequestService.submit(data);
  }, []);

  // Approve request
  const approveRequest = useCallback(async (
    id: string,
    approvedBy: string,
    approvedByName: string
  ): Promise<void> => {
    await LeaveRequestService.approve(id, approvedBy, approvedByName);
  }, []);

  // Reject request
  const rejectRequest = useCallback(async (
    id: string,
    approvedBy: string,
    approvedByName: string,
    reason: string
  ): Promise<void> => {
    await LeaveRequestService.reject(id, approvedBy, approvedByName, reason);
  }, []);

  // Delete request
  const deleteRequest = useCallback(async (id: string): Promise<void> => {
    await LeaveRequestService.delete(id);
  }, []);

  // Update request
  const updateRequest = useCallback(async (
    id: string,
    data: Partial<LeaveRequest>
  ): Promise<void> => {
    await LeaveRequestService.update(id, data);
  }, []);

  return {
    requests,
    loading,
    error,
    submitRequest,
    approveRequest,
    rejectRequest,
    deleteRequest,
    updateRequest,
  };
};

export default useLeaveRequests;
