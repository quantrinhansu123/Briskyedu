/**
 * EnrollmentModal Component
 * Modal for adding/subtracting enrollment sessions
 * Extracted from pages/StudentManager.tsx for modularity
 */

import React, { useState } from 'react';
import { X, PlusCircle, MinusCircle } from 'lucide-react';
import { Student } from '@/types';

export interface EnrollmentModalProps {
  student: Student;
  staffData: any;
  onClose: () => void;
  onSubmit: (data: { newSessions: number; change: number; note: string }) => void;
}

export const EnrollmentModal: React.FC<EnrollmentModalProps> = ({ student, staffData, onClose, onSubmit }) => {
  const [mode, setMode] = useState<'add' | 'subtract'>('add');
  const [sessions, setSessions] = useState(0);
  const [note, setNote] = useState('');

  const currentSessions = student.registeredSessions || 0;
  const newSessions = mode === 'add' ? currentSessions + sessions : currentSessions - sessions;
  const change = mode === 'add' ? sessions : -sessions;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessions <= 0) {
      alert('Vui lòng nhập số buổi hợp lệ');
      return;
    }
    if (!note.trim()) {
      alert('Vui lòng nhập ghi chú/lý do');
      return;
    }
    onSubmit({ newSessions, change, note });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Thêm/Bớt buổi ghi danh</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="font-medium text-gray-800">{student.fullName}</p>
          <p className="text-sm text-gray-600">Lớp: {student.class || '---'}</p>
          <p className="text-sm text-gray-600">Số buổi hiện tại: <span className="font-bold text-blue-600">{currentSessions}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                mode === 'add' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <PlusCircle size={16} className="inline mr-1" /> Thêm buổi
            </button>
            <button
              type="button"
              onClick={() => setMode('subtract')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                mode === 'subtract' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <MinusCircle size={16} className="inline mr-1" /> Bớt buổi
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số buổi</label>
            <input
              type="number"
              min={1}
              max={mode === 'subtract' ? currentSessions : 999}
              value={sessions}
              onChange={(e) => setSessions(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Sau khi {mode === 'add' ? 'thêm' : 'bớt'}: <span className="font-bold">{newSessions} buổi</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú/Lý do <span className="text-red-500">*</span></label>
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Nhập lý do..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnrollmentModal;
