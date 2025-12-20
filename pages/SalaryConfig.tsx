/**
 * Salary Config Page - Redesigned
 * Cấu hình lương GV theo ca/giờ, liên kết với lớp học
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, DollarSign, Calendar, User, Building, Clock, Save } from 'lucide-react';
import { useSalaryConfig } from '../src/hooks/useSalaryConfig';
import { 
  SalaryRule, 
  SalaryRangeConfig, 
  RangeType 
} from '../src/services/salaryConfigService';
import { formatCurrency } from '../src/utils/currencyUtils';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../src/config/firebase';

interface StaffOption {
  id: string;
  name: string;
  position: string;
  department?: string;
}

interface ClassOption {
  id: string;
  name: string;
  code: string;
  teacherId?: string;
  teacher?: string;
  assistant?: string;
  foreignTeacher?: string;
  sessionDuration?: number; // in minutes
}

interface TeacherClassConfig {
  id?: string;
  staffId: string;
  classId: string;
  className: string;
  classCode: string;
  ratePerUnit: number;
  unit: 'Giờ' | 'Ca'; // Giờ = 60 phút, Ca = 90 phút
}

interface TeacherSalaryConfig {
  staffId: string;
  staffName: string;
  department: string;
  salaryCycle: string; // "Tháng 12/2025"
  note: string;
  classConfigs: TeacherClassConfig[];
  fixedSalary: number;
  allowance: number;
  kpiBonus: number;
}

export const SalaryConfig: React.FC = () => {
  const { 
    salaryRules, 
    teachingRanges, 
    feedbackRanges, 
    loading: rulesLoading, 
    createRule,
    deleteRule,
    createRange,
    deleteRange,
  } = useSalaryConfig();

  // State
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [staffClasses, setStaffClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  
  // Form state
  const [salaryCycle, setSalaryCycle] = useState(() => {
    const now = new Date();
    return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  });
  const [note, setNote] = useState('');
  const [classConfigs, setClassConfigs] = useState<TeacherClassConfig[]>([]);
  const [fixedSalary, setFixedSalary] = useState(0);
  const [allowance, setAllowance] = useState(0);
  const [kpiBonus, setKpiBonus] = useState(700);
  const [enableHourlyRate, setEnableHourlyRate] = useState(true);
  
  // Modal state
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Normalize position for display
  const normalizePosition = (pos: string): string => {
    const lower = pos?.toLowerCase() || '';
    if (lower.includes('quản lý') || lower === 'admin') return 'Quản lý';
    if (lower.includes('nước ngoài') || lower.includes('ngoại') || lower === 'foreign') return 'Giáo Viên Nước Ngoài';
    if (lower.includes('việt') || lower === 'gv việt') return 'Giáo Viên Việt';
    if (lower.includes('trợ') || lower === 'tg') return 'Trợ Giảng';
    return pos;
  };

  // Fetch staff list
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'staff'));
        const staffData: StaffOption[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const normalizedPos = normalizePosition(data.position || '');
          if (['Giáo Viên Việt', 'Giáo Viên Nước Ngoài', 'Trợ Giảng'].includes(normalizedPos)) {
            staffData.push({
              id: docSnap.id,
              name: data.name || '',
              position: normalizedPos,
              department: data.department || 'Khoa Tiếng Anh',
            });
          }
        });
        staffData.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        setStaffList(staffData);
      } catch (err) {
        console.error('Error fetching staff:', err);
      } finally {
        setLoadingStaff(false);
      }
    };
    fetchStaff();
  }, []);

  // Normalize string for comparison (remove diacritics, lowercase, trim)
  const normalizeString = (s: string): string => {
    if (!s) return '';
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Check if two names match (exact or partial)
  const namesMatch = (name1: string, name2: string): boolean => {
    if (!name1 || !name2) return false;
    const n1 = normalizeString(name1);
    const n2 = normalizeString(name2);
    // Exact match or one contains the other
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  };

  // Fetch classes for selected staff
  useEffect(() => {
    const fetchStaffClasses = async () => {
      if (!selectedStaff) {
        setStaffClasses([]);
        return;
      }
      
      setLoadingClasses(true);
      try {
        const snapshot = await getDocs(collection(db, 'classes'));
        const classData: ClassOption[] = [];
        const staffName = selectedStaff.name;
        const staffId = selectedStaff.id;
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          
          // Check multiple ways: ID match OR name match
          const isTeacher = data.teacherId === staffId || 
                           namesMatch(data.teacher, staffName);
          const isAssistant = data.assistantId === staffId || 
                             namesMatch(data.assistant, staffName);
          const isForeignTeacher = data.foreignTeacherId === staffId || 
                                   namesMatch(data.foreignTeacher, staffName);
          
          // Also check scheduleDetails for detailed assignment
          let isInScheduleDetails = false;
          if (data.scheduleDetails && Array.isArray(data.scheduleDetails)) {
            for (const detail of data.scheduleDetails) {
              if (namesMatch(detail.teacher, staffName) ||
                  namesMatch(detail.assistant, staffName) ||
                  namesMatch(detail.foreignTeacher, staffName)) {
                isInScheduleDetails = true;
                break;
              }
            }
          }
          
          if (isTeacher || isAssistant || isForeignTeacher || isInScheduleDetails) {
            classData.push({
              id: docSnap.id,
              name: data.name || '',
              code: data.code || data.id || '',
              teacherId: data.teacherId,
              teacher: data.teacher,
              assistant: data.assistant,
              foreignTeacher: data.foreignTeacher,
              sessionDuration: data.sessionDuration || 90,
            });
          }
        });
        
        classData.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        setStaffClasses(classData);
        
        // Auto-add classes to config if no existing config
        if (classConfigs.length === 0) {
          const newConfigs: TeacherClassConfig[] = classData.map(cls => ({
            classId: cls.id,
            className: cls.name,
            classCode: cls.code,
            staffId: selectedStaff.id,
            ratePerUnit: 200000,
            unit: cls.sessionDuration === 60 ? 'Giờ' : 'Ca',
          }));
          setClassConfigs(newConfigs);
        }
      } catch (err) {
        console.error('Error fetching classes:', err);
      } finally {
        setLoadingClasses(false);
      }
    };
    
    fetchStaffClasses();
  }, [selectedStaff]);

  // Load existing config for selected staff
  useEffect(() => {
    const loadExistingConfig = async () => {
      if (!selectedStaff) return;
      
      // Find existing rules for this staff
      const existingRules = salaryRules.filter(r => r.staffId === selectedStaff.id);
      if (existingRules.length > 0) {
        // Load from existing rules
        const configs: TeacherClassConfig[] = existingRules.map(rule => ({
          id: rule.id,
          staffId: rule.staffId || '',
          classId: rule.classId || '',
          className: rule.className || '',
          classCode: rule.classCode || '',
          ratePerUnit: rule.ratePerSession || 200000,
          unit: rule.salaryMethod === 'Theo giờ' ? 'Giờ' : 'Ca',
        }));
        setClassConfigs(configs);
        
        // Load other settings from first rule
        const firstRule = existingRules[0];
        setFixedSalary(firstRule.baseRate || 0);
        setAllowance(firstRule.allowance || 0);
        setKpiBonus(firstRule.kpiBonus || 700);
        setNote(firstRule.note || '');
      }
    };
    
    loadExistingConfig();
  }, [selectedStaff, salaryRules]);

  // Calculate total estimate
  const totalEstimate = useMemo(() => {
    const classTotal = classConfigs.reduce((sum, cfg) => sum + cfg.ratePerUnit, 0);
    return fixedSalary + allowance + classTotal;
  }, [classConfigs, fixedSalary, allowance]);

  // Handle staff select
  const handleStaffSelect = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    setSelectedStaff(staff || null);
    // Reset form
    setClassConfigs([]);
    setNote('');
  };

  // Update class config
  const updateClassConfig = (index: number, field: keyof TeacherClassConfig, value: any) => {
    const newConfigs = [...classConfigs];
    newConfigs[index] = { ...newConfigs[index], [field]: value };
    setClassConfigs(newConfigs);
  };

  // Remove class config
  const removeClassConfig = (index: number) => {
    setClassConfigs(classConfigs.filter((_, i) => i !== index));
  };

  // Add new class config
  const addClassConfig = (cls: ClassOption) => {
    // Check if already added
    if (classConfigs.some(c => c.classId === cls.id)) {
      alert('Lớp này đã được thêm');
      return;
    }
    
    setClassConfigs([...classConfigs, {
      staffId: selectedStaff?.id || '',
      classId: cls.id,
      className: cls.name,
      classCode: cls.code,
      ratePerUnit: 200000,
      unit: cls.sessionDuration === 60 ? 'Giờ' : 'Ca',
    }]);
    setShowAddClassModal(false);
  };

  // Save configuration
  const handleSave = async () => {
    if (!selectedStaff) {
      alert('Vui lòng chọn giáo viên');
      return;
    }

    setSaving(true);
    try {
      // Delete existing rules for this staff
      const existingRules = salaryRules.filter(r => r.staffId === selectedStaff.id);
      for (const rule of existingRules) {
        if (rule.id) {
          await deleteRule(rule.id);
        }
      }

      // Create new rules for each class
      for (const config of classConfigs) {
        await createRule({
          staffId: selectedStaff.id,
          staffName: selectedStaff.name,
          position: selectedStaff.position,
          classId: config.classId,
          className: config.className,
          classCode: config.classCode,
          salaryMethod: config.unit === 'Giờ' ? 'Theo giờ' : 'Theo ca',
          baseRate: fixedSalary,
          workMethod: 'Cố định',
          ratePerSession: config.ratePerUnit,
          allowance: allowance,
          kpiBonus: kpiBonus,
          note: note,
          effectiveDate: new Date().toISOString().split('T')[0],
          salaryCycle: salaryCycle,
        });
      }

      alert('Đã lưu cấu hình lương thành công!');
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Không thể lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setSelectedStaff(null);
    setClassConfigs([]);
    setFixedSalary(0);
    setAllowance(0);
    setKpiBonus(700);
    setNote('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2">CẤU HÌNH CƠ CẤU LƯƠNG GIÁO VIÊN</h1>
        <p className="text-center text-blue-100">Lương giáo viên được tính theo ca/giờ và phân theo lớp học khác nhau.</p>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        
        {/* Section 1: Chọn Giáo viên & Xác định Chu kỳ */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">1</span>
            Chọn Giáo Viên & Xác Định Chu Kỳ
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên Giáo Viên</label>
              <div className="relative">
                <select
                  value={selectedStaff?.id || ''}
                  onChange={(e) => handleStaffSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
                  disabled={loadingStaff}
                >
                  <option value="">{loadingStaff ? 'Đang tải...' : '-- Chọn giáo viên --'}</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
                <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phòng Ban</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={selectedStaff?.department || ''}
                  placeholder="Khoa Tiếng Anh"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                />
                <Building className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chu Kỳ Lương</label>
              <div className="relative">
                <input
                  type="text"
                  value={salaryCycle}
                  onChange={(e) => setSalaryCycle(e.target.value)}
                  placeholder="Tháng 12/2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú thêm</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vd: nhân viên có 1 oral vend..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Section 2: Cấu hình Lương theo Giờ Dạy */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">2</span>
            Cấu Hình Lương Cơ Bản theo Giờ Dạy
          </h2>

          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => selectedStaff && setShowAddClassModal(true)}
              disabled={!selectedStaff}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Plus size={16} />
              Lương Theo Ca/Giờ Dạy
            </button>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <div className={`relative w-12 h-6 rounded-full transition-colors ${enableHourlyRate ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <input
                  type="checkbox"
                  checked={enableHourlyRate}
                  onChange={(e) => setEnableHourlyRate(e.target.checked)}
                  className="sr-only"
                />
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${enableHourlyRate ? 'translate-x-7' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>

          {/* Class Rate Table */}
          {classConfigs.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Tên Lớp Học</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Mã Lớp</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Mức Lương Giờ/Ca (VNĐ)</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Đơn Vị Tính</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classConfigs.map((config, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{config.className}</td>
                      <td className="px-4 py-3 text-gray-600">{config.classCode}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={config.ratePerUnit}
                          onChange={(e) => updateClassConfig(idx, 'ratePerUnit', parseInt(e.target.value) || 0)}
                          className="w-32 px-3 py-1 border border-gray-300 rounded text-center mx-auto block"
                          step={10000}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={config.unit}
                          onChange={(e) => updateClassConfig(idx, 'unit', e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded"
                        >
                          <option value="Giờ">Giờ</option>
                          <option value="Ca">Ca</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeClassConfig(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
              <Clock size={48} className="mx-auto mb-2 opacity-50" />
              <p>{selectedStaff ? 'Chưa có lớp nào được cấu hình' : 'Vui lòng chọn giáo viên trước'}</p>
            </div>
          )}
        </div>

        {/* Section 3: Cấu hình Lương Cố Định & Phụ Cấp */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">3</span>
            Cấu Hình Lương Cố Định & Phụ Cấp
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">Lương Cố Định Hàng Tháng</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{fixedSalary > 0 ? formatCurrency(fixedSalary) : '0'}</span>
                <select
                  value={fixedSalary}
                  onChange={(e) => setFixedSalary(parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={0}>0</option>
                  <option value={500000}>500,000</option>
                  <option value={1000000}>1,000,000</option>
                  <option value={2000000}>2,000,000</option>
                  <option value={3000000}>3,000,000</option>
                  <option value={5000000}>5,000,000</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">Phụ Cấp Trách Nhiệm</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{allowance > 0 ? formatCurrency(allowance) : '0'}</span>
                <select
                  value={allowance}
                  onChange={(e) => setAllowance(parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={0}>0</option>
                  <option value={100000}>100,000</option>
                  <option value={200000}>200,000</option>
                  <option value={300000}>300,000</option>
                  <option value={500000}>500,000</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-700">Thưởng KPI/Đánh giá</span>
              <div className="flex items-center gap-2">
                <select
                  value={kpiBonus}
                  onChange={(e) => setKpiBonus(parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={0}>0 VNĐ</option>
                  <option value={500}>500 VNĐ</option>
                  <option value={700}>700 VNĐ</option>
                  <option value={1000}>1,000 VNĐ</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Tóm Tắt & Hành động */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 w-7 h-7 rounded-full flex items-center justify-center text-sm">4</span>
            Tóm Tắt & Hành động
          </h2>

          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-4">
            <span className="text-gray-700 font-medium">Tổng Ước Tính</span>
            <span className="text-2xl font-bold text-indigo-600">{formatCurrency(totalEstimate)}</span>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !selectedStaff}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              <Save size={18} />
              {saving ? 'Đang lưu...' : 'Lưu Cấu Hình'}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Hủy Bỏ
            </button>
          </div>
        </div>
      </div>

      {/* Existing Configurations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-orange-100/50 px-4 py-3 font-bold text-gray-800 border-b border-gray-200">
          Danh sách cấu hình lương đã lưu
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">No</th>
                <th className="px-4 py-3">Tên Giáo Viên</th>
                <th className="px-4 py-3">Vị Trí</th>
                <th className="px-4 py-3">Lớp</th>
                <th className="px-4 py-3 text-right">Mức Lương/Ca</th>
                <th className="px-4 py-3">Đơn Vị</th>
                <th className="px-4 py-3">Ngày Hiệu Lực</th>
                <th className="px-4 py-3 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rulesLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                      Đang tải...
                    </div>
                  </td>
                </tr>
              ) : salaryRules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    <DollarSign size={48} className="mx-auto mb-2 opacity-20" />
                    Chưa có cấu hình lương nào
                  </td>
                </tr>
              ) : salaryRules.map((rule, idx) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{rule.staffName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      rule.position === 'Giáo Viên Việt' ? 'bg-blue-100 text-blue-700' :
                      rule.position === 'Giáo Viên Nước Ngoài' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {rule.position}
                    </span>
                  </td>
                  <td className="px-4 py-3">{rule.className || '-'}</td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-600">
                    {formatCurrency(rule.ratePerSession)}
                  </td>
                  <td className="px-4 py-3">{rule.salaryMethod === 'Theo giờ' ? 'Giờ' : 'Ca'}</td>
                  <td className="px-4 py-3">{rule.effectiveDate}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => rule.id && deleteRule(rule.id)}
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
      </div>

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Thêm lớp dạy</h3>
              <button onClick={() => setShowAddClassModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              {loadingClasses ? (
                <div className="text-center py-8 text-gray-500">Đang tải...</div>
              ) : staffClasses.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Giáo viên này chưa được phân công lớp nào
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {staffClasses.filter(cls => !classConfigs.some(c => c.classId === cls.id)).map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => addClassConfig(cls)}
                      className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{cls.name}</div>
                      <div className="text-sm text-gray-500">Mã lớp: {cls.code}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
