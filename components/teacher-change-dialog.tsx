import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, ArrowRight } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';

export interface TeacherChange {
  role: string;          // 'Giáo viên chính' | 'GVNN' | 'Trợ giảng'
  oldName: string;
  newName: string;
  field: 'teacher' | 'foreignTeacher' | 'assistant';
}

interface TeacherChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (effectiveDate: string) => void;
  changes: TeacherChange[];
  classStartDate?: string; // YYYY-MM-DD
}

export const TeacherChangeDialog: React.FC<TeacherChangeDialogProps> = ({
  open,
  onClose,
  onConfirm,
  changes,
  classStartDate,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [effectiveDate, setEffectiveDate] = useState(today);

  // Reset date khi dialog mở
  useEffect(() => {
    if (open) setEffectiveDate(today);
  }, [open, today]);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, handleEscape]);

  if (!open || changes.length === 0) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 440 }}
        role="dialog"
        aria-modal="true"
      >
        {/* Accent strip */}
        <div className="bg-blue-500 h-1" />

        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl flex-shrink-0 bg-blue-50">
              <UserCheck size={22} className="text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Đổi giáo viên</h3>
              <p className="text-sm text-gray-500 mt-1">
                Chọn ngày GV mới bắt đầu dạy. Các buổi học từ ngày này trở đi sẽ được cập nhật.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-4 space-y-4">
          {/* Changes list */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-100">
            {changes.map((change, i) => (
              <div key={i} className="px-4 py-3">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  {change.role}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 line-through">{change.oldName || 'Chưa có'}</span>
                  <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
                  <span className="font-semibold text-blue-600">{change.newName || 'Không có'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Date picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ngày bắt đầu dạy
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              min={classStartDate || undefined}
              max={today}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Các buổi học trước ngày này sẽ giữ nguyên GV cũ
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pt-2 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={() => onConfirm(effectiveDate)}
            disabled={!effectiveDate}
            className="px-5 py-2 text-sm font-medium rounded-lg transition-colors
                       bg-blue-600 hover:bg-blue-700 text-white
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
