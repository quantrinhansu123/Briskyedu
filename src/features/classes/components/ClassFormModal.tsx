/**
 * ClassFormModal Component
 * Modal for creating and editing class information
 * Extracted from pages/ClassManager.tsx for modularity
 */

import React, { useState, useMemo, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { ClassStatus, ClassModel, DayScheduleConfig } from '@/types';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { CLASS_COLOR_PALETTE, hashClassName } from '@/pages/Schedule';

export interface ClassFormModalProps {
  classData?: ClassModel;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const ClassFormModal: React.FC<ClassFormModalProps> = ({ classData, onClose, onSubmit }) => {
  // Helper to parse existing scheduleDetails or create from legacy data
  const initScheduleDetails = (): Record<string, DayScheduleConfig> => {
    if (classData?.scheduleDetails && classData.scheduleDetails.length > 0) {
      const details: Record<string, DayScheduleConfig> = {};
      classData.scheduleDetails.forEach(d => {
        details[d.dayOfWeek] = d;
      });
      return details;
    }
    return {};
  };

  const [formData, setFormData] = useState({
    name: classData?.name || '',
    branch: classData?.branch || '',
    ageGroup: classData?.ageGroup || '',
    teacher: classData?.teacher || '',
    assistant: classData?.assistant || '',
    foreignTeacher: classData?.foreignTeacher || '',
    curriculum: classData?.curriculum || '',
    progress: classData?.progress || '0/48',
    totalSessions: classData?.totalSessions || 48,
    schedule: classData?.schedule || '',
    scheduleStartTime: '',
    scheduleEndTime: '',
    scheduleDays: [] as string[],
    room: classData?.room || '',
    startDate: classData?.startDate || new Date().toISOString().split('T')[0],
    endDate: classData?.endDate || '',
    status: classData?.status || ClassStatus.PENDING,
    studentsCount: classData?.studentsCount || 0,
    trialStudents: classData?.trialStudents || 0,
    activeStudents: classData?.activeStudents || 0,
    debtStudents: classData?.debtStudents || 0,
    reservedStudents: classData?.reservedStudents || 0,
    teacherEnabled: classData?.teacherDuration ? true : !!classData?.teacher,
    teacherDuration: classData?.teacherDuration || 90,
    foreignTeacherEnabled: classData?.foreignTeacherDuration ? true : !!classData?.foreignTeacher,
    foreignTeacherDuration: classData?.foreignTeacherDuration || 45,
    assistantEnabled: classData?.assistantDuration ? true : !!classData?.assistant,
    assistantDuration: classData?.assistantDuration || 90,
    color: classData?.color ?? -1,
  });

  const [scheduleDetailsByDay, setScheduleDetailsByDay] = useState<Record<string, DayScheduleConfig>>(initScheduleDetails);
  const [useDetailedSchedule, setUseDetailedSchedule] = useState(!!classData?.scheduleDetails?.length);

  // Fetch actual session count for existing classes without totalSessions
  useEffect(() => {
    const fetchActualSessionCount = async () => {
      if (classData && !classData.totalSessions) {
        try {
          const sessionsSnap = await getDocs(
            query(collection(db, 'classSessions'), where('classId', '==', classData.id))
          );
          const actualCount = sessionsSnap.size;
          if (actualCount > 0) {
            setFormData(prev => ({
              ...prev,
              totalSessions: actualCount,
              progress: `0/${actualCount}`
            }));
          }
        } catch (err) {
          console.error('Error fetching session count:', err);
        }
      }
    };
    fetchActualSessionCount();
  }, [classData]);

  // Dropdown options
  const [staffList, setStaffList] = useState<{ id: string; name: string; position: string }[]>([]);
  const [roomList, setRoomList] = useState<{ id: string; name: string }[]>([]);
  const [centerList, setCenterList] = useState<{ id: string; name: string }[]>([]);

  // All classes for room conflict validation
  const [allClasses, setAllClasses] = useState<{ id: string; room: string; schedule: string; scheduleDays?: string[] }[]>([]);
  const [roomConflictError, setRoomConflictError] = useState<string | null>(null);

  // Curriculum autocomplete state
  const [curriculumList, setCurriculumList] = useState<string[]>([]);
  const [showCurriculumDropdown, setShowCurriculumDropdown] = useState(false);

  // Fetch curriculums
  useEffect(() => {
    const fetchCurriculums = async () => {
      try {
        const curriculumsSnap = await getDocs(collection(db, 'curriculums'));
        const list = curriculumsSnap.docs.map(doc => doc.data().name as string).filter(Boolean);
        const classesSnap = await getDocs(collection(db, 'classes'));
        const classCurriculums = classesSnap.docs
          .map(doc => doc.data().curriculum as string)
          .filter(Boolean);
        const allCurriculums = [...new Set([...list, ...classCurriculums])].sort();
        setCurriculumList(allCurriculums);
      } catch (err) {
        console.error('Error fetching curriculums:', err);
      }
    };
    fetchCurriculums();
  }, []);

  // Save new curriculum
  const saveCurriculum = async (name: string) => {
    if (!name.trim() || curriculumList.includes(name.trim())) return;
    try {
      await addDoc(collection(db, 'curriculums'), {
        name: name.trim(),
        createdAt: new Date().toISOString()
      });
      setCurriculumList(prev => [...prev, name.trim()].sort());
    } catch (err) {
      console.error('Error saving curriculum:', err);
    }
  };

  // Predefined options
  const ageGroupOptions = [
    '2009-2010', '2010-2011', '2011-2012', '2012-2013', '2013-2014', '2014-2015',
    '2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020',
    '2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025'
  ];

  useEffect(() => {
    const fetchDropdownData = async () => {
      const staffSnap = await getDocs(collection(db, 'staff'));
      const staff = staffSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || '',
        position: d.data().position || '',
      }));
      setStaffList(staff);

      const roomsSnap = await getDocs(collection(db, 'rooms'));
      const rooms = roomsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.data().roomName || d.id,
      }));
      setRoomList(rooms);

      const centersSnap = await getDocs(collection(db, 'centers'));
      const centers = centersSnap.docs
        .filter(d => d.data().status === 'Active')
        .map(d => ({
          id: d.id,
          name: d.data().name || '',
        }));
      setCenterList(centers);

      // Fetch all classes for room conflict validation
      const classesSnap = await getDocs(collection(db, 'classes'));
      const classes = classesSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || '',
        room: d.data().room || '',
        schedule: d.data().schedule || '',
        scheduleDays: d.data().scheduleDays || [],
      }));
      setAllClasses(classes);
    };
    fetchDropdownData();
  }, []);

  // Filter staff by position
  const vietnameseTeachers = useMemo(() => {
    const filtered = staffList.filter(s =>
      s.position?.toLowerCase().includes('giáo viên việt') ||
      s.position?.toLowerCase().includes('gv việt') ||
      s.position?.toLowerCase().includes('giáo viên') ||
      s.position?.toLowerCase() === 'giáo viên'
    );
    return filtered.length > 0 ? filtered : staffList;
  }, [staffList]);

  const foreignTeachers = useMemo(() => {
    const filtered = staffList.filter(s =>
      s.position?.toLowerCase().includes('nước ngoài') ||
      s.position?.toLowerCase().includes('gv ngoại') ||
      s.position?.toLowerCase().includes('foreign')
    );
    return filtered.length > 0 ? filtered : staffList;
  }, [staffList]);

  const assistants = useMemo(() => staffList, [staffList]);

  // Days options
  const daysOptions = [
    { value: '2', label: 'Thứ 2' },
    { value: '3', label: 'Thứ 3' },
    { value: '4', label: 'Thứ 4' },
    { value: '5', label: 'Thứ 5' },
    { value: '6', label: 'Thứ 6' },
    { value: '7', label: 'Thứ 7' },
    { value: 'CN', label: 'Chủ nhật' },
  ];

  // Time options
  const timeOptions = [
    '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
    '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
    '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
  ];

  // Parse existing schedule when editing
  useEffect(() => {
    if (classData?.schedule) {
      const match = classData.schedule.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*(.*)/);
      if (match) {
        const startTime = match[1];
        const endTime = match[2];
        const daysStr = match[3];

        const days: string[] = [];
        if (daysStr.includes('Chủ nhật') || daysStr.includes('CN')) days.push('CN');
        for (let i = 2; i <= 7; i++) {
          if (daysStr.includes(`Thứ ${i}`) || daysStr.includes(`, ${i}`) || daysStr.match(new RegExp(`\\b${i}\\b`))) {
            days.push(i.toString());
          }
        }

        setFormData(prev => ({
          ...prev,
          scheduleStartTime: startTime,
          scheduleEndTime: endTime,
          scheduleDays: days,
        }));
      }
    }
  }, [classData]);

  // Auto-calculate student counts from Firebase
  useEffect(() => {
    const fetchStudentCounts = async () => {
      if (!classData?.id && !classData?.name) return;

      try {
        const studentsSnap = await getDocs(collection(db, 'students'));
        const allStudents = studentsSnap.docs.map(d => d.data());

        const classStudents = allStudents.filter((s: any) =>
          s.classId === classData?.id ||
          s.className === classData?.name ||
          s.class === classData?.name
        );

        const normalizeStatus = (status: string): string => {
          const map: { [key: string]: string } = {
            'Active': 'Đang học', 'active': 'Đang học',
            'Trial': 'Học thử', 'trial': 'Học thử',
            'Reserved': 'Bảo lưu', 'reserved': 'Bảo lưu',
            'Debt': 'Nợ phí', 'debt': 'Nợ phí',
            'Dropped': 'Nghỉ học', 'dropped': 'Nghỉ học',
          };
          return map[status] || status;
        };

        const counts = {
          total: classStudents.length,
          trial: classStudents.filter((s: any) => normalizeStatus(s.status) === 'Học thử').length,
          active: classStudents.filter((s: any) => normalizeStatus(s.status) === 'Đang học').length,
          debt: classStudents.filter((s: any) => normalizeStatus(s.status) === 'Nợ phí' || s.hasDebt).length,
          reserved: classStudents.filter((s: any) => normalizeStatus(s.status) === 'Bảo lưu').length,
        };

        setFormData(prev => ({
          ...prev,
          studentsCount: counts.total,
          trialStudents: counts.trial,
          activeStudents: counts.active,
          debtStudents: counts.debt,
          reservedStudents: counts.reserved,
        }));
      } catch (err) {
        console.error('Error fetching student counts:', err);
      }
    };

    if (classData) {
      fetchStudentCounts();
    }
  }, [classData]);

  // Day label helper
  const getDayLabel = (day: string) => day === 'CN' ? 'Chủ nhật' : `Thứ ${day}`;

  // Toggle day selection
  const toggleDay = (day: string) => {
    const isRemoving = formData.scheduleDays.includes(day);

    setFormData(prev => ({
      ...prev,
      scheduleDays: isRemoving
        ? prev.scheduleDays.filter(d => d !== day)
        : [...prev.scheduleDays, day].sort((a, b) => {
            if (a === 'CN') return 1;
            if (b === 'CN') return -1;
            return parseInt(a) - parseInt(b);
          }),
    }));

    if (useDetailedSchedule) {
      if (isRemoving) {
        setScheduleDetailsByDay(prev => {
          const newDetails = { ...prev };
          delete newDetails[day];
          return newDetails;
        });
      } else {
        setScheduleDetailsByDay(prev => ({
          ...prev,
          [day]: {
            dayOfWeek: day,
            dayLabel: getDayLabel(day),
            startTime: formData.scheduleStartTime || '18:00',
            endTime: formData.scheduleEndTime || '19:30',
            room: formData.room || '',
            teacher: formData.teacher || '',
            teacherDuration: 90,
            assistant: '',
            assistantDuration: 0,
            foreignTeacher: '',
            foreignTeacherDuration: 0,
          }
        }));
      }
    }
  };

  // Update a specific day's schedule config
  const updateDaySchedule = (day: string, field: keyof DayScheduleConfig, value: any) => {
    setScheduleDetailsByDay(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      }
    }));
  };

  // Copy settings from one day to all other days
  const copyToAllDays = (sourceDay: string) => {
    const source = scheduleDetailsByDay[sourceDay];
    if (!source) return;

    setScheduleDetailsByDay(prev => {
      const newDetails = { ...prev };
      formData.scheduleDays.forEach(day => {
        if (day !== sourceDay) {
          newDetails[day] = {
            ...source,
            dayOfWeek: day,
            dayLabel: getDayLabel(day),
          };
        }
      });
      return newDetails;
    });
  };

  // Calculate end date based on startDate, totalSessions, and scheduleDays
  const calculateEndDate = (startDate: string, totalSessions: number, scheduleDays: string[]): string => {
    if (!startDate || totalSessions <= 0 || scheduleDays.length === 0) return '';

    const dayMap: Record<string, number> = {
      '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, 'CN': 0
    };
    const targetDays = scheduleDays.map(d => dayMap[d]).filter(d => d !== undefined);

    if (targetDays.length === 0) return '';

    let currentDate = new Date(startDate);
    let sessionCount = 0;
    const maxDays = 365 * 2;
    let daysChecked = 0;

    while (sessionCount < totalSessions && daysChecked < maxDays) {
      const dayOfWeek = currentDate.getDay();
      if (targetDays.includes(dayOfWeek)) {
        sessionCount++;
        if (sessionCount === totalSessions) {
          return currentDate.toISOString().split('T')[0];
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
      daysChecked++;
    }

    return '';
  };

  // Auto-calculate endDate when relevant fields change
  useEffect(() => {
    if (formData.startDate && formData.totalSessions > 0 && formData.scheduleDays.length > 0) {
      const calculatedEndDate = calculateEndDate(
        formData.startDate,
        formData.totalSessions,
        formData.scheduleDays
      );
      if (calculatedEndDate && calculatedEndDate !== formData.endDate) {
        setFormData(prev => ({ ...prev, endDate: calculatedEndDate }));
      }
    }
  }, [formData.startDate, formData.totalSessions, formData.scheduleDays]);

  // Helper to parse time from schedule string (e.g., "08:00-10:00" or from schedule like "08:00-10:00 Thứ 2")
  const parseScheduleTime = (schedule: string): { start: string; end: string } | null => {
    const timeMatch = schedule.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (timeMatch) {
      return { start: timeMatch[1], end: timeMatch[2] };
    }
    return null;
  };

  // Helper to check if two time ranges overlap
  const timeRangesOverlap = (time1: { start: string; end: string }, time2: { start: string; end: string }): boolean => {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    const start1 = toMinutes(time1.start), end1 = toMinutes(time1.end);
    const start2 = toMinutes(time2.start), end2 = toMinutes(time2.end);
    return start1 < end2 && start2 < end1;
  };

  // Helper to get days from schedule string
  const getScheduleDays = (schedule: string): string[] => {
    const days: string[] = [];
    const dayPatterns = [
      { pattern: /Thứ 2|T2/gi, day: '2' },
      { pattern: /Thứ 3|T3/gi, day: '3' },
      { pattern: /Thứ 4|T4/gi, day: '4' },
      { pattern: /Thứ 5|T5/gi, day: '5' },
      { pattern: /Thứ 6|T6/gi, day: '6' },
      { pattern: /Thứ 7|T7/gi, day: '7' },
      { pattern: /Chủ nhật|CN/gi, day: 'CN' },
    ];
    dayPatterns.forEach(({ pattern, day }) => {
      if (pattern.test(schedule)) days.push(day);
    });
    return days;
  };

  // Room conflict validation
  const checkRoomConflict = (): string | null => {
    if (!formData.room || formData.scheduleDays.length === 0) return null;

    const currentTime = formData.scheduleStartTime && formData.scheduleEndTime
      ? { start: formData.scheduleStartTime, end: formData.scheduleEndTime }
      : parseScheduleTime(formData.schedule);

    if (!currentTime) return null;

    for (const cls of allClasses) {
      // Skip current class if editing
      if (classData && cls.id === classData.id) continue;
      // Skip if different room
      if (cls.room !== formData.room) continue;

      // Get the other class's schedule info
      const otherTime = parseScheduleTime(cls.schedule);
      if (!otherTime) continue;

      const otherDays = cls.scheduleDays?.length > 0 ? cls.scheduleDays : getScheduleDays(cls.schedule);

      // Check if any days overlap
      const hasOverlappingDay = formData.scheduleDays.some(d => otherDays.includes(d));
      if (!hasOverlappingDay) continue;

      // Check if time overlaps
      if (timeRangesOverlap(currentTime, otherTime)) {
        const conflictDays = formData.scheduleDays.filter(d => otherDays.includes(d));
        return `Phòng "${formData.room}" đã có lớp "${cls.name}" học vào ${conflictDays.map(d => d === 'CN' ? 'Chủ nhật' : `Thứ ${d}`).join(', ')} (${cls.schedule}). Vui lòng chọn phòng hoặc khung giờ khác.`;
      }
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRoomConflictError(null);

    // Check room conflict before submitting
    const conflictError = checkRoomConflict();
    if (conflictError) {
      setRoomConflictError(conflictError);
      return;
    }

    let schedule = formData.schedule;
    if (formData.scheduleStartTime && formData.scheduleEndTime && formData.scheduleDays.length > 0) {
      const daysStr = formData.scheduleDays.map(d => d === 'CN' ? 'Chủ nhật' : `Thứ ${d}`).join(', ');
      schedule = `${formData.scheduleStartTime}-${formData.scheduleEndTime} ${daysStr}`;
    }

    const scheduleDetailsArray: DayScheduleConfig[] = useDetailedSchedule
      ? formData.scheduleDays.map(day => scheduleDetailsByDay[day]).filter(Boolean)
      : [];

    const submitData: any = {
      name: formData.name,
      branch: formData.branch,
      ageGroup: formData.ageGroup,
      curriculum: formData.curriculum,
      progress: formData.progress,
      totalSessions: formData.totalSessions,
      schedule,
      scheduleDetails: scheduleDetailsArray.length > 0 ? scheduleDetailsArray : null,
      room: formData.room,
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: formData.status,
      studentsCount: formData.studentsCount,
      trialStudents: formData.trialStudents,
      activeStudents: formData.activeStudents,
      debtStudents: formData.debtStudents,
      reservedStudents: formData.reservedStudents,
      teacher: formData.teacher || '',
      teacherDuration: formData.teacherDuration || null,
      foreignTeacher: formData.foreignTeacher || '',
      foreignTeacherDuration: formData.foreignTeacherDuration || null,
      assistant: formData.assistant || '',
      assistantDuration: formData.assistantDuration || null,
      color: formData.color >= 0 ? formData.color : undefined,
    };

    console.log('[ClassFormModal] Submitting:', submitData);
    onSubmit(submitData);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50">
          <h3 className="text-lg font-bold text-gray-900">
            {classData ? 'Chỉnh sửa lớp học' : 'Tạo lớp học mới'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[70vh]">
          {/* Room conflict error */}
          {roomConflictError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <strong>⚠️ Xung đột phòng học:</strong> {roomConflictError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Tên lớp học */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên lớp học *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="VD: Tiếng Anh Giao Tiếp K12"
              />
            </div>

            {/* Cơ sở */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cơ sở</label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Chọn cơ sở --</option>
                {centerList.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Giáo viên */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giáo viên *</label>
              <select
                required
                value={formData.teacher}
                onChange={(e) => setFormData({ ...formData, teacher: e.target.value, teacherEnabled: !!e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Chọn giáo viên --</option>
                {vietnameseTeachers.length > 0 ? vietnameseTeachers.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                )) : staffList.map(t => (
                  <option key={t.id} value={t.name}>{t.name} ({t.position})</option>
                ))}
              </select>
            </div>

            {/* Trợ giảng */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trợ giảng</label>
              <select
                value={formData.assistant}
                onChange={(e) => setFormData({ ...formData, assistant: e.target.value, assistantEnabled: !!e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Chọn trợ giảng --</option>
                {assistants.length > 0 ? assistants.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                )) : staffList.map(t => (
                  <option key={t.id} value={t.name}>{t.name} ({t.position})</option>
                ))}
              </select>
            </div>

            {/* GV Nước ngoài */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GV Nước ngoài</label>
              <select
                value={formData.foreignTeacher}
                onChange={(e) => setFormData({ ...formData, foreignTeacher: e.target.value, foreignTeacherEnabled: !!e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Chọn GV nước ngoài --</option>
                {foreignTeachers.length > 0 ? foreignTeachers.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                )) : staffList.map(t => (
                  <option key={t.id} value={t.name}>{t.name} ({t.position})</option>
                ))}
              </select>
            </div>

            {/* Độ tuổi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Độ tuổi</label>
              <select
                value={formData.ageGroup}
                onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Chọn độ tuổi --</option>
                {ageGroupOptions.map(age => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </div>

            {/* Lịch học */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Lịch học</label>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Giờ bắt đầu</label>
                  <select
                    value={formData.scheduleStartTime}
                    onChange={(e) => setFormData({ ...formData, scheduleStartTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="">-- Chọn --</option>
                    {timeOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Giờ kết thúc</label>
                  <select
                    value={formData.scheduleEndTime}
                    onChange={(e) => setFormData({ ...formData, scheduleEndTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="">-- Chọn --</option>
                    {timeOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ngày học</label>
                <div className="flex flex-wrap gap-2">
                  {daysOptions.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        formData.scheduleDays.includes(day.value)
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
              {formData.scheduleStartTime && formData.scheduleEndTime && formData.scheduleDays.length > 0 && (
                <p className="mt-2 text-xs text-green-600 font-medium">
                  Lịch: {formData.scheduleStartTime}-{formData.scheduleEndTime} {formData.scheduleDays.map(d => d === 'CN' ? 'Chủ nhật' : `Thứ ${d}`).join(', ')}
                </p>
              )}
            </div>

            {/* Teacher allocation section */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Phân bổ giáo viên</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDetailedSchedule}
                    onChange={(e) => {
                      setUseDetailedSchedule(e.target.checked);
                      if (e.target.checked && formData.scheduleDays.length > 0) {
                        const newDetails: Record<string, DayScheduleConfig> = {};
                        formData.scheduleDays.forEach(day => {
                          newDetails[day] = {
                            dayOfWeek: day,
                            dayLabel: getDayLabel(day),
                            startTime: formData.scheduleStartTime || '18:00',
                            endTime: formData.scheduleEndTime || '19:30',
                            room: formData.room || '',
                            teacher: formData.teacher || '',
                            teacherDuration: formData.teacherDuration || 90,
                            assistant: formData.assistant || '',
                            assistantDuration: formData.assistantDuration || 0,
                            foreignTeacher: formData.foreignTeacher || '',
                            foreignTeacherDuration: formData.foreignTeacherDuration || 0,
                          };
                        });
                        setScheduleDetailsByDay(newDetails);
                      }
                    }}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <span className="text-xs text-orange-600 font-medium">Cấu hình riêng từng ngày</span>
                </label>
              </div>

              {!useDetailedSchedule ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 mb-2">Áp dụng cho tất cả các buổi học</p>
                  {/* GV VN */}
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.teacherEnabled} onChange={(e) => setFormData({ ...formData, teacherEnabled: e.target.checked })} className="w-4 h-4 text-green-600 rounded" />
                    <span className="text-sm text-gray-600 w-32">Giáo viên VN</span>
                    <select value={formData.teacher} onChange={(e) => setFormData({ ...formData, teacher: e.target.value, teacherEnabled: !!e.target.value })} disabled={!formData.teacherEnabled} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100">
                      <option value="">-- Chọn --</option>
                      {vietnameseTeachers.map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}
                    </select>
                    <input type="number" value={formData.teacherDuration} onChange={(e) => setFormData({ ...formData, teacherDuration: parseInt(e.target.value) || 0 })} disabled={!formData.teacherEnabled} min={0} max={180} className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center disabled:bg-gray-100" />
                    <span className="text-xs text-gray-500">phút</span>
                  </div>
                  {/* GV NN */}
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.foreignTeacherEnabled} onChange={(e) => setFormData({ ...formData, foreignTeacherEnabled: e.target.checked })} className="w-4 h-4 text-purple-600 rounded" />
                    <span className="text-sm text-gray-600 w-32">GV Nước ngoài</span>
                    <select value={formData.foreignTeacher} onChange={(e) => setFormData({ ...formData, foreignTeacher: e.target.value, foreignTeacherEnabled: !!e.target.value })} disabled={!formData.foreignTeacherEnabled} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100">
                      <option value="">-- Chọn --</option>
                      {foreignTeachers.map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}
                    </select>
                    <input type="number" value={formData.foreignTeacherDuration} onChange={(e) => setFormData({ ...formData, foreignTeacherDuration: parseInt(e.target.value) || 0 })} disabled={!formData.foreignTeacherEnabled} min={0} max={180} className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center disabled:bg-gray-100" />
                    <span className="text-xs text-gray-500">phút</span>
                  </div>
                  {/* Trợ giảng */}
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.assistantEnabled} onChange={(e) => setFormData({ ...formData, assistantEnabled: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-600 w-32">Trợ giảng</span>
                    <select value={formData.assistant} onChange={(e) => setFormData({ ...formData, assistant: e.target.value, assistantEnabled: !!e.target.value })} disabled={!formData.assistantEnabled} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100">
                      <option value="">-- Chọn --</option>
                      {assistants.map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}
                    </select>
                    <input type="number" value={formData.assistantDuration} onChange={(e) => setFormData({ ...formData, assistantDuration: parseInt(e.target.value) || 0 })} disabled={!formData.assistantEnabled} min={0} max={180} className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center disabled:bg-gray-100" />
                    <span className="text-xs text-gray-500">phút</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.scheduleDays.length === 0 ? (
                    <p className="text-xs text-orange-500 italic">Vui lòng chọn ngày học ở trên trước</p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">Cấu hình giáo viên cho từng ngày học</p>
                      {formData.scheduleDays.map((day, idx) => {
                        const dayConfig = scheduleDetailsByDay[day] || {
                          dayOfWeek: day, dayLabel: getDayLabel(day), startTime: formData.scheduleStartTime, endTime: formData.scheduleEndTime,
                          room: '', teacher: '', teacherDuration: 0, assistant: '', assistantDuration: 0, foreignTeacher: '', foreignTeacherDuration: 0,
                        };
                        return (
                          <div key={day} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-800">
                                {getDayLabel(day)}
                                <span className="ml-2 text-xs font-normal text-gray-500">({dayConfig.startTime || formData.scheduleStartTime}-{dayConfig.endTime || formData.scheduleEndTime})</span>
                              </span>
                              {idx === 0 && formData.scheduleDays.length > 1 && (
                                <button type="button" onClick={() => copyToAllDays(day)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Áp dụng cho tất cả</button>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-green-600 mb-1">GV Việt Nam</label>
                                <select value={dayConfig.teacher || ''} onChange={(e) => updateDaySchedule(day, 'teacher', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
                                  <option value="">-- Không --</option>
                                  {vietnameseTeachers.map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}
                                </select>
                                {dayConfig.teacher && (<input type="number" value={dayConfig.teacherDuration || 0} onChange={(e) => updateDaySchedule(day, 'teacherDuration', parseInt(e.target.value) || 0)} placeholder="Phút" min={0} max={180} className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-xs text-center" />)}
                              </div>
                              <div>
                                <label className="block text-xs text-purple-600 mb-1">GV Nước ngoài</label>
                                <select value={dayConfig.foreignTeacher || ''} onChange={(e) => updateDaySchedule(day, 'foreignTeacher', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
                                  <option value="">-- Không --</option>
                                  {foreignTeachers.map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}
                                </select>
                                {dayConfig.foreignTeacher && (<input type="number" value={dayConfig.foreignTeacherDuration || 0} onChange={(e) => updateDaySchedule(day, 'foreignTeacherDuration', parseInt(e.target.value) || 0)} placeholder="Phút" min={0} max={180} className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-xs text-center" />)}
                              </div>
                              <div>
                                <label className="block text-xs text-blue-600 mb-1">Trợ giảng</label>
                                <select value={dayConfig.assistant || ''} onChange={(e) => updateDaySchedule(day, 'assistant', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
                                  <option value="">-- Không --</option>
                                  {assistants.map(t => (<option key={t.id} value={t.name}>{t.name}</option>))}
                                </select>
                                {dayConfig.assistant && (<input type="number" value={dayConfig.assistantDuration || 0} onChange={(e) => updateDaySchedule(day, 'assistantDuration', parseInt(e.target.value) || 0)} placeholder="Phút" min={0} max={180} className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-xs text-center" />)}
                              </div>
                            </div>
                            <div className="mt-2">
                              <label className="block text-xs text-gray-500 mb-1">Phòng học</label>
                              <select value={dayConfig.room || ''} onChange={(e) => updateDaySchedule(day, 'room', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
                                <option value="">-- Mặc định --</option>
                                {roomList.map(r => (<option key={r.id} value={r.name}>{r.name}</option>))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Phòng học */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phòng học</label>
              <select value={formData.room} onChange={(e) => setFormData({ ...formData, room: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                <option value="">-- Chọn phòng --</option>
                {roomList.length > 0 ? roomList.map(r => (<option key={r.id} value={r.name}>{r.name}</option>)) : (<option value="" disabled>Chưa có phòng</option>)}
              </select>
            </div>

            {/* Chương trình */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chương trình</label>
              <div className="flex gap-2">
                <select value={formData.curriculum} onChange={(e) => setFormData({ ...formData, curriculum: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                  <option value="">-- Chọn chương trình --</option>
                  {curriculumList.map(curriculum => (<option key={curriculum} value={curriculum}>{curriculum}</option>))}
                </select>
                <button type="button" onClick={() => setShowCurriculumDropdown(true)} className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1" title="Thêm giáo trình mới">
                  <Plus size={16} />
                </button>
              </div>
              {showCurriculumDropdown && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={() => setShowCurriculumDropdown(false)}>
                  <div className="bg-white rounded-lg shadow-xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
                    <h4 className="font-medium text-gray-800 mb-3">Thêm giáo trình mới</h4>
                    <input type="text" id="newCurriculumInput" placeholder="Nhập tên giáo trình..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-3" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { const input = e.target as HTMLInputElement; if (input.value.trim()) { saveCurriculum(input.value.trim()); setFormData({ ...formData, curriculum: input.value.trim() }); setShowCurriculumDropdown(false); } } }} />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setShowCurriculumDropdown(false)} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors text-sm">Hủy</button>
                      <button type="button" onClick={() => { const input = document.getElementById('newCurriculumInput') as HTMLInputElement; if (input?.value.trim()) { saveCurriculum(input.value.trim()); setFormData({ ...formData, curriculum: input.value.trim() }); setShowCurriculumDropdown(false); } }} className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm">Thêm</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tổng số buổi học */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Tổng số buổi học</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.totalSessions === 0} onChange={(e) => { if (e.target.checked) { setFormData({ ...formData, totalSessions: 0, progress: 'Không giới hạn' }); } else { setFormData({ ...formData, totalSessions: 48, progress: '0/48' }); } }} className="w-4 h-4 text-green-600 rounded" />
                  <span className="text-xs text-green-600 font-medium">Không giới hạn</span>
                </label>
              </div>
              {formData.totalSessions === 0 ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">Không giới hạn số buổi</div>
              ) : (
                <input type="number" value={formData.totalSessions} onChange={(e) => { const total = parseInt(e.target.value) || 48; setFormData({ ...formData, totalSessions: total, progress: `0/${total}` }); }} min={1} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="VD: 48" />
              )}
            </div>

            {/* Ngày bắt đầu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
              <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
            </div>

            {/* Ngày kết thúc */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc {formData.endDate && formData.scheduleDays.length > 0 && (<span className="text-xs text-green-600 font-normal ml-1">(tự động tính)</span>)}</label>
              <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-gray-50" readOnly={formData.scheduleDays.length > 0 && formData.totalSessions > 0} />
              {formData.startDate && formData.endDate && (<p className="mt-1 text-xs text-gray-500">Từ {new Date(formData.startDate).toLocaleDateString('vi-VN')} đến {new Date(formData.endDate).toLocaleDateString('vi-VN')}</p>)}
            </div>

            {/* Trạng thái */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as ClassStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                {Object.values(ClassStatus).map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>

            {/* Color Picker */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Màu hiển thị trên TKB<span className="text-xs text-gray-400 font-normal ml-2">(nhấn để chọn, bỏ chọn = tự động)</span></label>
              <div className="flex flex-wrap gap-2">
                {CLASS_COLOR_PALETTE.map((color, idx) => {
                  const isSelected = formData.color === idx;
                  const isAuto = formData.color < 0;
                  const autoIndex = hashClassName(formData.name || 'default');
                  const isAutoSelected = isAuto && autoIndex === idx;
                  return (
                    <button key={idx} type="button" onClick={() => setFormData({ ...formData, color: isSelected ? -1 : idx })} className={`w-8 h-8 rounded-lg border-2 transition-all ${color.accent} ${isSelected ? 'ring-2 ring-offset-2 ring-gray-400 scale-110 border-gray-600' : isAutoSelected ? 'ring-1 ring-offset-1 ring-gray-300 border-dashed border-gray-400' : 'border-transparent hover:scale-105 hover:border-gray-300'}`} title={isSelected ? 'Bỏ chọn (tự động)' : `Màu ${idx + 1}`} />
                  );
                })}
              </div>
              {formData.color < 0 && (<p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: 'linear-gradient(45deg, #ccc 50%, #999 50%)' }}></span>Tự động từ tên lớp</p>)}
            </div>

            {/* Student counts when editing */}
            {classData && (
              <div className="col-span-2 border-t pt-4 mt-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Số lượng học viên <span className="text-xs text-gray-400 font-normal">(tự động tính)</span></p>
                <div className="grid grid-cols-5 gap-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Tổng</label><div className="w-full px-2 py-1.5 bg-gray-100 border border-gray-200 rounded text-sm text-center font-medium">{formData.studentsCount}</div></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Học thử</label><div className="w-full px-2 py-1.5 bg-purple-50 border border-purple-200 rounded text-sm text-center font-medium text-purple-700">{formData.trialStudents}</div></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Đang học</label><div className="w-full px-2 py-1.5 bg-green-50 border border-green-200 rounded text-sm text-center font-medium text-green-700">{formData.activeStudents}</div></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Nợ phí</label><div className="w-full px-2 py-1.5 bg-red-50 border border-red-200 rounded text-sm text-center font-medium text-red-700">{formData.debtStudents}</div></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Bảo lưu</label><div className="w-full px-2 py-1.5 bg-orange-50 border border-orange-200 rounded text-sm text-center font-medium text-orange-700">{formData.reservedStudents}</div></div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">{classData ? 'Cập nhật' : 'Tạo lớp'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassFormModal;
