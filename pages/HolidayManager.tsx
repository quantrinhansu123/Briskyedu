import React, { useState, useEffect } from 'react';
import { Calendar, Plus, ToggleLeft, ToggleRight, Trash2, X, Building, Users, ChevronDown, Loader2 } from 'lucide-react';
import { useHolidays } from '../src/hooks/useHolidays';
import { useClasses } from '../src/hooks/useClasses';
import { HolidayApplyType } from '../types';
import { applyHoliday, unapplyHoliday } from '../src/services/holidayService';

export const HolidayManager: React.FC = () => {
  const { holidays, loading, createHoliday, updateHoliday, deleteHoliday } = useHolidays();
  const { classes } = useClasses();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    status: 'Chưa áp dụng',
    applyType: 'all_classes' as HolidayApplyType,
    classIds: [] as string[],
    branch: '',
  });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Get unique branches from classes
  const branches = [...new Set(classes.map(c => c.branch).filter(Boolean))] as string[];

  // Toggle status - Apply/Unapply holiday with auto-create records
  const toggleStatus = async (id: string, currentStatus: string) => {
    const holiday = holidays.find(h => h.id === id);
    if (!holiday) return;

    setTogglingId(id);
    try {
      const newStatus = currentStatus === 'Đã áp dụng' ? 'Chưa áp dụng' : 'Đã áp dụng';

      if (newStatus === 'Đã áp dụng') {
        // Apply: Create attendance records for all affected classes/dates
        const result = await applyHoliday(holiday, classes);
        console.log(`Holiday applied: Created ${result.created} records, skipped ${result.skipped}`);
      } else {
        // Unapply: Delete auto-created attendance records
        const deleted = await unapplyHoliday(id);
        console.log(`Holiday unapplied: Deleted ${deleted} records`);
      }

      // Update holiday status
      await updateHoliday(id, { status: newStatus });
    } catch (err) {
      console.error('Error updating holiday:', err);
      alert('Có lỗi xảy ra khi cập nhật trạng thái');
    } finally {
      setTogglingId(null);
    }
  };

  // Create holiday
  const handleCreate = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    // Validate apply type specific requirements
    if (formData.applyType === 'specific_classes' && formData.classIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 lớp!');
      return;
    }
    if (formData.applyType === 'specific_branch' && !formData.branch) {
      alert('Vui lòng chọn chi nhánh!');
      return;
    }

    try {
      // Get class names for display
      const selectedClassNames = formData.classIds.map(id => {
        const cls = classes.find(c => c.id === id);
        return cls?.name || '';
      }).filter(Boolean);

      // Build data object - only include fields that have values
      const holidayData: any = {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        applyType: formData.applyType,
        date: formData.startDate,
        createdAt: new Date().toISOString(),
      };

      // Only add optional fields if they have values
      if (formData.applyType === 'specific_classes' && formData.classIds.length > 0) {
        holidayData.classIds = formData.classIds;
        holidayData.classNames = selectedClassNames;
      }
      if (formData.applyType === 'specific_branch' && formData.branch) {
        holidayData.branch = formData.branch;
      }

      await createHoliday(holidayData);
      setShowModal(false);
      setFormData({ 
        name: '', 
        startDate: '', 
        endDate: '', 
        status: 'Chưa áp dụng',
        applyType: 'all_classes',
        classIds: [],
        branch: '',
      });
      alert('Đã thêm lịch nghỉ mới!');
    } catch (err: any) {
      console.error('Error creating holiday:', err);
      alert('Có lỗi xảy ra: ' + (err.message || err));
    }
  };

  // Delete holiday
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa "${name}"?`)) return;
    
    try {
      await deleteHoliday(id);
    } catch (err) {
      console.error('Error deleting holiday:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="text-indigo-600" />
          Lịch nghỉ
        </h2>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Thêm lịch nghỉ
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
            <tr>
              <th className="px-6 py-4">Tên kỳ nghỉ</th>
              <th className="px-6 py-4">Thời gian</th>
              <th className="px-6 py-4">Áp dụng cho</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {holidays.length > 0 ? (
              holidays.map((holiday) => (
                <tr key={holiday.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{holiday.name}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{holiday.startDate}</div>
                    <div className="text-xs text-gray-400">đến {holiday.endDate}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {holiday.applyType === 'all_classes' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          Tất cả lớp
                        </span>
                      )}
                      {holiday.applyType === 'all_branches' && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          Tất cả chi nhánh
                        </span>
                      )}
                      {holiday.applyType === 'specific_branch' && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                          CN: {holiday.branch}
                        </span>
                      )}
                      {holiday.applyType === 'specific_classes' && (
                        <div className="flex flex-wrap gap-1">
                          {(holiday.classNames || []).slice(0, 2).map((name, idx) => (
                            <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                              {name}
                            </span>
                          ))}
                          {(holiday.classNames || []).length > 2 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                              +{(holiday.classNames || []).length - 2}
                            </span>
                          )}
                        </div>
                      )}
                      {!holiday.applyType && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                          Chưa xác định
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(holiday.id, holiday.status)}
                      disabled={togglingId === holiday.id}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors
                        ${holiday.status === 'Đã áp dụng'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'}
                        ${togglingId === holiday.id ? 'opacity-50 cursor-wait' : ''}
                      `}
                    >
                      {togglingId === holiday.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        holiday.status === 'Đã áp dụng' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />
                      )}
                      {togglingId === holiday.id ? 'Đang xử lý...' : holiday.status}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(holiday.id, holiday.name)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                  Chưa có lịch nghỉ nào. Nhấn "Thêm lịch nghỉ" để tạo mới.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Thêm lịch nghỉ */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Thêm lịch nghỉ mới</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
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
                onClick={() => setShowModal(false)}
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
      )}
    </div>
  );
};