# Cấu trúc Database - Bảng Điểm Danh

## 1. Collection: `attendance` (Bảng điểm danh tổng hợp)

### Cấu trúc Document:

```typescript
interface AttendanceRecord {
  id: string;                    // Document ID (auto-generated)
  
  // Thông tin lớp học
  classId: string;               // ID của lớp học
  className: string;             // Tên lớp học
  
  // Thông tin buổi học
  date: string;                  // Ngày điểm danh (format: "YYYY-MM-DD")
  sessionNumber?: number | null; // Số thứ tự buổi học
  sessionId?: string | null;    // ID của buổi học (từ collection classSessions)
  
  // Thống kê
  totalStudents: number;         // Tổng số học sinh trong lớp
  present: number;               // Số học sinh có mặt (Đúng giờ + Trễ giờ)
  absent: number;                // Số học sinh vắng
  reserved: number;              // Số học sinh bảo lưu
  tutored: number;               // Số học sinh đã bồi
  
  // Trạng thái
  status: 'Đã điểm danh' | 'Chưa điểm danh' | 'LỊCH NGHỈ CHUNG';
  
  // Thông tin nghỉ lễ (nếu có)
  holidayId?: string;           // ID của ngày nghỉ lễ
  holidayName?: string;          // Tên ngày nghỉ lễ
  
  // Metadata
  createdBy?: string;            // UID của người tạo
  createdAt?: string;            // Timestamp (ISO string)
  updatedAt?: string;            // Timestamp (ISO string)
}
```

### Ví dụ Document:

```json
{
  "id": "abc123",
  "classId": "2Fugewarw1U5AsV6Zxm3",
  "className": "Lớp Tiếng Anh A1",
  "date": "2025-03-11",
  "sessionNumber": 15,
  "sessionId": "F1oO7nnU9bQmkVKXYT9i",
  "totalStudents": 20,
  "present": 18,
  "absent": 2,
  "reserved": 0,
  "tutored": 0,
  "status": "Đã điểm danh",
  "createdBy": "user123",
  "createdAt": "2025-03-11T08:30:00.000Z",
  "updatedAt": "2025-03-11T08:30:00.000Z"
}
```

---

## 2. Collection: `studentAttendance` (Bảng điểm danh chi tiết từng học sinh)

### Cấu trúc Document:

```typescript
interface StudentAttendance {
  id?: string;                  // Document ID (auto-generated)
  
  // Liên kết với bảng attendance
  attendanceId: string;         // ID của document trong collection attendance
  
  // Thông tin học sinh
  studentId: string;            // ID của học sinh
  studentName: string;          // Tên học sinh
  studentCode: string;           // Mã học sinh
  
  // Thông tin lớp học
  classId?: string;             // ID của lớp học
  className?: string;           // Tên lớp học
  
  // Thông tin buổi học
  date?: string;                // Ngày điểm danh (format: "YYYY-MM-DD")
  sessionNumber?: number;       // Số thứ tự buổi học
  sessionId?: string;           // ID của buổi học (QUAN TRỌNG: có sessionId = buổi chính thức, không có = học bù)
  
  // Trạng thái điểm danh
  status: AttendanceStatus;     // 'Đúng giờ' | 'Trễ giờ' | 'Vắng' | 'Bảo lưu' | 'Đã bồi' | ''
  
  // Ghi chú
  note?: string;                // Ghi chú của giáo viên
  
  // Thông tin điểm số buổi học
  homeworkCompletion?: number;   // % BTVN hoàn thành (0-100)
  testName?: string;            // Tên bài kiểm tra (nếu có)
  score?: number;               // Điểm số (0-10)
  bonusPoints?: number;         // Điểm thưởng
  
  // Thông tin đúng giờ / trễ giờ
  punctuality?: 'onTime' | 'late' | '';  // Đúng giờ / Trễ giờ
  isLate?: boolean;             // Đi trễ (legacy field)
  
  // Loại điểm danh
  attendanceType?: 'session' | 'makeup' | 'manual';
  
  // Metadata
  createdAt?: string;           // Timestamp (ISO string)
  updatedAt?: string;           // Timestamp (ISO string)
}
```

### Ví dụ Document:

```json
{
  "id": "xyz789",
  "attendanceId": "abc123",
  "sessionId": "F1oO7nnU9bQmkVKXYT9i",
  "studentId": "DnKkSHsNMR3JRB3PpuxP",
  "studentName": "Nguyễn Văn A",
  "studentCode": "HV001",
  "classId": "2Fugewarw1U5AsV6Zxm3",
  "className": "Lớp Tiếng Anh A1",
  "date": "2025-03-11",
  "sessionNumber": 15,
  "status": "Đúng giờ",
  "homeworkCompletion": 90,
  "testName": "Unit 5 Test",
  "score": 8.5,
  "bonusPoints": 1,
  "punctuality": "onTime",
  "isLate": false,
  "attendanceType": "session",
  "createdAt": "2025-03-11T08:30:00.000Z",
  "updatedAt": "2025-03-11T08:30:00.000Z"
}
```

---

## 3. Các Trạng thái Điểm danh (AttendanceStatus)

```typescript
enum AttendanceStatus {
  PENDING = '',              // Chưa điểm danh
  ON_TIME = 'Đúng giờ',     // Có mặt đúng giờ
  LATE = 'Trễ giờ',         // Có mặt nhưng trễ giờ
  ABSENT = 'Vắng',          // Vắng mặt
  RESERVED = 'Bảo lưu',     // Bảo lưu
  TUTORED = 'Đã bồi'        // Đã học bù
}
```

### Logic tính số buổi:

- **Có `sessionId`** + **Status là "Đúng giờ", "Trễ giờ", hoặc "Đã bồi"** → Được tính vào `attendedSessions` (buổi chính thức)
- **Không có `sessionId`** + **Status là "Đúng giờ", "Trễ giờ", hoặc "Đã bồi"** → Được tính vào `makeupSessionsAttended` (học bù, không trừ remaining)
- **Status là "Vắng"** → Không được tính, nhưng tăng `absentSessions` và `makeupOwed`
- **Status là "Bảo lưu"** → Không được tính, tăng `reservedSessions`

---

## 4. Mối quan hệ giữa các Collections

```
attendance (1) ──┐
                 ├──> (1:N) studentAttendance
classSessions (1)┘
```

- Một `attendance` record có nhiều `studentAttendance` records
- Một `studentAttendance` có thể liên kết với một `sessionId` từ collection `classSessions`
- Nếu `sessionId` = null → Đây là buổi học bù (makeup), không trừ `remainingSessions`

---

## 5. Cloud Functions Triggers

### `onStudentAttendanceCreate`
- Trigger khi tạo mới document trong `studentAttendance`
- Cập nhật:
  - `students.attendedSessions` (nếu có `sessionId` và status present)
  - `students.classProgress[classId].attendedSessions`
  - `students.remainingSessions`
  - `students.status` (nếu hết phí hoặc nợ phí)

### `onStudentAttendanceUpdate`
- Trigger khi cập nhật document trong `studentAttendance`
- Điều chỉnh số buổi khi status thay đổi (present ↔ absent)

### `onStudentAttendanceDelete`
- Trigger khi xóa document trong `studentAttendance`
- Giảm số buổi đã học tương ứng

---

## 6. Query Examples

### Lấy tất cả điểm danh của một học sinh:
```typescript
query(
  collection(db, 'studentAttendance'),
  where('studentId', '==', studentId)
)
```

### Lấy điểm danh của một lớp trong một ngày:
```typescript
query(
  collection(db, 'studentAttendance'),
  where('classId', '==', classId),
  where('date', '==', '2025-03-11')
)
```

### Lấy điểm danh có sessionId (buổi chính thức):
```typescript
query(
  collection(db, 'studentAttendance'),
  where('studentId', '==', studentId),
  where('sessionId', '!=', null),
  where('status', 'in', ['Đúng giờ', 'Trễ giờ', 'Đã bồi'])
)
```

---

## 7. Lưu ý quan trọng

1. **`sessionId` là quan trọng**: 
   - Có `sessionId` = Buổi chính thức → Tính vào `attendedSessions`
   - Không có `sessionId` = Học bù → Chỉ tính vào `makeupSessionsAttended`

2. **Status "Đã bồi" (TUTORED)**:
   - Được tính vào `attendedSessions` nếu có `sessionId`
   - Đây là trạng thái học bù cho buổi vắng trước đó

3. **`classProgress[classId]`**:
   - Lưu số buổi theo từng lớp riêng biệt
   - Ưu tiên đọc từ đây khi hiển thị trong StudentDetail

4. **Timezone**:
   - Tất cả dates được lưu dạng string "YYYY-MM-DD" (local timezone)
   - Không dùng Firestore Timestamp để tránh lỗi timezone
