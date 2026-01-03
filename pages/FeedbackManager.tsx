/**
 * Feedback Manager Page
 * Quản lý phản hồi phụ huynh (Gọi điện + Form khảo sát)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Phone, FileText, Plus, Search, X, Star, Trash2, CheckCircle } from 'lucide-react';
import { useFeedback } from '../src/hooks/useFeedback';
import { useStudents } from '../src/hooks/useStudents';
import { useClasses } from '../src/hooks/useClasses';
import { FeedbackRecord, FeedbackType, FeedbackStatus } from '../src/services/feedbackService';
import { Student } from '../types';

export const FeedbackManager: React.FC = () => {
  const { feedbacks, callFeedbacks, formFeedbacks, loading, error, createFeedback, updateStatus, deleteFeedback } = useFeedback();
  
  const [activeTab, setActiveTab] = useState<'call' | 'form'>('call');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa phản hồi này?')) return;
    try {
      await deleteFeedback(id);
    } catch (err) {
      alert('Không thể xóa');
    }
  };

  const handleStatusChange = async (id: string, status: FeedbackStatus) => {
    try {
      await updateStatus(id, status);
    } catch (err) {
      alert('Không thể cập nhật trạng thái');
    }
  };

  // Filter by search
  const filteredCalls = callFeedbacks.filter(f => 
    f.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.className.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredForms = formFeedbacks.filter(f => 
    f.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.className.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const needCallCount = callFeedbacks.filter(f => f.status === 'Cần gọi').length;
  const completedCount = feedbacks.filter(f => f.status === 'Hoàn thành').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-gray-800">Quản lý phản hồi phụ huynh</h2>
            <div className="flex gap-2">
              <span className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium">
                Cần gọi: {needCallCount}
              </span>
              <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                Hoàn thành: {completedCount}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus size={16} /> Thêm mới
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('call')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'call'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Phone size={16} />
            Gọi điện ({callFeedbacks.length})
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'form'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} />
            Form khảo sát ({formFeedbacks.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              Đang tải...
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">Lỗi: {error}</div>
        ) : activeTab === 'call' ? (
          /* Call Feedbacks Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Học sinh</th>
                  <th className="px-4 py-3">Lớp</th>
                  <th className="px-4 py-3">Người gọi</th>
                  <th className="px-4 py-3">Nội dung</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center w-20">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      <Phone size={48} className="mx-auto mb-2 opacity-20" />
                      Chưa có lịch gọi điện nào
                    </td>
                  </tr>
                ) : filteredCalls.map((fb) => (
                  <tr key={fb.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{fb.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{fb.studentName}</td>
                    <td className="px-4 py-3">{fb.className}</td>
                    <td className="px-4 py-3">{fb.caller || '-'}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{fb.content || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={fb.status}
                        onChange={(e) => fb.id && handleStatusChange(fb.id, e.target.value as FeedbackStatus)}
                        className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${
                          fb.status === 'Cần gọi' ? 'bg-yellow-100 text-yellow-700' :
                          fb.status === 'Đã gọi' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}
                      >
                        <option value="Cần gọi">Cần gọi</option>
                        <option value="Đã gọi">Đã gọi</option>
                        <option value="Hoàn thành">Hoàn thành</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => fb.id && handleDelete(fb.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Form Feedbacks Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Học sinh</th>
                  <th className="px-4 py-3">Lớp</th>
                  <th className="px-4 py-3 text-center">Giáo viên</th>
                  <th className="px-4 py-3 text-center">Chương trình</th>
                  <th className="px-4 py-3 text-center">Chăm sóc</th>
                  <th className="px-4 py-3 text-center">Cơ sở VC</th>
                  <th className="px-4 py-3 text-center">TB</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center w-20">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredForms.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-400">
                      <FileText size={48} className="mx-auto mb-2 opacity-20" />
                      Chưa có form khảo sát nào
                    </td>
                  </tr>
                ) : filteredForms.map((fb) => (
                  <tr key={fb.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{fb.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{fb.studentName}</td>
                    <td className="px-4 py-3">{fb.className}</td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={fb.teacherScore} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={fb.curriculumScore} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={fb.careScore} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={fb.facilitiesScore} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded font-bold text-sm ${
                        (fb.averageScore || 0) >= 8 ? 'bg-green-100 text-green-700' :
                        (fb.averageScore || 0) >= 6 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {fb.averageScore?.toFixed(1) || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        fb.status === 'Hoàn thành' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {fb.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => fb.id && handleDelete(fb.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <FeedbackModal
          onClose={() => setShowModal(false)}
          onSubmit={async (data) => {
            await createFeedback(data);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

// Score Badge Component
const ScoreBadge: React.FC<{ score?: number }> = ({ score }) => {
  if (!score) return <span className="text-gray-400">-</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      score >= 8 ? 'bg-green-100 text-green-700' :
      score >= 6 ? 'bg-yellow-100 text-yellow-700' :
      'bg-red-100 text-red-700'
    }`}>
      <Star size={12} fill="currentColor" />
      {score}
    </span>
  );
};

// Feedback Modal
interface FeedbackModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<FeedbackRecord, 'id'>) => Promise<void>;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose, onSubmit }) => {
  const { students } = useStudents();
  const { classes } = useClasses();
  
  const [formData, setFormData] = useState({
    type: 'Call' as FeedbackType,
    date: new Date().toISOString().split('T')[0],
    studentId: '',
    studentName: '',
    className: '',
    caller: '',
    content: '',
    teacherScore: 8,
    curriculumScore: 8,
    careScore: 8,
    facilitiesScore: 8,
    status: 'Cần gọi' as FeedbackStatus,
  });
  const [loading, setLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return [];
    const searchLower = studentSearch.toLowerCase();
    return students.filter(s => 
      (s.fullName?.toLowerCase().includes(searchLower)) ||
      ((s as any).name?.toLowerCase().includes(searchLower)) ||
      (s.code?.toLowerCase().includes(searchLower))
    ).slice(0, 10); // Limit to 10 suggestions
  }, [students, studentSearch]);

  // Get classes for selected student
  const studentClasses = useMemo(() => {
    if (!selectedStudent) return [];
    
    const studentClassIds: string[] = [];
    const studentClassNames: string[] = [];
    
    // Collect all possible class references
    if (selectedStudent.classId) studentClassIds.push(selectedStudent.classId);
    if ((selectedStudent as any).classIds) studentClassIds.push(...(selectedStudent as any).classIds);
    if (selectedStudent.class) studentClassNames.push(selectedStudent.class);
    if ((selectedStudent as any).className) studentClassNames.push((selectedStudent as any).className);
    
    // Filter classes
    return classes.filter(c => 
      studentClassIds.includes(c.id) || 
      studentClassNames.includes(c.name)
    );
  }, [selectedStudent, classes]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle student selection
  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setStudentSearch(student.fullName || (student as any).name || '');
    setFormData(prev => ({
      ...prev,
      studentId: student.id,
      studentName: student.fullName || (student as any).name || '',
      className: '', // Reset class when student changes
    }));
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentName || !formData.className) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800">Thêm phản hồi</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as FeedbackType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Call">Gọi điện</option>
              <option value="Form">Form khảo sát</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as FeedbackStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Cần gọi">Cần gọi</option>
                <option value="Đã gọi">Đã gọi</option>
                <option value="Hoàn thành">Hoàn thành</option>
              </select>
            </div>
          </div>

          {/* Student Autocomplete */}
          <div ref={searchRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên học sinh *</label>
            <input
              type="text"
              required
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setShowSuggestions(true);
                if (!e.target.value) {
                  setSelectedStudent(null);
                  setFormData(prev => ({ ...prev, studentId: '', studentName: '', className: '' }));
                }
              }}
              onFocus={() => setShowSuggestions(true)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Gõ tên học sinh để tìm..."
              autoComplete="off"
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions && filteredStudents.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => handleSelectStudent(student)}
                    className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {student.fullName || (student as any).name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {student.code} • {student.class || (student as any).className || 'Chưa có lớp'}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      student.status === 'Đang học' ? 'bg-green-100 text-green-700' :
                      student.status === 'Bảo lưu' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {student.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            {showSuggestions && studentSearch && filteredStudents.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                Không tìm thấy học sinh
              </div>
            )}
          </div>

          {/* Class Dropdown - Only show when student is selected */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lớp *</label>
            {selectedStudent ? (
              studentClasses.length > 0 ? (
                <select
                  required
                  value={formData.className}
                  onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn lớp --</option>
                  {studentClasses.map((cls) => (
                    <option key={cls.id} value={cls.name}>{cls.name}</option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                  Học sinh chưa được gán vào lớp nào
                </div>
              )
            ) : (
              <input
                type="text"
                disabled
                placeholder="Vui lòng chọn học sinh trước"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
              />
            )}
          </div>

          {formData.type === 'Call' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Người gọi</label>
                <input
                  type="text"
                  value={formData.caller}
                  onChange={(e) => setFormData({ ...formData, caller: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giáo viên</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.teacherScore}
                  onChange={(e) => setFormData({ ...formData, teacherScore: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chương trình</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.curriculumScore}
                  onChange={(e) => setFormData({ ...formData, curriculumScore: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chăm sóc KH</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.careScore}
                  onChange={(e) => setFormData({ ...formData, careScore: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cơ sở vật chất</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.facilitiesScore}
                  onChange={(e) => setFormData({ ...formData, facilitiesScore: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

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
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
