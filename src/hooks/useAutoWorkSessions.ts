/**
 * useAutoWorkSessions Hook
 * Tự động tạo danh sách công từ TKB và lịch nghỉ
 * - Đọc schedule từ classes
 * - Loại trừ ngày nghỉ
 * - Merge với công đã xác nhận trong Firebase
 */

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ClassModel } from '../../types';

export type SubstituteReason = 'Nghỉ phép' | 'Nghỉ ốm' | 'Bận việc đột xuất' | 'Nghỉ không lương' | 'Khác';

export interface WorkSession {
  id?: string;
  staffName: string;
  staffId?: string;
  position: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  classId?: string;
  className: string;
  type: 'Dạy chính' | 'Trợ giảng' | 'Nhận xét' | 'Dạy thay' | 'Bồi bài';
  status: 'Chờ xác nhận' | 'Đã xác nhận' | 'Từ chối';
  isFromTKB?: boolean; // true = auto from schedule, false = manual
  confirmedAt?: string;
  confirmedBy?: string;
  // Thông tin dạy thay
  substituteForStaffName?: string;
  substituteReason?: SubstituteReason;
}

// Parse schedule string to get days and time
// Supports formats: "15:00-16:30 Thứ 3, Thứ 5", "08:00-09:30 Thứ 2, 4, 6", "17h30-19h00 Thứ 2, 4"
const parseSchedule = (schedule: string): { days: number[]; timeStart: string; timeEnd: string } => {
  if (!schedule) return { days: [], timeStart: '', timeEnd: '' };
  
  // Parse time: supports "15:00-16:30" or "17h30-19h00"
  const timeMatch = schedule.match(/(\d{1,2})[h:](\d{2})\s*-\s*(\d{1,2})[h:](\d{2})/);
  let timeStart = '';
  let timeEnd = '';
  if (timeMatch) {
    timeStart = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    timeEnd = `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}`;
  }
  
  // Parse days: find all numbers after "Thứ" or standalone numbers in day context
  const days: number[] = [];
  
  // Handle "Chủ nhật" or "CN"
  if (/ch[uủ]\s*nh[aậ]t|CN/i.test(schedule)) {
    days.push(7); // Sunday = 7
  }
  
  // Find all "Thứ X" patterns
  const thuMatches = schedule.matchAll(/Th[ứử]\s*(\d)/gi);
  for (const match of thuMatches) {
    const dayNum = parseInt(match[1]);
    if (dayNum >= 2 && dayNum <= 7 && !days.includes(dayNum)) {
      days.push(dayNum);
    }
  }
  
  // Also find standalone numbers after comma that might be days (e.g., "Thứ 2, 4, 6")
  // Look for pattern like ", 4" or ", 6" that aren't part of time
  const afterThu = schedule.match(/Th[ứử]\s*\d[\s,]*([,\s\d]+)/i);
  if (afterThu) {
    const extraDays = afterThu[1].match(/\d/g);
    if (extraDays) {
      for (const d of extraDays) {
        const dayNum = parseInt(d);
        if (dayNum >= 2 && dayNum <= 7 && !days.includes(dayNum)) {
          days.push(dayNum);
        }
      }
    }
  }
  
  return { days: days.sort((a, b) => a - b), timeStart, timeEnd };
};

// Get dates for a specific day of week within a date range
const getDatesForDayOfWeek = (dayOfWeek: number, startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  const jsDayOfWeek = dayOfWeek === 7 ? 0 : dayOfWeek - 1;
  
  while (current.getDay() !== jsDayOfWeek && current <= endDate) {
    current.setDate(current.getDate() + 1);
  }
  
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  
  return dates;
};

const formatDate = (date: Date): string => {
  // Use local date to avoid timezone issues (toISOString converts to UTC)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useAutoWorkSessions = (startDate: Date, endDate?: Date) => {
  const [confirmedSessions, setConfirmedSessions] = useState<WorkSession[]>([]);
  const [manualSessions, setManualSessions] = useState<WorkSession[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate end date - defaults to 6 days after start (1 week) if not provided
  const rangeEndDate = useMemo(() => {
    if (endDate) return endDate;
    const end = new Date(startDate);
    end.setDate(end.getDate() + 6); // Default: Sunday of the week
    return end;
  }, [startDate, endDate]);

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(rangeEndDate);

  // Fetch data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch classes
        const classesSnapshot = await getDocs(collection(db, 'classes'));
        const classesData = classesSnapshot.docs
          .map(doc => {
            try {
              return { id: doc.id, ...doc.data() } as ClassModel;
            } catch {
              return null;
            }
          })
          .filter((cls): cls is ClassModel => cls !== null && cls.status === 'Đang học');
        
        setClasses(classesData);
        
        // Fetch holidays
        try {
          const holidaysSnapshot = await getDocs(collection(db, 'holidays'));
          const holidaysData: string[] = [];
          holidaysSnapshot.docs.forEach(doc => {
            try {
              const data = doc.data();
              // Only process applied holidays
              if (data.status !== 'Đã áp dụng') return;
              
              let hStart = '';
              let hEnd = '';
              
              // Get start date - use local date format to avoid timezone issues
              if (data.startDate) {
                if (typeof data.startDate === 'string') {
                  hStart = data.startDate;
                } else if (data.startDate?.toDate) {
                  const d = data.startDate.toDate();
                  hStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }
              }
              // Get end date (or same as start if not provided) - use local date format
              if (data.endDate) {
                if (typeof data.endDate === 'string') {
                  hEnd = data.endDate;
                } else if (data.endDate?.toDate) {
                  const d = data.endDate.toDate();
                  hEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }
              } else {
                hEnd = hStart;
              }
              
              if (!hStart) return;
              
              // Generate all dates between startDate and endDate
              const start = new Date(hStart + 'T00:00:00');
              const end = new Date(hEnd + 'T00:00:00');
              const current = new Date(start);

              while (current <= end) {
                // Use local date format to avoid timezone issues
                const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
                // Only add if within our week range
                if (dateStr >= startDateStr && dateStr <= endDateStr && !holidaysData.includes(dateStr)) {
                  holidaysData.push(dateStr);
                }
                current.setDate(current.getDate() + 1);
              }
            } catch {
              // Skip invalid holiday
            }
          });
          setHolidays(holidaysData);
        } catch (err) {
          console.warn('Could not fetch holidays:', err);
          setHolidays([]);
        }
        
        // Fetch confirmed work sessions for this week
        try {
          const sessionsSnapshot = await getDocs(collection(db, 'workSessions'));
          const sessionsData = sessionsSnapshot.docs
            .map(doc => {
              try {
                return { id: doc.id, ...doc.data() } as WorkSession;
              } catch {
                return null;
              }
            })
            .filter((s): s is WorkSession => s !== null && s.date >= startDateStr && s.date <= endDateStr);
          
          setConfirmedSessions(sessionsData.filter(s => s.status === 'Đã xác nhận'));
          setManualSessions(sessionsData.filter(s => !s.isFromTKB));
        } catch (err) {
          console.warn('Could not fetch work sessions:', err);
          setConfirmedSessions([]);
          setManualSessions([]);
        }
        
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Không thể tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDateStr, endDateStr]);

  // Refresh function to manually trigger data refetch
  const refresh = async () => {
    setLoading(true);
    try {
      // Refetch work sessions
      const sessionsSnapshot = await getDocs(collection(db, 'workSessions'));
      const sessionsData = sessionsSnapshot.docs
        .map(doc => {
          try {
            return { id: doc.id, ...doc.data() } as WorkSession;
          } catch {
            return null;
          }
        })
        .filter((s): s is WorkSession => s !== null && s.date >= startDateStr && s.date <= endDateStr);

      setConfirmedSessions(sessionsData.filter(s => s.status === 'Đã xác nhận'));
      setManualSessions(sessionsData.filter(s => !s.isFromTKB));
    } catch (err) {
      console.warn('Could not refresh work sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate sessions from TKB
  const autoGeneratedSessions = useMemo((): WorkSession[] => {
    const sessions: WorkSession[] = [];
    
    for (const cls of classes) {
      const { days, timeStart, timeEnd } = parseSchedule(cls.schedule || '');
      
      if (days.length === 0 || !timeStart || !timeEnd) continue;
      
      for (const dayOfWeek of days) {
        const dates = getDatesForDayOfWeek(dayOfWeek, startDate, rangeEndDate);
        
        for (const date of dates) {
          const dateStr = formatDate(date);
          
          // Skip holidays
          if (holidays.includes(dateStr)) continue;
          
          // Check if already confirmed
          const isConfirmed = (staffName: string) => 
            confirmedSessions.some(s => 
              s.staffName === staffName && 
              s.date === dateStr && 
              s.className === cls.name
            );
          
          // Vietnamese teacher
          if (cls.teacher && !isConfirmed(cls.teacher)) {
            sessions.push({
              staffName: cls.teacher,
              position: 'Giáo viên Việt',
              date: dateStr,
              timeStart,
              timeEnd,
              classId: cls.id,
              className: cls.name,
              type: 'Dạy chính',
              status: 'Chờ xác nhận',
              isFromTKB: true,
            });
          }
          
          // Foreign teacher
          if (cls.foreignTeacher && !isConfirmed(cls.foreignTeacher)) {
            sessions.push({
              staffName: cls.foreignTeacher,
              position: 'Giáo viên Nước ngoài',
              date: dateStr,
              timeStart,
              timeEnd,
              classId: cls.id,
              className: cls.name,
              type: 'Dạy chính',
              status: 'Chờ xác nhận',
              isFromTKB: true,
            });
          }
          
          // Assistant
          if (cls.assistant && !isConfirmed(cls.assistant)) {
            sessions.push({
              staffName: cls.assistant,
              position: 'Trợ giảng',
              date: dateStr,
              timeStart,
              timeEnd,
              classId: cls.id,
              className: cls.name,
              type: 'Trợ giảng',
              status: 'Chờ xác nhận',
              isFromTKB: true,
            });
          }
        }
      }
    }
    
    return sessions;
  }, [classes, holidays, confirmedSessions, startDate, rangeEndDate]);

  // Get list of teachers who have schedules in TKB
  const teachersInTKB = useMemo(() => {
    const teachers = new Set<string>();
    for (const cls of classes) {
      if (cls.teacher) teachers.add(cls.teacher);
      if (cls.foreignTeacher) teachers.add(cls.foreignTeacher);
      if (cls.assistant) teachers.add(cls.assistant);
    }
    return teachers;
  }, [classes]);

  // Combined sessions - ONLY show teachers who are in TKB
  const allSessions = useMemo(() => {
    // Filter confirmed sessions to only include those for teachers in TKB
    const filteredConfirmed = confirmedSessions.filter(s => 
      teachersInTKB.has(s.staffName)
    );
    
    // Filter manual sessions to only include those for teachers in TKB
    const filteredManual = manualSessions.filter(s => 
      s.status === 'Chờ xác nhận' && teachersInTKB.has(s.staffName)
    );
    
    // Merge: auto-generated + filtered confirmed + filtered manual
    // Remove duplicates (if already confirmed, don't show pending)
    const confirmedKeys = new Set(
      filteredConfirmed.map(s => `${s.staffName}-${s.date}-${s.className}`)
    );
    
    const uniqueAuto = autoGeneratedSessions.filter(s => 
      !confirmedKeys.has(`${s.staffName}-${s.date}-${s.className}`)
    );
    
    return [
      ...uniqueAuto,
      ...filteredManual,
      ...filteredConfirmed,
    ].sort((a, b) => {
      // Sort by date, then by time (with null checks)
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.timeStart || '';
      const timeB = b.timeStart || '';
      return timeA.localeCompare(timeB);
    });
  }, [autoGeneratedSessions, manualSessions, confirmedSessions, teachersInTKB]);

  // Confirm a single session (save to Firebase)
  const confirmSession = async (session: WorkSession) => {
    try {
      const sessionData = {
        ...session,
        status: 'Đã xác nhận',
        confirmedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      delete sessionData.id;

      const docRef = await addDoc(collection(db, 'workSessions'), sessionData);

      // Update local state with the new document ID
      setConfirmedSessions(prev => [...prev, { ...sessionData, id: docRef.id, status: 'Đã xác nhận' } as WorkSession]);
    } catch (err: any) {
      console.error('Error confirming session:', err);
      throw new Error('Không thể xác nhận công');
    }
  };

  // Confirm multiple sessions
  const confirmMultiple = async (sessions: WorkSession[]) => {
    for (const session of sessions) {
      await confirmSession(session);
    }
  };

  // Add manual session
  const addManualSession = async (session: Omit<WorkSession, 'id' | 'isFromTKB'>) => {
    try {
      const sessionData = {
        ...session,
        isFromTKB: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const docRef = await addDoc(collection(db, 'workSessions'), sessionData);
      setManualSessions(prev => [...prev, { ...sessionData, id: docRef.id } as WorkSession]);
      return docRef.id;
    } catch (err: any) {
      console.error('Error adding manual session:', err);
      throw new Error('Không thể thêm công');
    }
  };

  // Unconfirm session (revert to pending by deleting from Firebase)
  const unconfirmSession = async (session: WorkSession) => {
    if (!session.id) {
      throw new Error('Không có ID để hủy xác nhận');
    }
    try {
      await deleteDoc(doc(db, 'workSessions', session.id));
      setConfirmedSessions(prev => prev.filter(s => s.id !== session.id));
    } catch (err: any) {
      console.error('Error unconfirming session:', err);
      throw new Error('Không thể hủy xác nhận công');
    }
  };

  // Delete session
  const deleteSession = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'workSessions', id));
      setConfirmedSessions(prev => prev.filter(s => s.id !== id));
      setManualSessions(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      console.error('Error deleting session:', err);
      throw new Error('Không thể xóa công');
    }
  };

  // Stats
  const stats = useMemo(() => ({
    pending: allSessions.filter(s => s.status === 'Chờ xác nhận').length,
    confirmed: allSessions.filter(s => s.status === 'Đã xác nhận').length,
    total: allSessions.length,
  }), [allSessions]);

  return {
    sessions: allSessions,
    pendingSessions: allSessions.filter(s => s.status === 'Chờ xác nhận'),
    confirmedSessions: allSessions.filter(s => s.status === 'Đã xác nhận'),
    holidays,
    loading,
    error,
    stats,
    confirmSession,
    unconfirmSession,
    confirmMultiple,
    addManualSession,
    deleteSession,
    refresh,
  };
};
