import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Holiday, HolidayApplyType, ClassModel } from '../types';
import { isValidDateRange, getDateRangeErrorMessage } from '../src/utils/validators';

interface FormData {
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  applyType: HolidayApplyType;
  classIds: string[];
  branch: string;
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  startDate: '',
  endDate: '',
  status: 'Chưa áp dụng',
  applyType: 'all_classes',
  classIds: [],
  branch: '',
};

interface HolidayFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Holiday, 'id'> & { date: string }) => Promise<void>;
  classes: ClassModel[];
  branches: string[];
}

export const HolidayFormModal: React.FC<HolidayFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  classes,
  branches,
}) => {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);

  const handleCreate = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    if (!isValidDateRange(formData.startDate, formData.endDate)) {
      const error = getDateRangeErrorMessage(formData.startDate, formData.endDate);
      alert(error || 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
      return;
    }

    if (formData.applyType === 'specific_classes' && (!formData.classIds || formData.classIds.length === 0)) {
      alert('Vui lòng chọn ít nhất 1 lớp!');
      return;
    }
    if (formData.applyType === 'specific_branch' && !formData.branch) {
      alert('Vui lòng chọn chi nhánh!');
      return;
    }

    try {
      const selectedClassNames = formData.classIds.map(id => {
        const cls = classes.find(c => c.id === id);
        return cls?.name || '';
      }).filter(Boolean);

      const holidayData: Omit<Holiday, 'id'> & { date: string } = {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        applyType: formData.applyType,
        date: formData.startDate,
        createdAt: new Date().toISOString(),
      };

      if (formData.applyType === 'specific_classes' && formData.classIds.length > 0) {
        holidayData.classIds = formData.classIds;
        holidayData.classNames = selectedClassNames;
      }
      if (formData.applyType === 'specific_branch' && formData.branch) {
        holidayData.branch = formData.branch;
      }

      await onSubmit(holidayData);
      setFormData(INITIAL_FORM_DATA);
      onClose();
      alert('Đã thêm lịch nghỉ mới!');
    } catch (err: any) {
      console.error('Error creating holiday:', err);
      alert('Có lỗi xảy ra: ' + (err.message || err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900">Thêm lịch nghỉ mới</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên kỳ nghỉ *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="VD: Nghỉ lễ Quốc Khánh"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Apply Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Áp dụng cho *</label>
            <select
              value={formData.applyType}
              onChange={(e) => setFormData({
                ...formData,
                applyType: e.target.value as HolidayApplyType,
                classIds: [],
                branch: ''
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all_classes">Tất cả các lớp</option>
              <option value="all_branches">Tất cả chi nhánh</option>
              <option value="specific_branch">Một chi nhánh cụ thể</option>
              <option value="specific_classes">Một số lớp cụ thể</option>
            </select>
          </div>

          {/* Branch Selection */}
          {formData.applyType === 'specific_branch' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chọn chi nhánh *</label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">-- Chọn chi nhánh --</option>
                {branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
          )}

          {/* Class Selection */}
          {formData.applyType === 'specific_classes' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chọn lớp * ({formData.classIds.length} đã chọn)
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                {classes.filter(c => c.status === 'Đang học' || c.status === 'Chờ mở').map(cls => (
                  <label
                    key={cls.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                      formData.classIds.includes(cls.id) ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.classIds.includes(cls.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, classIds: [...formData.classIds, cls.id] });
                        } else {
                          setFormData({ ...formData, classIds: formData.classIds.filter(id => id !== cls.id) });
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm">{cls.name}</span>
                    {cls.branch && <span className="text-xs text-gray-400">({cls.branch})</span>}
                  </label>
                ))}
              </div>
              {formData.classIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, classIds: [] })}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  Bỏ chọn tất cả
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="Chưa áp dụng">Chưa áp dụng</option>
              <option value="Đã áp dụng">Đã áp dụng</option>
            </select>
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Thêm lịch nghỉ
          </button>
        </div>
      </div>
    </div>
  );
};
