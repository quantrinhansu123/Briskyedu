/**
 * Excel Import/Export Utilities
 * Sử dụng thư viện xlsx để xử lý file Excel
 */

import * as XLSX from 'xlsx';

// ============ EXPORT FUNCTIONS ============

/**
 * Export data to Excel file
 */
export const exportToExcel = (
  data: Record<string, any>[],
  fileName: string,
  sheetName: string = 'Data'
) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Auto-width columns
  const maxWidth = 50;
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.min(maxWidth, Math.max(key.length, ...data.map(row => String(row[key] || '').length)))
  }));
  worksheet['!cols'] = colWidths;
  
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * Export template Excel (empty with headers)
 */
export const exportTemplate = (
  headers: { key: string; label: string; example?: string }[],
  fileName: string,
  sheetName: string = 'Template'
) => {
  // Create header row
  const headerRow: Record<string, string> = {};
  headers.forEach(h => {
    headerRow[h.label] = h.example || '';
  });
  
  const worksheet = XLSX.utils.json_to_sheet([headerRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Set column widths
  worksheet['!cols'] = headers.map(h => ({ wch: Math.max(h.label.length, 20) }));
  
  XLSX.writeFile(workbook, `${fileName}_template.xlsx`);
};

// ============ IMPORT FUNCTIONS ============

/**
 * Read Excel file and return JSON data
 */
export const readExcelFile = (file: File): Promise<Record<string, any>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData as Record<string, any>[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

/**
 * Map Excel columns to database fields
 */
export const mapExcelToFields = (
  excelData: Record<string, any>[],
  mapping: { excelColumn: string; dbField: string; transform?: (val: any) => any }[]
): Record<string, any>[] => {
  return excelData.map(row => {
    const mapped: Record<string, any> = {};
    mapping.forEach(({ excelColumn, dbField, transform }) => {
      let value = row[excelColumn];
      if (transform && value !== undefined) {
        value = transform(value);
      }
      if (value !== undefined && value !== '') {
        mapped[dbField] = value;
      }
    });
    return mapped;
  });
};

// ============ FIELD MAPPINGS FOR EACH MODULE ============

// Student fields
export const STUDENT_FIELDS = [
  { key: 'fullName', label: 'Họ và tên', example: 'Nguyễn Văn A', required: true },
  { key: 'code', label: 'Mã học viên', example: 'HV001' },
  { key: 'dob', label: 'Ngày sinh (dd/mm/yyyy)', example: '15/06/2015' },
  { key: 'gender', label: 'Giới tính', example: 'Nam' },
  { key: 'phone', label: 'SĐT Phụ huynh', example: '0901234567' },
  { key: 'email', label: 'Email', example: 'email@example.com' },
  { key: 'parentName', label: 'Tên phụ huynh', example: 'Nguyễn Văn B' },
  { key: 'parentPhone2', label: 'SĐT PH 2', example: '0901234568' },
  { key: 'address', label: 'Địa chỉ', example: '123 Đường ABC, Quận 1' },
  { key: 'class', label: 'Lớp học', example: 'Beginner A' },
  { key: 'registeredSessions', label: 'Số buổi đăng ký', example: '24' },
  { key: 'remainingSessions', label: 'Số buổi còn lại', example: '10 (âm nếu nợ: -2)' },
  { key: 'status', label: 'Trạng thái', example: 'Đang học' },
  { key: 'note', label: 'Ghi chú', example: '' },
];

export const STUDENT_MAPPING = [
  { excelColumn: 'Họ và tên', dbField: 'fullName' },
  { excelColumn: 'Mã học viên', dbField: 'code' },
  { excelColumn: 'Ngày sinh (dd/mm/yyyy)', dbField: 'dob', transform: parseVNDate },
  { excelColumn: 'Giới tính', dbField: 'gender' },
  { excelColumn: 'SĐT Phụ huynh', dbField: 'phone', transform: String },
  { excelColumn: 'Email', dbField: 'email' },
  { excelColumn: 'Tên phụ huynh', dbField: 'parentName' },
  { excelColumn: 'SĐT PH 2', dbField: 'parentPhone2', transform: String },
  { excelColumn: 'Địa chỉ', dbField: 'address' },
  { excelColumn: 'Lớp học', dbField: 'class' },
  { excelColumn: 'Số buổi đăng ký', dbField: 'registeredSessions', transform: Number },
  { excelColumn: 'Số buổi còn lại', dbField: 'remainingSessions', transform: Number },
  { excelColumn: 'Trạng thái', dbField: 'status' },
  { excelColumn: 'Ghi chú', dbField: 'note' },
];

// Staff fields
export const STAFF_FIELDS = [
  { key: 'name', label: 'Họ và tên', example: 'Trần Thị B', required: true },
  { key: 'code', label: 'Mã nhân viên', example: 'NV001' },
  { key: 'position', label: 'Vị trí', example: 'Giáo viên' },
  { key: 'department', label: 'Phòng ban', example: 'Giảng dạy' },
  { key: 'phone', label: 'Số điện thoại', example: '0901234567' },
  { key: 'email', label: 'Email', example: 'email@example.com' },
  { key: 'dob', label: 'Ngày sinh (dd/mm/yyyy)', example: '15/06/1990' },
  { key: 'address', label: 'Địa chỉ', example: '123 Đường ABC' },
  { key: 'startDate', label: 'Ngày vào làm (dd/mm/yyyy)', example: '01/01/2024' },
  { key: 'status', label: 'Trạng thái', example: 'Đang làm việc' },
];

export const STAFF_MAPPING = [
  { excelColumn: 'Họ và tên', dbField: 'name' },
  { excelColumn: 'Mã nhân viên', dbField: 'code' },
  { excelColumn: 'Vị trí', dbField: 'position' },
  { excelColumn: 'Phòng ban', dbField: 'department' },
  { excelColumn: 'Số điện thoại', dbField: 'phone', transform: String },
  { excelColumn: 'Email', dbField: 'email' },
  { excelColumn: 'Ngày sinh (dd/mm/yyyy)', dbField: 'dob', transform: parseVNDate },
  { excelColumn: 'Địa chỉ', dbField: 'address' },
  { excelColumn: 'Ngày vào làm (dd/mm/yyyy)', dbField: 'startDate', transform: parseVNDate },
  { excelColumn: 'Trạng thái', dbField: 'status' },
];

// Class fields
export const CLASS_FIELDS = [
  { key: 'name', label: 'Tên lớp', example: 'Beginner A', required: true },
  { key: 'code', label: 'Mã lớp', example: 'BEG-A' },
  { key: 'teacher', label: 'Giáo viên VN', example: 'Nguyễn Văn A' },
  { key: 'foreignTeacher', label: 'Giáo viên NN', example: 'John Smith' },
  { key: 'assistant', label: 'Trợ giảng', example: 'Trần Thị B' },
  { key: 'room', label: 'Phòng học', example: 'Phòng 101' },
  { key: 'schedule', label: 'Lịch học', example: 'T2-T4-T6 17:00' },
  { key: 'maxStudents', label: 'Sĩ số tối đa', example: '15' },
  { key: 'status', label: 'Trạng thái', example: 'Đang hoạt động' },
];

export const CLASS_MAPPING = [
  { excelColumn: 'Tên lớp', dbField: 'name' },
  { excelColumn: 'Mã lớp', dbField: 'code' },
  { excelColumn: 'Giáo viên VN', dbField: 'teacher' },
  { excelColumn: 'Giáo viên NN', dbField: 'foreignTeacher' },
  { excelColumn: 'Trợ giảng', dbField: 'assistant' },
  { excelColumn: 'Phòng học', dbField: 'room' },
  { excelColumn: 'Lịch học', dbField: 'schedule' },
  { excelColumn: 'Sĩ số tối đa', dbField: 'maxStudents', transform: Number },
  { excelColumn: 'Trạng thái', dbField: 'status' },
];

// Curriculum/Course fields
export const CURRICULUM_FIELDS = [
  { key: 'name', label: 'Tên khóa học', example: 'Tiếng Anh Mầm Non', required: true },
  { key: 'level', label: 'Chương trình', example: 'Tiếng Anh Trẻ Em' },
  { key: 'ageRange', label: 'Độ tuổi', example: '4-6 tuổi' },
  { key: 'totalSessions', label: 'Tổng số buổi', example: '24' },
  { key: 'sessionDuration', label: 'Phút/buổi', example: '90' },
  { key: 'tuitionFee', label: 'Học phí', example: '3600000' },
  { key: 'status', label: 'Trạng thái', example: 'Active' },
];

export const CURRICULUM_MAPPING = [
  { excelColumn: 'Tên khóa học', dbField: 'name' },
  { excelColumn: 'Chương trình', dbField: 'level' },
  { excelColumn: 'Độ tuổi', dbField: 'ageRange' },
  { excelColumn: 'Tổng số buổi', dbField: 'totalSessions', transform: Number },
  { excelColumn: 'Phút/buổi', dbField: 'sessionDuration', transform: Number },
  { excelColumn: 'Học phí', dbField: 'tuitionFee', transform: parseNumber },
  { excelColumn: 'Trạng thái', dbField: 'status' },
];

// ============ HELPER FUNCTIONS ============

/**
 * Parse Vietnamese date format (dd/mm/yyyy) to ISO string
 */
function parseVNDate(value: any): string {
  if (!value) return '';
  const str = String(value);
  
  // Already ISO format
  if (str.includes('-') && str.length === 10) return str;
  
  // Excel serial date number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // dd/mm/yyyy format
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  return str;
}

/**
 * Parse number from string (remove dots/commas)
 */
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  const str = String(value).replace(/\./g, '').replace(/,/g, '');
  return parseInt(str) || 0;
}

/**
 * Format date to Vietnamese format for export
 */
export const formatDateVN = (isoDate: string): string => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
};

/**
 * Prepare student data for export
 */
export const prepareStudentExport = (students: any[]): Record<string, any>[] => {
  return students.map(s => ({
    'Họ và tên': s.fullName || '',
    'Mã học viên': s.code || '',
    'Ngày sinh (dd/mm/yyyy)': formatDateVN(s.dob),
    'Giới tính': s.gender || '',
    'SĐT Phụ huynh': s.phone || '',
    'Email': s.email || '',
    'Tên phụ huynh': s.parentName || '',
    'SĐT PH 2': s.parentPhone2 || '',
    'Địa chỉ': s.address || '',
    'Lớp học': s.class || '',
    'Số buổi đăng ký': s.registeredSessions || 0,
    'Số buổi còn lại': s.remainingSessions ?? ((s.registeredSessions || 0) - (s.attendedSessions || 0)),
    'Trạng thái': s.status || '',
    'Ghi chú': s.note || '',
  }));
};

/**
 * Prepare staff data for export
 */
export const prepareStaffExport = (staffList: any[]): Record<string, any>[] => {
  return staffList.map(s => ({
    'Họ và tên': s.name || '',
    'Mã nhân viên': s.code || '',
    'Vị trí': s.position || '',
    'Phòng ban': s.department || '',
    'Số điện thoại': s.phone || '',
    'Email': s.email || '',
    'Ngày sinh (dd/mm/yyyy)': formatDateVN(s.dob),
    'Địa chỉ': s.address || '',
    'Ngày vào làm (dd/mm/yyyy)': formatDateVN(s.startDate),
    'Trạng thái': s.status || '',
  }));
};

/**
 * Prepare class data for export
 */
export const prepareClassExport = (classes: any[]): Record<string, any>[] => {
  return classes.map(c => ({
    'Tên lớp': c.name || '',
    'Mã lớp': c.code || '',
    'Giáo viên VN': c.teacher || '',
    'Giáo viên NN': c.foreignTeacher || '',
    'Trợ giảng': c.assistant || '',
    'Phòng học': c.room || '',
    'Lịch học': c.schedule || '',
    'Sĩ số tối đa': c.maxStudents || '',
    'Trạng thái': c.status || '',
  }));
};

/**
 * Prepare curriculum data for export
 */
export const prepareCurriculumExport = (curriculums: any[]): Record<string, any>[] => {
  return curriculums.map(c => ({
    'Tên khóa học': c.name || '',
    'Chương trình': c.level || '',
    'Độ tuổi': c.ageRange || '',
    'Tổng số buổi': c.totalSessions || '',
    'Phút/buổi': c.sessionDuration || '',
    'Học phí': c.tuitionFee || '',
    'Trạng thái': c.status || '',
  }));
};
