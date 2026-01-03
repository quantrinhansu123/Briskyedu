/**
 * RemoveClassModal Component
 * Modal for removing student from class
 * Includes validation to prevent "Nghỉ học" if student has debt
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Student, StudentStatus } from '@/types';

export interface RemoveClassModalProps {
  student: Student;
  staffData: any;
  onClose: () => void;
  onSubmit: (data: { newStatus: StudentStatus; note: string }) => void;
}

export const RemoveClassModal: React.FC<RemoveClassModalProps> = ({ student, staffData, onClose, onSubmit }) => {
  const navigate = useNavigate();

  // Check if student has debt (attended more than registered)
  const hasDebt = useMemo(() => {
    return (student.attendedSessions || 0) > (student.registeredSessions || 0);
  }, [student.attendedSessions, student.registeredSessions]);

  const debtSessions = useMemo(() => {
    return Math.max(0, (student.attendedSessions || 0) - (student.registeredSessions || 0));
  }, [student.attendedSessions, student.registeredSessions]);

  // Default to RESERVED if has debt, otherwise DROPPED
  const [newStatus, setNewStatus] = useState<StudentStatus>(
    hasDebt ? StudentStatus.RESERVED : StudentStatus.DROPPED
  );
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Block if trying to set DROPPED while having debt
    if (newStatus === StudentStatus.DROPPED && hasDebt) {
      alert('Không thể chuyển sang Nghỉ học khi học viên còn nợ phí. Vui lòng tất toán trước.');
      return;
    }

    if (!window.confirm(`Xác nhận xóa ${student.fullName} khỏi lớp ${student.class}?`)) {
      return;
    }
    onSubmit({ newStatus, note });
  };

  const handleGoToSettlement = () => {
    onClose();
    navigate('/finance/debt-management');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-red-600">Xóa học viên khỏi lớp</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="font-medium text-red-800">{student.fullName}</p>
          <p className="text-sm text-red-700">Lớp hiện tại: {student.class || '---'}</p>
          <p className="text-sm text-red-700">
            Số buổi còn: {(student.registeredSessions || 0) - (student.attendedSessions || 0)}
            {hasDebt && <span className="text-red-600 font-bold"> (Nợ {debtSessions} buổi)</span>}
          </p>
        </div>

        {/* Debt Warning */}
        {hasDebt && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-yellow-800">
                  <strong>Lưu ý:</strong> Học viên còn nợ <strong>{debtSessions}</strong> buổi học.
                  Vui lòng <strong>tất toán</strong> trước khi chuyển sang Nghỉ học.
                </p>
                <button
                  type="button"
                  onClick={handleGoToSettlement}
                  className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Đến trang Tất toán
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái mới</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as StudentStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value={StudentStatus.DROPPED} disabled={hasDebt}>
                Nghỉ học {hasDebt ? '(Còn nợ phí)' : ''}
              </option>
              <option value={StudentStatus.RESERVED}>Bảo lưu</option>
              <option value={StudentStatus.TRIAL}>Học thử</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {newStatus === StudentStatus.DROPPED ? 'Lý do nghỉ học' : 'Ghi chú'}
              {newStatus === StudentStatus.DROPPED && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              required={newStatus === StudentStatus.DROPPED}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder={newStatus === StudentStatus.DROPPED ? 'Nhập lý do nghỉ học (bắt buộc)...' : 'Lý do xóa khỏi lớp...'}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              Xác nhận xóa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RemoveClassModal;
