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
import {
  ClassFormModal,
  TestScheduleModal,
  StudentsInClassModal,
  ClassDetailModal,
} from '../src/features/classes/components';

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
          const primaryClassId = student.classId;
          const classIds = student.classIds || []; // Array of all classes student enrolled
          const className = student.class || student.className;
          const status = normalizeStatus(student.status || '');

          // Get all class IDs this student belongs to
          const allClassIds: string[] = [];

          // Add primary classId if exists
          if (primaryClassId && counts[primaryClassId]) {
            allClassIds.push(primaryClassId);
          }

          // Add all classIds from array
          classIds.forEach((cId: string) => {
            if (cId && counts[cId] && !allClassIds.includes(cId)) {
              allClassIds.push(cId);
            }
          });

          // If no classIds found, try matching by class name
          if (allClassIds.length === 0 && className) {
            const matchedClass = classes.find(c =>
              c.name === className ||
              c.id === className ||
              c.name?.toLowerCase() === className?.toLowerCase()
            );
            if (matchedClass && counts[matchedClass.id]) {
              allClassIds.push(matchedClass.id);
            }
          }

          // Count for each matched class
          allClassIds.forEach(matchedClassId => {
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
          });
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

