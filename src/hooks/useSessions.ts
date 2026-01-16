/**
 * useSessions Hook
 * React hook for class sessions operations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ClassSession,
  getSessionsByClass,
  getUpcomingSessions,
  getAllPendingSessions,
  updateSessionStatus,
  getSessionByClassAndDate,
  addMakeupSession,
} from '../services/sessionService';

interface UseSessionsProps {
  classId?: string;
  status?: ClassSession['status'];
  fromDate?: string;
  toDate?: string;
  // Class info fallback when no sessions exist (for addMakeup)
  classInfo?: {
    name?: string;
    teacherId?: string;
    teacherName?: string;
    room?: string;
  };
}

interface UseSessionsReturn {
  sessions: ClassSession[];
  upcomingSessions: ClassSession[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getSessionForDate: (date: string) => Promise<ClassSession | null>;
  markSessionComplete: (sessionId: string, attendanceId: string) => Promise<void>;
  addMakeup: (date: string, time?: string, note?: string) => Promise<string>;
}

export const useSessions = (props?: UseSessionsProps): UseSessionsReturn => {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!props?.classId) {
      setSessions([]);
      setUpcomingSessions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all sessions for the class (no status filter for allSessions)
      const allSessions = await getSessionsByClass(props.classId, {
        fromDate: props.fromDate,
        toDate: props.toDate,
      });
      setSessions(allSessions);

      // Fetch upcoming sessions (status = 'Chưa học')
      const upcoming = await getUpcomingSessions(props.classId, 100);
      setUpcomingSessions(upcoming);
    } catch (err) {
      console.error('[useSessions] Error fetching sessions for class', props.classId, err);
      setError(err instanceof Error ? err.message : 'Lỗi tải buổi học');
      // Reset to empty arrays on error to prevent stale data
      setSessions([]);
      setUpcomingSessions([]);
    } finally {
      setLoading(false);
    }
  }, [props?.classId, props?.fromDate, props?.toDate]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const getSessionForDate = useCallback(async (date: string): Promise<ClassSession | null> => {
    if (!props?.classId) return null;
    return getSessionByClassAndDate(props.classId, date);
  }, [props?.classId]);

  const markSessionComplete = useCallback(async (sessionId: string, attendanceId: string): Promise<void> => {
    await updateSessionStatus(sessionId, 'Đã học', attendanceId);
    await fetchSessions();
  }, [fetchSessions]);

  const addMakeup = useCallback(async (date: string, time?: string, note?: string): Promise<string> => {
    if (!props?.classId) throw new Error('No class selected');

    // Get class info from sessions, or fallback to props.classInfo
    const sessionInfo = sessions[0] || upcomingSessions[0];
    const classInfoData = {
      id: props.classId,
      name: sessionInfo?.className || props?.classInfo?.name || 'Unknown',
      teacherId: sessionInfo?.teacherId || props?.classInfo?.teacherId || '',
      teacherName: sessionInfo?.teacherName || props?.classInfo?.teacherName || '',
      room: sessionInfo?.room || props?.classInfo?.room || '',
    };

    const id = await addMakeupSession(
      classInfoData,
      date,
      time,
      note
    );

    await fetchSessions();
    return id;
  }, [props?.classId, props?.classInfo, sessions, upcomingSessions, fetchSessions]);

  return {
    sessions,
    upcomingSessions,
    loading,
    error,
    refresh: fetchSessions,
    getSessionForDate,
    markSessionComplete,
    addMakeup,
  };
};

/**
 * Hook to get all pending sessions across classes
 */
export const useAllPendingSessions = (classIds?: string[]) => {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllPendingSessions({ classIds });
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải buổi học');
    } finally {
      setLoading(false);
    }
  }, [classIds]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refresh: fetchSessions };
};
