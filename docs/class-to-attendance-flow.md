# Luong Tu Lop Den Diem Danh (Class-to-Attendance Flow)

Tai lieu mo ta luong xu ly tu khi tao lop -> sinh buoi hoc -> diem danh -> cap nhat so buoi.

## 1. Tao Lop (Class Create)

**Trigger:** `onClassCreate` (`functions/src/triggers/classTriggers.ts`)

- Khi tao lop voi `schedule` + `totalSessions` > 0, Cloud Function tu dong sinh buoi hoc
- Goi `generateClassSessions()` -> parse lich hoc -> tinh ngay -> tao `classSessions` documents
- Moi session co: `classId`, `className`, `sessionNumber`, `date`, `dayOfWeek`, `time`, `status='Chua hoc'`
- Neu ngay trung voi ngay le (`holidays` collection, status='Da ap dung'), session duoc danh dau `status='Nghi'` + `holidayId`/`holidayName`

## 2. Cap Nhat Lop (Class Update)

**Trigger:** `onClassUpdate` (`functions/src/triggers/classTriggers.ts`)

Khi thay doi `schedule`, `totalSessions`, hoac `startDate`:
- Goi `regenerateSessionsForClass()`:
  1. Lay tat ca sessions hien tai
  2. Parse lich moi -> tinh danh sach ngay moi
  3. So sanh: ngay nao co roi thi giu, ngay nao thua thi xoa (chi xoa neu chua diem danh), ngay nao thieu thi them
  4. Sessions moi them duoc kiem tra ngay le tu dong
  5. **Sau khi them/xoa xong, renumber lai toan bo sessions theo thu tu ngay (1, 2, 3, ...)**

Cascade updates:
- Doi ten lop -> cap nhat `students`, `classSessions`, `attendance`
- Doi GV -> cap nhat `classSessions` + ghi `trainingHistory`
- Doi phong -> cap nhat `classSessions` + ghi `trainingHistory`

## 3. Diem Danh (Attendance)

**Frontend:** `pages/Attendance.tsx`

- Chon lop -> load danh sach buoi hoc tu `classSessions`
- Dropdown hien thi trang thai moi buoi:
  - `O` (xam): Chua hoc
  - Check (xanh): Da hoc
  - Filled dot (vang): Hom nay
  - `X` (tim): Nghi le (holiday)
- Khi diem danh -> tao records trong `studentAttendance` collection
- Cloud Function (`onStudentAttendanceCreate`) tu dong cap nhat `attendedSessions`, `remainingSessions`, student status

## 4. Cap Nhat So Buoi (Session Counting)

**Trigger:** `onStudentAttendanceCreate`, `onStudentAttendanceUpdate`, `onStudentAttendanceDelete`
(`functions/src/triggers/studentAttendanceTriggers.ts`)

- Dem so buoi present (bao gom ca legacy statuses)
- PRESENT_STATUSES: `'Dung gio'`, `'Tre gio'`, `'Da boi'`, `'Co mat'`, `'Den tre'`
- Cap nhat `attendedSessions`, `remainingSessions` tren student document
- Tu dong chuyen trang thai hoc sinh dua tren so buoi con lai

## 5. Xoa Lop (Class Delete)

**Trigger:** `onClassDelete`

- Xoa sessions KHONG co `attendanceId` (giu lai sessions da diem danh)
- Clear `classId` tren students
- Danh dau attendance records la `classDeleted: true`

---

## Cam Bay Da Biet (Known Pitfalls)

1. **KHONG dem buoi hoc phia client** - Chi dung Cloud Functions de dem `attendedSessions`. Client-side counting gay race condition voi Cloud Function triggers.

2. **Legacy status values** - Collection `studentAttendance` co ca gia tri cu (`Co mat`, `Den tre`) va moi (`Dung gio`, `Tre gio`). Tat ca queries PHAI bao gom ca hai.

3. **Session voi/khong co sessionId** - Records CO `sessionId` = diem danh thuong (tinh vao `attendedSessions`). Records KHONG CO `sessionId` = buoi boi (tracked rieng).

4. **Firebase CLI deploy caching** - Khi thay doi Cloud Functions ma deploy khong nhan, xoa `.firebase/` va `functions/lib/` roi deploy lai.

5. **Renumber tu dong sau regenerate** - Khi them/xoa sessions, `sessionNumber` duoc tu dong sap xep lai theo thu tu ngay (1, 2, 3, ...). Khong can fix thu cong.
