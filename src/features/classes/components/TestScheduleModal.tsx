/**
 * TestScheduleModal Component
 * Modal for scheduling tests for a class
 * Extracted from pages/ClassManager.tsx for modularity
 */

import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { ClassModel } from '@/types';

export interface TestScheduleModalProps {
  classData: ClassModel;
  onClose: () => void;
  onSubmit: (testDate: string, testType: string, notes: string) => void;
}

export const TestScheduleModal: React.FC<TestScheduleModalProps> = ({ classData, onClose, onSubmit }) => {
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [testTime, setTestTime] = useState('09:00');
  const [testType, setTestType] = useState('Giữa kỳ');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(`${testDate} ${testTime}`, testType, notes);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-200">
              <Calendar className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Thêm lịch test</h3>
              <p className="text-sm text-gray-500">{classData.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại bài test</label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="Đầu vào">Test đầu vào</option>
              <option value="Giữa kỳ">Test giữa kỳ</option>
              <option value="Cuối kỳ">Test cuối kỳ</option>
              <option value="Đầu ra">Test đầu ra</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày test</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giờ test</label>
              <input
                type="time"
                value={testTime}
                onChange={(e) => setTestTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ghi chú thêm về bài test..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Thêm lịch test
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TestScheduleModal;
