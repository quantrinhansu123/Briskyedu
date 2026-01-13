import { useState, useEffect, useCallback } from 'react';
import {
  StaffSalaryRecord,
  StaffAttendanceLog,
  getStaffSalaries,
  createStaffSalary,
  updateStaffSalary,
  deleteStaffSalary,
  getStaffAttendance,
  createAttendanceLog,
  updateAttendanceLog,
  deleteAttendanceLog,
} from '../services/staffSalaryService';
import { getCheckIns } from '../services/checkInService';

export const useStaffSalary = (month: number, year: number) => {
  const [salaries, setSalaries] = useState<StaffSalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSalaries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStaffSalaries(month, year);
      setSalaries(data);
    } catch (err) {
      console.error('Error fetching staff salaries:', err);
      setError('Không thể tải dữ liệu lương');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchSalaries();
  }, [fetchSalaries]);

  const create = async (data: Omit<StaffSalaryRecord, 'id'>) => {
    const id = await createStaffSalary(data);
    await fetchSalaries();
    return id;
  };

  const update = async (id: string, data: Partial<StaffSalaryRecord>) => {
    await updateStaffSalary(id, data);
    await fetchSalaries();
  };

  const remove = async (id: string) => {
    await deleteStaffSalary(id);
    await fetchSalaries();
  };

  const totalSalary = salaries.reduce((sum, s) => sum + s.totalSalary, 0);

  return {
    salaries,
    loading,
    error,
    totalSalary,
    createSalary: create,
    updateSalary: update,
    deleteSalary: remove,
    refresh: fetchSalaries,
  };
};

export const useStaffAttendance = (staffId: string, month?: number, year?: number) => {
  const [logs, setLogs] = useState<StaffAttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!staffId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch attendance logs
      const data = await getStaffAttendance(staffId, month, year);

      // Also fetch check-ins to get photo URLs
      const checkIns = await getCheckIns(staffId, month, year);

      // Create a map of date -> photoUrl from checkIns
      const photoMap: Record<string, string> = {};
      checkIns.forEach(ci => {
        if (ci.checkInPhotoUrl) {
          // Convert YYYY-MM-DD to DD/MM/YYYY format
          const [y, m, d] = ci.date.split('-');
          const formattedDate = `${d}/${m}/${y}`;
          photoMap[formattedDate] = ci.checkInPhotoUrl;
        }
      });

      // Merge photoUrls into attendance logs
      const logsWithPhotos = data.map(log => ({
        ...log,
        photoUrl: log.photoUrl || photoMap[log.date],
      }));

      setLogs(logsWithPhotos);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError('Không thể tải dữ liệu chấm công');
    } finally {
      setLoading(false);
    }
  }, [staffId, month, year]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const create = async (data: Omit<StaffAttendanceLog, 'id'>) => {
    const id = await createAttendanceLog(data);
    await fetchLogs();
    return id;
  };

  const update = async (id: string, data: Partial<StaffAttendanceLog>) => {
    await updateAttendanceLog(id, data);
    await fetchLogs();
  };

  const remove = async (id: string) => {
    await deleteAttendanceLog(id);
    await fetchLogs();
  };

  return {
    logs,
    loading,
    error,
    createLog: create,
    updateLog: update,
    deleteLog: remove,
    refresh: fetchLogs,
  };
};
