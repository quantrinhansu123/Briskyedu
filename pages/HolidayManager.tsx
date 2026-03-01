import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Plus, ToggleLeft, ToggleRight, Trash2, Loader2 } from 'lucide-react';
import { useHolidays } from '../src/hooks/useHolidays';
import { useClasses } from '../src/hooks/useClasses';
import { usePermissions } from '../src/hooks/usePermissions';
import { Holiday } from '../types';
import { applyHoliday, unapplyHoliday, getAffectedSessionsPreview, SessionPreviewResult } from '../src/services/holidayService';
import { HolidayConfirmDialog } from '../components/holiday-confirm-dialog';
import { HolidayFormModal } from '../components/holiday-form-modal';

export const HolidayManager: React.FC = () => {
  const { holidays, loading, createHoliday, updateHoliday, deleteHoliday } = useHolidays();
  const { classes } = useClasses();
  const { canEdit, canDelete, canCreate } = usePermissions();

  const canToggleHoliday = canEdit('holidays');
  const canDeleteHoliday = canDelete('holidays');
  const canCreateHoliday = canCreate('holidays');

  const [showModal, setShowModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    holidayId: string;
    action: 'apply' | 'unapply' | 'delete';
    holiday: Holiday | null;
  } | null>(null);
  const [previewResult, setPreviewResult] = useState<SessionPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cooldownMap, setCooldownMap] = useState<Record<string, number>>({});
  const cooldownIntervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(cooldownIntervalsRef.current).forEach(clearInterval);
    };
  }, []);

  // Get unique branches from classes
  const branches = [...new Set(classes.map(c => c.branch).filter(Boolean))] as string[];

  // Start cooldown for a holiday after toggle
  const startCooldown = (holidayId: string) => {
    const COOLDOWN_SECONDS = 5;
    setCooldownMap(prev => ({ ...prev, [holidayId]: COOLDOWN_SECONDS }));
    // Clear any existing interval for this holiday
    if (cooldownIntervalsRef.current[holidayId]) {
      clearInterval(cooldownIntervalsRef.current[holidayId]);
    }
    const interval = setInterval(() => {
      setCooldownMap(prev => {
        const next = { ...prev, [holidayId]: (prev[holidayId] || 0) - 1 };
        if (next[holidayId] <= 0) {
          delete next[holidayId];
          clearInterval(interval);
          delete cooldownIntervalsRef.current[holidayId];
        }
        return next;
      });
    }, 1000);
    cooldownIntervalsRef.current[holidayId] = interval;
  };

  // Handle toggle button click - open confirm dialog with preview
  const handleToggleClick = async (holiday: Holiday) => {
    if (!canToggleHoliday) return;
    const action = holiday.status === 'Đã áp dụng' ? 'unapply' : 'apply';

    setConfirmDialog({ isOpen: true, holidayId: holiday.id, action, holiday });
    setPreviewResult(null);
    setPreviewLoading(true);

    try {
      const result = await getAffectedSessionsPreview(holiday, classes, action);
      setPreviewResult(result);
    } catch (err) {
      console.error('Error fetching session preview:', err);
      setPreviewResult({ items: [], totalSessions: 0, totalClasses: 0 });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle delete button click - open confirm dialog
  const handleDeleteClick = async (holiday: Holiday) => {
    if (!canDeleteHoliday) return;

    setConfirmDialog({ isOpen: true, holidayId: holiday.id, action: 'delete', holiday });
    setPreviewResult(null);

    if (holiday.status === 'Đã áp dụng') {
      setPreviewLoading(true);
      try {
        const result = await getAffectedSessionsPreview(holiday, classes, 'unapply');
        setPreviewResult(result);
      } catch (err) {
        console.error('Error fetching delete preview:', err);
        setPreviewResult({ items: [], totalSessions: 0, totalClasses: 0 });
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewResult({ items: [], totalSessions: 0, totalClasses: 0 });
    }
  };

  // Execute confirm action
  const handleConfirm = async () => {
    if (!confirmDialog?.holiday) return;
    const { holidayId, action, holiday } = confirmDialog;

    if (action === 'delete') {
      setConfirmDialog(prev => prev ? { ...prev, isOpen: false } : null);
      try {
        // Cleanup client-side attendance records if holiday was applied
        if (holiday.status === 'Đã áp dụng') {
          await unapplyHoliday(holidayId);
        }
        await deleteHoliday(holidayId);
      } catch (err) {
        console.error('Error deleting holiday:', err);
      }
      return;
    }

    // apply / unapply
    setTogglingId(holidayId);
    setConfirmDialog(prev => prev ? { ...prev, isOpen: false } : null);
    try {
      const newStatus = action === 'apply' ? 'Đã áp dụng' : 'Chưa áp dụng';

      if (action === 'apply') {
        const result = await applyHoliday(holiday, classes);
        console.log(`Holiday applied: Created ${result.created} records, skipped ${result.skipped}`);
      } else {
        const deleted = await unapplyHoliday(holidayId);
        console.log(`Holiday unapplied: Deleted ${deleted} records`);
      }

      await updateHoliday(holidayId, { status: newStatus });
      startCooldown(holidayId);
    } catch (err) {
      console.error('Error updating holiday:', err);
      alert('Có lỗi xảy ra khi cập nhật trạng thái');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCancelDialog = useCallback(() => {
    setConfirmDialog(null);
    setPreviewResult(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Build dialog props based on action
  const buildDialogProps = () => {
    if (!confirmDialog) return null;
    const { action, holiday } = confirmDialog;
    const items = previewResult?.items || [];
    const totalSessions = previewResult?.totalSessions || 0;
    const totalClasses = previewResult?.totalClasses || 0;

    if (action === 'apply') {
      return {
        title: 'Xác nhận áp dụng lịch nghỉ',
        description: `Áp dụng lịch nghỉ "${holiday?.name}" sẽ đánh dấu các buổi học bên dưới là "Nghỉ".`,
        warning: undefined,
        confirmLabel: 'Áp dụng',
        variant: 'warning' as const,
      };
    }
    if (action === 'unapply') {
      return {
        title: 'Xác nhận hủy áp dụng lịch nghỉ',
        description: `Hủy áp dụng lịch nghỉ "${holiday?.name}" sẽ khôi phục các buổi học bên dưới về trạng thái "Chưa học".`,
        warning: undefined,
        confirmLabel: 'Hủy áp dụng',
        variant: 'warning' as const,
      };
    }
    // delete
    return {
      title: 'Xác nhận xóa lịch nghỉ',
      description: `Bạn có chắc muốn xóa lịch nghỉ "${holiday?.name}"?`,
      warning: holiday?.status === 'Đã áp dụng'
        ? 'Lịch nghỉ này đang được áp dụng. Xóa sẽ KHÔNG tự động khôi phục các buổi học đã bị ảnh hưởng.'
        : undefined,
      confirmLabel: 'Xóa',
      variant: 'danger' as const,
    };
  };

  const dialogProps = buildDialogProps();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-indigo-600" />
            Lịch nghỉ
          </h2>
          {canCreateHoliday && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <Plus size={18} />
              Thêm lịch nghỉ
            </button>
          )}
        </div>
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
            <tr>
              <th className="px-6 py-4">Tên kỳ nghỉ</th>
              <th className="px-6 py-4">Thời gian</th>
              <th className="px-6 py-4">Áp dụng cho</th>
              <th className="px-6 py-4">Trạng thái</th>
              {canDeleteHoliday && <th className="px-6 py-4 text-right">Hành động</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {holidays.length > 0 ? (
              holidays.map((holiday) => {
                const isToggling = togglingId === holiday.id;
                const cooldown = cooldownMap[holiday.id] || 0;
                const toggleDisabled = isToggling || cooldown > 0 || !canToggleHoliday;

                return (
                  <tr key={holiday.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{holiday.name}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm">{holiday.startDate}</div>
                      <div className="text-xs text-gray-400">đến {holiday.endDate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {holiday.applyType === 'all_classes' && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            Tất cả lớp
                          </span>
                        )}
                        {holiday.applyType === 'all_branches' && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            Tất cả chi nhánh
                          </span>
                        )}
                        {holiday.applyType === 'specific_branch' && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            CN: {holiday.branch}
                          </span>
                        )}
                        {holiday.applyType === 'specific_classes' && (
                          <div className="flex flex-wrap gap-1">
                            {(holiday.classNames || []).slice(0, 2).map((name, idx) => (
                              <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                {name}
                              </span>
                            ))}
                            {(holiday.classNames || []).length > 2 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                                +{(holiday.classNames || []).length - 2}
                              </span>
                            )}
                          </div>
                        )}
                        {!holiday.applyType && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                            Chưa xác định
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {canToggleHoliday ? (
                        <button
                          onClick={() => handleToggleClick(holiday)}
                          disabled={toggleDisabled}
                          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors
                            ${holiday.status === 'Đã áp dụng'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'}
                            ${toggleDisabled ? 'opacity-50 cursor-wait' : ''}
                          `}
                        >
                          {isToggling ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            holiday.status === 'Đã áp dụng' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />
                          )}
                          {isToggling
                            ? 'Đang xử lý...'
                            : cooldown > 0
                              ? `Chờ ${cooldown}s...`
                              : holiday.status}
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold
                            ${holiday.status === 'Đã áp dụng'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'}
                          `}
                        >
                          {holiday.status === 'Đã áp dụng' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {holiday.status}
                        </span>
                      )}
                    </td>
                    {canDeleteHoliday && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteClick(holiday)}
                          className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={canDeleteHoliday ? 5 : 4} className="px-6 py-8 text-center text-gray-400">
                  Chưa có lịch nghỉ nào. {canCreateHoliday ? 'Nhấn "Thêm lịch nghỉ" để tạo mới.' : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <HolidayFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={createHoliday}
        classes={classes}
        branches={branches}
      />

      {/* Confirm Dialog */}
      {confirmDialog && dialogProps && (
        <HolidayConfirmDialog
          isOpen={confirmDialog.isOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancelDialog}
          title={dialogProps.title}
          description={dialogProps.description}
          warning={dialogProps.warning}
          previewData={previewResult?.items || []}
          totalSessions={previewResult?.totalSessions || 0}
          totalClasses={previewResult?.totalClasses || 0}
          loading={previewLoading}
          processing={togglingId === confirmDialog.holidayId}
          confirmLabel={dialogProps.confirmLabel}
          variant={dialogProps.variant}
        />
      )}
    </div>
  );
};
