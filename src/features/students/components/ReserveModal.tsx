/**
 * ReserveModal Component
 * Modal for reserving student enrollment
 * Extracted from pages/StudentManager.tsx for modularity
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Student } from '@/types';

export interface ReserveModalProps {
  student: Student;
  staffData: any;
  onClose: () => void;
  onSubmit: (data: { reserveDate: string; note: string }) => void;
}

export const ReserveModal: React.FC<ReserveModalProps> = ({ student, staffData, onClose, onSubmit }) => {
  const [reserveDate, setReserveDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const remainingSessions = (student.registeredSessions || 0) - (student.attendedSessions || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ reserveDate, note });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Bảo lưu học viên</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <p className="font-medium text-orange-800">{student.fullName}</p>
          <p className="text-sm text-orange-700">Lớp: {student.class || '---'}</p>
          <p className="text-sm text-orange-700">Số buổi còn lại: <span className="font-bold">{remainingSessions}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bảo lưu</label>
            <input
              type="date"
              value={reserveDate}
              onChange={(e) => setReserveDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Chi tiết bảo lưu:</strong>
            </p>
            <ul className="text-sm text-gray-600 mt-1 space-y-1">
              <li>- Số buổi đã đăng ký: {student.registeredSessions || 0}</li>
              <li>- Số buổi đã học: {student.attendedSessions || 0}</li>
              <li>- Số buổi bảo lưu: <span className="font-bold text-orange-600">{remainingSessions}</span></li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Lý do bảo lưu..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
              Xác nhận bảo lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReserveModal;
