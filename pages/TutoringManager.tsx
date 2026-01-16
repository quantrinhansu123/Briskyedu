/**
 * Lịch Bồi Bài - Make-up Class Manager
 * Quản lý các buổi học kèm, bồi dưỡng kiến thức
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BookOpen, Plus, Calendar, Clock, X, Check, Trash2, Users,
  Circle, CheckCircle2, CalendarCheck, Sparkles, Search,
  ChevronDown, XCircle, PauseCircle, RotateCcw  // NEW icons
} from 'lucide-react';
import { useTutoring, TutoringData, TutoringStatus, TERMINAL_STATUSES } from '../src/hooks/useTutoring';
import { useStudents } from '../src/hooks/useStudents';
import { useClasses } from '../src/hooks/useClasses';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { useStaff } from '../src/hooks/useStaff';
import { isTeacherRole, isAssistantRole } from '../src/utils/roleUtils';

// ============================================
// REASON MODAL (for Nghỉ tính phí)
// ============================================
const ReasonModal: React.FC<{
  onSubmit: (reason: string) => void;
  onClose: () => void;
}> = ({ onSubmit, onClose }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onSubmit(reason.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4 bg-red-50">
          <h3 className="text-lg font-bold text-red-800">Nghỉ tính phí</h3>
          <p className="text-sm text-red-600 mt-1">
            Học sinh sẽ vẫn bị tính phí buổi học này
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lý do <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="VD: HS không đến dù đã hẹn 3 lần..."
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// CONFIRM MODAL
// ============================================
const ConfirmModal: React.FC<{
  title: string;
  message: string;
  confirmText: string;
  confirmColor?: 'emerald' | 'red' | 'blue' | 'amber';
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}> = ({ title, message, confirmText, confirmColor = 'emerald', onConfirm, onClose }) => {
  const [loading, setLoading] = useState(false);
  const colors = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    red: 'bg-red-600 hover:bg-red-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      alert(`Lỗi: ${err?.message || 'Không thể thực hiện thao tác'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6 whitespace-pre-line">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-white rounded-lg ${colors[confirmColor]} disabled:opacity-50 flex items-center gap-2`}
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// TRASH MODAL (for viewing/restoring deleted items)
// ============================================
const TrashModal: React.FC<{
  deletedList: TutoringData[];
  onRestore: (id: string) => Promise<void>;
  onClose: () => void;
}> = ({ deletedList, onRestore, onClose }) => {
  const [restoring, setRestoring] = useState<string | null>(null);

  const handleRestore = async (id: string) => {
    setRestoring(id);
    try {
      await onRestore(id);
    } finally {
      setRestoring(null);
    }
  };

  const formatDeletedDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = 30 - diffDays;
    return remaining > 0 ? `${remaining} ngày còn lại` : 'Sắp xóa vĩnh viễn';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Trash2 size={20} />
              Thùng rác
            </h3>
            <p className="text-sm text-gray-500">{deletedList.length} mục đã xóa (lưu 30 ngày)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {deletedList.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Trash2 size={40} className="mx-auto mb-2 opacity-30" />
              <p>Thùng rác trống</p>
            </div>
          ) : (
            deletedList.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{item.studentName}</p>
                  <p className="text-xs text-gray-500 truncate">{item.className}</p>
                  <p className="text-xs text-red-500">{formatDeletedDate(item.deletedAt)}</p>
                </div>
                <button
                  onClick={() => item.id && handleRestore(item.id)}
                  disabled={restoring === item.id}
                  className="ml-3 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200 disabled:opacity-50 flex items-center gap-1"
                >
                  {restoring === item.id ? (
                    <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <RotateCcw size={12} />
                  )}
                  Khôi phục
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// STATUS STEPPER - Enhanced with terminal states dropdown
// ============================================
const StatusStepper: React.FC<{
  currentStatus: TutoringStatus;
  onStatusChange: (status: TutoringStatus, reason?: string) => void;
  disabled?: boolean;
  canUndo?: boolean;
  chargedReason?: string;  // Show reason for Nghỉ tính phí
}> = ({ currentStatus, onStatusChange, disabled, canUndo, chargedReason }) => {
  const [showOptions, setShowOptions] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);

  const isTerminal = TERMINAL_STATUSES.includes(currentStatus);

  const getStatusStyle = (status: TutoringStatus) => {
    const styles: Record<string, { bg: string; text: string; border: string }> = {
      'Chưa bồi': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
      'Đã hẹn': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
      'Đã bồi': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
      'Nghỉ tính phí': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
      'Nghỉ bảo lưu': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
      'Hủy': { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
    };
    return styles[status] || styles['Chưa bồi'];
  };

  const handleTerminalSelect = (status: TutoringStatus) => {
    setShowOptions(false);
    if (status === 'Nghỉ tính phí') {
      setShowReasonModal(true);
    } else {
      onStatusChange(status);
    }
  };

  // If current status is "Đã hẹn", show options dropdown
  if (currentStatus === 'Đã hẹn') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
            bg-amber-100 text-amber-700 border border-amber-300
            hover:bg-amber-200 transition-all
            ${disabled && 'opacity-50 cursor-not-allowed'}
          `}
        >
          <CalendarCheck size={14} />
          Đã hẹn
          <ChevronDown size={12} className={`transition-transform ${showOptions ? 'rotate-180' : ''}`} />
        </button>

        {showOptions && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[180px]">
            <button
              onClick={() => handleTerminalSelect('Đã bồi')}
              className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 text-emerald-700 flex items-center gap-2"
            >
              <CheckCircle2 size={14} />
              Đã bồi (hoàn thành)
            </button>
            <button
              onClick={() => handleTerminalSelect('Nghỉ tính phí')}
              className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-700 flex items-center gap-2"
            >
              <XCircle size={14} />
              Nghỉ tính phí
            </button>
            <button
              onClick={() => handleTerminalSelect('Nghỉ bảo lưu')}
              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-700 flex items-center gap-2"
            >
              <PauseCircle size={14} />
              Nghỉ bảo lưu
            </button>
          </div>
        )}

        {/* Reason Modal for Nghỉ tính phí */}
        {showReasonModal && (
          <ReasonModal
            onSubmit={(reason) => {
              setShowReasonModal(false);
              onStatusChange('Nghỉ tính phí', reason);
            }}
            onClose={() => setShowReasonModal(false)}
          />
        )}
      </div>
    );
  }

  // For terminal states, show status badge with undo option
  if (isTerminal) {
    const style = getStatusStyle(currentStatus);
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${style.bg} ${style.text} border ${style.border}`}>
            {currentStatus}
          </span>
          {/* Show reason for Nghỉ tính phí */}
          {currentStatus === 'Nghỉ tính phí' && chargedReason && (
            <span className="text-[10px] text-red-500 mt-1 italic truncate max-w-[120px]" title={chargedReason}>
              {chargedReason}
            </span>
          )}
        </div>
        {canUndo && (
          <button
            onClick={() => onStatusChange('Đã hẹn')}
            disabled={disabled}
            className="flex items-center gap-1 text-gray-400 hover:text-amber-600 text-xs p-1 hover:bg-amber-50 rounded transition-colors"
            title="Hoàn tác (Admin)"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    );
  }

  // Default: show button for Chưa bồi (to schedule)
  return (
    <button
      onClick={() => onStatusChange('Đã hẹn')}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
        bg-rose-100 text-rose-700 border border-rose-300
        hover:bg-rose-200 transition-all
        ${disabled && 'opacity-50 cursor-not-allowed'}
      `}
    >
      <Circle size={14} />
      Chưa bồi
    </button>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const TutoringManager: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);  // NEW: Trash view
  const [selectedTutoring, setSelectedTutoring] = useState<TutoringData | null>(null);
  const [filterStatus, setFilterStatus] = useState<TutoringStatus | ''>('');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterBranch, setFilterBranch] = useState<string>('');  // Branch/campus filter

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmColor: 'emerald' | 'red' | 'blue' | 'amber';
    onConfirm: () => void;
  } | null>(null);

  // Permissions
  const { shouldShowOnlyOwnClasses, staffId, canCreate, canDelete } = usePermissions();
  const { staffData } = useAuth();
  const onlyOwnClasses = shouldShowOnlyOwnClasses('tutoring');
  const canCreateTutoring = canCreate('tutoring');
  const canDeleteTutoring = canDelete('tutoring');

  // Check if user can undo (Admin or Manager only)
  const isAdminOrManager = staffData?.position === 'Quản trị viên' ||
                           staffData?.position === 'Quản lý' ||
                           staffData?.role === 'admin' ||
                           staffData?.role === 'manager';
  const canUndo = isAdminOrManager;

  const {
    tutoringList: allTutoringList,
    loading,
    error,
    createTutoring,
    scheduleTutoring,
    completeTutoring,
    markChargedAbsence,
    markReservedAbsence,
    undoTutoring,
    softDeleteTutoring,
    restoreTutoring,
    refresh
  } = useTutoring({});

  // Get deleted items for trash view
  const { tutoringList: deletedList, refresh: refreshDeleted } = useTutoring({ onlyDeleted: true });

  const { students } = useStudents();
  const { classes: allClasses } = useClasses();
  const { staff } = useStaff();

  // Get teachers AND assistants from staff (both can tutor)
  const teachers = useMemo(() => {
    return staff.filter(s =>
      isTeacherRole(s.position || '') ||
      isTeacherRole(s.role || '') ||
      isAssistantRole(s.position || '') ||
      isAssistantRole(s.role || '')
    );
  }, [staff]);

  // Filter classes for teachers
  const classes = useMemo(() => {
    if (!onlyOwnClasses || !staffData) return allClasses;
    const myName = staffData.name;
    const myId = staffData.id || staffId;
    return allClasses.filter(cls =>
      cls.teacher === myName ||
      cls.teacherId === myId ||
      cls.assistant === myName ||
      cls.assistantId === myId
    );
  }, [allClasses, onlyOwnClasses, staffData, staffId]);

  // Get unique branches from classes
  const branches = useMemo(() => {
    return [...new Set(allClasses.map(c => c.branch).filter(Boolean))].sort() as string[];
  }, [allClasses]);

  // Filter tutoring list for teachers
  const tutoringList = useMemo(() => {
    if (!onlyOwnClasses || !staffData) return allTutoringList;
    const myClassNames = classes.map(c => c.name);
    return allTutoringList.filter(t => myClassNames.includes(t.className));
  }, [allTutoringList, onlyOwnClasses, staffData, classes]);

  // Filter by status, date, and branch
  const filteredList = useMemo(() => {
    let result = tutoringList;
    if (filterStatus) {
      result = result.filter(t => t.status === filterStatus);
    }
    if (filterDate) {
      result = result.filter(t => t.scheduledDate === filterDate);
    }
    // Filter by branch - look up class branch from className
    if (filterBranch) {
      const branchClasses = allClasses.filter(c => c.branch === filterBranch).map(c => c.name);
      result = result.filter(t => branchClasses.includes(t.className));
    }
    return result;
  }, [tutoringList, filterStatus, filterDate, filterBranch, allClasses]);

  // Count for today
  const todayCount = tutoringList.filter(t => t.scheduledDate === new Date().toISOString().split('T')[0]).length;

  const getStatusBadge = (status: TutoringStatus) => {
    const styles: Record<TutoringStatus, { bg: string; text: string; label: string }> = {
      'Chưa bồi': { bg: 'bg-red-100', text: 'text-red-700', label: 'Chưa bồi' },
      'Đã hẹn': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Đã hẹn' },
      'Đã bồi': { bg: 'bg-green-100', text: 'text-green-700', label: 'Hoàn thành' },
      'Nghỉ tính phí': { bg: 'bg-red-100', text: 'text-red-800', label: 'Nghỉ tính phí' },
      'Nghỉ bảo lưu': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Nghỉ bảo lưu' },
      'Hủy': { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Đã hủy' },
    };
    return styles[status] || styles['Chưa bồi'];
  };

  const handleStatusChange = async (
    session: TutoringData,
    newStatus: TutoringStatus,
    reason?: string
  ) => {
    if (!session.id) return;

    const userId = staffData?.id || 'unknown';

    try {
      switch (newStatus) {
        case 'Đã bồi':
          setConfirmModal({
            show: true,
            title: 'Xác nhận hoàn thành',
            message: 'Xác nhận đã hoàn thành bồi bài?\nHệ thống sẽ tính 1 buổi học cho học sinh.',
            confirmText: 'Xác nhận',
            confirmColor: 'emerald',
            onConfirm: async () => {
              await completeTutoring(session.id!, userId);
            }
          });
          break;

        case 'Nghỉ tính phí':
          if (!reason) {
            alert('Vui lòng nhập lý do nghỉ tính phí');
            return;
          }
          await markChargedAbsence(session.id, userId, reason);
          break;

        case 'Nghỉ bảo lưu':
          setConfirmModal({
            show: true,
            title: 'Xác nhận nghỉ bảo lưu',
            message: 'Xác nhận nghỉ bảo lưu?\nHọc sinh sẽ không bị tính phí và thời gian kết thúc khóa học sẽ được lùi.',
            confirmText: 'Xác nhận',
            confirmColor: 'blue',
            onConfirm: async () => {
              await markReservedAbsence(session.id!, userId);
            }
          });
          break;

        case 'Đã hẹn':
          // Check if this is an undo operation or a schedule operation
          if (TERMINAL_STATUSES.includes(session.status)) {
            // Undo operation
            if (!canUndo) {
              alert('Bạn không có quyền hoàn tác');
              return;
            }
            setConfirmModal({
              show: true,
              title: 'Xác nhận hoàn tác',
              message: 'Xác nhận hoàn tác về trạng thái "Đã hẹn"?',
              confirmText: 'Hoàn tác',
              confirmColor: 'amber',
              onConfirm: async () => {
                await undoTutoring(session.id!, userId);
              }
            });
          } else if (session.status === 'Chưa bồi') {
            // Schedule operation
            setSelectedTutoring(session);
            setShowScheduleModal(true);
          }
          break;

        default:
          break;
      }
    } catch (err: any) {
      alert(`Không thể cập nhật: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Xác nhận xóa',
      message: 'Bạn có chắc muốn xóa?\nDữ liệu sẽ được lưu trong thùng rác 30 ngày.',
      confirmText: 'Xóa',
      confirmColor: 'red',
      onConfirm: async () => {
        const userId = staffData?.id || 'unknown';
        try {
          await softDeleteTutoring(id, userId);
        } catch (err: any) {
          alert(`Không thể xóa: ${err?.message || 'Unknown'}`);
        }
      }
    });
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex justify-between items-start bg-gradient-to-br from-white to-slate-50 p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-200">
            <BookOpen className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Lịch bồi bài</h2>
            <p className="text-sm text-slate-500 mt-0.5">Quản lý các buổi học kèm, bồi dưỡng kiến thức</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Trash Button */}
          {deletedList.length > 0 && (
            <button
              onClick={() => setShowTrashModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-all text-sm font-medium"
            >
              <Trash2 size={16} />
              Thùng rác ({deletedList.length})
            </button>
          )}

          {/* FAB-style Create Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="group relative flex items-center gap-2 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white pl-4 pr-5 py-3 rounded-full hover:shadow-xl hover:shadow-purple-300/50 transition-all duration-300 hover:scale-105 font-semibold text-sm"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 animate-pulse opacity-50" />
            <span className="relative flex items-center justify-center w-6 h-6 bg-white/20 rounded-full">
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
            </span>
            <span className="relative flex items-center gap-1.5">
              <Sparkles size={14} className="animate-pulse" />
              Đặt hẹn lịch bồi
            </span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-100">
        {/* Branch Filter */}
        {branches.length > 0 && (
          <>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
            >
              <option value="">Tất cả cơ sở</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <div className="w-px h-6 bg-gray-200" />
          </>
        )}

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200"
          >
            Hôm nay ({todayCount})
          </button>
          <button
            onClick={() => setFilterDate('')}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
          >
            Tất cả ngày
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* Status Filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === '' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả ({tutoringList.filter(t => !filterDate || t.scheduledDate === filterDate).length})
          </button>
          <button
            onClick={() => setFilterStatus('Chưa bồi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'Chưa bồi' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            Chưa bồi
          </button>
          <button
            onClick={() => setFilterStatus('Đã hẹn')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'Đã hẹn' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
            }`}
          >
            Đã hẹn
          </button>
          <button
            onClick={() => setFilterStatus('Đã bồi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'Đã bồi' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            Hoàn thành
          </button>
          <button
            onClick={() => setFilterStatus('Nghỉ tính phí')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'Nghỉ tính phí' ? 'bg-red-700 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Nghỉ tính phí
          </button>
          <button
            onClick={() => setFilterStatus('Nghỉ bảo lưu')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'Nghỉ bảo lưu' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            Nghỉ bảo lưu
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Đang tải...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">
          Lỗi: {error}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 border border-gray-100">
          <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
          <p>Không có lịch bồi bài nào</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-indigo-600 hover:underline text-sm"
          >
            + Tạo lịch bồi bài mới
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredList.map((session) => {
            return (
              <div
                key={session.id}
                className="group bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 hover:border-violet-200 hover:-translate-y-0.5"
              >
                {/* Header Row - Status Stepper */}
                <div className="flex justify-between items-start mb-3">
                  <StatusStepper
                    currentStatus={session.status}
                    onStatusChange={(newStatus, reason) => handleStatusChange(session, newStatus, reason)}
                    canUndo={canUndo}
                    chargedReason={session.chargedReason}
                  />
                  {canDeleteTutoring && (
                    <button
                      onClick={() => session.id && handleDelete(session.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition-all"
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Student Info */}
                <div className="mb-2">
                  <h3 className="font-bold text-slate-800 text-sm truncate leading-tight">{session.studentName}</h3>
                  <p className="text-violet-600 text-xs truncate font-medium">{session.className}</p>
                </div>

                {/* Details - Horizontal Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {session.scheduledDate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-medium">
                      <Calendar size={10} />
                      {new Date(session.scheduledDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                  {session.scheduledTime && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-medium">
                      <Clock size={10} />
                      {session.scheduledTime}
                    </span>
                  )}
                  {session.tutorName && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-[10px] font-medium">
                      <Users size={10} />
                      {session.tutorName}
                    </span>
                  )}
                </div>

                {/* Note */}
                {session.note && (
                  <div className="mt-2 px-2 py-1.5 bg-amber-50 border-l-2 border-amber-300 rounded-r-lg">
                    <p className="text-[10px] text-amber-700 italic truncate" title={session.note}>
                      {session.note}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal?.show && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          confirmColor={confirmModal.confirmColor}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTutoringModal
          students={students}
          classes={classes}
          teachers={teachers}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            await createTutoring(data);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedTutoring && (
        <ScheduleModal
          tutoring={selectedTutoring}
          teachers={teachers}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedTutoring(null);
          }}
          onSubmit={async (date, time, tutorId, tutorName) => {
            if (selectedTutoring.id) {
              const userId = staffData?.id;
              await scheduleTutoring(selectedTutoring.id, date, time, tutorId, tutorName, userId);
            }
            setShowScheduleModal(false);
            setSelectedTutoring(null);
          }}
        />
      )}

      {/* Trash Modal */}
      {showTrashModal && (
        <TrashModal
          deletedList={deletedList}
          onRestore={async (id) => {
            await restoreTutoring(id);
            await refreshDeleted();
          }}
          onClose={() => setShowTrashModal(false)}
        />
      )}
    </div>
  );
};

// ============================================
// CREATE TUTORING MODAL
// ============================================
interface CreateModalProps {
  students: Array<{ id: string; fullName: string; class?: string }>;
  classes: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; name: string; position?: string }>;
  onClose: () => void;
  onSubmit: (data: Omit<TutoringData, 'id'>) => Promise<void>;
}

const CreateTutoringModal: React.FC<CreateModalProps> = ({ students, classes, teachers, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    studentId: '',
    type: 'Nghỉ học' as 'Nghỉ học' | 'Học yếu',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '15:00',
    tutorId: '',
    tutorName: '',
    note: '',
  });
  const [loading, setLoading] = useState(false);

  // Searchable dropdown states
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target as Node)) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter students by search term
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const term = studentSearch.toLowerCase();
    return students.filter(s =>
      s.fullName?.toLowerCase().includes(term) ||
      s.class?.toLowerCase().includes(term)
    );
  }, [students, studentSearch]);

  const selectedStudent = students.find(s => s.id === formData.studentId);
  const selectedClass = classes.find(c => c.name === selectedStudent?.class);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      setLoading(true);
      await onSubmit({
        studentId: formData.studentId,
        studentName: selectedStudent.fullName,
        classId: selectedClass?.id || '',
        className: selectedStudent.class || '',
        type: formData.type,
        status: formData.tutorName ? 'Đã hẹn' : 'Chưa bồi',
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        tutor: formData.tutorId,
        tutorName: formData.tutorName,
        note: formData.note,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with gradient */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Sparkles className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Đặt hẹn lịch bồi</h3>
              <p className="text-white/70 text-xs">Tạo lịch bồi bài mới cho học sinh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Student Select - Searchable Dropdown */}
          <div className="relative" ref={studentDropdownRef}>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Học sinh <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.studentId ? (selectedStudent?.fullName || '') : studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setFormData({ ...formData, studentId: '' });
                  setShowStudentDropdown(true);
                }}
                onFocus={() => setShowStudentDropdown(true)}
                placeholder="Tìm kiếm học sinh..."
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-slate-800 font-medium transition-all"
              />
              {formData.studentId && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, studentId: '' });
                    setStudentSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {showStudentDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                {filteredStudents.length > 0 ? (
                  filteredStudents.slice(0, 50).map(s => (
                    <div
                      key={s.id}
                      className={`px-4 py-3 cursor-pointer hover:bg-violet-50 border-b border-slate-100 last:border-0 ${formData.studentId === s.id ? 'bg-violet-100' : ''}`}
                      onClick={() => {
                        setFormData({ ...formData, studentId: s.id });
                        setStudentSearch('');
                        setShowStudentDropdown(false);
                      }}
                    >
                      <div className="font-medium text-slate-800">{s.fullName}</div>
                      <div className="text-xs text-slate-500">{s.class || 'Chưa có lớp'}</div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-400">Không tìm thấy học sinh</div>
                )}
                {filteredStudents.length > 50 && (
                  <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50 text-center">
                    Còn {filteredStudents.length - 50} học sinh khác. Hãy nhập thêm để lọc...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                <Calendar size={12} />
                Ngày bồi
              </label>
              <input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                className="w-full px-0 py-1 bg-transparent border-0 text-slate-800 font-semibold focus:ring-0"
              />
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
              <label className="flex items-center gap-2 text-xs font-semibold text-blue-500 mb-2">
                <Clock size={12} />
                Giờ bồi
              </label>
              <input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="w-full px-0 py-1 bg-transparent border-0 text-slate-800 font-semibold focus:ring-0"
              />
            </div>
          </div>

          {/* Tutor Select */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              <Users size={12} />
              Giáo viên bồi
            </label>
            <select
              value={formData.tutorId}
              onChange={(e) => {
                const teacher = teachers.find(t => t.id === e.target.value);
                setFormData({
                  ...formData,
                  tutorId: e.target.value,
                  tutorName: teacher?.name || ''
                });
              }}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-slate-800 font-medium transition-all"
            >
              <option value="">-- Chọn giáo viên --</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.position && `(${t.position})`}
                </option>
              ))}
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              <BookOpen size={12} />
              Nội dung bồi
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-slate-800 resize-none transition-all"
              placeholder="VD: Ôn tập Unit 3, luyện nghe..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !formData.studentId}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-300/50 disabled:opacity-50 font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Đặt hẹn
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// SCHEDULE MODAL
// ============================================
interface ScheduleModalProps {
  tutoring: TutoringData;
  teachers: Array<{ id: string; name: string; position?: string }>;
  onClose: () => void;
  onSubmit: (date: string, time: string, tutorId: string, tutorName: string) => Promise<void>;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ tutoring, teachers, onClose, onSubmit }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('15:00');
  const [tutorId, setTutorId] = useState('');
  const [tutorName, setTutorName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await onSubmit(date, time, tutorId, tutorName);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-lg font-bold text-gray-800">Đặt lịch bồi bài</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Học sinh</p>
            <p className="font-bold text-gray-900">{tutoring.studentName}</p>
            <p className="text-sm text-indigo-600">{tutoring.className}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày bồi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giờ bồi <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Giáo viên bồi <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={tutorId}
              onChange={(e) => {
                const teacher = teachers.find(t => t.id === e.target.value);
                setTutorId(e.target.value);
                setTutorName(teacher?.name || '');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Chọn giáo viên --</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.position && `(${t.position})`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !tutorName}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'Đặt lịch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
