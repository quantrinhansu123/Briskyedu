import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Edit, Trash, ChevronDown, RotateCcw, X, BookOpen, Users, Clock, Calendar, UserPlus, UserMinus, Eye, MapPin, User, GraduationCap, CheckCircle } from 'lucide-react';
import { ClassStatus, ClassModel, Student, StudentStatus, TrainingHistoryEntry, DayScheduleConfig } from '../types';
import { useClasses } from '../src/hooks/useClasses';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove, query, where, addDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { getScheduleTime, getScheduleDays, formatSchedule } from '../src/utils/scheduleUtils';
import { ImportExportButtons } from '../components/ImportExportButtons';
import { CLASS_FIELDS, CLASS_MAPPING, prepareClassExport } from '../src/utils/excelUtils';
import { CLASS_COLOR_PALETTE, hashClassName } from './Schedule';
import { formatDisplayDate } from '../src/utils/dateUtils';
import { normalizeStudentStatus as normalizeStatus } from '../src/utils/statusUtils';

// Helper to safely format date (uses shared utility)
const formatDateSafe = (dateValue: unknown): string => {
  const formatted = formatDisplayDate(dateValue);
  return formatted || '?';
};

export const ClassManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [viewMode, setViewMode] = useState<'stats' | 'curriculum'>('stats');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassModel | null>(null);
  const [selectedClassHistory, setSelectedClassHistory] = useState<ClassModel | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  // Progress modal removed - progress is now auto-calculated from sessions
  const [showTestModal, setShowTestModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedClassForAction, setSelectedClassForAction] = useState<ClassModel | null>(null);
  const [selectedClassForStudents, setSelectedClassForStudents] = useState<ClassModel | null>(null);
  const [selectedClassForDetail, setSelectedClassForDetail] = useState<ClassModel | null>(null);

  // Permissions
  const { canCreate, canEdit, canDelete, shouldShowOnlyOwnClasses, shouldHideParentPhone, staffId } = usePermissions();
  const { user, staffData } = useAuth();
  const canCreateClass = canCreate('classes');
  const canEditClass = canEdit('classes');
  const canDeleteClass = canDelete('classes');
  const onlyOwnClasses = shouldShowOnlyOwnClasses('classes');

  const { classes: allClasses, loading, createClass, updateClass, deleteClass } = useClasses({
    searchTerm: searchTerm || undefined
  });

  // Filter classes based on permission (onlyOwnClasses for teachers)
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

  // State for student counts per class
  const [classStudentCounts, setClassStudentCounts] = useState<Record<string, {
    total: number;
    trial: number;
    active: number;
    debt: number;
    reserved: number;
    dropped: number;
    remainingSessions: number; // Công nợ buổi học còn lại
    remainingValue: number;    // Giá trị tiền (~150k/buổi)
  }>>({});

  // State for session progress per class (Single Source of Truth)
  const [classSessionStats, setClassSessionStats] = useState<Record<string, {
    completed: number;
    total: number;
  }>>({});

  // State for curriculum autocomplete (used in parent, also duplicated in ClassFormModal)
  const [curriculumList, setCurriculumList] = useState<string[]>([]);

  // Fetch curriculums from Firestore
  useEffect(() => {
    const fetchCurriculums = async () => {
      try {
        const curriculumsSnap = await getDocs(collection(db, 'curriculums'));
        const list = curriculumsSnap.docs.map(doc => doc.data().name as string).filter(Boolean);
        // Also extract unique curriculums from existing classes
        const classesSnap = await getDocs(collection(db, 'classes'));
        const classCurriculums = classesSnap.docs
          .map(doc => doc.data().curriculum as string)
          .filter(Boolean);
        // Combine and deduplicate
        const allCurriculums = [...new Set([...list, ...classCurriculums])].sort();
        setCurriculumList(allCurriculums);
      } catch (err) {
        console.error('Error fetching curriculums:', err);
      }
    };
    fetchCurriculums();
  }, []);

  // REALTIME: Listen to students collection and calculate counts for each class
  useEffect(() => {
    if (classes.length === 0) {
      setClassStudentCounts({});
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'students'),
      (snapshot) => {
        const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const PRICE_PER_SESSION = 150000;
        const counts: Record<string, { total: number; trial: number; active: number; debt: number; reserved: number; dropped: number; remainingSessions: number; remainingValue: number }> = {};
        
        // Initialize counts for all classes
        classes.forEach(cls => {
          counts[cls.id] = { total: 0, trial: 0, active: 0, debt: 0, reserved: 0, dropped: 0, remainingSessions: 0, remainingValue: 0 };
        });
        
        // Count students per class
        students.forEach((student: any) => {
          const classId = student.classId;
          const className = student.class || student.className;
          const status = normalizeStatus(student.status || '');
          
          // Find matching class by ID or name
          let matchedClassId = classId;
          if (!matchedClassId && className) {
            const matchedClass = classes.find(c => 
              c.name === className || 
              c.id === className ||
              c.name?.toLowerCase() === className?.toLowerCase()
            );
            if (matchedClass) matchedClassId = matchedClass.id;
          }
          
          if (matchedClassId && counts[matchedClassId]) {
            counts[matchedClassId].total++;

            // Count by status - "Nợ phí" takes priority if hasDebt is true
            if (status === StudentStatus.DEBT || student.hasDebt === true) {
              counts[matchedClassId].debt++;
            } else if (status === StudentStatus.TRIAL) {
              counts[matchedClassId].trial++;
            } else if (status === StudentStatus.ACTIVE) {
              counts[matchedClassId].active++;
            } else if (status === StudentStatus.RESERVED) {
              counts[matchedClassId].reserved++;
            } else if (status === StudentStatus.DROPPED) {
              counts[matchedClassId].dropped++;
            }

            // Calculate remaining sessions (công nợ buổi học còn lại)
            // Chỉ tính cho học viên đang học, học thử (không tính nghỉ học, bảo lưu)
            if (status !== StudentStatus.DROPPED && status !== StudentStatus.RESERVED) {
              const registered = student.registeredSessions || 0;
              const attended = student.attendedSessions || 0;
              const remaining = registered - attended;
              if (remaining > 0) {
                counts[matchedClassId].remainingSessions += remaining;
                counts[matchedClassId].remainingValue += remaining * PRICE_PER_SESSION;
              }
            }
          }
        });
        
        setClassStudentCounts(counts);
      },
      (err) => {
        console.error('Error listening to students:', err);
      }
    );

    return () => unsubscribe();
  }, [classes]);

  // REALTIME: Listen to classSessions collection for session stats
  useEffect(() => {
    if (classes.length === 0) {
      setClassSessionStats({});
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'classSessions'),
      (snapshot) => {
        const stats: Record<string, { completed: number; total: number }> = {};
        
        // Initialize stats for all classes
        classes.forEach(cls => {
          stats[cls.id] = { completed: 0, total: 0 };
        });
        
        // Count sessions per class
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const classId = data.classId;
          if (classId && stats[classId]) {
            stats[classId].total++;
            if (data.status === 'Đã học') {
              stats[classId].completed++;
            }
          }
        });
        
        setClassSessionStats(stats);
      },
      (err) => {
        console.error('Error listening to sessions:', err);
      }
    );

    return () => unsubscribe();
  }, [classes]);

  // Get counts for a specific class
  const getClassCounts = (classId: string) => {
    return classStudentCounts[classId] || { total: 0, trial: 0, active: 0, debt: 0, reserved: 0, dropped: 0, remainingSessions: 0, remainingValue: 0 };
  };

  // Get session stats for a specific class
  const getSessionStats = (classId: string) => {
    return classSessionStats[classId] || { completed: 0, total: 0 };
  };

  // Filter by teacher, class name, and branch on client side
  const filteredClasses = useMemo(() => {
    let result = classes;
    if (teacherFilter) {
      result = result.filter(c => c.teacher === teacherFilter);
    }
    if (classFilter) {
      result = result.filter(c => c.id === classFilter);
    }
    if (branchFilter) {
      result = result.filter(c => c.branch === branchFilter);
    }
    return result;
  }, [classes, teacherFilter, classFilter, branchFilter]);

  // Get unique branches for dropdown
  const branches = useMemo(() => {
    return [...new Set(classes.map(c => c.branch).filter(Boolean))].sort();
  }, [classes]);

  // Get unique teachers for dropdown
  const teachers = useMemo(() => {
    return Array.from(new Set(classes.map(c => c.teacher).filter(Boolean)));
  }, [classes]);

  // Calculate stats from real student counts
  const pageStats = useMemo(() => {
    return {
      total: filteredClasses.reduce((sum, c) => sum + (getClassCounts(c.id).total), 0),
      trial: filteredClasses.reduce((sum, c) => sum + (getClassCounts(c.id).trial), 0),
      active: filteredClasses.reduce((sum, c) => sum + (getClassCounts(c.id).active), 0),
      owing: filteredClasses.reduce((sum, c) => sum + (getClassCounts(c.id).debt), 0),
      reserved: filteredClasses.reduce((sum, c) => sum + (getClassCounts(c.id).reserved), 0),
      dropped: filteredClasses.reduce((sum, c) => sum + (getClassCounts(c.id).dropped), 0),
    };
  }, [filteredClasses, classStudentCounts]);

  // Normalize English status to Vietnamese
  const normalizeClassStatus = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'Active': 'Đang học',
      'active': 'Đang học',
      'Studying': 'Đang học',
      'studying': 'Đang học',
      'Inactive': 'Tạm dừng',
      'inactive': 'Tạm dừng',
      'Paused': 'Tạm dừng',
      'paused': 'Tạm dừng',
      'Finished': 'Kết thúc',
      'finished': 'Kết thúc',
      'Completed': 'Kết thúc',
      'completed': 'Kết thúc',
      'Pending': 'Chờ mở',
      'pending': 'Chờ mở',
    };
    return statusMap[status] || status;
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = normalizeClassStatus(status);
    switch (normalizedStatus) {
      case ClassStatus.STUDYING:
        return 'bg-green-500 text-white';
      case ClassStatus.FINISHED:
        return 'bg-gray-800 text-white';
      case ClassStatus.PAUSED:
        return 'bg-yellow-500 text-white';
      case ClassStatus.PENDING:
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  const handleCreate = async (data: Omit<ClassModel, 'id'>) => {
    try {
      await createClass(data);
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error creating class:', err);
    }
  };

  const handleUpdate = async (id: string, data: Partial<ClassModel>) => {
    try {
      const existingClass = classes.find(c => c.id === id);
      if (!existingClass) {
        throw new Error('Không tìm thấy lớp học');
      }

      // Detect changes and create training history entries
      const historyEntries: TrainingHistoryEntry[] = [];
      const now = new Date().toISOString();

      // Check schedule change
      if (data.schedule && data.schedule !== existingClass.schedule) {
        historyEntries.push({
          id: `TH_${Date.now()}_schedule`,
          date: now,
          type: 'schedule_change',
          description: 'Thay đổi lịch học',
          oldValue: existingClass.schedule || 'Chưa có',
          newValue: data.schedule,
          changedBy: user?.displayName || 'System'
        });
      }

      // Check teacher change
      if (data.teacher && data.teacher !== existingClass.teacher) {
        historyEntries.push({
          id: `TH_${Date.now()}_teacher`,
          date: now,
          type: 'teacher_change',
          description: 'Thay đổi giáo viên chính',
          oldValue: existingClass.teacher || 'Chưa có',
          newValue: data.teacher,
          changedBy: user?.displayName || 'System'
        });
      }

      // Check assistant change
      if (data.assistant !== undefined && data.assistant !== existingClass.assistant) {
        historyEntries.push({
          id: `TH_${Date.now()}_assistant`,
          date: now,
          type: 'teacher_change',
          description: 'Thay đổi trợ giảng',
          oldValue: existingClass.assistant || 'Chưa có',
          newValue: data.assistant || 'Không có',
          changedBy: user?.displayName || 'System'
        });
      }

      // Check foreign teacher change
      if (data.foreignTeacher !== undefined && data.foreignTeacher !== existingClass.foreignTeacher) {
        historyEntries.push({
          id: `TH_${Date.now()}_foreign`,
          date: now,
          type: 'teacher_change',
          description: 'Thay đổi giáo viên nước ngoài',
          oldValue: existingClass.foreignTeacher || 'Chưa có',
          newValue: data.foreignTeacher || 'Không có',
          changedBy: user?.displayName || 'System'
        });
      }

      // Check room change
      if (data.room !== undefined && data.room !== existingClass.room) {
        historyEntries.push({
          id: `TH_${Date.now()}_room`,
          date: now,
          type: 'room_change',
          description: 'Thay đổi phòng học',
          oldValue: existingClass.room || 'Chưa có',
          newValue: data.room || 'Không có',
          changedBy: user?.displayName || 'System'
        });
      }

      // Check status change
      if (data.status && data.status !== existingClass.status) {
        historyEntries.push({
          id: `TH_${Date.now()}_status`,
          date: now,
          type: 'status_change',
          description: 'Thay đổi trạng thái lớp',
          oldValue: existingClass.status || 'Chưa có',
          newValue: data.status,
          changedBy: user?.displayName || 'System'
        });
      }

      // Merge new history entries with existing
      if (historyEntries.length > 0) {
        const existingHistory = existingClass.trainingHistory || [];
        data.trainingHistory = [...existingHistory, ...historyEntries];
      }

      console.log('[handleUpdate] Updating class with data:', data);
      await updateClass(id, data);
      console.log('[handleUpdate] Update successful');
      setShowEditModal(false);
      setEditingClass(null);
      
      // Hiển thị thông báo thành công
      setToast({ type: 'success', message: 'Cập nhật lớp học thành công!' });
      setTimeout(() => setToast(null), 3000);
      
      // Wait for realtime update then reopen detail modal
      setTimeout(() => {
        const updatedClass = classes.find(c => c.id === id);
        if (updatedClass) {
          const mergedClass = { ...updatedClass, ...data };
          setSelectedClassForDetail(mergedClass as ClassModel);
          setShowDetailModal(true);
        }
      }, 200);
    } catch (err: any) {
      console.error('Error updating class:', err);
      setToast({ type: 'error', message: 'Lỗi khi cập nhật: ' + (err.message || 'Vui lòng thử lại') });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa lớp học này?')) return;
    try {
      const result = await deleteClass(id);
      if (!result.success) {
        // Show validation error with option to force delete
        const forceDelete = confirm(`${result.message}\n\nBạn có muốn xóa bắt buộc không? (Dữ liệu liên quan sẽ được cập nhật tự động)`);
        if (forceDelete) {
          const forceResult = await deleteClass(id, true);
          if (forceResult.success) {
            alert(forceResult.message);
          }
        }
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error('Error deleting class:', err);
    }
  };

  // Import classes from Excel
  const handleImportClass = async (data: Record<string, any>[]): Promise<{ success: number; errors: string[] }> => {
    const errors: string[] = [];
    let success = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (!row.name) {
          errors.push(`Dòng ${i + 1}: Thiếu tên lớp`);
          continue;
        }
        await createClass({
          name: row.name,
          code: row.code || `LOP${Date.now()}${i}`,
          teacher: row.teacher || '',
          assistant: row.assistant || '',
          room: row.room || '',
          curriculum: row.curriculum || '',
          ageGroup: row.ageGroup || '',
          schedule: row.schedule || '',
          startDate: row.startDate || '',
          status: row.status || ClassStatus.ACTIVE,
          maxStudents: parseInt(row.maxStudents) || 20,
          studentIds: [],
        } as any);
        success++;
      } catch (err: any) {
        errors.push(`Dòng ${i + 1} (${row.name}): ${err.message || 'Lỗi'}`);
      }
    }
    return { success, errors };
  };

  const statsColumns = ['STT', 'Lớp học', 'Tổng', 'Học thử', 'Đang học', 'Nợ phí', 'Bảo lưu', 'Tên giáo viên / Lịch học', 'Trạng thái'];
  const curriculumColumns = ['STT', 'Lớp học', 'Độ tuổi', 'Tên giáo viên / Lịch học', 'Chương trình đang học', 'Lịch test', 'Trạng thái'];
  const columns = viewMode === 'stats' ? statsColumns : curriculumColumns;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-gray-800">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
      
      {/* Top Control Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1">
          {/* Class Filter */}
          <div className="min-w-[180px]">
            <select 
              className="w-full pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">Tất cả lớp</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Teacher Filter */}
          <div className="min-w-[180px]">
            <select 
              className="w-full pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
            >
              <option value="">Tìm theo GV</option>
              {teachers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          {branches.length > 0 && (
            <div className="min-w-[160px]">
              <select 
                className="w-full pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="">Tất cả cơ sở</option>
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 max-w-lg">
            <input 
              type="text" 
              placeholder="Tìm kiếm lớp học..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ImportExportButtons
            data={classes}
            prepareExport={prepareClassExport}
            exportFileName="DanhSachLopHoc"
            fields={CLASS_FIELDS}
            mapping={CLASS_MAPPING}
            onImport={handleImportClass}
            templateFileName="MauNhapLopHoc"
            entityName="lớp học"
          />
          {canCreateClass && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-md hover:bg-green-600 transition-colors text-sm font-semibold"
            >
              <Plus size={18} />
              Tạo mới
            </button>
          )}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-6 px-1 text-sm">
        <span className="text-gray-500">Hiển thị:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="radio" 
            name="viewMode" 
            checked={viewMode === 'stats'}
            onChange={() => setViewMode('stats')}
            className="w-4 h-4 text-gray-900"
          />
          <span className={viewMode === 'stats' ? 'font-medium text-gray-900' : 'text-gray-600'}>Theo thống kê</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="radio" 
            name="viewMode" 
            checked={viewMode === 'curriculum'}
            onChange={() => setViewMode('curriculum')}
            className="w-4 h-4 text-gray-900"
          />
          <span className={viewMode === 'curriculum' ? 'font-medium text-gray-900' : 'text-gray-600'}>Theo giáo trình</span>
        </label>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-6 bg-gray-50 rounded-lg border border-gray-200 divide-x divide-gray-200">
        <div className="flex items-center justify-center p-3">
          <span className="text-blue-600 font-bold text-sm">Tổng: {pageStats.total}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-purple-600 font-bold text-sm">Học thử: {pageStats.trial}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-green-600 font-bold text-sm">Đang học: {pageStats.active}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-red-600 font-bold text-sm">Nợ phí: {pageStats.owing}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-orange-600 font-bold text-sm">Bảo lưu: {pageStats.reserved}</span>
        </div>
        <div className="flex items-center justify-center p-3">
          <span className="text-gray-500 font-bold text-sm">Nghỉ học: {pageStats.dropped}</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Column Tags */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Hiển thị {columns.length} cột</span>
            {columns.map(col => (
              <span key={col} className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded border border-gray-200">{col}</span>
            ))}
          </div>

        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white border-b border-gray-200 text-xs font-bold text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-4 w-16">STT</th>
                <th className="px-4 py-4 min-w-[150px]">Lớp học</th>
                {viewMode === 'stats' ? (
                  <>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Tổng</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Học thử</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Đang học</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Nợ phí</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Bảo lưu</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap" title="Buổi còn lại (TT nợ HV)">Buổi còn</th>
                  </>
                ) : (
                  <th className="px-4 py-4">Độ tuổi</th>
                )}
                <th className="px-4 py-4 min-w-[200px]">Tên giáo viên / Lịch học</th>
                {viewMode === 'curriculum' && (
                  <>
                    <th className="px-4 py-4 min-w-[180px]">Chương trình đang học</th>
                    <th className="px-4 py-4 w-24 text-center">Lịch test</th>
                  </>
                )}
                <th className="px-4 py-4 w-28 text-center">Trạng thái</th>
                <th className="px-4 py-4 w-24 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClasses.length > 0 ? (
                filteredClasses.map((cls, index) => (
                  <tr key={cls.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-gray-500">{index + 1}</td>
                    
                    {/* Lớp học */}
                    <td className="px-4 py-4">
                      <span 
                        className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer block"
                        onClick={() => { setSelectedClassForDetail(cls); setShowDetailModal(true); }}
                      >
                        {cls.name}
                      </span>
                      {viewMode === 'curriculum' && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <Users size={12} />
                          <span>{getClassCounts(cls.id).total} học viên</span>
                        </div>
                      )}
                    </td>

                    {viewMode === 'stats' ? (
                      <>
                        <td className="px-4 py-4 text-center font-medium">{getClassCounts(cls.id).total}</td>
                        <td className="px-4 py-4 text-center text-purple-600">{getClassCounts(cls.id).trial}</td>
                        <td className="px-4 py-4 text-center text-green-600">{getClassCounts(cls.id).active}</td>
                        <td className="px-4 py-4 text-center text-red-600">{getClassCounts(cls.id).debt}</td>
                        <td className="px-4 py-4 text-center text-orange-600">{getClassCounts(cls.id).reserved}</td>
                        <td className="px-4 py-4 text-center">
                          {getClassCounts(cls.id).remainingSessions > 0 ? (
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold" title={`~${(getClassCounts(cls.id).remainingValue / 1000000).toFixed(1)}tr`}>
                              {getClassCounts(cls.id).remainingSessions}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-4 text-gray-700">
                        {cls.ageGroup ? (() => {
                          // Convert year range to age range (e.g., "2017-2018" -> "6-7 tuổi")
                          const currentYear = new Date().getFullYear();
                          const years = cls.ageGroup.split('-').map(y => parseInt(y.trim()));
                          if (years.length === 2 && !isNaN(years[0]) && !isNaN(years[1])) {
                            const age1 = currentYear - years[0];
                            const age2 = currentYear - years[1];
                            return `${Math.min(age1, age2)}-${Math.max(age1, age2)} tuổi`;
                          }
                          return cls.ageGroup;
                        })() : '-'}
                      </td>
                    )}

                    {/* GV / Lịch học */}
                    <td className="px-4 py-4">
                      {viewMode === 'stats' ? (
                        <div>
                          <p className="font-medium text-gray-900">{cls.teacher}</p>
                          {cls.assistant && <p className="text-xs text-gray-600">TG: {cls.assistant}</p>}
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatSchedule(cls.schedule) || cls.startDate} {cls.room ? `(${cls.room})` : ''}
                          </p>
                          {cls.branch && <p className="text-xs text-purple-600 mt-0.5">📍 {cls.branch}</p>}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <Users size={14} className="text-gray-400 mt-0.5" />
                            <div>
                              <p className="font-medium text-gray-900">{cls.teacher}</p>
                              {cls.assistant && <p className="text-xs text-gray-600">TG: {cls.assistant}</p>}
                              {cls.foreignTeacher && <p className="text-xs text-purple-600">GVNN: {cls.foreignTeacher}</p>}
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clock size={14} className="text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-sm text-gray-700">{getScheduleTime(cls.schedule) || '17:30 - 19:00'}</p>
                              <p className="text-xs text-gray-500">{getScheduleDays(cls.schedule) || cls.startDate} {cls.room ? `(${cls.room})` : ''}</p>
                              {cls.branch && <p className="text-xs text-purple-600 mt-0.5">📍 {cls.branch}</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>

                    {viewMode === 'curriculum' && (
                      <>
                        {/* Chương trình đang học */}
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <p className="text-teal-700 font-medium">{cls.curriculum || '-'}</p>
                              {(() => {
                                const stats = getSessionStats(cls.id);
                                if (stats.total > 0) {
                                  return (
                                    <>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 mb-1">
                                        <div 
                                          className="bg-teal-500 h-1.5 rounded-full" 
                                          style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-xs text-gray-500">{stats.completed}/{stats.total} Buổi</span>
                                    </>
                                  );
                                } else if (cls.totalSessions) {
                                  return (
                                    <>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 mb-1">
                                        <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: '0%' }}></div>
                                      </div>
                                      <span className="text-xs text-gray-500">0/{cls.totalSessions} Buổi</span>
                                    </>
                                  );
                                } else {
                                  return <span className="text-xs text-gray-400">Chưa thiết lập</span>;
                                }
                              })()}
                            </div>
                            {/* Progress is now auto-calculated from sessions */}
                          </div>
                        </td>

                        {/* Lịch test */}
                        <td className="px-4 py-4 text-center">
                          <button 
                            onClick={() => { setSelectedClassForAction(cls); setShowTestModal(true); }}
                            className="text-green-600 hover:bg-green-50 p-1.5 rounded-full border border-green-300 inline-flex"
                            title="Thêm lịch test"
                          >
                            <Plus size={16} />
                          </button>
                        </td>
                      </>
                    )}

                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded text-xs font-bold ${getStatusBadge(cls.status)}`}>
                        {normalizeClassStatus(cls.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => { setSelectedClassForStudents(cls); setShowStudentsModal(true); }}
                          className="text-gray-400 hover:text-green-600" 
                          title="Quản lý học viên"
                        >
                          <Users size={18} />
                        </button>
                        {canEditClass && (
                          <button 
                            onClick={() => { setEditingClass(cls); setShowEditModal(true); }}
                            className="text-gray-400 hover:text-indigo-600" 
                            title="Sửa"
                          >
                            <Edit size={18} />
                          </button>
                        )}
                        {canDeleteClass && (
                          <button 
                            onClick={() => handleDelete(cls.id)}
                            className="text-gray-400 hover:text-red-600" 
                            title="Xóa"
                          >
                            <Trash size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={viewMode === 'stats' ? 10 : 9} className="px-6 py-12 text-center text-gray-500">
                    <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Chưa có lớp học nào</p>
                    {canCreateClass && (
                      <button 
                        onClick={() => setShowCreateModal(true)}
                        className="mt-2 text-indigo-600 hover:underline text-sm"
                      >
                        + Tạo lớp học mới
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-white">
          <span className="text-xs text-gray-500">
            Hiển thị {filteredClasses.length} / {classes.length} lớp học
          </span>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-500" disabled>Trước</button>
            <button className="px-3 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-600 hover:bg-gray-50">Sau</button>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <ClassFormModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editingClass && (
        <ClassFormModal
          classData={editingClass}
          onClose={() => { setShowEditModal(false); setEditingClass(null); }}
          onSubmit={(data) => handleUpdate(editingClass.id, data)}
        />
      )}

      {/* Progress Modal removed - progress is now auto-calculated from sessions */}

      {/* Test Schedule Modal */}
      {showTestModal && selectedClassForAction && (
        <TestScheduleModal
          classData={selectedClassForAction}
          onClose={() => { setShowTestModal(false); setSelectedClassForAction(null); }}
          onSubmit={async (testDate) => {
            // Save test schedule - could add to a testSchedules array in the class
            console.log('Test scheduled for:', testDate);
            setShowTestModal(false);
            setSelectedClassForAction(null);
          }}
        />
      )}

      {/* Students In Class Modal */}
      {showStudentsModal && selectedClassForStudents && (
        <StudentsInClassModal
          classData={selectedClassForStudents}
          onClose={() => { setShowStudentsModal(false); setSelectedClassForStudents(null); }}
          onUpdate={() => {
            // No-op: realtime listeners auto-update counts
          }}
        />
      )}

      {/* Class Detail Modal */}
      {showDetailModal && selectedClassForDetail && (
        <ClassDetailModal
          classData={selectedClassForDetail}
          studentCounts={classStudentCounts[selectedClassForDetail.id] || { total: 0, trial: 0, active: 0, debt: 0, reserved: 0, dropped: 0, remainingSessions: 0, remainingValue: 0 }}
          onClose={() => { setShowDetailModal(false); setSelectedClassForDetail(null); }}
          onEdit={() => {
            setShowDetailModal(false);
            setEditingClass(selectedClassForDetail);
            setShowEditModal(true);
          }}
          onManageStudents={() => {
            setShowDetailModal(false);
            setSelectedClassForStudents(selectedClassForDetail);
            setShowStudentsModal(true);
          }}
          canEdit={canEditClass}
        />
      )}
    </div>
  );
};

// ============================================
// CLASS FORM MODAL
// ============================================
interface ClassFormModalProps {
  classData?: ClassModel;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const ClassFormModal: React.FC<ClassFormModalProps> = ({ classData, onClose, onSubmit }) => {
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
    // Teacher duration allocation (legacy - giữ cho backward compatible)
    teacherEnabled: classData?.teacherDuration ? true : !!classData?.teacher,
    teacherDuration: classData?.teacherDuration || 90,
    foreignTeacherEnabled: classData?.foreignTeacherDuration ? true : !!classData?.foreignTeacher,
    foreignTeacherDuration: classData?.foreignTeacherDuration || 45,
    assistantEnabled: classData?.assistantDuration ? true : !!classData?.assistant,
    assistantDuration: classData?.assistantDuration || 90,
    // Color: -1 = auto (hash từ tên), 0-15 = manual color index
    color: classData?.color ?? -1,
  });

  // State cho cấu hình chi tiết từng ngày
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

  const scheduleOptions = [
    '08:00-09:30 Thứ 2, 4, 6',
    '08:00-09:30 Thứ 3, 5, 7',
    '09:30-11:00 Thứ 2, 4, 6',
    '09:30-11:00 Thứ 3, 5, 7',
    '14:00-15:30 Thứ 2, 4, 6',
    '14:00-15:30 Thứ 3, 5, 7',
    '15:00-16:30 Thứ 2, 4',
    '15:00-16:30 Thứ 3, 5',
    '15:30-17:00 Thứ 2, 4, 6',
    '15:30-17:00 Thứ 3, 5, 7',
    '17:00-18:30 Thứ 2, 4',
    '17:00-18:30 Thứ 3, 5',
    '17:30-19:00 Thứ 2, 4, 6',
    '17:30-19:00 Thứ 3, 5, 7',
    '18:30-20:00 Thứ 2, 4',
    '18:30-20:00 Thứ 3, 5',
    '19:00-20:30 Thứ 2, 4, 6',
    '19:00-20:30 Thứ 3, 5, 7',
    '08:00-09:30 Thứ 7',
    '09:30-11:00 Thứ 7',
    '14:00-15:30 Chủ nhật',
    '15:30-17:00 Chủ nhật',
  ];

  useEffect(() => {
    const fetchDropdownData = async () => {
      // Fetch staff
      const staffSnap = await getDocs(collection(db, 'staff'));
      const staff = staffSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || '',
        position: d.data().position || '',
      }));
      setStaffList(staff);

      // Fetch rooms
      const roomsSnap = await getDocs(collection(db, 'rooms'));
      const rooms = roomsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.data().roomName || d.id,
      }));
      setRoomList(rooms);

      // Fetch centers
      const centersSnap = await getDocs(collection(db, 'centers'));
      const centers = centersSnap.docs
        .filter(d => d.data().status === 'Active')
        .map(d => ({
          id: d.id,
          name: d.data().name || '',
        }));
      setCenterList(centers);
    };
    fetchDropdownData();
  }, []);

  // Filter staff by position - với fallback nếu không có ai match
  const vietnameseTeachers = useMemo(() => {
    const filtered = staffList.filter(s => 
      s.position?.toLowerCase().includes('giáo viên việt') || 
      s.position?.toLowerCase().includes('gv việt') ||
      s.position?.toLowerCase().includes('giáo viên') ||
      s.position?.toLowerCase() === 'giáo viên'
    );
    // Fallback: nếu không có ai match, hiển thị tất cả staff
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

  // Trợ giảng: hiển thị TẤT CẢ staff vì ai cũng có thể làm TG (linh hoạt theo nghiệp vụ)
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
      // Parse schedule like "15:00-16:30 Thứ 3, 5" or "17:30-19:00 Thứ 2, 4, 6"
      const match = classData.schedule.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*(.*)/);
      if (match) {
        const startTime = match[1];
        const endTime = match[2];
        const daysStr = match[3];
        
        // Parse days
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
        
        // Filter students by class (match by classId or className)
        const classStudents = allStudents.filter((s: any) => 
          s.classId === classData?.id || 
          s.className === classData?.name ||
          s.class === classData?.name
        );
        
        // Normalize status helper
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
        
        // Count by status
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

    // Khi sử dụng detailed schedule, tự động tạo/xóa entry
    if (useDetailedSchedule) {
      if (isRemoving) {
        // Xóa entry khi bỏ chọn ngày
        setScheduleDetailsByDay(prev => {
          const newDetails = { ...prev };
          delete newDetails[day];
          return newDetails;
        });
      } else {
        // Tạo entry mới với giá trị mặc định khi chọn ngày
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
    
    // Convert day strings to dayOfWeek numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
    const dayMap: Record<string, number> = {
      '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, 'CN': 0
    };
    const targetDays = scheduleDays.map(d => dayMap[d]).filter(d => d !== undefined);
    
    if (targetDays.length === 0) return '';
    
    let currentDate = new Date(startDate);
    let sessionCount = 0;
    const maxDays = 365 * 2; // Safety limit: 2 years
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Combine schedule parts into single string (for display/legacy)
    let schedule = formData.schedule;
    if (formData.scheduleStartTime && formData.scheduleEndTime && formData.scheduleDays.length > 0) {
      const daysStr = formData.scheduleDays.map(d => d === 'CN' ? 'Chủ nhật' : `Thứ ${d}`).join(', ');
      schedule = `${formData.scheduleStartTime}-${formData.scheduleEndTime} ${daysStr}`;
    }
    
    // Build scheduleDetails array from state (if using detailed mode)
    const scheduleDetailsArray: DayScheduleConfig[] = useDetailedSchedule 
      ? formData.scheduleDays.map(day => scheduleDetailsByDay[day]).filter(Boolean)
      : [];
    
    // Build submit data - exclude UI-only fields
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
      // Teacher fields - LUÔN lưu từ formData (dùng cho hiển thị + fallback)
      // Detailed schedule chỉ bổ sung cấu hình chi tiết, không thay thế GV chính
      teacher: formData.teacher || '',
      teacherDuration: formData.teacherDuration || null,
      foreignTeacher: formData.foreignTeacher || '',
      foreignTeacherDuration: formData.foreignTeacherDuration || null,
      assistant: formData.assistant || '',
      assistantDuration: formData.assistantDuration || null,
      // Color: -1 hoặc undefined = auto, 0-15 = manual color index
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
          <div className="grid grid-cols-2 gap-4">
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

            {/* Phân bổ giáo viên */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Phân bổ giáo viên</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDetailedSchedule}
                    onChange={(e) => {
                      setUseDetailedSchedule(e.target.checked);
                      // Khi bật detailed mode, tạo entry cho các ngày đã chọn
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
                /* Legacy mode: Cùng giáo viên cho tất cả các buổi */
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 mb-2">Áp dụng cho tất cả các buổi học</p>
                  {/* Giáo viên VN */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.teacherEnabled}
                      onChange={(e) => setFormData({ ...formData, teacherEnabled: e.target.checked })}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <span className="text-sm text-gray-600 w-32">Giáo viên VN</span>
                    <select
                      value={formData.teacher}
                      onChange={(e) => setFormData({ ...formData, teacher: e.target.value, teacherEnabled: !!e.target.value })}
                      disabled={!formData.teacherEnabled}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                    >
                      <option value="">-- Chọn --</option>
                      {vietnameseTeachers.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={formData.teacherDuration}
                      onChange={(e) => setFormData({ ...formData, teacherDuration: parseInt(e.target.value) || 0 })}
                      disabled={!formData.teacherEnabled}
                      min={0}
                      max={180}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center disabled:bg-gray-100"
                    />
                    <span className="text-xs text-gray-500">phút</span>
                  </div>

                  {/* Giáo viên nước ngoài */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.foreignTeacherEnabled}
                      onChange={(e) => setFormData({ ...formData, foreignTeacherEnabled: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm text-gray-600 w-32">GV Nước ngoài</span>
                    <select
                      value={formData.foreignTeacher}
                      onChange={(e) => setFormData({ ...formData, foreignTeacher: e.target.value, foreignTeacherEnabled: !!e.target.value })}
                      disabled={!formData.foreignTeacherEnabled}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                    >
                      <option value="">-- Chọn --</option>
                      {foreignTeachers.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={formData.foreignTeacherDuration}
                      onChange={(e) => setFormData({ ...formData, foreignTeacherDuration: parseInt(e.target.value) || 0 })}
                      disabled={!formData.foreignTeacherEnabled}
                      min={0}
                      max={180}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center disabled:bg-gray-100"
                    />
                    <span className="text-xs text-gray-500">phút</span>
                  </div>

                  {/* Trợ giảng */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.assistantEnabled}
                      onChange={(e) => setFormData({ ...formData, assistantEnabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-600 w-32">Trợ giảng</span>
                    <select
                      value={formData.assistant}
                      onChange={(e) => setFormData({ ...formData, assistant: e.target.value, assistantEnabled: !!e.target.value })}
                      disabled={!formData.assistantEnabled}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                    >
                      <option value="">-- Chọn --</option>
                      {assistants.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={formData.assistantDuration}
                      onChange={(e) => setFormData({ ...formData, assistantDuration: parseInt(e.target.value) || 0 })}
                      disabled={!formData.assistantEnabled}
                      min={0}
                      max={180}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center disabled:bg-gray-100"
                    />
                    <span className="text-xs text-gray-500">phút</span>
                  </div>
                </div>
              ) : (
                /* Detailed mode: Cấu hình riêng từng ngày */
                <div className="space-y-4">
                  {formData.scheduleDays.length === 0 ? (
                    <p className="text-xs text-orange-500 italic">Vui lòng chọn ngày học ở trên trước</p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">Cấu hình giáo viên cho từng ngày học</p>
                      {formData.scheduleDays.map((day, idx) => {
                        const dayConfig = scheduleDetailsByDay[day] || {
                          dayOfWeek: day,
                          dayLabel: getDayLabel(day),
                          startTime: formData.scheduleStartTime,
                          endTime: formData.scheduleEndTime,
                          room: '',
                          teacher: '',
                          teacherDuration: 0,
                          assistant: '',
                          assistantDuration: 0,
                          foreignTeacher: '',
                          foreignTeacherDuration: 0,
                        };
                        return (
                          <div key={day} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-800">
                                {getDayLabel(day)}
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                  ({dayConfig.startTime || formData.scheduleStartTime}-{dayConfig.endTime || formData.scheduleEndTime})
                                </span>
                              </span>
                              {idx === 0 && formData.scheduleDays.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => copyToAllDays(day)}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  Áp dụng cho tất cả
                                </button>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                              {/* GV Việt Nam */}
                              <div>
                                <label className="block text-xs text-green-600 mb-1">GV Việt Nam</label>
                                <select
                                  value={dayConfig.teacher || ''}
                                  onChange={(e) => updateDaySchedule(day, 'teacher', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                >
                                  <option value="">-- Không --</option>
                                  {vietnameseTeachers.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                  ))}
                                </select>
                                {dayConfig.teacher && (
                                  <input
                                    type="number"
                                    value={dayConfig.teacherDuration || 0}
                                    onChange={(e) => updateDaySchedule(day, 'teacherDuration', parseInt(e.target.value) || 0)}
                                    placeholder="Phút"
                                    min={0}
                                    max={180}
                                    className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-xs text-center"
                                  />
                                )}
                              </div>

                              {/* GV Nước ngoài */}
                              <div>
                                <label className="block text-xs text-purple-600 mb-1">GV Nước ngoài</label>
                                <select
                                  value={dayConfig.foreignTeacher || ''}
                                  onChange={(e) => updateDaySchedule(day, 'foreignTeacher', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                >
                                  <option value="">-- Không --</option>
                                  {foreignTeachers.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                  ))}
                                </select>
                                {dayConfig.foreignTeacher && (
                                  <input
                                    type="number"
                                    value={dayConfig.foreignTeacherDuration || 0}
                                    onChange={(e) => updateDaySchedule(day, 'foreignTeacherDuration', parseInt(e.target.value) || 0)}
                                    placeholder="Phút"
                                    min={0}
                                    max={180}
                                    className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-xs text-center"
                                  />
                                )}
                              </div>

                              {/* Trợ giảng */}
                              <div>
                                <label className="block text-xs text-blue-600 mb-1">Trợ giảng</label>
                                <select
                                  value={dayConfig.assistant || ''}
                                  onChange={(e) => updateDaySchedule(day, 'assistant', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                >
                                  <option value="">-- Không --</option>
                                  {assistants.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                  ))}
                                </select>
                                {dayConfig.assistant && (
                                  <input
                                    type="number"
                                    value={dayConfig.assistantDuration || 0}
                                    onChange={(e) => updateDaySchedule(day, 'assistantDuration', parseInt(e.target.value) || 0)}
                                    placeholder="Phút"
                                    min={0}
                                    max={180}
                                    className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-xs text-center"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Phòng học riêng cho ngày này (optional) */}
                            <div className="mt-2">
                              <label className="block text-xs text-gray-500 mb-1">Phòng học (để trống = dùng phòng mặc định)</label>
                              <select
                                value={dayConfig.room || ''}
                                onChange={(e) => updateDaySchedule(day, 'room', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                              >
                                <option value="">-- Mặc định --</option>
                                {roomList.map(r => (
                                  <option key={r.id} value={r.name}>{r.name}</option>
                                ))}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phòng học</label>
              <select
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Chọn phòng --</option>
                {roomList.length > 0 ? roomList.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                )) : (
                  <option value="" disabled>Chưa có phòng - vui lòng tạo trong Quản lý phòng</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chương trình</label>
              <div className="flex gap-2">
                <select
                  value={formData.curriculum}
                  onChange={(e) => setFormData({ ...formData, curriculum: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Chọn chương trình --</option>
                  {curriculumList.map(curriculum => (
                    <option key={curriculum} value={curriculum}>{curriculum}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCurriculumDropdown(true)}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
                  title="Thêm giáo trình mới"
                >
                  <Plus size={16} />
                </button>
              </div>
              
              {/* Add New Curriculum Modal */}
              {showCurriculumDropdown && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={() => setShowCurriculumDropdown(false)}>
                  <div className="bg-white rounded-lg shadow-xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
                    <h4 className="font-medium text-gray-800 mb-3">Thêm giáo trình mới</h4>
                    <input
                      type="text"
                      id="newCurriculumInput"
                      placeholder="Nhập tên giáo trình..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-3"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            saveCurriculum(input.value.trim());
                            setFormData({ ...formData, curriculum: input.value.trim() });
                            setShowCurriculumDropdown(false);
                          }
                        }
                      }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowCurriculumDropdown(false)}
                        className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors text-sm"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('newCurriculumInput') as HTMLInputElement;
                          if (input?.value.trim()) {
                            saveCurriculum(input.value.trim());
                            setFormData({ ...formData, curriculum: input.value.trim() });
                            setShowCurriculumDropdown(false);
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                      >
                        Thêm
                      </button>
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
                  <input
                    type="checkbox"
                    checked={formData.totalSessions === 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, totalSessions: 0, progress: 'Không giới hạn' });
                      } else {
                        setFormData({ ...formData, totalSessions: 48, progress: '0/48' });
                      }
                    }}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-xs text-green-600 font-medium">Không giới hạn</span>
                </label>
              </div>
              {formData.totalSessions === 0 ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                  Không giới hạn số buổi
                </div>
              ) : (
                <input
                  type="number"
                  value={formData.totalSessions}
                  onChange={(e) => {
                    const total = parseInt(e.target.value) || 48;
                    setFormData({ 
                      ...formData, 
                      totalSessions: total,
                      progress: `0/${total}`
                    });
                  }}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="VD: 48"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày kết thúc 
                {formData.endDate && formData.scheduleDays.length > 0 && (
                  <span className="text-xs text-green-600 font-normal ml-1">(tự động tính)</span>
                )}
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-gray-50"
                readOnly={formData.scheduleDays.length > 0 && formData.totalSessions > 0}
              />
              {formData.startDate && formData.endDate && (
                <p className="mt-1 text-xs text-gray-500">
                  Từ {new Date(formData.startDate).toLocaleDateString('vi-VN')} đến {new Date(formData.endDate).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ClassStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                {Object.values(ClassStatus).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Color Picker */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Màu hiển thị trên TKB
                <span className="text-xs text-gray-400 font-normal ml-2">(nhấn để chọn, bỏ chọn = tự động)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CLASS_COLOR_PALETTE.map((color, idx) => {
                  const isSelected = formData.color === idx;
                  const isAuto = formData.color < 0;
                  const autoIndex = hashClassName(formData.name || 'default');
                  const isAutoSelected = isAuto && autoIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: isSelected ? -1 : idx })}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${color.accent} ${
                        isSelected 
                          ? 'ring-2 ring-offset-2 ring-gray-400 scale-110 border-gray-600' 
                          : isAutoSelected
                            ? 'ring-1 ring-offset-1 ring-gray-300 border-dashed border-gray-400'
                            : 'border-transparent hover:scale-105 hover:border-gray-300'
                      }`}
                      title={isSelected ? 'Bỏ chọn (tự động)' : `Màu ${idx + 1}`}
                    />
                  );
                })}
              </div>
              {formData.color < 0 && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <span className="w-3 h-3 rounded inline-block" style={{ background: 'linear-gradient(45deg, #ccc 50%, #999 50%)' }}></span>
                  Tự động từ tên lớp (màu viền nét đứt)
                </p>
              )}
            </div>

            {/* Chỉ hiển thị số lượng học viên khi đang sửa lớp (đã có classData) */}
            {classData && (
              <div className="col-span-2 border-t pt-4 mt-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Số lượng học viên <span className="text-xs text-gray-400 font-normal">(tự động tính từ danh sách học viên)</span></p>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tổng</label>
                    <div className="w-full px-2 py-1.5 bg-gray-100 border border-gray-200 rounded text-sm text-center font-medium">
                      {formData.studentsCount}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Học thử</label>
                    <div className="w-full px-2 py-1.5 bg-purple-50 border border-purple-200 rounded text-sm text-center font-medium text-purple-700">
                      {formData.trialStudents}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Đang học</label>
                    <div className="w-full px-2 py-1.5 bg-green-50 border border-green-200 rounded text-sm text-center font-medium text-green-700">
                      {formData.activeStudents}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nợ phí</label>
                    <div className="w-full px-2 py-1.5 bg-red-50 border border-red-200 rounded text-sm text-center font-medium text-red-700">
                      {formData.debtStudents}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bảo lưu</label>
                    <div className="w-full px-2 py-1.5 bg-orange-50 border border-orange-200 rounded text-sm text-center font-medium text-orange-700">
                      {formData.reservedStudents}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              {classData ? 'Cập nhật' : 'Tạo lớp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ProgressModal removed - progress is now auto-calculated from classSessions

// ============================================
// TEST SCHEDULE MODAL - Thêm lịch test
// ============================================
interface TestScheduleModalProps {
  classData: ClassModel;
  onClose: () => void;
  onSubmit: (testDate: string, testType: string, notes: string) => void;
}

const TestScheduleModal: React.FC<TestScheduleModalProps> = ({ classData, onClose, onSubmit }) => {
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [testTime, setTestTime] = useState('09:00');
  const [testType, setTestType] = useState('Giữa kỳ');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(`${testDate} ${testTime}`, testType, notes);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-200">
              <Calendar className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Thêm lịch test</h3>
              <p className="text-sm text-gray-500">{classData.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại bài test</label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Đầu vào">Test đầu vào</option>
              <option value="Giữa kỳ">Test giữa kỳ</option>
              <option value="Cuối kỳ">Test cuối kỳ</option>
              <option value="Đầu ra">Test đầu ra</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày test</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giờ test</label>
              <input
                type="time"
                value={testTime}
                onChange={(e) => setTestTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ghi chú thêm về bài test..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Thêm lịch test
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// STUDENTS IN CLASS MODAL
// ============================================
interface StudentsInClassModalProps {
  classData: ClassModel;
  onClose: () => void;
  onUpdate: () => void;
}

const StudentsInClassModal: React.FC<StudentsInClassModalProps> = ({ classData, onClose, onUpdate }) => {
  const [studentsInClass, setStudentsInClass] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  
  // Enrollment confirmation modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<any>(null);
  const [enrollForm, setEnrollForm] = useState({
    sessions: 12,
    startDate: new Date().toISOString().split('T')[0],
  });

  // Normalize student status
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

  const getStatusColor = (status: string) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'Đang học': return 'bg-green-100 text-green-700';
      case 'Học thử': return 'bg-purple-100 text-purple-700';
      case 'Nợ phí': return 'bg-red-100 text-red-700';
      case 'Bảo lưu': return 'bg-orange-100 text-orange-700';
      case 'Nghỉ học': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const studentsSnap = await getDocs(collection(db, 'students'));
        const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Students in this class (match by classId, classIds array, className, or class field)
        const inClass = students.filter((s: any) => 
          s.classId === classData.id || 
          s.classIds?.includes(classData.id) ||
          s.className === classData.name ||
          s.class === classData.name
        );
        
        // Students not in this class (available to add)
        const notInClass = students.filter((s: any) => 
          s.classId !== classData.id && 
          !s.classIds?.includes(classData.id) &&
          s.className !== classData.name &&
          s.class !== classData.name
        );
        
        setStudentsInClass(inClass);
        setAllStudents(notInClass);
      } catch (err) {
        console.error('Error fetching students:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [classData]);

  // Open enrollment modal when adding student
  const addStudentToClass = (student: any) => {
    setSelectedStudentToAdd(student);
    setEnrollForm({
      sessions: 12,
      startDate: new Date().toISOString().split('T')[0],
    });
    setShowEnrollModal(true);
  };

  // Confirm add student with enrollment
  const confirmAddStudent = async () => {
    if (!selectedStudentToAdd) return;
    
    setAdding(true);
    try {
      const studentRef = doc(db, 'students', selectedStudentToAdd.id);
      
      // Update student with classId, sessions, and add to classIds array
      await updateDoc(studentRef, {
        classId: classData.id,
        className: classData.name,
        class: classData.name,
        classIds: arrayUnion(classData.id),
        registeredSessions: (selectedStudentToAdd.registeredSessions || 0) + enrollForm.sessions,
        enrollmentDate: enrollForm.startDate,
        status: 'Đang học',
      });
      
      // Create enrollment record
      await addDoc(collection(db, 'enrollments'), {
        studentId: selectedStudentToAdd.id,
        studentName: selectedStudentToAdd.fullName || selectedStudentToAdd.name,
        studentCode: selectedStudentToAdd.code || '',
        classId: classData.id,
        className: classData.name,
        sessions: enrollForm.sessions,
        startDate: enrollForm.startDate,
        type: 'Ghi danh thủ công',
        status: 'Đã xác nhận',
        createdAt: new Date().toISOString(),
        note: `Thêm vào lớp ${classData.name} từ Quản lý học viên`,
      });
      
      // Update local state
      const updatedStudent = {
        ...selectedStudentToAdd,
        classId: classData.id,
        className: classData.name,
        registeredSessions: (selectedStudentToAdd.registeredSessions || 0) + enrollForm.sessions,
        status: 'Đang học',
      };
      setStudentsInClass(prev => [...prev, updatedStudent]);
      setAllStudents(prev => prev.filter(s => s.id !== selectedStudentToAdd.id));
      
      setShowEnrollModal(false);
      setSelectedStudentToAdd(null);
      onUpdate();
      alert('Đã thêm học viên và tạo ghi danh thành công!');
    } catch (err) {
      console.error('Error adding student to class:', err);
      alert('Không thể thêm học viên vào lớp');
    } finally {
      setAdding(false);
    }
  };

  // Remove student from class
  const removeStudentFromClass = async (student: any) => {
    if (!confirm(`Bạn có chắc muốn xóa ${student.fullName || student.name} khỏi lớp ${classData.name}?`)) return;
    
    try {
      const studentRef = doc(db, 'students', student.id);
      
      // Remove class reference
      await updateDoc(studentRef, {
        classId: null,
        className: null,
        class: null,
        classIds: arrayRemove(classData.id),
      });
      
      // Update local state
      setStudentsInClass(prev => prev.filter(s => s.id !== student.id));
      setAllStudents(prev => [...prev, { ...student, classId: null, className: null }]);
      onUpdate();
    } catch (err) {
      console.error('Error removing student from class:', err);
      alert('Không thể xóa học viên khỏi lớp');
    }
  };

  // Filter students in class by status
  const filteredStudentsInClass = useMemo(() => {
    if (statusFilter === 'ALL') return studentsInClass;
    return studentsInClass.filter(s => normalizeStatus(s.status) === statusFilter);
  }, [studentsInClass, statusFilter]);

  // Get unique statuses for dropdown
  const availableStatuses = useMemo(() => {
    const statuses = new Set(studentsInClass.map(s => normalizeStatus(s.status)));
    return Array.from(statuses).sort();
  }, [studentsInClass]);

  // Filter available students by search
  const filteredAvailableStudents = useMemo(() => {
    if (!searchTerm) return allStudents.slice(0, 10); // Show first 10 by default
    const term = searchTerm.toLowerCase();
    return allStudents.filter(s => 
      (s.fullName || s.name || '').toLowerCase().includes(term) ||
      (s.code || '').toLowerCase().includes(term) ||
      (s.phone || '').includes(term)
    ).slice(0, 20);
  }, [allStudents, searchTerm]);

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-200">
              <Users className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Quản lý học viên trong lớp</h3>
              <p className="text-sm text-gray-500">{classData.name} - {studentsInClass.length} học viên</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Current Students List */}
          <div className="flex-1 p-4 border-r border-gray-200 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Học viên trong lớp ({filteredStudentsInClass.length}/{studentsInClass.length})
              </h4>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Đang học">Đang học</option>
                <option value="Học thử">Học thử</option>
                <option value="Nợ phí">Nợ phí</option>
                <option value="Bảo lưu">Bảo lưu</option>
                <option value="Nghỉ học">Nghỉ học</option>
              </select>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
              </div>
            ) : filteredStudentsInClass.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p>{statusFilter === 'ALL' ? 'Chưa có học viên nào trong lớp' : `Không có học viên "${statusFilter}"`}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStudentsInClass.map((student) => {
                  const registered = student.registeredSessions || 0;
                  const attended = student.attendedSessions || 0;
                  const remaining = Math.max(0, registered - attended);
                  return (
                  <div 
                    key={student.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{student.fullName || student.name}</span>
                        <span className="text-xs text-gray-500">({student.code})</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(student.status)}`}>
                          {normalizeStatus(student.status)}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-blue-600" title="Đăng ký">{registered} ĐK</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-green-600" title="Đã học">{attended} ĐH</span>
                          <span className="text-gray-400">/</span>
                          <span className={`font-medium ${remaining <= 3 ? 'text-red-600' : 'text-orange-600'}`} title="Còn lại">
                            {remaining} CL
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeStudentFromClass(student)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa khỏi lớp"
                    >
                      <UserMinus size={18} />
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Students Section */}
          <div className="w-full lg:w-80 p-4 bg-gray-50 overflow-y-auto">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Thêm học viên
            </h4>
            
            {/* Search */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Tìm theo tên, mã, SĐT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Available Students */}
            <div className="space-y-2">
              {filteredAvailableStudents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {searchTerm ? 'Không tìm thấy học viên' : 'Không có học viên khả dụng'}
                </p>
              ) : (
                filteredAvailableStudents.map((student) => (
                  <div 
                    key={student.id}
                    className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{student.fullName || student.name}</p>
                      <p className="text-xs text-gray-500">{student.code}</p>
                    </div>
                    <button
                      onClick={() => addStudentToClass(student)}
                      disabled={adding}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Thêm vào lớp"
                    >
                      <UserPlus size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {allStudents.length > 10 && !searchTerm && (
              <p className="text-xs text-gray-500 text-center mt-3">
                Hiển thị 10/{allStudents.length} học viên. Tìm kiếm để xem thêm.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Enrollment Confirmation Modal */}
      {showEnrollModal && selectedStudentToAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Xác nhận ghi danh</h3>
              <p className="text-sm text-gray-600 mt-1">Thêm học viên vào lớp {classData.name}</p>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Student Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800">{selectedStudentToAdd.fullName || selectedStudentToAdd.name}</p>
                <p className="text-sm text-gray-500">Mã: {selectedStudentToAdd.code || 'N/A'}</p>
              </div>

              {/* Sessions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số buổi đăng ký <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={enrollForm.sessions}
                  onChange={(e) => setEnrollForm(prev => ({ ...prev, sessions: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày bắt đầu <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={enrollForm.startDate}
                  onChange={(e) => setEnrollForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <p className="text-green-800">
                  <span className="font-medium">Ghi danh thủ công:</span> {enrollForm.sessions} buổi, 
                  bắt đầu từ {new Date(enrollForm.startDate).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowEnrollModal(false); setSelectedStudentToAdd(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={adding}
              >
                Hủy
              </button>
              <button
                onClick={confirmAddStudent}
                disabled={adding || enrollForm.sessions < 1}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {adding ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Xác nhận thêm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// CLASS DETAIL MODAL
// ============================================
interface ClassDetailModalProps {
  classData: ClassModel;
  studentCounts: { total: number; trial: number; active: number; debt: number; reserved: number; dropped: number; remainingSessions: number; remainingValue: number };
  onClose: () => void;
  onEdit: () => void;
  onManageStudents: () => void;
  canEdit: boolean;
}

const ClassDetailModal: React.FC<ClassDetailModalProps> = ({ 
  classData, 
  studentCounts, 
  onClose, 
  onEdit, 
  onManageStudents,
  canEdit 
}) => {
  const [studentsInClass, setStudentsInClass] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<{ completed: number; total: number; upcoming: ClassSession[] }>({ completed: 0, total: 0, upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Fetch students in class and session stats
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch students
        const studentsSnap = await getDocs(collection(db, 'students'));
        const students = studentsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((s: any) => 
            s.classId === classData.id || 
            s.currentClassId === classData.id ||
            s.class === classData.name ||
            s.className === classData.name
          );
        setStudentsInClass(students);

        // Fetch sessions
        const sessionsSnap = await getDocs(
          query(
            collection(db, 'classSessions'),
            where('classId', '==', classData.id)
          )
        );
        const sessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClassSession[];
        const completed = sessions.filter(s => s.status === 'Đã học').length;
        const today = new Date().toISOString().split('T')[0];
        const upcoming = sessions
          .filter(s => s.status === 'Chưa học' && s.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 3);
        
        setSessionStats({ completed, total: sessions.length, upcoming });
      } catch (err) {
        console.error('Error fetching class data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [classData.id, classData.name]);

  // Generate sessions for this class
  const handleGenerateSessions = async () => {
    if (!classData.schedule || !classData.totalSessions) {
      alert('Vui lòng cập nhật lịch học và tổng số buổi trước khi tạo buổi học');
      return;
    }
    
    if (!confirm(`Tạo ${classData.totalSessions} buổi học cho lớp ${classData.name}?`)) return;
    
    setGenerating(true);
    try {
      // Parse schedule
      const DAY_MAP: Record<string, number> = {
        'chủ nhật': 0, 'cn': 0,
        'thứ 2': 1, 'thứ hai': 1, 't2': 1,
        'thứ 3': 2, 'thứ ba': 2, 't3': 2,
        'thứ 4': 3, 'thứ tư': 3, 't4': 3,
        'thứ 5': 4, 'thứ năm': 4, 't5': 4,
        'thứ 6': 5, 'thứ sáu': 5, 't6': 5,
        'thứ 7': 6, 'thứ bảy': 6, 't7': 6,
      };
      const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      
      const scheduleLower = classData.schedule.toLowerCase();
      const days: Set<number> = new Set();
      
      for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
        if (scheduleLower.includes(dayName)) days.add(dayNum);
      }
      const tMatches = classData.schedule.match(/T([2-7])/gi);
      if (tMatches) {
        tMatches.forEach(match => {
          const n = parseInt(match.substring(1));
          if (n >= 2 && n <= 7) days.add(n === 7 ? 6 : n - 1);
        });
      }
      
      const scheduleDays = Array.from(days).sort();
      if (scheduleDays.length === 0) {
        alert('Không thể phân tích lịch học. Vui lòng kiểm tra định dạng.');
        setGenerating(false);
        return;
      }
      
      // Parse time
      const timeMatch = classData.schedule.match(/(\d{1,2})[h:](\d{2})?\s*[-–]\s*(\d{1,2})[h:](\d{2})?/);
      const time = timeMatch 
        ? `${timeMatch[1].padStart(2, '0')}:${(timeMatch[2] || '00').padStart(2, '0')}-${timeMatch[3].padStart(2, '0')}:${(timeMatch[4] || '00').padStart(2, '0')}`
        : null;
      
      // Generate sessions
      const sessions: any[] = [];
      let currentDate = classData.startDate ? new Date(classData.startDate) : new Date();
      let sessionNumber = 1;
      let daysChecked = 0;
      
      while (sessionNumber <= classData.totalSessions && daysChecked < 365) {
        const dayOfWeek = currentDate.getDay();
        if (scheduleDays.includes(dayOfWeek)) {
          sessions.push({
            classId: classData.id,
            className: classData.name,
            sessionNumber,
            date: currentDate.toISOString().split('T')[0],
            dayOfWeek: DAY_NAMES[dayOfWeek],
            time,
            room: classData.room || null,
            teacherName: classData.teacher || null,
            status: 'Chưa học',
            createdAt: new Date().toISOString(),
          });
          sessionNumber++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
        daysChecked++;
      }
      
      // Save to Firestore
      for (const session of sessions) {
        await addDoc(collection(db, 'classSessions'), session);
      }
      
      alert(`Đã tạo ${sessions.length} buổi học!`);
      
      // Refresh session stats
      setSessionStats({ completed: 0, total: sessions.length, upcoming: sessions.slice(0, 3) as ClassSession[] });
    } catch (err) {
      console.error('Error generating sessions:', err);
      alert('Lỗi khi tạo buổi học');
    } finally {
      setGenerating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Đang hoạt động':
      case 'Active':
        return 'bg-green-100 text-green-700';
      case 'Kết thúc':
        return 'bg-gray-100 text-gray-700';
      case 'Tạm dừng':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{classData.name}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(classData.status)}`}>
                  {classData.status}
                </span>
                {classData.level && (
                  <span className="text-blue-200 text-sm">• {classData.level}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="text-blue-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Giáo viên VN</p>
                <p className="font-medium text-gray-800">{classData.teacher || 'Chưa phân công'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <GraduationCap className="text-purple-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Giáo viên NN</p>
                <p className="font-medium text-gray-800">{classData.foreignTeacher || 'Không có'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="text-green-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Lịch học</p>
                <p className="font-medium text-gray-800">{formatSchedule(classData.schedule) || 'Chưa có'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <MapPin className="text-red-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Phòng học</p>
                <p className="font-medium text-gray-800">{classData.room || 'Chưa xếp'}</p>
              </div>
            </div>
            {classData.branch && (
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin className="text-purple-600 mt-0.5" size={20} />
                <div>
                  <p className="text-xs text-gray-500">Cơ sở</p>
                  <p className="font-medium text-gray-800">{classData.branch}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="text-orange-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Thời gian</p>
                <p className="font-medium text-gray-800">
                  {formatDateSafe(classData.startDate)} → {formatDateSafe(classData.endDate)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <BookOpen className="text-indigo-600 mt-0.5" size={20} />
              <div>
                <p className="text-xs text-gray-500">Chương trình</p>
                <p className="font-medium text-gray-800">{classData.curriculum || 'Chưa có'}</p>
              </div>
            </div>
          </div>

          {/* Session Progress */}
          <div className={`rounded-lg p-4 ${classData.status === 'Kết thúc' ? 'bg-gray-100' : 'bg-indigo-50'}`}>
            <h3 className={`font-semibold mb-3 flex items-center gap-2 ${classData.status === 'Kết thúc' ? 'text-gray-700' : 'text-indigo-900'}`}>
              <CheckCircle size={18} />
              Tiến độ buổi học
            </h3>
            {loading ? (
              <div className="text-center text-indigo-600">Đang tải...</div>
            ) : classData.status === 'Kết thúc' ? (
              /* Lớp đã kết thúc */
              <div className="text-gray-600 text-sm">
                {sessionStats.total > 0 ? (
                  <p>Lớp đã kết thúc - Hoàn thành {sessionStats.completed}/{sessionStats.total} buổi</p>
                ) : (
                  <p>Lớp đã kết thúc (không có dữ liệu buổi học)</p>
                )}
              </div>
            ) : sessionStats.total > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1 bg-indigo-200 rounded-full h-3">
                    <div 
                      className="bg-indigo-600 h-3 rounded-full transition-all"
                      style={{ width: `${(sessionStats.completed / sessionStats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-indigo-900">
                    {sessionStats.completed}/{sessionStats.total} buổi
                  </span>
                </div>
                {sessionStats.upcoming.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-indigo-700 mb-2">Buổi học sắp tới:</p>
                    <div className="space-y-1">
                      {sessionStats.upcoming.map(s => (
                        <div key={s.id} className="text-sm text-indigo-800 flex items-center gap-2">
                          <span className="w-16">Buổi {s.sessionNumber}</span>
                          <span>{new Date(s.date).toLocaleDateString('vi-VN')}</span>
                          <span className="text-indigo-500">({s.dayOfWeek})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : classData.totalSessions ? (
              /* Có tổng số buổi nhưng chưa tạo sessions */
              <div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1 bg-indigo-200 rounded-full h-3">
                    <div 
                      className="bg-indigo-600 h-3 rounded-full transition-all"
                      style={{ width: '0%' }}
                    />
                  </div>
                  <span className="text-sm font-medium text-indigo-900">
                    0/{classData.totalSessions} buổi
                  </span>
                </div>
                <button
                  onClick={handleGenerateSessions}
                  disabled={generating}
                  className="w-full mt-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                >
                  {generating ? 'Đang tạo...' : `Tạo ${classData.totalSessions} buổi học`}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-indigo-600 text-sm mb-2">Chưa thiết lập số buổi học</p>
                <p className="text-xs text-gray-500">Vui lòng chỉnh sửa lớp để thêm tổng số buổi và lịch học</p>
              </div>
            )}
          </div>

          {/* Student Stats */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <Users size={18} />
              Học viên ({studentCounts.total})
            </h3>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-green-600">{studentCounts.active}</p>
                <p className="text-xs text-gray-500">Đang học</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-purple-600">{studentCounts.trial}</p>
                <p className="text-xs text-gray-500">Học thử</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-red-600">{studentCounts.debt}</p>
                <p className="text-xs text-gray-500">Nợ phí</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-orange-600">{studentCounts.reserved}</p>
                <p className="text-xs text-gray-500">Bảo lưu</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-gray-500">{studentCounts.dropped}</p>
                <p className="text-xs text-gray-500">Nghỉ học</p>
              </div>
            </div>
            
            {/* Student List Preview */}
            {studentsInClass.length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-green-700 mb-2">Danh sách học viên:</p>
                <div className="flex flex-wrap gap-1">
                  {studentsInClass.slice(0, 8).map((s: any) => (
                    <span key={s.id} className="px-2 py-1 bg-white rounded text-xs text-gray-700">
                      {s.fullName || s.name}
                    </span>
                  ))}
                  {studentsInClass.length > 8 && (
                    <span className="px-2 py-1 bg-green-200 rounded text-xs text-green-700">
                      +{studentsInClass.length - 8} khác
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Công nợ buổi học còn lại */}
            {studentCounts.remainingSessions > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-green-700 mb-2">Buổi học còn lại (TT nợ HV):</p>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold">
                    {studentCounts.remainingSessions} buổi
                  </span>
                  <span className="text-sm text-gray-600">
                    ~{(studentCounts.remainingValue / 1000000).toFixed(1)} triệu đồng
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Training History - Always show */}
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <Clock size={18} />
              Lịch sử đào tạo ({(classData.trainingHistory?.length || 0) + (classData.teacher ? 1 : 0)})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {/* Show training history if exists */}
              {classData.trainingHistory && classData.trainingHistory.length > 0 && 
                [...classData.trainingHistory]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((entry) => (
                    <div key={entry.id} className="bg-white rounded-lg p-3 border border-purple-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          entry.type === 'schedule_change' ? 'bg-blue-100 text-blue-700' :
                          entry.type === 'teacher_change' ? 'bg-green-100 text-green-700' :
                          entry.type === 'room_change' ? 'bg-orange-100 text-orange-700' :
                          entry.type === 'status_change' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {entry.type === 'schedule_change' ? 'Lịch học' :
                           entry.type === 'teacher_change' ? 'Giáo viên' :
                           entry.type === 'room_change' ? 'Phòng học' :
                           entry.type === 'status_change' ? 'Trạng thái' : 'Khác'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.date).toLocaleDateString('vi-VN', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 font-medium">{entry.description}</p>
                      <div className="text-xs text-gray-600 mt-1">
                        <span className="line-through text-red-500">{entry.oldValue}</span>
                        <span className="mx-2">→</span>
                        <span className="text-green-600 font-medium">{entry.newValue}</span>
                      </div>
                      {entry.changedBy && (
                        <p className="text-xs text-gray-400 mt-1">Bởi: {entry.changedBy}</p>
                      )}
                    </div>
                  ))
              }
              
              {/* Always show current teacher as the initial/current state */}
              {classData.teacher && (
                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Giáo viên
                    </span>
                    <span className="text-xs text-gray-500">
                      {(() => {
                        if (!classData.createdAt) return 'Ban đầu';
                        // Handle Firestore Timestamp
                        const date = classData.createdAt?.toDate ? classData.createdAt.toDate() : new Date(classData.createdAt);
                        if (isNaN(date.getTime())) return 'Ban đầu';
                        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      })()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 font-medium">Thay đổi giáo viên chính</p>
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="text-gray-400">Bắt đầu</span>
                    <span className="mx-2">→</span>
                    <span className="text-green-600 font-medium">{classData.teacher}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Bởi: System</p>
                </div>
              )}
              
              {/* Show message if no teacher assigned */}
              {!classData.teacher && (!classData.trainingHistory || classData.trainingHistory.length === 0) && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Chưa có thông tin đào tạo
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {classData.notes && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Ghi chú</h3>
              <p className="text-sm text-yellow-800">{classData.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={onManageStudents}
            className="px-4 py-2 border border-green-500 text-green-600 rounded-lg hover:bg-green-50 flex items-center gap-2"
          >
            <Users size={18} /> Quản lý học viên
          </button>
          <div className="flex gap-2">
            {canEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Edit size={18} /> Chỉnh sửa
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Type for ClassSession used in detail modal
interface ClassSession {
  id: string;
  classId: string;
  sessionNumber: number;
  date: string;
  dayOfWeek: string;
  status: string;
}
