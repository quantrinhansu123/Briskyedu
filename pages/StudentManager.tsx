
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Gift, History, User, Phone, MoreHorizontal, Calendar, ArrowRight, Cake, Plus, Edit, Trash2, UserPlus, Shuffle, AlertTriangle, PlusCircle, MinusCircle, RefreshCw, Pause, UserMinus, ChevronDown, ChevronUp, X, DollarSign, BookOpen } from 'lucide-react';
import { Student, StudentStatus, Parent } from '../types';
import { useNavigate } from 'react-router-dom';
import { useStudents } from '../src/hooks/useStudents';
import { useParents } from '../src/hooks/useParents';
import { useClasses } from '../src/hooks/useClasses';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { getFeedbacks, FeedbackRecord } from '../src/services/feedbackService';
import { ClassModel } from '../types';
import { createEnrollment } from '../src/services/enrollmentService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { ImportExportButtons } from '../components/ImportExportButtons';
import { STUDENT_FIELDS, STUDENT_MAPPING, prepareStudentExport } from '../src/utils/excelUtils';

// Normalize English status to Vietnamese - defined outside component to avoid hoisting issues
const normalizeStatus = (status: string): StudentStatus | string => {
  if (!status) return '';
  
  const lower = status.toLowerCase().trim().normalize('NFC');
  
  // Map various status formats to enum values
  if (lower === 'active' || lower === 'đang học') return StudentStatus.ACTIVE;
  if (lower === 'inactive' || lower === 'dropped' || lower === 'nghỉ học' || lower === 'đã nghỉ' || lower.includes('nghỉ')) return StudentStatus.DROPPED;
  if (lower === 'reserved' || lower === 'bảo lưu' || lower.includes('bảo lưu')) return StudentStatus.RESERVED;
  if (lower === 'trial' || lower === 'học thử' || lower.includes('học thử')) return StudentStatus.TRIAL;
  if (lower === 'debt' || lower === 'nợ phí' || (lower.includes('nợ') && !lower.includes('hợp đồng'))) return StudentStatus.DEBT;
  if (lower === 'contract_debt' || lower === 'nợ hợp đồng' || lower.includes('nợ hợp đồng')) return StudentStatus.CONTRACT_DEBT;
  
  return status;
};

interface StudentManagerProps {
  initialStatusFilter?: StudentStatus;
  title?: string;
}

export const StudentManager: React.FC<StudentManagerProps> = ({ 
  initialStatusFilter, 
  title = "Danh sách học viên" 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentFeedbacks, setStudentFeedbacks] = useState<FeedbackRecord[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<StudentStatus | 'ALL'>(initialStatusFilter || 'ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [birthdayMonth, setBirthdayMonth] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [assigningClasses, setAssigningClasses] = useState(false);
  const navigate = useNavigate();

  // Action modals state
  const [actionStudent, setActionStudent] = useState<Student | null>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [showTransferSessionModal, setShowTransferSessionModal] = useState(false);
  const [showTransferClassModal, setShowTransferClassModal] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showRemoveClassModal, setShowRemoveClassModal] = useState(false);
  const [actionDropdownId, setActionDropdownId] = useState<string | null>(null);
  
  // Post-creation modal state
  const [showPostCreateModal, setShowPostCreateModal] = useState(false);
  const [newlyCreatedStudent, setNewlyCreatedStudent] = useState<Student | null>(null);

  // Expanded sections state
  const [expandedEnrollment, setExpandedEnrollment] = useState(false);
  const [expandedFinance, setExpandedFinance] = useState(false);
  const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);
  const [studentContracts, setStudentContracts] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Permissions
  const { canCreate, canEdit, canDelete, shouldHideParentPhone, shouldShowOnlyOwnClasses, staffId } = usePermissions();
  const { staffData } = useAuth();
  const canCreateStudent = canCreate('students');
  const canEditStudent = canEdit('students');
  const canDeleteStudent = canDelete('students');
  const hideParentPhone = shouldHideParentPhone('students');
  const onlyOwnClasses = shouldShowOnlyOwnClasses('students');

  // Fetch ALL students from Firebase (no server-side status filter to handle legacy status values like "Đã nghỉ")
  const { students: allStudents, loading, error, createStudent, updateStudent, deleteStudent } = useStudents();
  
  // Fetch parents for dropdown
  const { parents } = useParents();
  
  // Fetch classes for dropdown
  const { classes } = useClasses({});

  // Fetch feedbacks when selectedStudent changes
  useEffect(() => {
    const fetchStudentFeedbacks = async () => {
      if (selectedStudent?.id) {
        setFeedbacksLoading(true);
        try {
          const feedbacks = await getFeedbacks({ studentId: selectedStudent.id });
          setStudentFeedbacks(feedbacks);
        } catch (err) {
          console.error('Error fetching feedbacks:', err);
          setStudentFeedbacks([]);
        } finally {
          setFeedbacksLoading(false);
        }
      } else {
        setStudentFeedbacks([]);
        setFeedbacksLoading(false);
      }
    };
    fetchStudentFeedbacks();
  }, [selectedStudent?.id]);

  // Filter students based on teacher's classes (if onlyOwnClasses)
  const students = useMemo(() => {
    if (!onlyOwnClasses || !staffData) return allStudents;
    // Teachers only see students from their classes
    // This requires knowledge of which classes the teacher teaches
    // For now, we'll filter on class reference if available
    return allStudents; // TODO: Implement proper class-based filtering
  }, [allStudents, onlyOwnClasses, staffData]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Filter by status (client-side to handle legacy status values like "Đã nghỉ")
      let matchesStatus = true;
      if (filterStatus !== 'ALL') {
        const normalizedStatus = normalizeStatus(student.status);
        matchesStatus = normalizedStatus === filterStatus;
      }
      
      // Filter by search term
      let matchesSearch = true;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        matchesSearch = 
          student.fullName?.toLowerCase().includes(search) ||
          student.code?.toLowerCase().includes(search) ||
          student.phone?.includes(search) ||
          student.parentName?.toLowerCase().includes(search);
      }
      
      // Filter by birthday month
      let matchesBirthday = true;
      if (birthdayMonth) {
        const studentMonth = new Date(student.dob).getMonth() + 1;
        matchesBirthday = studentMonth === parseInt(birthdayMonth);
      }

      // Filter by class
      let matchesClass = true;
      if (filterClass === 'NO_CLASS') {
        matchesClass = !student.classId && !student.class;
      } else if (filterClass !== 'ALL') {
        matchesClass = student.classId === filterClass || student.class === filterClass;
      }
      
      return matchesStatus && matchesSearch && matchesBirthday && matchesClass;
    });
  }, [students, filterStatus, searchTerm, birthdayMonth, filterClass]);

  // Find students without class assigned
  const studentsWithoutClass = useMemo(() => {
    return students.filter(s => !s.classId && !s.class);
  }, [students]);

  // Get active classes for assignment
  const activeClasses = useMemo(() => {
    return classes.filter(c => 
      c.status === 'Đang học' || c.status === 'Chờ mở' || c.status === 'Active' || c.status === 'Pending'
    );
  }, [classes]);

  // Assign classes randomly to students without class
  const handleAssignClassesRandomly = async () => {
    if (studentsWithoutClass.length === 0) {
      alert('Tất cả học viên đã có lớp!');
      return;
    }
    if (activeClasses.length === 0) {
      alert('Không có lớp nào đang hoạt động!');
      return;
    }
    if (!window.confirm(`Gán lớp ngẫu nhiên cho ${studentsWithoutClass.length} học viên chưa có lớp?`)) {
      return;
    }

    setAssigningClasses(true);
    let assigned = 0;
    
    for (const student of studentsWithoutClass) {
      const randomClass = activeClasses[Math.floor(Math.random() * activeClasses.length)];
      try {
        await updateStudent(student.id, {
          classId: randomClass.id,
          class: randomClass.name
        });
        assigned++;
      } catch (err) {
        console.error('Error assigning class:', err);
      }
    }

    setAssigningClasses(false);
    alert(`Đã gán lớp cho ${assigned}/${studentsWithoutClass.length} học viên!`);
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = normalizeStatus(status);
    switch(normalizedStatus) {
      case StudentStatus.ACTIVE: return 'text-green-600 bg-green-50 ring-green-500/10';
      case StudentStatus.DEBT: return 'text-red-600 bg-red-50 ring-red-500/10';
      case StudentStatus.RESERVED: return 'text-yellow-600 bg-yellow-50 ring-yellow-500/10';
      case StudentStatus.DROPPED: return 'text-gray-600 bg-gray-50 ring-gray-500/10';
      case StudentStatus.TRIAL: return 'text-purple-600 bg-purple-50 ring-purple-500/10';
      default: return 'text-gray-600 bg-gray-50 ring-gray-500/10';
    }
  };

  // Helper to format ISO date to DD/MM/YYYY
  const formatDob = (isoDate: string) => {
    const d = new Date(isoDate);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleCreateStudent = async (data: Partial<Student>) => {
    try {
      const newStudent = await createStudent(data);
      setShowCreateModal(false);
      // Show post-creation modal with options
      if (newStudent) {
        setNewlyCreatedStudent({ ...data, id: newStudent } as Student);
        setShowPostCreateModal(true);
      }
    } catch (err) {
      console.error('Error creating student:', err);
      alert('Không thể tạo học viên. Vui lòng thử lại.');
    }
  };
  
  const handlePostCreateEnroll = () => {
    if (newlyCreatedStudent) {
      setActionStudent(newlyCreatedStudent);
      setShowPostCreateModal(false);
      setShowEnrollmentModal(true);
    }
  };
  
  const handlePostCreateContract = () => {
    if (newlyCreatedStudent) {
      setShowPostCreateModal(false);
      // Navigate to contract page with student info
      navigate(`/contracts/new?studentId=${newlyCreatedStudent.id}&studentName=${encodeURIComponent(newlyCreatedStudent.fullName || '')}`);
    }
  };

  const handleUpdateStudent = async (id: string, data: Partial<Student>) => {
    try {
      await updateStudent(id, data);
      setShowEditModal(false);
      setEditingStudent(null);
    } catch (err) {
      console.error('Error updating student:', err);
      alert('Không thể cập nhật học viên. Vui lòng thử lại.');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa học viên này?')) return;
    
    try {
      await deleteStudent(id);
      if (selectedStudent?.id === id) {
        setSelectedStudent(null);
      }
    } catch (err) {
      console.error('Error deleting student:', err);
      alert('Không thể xóa học viên. Vui lòng thử lại.');
    }
  };

  // Import students from Excel
  const handleImportStudents = async (data: Record<string, any>[]): Promise<{ success: number; errors: string[] }> => {
    const errors: string[] = [];
    let success = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (!row.fullName) {
          errors.push(`Dòng ${i + 1}: Thiếu họ tên`);
          continue;
        }

        // Parse remainingSessions (có thể âm = nợ phí)
        const remainingSessions = typeof row.remainingSessions === 'number' 
          ? row.remainingSessions 
          : parseInt(row.remainingSessions) || 0;

        // Auto-set status = 'Nợ phí' nếu số buổi còn lại < 0
        let status = row.status ? normalizeStatus(row.status) : StudentStatus.ACTIVE;
        if (remainingSessions < 0) {
          status = StudentStatus.DEBT;
        }

        await createStudent({
          fullName: row.fullName,
          code: row.code || `HV${Date.now()}${i}`,
          dob: row.dob || '',
          gender: row.gender || '',
          phone: row.phone || '',
          email: row.email || '',
          parentName: row.parentName || '',
          parentPhone2: row.parentPhone2 || '',
          address: row.address || '',
          class: row.class || '',
          registeredSessions: typeof row.registeredSessions === 'number' ? row.registeredSessions : parseInt(row.registeredSessions) || 0,
          remainingSessions: remainingSessions,
          status: status as StudentStatus,
          note: row.note || '',
        } as any);
        success++;
      } catch (err: any) {
        errors.push(`Dòng ${i + 1} (${row.fullName}): ${err.message || 'Lỗi tạo học viên'}`);
      }
    }

    return { success, errors };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 hidden lg:block">{title}</h2>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm tên, mã, SĐT..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="pl-2 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as StudentStatus | 'ALL')}
            disabled={!!initialStatusFilter}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.values(StudentStatus).map(s => (
                <option key={s} value={s}>{s}</option>
            ))}
          </select>
          
          <select
            className="pl-2 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
            value={birthdayMonth}
            onChange={(e) => setBirthdayMonth(e.target.value)}
          >
            <option value="">Tháng sinh</option>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>

          <select
            className="pl-2 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm min-w-[140px]"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="ALL">Tất cả lớp</option>
            <option value="NO_CLASS">Chưa có lớp</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <ImportExportButtons
            data={students}
            prepareExport={prepareStudentExport}
            exportFileName="DanhSachHocVien"
            fields={STUDENT_FIELDS}
            mapping={STUDENT_MAPPING}
            onImport={handleImportStudents}
            templateFileName="MauNhapHocVien"
            entityName="học viên"
          />

          {canCreateStudent && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} /> Tạo mới
            </button>
          )}
        </div>
      </div>

      {/* Data Integrity Warning */}
      {studentsWithoutClass.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-500" size={20} />
              <div>
                <span className="font-semibold text-amber-800">
                  {studentsWithoutClass.length} học viên chưa được gán lớp
                </span>
                <p className="text-sm text-amber-600">
                  Tổng: {students.length} | Có lớp: {students.length - studentsWithoutClass.length} | Chưa có lớp: {studentsWithoutClass.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleAssignClassesRandomly}
              disabled={assigningClasses}
              className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Shuffle size={16} />
              {assigningClasses ? 'Đang gán...' : 'Gán lớp ngẫu nhiên'}
            </button>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${selectedStudent ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
        {/* Student List */}
        <div className={`${selectedStudent ? 'lg:col-span-2' : 'lg:col-span-1'} bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 sticky top-0 z-10">
                <tr>
                    <th className="px-4 py-3 bg-gray-50 w-12">No.</th>
                    <th className="px-4 py-3 bg-gray-50">Học viên</th>
                    <th className="px-4 py-3 bg-gray-50">Phụ huynh</th>
                    <th className="px-4 py-3 bg-gray-50">Lớp học</th>
                    <th className="px-4 py-3 bg-gray-50 text-center">Gói học</th>
                    <th className="px-4 py-3 bg-gray-50 text-center">Đã học</th>
                    <th className="px-4 py-3 bg-gray-50 text-center">Còn lại</th>
                    <th className="px-4 py-3 bg-gray-50 text-center">Ngày BĐ</th>
                    <th className="px-4 py-3 bg-gray-50 text-center">Ngày KT</th>
                    <th className="px-4 py-3 bg-gray-50">Trạng thái</th>
                    <th className="px-4 py-3 bg-gray-50"></th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                        Đang tải dữ liệu...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-red-500">
                      Lỗi: {error}
                    </td>
                  </tr>
                ) : filteredStudents.length > 0 ? filteredStudents.map((student, index) => (
                    <tr 
                    key={student.id} 
                    className={`hover:bg-indigo-50 cursor-pointer transition-colors ${selectedStudent?.id === student.id ? 'bg-indigo-50' : ''}`}
                    onClick={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                    >
                    <td className="px-4 py-3 text-xs text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3">
                        <div className="flex flex-col">
                           <span className="font-bold text-gray-800 text-[15px]">{student.fullName}</span>
                           <span className="text-sm font-bold text-red-500 font-handwriting">{formatDob(student.dob)}</span>
                        </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                        <p className="font-bold text-green-700">{student.parentName || '---'}</p>
                        {!hideParentPhone && (
                          <p className="text-gray-500 flex items-center gap-1">
                            <Phone size={10} /> {student.parentPhone || student.phone || '---'}
                          </p>
                        )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                       <p>{student.class || '---'}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                       <span className="font-semibold text-blue-600">{student.registeredSessions || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                       <span className="font-semibold text-green-600">{student.attendedSessions || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                       {(() => {
                         const remaining = student.remainingSessions ?? ((student.registeredSessions || 0) - (student.attendedSessions || 0));
                         return (
                           <span className={`font-bold ${remaining < 0 ? 'text-red-600' : remaining <= 5 ? 'text-orange-500' : 'text-gray-700'}`}>
                             {remaining}
                             {remaining < 0 && <span className="text-xs ml-1">(nợ)</span>}
                           </span>
                         );
                       })()}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                       {student.startDate ? new Date(student.startDate).toLocaleDateString('vi-VN') : '---'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                       {student.expectedEndDate ? new Date(student.expectedEndDate).toLocaleDateString('vi-VN') : '---'}
                    </td>
                    <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${
                            normalizeStatus(student.status) === StudentStatus.ACTIVE ? 'bg-green-500' : 
                            normalizeStatus(student.status) === StudentStatus.DEBT ? 'bg-red-500' :
                            normalizeStatus(student.status) === StudentStatus.RESERVED ? 'bg-orange-500' :
                            normalizeStatus(student.status) === StudentStatus.DROPPED ? 'bg-gray-500' :
                            normalizeStatus(student.status) === StudentStatus.TRIAL ? 'bg-purple-500' : 'bg-gray-400'
                        }`}>
                            {normalizeStatus(student.status)}
                        </span>
                    </td>
                    <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end relative">
                          {canEditStudent && (
                            <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 setEditingStudent(student);
                                 setShowEditModal(true);
                               }}
                               className="text-gray-400 hover:text-indigo-600 p-1"
                               title="Chỉnh sửa"
                            >
                               <Edit size={16} />
                            </button>
                          )}
                          {canDeleteStudent && (
                            <button 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 handleDeleteStudent(student.id);
                               }}
                               className="text-gray-400 hover:text-red-600 p-1"
                               title="Xóa"
                            >
                               <Trash2 size={16} />
                            </button>
                          )}
                          <button 
                             onClick={(e) => { e.stopPropagation(); navigate(`/customers/student-detail/${student.id}`); }}
                             className="text-gray-400 hover:text-indigo-600 p-1"
                             title="Chi tiết"
                          >
                             <ArrowRight size={18} />
                          </button>
                          {/* Action Dropdown */}
                          {canEditStudent && (
                            <div className="relative">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setActionDropdownId(actionDropdownId === student.id ? null : student.id);
                                }}
                                className="text-gray-400 hover:text-indigo-600 p-1"
                                title="Thao tác"
                              >
                                <ChevronDown size={16} />
                              </button>
                              {actionDropdownId === student.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowEnrollmentModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <PlusCircle size={14} className="text-blue-500" />
                                    Thêm/Bớt buổi
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowTransferSessionModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Gift size={14} className="text-green-500" />
                                    Tặng buổi cho HV khác
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowTransferClassModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <RefreshCw size={14} className="text-indigo-500" />
                                    Chuyển lớp
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowReserveModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Pause size={14} className="text-orange-500" />
                                    Bảo lưu
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionStudent(student);
                                      setShowRemoveClassModal(true);
                                      setActionDropdownId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                  >
                                    <UserMinus size={14} />
                                    Xóa khỏi lớp
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                    </td>
                    </tr>
                )) : (
                    <tr>
                        <td colSpan={11} className="text-center py-10 text-gray-500">
                            Không tìm thấy học viên nào.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
          </div>
        </div>

        {/* Student Detail & Care History Panel */}
        <div className="lg:col-span-1">
          {selectedStudent ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100 bg-teal-50/30">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 text-lg">Thông tin học viên</h3>
                    <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={18} /></button>
                 </div>
                 
                 <div className="mb-4">
                    <h4 className="text-xl font-bold text-teal-700 mb-1">{selectedStudent.fullName}</h4>
                    <p className="text-sm text-gray-500">{selectedStudent.code} | {selectedStudent.class}</p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-400">Ngày sinh</p>
                        <p className="font-medium text-gray-800">{formatDob(selectedStudent.dob)}</p>
                    </div>
                    <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-400">Trạng thái</p>
                        <p className="font-medium text-blue-600">{normalizeStatus(selectedStudent.status)}</p>
                    </div>
                 </div>
              </div>
              
              <div>
                 {/* Accordion Style Items */}
                 <div className="border-b border-gray-100">
                     <button 
                        onClick={() => navigate(`/customers/student-detail/${selectedStudent.id}?tab=finance`)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                     >
                        <span className="font-semibold text-gray-700">Lịch sử ghi danh & Tài chính</span>
                        <ArrowRight size={16} className="text-gray-400" />
                     </button>
                 </div>
                 
                 <div className="p-4">
                     <h4 className="font-bold text-red-500 font-handwriting text-lg mb-3">Lịch sử chăm sóc</h4>
                     
                     <div className="space-y-4 pl-4 border-l-2 border-gray-100 ml-2">
                        {/* Loading state */}
                        {feedbacksLoading && (
                          <p className="text-sm text-gray-400 italic">Đang tải...</p>
                        )}
                        
                        {/* Feedbacks (Form khảo sát, Gọi điện) */}
                        {!feedbacksLoading && studentFeedbacks.length > 0 && studentFeedbacks.map(feedback => (
                           <div key={feedback.id} className="relative mb-6">
                              <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full ring-4 ring-white ${
                                feedback.status === 'Completed' ? 'bg-green-500' : 
                                feedback.status === 'Pending' ? 'bg-orange-500' : 'bg-gray-400'
                              }`}></div>
                              <p className="text-xs text-gray-500 font-medium mb-1">
                                {feedback.date ? new Date(feedback.date).toLocaleDateString('vi-VN') : ''} - 
                                <span className={`ml-1 ${feedback.type === 'Form' ? 'text-purple-600' : 'text-orange-600'}`}>
                                  {feedback.type === 'Form' ? 'Form khảo sát' : 'Gọi điện'}
                                </span>
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                                  feedback.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                                  feedback.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {feedback.status === 'Completed' ? 'Hoàn thành' : feedback.status === 'Pending' ? 'Cần gọi' : feedback.status}
                                </span>
                              </p>
                              <div className="text-sm text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <p><span className="text-gray-500">Lớp:</span> {feedback.className}</p>
                                {feedback.averageScore && (
                                  <p><span className="text-gray-500">Điểm TB:</span> <span className="font-bold text-indigo-600">{feedback.averageScore}</span></p>
                                )}
                                {feedback.notes && <p className="mt-1 text-gray-600">{feedback.notes}</p>}
                              </div>
                           </div>
                        ))}
                        
                        {/* Care History */}
                        {selectedStudent.careHistory && selectedStudent.careHistory.length > 0 && selectedStudent.careHistory.map(log => (
                           <div key={log.id} className="relative mb-6">
                              <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-teal-500 ring-4 ring-white"></div>
                              <p className="text-xs text-gray-500 font-medium mb-1">{log.date} - <span className="text-teal-600">{log.type}</span></p>
                              <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                {log.content}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1 text-right">Người tạo: {log.staff}</p>
                           </div>
                        ))}
                        
                        {/* Empty state */}
                        {!feedbacksLoading && studentFeedbacks.length === 0 && (!selectedStudent.careHistory || selectedStudent.careHistory.length === 0) && (
                            <p className="text-sm text-gray-400 italic">Chưa có lịch sử chăm sóc</p>
                        )}
                     </div>
                 </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Create Student Modal */}
      {showCreateModal && (
        <CreateStudentModal
          parents={parents}
          classes={classes}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateStudent}
        />
      )}

      {/* Post-Creation Options Modal */}
      {showPostCreateModal && newlyCreatedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <User className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Tạo học viên thành công!</h3>
                  <p className="text-sm text-green-600">{newlyCreatedStudent.fullName}</p>
                </div>
              </div>
            </div>
            
            <div className="p-5">
              <p className="text-gray-600 mb-4">Bạn muốn tiếp tục với học viên này như thế nào?</p>
              
              <div className="space-y-3">
                {/* Option 1: Ghi danh thủ công */}
                <button
                  onClick={handlePostCreateEnroll}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200">
                      <UserPlus className="text-indigo-600" size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Ghi danh thủ công</p>
                      <p className="text-sm text-gray-500">Thêm buổi học, chọn lớp, ngày bắt đầu</p>
                    </div>
                  </div>
                </button>
                
                {/* Option 2: Tạo hợp đồng */}
                <button
                  onClick={handlePostCreateContract}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200">
                      <DollarSign className="text-green-600" size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Tạo hợp đồng mới</p>
                      <p className="text-sm text-gray-500">Tạo hợp đồng với đầy đủ thông tin thanh toán</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => { setShowPostCreateModal(false); setNewlyCreatedStudent(null); }}
                className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                Để sau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => {
            setShowEditModal(false);
            setEditingStudent(null);
          }}
          onSubmit={(data) => handleUpdateStudent(editingStudent.id, data)}
        />
      )}

      {/* Enrollment Modal - Thêm/Bớt buổi */}
      {showEnrollmentModal && actionStudent && (
        <EnrollmentModal
          student={actionStudent}
          staffData={staffData}
          onClose={() => {
            setShowEnrollmentModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            await updateStudent(actionStudent.id, {
              registeredSessions: data.newSessions
            });
            await createEnrollment({
              studentId: actionStudent.id,
              studentName: actionStudent.fullName,
              classId: actionStudent.classId || '',
              className: actionStudent.class || '',
              sessions: data.change,
              type: 'Ghi danh thủ công',
              reason: data.note,
              note: data.note,
              createdBy: staffData?.name || 'Admin',
              createdAt: new Date().toISOString(),
              createdDate: new Date().toLocaleDateString('vi-VN'),
              finalAmount: 0,
            });
            setShowEnrollmentModal(false);
            setActionStudent(null);
          }}
        />
      )}

      {/* Transfer Session Modal - Tặng buổi cho HV khác */}
      {showTransferSessionModal && actionStudent && (
        <TransferSessionModal
          student={actionStudent}
          allStudents={allStudents}
          staffData={staffData}
          onClose={() => {
            setShowTransferSessionModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            // Trừ buổi người cho
            await updateStudent(actionStudent.id, {
              registeredSessions: (actionStudent.registeredSessions || 0) - data.sessions
            });
            // Cộng buổi người nhận
            await updateStudent(data.targetStudentId, {
              registeredSessions: (data.targetSessions || 0) + data.sessions
            });
            // Log enrollment cho người cho (trừ)
            await createEnrollment({
              studentId: actionStudent.id,
              studentName: actionStudent.fullName,
              classId: actionStudent.classId || '',
              className: actionStudent.class || '',
              sessions: -data.sessions,
              type: 'Tặng buổi',
              reason: `Tặng ${data.sessions} buổi cho ${data.targetStudentName}. ${data.note}`,
              note: `Tặng ${data.sessions} buổi cho ${data.targetStudentName}. ${data.note}`,
              createdBy: staffData?.name || 'Admin',
              createdAt: new Date().toISOString(),
              createdDate: new Date().toLocaleDateString('vi-VN'),
              finalAmount: 0,
            });
            // Log enrollment cho người nhận (cộng)
            await createEnrollment({
              studentId: data.targetStudentId,
              studentName: data.targetStudentName,
              classId: data.targetClassId || '',
              className: data.targetClassName || '',
              sessions: data.sessions,
              type: 'Nhận tặng buổi',
              reason: `Nhận ${data.sessions} buổi từ ${actionStudent.fullName}. ${data.note}`,
              note: `Nhận ${data.sessions} buổi từ ${actionStudent.fullName}. ${data.note}`,
              createdBy: staffData?.name || 'Admin',
              createdAt: new Date().toISOString(),
              createdDate: new Date().toLocaleDateString('vi-VN'),
              finalAmount: 0,
            });
            setShowTransferSessionModal(false);
            setActionStudent(null);
          }}
        />
      )}

      {/* Transfer Class Modal - Chuyển lớp */}
      {showTransferClassModal && actionStudent && (
        <TransferClassModal
          student={actionStudent}
          classes={activeClasses}
          staffData={staffData}
          onClose={() => {
            setShowTransferClassModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            const oldClass = actionStudent.class || '';
            await updateStudent(actionStudent.id, {
              classId: data.newClassId,
              class: data.newClassName,
              registeredSessions: data.sessions
            });
            // Log enrollment
            await createEnrollment({
              studentId: actionStudent.id,
              studentName: actionStudent.fullName,
              classId: data.newClassId,
              className: data.newClassName,
              sessions: data.sessions,
              type: 'Chuyển lớp',
              reason: `Chuyển từ ${oldClass} sang ${data.newClassName}. ${data.note}`,
              note: `Chuyển từ ${oldClass} sang ${data.newClassName}. ${data.note}`,
              createdBy: staffData?.name || 'Admin',
              createdAt: new Date().toISOString(),
              createdDate: new Date().toLocaleDateString('vi-VN'),
              finalAmount: 0,
            });
            setShowTransferClassModal(false);
            setActionStudent(null);
          }}
        />
      )}

      {/* Reserve Modal - Bảo lưu */}
      {showReserveModal && actionStudent && (
        <ReserveModal
          student={actionStudent}
          staffData={staffData}
          onClose={() => {
            setShowReserveModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            await updateStudent(actionStudent.id, {
              status: StudentStatus.RESERVED,
              reserveDate: data.reserveDate,
              reserveNote: data.note,
              reserveSessions: (actionStudent.registeredSessions || 0) - (actionStudent.attendedSessions || 0)
            });
            setShowReserveModal(false);
            setActionStudent(null);
          }}
        />
      )}

      {/* Remove From Class Modal - Xóa khỏi lớp */}
      {showRemoveClassModal && actionStudent && (
        <RemoveClassModal
          student={actionStudent}
          staffData={staffData}
          onClose={() => {
            setShowRemoveClassModal(false);
            setActionStudent(null);
          }}
          onSubmit={async (data) => {
            const oldClass = actionStudent.class || '';
            await updateStudent(actionStudent.id, {
              classId: '',
              class: '',
              status: data.newStatus
            });
            // Log
            await createEnrollment({
              studentId: actionStudent.id,
              studentName: actionStudent.fullName,
              classId: '',
              className: '',
              sessions: 0,
              type: 'Xóa khỏi lớp',
              reason: `Xóa khỏi lớp ${oldClass}. ${data.note}`,
              note: `Xóa khỏi lớp ${oldClass}. ${data.note}`,
              createdBy: staffData?.name || 'Admin',
              createdAt: new Date().toISOString(),
              createdDate: new Date().toLocaleDateString('vi-VN'),
              finalAmount: 0,
            });
            setShowRemoveClassModal(false);
            setActionStudent(null);
          }}
        />
      )}

      {/* Click outside to close dropdown */}
      {actionDropdownId && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setActionDropdownId(null)}
        />
      )}
    </div>
  );
};

// ============================================
// CREATE STUDENT MODAL (with Parent Selection)
// ============================================
interface CreateStudentModalProps {
  parents: Array<Parent & { children: Student[] }>;
  classes: ClassModel[];
  onClose: () => void;
  onSubmit: (data: Partial<Student> & { newParentName?: string; newParentPhone?: string }) => void;
}

const CreateStudentModal: React.FC<CreateStudentModalProps> = ({ parents, classes, onClose, onSubmit }) => {
  const [parentMode, setParentMode] = useState<'select' | 'new'>('select');
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    gender: 'Nam' as 'Nam' | 'Nữ',
    phone: '',
    parentId: '',
    newParentName: '',
    newParentPhone: '',
    status: StudentStatus.ACTIVE,
    class: '',
    registeredSessions: 0,
    remainingSessions: 0
  });

  const selectedParent = parents.find(p => p.id === formData.parentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-set status = 'Nợ phí' nếu số buổi còn lại < 0
    const finalStatus = formData.remainingSessions < 0 ? StudentStatus.DEBT : formData.status;
    
    const submitData: any = {
      fullName: formData.fullName,
      dob: formData.dob,
      gender: formData.gender,
      phone: formData.phone,
      status: finalStatus,
      class: formData.class,
      registeredSessions: formData.registeredSessions || 0,
      remainingSessions: formData.remainingSessions || 0,
      attendedSessions: 0,
    };

    if (parentMode === 'select' && formData.parentId) {
      submitData.parentId = formData.parentId;
      submitData.parentName = selectedParent?.name;
      submitData.parentPhone = selectedParent?.phone;
    } else if (parentMode === 'new') {
      submitData.newParentName = formData.newParentName;
      submitData.newParentPhone = formData.newParentPhone;
    }

    onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">Tạo học viên mới</h3>
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
                placeholder="Nguyễn Văn A"
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
                placeholder="0123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trạng thái
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {Object.values(StudentStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Parent Selection Section */}
            <div className="col-span-2 border-t border-gray-200 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                  <UserPlus size={18} className="text-indigo-600" />
                  Thông tin phụ huynh
                </h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setParentMode('select')}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      parentMode === 'select' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Chọn PH có sẵn
                  </button>
                  <button
                    type="button"
                    onClick={() => setParentMode('new')}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      parentMode === 'new' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Tạo PH mới
                  </button>
                </div>
              </div>

              {parentMode === 'select' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chọn phụ huynh <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">-- Chọn phụ huynh --</option>
                    {parents.map(parent => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name} - {parent.phone} 
                        {parent.children.length > 0 && ` (${parent.children.length} con)`}
                      </option>
                    ))}
                  </select>
                  {selectedParent && (
                    <div className="mt-2 p-3 bg-indigo-50 rounded-lg text-sm">
                      <p className="font-medium text-indigo-800">{selectedParent.name}</p>
                      <p className="text-indigo-600">SĐT: {selectedParent.phone}</p>
                      {selectedParent.children.length > 0 && (
                        <p className="text-indigo-500 text-xs mt-1">
                          Đã có: {selectedParent.children.map(c => c.fullName).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tên phụ huynh <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.newParentName}
                      onChange={(e) => setFormData({ ...formData, newParentName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Nguyễn Văn B"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SĐT phụ huynh <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.newParentPhone}
                      onChange={(e) => setFormData({ ...formData, newParentPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0987654321"
                    />
                  </div>
                  <div className="col-span-2 text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                    Phụ huynh mới sẽ được tự động tạo khi lưu học viên
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lớp học hiện tại
              </label>
              <select
                value={formData.class}
                onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">-- Chọn lớp --</option>
                {classes
                  .filter(c => c.status === 'Đang học' || c.status === 'Chờ mở' || c.status === 'Active' || c.status === 'Pending')
                  .map(cls => (
                    <option key={cls.id} value={cls.name}>
                      {cls.name} {cls.teacher ? `(${cls.teacher})` : ''}
                    </option>
                  ))
                }
              </select>
              {classes.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">Chưa có lớp học nào trong hệ thống</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số buổi đăng ký
              </label>
              <input
                type="number"
                min={0}
                value={formData.registeredSessions}
                onChange={(e) => setFormData({ ...formData, registeredSessions: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="VD: 24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số buổi còn lại <span className="text-gray-400 font-normal">(âm = nợ phí)</span>
              </label>
              <input
                type="number"
                value={formData.remainingSessions}
                onChange={(e) => setFormData({ ...formData, remainingSessions: parseInt(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  formData.remainingSessions < 0 ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="VD: 10 hoặc -2"
              />
              {formData.remainingSessions < 0 && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ Nợ {Math.abs(formData.remainingSessions)} buổi → Tự động chuyển sang "Nợ phí"
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Tạo học viên
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// EDIT STUDENT MODAL
// ============================================
interface EditStudentModalProps {
  student: Student;
  onClose: () => void;
  onSubmit: (data: Partial<Student>) => void;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({ student, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    fullName: student.fullName || '',
    dob: student.dob ? new Date(student.dob).toISOString().split('T')[0] : '',
    gender: student.gender || 'Nam',
    phone: student.phone || '',
    parentName: student.parentName || '',
    parentPhone: student.parentPhone || '',
    status: student.status || StudentStatus.ACTIVE,
    class: student.class || '',
    registeredSessions: student.registeredSessions || 0,
    remainingSessions: student.remainingSessions ?? ((student.registeredSessions || 0) - (student.attendedSessions || 0)),
    attendedSessions: student.attendedSessions || 0,
    startDate: student.startDate ? new Date(student.startDate).toISOString().split('T')[0] : '',
  });

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
                onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {Object.values(StudentStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
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
                value={formData.class}
                onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số buổi đăng ký
              </label>
              <input
                type="number"
                min={0}
                value={formData.registeredSessions}
                onChange={(e) => setFormData({ ...formData, registeredSessions: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {formData.attendedSessions > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Đã học: {formData.attendedSessions} buổi
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số buổi còn lại <span className="text-gray-400 font-normal">(âm = nợ phí)</span>
              </label>
              <input
                type="number"
                value={formData.remainingSessions}
                onChange={(e) => setFormData({ ...formData, remainingSessions: parseInt(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  formData.remainingSessions < 0 ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="VD: 10 hoặc -2"
              />
              {formData.remainingSessions < 0 && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ Nợ {Math.abs(formData.remainingSessions)} buổi → Tự động chuyển sang "Nợ phí"
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

// ============================================
// ENROLLMENT MODAL - Thêm/Bớt buổi ghi danh
// ============================================
interface EnrollmentModalProps {
  student: Student;
  staffData: any;
  onClose: () => void;
  onSubmit: (data: { newSessions: number; change: number; note: string }) => void;
}

const EnrollmentModal: React.FC<EnrollmentModalProps> = ({ student, staffData, onClose, onSubmit }) => {
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

// ============================================
// TRANSFER SESSION MODAL - Tặng buổi cho HV khác
// ============================================
interface TransferSessionModalProps {
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
    note: string 
  }) => void;
}

const TransferSessionModal: React.FC<TransferSessionModalProps> = ({ student, allStudents, staffData, onClose, onSubmit }) => {
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

// ============================================
// TRANSFER CLASS MODAL - Chuyển lớp
// ============================================
interface TransferClassModalProps {
  student: Student;
  classes: ClassModel[];
  staffData: any;
  onClose: () => void;
  onSubmit: (data: { newClassId: string; newClassName: string; sessions: number; note: string }) => void;
}

const TransferClassModal: React.FC<TransferClassModalProps> = ({ student, classes, staffData, onClose, onSubmit }) => {
  const [newClassId, setNewClassId] = useState('');
  const [sessions, setSessions] = useState(student.registeredSessions || 0);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Số buổi chuyển</label>
            <input
              type="number"
              min={0}
              value={sessions}
              onChange={(e) => setSessions(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Số buổi còn lại sẽ được chuyển sang lớp mới</p>
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

// ============================================
// RESERVE MODAL - Bảo lưu
// ============================================
interface ReserveModalProps {
  student: Student;
  staffData: any;
  onClose: () => void;
  onSubmit: (data: { reserveDate: string; note: string }) => void;
}

const ReserveModal: React.FC<ReserveModalProps> = ({ student, staffData, onClose, onSubmit }) => {
  const [reserveDate, setReserveDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const remainingSessions = (student.registeredSessions || 0) - (student.attendedSessions || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ reserveDate, note });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Bảo lưu học viên</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <p className="font-medium text-orange-800">{student.fullName}</p>
          <p className="text-sm text-orange-700">Lớp: {student.class || '---'}</p>
          <p className="text-sm text-orange-700">Số buổi còn lại: <span className="font-bold">{remainingSessions}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bảo lưu</label>
            <input
              type="date"
              value={reserveDate}
              onChange={(e) => setReserveDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Chi tiết bảo lưu:</strong>
            </p>
            <ul className="text-sm text-gray-600 mt-1 space-y-1">
              <li>- Số buổi đã đăng ký: {student.registeredSessions || 0}</li>
              <li>- Số buổi đã học: {student.attendedSessions || 0}</li>
              <li>- Số buổi bảo lưu: <span className="font-bold text-orange-600">{remainingSessions}</span></li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Lý do bảo lưu..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
              Xác nhận bảo lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// REMOVE FROM CLASS MODAL - Xóa khỏi lớp
// ============================================
interface RemoveClassModalProps {
  student: Student;
  staffData: any;
  onClose: () => void;
  onSubmit: (data: { newStatus: StudentStatus; note: string }) => void;
}

const RemoveClassModal: React.FC<RemoveClassModalProps> = ({ student, staffData, onClose, onSubmit }) => {
  const [newStatus, setNewStatus] = useState<StudentStatus>(StudentStatus.DROPPED);
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(`Xác nhận xóa ${student.fullName} khỏi lớp ${student.class}?`)) {
      return;
    }
    onSubmit({ newStatus, note });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-red-600">Xóa học viên khỏi lớp</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="font-medium text-red-800">{student.fullName}</p>
          <p className="text-sm text-red-700">Lớp hiện tại: {student.class || '---'}</p>
          <p className="text-sm text-red-700">Số buổi còn: {(student.registeredSessions || 0) - (student.attendedSessions || 0)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái mới</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as StudentStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value={StudentStatus.DROPPED}>Nghỉ học</option>
              <option value={StudentStatus.RESERVED}>Bảo lưu</option>
              <option value={StudentStatus.TRIAL}>Học thử</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Lý do xóa khỏi lớp..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              Xác nhận xóa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
