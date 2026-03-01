import React, { useEffect, useCallback } from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
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
  // Memoize escape handler to avoid re-registering on every render
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

  const Icon = variant === 'danger' ? Trash2 : AlertTriangle;
  const iconColorClass = variant === 'danger' ? 'text-red-500' : 'text-amber-500';
  const iconBgClass = variant === 'danger' ? 'bg-red-100' : 'bg-amber-100';
  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-amber-500 hover:bg-amber-600 text-white';

  const visibleItems = previewData.slice(0, MAX_VISIBLE_ROWS);
  const hiddenCount = previewData.length - visibleItems.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl shadow-xl w-full flex flex-col"
        style={{ maxWidth: 500 }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          <div className={`p-2 rounded-full ${iconBgClass}`}>
            <Icon size={20} className={iconColorClass} />
          </div>
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <p className="text-sm text-gray-600">{description}</p>

          {/* Optional red warning box */}
          {warning && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {warning}
            </div>
          )}

          {/* Preview table */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-gray-500">Đang tải dữ liệu...</span>
            </div>
          ) : (
            <>
              {previewData.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2">Lớp</th>
                        <th className="px-4 py-2 text-right">Số buổi bị ảnh hưởng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {visibleItems.map((item) => (
                        <tr key={item.classId} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-700">{item.className}</td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900">
                            {item.sessionCount}
                          </td>
                        </tr>
                      ))}
                      {hiddenCount > 0 && (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-4 py-2 text-center text-xs text-gray-400 italic"
                          >
                            và {hiddenCount} lớp khác...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-4">
                  Không có buổi học nào bị ảnh hưởng.
                </p>
              )}

              {/* Summary */}
              {previewData.length > 0 && (
                <p className="text-sm font-medium text-gray-700">
                  Tổng: <span className="text-indigo-700">{totalClasses} lớp</span>,{' '}
                  <span className="text-indigo-700">{totalSessions} buổi</span> sẽ bị ảnh hưởng
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || processing}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmBtnClass}`}
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
