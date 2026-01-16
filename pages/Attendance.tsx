/**
 * Attendance Page
 * Điểm danh với 5 trạng thái: Đúng giờ, Trễ giờ, Vắng, Bảo lưu, Đã bồi
 * Logic: Vắng → Auto tạo record bồi bài
 * + Tab Rà soát điểm danh cho lễ tân
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Save, CheckCircle, AlertCircle, Clock, BookOpen, Users, Plus, ClipboardCheck, XCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { SearchableClassDropdown } from '../src/features/attendance';
import { AttendanceStatus, AttendanceRecord, StudentStatus } from '../types';
import { useClasses } from '../src/hooks/useClasses';
import { useStudents } from '../src/hooks/useStudents';
import { useAttendance } from '../src/hooks/useAttendance';
import { useAuth } from '../src/hooks/useAuth';
import { usePermissions } from '../src/hooks/usePermissions';
import { useSessions } from '../src/hooks/useSessions';
import { ClassSession } from '../src/services/sessionService';
import { formatSchedule } from '../src/utils/scheduleUtils';
import { collection, query, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { useHolidays } from '../src/hooks/useHolidays';
import { Holiday } from '../types';

interface StudentAttendanceState {
  studentId: string;
  studentName: string;
  studentCode: string;
  status: AttendanceStatus;
  note: string;
  // Thông tin điểm số
  homeworkCompletion?: number;  // % BTVN (0-100)
  testName?: string;            // Tên bài KT
  score?: number;               // Điểm (0-10)
  bonusPoints?: number;         // Điểm thưởng
  // Thông tin đi học
  punctuality?: 'onTime' | 'late' | '';  // Đúng giờ / Trễ giờ
}

// Interface cho rà soát điểm danh
interface UnmarkedStudent {
  id: string;
  sessionId: string;
  sessionDate: string;
  sessionNumber: number;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
}

interface SessionWithUnmarked {
  sessionId: string;
  sessionDate: string;
  sessionNumber: number;
  classId: string;
  className: string;
  unmarkedStudents: UnmarkedStudent[];
}

export const Attendance: React.FC = () => {
  const { user, staffData } = useAuth();
  const { shouldShowOnlyOwnClasses, staffId } = usePermissions();
  const onlyOwnClasses = shouldShowOnlyOwnClasses('attendance');

  const { classes: allClasses, loading: classLoading } = useClasses();
  const { students: allStudents, loading: studentLoading } = useStudents();
  const { checkExisting, loadStudentAttendance, studentAttendance, saveAttendance } = useAttendance();
  const { holidays } = useHolidays();

  // Helper: Check if a date is a holiday for a specific class
  const getHolidayForDate = (dateStr: string, classId?: string): Holiday | null => {
    if (!holidays.length) return null;
    
    for (const holiday of holidays) {
      if (holiday.status !== 'Đã áp dụng') continue;
      
      // Check if date falls within holiday range
      const start = holiday.startDate;
      const end = holiday.endDate || holiday.startDate;
      if (dateStr < start || dateStr > end) continue;
      
      // Check apply type
      if (holiday.applyType === 'all_classes' || holiday.applyType === 'all_branches') {
        return holiday;
      }
      
      if (holiday.applyType === 'specific_classes' && classId) {
        if (holiday.classIds?.includes(classId)) {
          return holiday;
        }
      }
      
      // For specific_branch, we'd need branch info from class - skip for now
    }
    
    return null;
  };

  // Filter classes for teachers (onlyOwnClasses)
  const classes = useMemo(() => {
    if (!onlyOwnClasses || !staffData) return allClasses;
    const myName = staffData.name;
    const myId = staffData.id || staffId;
    return allClasses.filter(cls => 
      cls.teacher === myName || 
      cls.teacherId === myId ||
      cls.assistant === myName ||
      cls.assistantId === myId ||
      cls.foreignTeacher === myName ||
      cls.foreignTeacherId === myId
    );
  }, [allClasses, onlyOwnClasses, staffData, staffId]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'attendance' | 'review'>('attendance');

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 320 });
  const sessionDropdownRef = useRef<HTMLDivElement>(null);
  const sessionButtonRef = useRef<HTMLButtonElement>(null);

  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceState[]>([]);
  const [existingRecord, setExistingRecord] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [useSessionMode, setUseSessionMode] = useState(true); // Default to session mode
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [showGradeFields, setShowGradeFields] = useState(false); // Toggle hiển thị điểm số

  // Bug 3 fix: Track session IDs that have attendance records
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(new Set());

  // Review tab state
  const [reviewDate, setReviewDate] = useState<string>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });
  const [reviewFilterClass, setReviewFilterClass] = useState<string>('');
  const [reviewFilterBranch, setReviewFilterBranch] = useState<string>(''); // Bug 4 fix: Add branch filter
  const [reviewLoading, setReviewLoading] = useState(false);
  const [sessionsWithUnmarked, setSessionsWithUnmarked] = useState<SessionWithUnmarked[]>([]);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    type: 'late' | 'absent' | 'reserved'; // Bug 4 fix: Add 'reserved' type
    student: UnmarkedStudent | null;
    reason: string;
  }>({ show: false, type: 'late', student: null, reason: '' });
  const [processingReview, setProcessingReview] = useState(false);

  // Check if selected date is a holiday (for tab 1)
  const selectedDateHoliday = useMemo(() => {
    return getHolidayForDate(attendanceDate, selectedClassId);
  }, [attendanceDate, selectedClassId, holidays]);

  // Check if review date is a global holiday (for tab 2)
  const reviewDateHoliday = useMemo(() => {
    return getHolidayForDate(reviewDate);
  }, [reviewDate, holidays]);

  // Get selected class info for sessions hook (needed for addMakeup when no sessions exist)
  const selectedClassForSessions = useMemo(() => {
    return classes.find(c => c.id === selectedClassId);
  }, [classes, selectedClassId]);

  // Sessions hook
  const { sessions: allSessions, upcomingSessions, loading: sessionsLoading, markSessionComplete, addMakeup } = useSessions({
    classId: selectedClassId,
    classInfo: selectedClassForSessions ? {
      name: selectedClassForSessions.name,
      teacherId: selectedClassForSessions.teacherId,
      teacherName: selectedClassForSessions.teacher,
      room: selectedClassForSessions.room,
    } : undefined
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(event.target as Node)) {
        setSessionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown when class changes
  useEffect(() => {
    setSessionDropdownOpen(false);
  }, [selectedClassId]);

  // Bug 3 fix: Load completed session IDs AND dates from attendance records with realtime listener
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedClassId) {
      setCompletedSessionIds(new Set());
      setCompletedDates(new Set());
      return;
    }

    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('classId', '==', selectedClassId)
    );

    // Use onSnapshot for realtime updates to avoid race condition
    const unsubscribe = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const completedIds = new Set<string>();
        const completedDateSet = new Set<string>();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          // Track by sessionId if available
          if (data.sessionId) {
            completedIds.add(data.sessionId);
          }
          // Also track by date for legacy records without sessionId
          if (data.date) {
            completedDateSet.add(data.date);
          }
        });
        setCompletedSessionIds(completedIds);
        setCompletedDates(completedDateSet);
      },
      (error) => {
        console.error('Error listening to completed sessions:', error);
      }
    );

    return () => unsubscribe();
  }, [selectedClassId]);

  // Get students for selected class - only show students eligible for attendance
  // Eligible statuses: Đang học, Đã học hết phí, Nợ phí (exclude: Nghỉ học, Bảo lưu, Học thử, Nợ hợp đồng)
  const ATTENDANCE_ELIGIBLE_STATUSES = [StudentStatus.ACTIVE, StudentStatus.EXPIRED_FEE, StudentStatus.DEBT];
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStudents = allStudents.filter(s => 
    (s.classId === selectedClassId || 
    s.class === selectedClass?.name ||
    s.className === selectedClass?.name ||
    (s.classIds && s.classIds.includes(selectedClassId))) &&
    ATTENDANCE_ELIGIBLE_STATUSES.includes(s.status as StudentStatus)
  );

  // Check if selected date is valid for class schedule
  const isValidScheduleDay = useMemo(() => {
    if (!selectedClass?.schedule || !attendanceDate) return true; // Allow if no schedule defined
    
    const date = new Date(attendanceDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    const schedule = selectedClass.schedule.toLowerCase();
    
    // Map Vietnamese day names to day numbers
    const dayMap: Record<string, number[]> = {
      'chủ nhật': [0],
      'thứ 2': [1], 'thứ hai': [1], 't2': [1],
      'thứ 3': [2], 'thứ ba': [2], 't3': [2],
      'thứ 4': [3], 'thứ tư': [3], 't4': [3],
      'thứ 5': [4], 'thứ năm': [4], 't5': [4],
      'thứ 6': [5], 'thứ sáu': [5], 't6': [5],
      'thứ 7': [6], 'thứ bảy': [6], 't7': [6],
    };
    
    // Find which days are in the schedule
    const scheduleDays: number[] = [];
    for (const [dayName, dayNums] of Object.entries(dayMap)) {
      if (schedule.includes(dayName)) {
        scheduleDays.push(...dayNums);
      }
    }
    
    // Also check for "2, 4, 6" or "3, 5, 7" format
    if (schedule.match(/\b2\b/)) scheduleDays.push(1);
    if (schedule.match(/\b3\b/)) scheduleDays.push(2);
    if (schedule.match(/\b4\b/)) scheduleDays.push(3);
    if (schedule.match(/\b5\b/)) scheduleDays.push(4);
    if (schedule.match(/\b6\b/)) scheduleDays.push(5);
    if (schedule.match(/\b7\b/)) scheduleDays.push(6);
    
    // If no days found, allow any day
    if (scheduleDays.length === 0) return true;
    
    return scheduleDays.includes(dayOfWeek);
  }, [selectedClass?.schedule, attendanceDate]);

  // Initialize attendance data when class/date changes
  useEffect(() => {
    if (!selectedClassId || classStudents.length === 0) {
      setAttendanceData([]);
      setExistingRecord(null);
      return;
    }

    const initData = async () => {
      // Check if attendance exists
      const existing = await checkExisting(selectedClassId, attendanceDate);
      setExistingRecord(existing);

      if (existing) {
        // Load existing attendance
        await loadStudentAttendance(existing.id);
      } else {
        // Initialize empty attendance
        setAttendanceData(
          classStudents.map(s => ({
            studentId: s.id,
            studentName: s.fullName || (s as any).name || 'Unknown',
            studentCode: s.code || s.id.slice(0, 6),
            status: AttendanceStatus.PENDING,
            note: '',
            homeworkCompletion: undefined,
            testName: '',
            score: undefined,
            bonusPoints: undefined,
            punctuality: '',
          }))
        );
      }
    };

    initData();
  }, [selectedClassId, attendanceDate, classStudents.length]);

  // Sync with loaded student attendance - only show students in current filtered classStudents
  useEffect(() => {
    if (studentAttendance.length > 0 && existingRecord && classStudents.length > 0) {
      setAttendanceData(
        classStudents.map(s => {
          const existing = studentAttendance.find(sa => sa.studentId === s.id);
          return {
            studentId: s.id,
            studentName: s.fullName || (s as any).name || 'Unknown',
            studentCode: s.code || s.id.slice(0, 6),
            status: existing?.status || AttendanceStatus.PENDING,
            note: existing?.note || '',
            homeworkCompletion: existing?.homeworkCompletion,
            testName: existing?.testName || '',
            score: existing?.score,
            bonusPoints: existing?.bonusPoints,
            punctuality: existing?.punctuality || '',
          };
        })
      );
    }
  }, [studentAttendance, existingRecord, classStudents]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setAttendanceData(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, note } : s))
    );
  };

  const handleGradeChange = (studentId: string, field: keyof StudentAttendanceState, value: any) => {
    setAttendanceData(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, [field]: value } : s))
    );
  };

  const handleBulkStatus = (status: AttendanceStatus) => {
    setAttendanceData(prev => prev.map(s => ({ ...s, status })));
  };

  const handleSave = async () => {
    if (!selectedClassId || attendanceData.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn lớp và học sinh' });
      return;
    }

    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return;

    // Use session date if in session mode, otherwise use manual date
    const dateToUse = selectedSession?.date || attendanceDate;

    try {
      setSaving(true);
      setMessage(null);

      const absentCount = attendanceData.filter(s => s.status === AttendanceStatus.ABSENT).length;

      const attendanceId = await saveAttendance(
        {
          classId: selectedClassId,
          className: selectedClass.name,
          date: dateToUse,
          // Use null instead of undefined - Firestore doesn't accept undefined values
          sessionNumber: selectedSession?.sessionNumber ?? null,
          sessionId: selectedSession?.id ?? null,
          totalStudents: attendanceData.length,
          present: attendanceData.filter(s => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE).length,
          absent: absentCount,
          reserved: attendanceData.filter(s => s.status === AttendanceStatus.RESERVED).length,
          tutored: attendanceData.filter(s => s.status === AttendanceStatus.TUTORED).length,
          status: 'Đã điểm danh',
          createdBy: user?.uid ?? null,
        },
        attendanceData.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          studentCode: s.studentCode,
          status: s.status,
          note: s.note,
          homeworkCompletion: s.homeworkCompletion,
          testName: s.testName,
          score: s.score,
          bonusPoints: s.bonusPoints,
          punctuality: s.punctuality,
          isLate: s.punctuality === 'late',
        }))
      );

      // Mark session as complete if using session mode AND all students are marked
      // Bug fix: Only mark complete when all students have been marked (no PENDING status)
      const allStudentsMarked = attendanceData.every(s => s.status && s.status !== AttendanceStatus.PENDING);
      if (selectedSession?.id && attendanceId && allStudentsMarked) {
        try {
          await markSessionComplete(selectedSession.id, attendanceId);
        } catch (err) {
          console.warn('Could not mark session complete:', err);
        }
      }

      setMessage({
        type: 'success',
        text: absentCount > 0
          ? `Lưu thành công! Đã tạo ${absentCount} lịch bồi bài cho học sinh vắng.`
          : 'Lưu điểm danh thành công!',
      });

      // Reset selection
      setSelectedSession(null);
    } catch (error) {
      console.error('[Attendance] Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể lưu điểm danh. Vui lòng thử lại.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  // Handle session selection
  const handleSelectSession = (session: ClassSession) => {
    setSelectedSession(session);
    setAttendanceDate(session.date);
  };

  const getStatusStyle = (status: AttendanceStatus, current: AttendanceStatus) => {
    const isActive = status === current && status !== AttendanceStatus.PENDING;
    const styles: Record<string, string> = {
      [AttendanceStatus.PENDING]: 'bg-white text-gray-400 border-gray-200',
      [AttendanceStatus.ON_TIME]: isActive
        ? 'bg-green-600 text-white border-green-600'
        : 'bg-white text-green-600 border-green-300 hover:bg-green-50',
      [AttendanceStatus.LATE]: isActive
        ? 'bg-yellow-500 text-white border-yellow-500'
        : 'bg-white text-yellow-600 border-yellow-300 hover:bg-yellow-50',
      [AttendanceStatus.ABSENT]: isActive
        ? 'bg-red-600 text-white border-red-600'
        : 'bg-white text-red-600 border-red-300 hover:bg-red-50',
      [AttendanceStatus.RESERVED]: isActive
        ? 'bg-orange-500 text-white border-orange-500'
        : 'bg-white text-orange-500 border-orange-300 hover:bg-orange-50',
      [AttendanceStatus.TUTORED]: isActive
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50',
    };
    return styles[status] || styles[AttendanceStatus.PENDING];
  };

  // Stats
  const stats = {
    total: attendanceData.length,
    pending: attendanceData.filter(s => s.status === AttendanceStatus.PENDING || !s.status).length,
    present: attendanceData.filter(s => s.status === AttendanceStatus.ON_TIME || s.status === AttendanceStatus.LATE).length,
    absent: attendanceData.filter(s => s.status === AttendanceStatus.ABSENT).length,
    reserved: attendanceData.filter(s => s.status === AttendanceStatus.RESERVED).length,
    tutored: attendanceData.filter(s => s.status === AttendanceStatus.TUTORED).length,
  };

  // ========== REVIEW TAB FUNCTIONS ==========
  
  // Helper: Check if a class has schedule on given date
  const classHasScheduleOnDate = (classInfo: any, dateStr: string): boolean => {
    if (!classInfo?.schedule) return false;
    
    const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday...
    const schedule = classInfo.schedule.toLowerCase();
    
    // Map day numbers - more comprehensive patterns
    const dayPatterns: Record<number, string[]> = {
      0: ['chủ nhật', 'cn', 'sunday'],
      1: ['thứ 2', 'thứ hai', 't2', 'th 2', 'monday'],
      2: ['thứ 3', 'thứ ba', 't3', 'th 3', 'tuesday'],
      3: ['thứ 4', 'thứ tư', 't4', 'th 4', 'wednesday'],
      4: ['thứ 5', 'thứ năm', 't5', 'th 5', 'thursday'],
      5: ['thứ 6', 'thứ sáu', 't6', 'th 6', 'friday'],
      6: ['thứ 7', 'thứ bảy', 't7', 'th 7', 'saturday'],
    };
    
    const patterns = dayPatterns[dayOfWeek] || [];
    const hasSchedule = patterns.some(p => schedule.includes(p));
    
    // Also check for number patterns like "2, 4, 6" or "2-4-6"
    const dayNumber = dayOfWeek === 0 ? 'cn' : String(dayOfWeek + 1); // Convert to Vietnamese day numbering (2-7, CN)
    const numberPattern = new RegExp(`\\b${dayOfWeek === 0 ? '(cn|chủ nhật)' : (dayOfWeek + 1)}\\b`, 'i');
    const hasNumberMatch = numberPattern.test(schedule);
    
    console.log('[Schedule Check]', classInfo.name, '| Date:', dateStr, '| DayOfWeek:', dayOfWeek, '| Schedule:', classInfo.schedule, '| Match:', hasSchedule || hasNumberMatch);
    
    return hasSchedule || hasNumberMatch;
  };

  // Load unmarked students for review tab - NEW LOGIC: Read from class schedule
  const loadUnmarkedStudents = async () => {
    if (allClasses.length === 0) return;
    
    setReviewLoading(true);
    try {
      // Debug: Show all classes and their schedules
      console.log('[Review] All classes:', allClasses.length);
      allClasses.forEach(c => {
        console.log('[Review] Class:', c.name, '| Status:', c.status, '| Schedule:', c.schedule);
      });
      
      // Step 1: Find all active classes that should have session on reviewDate
      // Include more status variations: Active, Đang học, Chờ mở (exclude: Kết thúc, Đã hủy, Đã kết thúc)
      const excludeStatuses = ['Kết thúc', 'Đã kết thúc', 'Đã hủy', 'Cancelled', 'Completed'];
      const activeClasses = allClasses.filter(c => {
        const isActive = !excludeStatuses.includes(c.status);
        const hasSchedule = classHasScheduleOnDate(c, reviewDate);
        console.log('[Review] Filter:', c.name, '| Status:', c.status, '| isActive:', isActive, '| hasSchedule:', hasSchedule);
        return isActive && hasSchedule;
      });
      
      console.log('[Review] Classes with schedule on', reviewDate, ':', activeClasses.map(c => c.name));
      
      // Step 2: Get existing sessions for this date
      const sessionsSnap = await getDocs(
        query(collection(db, 'classSessions'), where('date', '==', reviewDate))
      );
      const existingSessions = new Map<string, any>();
      sessionsSnap.docs.forEach(doc => {
        const data = doc.data();
        existingSessions.set(data.classId, { id: doc.id, ...data });
      });
      
      console.log('[Review] Existing sessions in DB:', existingSessions.size);
      
      const results: SessionWithUnmarked[] = [];
      
      // Step 3: Process each class that should have session
      for (const classInfo of activeClasses) {
        // Check if class is on holiday
        const classHoliday = getHolidayForDate(reviewDate, classInfo.id);
        if (classHoliday) {
          console.log('[Review] Class:', classInfo.name, '- SKIPPED: Holiday -', classHoliday.name);
          continue;
        }
        
        const existingSession = existingSessions.get(classInfo.id);
        const sessionId = existingSession?.id || `temp_${classInfo.id}_${reviewDate}`;
        const sessionNumber = existingSession?.sessionNumber || 0;
        
        // Get students in this class - only include students eligible for attendance
        // Eligible statuses: Đang học, Đã học hết phí, Nợ phí (same as main attendance tab)
        const allClassStudents = allStudents.filter(s => 
          s.classId === classInfo.id || s.class === classInfo.name || s.className === classInfo.name
        );
        const studentsInClass = allClassStudents.filter(s => 
          ATTENDANCE_ELIGIBLE_STATUSES.includes(s.status as StudentStatus)
        );
        
        console.log('[Review] Class:', classInfo.name, '| All students:', allClassStudents.length, '| Active:', studentsInClass.length);
        if (allClassStudents.length > 0) {
          console.log('[Review] Student statuses:', [...new Set(allClassStudents.map(s => s.status))]);
        }
        
        if (studentsInClass.length === 0) {
          console.log('[Review] Class:', classInfo.name, '- SKIPPED: No active students');
          continue;
        }
        
        // Get attendance records - check by sessionId OR by classId+date
        let markedStudentIds = new Set<string>();
        
        if (existingSession) {
          const attendanceSnap = await getDocs(
            query(collection(db, 'studentAttendance'), where('sessionId', '==', existingSession.id))
          );
          attendanceSnap.docs.forEach(doc => markedStudentIds.add(doc.data().studentId));
        }
        
        // Also check by classId + date (for records without sessionId)
        const attendanceByDateSnap = await getDocs(
          query(
            collection(db, 'studentAttendance'), 
            where('classId', '==', classInfo.id),
            where('date', '==', reviewDate)
          )
        );
        attendanceByDateSnap.docs.forEach(doc => markedStudentIds.add(doc.data().studentId));
        
        console.log('[Review] Class:', classInfo.name, '- Students:', studentsInClass.length, '- Marked:', markedStudentIds.size, '- HasSession:', !!existingSession);
        
        // Find unmarked students
        const unmarked: UnmarkedStudent[] = studentsInClass
          .filter(s => !markedStudentIds.has(s.id))
          .map(s => ({
            id: `${sessionId}_${s.id}`,
            sessionId,
            sessionDate: reviewDate,
            sessionNumber,
            classId: classInfo.id,
            className: classInfo.name,
            studentId: s.id,
            studentName: s.fullName || (s as any).name || 'Unknown'
          }));
        
        if (unmarked.length > 0) {
          results.push({
            sessionId,
            sessionDate: reviewDate,
            sessionNumber,
            classId: classInfo.id,
            className: classInfo.name,
            unmarkedStudents: unmarked
          });
        } else {
          console.log('[Review] Class:', classInfo.name, '- SKIPPED: All students already marked');
        }
      }
      
      results.sort((a, b) => a.className.localeCompare(b.className));
      setSessionsWithUnmarked(results);
      
    } catch (err) {
      console.error('Error loading unmarked students:', err);
    } finally {
      setReviewLoading(false);
    }
  };

  // Load when review date changes or tab switches
  useEffect(() => {
    if (activeTab === 'review') {
      loadUnmarkedStudents();
    }
  }, [reviewDate, activeTab, allClasses.length, allStudents.length]);

  // Filter sessions by class and branch - Bug 4 fix
  const filteredReviewSessions = useMemo(() => {
    let filtered = sessionsWithUnmarked;
    if (reviewFilterClass) {
      filtered = filtered.filter(s => s.classId === reviewFilterClass);
    }
    if (reviewFilterBranch) {
      const classesInBranch = new Set(allClasses.filter(c => c.branch === reviewFilterBranch).map(c => c.id));
      filtered = filtered.filter(s => classesInBranch.has(s.classId));
    }
    return filtered;
  }, [sessionsWithUnmarked, reviewFilterClass, reviewFilterBranch, allClasses]);

  // Total unmarked count
  const totalUnmarked = useMemo(() => {
    return filteredReviewSessions.reduce((sum, s) => sum + s.unmarkedStudents.length, 0);
  }, [filteredReviewSessions]);

  // Confirm attendance review
  const handleReviewConfirm = async () => {
    if (!confirmDialog.student) return;
    
    setProcessingReview(true);
    try {
      const student = confirmDialog.student;
      const isLate = confirmDialog.type === 'late';
      const isReserved = confirmDialog.type === 'reserved'; // Bug 4 fix
      
      let actualSessionId = student.sessionId;
      
      // If sessionId is temporary (starts with temp_), create a real session first
      if (student.sessionId.startsWith('temp_')) {
        const classInfo = allClasses.find(c => c.id === student.classId);
        const sessionDoc = await addDoc(collection(db, 'classSessions'), {
          classId: student.classId,
          className: student.className,
          date: student.sessionDate,
          sessionNumber: 0, // Will be updated by Cloud Function or manually
          status: 'Chưa học',
          dayOfWeek: new Date(student.sessionDate).toLocaleDateString('vi-VN', { weekday: 'long' }),
          time: classInfo?.time || '',
          room: classInfo?.room || '',
          createdAt: new Date().toISOString(),
          createdBy: staffData?.name || 'Lễ tân',
          note: 'Tạo tự động từ Rà soát điểm danh'
        });
        actualSessionId = sessionDoc.id;
        console.log('[Review] Created new session:', actualSessionId);
      }
      
      await addDoc(collection(db, 'studentAttendance'), {
        sessionId: actualSessionId,
        classId: student.classId,
        className: student.className,
        studentId: student.studentId,
        studentName: student.studentName,
        date: student.sessionDate,
        sessionNumber: student.sessionNumber,
        // Bug 4 fix: Support 'reserved' status
        status: isLate ? 'Đi trễ' : isReserved ? 'Bảo lưu' : 'Vắng',
        note: confirmDialog.reason || (isLate ? 'Đến trễ - Rà soát điểm danh' : isReserved ? 'Bảo lưu - Rà soát điểm danh' : 'Nghỉ học - Rà soát điểm danh'),
        checkedAt: new Date().toISOString(),
        checkedBy: staffData?.name || 'Lễ tân',
        isReviewed: true,
        reviewedAt: new Date().toISOString()
      });
      
      // Remove from list
      setSessionsWithUnmarked(prev => prev.map(session => {
        if (session.sessionId !== student.sessionId) return session;
        return {
          ...session,
          unmarkedStudents: session.unmarkedStudents.filter(s => s.studentId !== student.studentId)
        };
      }).filter(s => s.unmarkedStudents.length > 0));
      
      // Clear reason
      setReviewReasons(prev => {
        const newReasons = { ...prev };
        delete newReasons[student.id];
        return newReasons;
      });
      
      setConfirmDialog({ show: false, type: 'late', student: null, reason: '' });
      
    } catch (err) {
      console.error('Error confirming attendance:', err);
      alert('Có lỗi xảy ra khi xác nhận!');
    } finally {
      setProcessingReview(false);
    }
  };

  // Bug 4 fix: Support 'reserved' type
  const openReviewConfirmDialog = (type: 'late' | 'absent' | 'reserved', student: UnmarkedStudent) => {
    setConfirmDialog({
      show: true,
      type,
      student,
      reason: reviewReasons[student.id] || ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tab Header */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'attendance'
                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users size={18} />
            Điểm danh
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'review'
                ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ClipboardCheck size={18} />
            Rà soát điểm danh
            {totalUnmarked > 0 && activeTab !== 'review' && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{totalUnmarked}</span>
            )}
          </button>
        </div>

        {/* Attendance Tab Controls */}
        {activeTab === 'attendance' && (
          <div className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Điểm danh lớp học</h2>
                <p className="text-sm text-gray-500">5 trạng thái: Đúng giờ, Trễ giờ, Vắng, Bảo lưu, Đã bồi</p>
              </div>
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                {/* Searchable class dropdown with branch filter */}
                <SearchableClassDropdown
                  classes={classes}
                  selectedClassId={selectedClassId}
                  onSelect={(classId) => {
                    setSelectedClassId(classId);
                    setSelectedSession(null);
                  }}
                  disabled={classLoading}
                  placeholder="Tìm kiếm lớp..."
                />
                
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setUseSessionMode(true)}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      useSessionMode ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
                    }`}
                  >
                    Buổi học
                  </button>
                  <button
                    onClick={() => {
                      setUseSessionMode(false);
                      setSelectedSession(null); // Reset session khi chuyển sang chế độ chọn ngày
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      !useSessionMode ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
                    }`}
                  >
                    Chọn ngày
                  </button>
                </div>

                {useSessionMode ? (
                  <div ref={sessionDropdownRef} className="relative">
                    <button
                      ref={sessionButtonRef}
                      type="button"
                      onClick={() => {
                        if (selectedClassId && !sessionsLoading) {
                          if (!sessionDropdownOpen && sessionButtonRef.current) {
                            const rect = sessionButtonRef.current.getBoundingClientRect();
                            setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                          }
                          setSessionDropdownOpen(!sessionDropdownOpen);
                        }
                      }}
                      disabled={!selectedClassId || sessionsLoading}
                      className="w-[320px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between disabled:bg-gray-100"
                    >
                      <span className={selectedSession ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedSession 
                          ? `Buổi ${selectedSession.sessionNumber} - ${new Date(selectedSession.date).toLocaleDateString('vi-VN')} (${selectedSession.dayOfWeek})`
                          : '-- Chọn buổi học --'
                        }
                      </span>
                      <ChevronDown size={16} className="text-gray-400" />
                    </button>
                    
                    {sessionDropdownOpen && (
                      <div
                        style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 99999 }}
                        className="bg-white border border-gray-300 rounded-lg shadow-2xl max-h-[70vh] overflow-y-auto"
                      >
                        {[...allSessions]
                          .filter(s => s.sessionNumber > 0) // Bug 2 fix: Filter out sessions with invalid sessionNumber
                          .sort((a, b) => a.sessionNumber - b.sessionNumber)
                          .map(s => {
                          const today = new Date().toISOString().split('T')[0];
                          const isPast = s.date < today;
                          const isToday = s.date === today;
                          // Bug fix: Only check session status and attendanceId (set by markSessionComplete)
                          // Don't rely on completedSessionIds as it gets populated from any attendance record
                          const isCompleted = s.status === 'Đã học' || !!s.attendanceId;
                          
                          let bgClass = 'bg-white hover:bg-gray-50';
                          let iconColor = '#9ca3af';
                          let icon = '○';
                          
                          if (isCompleted) {
                            bgClass = 'bg-green-50 hover:bg-green-100';
                            iconColor = '#16a34a';
                            icon = '✓';
                          } else if (isPast) {
                            bgClass = 'bg-red-50 hover:bg-red-100';
                            iconColor = '#dc2626';
                            icon = '✗';
                          } else if (isToday) {
                            bgClass = 'bg-yellow-50 hover:bg-yellow-100';
                            iconColor = '#ca8a04';
                            icon = '●';
                          }
                          
                          return (
                            <div
                              key={s.id}
                              onClick={() => {
                                handleSelectSession(s);
                                setSessionDropdownOpen(false);
                              }}
                              className={`px-3 py-2 cursor-pointer text-sm flex items-center gap-2 ${bgClass} ${selectedSession?.id === s.id ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
                            >
                              <span style={{ color: iconColor, fontWeight: 'bold', fontSize: '14px' }}>{icon}</span>
                              <span>Buổi {s.sessionNumber} - {new Date(s.date).toLocaleDateString('vi-VN')} ({s.dayOfWeek})</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={attendanceDate}
                    onChange={(e) => {
                      setAttendanceDate(e.target.value);
                      setSelectedSession(null);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Review Tab Controls */}
        {activeTab === 'review' && (
          <div className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Rà soát Điểm danh</h2>
                <p className="text-sm text-gray-500">Kiểm tra học sinh chưa được điểm danh từ buổi học trước</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ngày học</label>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lọc theo lớp</label>
                  <select
                    value={reviewFilterClass}
                    onChange={(e) => setReviewFilterClass(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-w-[200px]"
                  >
                    <option value="">Tất cả lớp</option>
                    {allClasses.filter(c => ['Đang học', 'Chờ mở'].includes(c.status)).map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                {/* Bug 4 fix: Add branch filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lọc theo cơ sở</label>
                  <select
                    value={reviewFilterBranch}
                    onChange={(e) => setReviewFilterBranch(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-w-[150px]"
                  >
                    <option value="">Tất cả cơ sở</option>
                    {[...new Set(allClasses.map(c => c.branch).filter(Boolean))].map(branch => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== ATTENDANCE TAB CONTENT ========== */}
      {activeTab === 'attendance' && (
        <>
      {/* Session info */}
      {selectedSession && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center gap-3">
          <Calendar className="text-indigo-600" size={20} />
          <div>
            <p className="font-medium text-indigo-900">
              Buổi {selectedSession.sessionNumber}: {selectedSession.dayOfWeek}, {new Date(selectedSession.date).toLocaleDateString('vi-VN')}
            </p>
            <p className="text-sm text-indigo-600">
              {selectedSession.time && `Giờ: ${selectedSession.time}`}
              {selectedSession.room && ` • Phòng: ${selectedSession.room}`}
            </p>
          </div>
        </div>
      )}
      
      {/* No sessions warning - differentiate between no sessions created vs all completed */}
      {useSessionMode && selectedClassId && !sessionsLoading && upcomingSessions.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle size={20} />
            <span>
              {allSessions.length === 0
                ? 'Chưa có buổi học nào được tạo cho lớp này. Vui lòng tạo buổi học hoặc chuyển sang chế độ "Chọn ngày".'
                : 'Tất cả buổi học đã được điểm danh. Bạn có thể chọn buổi từ danh sách hoặc thêm buổi học bù.'}
            </span>
          </div>
          <button
            onClick={() => setShowAddSessionModal(true)}
            className="flex items-center gap-1 px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
          >
            <Plus size={14} /> Thêm buổi
          </button>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Schedule Warning */}
      {selectedClassId && !isValidScheduleDay && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-2 text-orange-800">
          <AlertCircle size={20} />
          <span>
            <strong>Lưu ý:</strong> Ngày {new Date(attendanceDate).toLocaleDateString('vi-VN')} không nằm trong lịch học của lớp 
            {selectedClass?.schedule && <> (Lịch: {formatSchedule(selectedClass.schedule)})</>}.
            Bạn vẫn có thể điểm danh nếu cần.
          </span>
        </div>
      )}

      {/* Holiday Warning - BLOCKING */}
      {selectedDateHoliday && (
        <div className="bg-red-100 border-2 border-red-400 rounded-lg p-4 flex items-start gap-3 text-red-800">
          <AlertTriangle size={24} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-lg">KHÔNG THỂ ĐIỂM DANH - NGÀY NGHỈ</p>
            <p className="mt-1">
              <strong>{selectedDateHoliday.name}</strong> ({selectedDateHoliday.startDate} - {selectedDateHoliday.endDate})
            </p>
            <p className="text-sm mt-2 text-red-600">
              Đây là ngày nghỉ đã được đăng ký. Không thể lưu điểm danh cho ngày này.
            </p>
            <p className="text-sm mt-1 text-red-600">
              Nếu có bản ghi cũ, lịch sử điểm danh sẽ hiển thị trạng thái "LỊCH NGHỈ CHUNG".
            </p>
          </div>
        </div>
      )}

      {/* Existing Record Notice */}
      {existingRecord && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <div className="flex items-center gap-2">
            <Clock size={20} />
            <span>
              Đã có điểm danh cho lớp này vào ngày {existingRecord.date}.
              Thay đổi sẽ cập nhật bản ghi hiện tại.
            </span>
          </div>
          <div className="mt-2 text-xs text-yellow-600 bg-yellow-100 p-2 rounded">
            <strong>Debug:</strong> Record ID: {existingRecord.id} | 
            ClassId: {existingRecord.classId} | 
            ClassName: {existingRecord.className || 'MISSING'} |
            Total: {existingRecord.totalStudents}
          </div>
        </div>
      )}

      {!selectedClassId ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          <Calendar size={48} className="mx-auto mb-4 opacity-30" />
          <p>Vui lòng chọn lớp để bắt đầu điểm danh</p>
        </div>
      ) : studentLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Đang tải danh sách học sinh...</p>
        </div>
      ) : classStudents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p>Không có học sinh trong lớp này</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Stats Header */}
          <div className="grid grid-cols-6 border-b border-gray-100 divide-x divide-gray-100">
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-bold">Tổng số</p>
              <p className="text-xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <div className="p-4 text-center bg-gray-50">
              <p className="text-xs text-gray-500 uppercase font-bold">Chưa điểm danh</p>
              <p className="text-xl font-bold text-gray-600">{stats.pending}</p>
            </div>
            <div className="p-4 text-center bg-green-50">
              <p className="text-xs text-green-600 uppercase font-bold">Có mặt</p>
              <p className="text-xl font-bold text-green-700">{stats.present}</p>
            </div>
            <div className="p-4 text-center bg-red-50">
              <p className="text-xs text-red-600 uppercase font-bold">Vắng</p>
              <p className="text-xl font-bold text-red-700">{stats.absent}</p>
            </div>
            <div className="p-4 text-center bg-orange-50">
              <p className="text-xs text-orange-600 uppercase font-bold">Bảo lưu</p>
              <p className="text-xl font-bold text-orange-700">{stats.reserved}</p>
            </div>
            <div className="p-4 text-center bg-blue-50">
              <p className="text-xs text-blue-600 uppercase font-bold">Đã bồi</p>
              <p className="text-xl font-bold text-blue-700">{stats.tutored}</p>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">Điểm danh nhanh:</span>
              <button
                onClick={() => handleBulkStatus(AttendanceStatus.ON_TIME)}
                className="px-3 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200"
              >
                Tất cả đúng giờ
              </button>
              <button
                onClick={() => handleBulkStatus(AttendanceStatus.ABSENT)}
                className="px-3 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200"
              >
                Tất cả vắng
              </button>
            </div>
            <button
              onClick={() => setShowGradeFields(!showGradeFields)}
              className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                showGradeFields 
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300' 
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {showGradeFields ? '✓ Nhập điểm số' : '+ Nhập điểm số'}
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-4 w-12">STT</th>
                <th className="px-4 py-4">Học viên</th>
                <th className="px-4 py-4 text-center">Trạng thái</th>
                {showGradeFields && (
                  <>
                    <th className="px-4 py-4 text-center w-20">% BTVN</th>
                    <th className="px-4 py-4 w-28">Tên bài KT</th>
                    <th className="px-4 py-4 text-center w-20">Điểm</th>
                    <th className="px-4 py-4 text-center w-24">Điểm thưởng</th>
                  </>
                )}
                <th className="px-4 py-4">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attendanceData.map((student, index) => (
                <tr key={student.studentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-bold text-gray-900">{student.studentName}</p>
                      <p className="text-xs text-gray-500">{student.studentCode}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1 flex-wrap">
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.ON_TIME)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.ON_TIME, student.status)}`}
                      >
                        Đúng giờ
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.LATE)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.LATE, student.status)}`}
                      >
                        Trễ giờ
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.ABSENT)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.ABSENT, student.status)}`}
                        title="Vắng sẽ tự động tạo lịch bồi bài"
                      >
                        Vắng
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.RESERVED)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.RESERVED, student.status)}`}
                      >
                        Bảo lưu
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, AttendanceStatus.TUTORED)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${getStatusStyle(AttendanceStatus.TUTORED, student.status)}`}
                      >
                        Đã bồi
                      </button>
                    </div>
                  </td>
                  {showGradeFields && (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="%"
                          value={student.homeworkCompletion ?? ''}
                          onChange={(e) => handleGradeChange(student.studentId, 'homeworkCompletion', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="Bài KT..."
                          value={student.testName || ''}
                          onChange={(e) => handleGradeChange(student.studentId, 'testName', e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-200 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          placeholder="0-10"
                          value={student.score ?? ''}
                          onChange={(e) => handleGradeChange(student.studentId, 'score', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={student.bonusPoints ?? ''}
                          onChange={(e) => handleGradeChange(student.studentId, 'bonusPoints', e.target.value ? Number(e.target.value) : undefined)}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      placeholder="Ghi chú..."
                      value={student.note}
                      onChange={(e) => handleNoteChange(student.studentId, e.target.value)}
                      className="w-full border-b border-gray-200 focus:border-indigo-500 outline-none bg-transparent py-1 text-gray-600"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center sticky bottom-0">
            <div className="text-sm text-gray-500">
              {stats.absent > 0 && (
                <span className="flex items-center gap-1 text-orange-600">
                  <BookOpen size={16} />
                  {stats.absent} học sinh vắng sẽ được tạo lịch bồi bài tự động
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setAttendanceData(
                  classStudents.map(s => ({
                    studentId: s.id,
                    studentName: s.fullName,
                    studentCode: s.code,
                    status: AttendanceStatus.PENDING,
                    note: '',
                    punctuality: '',
                  }))
                )}
                className="px-6 py-2 border border-gray-300 bg-white rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving || attendanceData.length === 0 || !!selectedDateHoliday}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={18} /> Lưu điểm danh
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Session Modal */}
      {showAddSessionModal && selectedClassId && (
        <AddSessionModal
          classId={selectedClassId}
          className={selectedClass?.name || ''}
          onClose={() => setShowAddSessionModal(false)}
          onAdd={async (date, time, note) => {
            try {
              await addMakeup(date, time, note);
              setShowAddSessionModal(false);
              setMessage({ type: 'success', text: 'Đã thêm buổi học bù thành công!' });
            } catch (err) {
              setMessage({ type: 'error', text: 'Không thể thêm buổi học: ' + (err as Error).message });
            }
          }}
        />
      )}
        </>
      )}

      {/* ========== REVIEW TAB CONTENT ========== */}
      {activeTab === 'review' && (
        <>
          {/* Holiday Warning for Review */}
          {reviewDateHoliday && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="text-red-500 flex-shrink-0" size={24} />
              <div>
                <p className="font-medium text-red-800">
                  NGÀY NGHỈ: {reviewDateHoliday.name}
                </p>
                <p className="text-sm text-red-600">
                  Ngày {reviewDate} là ngày nghỉ ({reviewDateHoliday.startDate} - {reviewDateHoliday.endDate}). Các lớp có thể không cần điểm danh.
                </p>
              </div>
            </div>
          )}

          {/* Summary Warning */}
          {totalUnmarked > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="text-amber-500 flex-shrink-0" size={24} />
              <div>
                <p className="font-medium text-amber-800">
                  Có {totalUnmarked} học sinh chưa được điểm danh ngày {reviewDate}
                </p>
                <p className="text-sm text-amber-600">
                  Vui lòng rà soát và xác nhận trạng thái điểm danh cho từng học sinh
                </p>
              </div>
            </div>
          )}

          {/* Loading/Empty/Content */}
          {reviewLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : filteredReviewSessions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <p className="text-gray-600 font-medium">Tất cả học sinh đã được điểm danh!</p>
              <p className="text-sm text-gray-400 mt-1">Không có học sinh nào cần rà soát cho ngày {reviewDate}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredReviewSessions.map(session => (
                <div key={session.sessionId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Session Header */}
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3">
                    <h3 className="text-white font-semibold">
                      Buổi học: {session.sessionDate}
                    </h3>
                    <p className="text-amber-100 text-sm">
                      Lớp: {session.className} - Buổi {session.sessionNumber}
                    </p>
                  </div>
                  
                  {/* Students Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">STT</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tên Học sinh</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-48">Thời gian/ Lý do</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">Trạng thái</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-56">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {session.unmarkedStudents.map((student, idx) => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-800">{student.studentName}</span>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                placeholder="Nhập lý do..."
                                value={reviewReasons[student.id] || ''}
                                onChange={(e) => setReviewReasons(prev => ({
                                  ...prev,
                                  [student.id]: e.target.value
                                }))}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                <AlertTriangle size={12} />
                                Chưa điểm danh
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openReviewConfirmDialog('late', student)}
                                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 flex items-center gap-1"
                                >
                                  <CheckCircle size={14} />
                                  Điểm danh đến trễ
                                </button>
                                <button
                                  onClick={() => openReviewConfirmDialog('absent', student)}
                                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 flex items-center gap-1"
                                >
                                  <XCircle size={14} />
                                  Vắng/Nghỉ học
                                </button>
                                {/* Bug 4 fix: Add Bảo lưu button */}
                                <button
                                  onClick={() => openReviewConfirmDialog('reserved', student)}
                                  className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 flex items-center gap-1"
                                >
                                  <AlertTriangle size={14} />
                                  Bảo lưu
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Review Confirm Dialog */}
      {confirmDialog.show && confirmDialog.student && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Xác nhận điểm danh</h3>
            
            <p className="text-gray-600 mb-4">
              Bạn có chắc chắn muốn{' '}
              {confirmDialog.type === 'late' ? (
                <span className="text-green-600 font-medium">Xác nhận Điểm danh đến trễ</span>
              ) : (
                <span className="text-red-600 font-medium">Xác nhận Vắng/Nghỉ học</span>
              )}{' '}
              cho học sinh <span className="font-semibold">{confirmDialog.student.studentName}</span>?
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
              <input
                type="text"
                value={confirmDialog.reason}
                onChange={(e) => setConfirmDialog(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={confirmDialog.type === 'late' ? 'VD: Đến muộn 15 phút' : 'VD: Có phép (ốm)'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog({ show: false, type: 'late', student: null, reason: '' })}
                disabled={processingReview}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleReviewConfirm}
                disabled={processingReview}
                className={`px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 ${
                  confirmDialog.type === 'late' ? 'bg-green-600 hover:bg-green-700' :
                  confirmDialog.type === 'reserved' ? 'bg-orange-500 hover:bg-orange-600' :
                  'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {processingReview ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Đang xử lý...
                  </>
                ) : (
                  'Xác nhận'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Add Session Modal Component
interface AddSessionModalProps {
  classId: string;
  className: string;
  onClose: () => void;
  onAdd: (date: string, time?: string, note?: string) => Promise<void>;
}

const AddSessionModal: React.FC<AddSessionModalProps> = ({ classId, className, onClose, onAdd }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('Buổi học bù');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      alert('Vui lòng chọn ngày');
      return;
    }
    setLoading(true);
    try {
      await onAdd(date, time || undefined, note || undefined);
    } finally {
      setLoading(false);
    }
  };

  const dayOfWeek = new Date(date).toLocaleDateString('vi-VN', { weekday: 'long' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Thêm buổi học</h3>
            <p className="text-sm text-indigo-600">{className}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>💡 Lưu ý:</strong> Buổi học này sẽ được đánh dấu là "Học bù" và thêm vào danh sách buổi học của lớp.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày học *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            {date && (
              <p className="text-sm text-gray-500 mt-1">{dayOfWeek}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Giờ học</label>
            <div className="flex gap-2">
              <input
                type="time"
                value={time.split('-')[0] || ''}
                onChange={(e) => {
                  const end = time.split('-')[1] || '';
                  setTime(e.target.value + (end ? '-' + end : ''));
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Bắt đầu"
              />
              <span className="flex items-center text-gray-400">-</span>
              <input
                type="time"
                value={time.split('-')[1] || ''}
                onChange={(e) => {
                  const start = time.split('-')[0] || '';
                  setTime((start ? start + '-' : '') + e.target.value);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Kết thúc"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Lý do học bù..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Đang thêm...
                </>
              ) : (
                <>
                  <Plus size={16} /> Thêm buổi học
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
