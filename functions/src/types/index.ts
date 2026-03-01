/**
 * TypeScript types for Cloud Functions
 */

export interface TrainingHistoryEntry {
  id: string;
  date: string;
  type: 'schedule_change' | 'teacher_change' | 'room_change' | 'status_change' | 'other';
  description: string;
  oldValue?: string;
  newValue?: string;
  changedBy?: string;
  note?: string;
  effectiveDate?: string; // Ngày hiệu lực (YYYY-MM-DD)
}

export interface ClassData {
  id?: string;
  name: string;
  status: 'Chờ mở' | 'Đang học' | 'Tạm dừng' | 'Kết thúc';
  curriculum?: string;
  ageGroup?: string;
  progress?: string;
  totalSessions?: number;
  teacher?: string;
  teacherId?: string;
  teacherDuration?: number;
  teacherStartTime?: string;
  teacherEndTime?: string;
  assistant?: string;
  assistantId?: string;
  assistantDuration?: number;
  assistantStartTime?: string;
  assistantEndTime?: string;
  foreignTeacher?: string;
  foreignTeacherDuration?: number;
  foreignTeacherStartTime?: string;
  foreignTeacherEndTime?: string;
  schedule?: string;
  room?: string;
  branch?: string;
  startDate?: string;
  endDate?: string;
  studentsCount?: number;
  trainingHistory?: TrainingHistoryEntry[];
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
  // Transient fields - CF reads then deletes after cascade
  teacherChangeEffectiveDate?: string;
  teacherChangeOldTeacher?: string;
  teacherChangeOldTeacherId?: string;
  assistantChangeEffectiveDate?: string;
  assistantChangeOldAssistant?: string;
  assistantChangeOldAssistantId?: string;
  foreignTeacherChangeEffectiveDate?: string;
  foreignTeacherChangeOldTeacher?: string;
  foreignTeacherChangeOldTeacherId?: string;
}

export interface StudentData {
  id?: string;
  code?: string;
  fullName: string;
  dob?: string;
  gender?: 'Nam' | 'Nữ';
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  status: string;
  class?: string;
  classId?: string;
  className?: string;
  enrollmentDate?: string;
  totalSessions?: number;
  registeredSessions?: number;
  attendedSessions?: number;
  // Nợ xấu
  badDebt?: boolean;
  badDebtSessions?: number;
  badDebtAmount?: number;
  badDebtDate?: string;
  badDebtNote?: string;
}

export interface SessionData {
  id?: string;
  classId: string;
  className: string;
  sessionNumber: number;
  date: string;
  dayOfWeek: string;
  time?: string;
  room?: string;
  teacherId?: string;
  teacherName?: string;
  status: 'Chưa học' | 'Đã học' | 'Nghỉ' | 'Bù';
  attendanceId?: string;
  holidayId?: string;
  holidayName?: string;
  createdAt?: string;
}

export interface AttendanceData {
  id?: string;
  classId: string;
  className?: string;
  sessionId?: string;
  date: string;
  students: AttendanceStudent[];
  createdAt?: string;
}

export interface AttendanceStudent {
  studentId: string;
  studentName: string;
  status: 'Có mặt' | 'Vắng có phép' | 'Vắng không phép' | 'Đi muộn';
  note?: string;
}

export interface ScheduleInfo {
  time: string | null;
  days: number[]; // 0 = Sunday, 1 = Monday, etc.
}

export interface CascadeUpdate {
  collection: string;
  field: string;
  queryField: string;
  queryValue: string;
  newValue: any;
}
