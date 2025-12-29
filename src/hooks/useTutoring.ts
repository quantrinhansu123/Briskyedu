/**
 * useTutoring Hook
 * React hook for tutoring operations
 */

import { useState, useEffect, useCallback } from 'react';
import * as tutoringService from '../services/tutoringService';
import {
  TutoringData,
  TutoringType,
  TutoringStatus,
  TutoringStatusHistoryEntry,
  TERMINAL_STATUSES
} from '../services/tutoringService';

// Re-export types for convenience
export type { TutoringData, TutoringType, TutoringStatus, TutoringStatusHistoryEntry };
export { TERMINAL_STATUSES };

interface UseTutoringProps {
  type?: TutoringType;
  status?: TutoringStatus;
  studentId?: string;
  classId?: string;
  includeDeleted?: boolean;  // Include soft-deleted records
  onlyDeleted?: boolean;     // Only show deleted (for trash view)
}

interface UseTutoringReturn {
  tutoringList: TutoringData[];
  loading: boolean;
  error: string | null;
  // Core CRUD
  createTutoring: (data: Omit<TutoringData, 'id'>) => Promise<string>;
  updateTutoring: (id: string, data: Partial<TutoringData>) => Promise<void>;
  deleteTutoring: (id: string) => Promise<void>;
  // Scheduling
  scheduleTutoring: (id: string, date: string, time: string, tutorId: string, tutorName: string, userId?: string) => Promise<void>;
  // Status transitions (NEW)
  completeTutoring: (id: string, userId: string, note?: string) => Promise<void>;
  markChargedAbsence: (id: string, userId: string, reason: string) => Promise<void>;
  markReservedAbsence: (id: string, userId: string, note?: string) => Promise<void>;
  undoTutoring: (id: string, userId: string) => Promise<void>;
  cancelTutoring: (id: string, reason?: string, userId?: string) => Promise<void>;
  // Soft delete (NEW)
  softDeleteTutoring: (id: string, userId: string) => Promise<void>;
  restoreTutoring: (id: string) => Promise<void>;
  // Utility
  refresh: () => Promise<void>;
  getTutoring: (id: string) => Promise<TutoringData | null>;
}

export const useTutoring = (props?: UseTutoringProps): UseTutoringReturn => {
  const [tutoringList, setTutoringList] = useState<TutoringData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTutoring = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tutoringService.getTutoringList({
        type: props?.type,
        status: props?.status,
        studentId: props?.studentId,
        classId: props?.classId,
        includeDeleted: props?.includeDeleted,
        onlyDeleted: props?.onlyDeleted,
      });
      setTutoringList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [props?.type, props?.status, props?.studentId, props?.classId, props?.includeDeleted, props?.onlyDeleted]);

  useEffect(() => {
    fetchTutoring();
  }, [fetchTutoring]);

  // Core CRUD
  const createTutoring = async (data: Omit<TutoringData, 'id'>): Promise<string> => {
    const id = await tutoringService.createTutoring(data);
    await fetchTutoring();
    return id;
  };

  const updateTutoring = async (id: string, data: Partial<TutoringData>): Promise<void> => {
    await tutoringService.updateTutoring(id, data);
    await fetchTutoring();
  };

  const deleteTutoring = async (id: string): Promise<void> => {
    await tutoringService.deleteTutoring(id);
    await fetchTutoring();
  };

  // Scheduling
  const scheduleTutoring = async (
    id: string,
    date: string,
    time: string,
    tutorId: string,
    tutorName: string,
    userId?: string
  ): Promise<void> => {
    await tutoringService.scheduleTutoring(id, date, time, tutorId, tutorName, userId);
    await fetchTutoring();
  };

  // Status transitions
  const completeTutoring = async (id: string, userId: string, note?: string): Promise<void> => {
    await tutoringService.completeTutoring(id, userId, note);
    await fetchTutoring();
  };

  const markChargedAbsence = async (id: string, userId: string, reason: string): Promise<void> => {
    await tutoringService.markChargedAbsence(id, userId, reason);
    await fetchTutoring();
  };

  const markReservedAbsence = async (id: string, userId: string, note?: string): Promise<void> => {
    await tutoringService.markReservedAbsence(id, userId, note);
    await fetchTutoring();
  };

  const undoTutoring = async (id: string, userId: string): Promise<void> => {
    await tutoringService.undoTutoring(id, userId);
    await fetchTutoring();
  };

  const cancelTutoring = async (id: string, reason?: string, userId?: string): Promise<void> => {
    await tutoringService.cancelTutoring(id, reason, userId);
    await fetchTutoring();
  };

  // Soft delete
  const softDeleteTutoring = async (id: string, userId: string): Promise<void> => {
    await tutoringService.softDeleteTutoring(id, userId);
    await fetchTutoring();
  };

  const restoreTutoring = async (id: string): Promise<void> => {
    await tutoringService.restoreTutoring(id);
    await fetchTutoring();
  };

  // Utility
  const getTutoring = async (id: string): Promise<TutoringData | null> => {
    return tutoringService.getTutoring(id);
  };

  return {
    tutoringList,
    loading,
    error,
    createTutoring,
    updateTutoring,
    deleteTutoring,
    scheduleTutoring,
    completeTutoring,
    markChargedAbsence,
    markReservedAbsence,
    undoTutoring,
    cancelTutoring,
    softDeleteTutoring,
    restoreTutoring,
    refresh: fetchTutoring,
    getTutoring,
  };
};
