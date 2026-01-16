/**
 * StudentsInClassModal Component
 * Modal for managing students enrolled in a class
 * Extracted from pages/ClassManager.tsx for modularity
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Users, Search, UserPlus, UserMinus, ArrowRightLeft } from 'lucide-react';
import { ClassModel, Student } from '@/types';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { TransferClassModal } from '@/src/features/students/components/TransferClassModal';
import { useClasses } from '@/src/hooks/useClasses';
import { useAuth } from '@/src/hooks/useAuth';

export interface StudentsInClassModalProps {
  classData: ClassModel;
  onClose: () => void;
  onUpdate: () => void;
}

export const StudentsInClassModal: React.FC<StudentsInClassModalProps> = ({ classData, onClose, onUpdate }) => {
  const [studentsInClass, setStudentsInClass] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Transfer class modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedStudentToTransfer, setSelectedStudentToTransfer] = useState<any>(null);
  const { classes: allClasses } = useClasses({});
  const { staffData } = useAuth();

  // Enrollment confirmation modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<any>(null);
  const [enrollForm, setEnrollForm] = useState({
    sessions: 12,
    startDate: new Date().toISOString().split('T')[0],
  });

  // Normalize student status
  const normalizeStatus = (status: string): string => {
    const map: { [key: string]: string } = {
      'Active': 'Đang học', 'active': 'Đang học',
      'Trial': 'Học thử', 'trial': 'Học thử',
      'Reserved': 'Bảo lưu', 'reserved': 'Bảo lưu',
      'Debt': 'Nợ phí', 'debt': 'Nợ phí',
      'Dropped': 'Nghỉ học', 'dropped': 'Nghỉ học',
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'Đang học': return 'bg-green-100 text-green-700';
      case 'Học thử': return 'bg-purple-100 text-purple-700';
      case 'Nợ phí': return 'bg-red-100 text-red-700';
      case 'Bảo lưu': return 'bg-orange-100 text-orange-700';
      case 'Nghỉ học': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Realtime listener for students - Bug 1 fix
  useEffect(() => {
    setLoading(true);

    // Subscribe to students collection with onSnapshot for realtime updates
    const unsubscribe = onSnapshot(
      collection(db, 'students'),
      (snapshot) => {
        const students = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Students in this class (match by classId, classIds array, className, or class field)
        const inClass = students.filter((s: any) =>
          s.classId === classData.id ||
          s.classIds?.includes(classData.id) ||
          s.className === classData.name ||
          s.class === classData.name
        );

        // Students not in this class (available to add)
        const notInClass = students.filter((s: any) =>
          s.classId !== classData.id &&
          !s.classIds?.includes(classData.id) &&
          s.className !== classData.name &&
          s.class !== classData.name
        );

        setStudentsInClass(inClass);
        setAllStudents(notInClass);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to students:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [classData.id, classData.name]);

  // Open enrollment modal when adding student
  const addStudentToClass = (student: any) => {
    setSelectedStudentToAdd(student);
    // Calculate remaining sessions from class data
    // Parse progress to get remaining sessions (e.g., "12/24 Buổi" -> 24 - 12 = 12)
    let defaultSessions = classData.totalSessions || 12;
    if (classData.progress) {
      const match = classData.progress.match(/(\d+)\/(\d+)/);
      if (match) {
        const completed = parseInt(match[1]);
        const total = parseInt(match[2]);
        defaultSessions = Math.max(1, total - completed);
      }
    }
    setEnrollForm({
      sessions: defaultSessions,
      startDate: new Date().toISOString().split('T')[0],
    });
    setShowEnrollModal(true);
  };

  // Confirm add student with enrollment
  const confirmAddStudent = async () => {
    if (!selectedStudentToAdd) return;

    setAdding(true);
    try {
      const studentRef = doc(db, 'students', selectedStudentToAdd.id);

      // Update student with classId, sessions, and add to classIds array
      await updateDoc(studentRef, {
        classId: classData.id,
        className: classData.name,
        class: classData.name,
        classIds: arrayUnion(classData.id),
        registeredSessions: (selectedStudentToAdd.registeredSessions || 0) + enrollForm.sessions,
        enrollmentDate: enrollForm.startDate,
        status: 'Đang học',
      });

      // Create enrollment record
      await addDoc(collection(db, 'enrollments'), {
        studentId: selectedStudentToAdd.id,
        studentName: selectedStudentToAdd.fullName || selectedStudentToAdd.name,
        studentCode: selectedStudentToAdd.code || '',
        classId: classData.id,
        className: classData.name,
        sessions: enrollForm.sessions,
        startDate: enrollForm.startDate,
        type: 'Ghi danh thủ công',
        status: 'Đã xác nhận',
        createdAt: new Date().toISOString(),
        note: `Thêm vào lớp ${classData.name} từ Quản lý học viên`,
      });

      // Update local state
      const updatedStudent = {
        ...selectedStudentToAdd,
        classId: classData.id,
        className: classData.name,
        registeredSessions: (selectedStudentToAdd.registeredSessions || 0) + enrollForm.sessions,
        status: 'Đang học',
      };
      setStudentsInClass(prev => [...prev, updatedStudent]);
      setAllStudents(prev => prev.filter(s => s.id !== selectedStudentToAdd.id));

      setShowEnrollModal(false);
      setSelectedStudentToAdd(null);
      onUpdate();
      alert('Đã thêm học viên và tạo ghi danh thành công!');
    } catch (err) {
      console.error('Error adding student to class:', err);
      alert('Không thể thêm học viên vào lớp');
    } finally {
      setAdding(false);
    }
  };

  // Remove student from class
  const removeStudentFromClass = async (student: any) => {
    if (!confirm(`Bạn có chắc muốn xóa ${student.fullName || student.name} khỏi lớp ${classData.name}?`)) return;

    try {
      const studentRef = doc(db, 'students', student.id);

      // Remove class reference
      await updateDoc(studentRef, {
        classId: null,
        className: null,
        class: null,
        classIds: arrayRemove(classData.id),
      });

      // Update local state
      setStudentsInClass(prev => prev.filter(s => s.id !== student.id));
      setAllStudents(prev => [...prev, { ...student, classId: null, className: null }]);
      onUpdate();
    } catch (err) {
      console.error('Error removing student from class:', err);
      alert('Không thể xóa học viên khỏi lớp');
    }
  };

  // Open transfer class modal - Bug 5 fix
  const openTransferModal = (student: any) => {
    setSelectedStudentToTransfer(student);
    setShowTransferModal(true);
  };

  // Handle transfer class submission
  const handleTransferSubmit = async (data: { newClassId: string; newClassName: string; sessions: number; note: string }) => {
    if (!selectedStudentToTransfer) return;

    try {
      const studentRef = doc(db, 'students', selectedStudentToTransfer.id);

      // Update student with new class
      await updateDoc(studentRef, {
        classId: data.newClassId,
        className: data.newClassName,
        class: data.newClassName,
        classIds: arrayUnion(data.newClassId),
        registeredSessions: data.sessions,
      });

      // Remove from old class's classIds
      await updateDoc(studentRef, {
        classIds: arrayRemove(classData.id),
      });

      // Create enrollment record for transfer
      await addDoc(collection(db, 'enrollments'), {
        studentId: selectedStudentToTransfer.id,
        studentName: selectedStudentToTransfer.fullName || selectedStudentToTransfer.name,
        studentCode: selectedStudentToTransfer.code || '',
        classId: data.newClassId,
        className: data.newClassName,
        oldClassId: classData.id,
        oldClassName: classData.name,
        sessions: data.sessions,
        type: 'Chuyển lớp',
        status: 'Đã xác nhận',
        createdAt: new Date().toISOString(),
        note: data.note,
      });

      setShowTransferModal(false);
      setSelectedStudentToTransfer(null);
      onUpdate();
      alert(`Đã chuyển ${selectedStudentToTransfer.fullName || selectedStudentToTransfer.name} sang lớp ${data.newClassName}`);
    } catch (err) {
      console.error('Error transferring student:', err);
      alert('Không thể chuyển lớp cho học viên');
    }
  };

  // Filter students in class by status
  const filteredStudentsInClass = useMemo(() => {
    if (statusFilter === 'ALL') return studentsInClass;
    return studentsInClass.filter(s => normalizeStatus(s.status) === statusFilter);
  }, [studentsInClass, statusFilter]);

  // Filter available students by search
  const filteredAvailableStudents = useMemo(() => {
    if (!searchTerm) return allStudents.slice(0, 10); // Show first 10 by default
    const term = searchTerm.toLowerCase();
    return allStudents.filter(s =>
      (s.fullName || s.name || '').toLowerCase().includes(term) ||
      (s.code || '').toLowerCase().includes(term) ||
      (s.phone || '').includes(term)
    ).slice(0, 20);
  }, [allStudents, searchTerm]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-200">
              <Users className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Quản lý học viên trong lớp</h3>
              <p className="text-sm text-gray-500">{classData.name} - {studentsInClass.length} học viên</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Current Students List */}
          <div className="flex-1 p-4 border-r border-gray-200 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Học viên trong lớp ({filteredStudentsInClass.length}/{studentsInClass.length})
              </h4>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Đang học">Đang học</option>
                <option value="Học thử">Học thử</option>
                <option value="Nợ phí">Nợ phí</option>
                <option value="Bảo lưu">Bảo lưu</option>
                <option value="Nghỉ học">Nghỉ học</option>
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
              </div>
            ) : filteredStudentsInClass.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p>{statusFilter === 'ALL' ? 'Chưa có học viên nào trong lớp' : `Không có học viên "${statusFilter}"`}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStudentsInClass.map((student) => {
                  const registered = student.registeredSessions || 0;
                  const attended = student.attendedSessions || 0;
                  const remaining = Math.max(0, registered - attended);
                  return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-green-300 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{student.fullName || student.name}</span>
                        <span className="text-xs text-gray-500">({student.code})</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(student.status)}`}>
                          {normalizeStatus(student.status)}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-blue-600" title="Đăng ký">{registered} ĐK</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-green-600" title="Đã học">{attended} ĐH</span>
                          <span className="text-gray-400">/</span>
                          <span className={`font-medium ${remaining <= 3 ? 'text-red-600' : 'text-orange-600'}`} title="Còn lại">
                            {remaining} CL
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openTransferModal(student)}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Chuyển lớp"
                      >
                        <ArrowRightLeft size={18} />
                      </button>
                      <button
                        onClick={() => removeStudentFromClass(student)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa khỏi lớp"
                      >
                        <UserMinus size={18} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Students Section */}
          <div className="w-full lg:w-80 p-4 bg-gray-50 overflow-y-auto">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Thêm học viên
            </h4>

            {/* Search */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Tìm theo tên, mã, SĐT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Available Students */}
            <div className="space-y-2">
              {filteredAvailableStudents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {searchTerm ? 'Không tìm thấy học viên' : 'Không có học viên khả dụng'}
                </p>
              ) : (
                filteredAvailableStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{student.fullName || student.name}</p>
                      <p className="text-xs text-gray-500">{student.code}</p>
                    </div>
                    <button
                      onClick={() => addStudentToClass(student)}
                      disabled={adding}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Thêm vào lớp"
                    >
                      <UserPlus size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {allStudents.length > 10 && !searchTerm && (
              <p className="text-xs text-gray-500 text-center mt-3">
                Hiển thị 10/{allStudents.length} học viên. Tìm kiếm để xem thêm.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Enrollment Confirmation Modal */}
      {showEnrollModal && selectedStudentToAdd && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => { setShowEnrollModal(false); setSelectedStudentToAdd(null); }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Xác nhận ghi danh</h3>
              <p className="text-sm text-gray-600 mt-1">Thêm học viên vào lớp {classData.name}</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Student Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800">{selectedStudentToAdd.fullName || selectedStudentToAdd.name}</p>
                <p className="text-sm text-gray-500">Mã: {selectedStudentToAdd.code || 'N/A'}</p>
              </div>

              {/* Sessions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số buổi đăng ký <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={enrollForm.sessions}
                  onChange={(e) => setEnrollForm(prev => ({ ...prev, sessions: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày bắt đầu <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={enrollForm.startDate}
                  onChange={(e) => setEnrollForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <p className="text-green-800">
                  <span className="font-medium">Ghi danh thủ công:</span> {enrollForm.sessions} buổi,
                  bắt đầu từ {new Date(enrollForm.startDate).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowEnrollModal(false); setSelectedStudentToAdd(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={adding}
              >
                Hủy
              </button>
              <button
                onClick={confirmAddStudent}
                disabled={adding || enrollForm.sessions < 1}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {adding ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Xác nhận thêm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Class Modal - Bug 5 fix */}
      {showTransferModal && selectedStudentToTransfer && (
        <TransferClassModal
          student={selectedStudentToTransfer as Student}
          classes={allClasses}
          staffData={staffData}
          onClose={() => { setShowTransferModal(false); setSelectedStudentToTransfer(null); }}
          onSubmit={handleTransferSubmit}
        />
      )}
    </div>
  );
};

export default StudentsInClassModal;
