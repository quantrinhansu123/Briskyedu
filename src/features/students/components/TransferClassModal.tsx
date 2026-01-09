/**
 * TransferClassModal Component
 * Modal for transferring student to a different class
 * Extracted from pages/StudentManager.tsx for modularity
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Student, ClassModel } from '@/types';

export interface TransferClassModalProps {
  student: Student;
  classes: ClassModel[];
  staffData: any;
  onClose: () => void;
  onSubmit: (data: { newClassId: string; newClassName: string; sessions: number; note: string }) => void;
}

export const TransferClassModal: React.FC<TransferClassModalProps> = ({ student, classes, staffData, onClose, onSubmit }) => {
  const [newClassId, setNewClassId] = useState('');
  // Calculate remaining sessions (registered - attended) for transfer
  const remainingSessions = Math.max(0, (student.registeredSessions || 0) - (student.attendedSessions || 0));
  const [sessions, setSessions] = useState(remainingSessions);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const newClass = classes.find(c => c.id === newClassId);
  const otherClasses = classes.filter(c => c.id !== student.classId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassId) {
      alert('Vui lòng chọn lớp mới');
      return;
    }
    onSubmit({
      newClassId,
      newClassName: newClass?.name || '',
      sessions,
      note: `Ngày chuyển: ${transferDate}. ${note}`
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Chuyển lớp học viên</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="font-medium text-gray-800">{student.fullName} - {student.class || 'Chưa có lớp'}</p>
          <p className="text-sm text-gray-600">Số buổi: {student.registeredSessions || 0} (Đã học: {student.attendedSessions || 0})</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày chuyển</label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lớp chuyển tới <span className="text-red-500">*</span></label>
              <select
                required
                value={newClassId}
                onChange={(e) => setNewClassId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Chọn lớp --</option>
                {otherClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.teacher || 'Chưa có GV'})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số buổi chuyển <span className="text-xs font-normal text-green-600">(còn lại: {remainingSessions})</span>
            </label>
            <input
              type="number"
              min={0}
              max={remainingSessions}
              value={sessions}
              onChange={(e) => setSessions(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Mặc định chuyển {remainingSessions} buổi còn lại (ĐK: {student.registeredSessions || 0} - Đã học: {student.attendedSessions || 0})
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Nhập ghi chú..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy bỏ
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferClassModal;
