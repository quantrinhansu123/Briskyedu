/**
 * EditStudentModal Component
 * Modal for editing student information
 * Extracted from pages/StudentManager.tsx for modularity
 */

import React, { useState } from 'react';
import { Student, StudentStatus, Center } from '@/types';

export interface EditStudentModalProps {
  student: Student;
  centers: Center[];
  onClose: () => void;
  onSubmit: (data: Partial<Student>) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({ student, centers, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    fullName: student.fullName || '',
    dob: student.dob ? new Date(student.dob).toISOString().split('T')[0] : '',
    gender: student.gender || 'Nam',
    phone: student.phone || '',
    parentName: student.parentName || '',
    parentPhone: student.parentPhone || '',
    status: student.status || StudentStatus.ACTIVE,
    branch: student.branch || '',
    // Note: 'class' field is intentionally excluded - use "Chuyển lớp" feature instead
    registeredSessions: student.registeredSessions || 0,
    remainingSessions: (student.registeredSessions || 0) - (student.attendedSessions || 0),
    attendedSessions: student.attendedSessions || 0,
    startDate: student.startDate ? new Date(student.startDate).toISOString().split('T')[0] : '',
    // Nghỉ học
    dropoutReason: student.dropoutReason || '',
    dropoutDate: student.dropoutDate ? new Date(student.dropoutDate).toISOString().split('T')[0] : '',
  });

  // Auto-recalculate remainingSessions when registeredSessions or attendedSessions changes
  const handleRegisteredChange = (value: number) => {
    const remaining = value - formData.attendedSessions;
    setFormData({ ...formData, registeredSessions: value, remainingSessions: remaining });
  };

  const handleAttendedChange = (value: number) => {
    const remaining = formData.registeredSessions - value;
    setFormData({ ...formData, attendedSessions: value, remainingSessions: remaining });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-set status = 'Nợ phí' nếu số buổi còn lại < 0
    const finalStatus = formData.remainingSessions < 0 ? StudentStatus.DEBT : formData.status;
    onSubmit({ ...formData, status: finalStatus });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">Chỉnh sửa học viên</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày sinh <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giới tính <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'Nam' | 'Nữ' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SĐT học viên
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trạng thái
              </label>
              <select
                value={formData.status}
                onChange={(e) => {
                  const newStatus = e.target.value as StudentStatus;
                  setFormData({
                    ...formData,
                    status: newStatus,
                    // Tự động set ngày nghỉ khi chuyển sang DROPPED
                    dropoutDate: newStatus === StudentStatus.DROPPED && !formData.dropoutDate
                      ? new Date().toISOString().split('T')[0]
                      : formData.dropoutDate,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {Object.values(StudentStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Hiển thị lý do nghỉ học khi status = DROPPED */}
            {formData.status === StudentStatus.DROPPED && (
              <>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lý do nghỉ học
                  </label>
                  <textarea
                    value={formData.dropoutReason}
                    onChange={(e) => setFormData({ ...formData, dropoutReason: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nhập lý do nghỉ học..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày nghỉ học
                  </label>
                  <input
                    type="date"
                    value={formData.dropoutDate}
                    onChange={(e) => setFormData({ ...formData, dropoutDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cơ sở
              </label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">-- Chọn cơ sở --</option>
                {centers.map(center => (
                  <option key={center.id} value={center.name}>{center.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày bắt đầu học
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Ngày kết thúc sẽ tự động tính theo số buổi</p>
            </div>

            <div className="col-span-2">
              <h4 className="font-semibold text-gray-800 mb-2 mt-2">Thông tin phụ huynh</h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên phụ huynh <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SĐT phụ huynh <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lớp học hiện tại
              </label>
              <input
                type="text"
                value={student.class || '(Chưa có lớp)'}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sử dụng chức năng "Chuyển lớp" để thay đổi lớp học
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số buổi đăng ký (Gói học)
              </label>
              <input
                type="number"
                min={0}
                value={formData.registeredSessions}
                onChange={(e) => handleRegisteredChange(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số buổi đã học
              </label>
              <input
                type="number"
                min={0}
                value={formData.attendedSessions}
                onChange={(e) => handleAttendedChange(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Nhập thủ công nếu cần điều chỉnh</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số buổi còn lại <span className="text-gray-400 font-normal">(âm = nợ phí)</span>
              </label>
              <input
                type="number"
                value={formData.remainingSessions}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow empty, minus sign, or any number (including negative)
                  if (val === '' || val === '-') {
                    setFormData({ ...formData, remainingSessions: 0 });
                  } else {
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) {
                      setFormData({ ...formData, remainingSessions: num });
                    }
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  formData.remainingSessions < 0 ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="VD: 10 hoặc -2"
              />
              {formData.remainingSessions < 0 && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  Nợ {Math.abs(formData.remainingSessions)} buổi - Tự động chuyển sang "Nợ phí"
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStudentModal;
