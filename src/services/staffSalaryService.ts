import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getPositionConfig } from '../config/salaryConfig';

export interface StaffSalaryRecord {
  id?: string;
  staffId: string;
  staffName: string;
  position: string;
  month: number;
  year: number;
  baseSalary: number;
  positionBonus: number;      // Lead/Management bonus based on multiplier
  kpiBonus: number;           // KPI achievement bonus
  workDays: number;
  commission: number;
  commissionRate?: number;    // For Sale team (percentage)
  commissionBase?: number;    // Revenue base for commission calculation
  allowance: number;
  deduction: number;
  totalSalary: number;
  note?: string;
}

export interface StaffAttendanceLog {
  id?: string;
  staffId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'Đúng giờ' | 'Đi muộn' | 'Về sớm' | 'Nghỉ phép' | 'Nghỉ không phép';
  note?: string;
}

const SALARY_COLLECTION = 'staffSalaries';
const ATTENDANCE_COLLECTION = 'staffAttendance';
const STAFF_COLLECTION = 'staff';

// Get staff salaries by month/year - JOIN với staff collection
export const getStaffSalaries = async (month: number, year: number): Promise<StaffSalaryRecord[]> => {
  // 1. Lấy danh sách nhân viên văn phòng từ staff collection (source of truth)
  // Bao gồm: Văn phòng, Điều hành, Team Leads, và các vị trí hành chính
  const staffSnapshot = await getDocs(collection(db, STAFF_COLLECTION));
  const officeStaff = staffSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((s: any) => {
      // Exclude teachers/teaching assistants - họ có báo cáo riêng (GV/TG)
      const teacherPositions = [
        'Giáo viên Việt', 'Giáo Viên Việt', 'Giáo viên Nước ngoài', 'Giáo Viên Nước Ngoài',
        'Trợ giảng', 'Trợ Giảng'
      ];
      if (teacherPositions.includes(s.position)) return false;

      // Include: Văn phòng, Điều hành departments
      if (s.department === 'Văn phòng' || s.department === 'Điều hành') return true;

      // Include: Team Leads (CSKH, Sale, CM)
      const leadPositions = [
        'Trưởng nhóm Chuyên môn', 'Trưởng Nhóm Chuyên Môn', 'Trưởng nhóm CM',
        'Trưởng nhóm CSKH', 'Trưởng Nhóm CSKH',
        'Trưởng nhóm Sale', 'Trưởng Nhóm Sale',
        'Quản lý', 'Quản Lý'
      ];
      if (leadPositions.includes(s.position)) return true;

      // Include: Other office positions
      const officePositions = [
        'Kế toán', 'Kế Toán',
        'Lễ tân', 'Lễ Tân',
        'Tư vấn viên', 'Tư Vấn Viên',
        'Nhân viên CSKH', 'Nhân Viên CSKH',
        'Nhân viên Sale', 'Nhân Viên Sale',
        'Nhân viên Chuyên môn', 'Nhân Viên Chuyên Môn'
      ];
      if (officePositions.includes(s.position)) return true;

      return false;
    });

  // 2. Lấy dữ liệu lương đã có trong tháng này
  const salaryQuery = query(
    collection(db, SALARY_COLLECTION),
    where('month', '==', month),
    where('year', '==', year)
  );
  const salarySnapshot = await getDocs(salaryQuery);
  const existingSalaries = salarySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 3. Merge: Với mỗi nhân viên, tìm salary record hoặc tạo default
  const result: StaffSalaryRecord[] = officeStaff.map((staff: any) => {
    const existingSalary = existingSalaries.find(
      (s: any) => s.staffId === staff.id || s.staffName === staff.name
    );

    if (existingSalary) {
      // Ensure existing records have new fields (backward compatibility)
      const record = existingSalary as StaffSalaryRecord;
      return {
        ...record,
        positionBonus: record.positionBonus ?? 0,
        kpiBonus: record.kpiBonus ?? 0,
      };
    }

    // Get position-based salary configuration
    const posConfig = getPositionConfig(staff.position || 'Nhân viên');
    const baseSalary = staff.salary || posConfig.defaultBaseSalary || 0;
    const positionBonus = baseSalary * (posConfig.baseMultiplier - 1);

    // Default salary record with position-based calculations
    return {
      staffId: staff.id,
      staffName: staff.name || staff.staffName || 'N/A',
      position: staff.position || 'Nhân viên',
      month,
      year,
      baseSalary,
      positionBonus,
      kpiBonus: 0, // Default, can be updated by HR
      workDays: 0,
      commission: 0,
      allowance: 0,
      deduction: 0,
      totalSalary: baseSalary + positionBonus,
    };
  });

  return result;
};

// Get single staff salary
export const getStaffSalaryById = async (id: string): Promise<StaffSalaryRecord | null> => {
  const docRef = doc(db, SALARY_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as StaffSalaryRecord;
  }
  return null;
};

// Create staff salary record
export const createStaffSalary = async (data: Omit<StaffSalaryRecord, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, SALARY_COLLECTION), data);
  return docRef.id;
};

// Update staff salary record
export const updateStaffSalary = async (id: string, data: Partial<StaffSalaryRecord>): Promise<void> => {
  const docRef = doc(db, SALARY_COLLECTION, id);
  await updateDoc(docRef, data);
};

// Delete staff salary record
export const deleteStaffSalary = async (id: string): Promise<void> => {
  const docRef = doc(db, SALARY_COLLECTION, id);
  await deleteDoc(docRef);
};

// Get attendance logs for a staff member
export const getStaffAttendance = async (staffId: string, month?: number, year?: number): Promise<StaffAttendanceLog[]> => {
  let q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('staffId', '==', staffId),
    orderBy('date', 'desc')
  );
  
  const snapshot = await getDocs(q);
  let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffAttendanceLog));
  
  // Filter by month/year if provided
  if (month && year) {
    logs = logs.filter(log => {
      const [d, m, y] = log.date.split('/').map(Number);
      return m === month && y === year;
    });
  }
  
  return logs;
};

// Create attendance log
export const createAttendanceLog = async (data: Omit<StaffAttendanceLog, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), data);
  return docRef.id;
};

// Update attendance log
export const updateAttendanceLog = async (id: string, data: Partial<StaffAttendanceLog>): Promise<void> => {
  const docRef = doc(db, ATTENDANCE_COLLECTION, id);
  await updateDoc(docRef, data);
};

// Delete attendance log
export const deleteAttendanceLog = async (id: string): Promise<void> => {
  const docRef = doc(db, ATTENDANCE_COLLECTION, id);
  await deleteDoc(docRef);
};
