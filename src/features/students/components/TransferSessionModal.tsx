/**
 * TransferSessionModal Component
 * Modal for transferring sessions to another student
 * Extracted from pages/StudentManager.tsx for modularity
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Student, StudentStatus } from '@/types';

export interface TransferSessionModalProps {
  student: Student;
  allStudents: Student[];
  staffData: any;
  onClose: () => void;
  onSubmit: (data: {
    targetStudentId: string;
    targetStudentName: string;
    targetSessions: number;
    targetClassId?: string;
    targetClassName?: string;
    sessions: number;
    note: string;
  }) => void;
}

export const TransferSessionModal: React.FC<TransferSessionModalProps> = ({ student, allStudents, staffData, onClose, onSubmit }) => {
  const [targetStudentId, setTargetStudentId] = useState('');
  const [sessions, setSessions] = useState(0);
  const [note, setNote] = useState('');

  const currentSessions = student.registeredSessions || 0;
  const targetStudent = allStudents.find(s => s.id === targetStudentId);
  const otherStudents = allStudents.filter(s => s.id !== student.id && s.status !== StudentStatus.DROPPED);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentId) {
      alert('Vui lòng chọn học viên nhận');
      return;
    }
    if (sessions <= 0 || sessions > currentSessions) {
      alert('Số buổi không hợp lệ');
      return;
    }
    onSubmit({
      targetStudentId,
      targetStudentName: targetStudent?.fullName || '',
      targetSessions: targetStudent?.registeredSessions || 0,
      targetClassId: targetStudent?.classId,
      targetClassName: targetStudent?.class,
      sessions,
      note
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Tặng buổi cho học viên khác</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="font-medium text-gray-800">{student.fullName}</p>
          <p className="text-sm text-gray-600">Số buổi hiện có: <span className="font-bold text-blue-600">{currentSessions}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Học viên nhận <span className="text-red-500">*</span></label>
            <select
              required
              value={targetStudentId}
              onChange={(e) => setTargetStudentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Chọn học viên --</option>
              {otherStudents.map(s => (
                <option key={s.id} value={s.id}>{s.fullName} - {s.class || 'Chưa có lớp'}</option>
              ))}
            </select>
          </div>

          {targetStudent && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                <span className="font-medium">{targetStudent.fullName}</span> hiện có: <span className="font-bold">{targetStudent.registeredSessions || 0} buổi</span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số buổi tặng</label>
            <input
              type="number"
              min={1}
              max={currentSessions}
              value={sessions}
              onChange={(e) => setSessions(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-lg text-sm">
            <p className="text-blue-800">
              Sau khi tặng: <span className="font-bold">{student.fullName}</span> còn <span className="font-bold">{currentSessions - sessions} buổi</span>
            </p>
            {targetStudent && (
              <p className="text-blue-800 mt-1">
                <span className="font-bold">{targetStudent.fullName}</span> có <span className="font-bold">{(targetStudent.registeredSessions || 0) + sessions} buổi</span>
              </p>
            )}
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
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Xác nhận tặng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferSessionModal;
