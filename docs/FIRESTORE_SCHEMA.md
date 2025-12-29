# Firestore Database Schema - EduManager Pro

## Collections Structure

### 1. **students** (Collection)
```typescript
{
  id: string (auto-generated)
  code: string (unique, indexed) // HV23001
  fullName: string (indexed)
  dob: Timestamp
  gender: 'Nam' | 'Nữ'
  phone: string (indexed)
  parentName: string
  parentPhone: string
  status: 'Đang học' | 'Bảo lưu' | 'Đã nghỉ' | 'Học thử'
  currentClassId: string | null (reference to classes)
  currentClassName: string | null
  enrollmentHistory: [{
    classId: string
    className: string
    enrolledDate: Timestamp
    status: string
    sessions: number
    amount: number
  }]
  careHistory: [{
    id: string
    date: Timestamp
    type: 'Bồi bài' | 'Phản hồi' | 'Tư vấn'
    content: string
    staffId: string
    staffName: string
    createdAt: Timestamp
  }]
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string (userId)
}
```

### 2. **classes** (Collection)
```typescript
{
  id: string (auto-generated)
  name: string (unique, indexed)
  status: 'Đang học' | 'Kết thúc' | 'Tạm dừng' | 'Chờ mở'
  curriculum: string
  ageGroup: string
  progress: string // "15/24 Buổi"
  teacherId: string (reference to staff)
  teacherName: string
  assistantId?: string (reference to staff)
  assistantName?: string
  foreignTeacherId?: string (reference to staff)
  foreignTeacherName?: string
  studentsCount: number
  startDate: Timestamp
  endDate: Timestamp
  schedule: [{
    dayOfWeek: string
    time: string
    room: string
  }]
  history: [{
    id: string
    date: Timestamp
    type: 'Tạo lớp' | 'Thêm GV' | 'Thêm TG' | 'Thêm GVNN' | 'Cập nhật tiến độ' | 'Thay đổi trạng thái'
    description: string
    staffId: string
    staffName: string
  }]
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}
```

### 3. **staff** (Collection)
```typescript
{
  id: string (auto-generated)
  uid: string (Firebase Auth UID, indexed)
  code: string (unique, indexed)
  name: string (indexed)
  role: 'Giáo viên' | 'Trợ giảng' | 'Nhân viên' | 'Quản lý' | 'Quản trị viên'
  department: string
  position: string
  phone: string (indexed)
  email: string (unique, indexed)
  status: 'Active' | 'Inactive'
  dob?: Timestamp
  startDate?: Timestamp
  avatar?: string (URL)
  permissions: {
    canManageStudents: boolean
    canManageClasses: boolean
    canManageStaff: boolean
    canManageFinance: boolean
    canViewReports: boolean
  }
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 4. **attendance** (Collection)
```typescript
{
  id: string (auto-generated)
  classId: string (reference to classes, indexed)
  className: string
  date: Timestamp (indexed)
  teacherId: string
  teacherName: string
  records: [{
    studentId: string
    studentName: string
    status: 'Có mặt' | 'Vắng' | 'Có phép' | 'Muộn'
    note?: string
  }]
  totalStudents: number
  present: number
  absent: number
  status: 'Đã điểm danh' | 'Chưa điểm danh'
  createdAt: Timestamp
  createdBy: string
}
```

### 5. **tutoring** (Collection) - Lịch Bồi Bài
```typescript
{
  id: string (auto-generated)
  studentId: string (reference to students, indexed)
  studentName: string
  classId: string (reference to classes)
  className: string
  type: 'Nghỉ học' | 'Học yếu'
  status: 'Chưa bồi' | 'Đã hẹn' | 'Đã bồi' | 'Nghỉ tính phí' | 'Nghỉ bảo lưu' | 'Hủy'

  // Link to original absence
  absentDate?: string (YYYY-MM-DD format)
  studentAttendanceId?: string (reference to studentAttendance)

  // Scheduling
  scheduledDate?: string (YYYY-MM-DD format)
  scheduledTime?: string (HH:mm format)
  tutor?: string (staffId)
  tutorName?: string

  // Completion
  completedAt?: string (ISO timestamp)
  completedBy?: string (staffId who completed)

  // Charged absence reason (required for 'Nghỉ tính phí')
  chargedReason?: string

  // Soft delete
  deletedAt?: string | null (ISO timestamp, null = not deleted)
  deletedBy?: string | null (staffId)

  // Audit trail
  statusHistory?: Array<{
    status: TutoringStatus
    changedAt: string (ISO timestamp)
    changedBy: string (staffId or 'system')
    reason?: string
  }>

  note?: string
  createdAt: string (ISO timestamp)
  updatedAt: string (ISO timestamp)
}
```

**Status Transitions:**
- `Chưa bồi` → `Đã hẹn` (schedule)
- `Đã hẹn` → `Đã bồi` (complete, updates studentAttendance)
- `Đã hẹn` → `Nghỉ tính phí` (requires reason, no attendance update)
- `Đã hẹn` → `Nghỉ bảo lưu` (updates studentAttendance, extends course)
- Terminal states → `Đã hẹn` (undo, Admin/Manager only)

### 6. **holidays** (Collection)
```typescript
{
  id: string (auto-generated)
  name: string
  startDate: Timestamp (indexed)
  endDate: Timestamp (indexed)
  status: 'Đã áp dụng' | 'Chưa áp dụng'
  affectedClasses: string[] // Array of classIds
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}
```

### 7. **products** (Collection)
```typescript
{
  id: string (auto-generated)
  name: string (indexed)
  price: number
  category: 'Sách' | 'Đồng phục' | 'Học liệu' | 'Khác'
  stock: number
  status: 'Kích hoạt' | 'Tạm khoá'
  description?: string
  imageUrl?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 8. **rooms** (Collection)
```typescript
{
  id: string (auto-generated)
  name: string (unique, indexed)
  type: 'Văn phòng' | 'Phòng học' | 'Phòng chức năng'
  capacity?: number
  status: 'Hoạt động' | 'Bảo trì'
  equipment?: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 9. **contracts** (Collection)
```typescript
{
  id: string (auto-generated)
  contractCode: string (unique, indexed)
  studentId: string (reference to students, indexed)
  studentName: string
  type: 'Hợp đồng mới' | 'Hợp đồng tái phí' | 'Ghi danh thủ công'
  items: [{
    type: 'course' | 'product'
    id: string
    name: string
    quantity: number
    unitPrice: number
    discount: number
    totalPrice: number
  }]
  originalAmount: number
  discount: number
  finalAmount: number
  paymentMethod: 'Toàn bộ' | 'Trả góp'
  paymentRecords: [{
    date: Timestamp
    amount: number
    method: string
    note?: string
  }]
  paidAmount: number
  remainingAmount: number
  status: 'Đã thanh toán' | 'Nợ' | 'Đã hủy'
  note?: string
  createdAt: Timestamp
  createdBy: string
  createdByName: string
}
```

### 10. **salaryRules** (Collection)
```typescript
{
  id: string (auto-generated)
  staffId: string (reference to staff, indexed)
  staffName: string
  position: 'Giáo Viên Việt' | 'Giáo Viên Nước Ngoài' | 'Trợ Giảng'
  classId: string (reference to classes)
  className: string
  salaryMethod: 'Theo ca' | 'Theo giờ' | 'Nhận xét' | 'Dạy chính'
  baseRate: number
  workMethod: 'Cố định' | 'Theo sĩ số'
  avgStudents?: number
  ratePerSession: number
  effectiveDate: Timestamp (indexed)
  endDate?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 11. **workSessions** (Collection)
```typescript
{
  id: string (auto-generated)
  staffId: string (reference to staff, indexed)
  staffName: string
  position: string
  date: Timestamp (indexed)
  timeStart: string
  timeEnd: string
  classId: string
  className: string
  type: 'Dạy chính' | 'Nhận xét' | 'Trợ giảng' | 'Bồi bài'
  studentCount?: number
  salary: number
  status: 'Đã xác nhận' | 'Chờ xác nhận'
  confirmedBy?: string
  confirmedAt?: Timestamp
  createdAt: Timestamp
}
```

### 12. **parents** (Collection)
```typescript
{
  id: string (auto-generated)
  fatherName: string (indexed)
  fatherPhone: string (unique, indexed)
  motherName?: string
  motherPhone?: string
  address?: string
  email?: string
  children: [{
    studentId: string (reference to students)
    studentName: string
    dob: Timestamp
    currentClass: string
    status: string
  }]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 13. **feedback** (Collection)
```typescript
{
  id: string (auto-generated)
  type: 'Call' | 'Form'
  date: Timestamp (indexed)
  studentId: string (reference to students, indexed)
  studentName: string
  classId: string
  className: string
  teacherId: string
  teacherName: string
  
  // For Call type
  callerId?: string
  callerName?: string
  
  // Scores
  curriculumScore?: number
  careScore?: number
  facilitiesScore?: number
  averageScore?: number
  
  content?: string
  status: 'Cần gọi' | 'Đã gọi' | 'Hoàn thành'
  
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}
```

### 14. **campaigns** (Collection) - Marketing/Sales campaigns
```typescript
{
  id: string (auto-generated)
  name: string (indexed)
  type: 'Sale' | 'Marketing'
  startDate: Timestamp
  endDate: Timestamp
  budget?: number
  status: 'Đang chạy' | 'Kết thúc' | 'Tạm dừng'
  targetAudience: string
  description?: string
  leads: [{
    leadId: string
    name: string
    phone: string
    status: string
    source: string
    convertedDate?: Timestamp
  }]
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}
```

## Indexes (Firestore Composite Indexes)

1. **students**: `status` (asc) + `createdAt` (desc)
2. **students**: `currentClassName` (asc) + `status` (asc)
3. **classes**: `status` (asc) + `startDate` (desc)
4. **attendance**: `classId` (asc) + `date` (desc)
5. **tutoring**: `status` (asc) + `createdAt` (desc)
6. **studentAttendance**: `studentId` (asc) + `classId` (asc) + `date` (asc)
7. **contracts**: `studentId` (asc) + `createdAt` (desc)
8. **workSessions**: `staffId` (asc) + `date` (desc)
9. **feedback**: `studentId` (asc) + `date` (desc)

## Security Rules (firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.role in ['Quản trị viên', 'Quản lý'];
    }
    
    function isStaff() {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/staff/$(request.auth.uid));
    }
    
    // Students - All staff can read, only admin can write
    match /students/{studentId} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }
    
    // Classes - All staff can read, only admin can write
    match /classes/{classId} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }
    
    // Staff - Only admin can access
    match /staff/{staffId} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }
    
    // Attendance - Teachers and admin can write
    match /attendance/{attendanceId} {
      allow read: if isStaff();
      allow write: if isStaff();
    }
    
    // Everything else - Staff can read, admin can write
    match /{document=**} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }
  }
}
```

## Notes

1. **Timestamps**: Sử dụng Firebase Timestamp thay vì string ISO dates
2. **References**: Lưu cả ID và name để dễ query và hiển thị
3. **Indexes**: Cần tạo composite indexes trong Firebase Console
4. **Subcollections**: Có thể tách `careHistory`, `enrollmentHistory` thành subcollections nếu data lớn
5. **Real-time listeners**: Dùng `onSnapshot` cho dashboard và danh sách cần real-time update
