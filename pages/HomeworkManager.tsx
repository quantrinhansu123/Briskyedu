import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, X, Save, Trash2, Settings, FileText, AlertCircle } from 'lucide-react';
import { useClasses } from '../src/hooks/useClasses';
import { useStudents } from '../src/hooks/useStudents';
import { useAuth } from '../src/hooks/useAuth';
import { usePermissions } from '../src/hooks/usePermissions';
import { useHolidays } from '../src/hooks/useHolidays';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { ClassModel, Student } from '../types';

// Default homework statuses with colors
const DEFAULT_HOMEWORK_STATUSES = [
  { value: 'completed', label: 'Đã làm', color: 'bg-green-500', textColor: 'text-white' },
  { value: 'not_completed', label: 'Chưa làm', color: 'bg-red-500', textColor: 'text-white' },
  { value: 'no_homework', label: 'Không có bài', color: 'bg-yellow-400', textColor: 'text-gray-800' },
  { value: 'absent', label: 'Nghỉ học', color: 'bg-blue-400', textColor: 'text-white' },
];

interface HomeworkStatus {
  value: string;
  label: string;
  color: string;
  textColor: string;
}

interface Homework {
  id: string;
  name: string;
  statuses?: HomeworkStatus[];
}

interface StudentHomeworkRecord {
  studentId: string;
  studentName: string;
  homeworks: {
    [homeworkId: string]: {
      status: string;
      score: number | null;
    };
  };
  note: string;
}

interface HomeworkSession {
  id?: string;
  classId: string;
  className: string;
  sessionId: string;
  sessionNumber: number;
  sessionDate: string;
  homeworks: Homework[];
  studentRecords: StudentHomeworkRecord[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}


export const HomeworkManager: React.FC = () => {
  const { classes } = useClasses();
  const { students: allStudents } = useStudents({});
  const { user, staffData } = useAuth();
  const { shouldShowOnlyOwnClasses, staffId } = usePermissions();
  const { holidays } = useHolidays();

  // Tab state (only homework tab remains after refactor)
  const [activeTab, setActiveTab] = useState<'homework'>('homework');

  // State
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [filterBranch, setFilterBranch] = useState<string>('');  // Branch filter
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // Homework state
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [newHomeworkName, setNewHomeworkName] = useState('');
  const [studentRecords, setStudentRecords] = useState<StudentHomeworkRecord[]>([]);
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Bulk homework state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedBulkClassIds, setSelectedBulkClassIds] = useState<string[]>([]);
  const [bulkHomeworks, setBulkHomeworks] = useState<string[]>(['']);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Status config modal
  const [showStatusConfig, setShowStatusConfig] = useState(false);
  const [globalStatuses, setGlobalStatuses] = useState<HomeworkStatus[]>(DEFAULT_HOMEWORK_STATUSES);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('bg-gray-500');


  // Get unique branches from classes
  const branches = useMemo(() => {
    return [...new Set(classes.map(c => c.branch).filter(Boolean))].sort() as string[];
  }, [classes]);

  // Filter classes for teachers
  const filteredClasses = useMemo(() => {
    const onlyOwn = shouldShowOnlyOwnClasses('homework');
    const excludeStatuses = ['Đã kết thúc', 'Đã hủy', 'Kết thúc'];

    let result = classes.filter(c => !excludeStatuses.includes(c.status || ''));

    // Filter by branch
    if (filterBranch) {
      result = result.filter(c => c.branch === filterBranch);
    }

    // Filter by own classes for teachers
    if (onlyOwn && staffData) {
      const myName = staffData.name;
      result = result.filter(cls =>
        cls.teacher === myName || cls.assistant === myName || cls.foreignTeacher === myName
      );
    }

    return result;
  }, [classes, shouldShowOnlyOwnClasses, staffData, filterBranch]);

  // Get students in selected class
  const studentsInClass = useMemo(() => {
    if (!selectedClassId) return [];
    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return [];

    return allStudents.filter(s =>
      s.classId === selectedClassId ||
      (s as any).currentClassId === selectedClassId ||  // Support currentClassId field
      s.classIds?.includes(selectedClassId) ||  // Support multi-class
      s.class === selectedClass.name ||
      s.className === selectedClass.name ||
      (s as any).currentClassName === selectedClass.name
    ).filter(s => s.status === 'Đang học' || s.status === 'Học thử' || s.status === 'Nợ phí');
  }, [selectedClassId, classes, allStudents]);

  // Check if date is a holiday
  const isHoliday = (dateStr: string): string | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    for (const h of holidays) {
      const start = new Date(h.startDate);
      const end = new Date(h.endDate || h.startDate);
      if (date >= start && date <= end) {
        return h.name || 'Lịch nghỉ chung';
      }
    }
    return null;
  };

  // Load global statuses from Firestore
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const docRef = doc(db, 'settings', 'homeworkStatuses');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setGlobalStatuses(docSnap.data().statuses || DEFAULT_HOMEWORK_STATUSES);
        }
      } catch (err) {
        console.error('Error loading statuses:', err);
      }
    };
    loadStatuses();
  }, []);

  // Load sessions when class is selected
  useEffect(() => {
    const loadSessions = async () => {
      if (!selectedClassId) {
        setSessions([]);
        return;
      }
      
      setLoadingSessions(true);
      try {
        const sessionsSnap = await getDocs(
          query(collection(db, 'classSessions'), where('classId', '==', selectedClassId))
        );
        const data = sessionsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => a.sessionNumber - b.sessionNumber);
        setSessions(data);
      } catch (err) {
        console.error('Error loading sessions:', err);
      } finally {
        setLoadingSessions(false);
      }
    };
    
    loadSessions();
  }, [selectedClassId]);

  // Load existing homework record when session is selected
  useEffect(() => {
    const loadExistingRecord = async () => {
      if (!selectedClassId || !selectedSessionId) {
        setHomeworks([]);
        setStudentRecords([]);
        setExistingRecordId(null);
        return;
      }
      
      setLoading(true);
      try {
        const recordsSnap = await getDocs(
          query(
            collection(db, 'homeworkRecords'),
            where('classId', '==', selectedClassId),
            where('sessionId', '==', selectedSessionId)
          )
        );
        
        if (!recordsSnap.empty) {
          const record = recordsSnap.docs[0];
          const data = record.data() as HomeworkSession;
          setExistingRecordId(record.id);
          setHomeworks(data.homeworks || []);
          setStudentRecords(data.studentRecords || []);
        } else {
          setExistingRecordId(null);
          setHomeworks([]);
          setStudentRecords(
            studentsInClass.map(s => ({
              studentId: s.id,
              studentName: s.fullName || s.name || '',
              homeworks: {},
              note: ''
            }))
          );
        }
      } catch (err) {
        console.error('Error loading homework record:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadExistingRecord();
  }, [selectedClassId, selectedSessionId, studentsInClass]);


  // Add new homework
  const handleAddHomework = () => {
    if (!newHomeworkName.trim()) return;
    
    const newHomework: Homework = {
      id: `hw_${Date.now()}`,
      name: newHomeworkName.trim(),
      statuses: globalStatuses
    };
    
    setHomeworks([...homeworks, newHomework]);
    
    setStudentRecords(prev => prev.map(record => ({
      ...record,
      homeworks: {
        ...record.homeworks,
        [newHomework.id]: { status: 'not_completed', score: null }
      }
    })));
    
    setNewHomeworkName('');
  };

  // Remove homework
  const handleRemoveHomework = (homeworkId: string) => {
    setHomeworks(prev => prev.filter(h => h.id !== homeworkId));
    setStudentRecords(prev => prev.map(record => {
      const { [homeworkId]: removed, ...rest } = record.homeworks;
      return { ...record, homeworks: rest };
    }));
  };

  // Update homework status
  const handleStatusChange = (studentId: string, homeworkId: string, status: string) => {
    setStudentRecords(prev => prev.map(record => {
      if (record.studentId !== studentId) return record;
      return {
        ...record,
        homeworks: {
          ...record.homeworks,
          [homeworkId]: {
            ...record.homeworks[homeworkId],
            status
          }
        }
      };
    }));
  };

  // Update score
  const handleScoreChange = (studentId: string, homeworkId: string, score: string) => {
    const scoreNum = score === '' ? null : parseFloat(score);
    setStudentRecords(prev => prev.map(record => {
      if (record.studentId !== studentId) return record;
      return {
        ...record,
        homeworks: {
          ...record.homeworks,
          [homeworkId]: {
            ...record.homeworks[homeworkId],
            score: scoreNum
          }
        }
      };
    }));
  };

  // Update note
  const handleNoteChange = (studentId: string, note: string) => {
    setStudentRecords(prev => prev.map(record => {
      if (record.studentId !== studentId) return record;
      return { ...record, note };
    }));
  };

  // Save homework records
  const handleSave = async () => {
    if (!selectedClassId || !selectedSessionId) {
      alert('Vui lòng chọn lớp và buổi học!');
      return;
    }
    
    if (homeworks.length === 0) {
      alert('Vui lòng thêm ít nhất 1 bài tập!');
      return;
    }
    
    setSaving(true);
    try {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      const selectedSession = sessions.find(s => s.id === selectedSessionId);
      
      const recordData: any = {
        classId: selectedClassId,
        className: selectedClass?.name || '',
        sessionId: selectedSessionId,
        sessionNumber: selectedSession?.sessionNumber || 0,
        sessionDate: selectedSession?.date || '',
        homeworks,
        studentRecords: studentRecords || [],
        updatedAt: new Date().toISOString(),
        createdBy: staffData?.name || user?.displayName || 'Unknown'
      };
      
      if (existingRecordId) {
        await updateDoc(doc(db, 'homeworkRecords', existingRecordId), recordData);
      } else {
        recordData.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'homeworkRecords'), recordData);
        setExistingRecordId(docRef.id);
      }
      
      alert('Đã lưu thành công!');
    } catch (err: any) {
      console.error('Error saving homework:', err);
      alert('Có lỗi xảy ra khi lưu: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Save global statuses
  const handleSaveStatuses = async () => {
    try {
      await setDoc(doc(db, 'settings', 'homeworkStatuses'), { statuses: globalStatuses });
      alert('Đã lưu cấu hình trạng thái!');
      setShowStatusConfig(false);
    } catch (err) {
      console.error('Error saving statuses:', err);
      alert('Có lỗi xảy ra!');
    }
  };

  // Add new status
  const handleAddStatus = () => {
    if (!newStatusLabel.trim()) return;
    const newStatus: HomeworkStatus = {
      value: newStatusLabel.toLowerCase().replace(/\s+/g, '_'),
      label: newStatusLabel,
      color: newStatusColor,
      textColor: newStatusColor.includes('yellow') || newStatusColor.includes('gray-2') ? 'text-gray-800' : 'text-white'
    };
    setGlobalStatuses([...globalStatuses, newStatus]);
    setNewStatusLabel('');
    setNewStatusColor('bg-gray-500');
  };

  // Remove status
  const handleRemoveStatus = (value: string) => {
    setGlobalStatuses(prev => prev.filter(s => s.value !== value));
  };

  // Toggle bulk class selection
  const toggleBulkClass = (classId: string) => {
    setSelectedBulkClassIds(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  // Save bulk homework for multiple classes
  const handleSaveBulkHomework = async () => {
    const validHomeworks = bulkHomeworks.filter(h => h.trim());
    if (selectedBulkClassIds.length === 0 || validHomeworks.length === 0) {
      alert('Vui lòng chọn ít nhất 1 lớp và nhập ít nhất 1 bài tập!');
      return;
    }

    setBulkSaving(true);
    try {
      let totalCreated = 0;
      let totalUpdated = 0;

      for (const classId of selectedBulkClassIds) {
        const selectedClass = classes.find(c => c.id === classId);
        
        // Get all sessions for this class
        const sessionsSnap = await getDocs(
          query(collection(db, 'classSessions'), where('classId', '==', classId))
        );
        const classSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const homeworkList = validHomeworks.map(name => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name,
          statuses: globalStatuses
        }));

        for (const session of classSessions) {
          const existingQ = query(
            collection(db, 'homeworkRecords'),
            where('classId', '==', classId),
            where('sessionId', '==', session.id)
          );
          const existingSnap = await getDocs(existingQ);

          if (!existingSnap.empty) {
            const existingDoc = existingSnap.docs[0];
            const existingData = existingDoc.data();
            const existingHomeworks = existingData.homeworks || [];
            
            const newHomeworks = homeworkList.filter(
              h => !existingHomeworks.some((eh: any) => eh.name === h.name)
            );
            
            if (newHomeworks.length > 0) {
              await updateDoc(doc(db, 'homeworkRecords', existingDoc.id), {
                homeworks: [...existingHomeworks, ...newHomeworks],
                updatedAt: new Date().toISOString()
              });
              totalUpdated++;
            }
          } else {
            await addDoc(collection(db, 'homeworkRecords'), {
              classId,
              className: selectedClass?.name || '',
              sessionId: session.id,
              sessionNumber: (session as any).sessionNumber || 0,
              sessionDate: (session as any).date || '',
              homeworks: homeworkList,
              studentRecords: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: staffData?.name || user?.displayName || 'Unknown'
            });
            totalCreated++;
          }
        }
      }

      alert(`Đã thêm bài tập vào ${totalCreated} buổi mới và cập nhật ${totalUpdated} buổi có sẵn!`);
      setShowBulkModal(false);
      setBulkHomeworks(['']);
      setSelectedBulkClassIds([]);
    } catch (err: any) {
      console.error('Error saving bulk homework:', err);
      alert('Có lỗi xảy ra: ' + (err.message || err));
    } finally {
      setBulkSaving(false);
    }
  };


  // Get status style
  const getStatusStyle = (status: string): { color: string; textColor: string; label: string } => {
    const found = globalStatuses.find(s => s.value === status);
    return found || { color: 'bg-gray-300', textColor: 'text-gray-700', label: status };
  };

  // Color options for status
  const colorOptions = [
    { value: 'bg-green-500', label: 'Xanh lá' },
    { value: 'bg-red-500', label: 'Đỏ' },
    { value: 'bg-yellow-400', label: 'Vàng' },
    { value: 'bg-blue-400', label: 'Xanh dương' },
    { value: 'bg-purple-500', label: 'Tím' },
    { value: 'bg-orange-500', label: 'Cam' },
    { value: 'bg-pink-500', label: 'Hồng' },
    { value: 'bg-gray-500', label: 'Xám' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            Quản lý Bài tập về nhà
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStatusConfig(true)}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
              title="Cấu hình trạng thái bài tập"
            >
              <Settings size={16} />
              Cấu hình
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium"
            >
              <Plus size={18} />
              Thêm hàng loạt
            </button>
          </div>
        </div>
        
        {/* Class Selector */}
        <div className="mb-4 flex flex-wrap gap-4 items-end">
          {/* Branch Filter */}
          {branches.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cơ sở</label>
              <select
                value={filterBranch}
                onChange={(e) => {
                  setFilterBranch(e.target.value);
                  setSelectedClassId('');
                  setSelectedSessionId('');
                }}
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tất cả cơ sở</option>
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          {/* Class Selector */}
          <div className="flex-1 min-w-[300px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn lớp học</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSessionId('');
              }}
              className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Chọn lớp --</option>
              {filteredClasses.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        {selectedClassId && (
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('homework')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'homework' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText size={16} className="inline mr-2" />
              Bài tập theo buổi
            </button>
            {/* Note: "Nhận xét tháng" and "Nhận xét bài Test" tabs moved to Reports > Báo cáo Học tập */}
          </div>
        )}
      </div>

      {/* TAB: Homework by Session */}
      {activeTab === 'homework' && selectedClassId && (
        <>
          {/* Session Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn buổi học</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              disabled={loadingSessions || sessions.length === 0}
              className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            >
              <option value="">
                {loadingSessions
                  ? 'Đang tải...'
                  : sessions.length === 0
                  ? 'Không có buổi học'
                  : '-- Chọn buổi học --'}
              </option>
              {sessions.map(session => {
                const holidayName = isHoliday(session.date);
                return (
                  <option key={session.id} value={session.id}>
                    Buổi {session.sessionNumber} - {session.date} ({session.status})
                    {holidayName && ` (${holidayName})`}
                  </option>
                );
              })}
            </select>

            {/* No sessions warning */}
            {!loadingSessions && sessions.length === 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2 text-yellow-800">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <strong>Lớp này chưa có buổi học nào.</strong>
                    <p className="mt-1 text-yellow-700">
                      Vui lòng vào <strong>Đào tạo → Quản lý lớp học → Chi tiết lớp</strong> để tạo lịch buổi học,
                      hoặc liên hệ quản lý để được hỗ trợ.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Holiday Warning */}
            {selectedSessionId && (() => {
              const session = sessions.find(s => s.id === selectedSessionId);
              const holidayName = session ? isHoliday(session.date) : null;
              if (holidayName) {
                return (
                  <div className="mt-2 flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-2 rounded-lg text-sm">
                    <AlertCircle size={16} />
                    <span>Buổi học này trùng với: <strong>{holidayName}</strong></span>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Homework Management */}
          {selectedSessionId && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Khai báo Bài tập</h3>
              
              {/* Add Homework */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newHomeworkName}
                  onChange={(e) => setNewHomeworkName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddHomework()}
                  placeholder="Tên bài tập..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddHomework}
                  disabled={!newHomeworkName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus size={18} />
                  Thêm
                </button>
              </div>
              
              {/* Homework Tags */}
              {homeworks.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {homeworks.map(hw => (
                    <span 
                      key={hw.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {hw.name}
                      <button
                        onClick={() => handleRemoveHomework(hw.id)}
                        className="ml-1 text-blue-500 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Student Records Table */}
          {selectedSessionId && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">STT</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Tên Học sinh</th>
                          {homeworks.map(hw => (
                            <th key={hw.id} className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b min-w-[160px]">
                              {hw.name}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b min-w-[200px]">
                            Ghi chú
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentRecords.length > 0 ? (
                          studentRecords.map((record, idx) => (
                            <tr key={record.studentId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {record.studentName}
                              </td>
                              {homeworks.map(hw => {
                                const hwRecord = record.homeworks[hw.id] || { status: 'not_completed', score: null };
                                const statusStyle = getStatusStyle(hwRecord.status);
                                return (
                                  <td key={hw.id} className="px-4 py-3 text-center">
                                    <select
                                      value={hwRecord.status}
                                      onChange={(e) => handleStatusChange(record.studentId, hw.id, e.target.value)}
                                      className={`w-full px-2 py-1.5 rounded-lg text-sm font-medium ${statusStyle.color} ${statusStyle.textColor} border-0 cursor-pointer appearance-none text-center`}
                                      style={{ WebkitAppearance: 'none' }}
                                    >
                                      {globalStatuses.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={record.note}
                                  onChange={(e) => handleNoteChange(record.studentId, e.target.value)}
                                  placeholder="Ghi chú..."
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={homeworks.length + 3} className="px-4 py-8 text-center text-gray-400">
                              {homeworks.length === 0 
                                ? 'Vui lòng thêm bài tập để bắt đầu'
                                : 'Không có học sinh trong lớp này'
                              }
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Save Button */}
                  <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
                    <button
                      onClick={handleSave}
                      disabled={saving || homeworks.length === 0}
                      className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Đang lưu...
                        </>
                      ) : (
                        <>
                          <Save size={18} />
                          Lưu Dữ liệu
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}


      {/* Empty State */}
      {!selectedClassId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Chọn lớp học</h3>
          <p className="text-gray-400">Vui lòng chọn lớp học để quản lý bài tập về nhà</p>
        </div>
      )}

      {/* Bulk Homework Modal - Multi-select classes */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Thêm bài tập hàng loạt</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Multi-select Classes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chọn lớp học (có thể chọn nhiều)
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredClasses.map(cls => (
                    <label 
                      key={cls.id} 
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBulkClassIds.includes(cls.id)}
                        onChange={() => toggleBulkClass(cls.id)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-sm">{cls.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Đã chọn: {selectedBulkClassIds.length} lớp
                </p>
              </div>

              {/* Homework List */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Danh sách bài tập</label>
                <div className="space-y-2">
                  {bulkHomeworks.map((hw, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={hw}
                        onChange={(e) => {
                          const updated = [...bulkHomeworks];
                          updated[index] = e.target.value;
                          setBulkHomeworks(updated);
                        }}
                        placeholder={`Bài tập ${index + 1}...`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      {bulkHomeworks.length > 1 && (
                        <button
                          onClick={() => setBulkHomeworks(prev => prev.filter((_, i) => i !== index))}
                          className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setBulkHomeworks([...bulkHomeworks, ''])}
                  className="mt-2 text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  <Plus size={16} />
                  Thêm bài tập
                </button>
              </div>

              {/* Preview */}
              {selectedBulkClassIds.length > 0 && (
                <div className="bg-purple-50 p-3 rounded-lg text-sm">
                  <p className="text-purple-700">
                    <strong>Xem trước:</strong> Sẽ thêm {bulkHomeworks.filter(h => h.trim()).length} bài tập 
                    vào tất cả buổi học của {selectedBulkClassIds.length} lớp đã chọn
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveBulkHomework}
                disabled={bulkSaving || selectedBulkClassIds.length === 0 || bulkHomeworks.filter(h => h.trim()).length === 0}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {bulkSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Thêm hàng loạt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Config Modal */}
      {showStatusConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Cấu hình trạng thái bài tập</h3>
              <button onClick={() => setShowStatusConfig(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Existing Statuses */}
              <div className="space-y-2">
                {globalStatuses.map(status => (
                  <div key={status.value} className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${status.color} ${status.textColor}`}>
                      {status.label}
                    </span>
                    <button
                      onClick={() => handleRemoveStatus(status.value)}
                      className="ml-auto text-red-500 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Status */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Thêm trạng thái mới</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStatusLabel}
                    onChange={(e) => setNewStatusLabel(e.target.value)}
                    placeholder="Tên trạng thái..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    value={newStatusColor}
                    onChange={(e) => setNewStatusColor(e.target.value)}
                    className={`px-3 py-2 rounded-lg text-sm ${newStatusColor} text-white`}
                  >
                    {colorOptions.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddStatus}
                    disabled={!newStatusLabel.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowStatusConfig(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveStatuses}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Save size={18} />
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
