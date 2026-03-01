import React, { useEffect, useCallback } from 'react';
import { AlertTriangle, Trash2, Loader2, Calendar } from 'lucide-react';
import { SessionPreviewItem } from '../src/services/holidayService';

interface HolidayConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  warning?: string;
  previewData: SessionPreviewItem[];
  totalSessions: number;
  totalClasses: number;
  loading: boolean;
  processing: boolean;
  confirmLabel: string;
  variant: 'warning' | 'danger';
}

const MAX_VISIBLE_ROWS = 20;

export const HolidayConfirmDialog: React.FC<HolidayConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  warning,
  previewData,
  totalSessions,
  totalClasses,
  loading,
  processing,
  confirmLabel,
  variant,
}) => {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const accentColor = isDanger ? 'red' : 'amber';
  const confirmBtnClass = isDanger
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-white';

  const visibleItems = previewData.slice(0, MAX_VISIBLE_ROWS);
  const hiddenCount = previewData.length - visibleItems.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-gray-50 rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 480 }}
        role="dialog"
        aria-modal="true"
      >
        {/* Accent strip + Header */}
        <div className={isDanger ? 'bg-red-500 h-1' : 'bg-amber-500 h-1'} />
        <div className="bg-white px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl flex-shrink-0 ${isDanger ? 'bg-red-50' : 'bg-amber-50'}`}>
              {isDanger
                ? <Trash2 size={22} className="text-red-500" />
                : <AlertTriangle size={22} className="text-amber-500" />
              }
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-3 overflow-y-auto" style={{ maxHeight: '50vh' }}>
          {/* Warning box */}
          {warning && (
            <div className="bg-red-50 border-l-4 border-red-400 px-4 py-3 rounded-r-lg">
              <p className="text-sm text-red-700 font-medium">{warning}</p>
            </div>
          )}

          {/* Preview section */}
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-indigo-400" />
              <span className="ml-2 text-sm text-gray-400">Đang tải dữ liệu...</span>
            </div>
          ) : previewData.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Summary bar */}
              <div className="bg-indigo-50 px-4 py-2.5 flex items-center justify-between border-b border-indigo-100">
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={14} />
                  Buổi học bị ảnh hưởng
                </span>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                  {totalClasses} lớp · {totalSessions} buổi
                </span>
              </div>

              {/* Table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Tên lớp</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">Số buổi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibleItems.map((item) => (
                    <tr key={item.classId}>
                      <td className="px-4 py-2 text-gray-700">{item.className}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`inline-block min-w-[28px] text-center font-semibold text-xs px-2 py-0.5 rounded-full ${
                          isDanger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {item.sessionCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {hiddenCount > 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-center text-xs text-gray-400">
                        và {hiddenCount} lớp khác...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 text-center py-6 space-y-1">
              <Calendar size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Không có buổi học nào bị ảnh hưởng</p>
              <p className="text-xs text-gray-300">
                Các buổi học trong khoảng này có thể đã hoàn thành hoặc không tồn tại.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || processing}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmBtnClass}`}
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Đang xử lý...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
