/**
 * Parent Manager Page (Refactored)
 * - Children được query từ students collection
 */

import React, { useState } from 'react';
import { Search, Plus, Phone, Edit, Trash2, X, Users } from 'lucide-react';
import { useParents } from '../src/hooks/useParents';
import { ParentWithChildren } from '../src/services/parentService';
import { Parent, StudentStatus } from '../types';
import { ModalPortal } from '@/components/modal-portal';

export const ParentManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParent, setEditingParent] = useState<ParentWithChildren | null>(null);
  
  const { parents, loading, error, createParent, updateParent, deleteParent } = useParents(searchTerm);

  const handleCreate = async (data: Omit<Parent, 'id'>) => {
    try {
      await createParent(data);
      setShowCreateModal(false);
    } catch (err) {
      alert('Không thể tạo phụ huynh');
    }
  };

  const handleUpdate = async (id: string, data: Partial<Parent>) => {
    try {
      await updateParent(id, data);
      setShowEditModal(false);
      setEditingParent(null);
    } catch (err) {
      alert('Không thể cập nhật phụ huynh');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phụ huynh này?')) return;
    try {
      await deleteParent(id);
    } catch (err: any) {
      alert(err.message || 'Không thể xóa phụ huynh');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-indigo-600" size={24} />
            Danh sách phụ huynh
          </h2>
          <p className="text-sm text-gray-500">Học sinh được liên kết tự động qua parentId</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="Tìm kiếm theo tên hoặc SĐT phụ huynh..." 
            className="w-full pl-3 pr-4 py-2 border border-gray-300 rounded hover:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-medium"
        >
          <Plus size={16} /> Thêm phụ huynh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600 border-collapse">
          <thead className="bg-white text-gray-800 font-bold border-b-2 border-gray-200">
            <tr>
              <th className="px-4 py-3 border-r border-gray-200 w-16 text-center">No</th>
              <th className="px-4 py-3 border-r border-gray-200 w-1/4">Tên Phụ Huynh</th>
              <th className="px-4 py-3 border-r border-gray-200 w-1/4">Học Sinh</th>
              <th className="px-4 py-3 border-r border-gray-200">Trạng thái</th>
              <th className="px-4 py-3 border-r border-gray-200">Lớp học</th>
              <th className="px-4 py-3">Hành Động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    Đang tải...
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-red-500">
                  Lỗi: {error}
                </td>
              </tr>
            ) : parents.length > 0 ? parents.map((parent, index) => (
              <tr key={parent.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 border-r border-gray-200 text-center align-top pt-4">{index + 1}</td>
                <td className="px-4 py-3 border-r border-gray-200 align-top pt-4">
                  <div className="font-bold text-gray-900">{parent.name}</div>
                  <div className="flex items-center gap-1 text-gray-600 mt-1">
                    <Phone size={12} />
                    <span className="text-xs">{parent.phone}</span>
                  </div>
                  {parent.email && (
                    <div className="text-xs text-gray-400 mt-1">{parent.email}</div>
                  )}
                </td>
                
                {/* Children Column - Query từ students */}
                <td className="px-0 py-0 border-r border-gray-200 align-top">
                  {parent.children.length > 0 ? parent.children.map((child, cIndex) => (
                    <div 
                      key={child.id} 
                      className={`px-4 py-3 flex flex-col justify-center min-h-[4rem] ${
                        cIndex !== parent.children.length - 1 ? 'border-b border-gray-200' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">{child.fullName}</div>
                      <div className="text-xs text-gray-500">{child.code}</div>
                    </div>
                  )) : (
                    <div className="px-4 py-3 text-gray-400 italic min-h-[4rem] flex items-center">
                      Chưa có học sinh
                    </div>
                  )}
                </td>

                {/* Status Column */}
                <td className="px-0 py-0 border-r border-gray-200 align-top">
                  {parent.children.length > 0 ? parent.children.map((child, cIndex) => (
                    <div 
                      key={child.id} 
                      className={`px-4 py-3 flex items-center min-h-[4rem] ${
                        cIndex !== parent.children.length - 1 ? 'border-b border-gray-200' : ''
                      }`}
                    >
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        child.status === StudentStatus.ACTIVE ? 'bg-green-100 text-green-700' : 
                        child.status === StudentStatus.RESERVED ? 'bg-orange-100 text-orange-700' : 
                        child.status === StudentStatus.TRIAL ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {child.status}
                      </span>
                    </div>
                  )) : <div className="px-4 py-3 min-h-[4rem]">-</div>}
                </td>

                {/* Class Column */}
                <td className="px-0 py-0 border-r border-gray-200 align-top">
                  {parent.children.length > 0 ? parent.children.map((child, cIndex) => (
                    <div 
                      key={child.id} 
                      className={`px-4 py-3 flex items-center min-h-[4rem] ${
                        cIndex !== parent.children.length - 1 ? 'border-b border-gray-200' : ''
                      }`}
                    >
                      <span className="text-gray-900">{child.class || '-'}</span>
                    </div>
                  )) : <div className="px-4 py-3 min-h-[4rem]">-</div>}
                </td>

                {/* Action Column */}
                <td className="px-4 py-3 align-top pt-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setEditingParent(parent); setShowEditModal(true); }}
                      className="text-gray-400 hover:text-indigo-600 p-1"
                      title="Chỉnh sửa"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(parent.id)}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  <Users size={48} className="mx-auto mb-2 opacity-20" />
                  Không tìm thấy phụ huynh nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Parent Modal */}
      {showCreateModal && (
        <ParentModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* Edit Parent Modal */}
      {showEditModal && editingParent && (
        <ParentModal
          parent={editingParent}
          onClose={() => { setShowEditModal(false); setEditingParent(null); }}
          onSubmit={(data) => handleUpdate(editingParent.id, data)}
        />
      )}
    </div>
  );
};

// ============================================
// PARENT MODAL (Create/Edit)
// ============================================
interface ParentModalProps {
  parent?: Parent;
  onClose: () => void;
  onSubmit: (data: Omit<Parent, 'id'>) => void;
}

const ParentModal: React.FC<ParentModalProps> = ({ parent, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: parent?.name || '',
    phone: parent?.phone || '',
    email: parent?.email || '',
    address: parent?.address || '',
    relationship: parent?.relationship || 'Bố' as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">
            {parent ? 'Chỉnh sửa phụ huynh' : 'Thêm phụ huynh mới'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ tên phụ huynh <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0123456789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quan hệ
              </label>
              <select
                value={formData.relationship}
                onChange={(e) => setFormData({ ...formData, relationship: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="Bố">Bố</option>
                <option value="Mẹ">Mẹ</option>
                <option value="Ông/Bà">Ông/Bà</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Địa chỉ
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Số nhà, đường, quận..."
            />
          </div>

          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
            <strong>Lưu ý:</strong> Để thêm học sinh cho phụ huynh này, vào <strong>Quản lý Học sinh</strong> và chọn phụ huynh khi tạo học sinh.
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {parent ? 'Lưu thay đổi' : 'Thêm phụ huynh'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
