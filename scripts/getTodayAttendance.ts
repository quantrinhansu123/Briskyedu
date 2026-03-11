/**
 * Get Today's Attendance Data
 * Lấy dữ liệu điểm danh của ngày hôm nay
 * Run: npx tsx scripts/getTodayAttendance.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA_uiBezAs2-EH9czLA8rEliEgsXtdm4r8",
  authDomain: "edumanager-pro-6180f.firebaseapp.com",
  projectId: "edumanager-pro-6180f",
  storageBucket: "edumanager-pro-6180f.firebaseapp.com",
  messagingSenderId: "649231512346",
  appId: "1:649231512346:web:8e88ae07a63087e09632a3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Lấy ngày hôm nay theo format YYYY-MM-DD
function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getTodayAttendance() {
  const today = getTodayDate();
  console.log('='.repeat(80));
  console.log('DỮ LIỆU ĐIỂM DANH HÔM NAY');
  console.log('='.repeat(80));
  console.log(`Ngày: ${today}\n`);

  try {
    // 1. Lấy tất cả attendance records của hôm nay
    console.log('1. Đang lấy bảng điểm danh tổng hợp (attendance)...');
    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('date', '==', today)
    );
    const attendanceSnap = await getDocs(attendanceQuery);
    const attendanceRecords = attendanceSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Tìm thấy ${attendanceRecords.length} bản ghi điểm danh\n`);

    if (attendanceRecords.length === 0) {
      console.log('   ⚠️  Không có điểm danh nào được ghi nhận hôm nay!\n');
      return;
    }

    // 2. Hiển thị chi tiết từng bản ghi attendance
    attendanceRecords.forEach((record: any, index: number) => {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📋 BẢN GHI ĐIỂM DANH #${index + 1}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`ID: ${record.id}`);
      console.log(`Lớp học: ${record.className || 'N/A'} (ID: ${record.classId || 'N/A'})`);
      console.log(`Ngày: ${record.date}`);
      console.log(`Buổi học: ${record.sessionNumber ? `Buổi #${record.sessionNumber}` : 'N/A'}`);
      console.log(`Session ID: ${record.sessionId || 'N/A'}`);
      console.log(`\n📊 Thống kê:`);
      console.log(`   - Tổng học sinh: ${record.totalStudents || 0}`);
      console.log(`   - Có mặt: ${record.present || 0}`);
      console.log(`   - Vắng: ${record.absent || 0}`);
      console.log(`   - Bảo lưu: ${record.reserved || 0}`);
      console.log(`   - Đã bồi: ${record.tutored || 0}`);
      console.log(`   - Trạng thái: ${record.status || 'N/A'}`);
      console.log(`   - Loại điểm danh: ${record.attendanceType || 'N/A'}`);
      if (record.holidayName) {
        console.log(`   - Ngày nghỉ: ${record.holidayName}`);
      }
      console.log(`   - Người tạo: ${record.createdBy || 'N/A'}`);
      console.log(`   - Thời gian tạo: ${record.createdAt || 'N/A'}`);
    });

    // 3. Lấy tất cả studentAttendance records của hôm nay
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('2. Đang lấy chi tiết điểm danh từng học sinh (studentAttendance)...');
    const studentAttendanceQuery = query(
      collection(db, 'studentAttendance'),
      where('date', '==', today)
    );
    const studentAttendanceSnap = await getDocs(studentAttendanceQuery);
    const studentAttendanceRecords = studentAttendanceSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Tìm thấy ${studentAttendanceRecords.length} bản ghi điểm danh học sinh\n`);

    // 4. Nhóm theo attendanceId
    const groupedByAttendance = new Map<string, any[]>();
    studentAttendanceRecords.forEach((record: any) => {
      const attendanceId = record.attendanceId || 'unknown';
      if (!groupedByAttendance.has(attendanceId)) {
        groupedByAttendance.set(attendanceId, []);
      }
      groupedByAttendance.get(attendanceId)!.push(record);
    });

    // 5. Hiển thị chi tiết từng học sinh
    groupedByAttendance.forEach((students, attendanceId) => {
      const attendanceRecord = attendanceRecords.find((r: any) => r.id === attendanceId);
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`👥 CHI TIẾT ĐIỂM DANH: ${attendanceRecord?.className || 'N/A'}`);
      console.log(`   Attendance ID: ${attendanceId}`);
      console.log(`   Số học sinh: ${students.length}`);
      console.log(`${'─'.repeat(80)}`);

      // Nhóm theo status
      const byStatus = new Map<string, any[]>();
      students.forEach((student: any) => {
        const status = student.status || 'Chưa điểm danh';
        if (!byStatus.has(status)) {
          byStatus.set(status, []);
        }
        byStatus.get(status)!.push(student);
      });

      byStatus.forEach((studentsWithStatus, status) => {
        console.log(`\n   📌 ${status} (${studentsWithStatus.length} học sinh):`);
        studentsWithStatus.forEach((student: any, idx: number) => {
          console.log(`      ${idx + 1}. ${student.studentName || 'N/A'} (${student.studentCode || 'N/A'})`);
          console.log(`         - Student ID: ${student.studentId}`);
          console.log(`         - Session ID: ${student.sessionId || 'N/A'} ${student.sessionId ? '✅ (Buổi chính thức)' : '⚠️  (Học bù)'}`);
          console.log(`         - Session Number: ${student.sessionNumber || 'N/A'}`);
          if (student.homeworkCompletion !== undefined) {
            console.log(`         - BTVN: ${student.homeworkCompletion}%`);
          }
          if (student.testName) {
            console.log(`         - Bài KT: ${student.testName}`);
          }
          if (student.score !== undefined) {
            console.log(`         - Điểm: ${student.score}`);
          }
          if (student.bonusPoints !== undefined) {
            console.log(`         - Điểm thưởng: ${student.bonusPoints}`);
          }
          if (student.punctuality) {
            console.log(`         - Đúng giờ/Trễ: ${student.punctuality}`);
          }
          if (student.note) {
            console.log(`         - Ghi chú: ${student.note}`);
          }
        });
      });
    });

    // 6. Tổng kết
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📊 TỔNG KẾT');
    console.log(`${'='.repeat(80)}`);
    console.log(`Tổng số bản ghi attendance: ${attendanceRecords.length}`);
    console.log(`Tổng số bản ghi studentAttendance: ${studentAttendanceRecords.length}`);
    
    // Thống kê theo status
    const statusCount = new Map<string, number>();
    studentAttendanceRecords.forEach((record: any) => {
      const status = record.status || 'Chưa điểm danh';
      statusCount.set(status, (statusCount.get(status) || 0) + 1);
    });
    
    console.log(`\nThống kê theo trạng thái:`);
    statusCount.forEach((count, status) => {
      console.log(`   - ${status}: ${count} học sinh`);
    });

    // Thống kê có sessionId vs không có
    const withSessionId = studentAttendanceRecords.filter((r: any) => r.sessionId).length;
    const withoutSessionId = studentAttendanceRecords.filter((r: any) => !r.sessionId).length;
    console.log(`\nThống kê loại buổi học:`);
    console.log(`   - Buổi chính thức (có sessionId): ${withSessionId} học sinh`);
    console.log(`   - Học bù (không có sessionId): ${withoutSessionId} học sinh`);

    // Thống kê theo lớp
    const classCount = new Map<string, number>();
    attendanceRecords.forEach((record: any) => {
      const className = record.className || 'N/A';
      classCount.set(className, (classCount.get(className) || 0) + 1);
    });
    
    console.log(`\nThống kê theo lớp:`);
    classCount.forEach((count, className) => {
      console.log(`   - ${className}: ${count} buổi điểm danh`);
    });

    console.log(`\n${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('❌ Lỗi khi lấy dữ liệu:', error);
    throw error;
  }
}

getTodayAttendance().catch(console.error);
