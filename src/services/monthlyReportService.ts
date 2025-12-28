/**
 * Monthly Report Service
 * Handle monthly comments and report generation
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  MonthlyComment, 
  MonthlyReportStats, 
  StudentAttendance,
  AttendanceStatus,
  Student,
  ClassModel
} from '../../types';

const MONTHLY_COMMENTS_COLLECTION = 'monthlyComments';
const STUDENT_ATTENDANCE_COLLECTION = 'studentAttendance';

// ==================== MONTHLY COMMENTS ====================

/**
 * Create or update monthly comment
 */
export const saveMonthlyComment = async (
  data: Omit<MonthlyComment, 'id' | 'createdAt'>
): Promise<string> => {
  try {
    // Check if comment already exists for this student/class/month/year
    const existing = await getMonthlyComment(
      data.studentId, 
      data.classId, 
      data.month, 
      data.year
    );
    
    if (existing) {
      // Update existing
      await updateDoc(doc(db, MONTHLY_COMMENTS_COLLECTION, existing.id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      return existing.id;
    } else {
      // Create new
      const docRef = await addDoc(collection(db, MONTHLY_COMMENTS_COLLECTION), {
        ...data,
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    }
  } catch (error) {
    console.error('Error saving monthly comment:', error);
    throw new Error('Không thể lưu nhận xét tháng');
  }
};

/**
 * Get monthly comment for a student in a class
 * Supports both formats: { month, year } and { month: "YYYY-MM" }
 */
export const getMonthlyComment = async (
  studentId: string,
  classId: string,
  month: number,
  year: number
): Promise<MonthlyComment | null> => {
  try {
    // Try format 1: month and year as separate fields
    const q1 = query(
      collection(db, MONTHLY_COMMENTS_COLLECTION),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      where('month', '==', month),
      where('year', '==', year)
    );
    const snapshot1 = await getDocs(q1);
    
    if (!snapshot1.empty) {
      const docData = snapshot1.docs[0];
      return { id: docData.id, ...docData.data() } as MonthlyComment;
    }
    
    // Try format 2: month as "YYYY-MM" string (from HomeworkManager)
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const q2 = query(
      collection(db, MONTHLY_COMMENTS_COLLECTION),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      where('month', '==', monthStr)
    );
    const snapshot2 = await getDocs(q2);
    
    if (!snapshot2.empty) {
      const docData = snapshot2.docs[0];
      const data = docData.data();
      // Normalize to standard format
      return { 
        id: docData.id, 
        ...data,
        teacherComment: data.teacherComment || data.comment || '',
        month,
        year,
      } as MonthlyComment;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting monthly comment:', error);
    return null;
  }
};

/**
 * Get all monthly comments for a student in a month
 */
export const getStudentMonthlyComments = async (
  studentId: string,
  month: number,
  year: number
): Promise<MonthlyComment[]> => {
  try {
    const q = query(
      collection(db, MONTHLY_COMMENTS_COLLECTION),
      where('studentId', '==', studentId),
      where('month', '==', month),
      where('year', '==', year)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MonthlyComment));
  } catch (error) {
    console.error('Error getting student monthly comments:', error);
    return [];
  }
};

/**
 * Delete monthly comment
 */
export const deleteMonthlyComment = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, MONTHLY_COMMENTS_COLLECTION, id));
  } catch (error) {
    console.error('Error deleting monthly comment:', error);
    throw new Error('Không thể xóa nhận xét');
  }
};

// ==================== TEST COMMENTS ====================

export interface TestCommentData {
  id: string;
  testName: string;
  testDate: string;
  comment: string;
  score: number | null;
}

/**
 * Get test comments for a student in a class
 */
export const getStudentTestComments = async (
  studentId: string,
  classId: string
): Promise<TestCommentData[]> => {
  try {
    const q = query(
      collection(db, 'testComments'),
      where('studentId', '==', studentId),
      where('classId', '==', classId)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        testName: data.testName || '',
        testDate: data.testDate || '',
        comment: data.comment || '',
        score: data.score ?? null,
      };
    }).sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''));
  } catch (error) {
    console.error('Error getting test comments:', error);
    return [];
  }
};

// ==================== HOMEWORK RECORDS ====================

export interface HomeworkSummary {
  totalHomeworks: number;
  completedHomeworks: number;
  completionRate: number;
  homeworkDetails: Array<{
    sessionNumber: number;
    sessionDate: string;
    homeworkName: string;
    status: string;
  }>;
}

/**
 * Get homework summary for a student in a class for a specific month
 */
export const getStudentHomeworkSummary = async (
  studentId: string,
  classId: string,
  month: number,
  year: number
): Promise<HomeworkSummary> => {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    
    const q = query(
      collection(db, 'homeworkRecords'),
      where('classId', '==', classId)
    );
    const snapshot = await getDocs(q);
    
    let totalHomeworks = 0;
    let completedHomeworks = 0;
    const homeworkDetails: HomeworkSummary['homeworkDetails'] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const sessionDate = data.sessionDate || '';
      
      // Filter by date range
      if (sessionDate < startDate || sessionDate > endDate) return;
      
      const studentRecord = (data.studentRecords || []).find(
        (r: any) => r.studentId === studentId
      );
      
      if (!studentRecord) return;
      
      const homeworks = data.homeworks || [];
      homeworks.forEach((hw: any) => {
        totalHomeworks++;
        const hwStatus = studentRecord.homeworks?.[hw.id]?.status || 'not_completed';
        if (hwStatus === 'completed') {
          completedHomeworks++;
        }
        
        homeworkDetails.push({
          sessionNumber: data.sessionNumber || 0,
          sessionDate,
          homeworkName: hw.name || '',
          status: hwStatus,
        });
      });
    });
    
    return {
      totalHomeworks,
      completedHomeworks,
      completionRate: totalHomeworks > 0 ? Math.round((completedHomeworks / totalHomeworks) * 100) : 0,
      homeworkDetails: homeworkDetails.sort((a, b) => a.sessionNumber - b.sessionNumber),
    };
  } catch (error) {
    console.error('Error getting homework summary:', error);
    return {
      totalHomeworks: 0,
      completedHomeworks: 0,
      completionRate: 0,
      homeworkDetails: [],
    };
  }
};

// ==================== REPORT DATA ====================

/**
 * Get student attendance records for a specific month and class
 */
export const getStudentMonthlyAttendance = async (
  studentId: string,
  classId: string,
  month: number,
  year: number
): Promise<StudentAttendance[]> => {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    
    const q = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('studentId', '==', studentId),
      where('classId', '==', classId)
    );
    const snapshot = await getDocs(q);
    
    // Filter by date range client-side (check both date and createdAt fields)
    const records = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as StudentAttendance))
      .filter(record => {
        let recordDate = record.date;
        if (!recordDate && record.createdAt) {
          recordDate = record.createdAt.substring(0, 10);
        }
        if (!recordDate) return false;
        return recordDate >= startDate && recordDate <= endDate;
      })
      .sort((a, b) => {
        const dateA = a.date || (a.createdAt?.substring(0, 10) || '');
        const dateB = b.date || (b.createdAt?.substring(0, 10) || '');
        return dateA.localeCompare(dateB);
      });
    
    return records;
  } catch (error) {
    console.error('Error getting student monthly attendance:', error);
    return [];
  }
};

/**
 * Get all student attendance records for a month (all classes)
 */
export const getStudentAllClassesMonthlyAttendance = async (
  studentId: string,
  month: number,
  year: number
): Promise<StudentAttendance[]> => {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    
    const q = query(
      collection(db, STUDENT_ATTENDANCE_COLLECTION),
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    
    // Filter by date range client-side (check both date and createdAt fields)
    const records = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as StudentAttendance))
      .filter(record => {
        // Try date field first, then createdAt
        let recordDate = record.date;
        if (!recordDate && record.createdAt) {
          // Extract date from createdAt (format: 2025-12-09T10:30:00.000Z)
          recordDate = record.createdAt.substring(0, 10);
        }
        if (!recordDate) return false;
        return recordDate >= startDate && recordDate <= endDate;
      })
      .sort((a, b) => {
        const dateA = a.date || (a.createdAt?.substring(0, 10) || '');
        const dateB = b.date || (b.createdAt?.substring(0, 10) || '');
        return dateA.localeCompare(dateB);
      });
    
    return records;
  } catch (error) {
    console.error('Error getting student all classes attendance:', error);
    return [];
  }
};

/**
 * Calculate monthly stats for a student in a class
 */
export const calculateMonthlyStats = (
  attendanceRecords: StudentAttendance[]
): MonthlyReportStats => {
  const totalSessions = attendanceRecords.length;
  const attendedSessions = attendanceRecords.filter(
    r => r.status === AttendanceStatus.ON_TIME || r.status === AttendanceStatus.LATE || r.status === AttendanceStatus.TUTORED
  ).length;
  const absentSessions = attendanceRecords.filter(
    r => r.status === AttendanceStatus.ABSENT
  ).length;
  
  const attendanceRate = totalSessions > 0 
    ? Math.round((attendedSessions / totalSessions) * 100) 
    : 0;
  
  // Calculate average score
  const scoresRecords = attendanceRecords.filter(r => r.score !== undefined && r.score !== null);
  const averageScore = scoresRecords.length > 0
    ? Math.round((scoresRecords.reduce((sum, r) => sum + (r.score || 0), 0) / scoresRecords.length) * 10) / 10
    : null;
  
  // Sum bonus points
  const totalBonusPoints = attendanceRecords.reduce((sum, r) => sum + (r.bonusPoints || 0), 0);
  
  return {
    totalSessions,
    attendedSessions,
    absentSessions,
    attendanceRate,
    averageScore,
    totalBonusPoints
  };
};

/**
 * Generate full monthly report data for a student
 */
export interface MonthlyReportData {
  student: Student;
  month: number;
  year: number;
  generatedAt: string;
  
  // Overall stats (across all classes)
  overallStats: MonthlyReportStats;
  
  // Per-class data
  classReports: Array<{
    classId: string;
    className: string;
    stats: MonthlyReportStats;
    attendance: StudentAttendance[];
    comment: MonthlyComment | null;
    testComments: TestCommentData[];
    homeworkSummary: HomeworkSummary;
  }>;
  
  // All attendance records for history table
  allAttendance: StudentAttendance[];
}

export const generateMonthlyReport = async (
  student: Student,
  classes: ClassModel[],
  month: number,
  year: number
): Promise<MonthlyReportData> => {
  // Get all attendance records for this student in the month
  const allAttendance = await getStudentAllClassesMonthlyAttendance(student.id, month, year);
  
  // Calculate overall stats
  const overallStats = calculateMonthlyStats(allAttendance);
  
  // Get unique class IDs from attendance records (more reliable than student.classIds)
  const attendedClassIds = [...new Set(allAttendance.map(a => a.classId).filter(Boolean))];
  
  // Also include student's registered classes
  const studentClassIds = student.classIds || (student.classId ? [student.classId] : []);
  const allClassIds = [...new Set([...attendedClassIds, ...studentClassIds])];
  
  // Get class info for attended classes
  const studentClasses = classes.filter(c => allClassIds.includes(c.id));
  
  // Get per-class data
  const classReports = await Promise.all(
    studentClasses.map(async (cls) => {
      const classAttendance = allAttendance.filter(a => a.classId === cls.id);
      const stats = calculateMonthlyStats(classAttendance);
      const comment = await getMonthlyComment(student.id, cls.id, month, year);
      const testComments = await getStudentTestComments(student.id, cls.id);
      const homeworkSummary = await getStudentHomeworkSummary(student.id, cls.id, month, year);
      
      return {
        classId: cls.id,
        className: cls.name,
        stats,
        attendance: classAttendance,
        comment,
        testComments,
        homeworkSummary
      };
    })
  );
  
  // Also add classes that have attendance but not in the classes list
  for (const classId of attendedClassIds) {
    if (!studentClasses.find(c => c.id === classId)) {
      const classAttendance = allAttendance.filter(a => a.classId === classId);
      if (classAttendance.length > 0) {
        const stats = calculateMonthlyStats(classAttendance);
        const comment = await getMonthlyComment(student.id, classId, month, year);
        const testComments = await getStudentTestComments(student.id, classId);
        const homeworkSummary = await getStudentHomeworkSummary(student.id, classId, month, year);
        const className = classAttendance[0]?.className || 'Lớp không xác định';
        
        classReports.push({
          classId,
          className,
          stats,
          attendance: classAttendance,
          comment,
          testComments,
          homeworkSummary
        });
      }
    }
  }
  
  return {
    student,
    month,
    year,
    generatedAt: new Date().toISOString(),
    overallStats,
    classReports,
    allAttendance
  };
};

// ==================== AI COMMENT GENERATION ====================

/**
 * Generate AI comment based on attendance data
 * This is a template - can be enhanced with actual AI service
 */
export const generateAIComment = (
  studentName: string,
  className: string,
  stats: MonthlyReportStats,
  attendance: StudentAttendance[]
): string => {
  const firstName = studentName.split(' ').pop() || studentName;
  
  let comment = `Chào ${studentName}!\n\n`;
  
  // Attendance analysis
  if (stats.attendanceRate === 100) {
    comment += `Cô/thầy rất vui khi thấy con luôn có mặt đầy đủ trong cả ${stats.totalSessions} buổi học gần đây, đạt tỉ lệ chuyên cần 100%. Đây là một tinh thần học tập rất đáng khen, cho thấy sự nghiêm túc và trách nhiệm của con. `;
  } else if (stats.attendanceRate >= 80) {
    comment += `Con đã tham gia ${stats.attendedSessions}/${stats.totalSessions} buổi học trong tháng, đạt tỉ lệ chuyên cần ${stats.attendanceRate}%. Cô/thầy khuyến khích con cố gắng duy trì và cải thiện để không bỏ lỡ kiến thức quan trọng. `;
  } else {
    comment += `Trong tháng này, con chỉ tham gia ${stats.attendedSessions}/${stats.totalSessions} buổi học (${stats.attendanceRate}%). Cô/thầy mong con sắp xếp thời gian để tham gia đầy đủ hơn trong tháng tới. `;
  }
  
  // Bonus points
  if (stats.totalBonusPoints > 0) {
    comment += `Đặc biệt, con còn tích lũy được ${stats.totalBonusPoints} điểm thưởng, thể hiện sự chủ động và tích cực tham gia vào các hoạt động khác ngoài việc học trên lớp.\n\n`;
  } else {
    comment += '\n\n';
  }
  
  // Score analysis
  if (stats.averageScore !== null) {
    if (stats.averageScore >= 8) {
      comment += `Về kết quả học tập, điểm trung bình ${stats.averageScore}/10 cho thấy con đang nắm bắt kiến thức rất tốt. Hãy tiếp tục phát huy nhé!\n\n`;
    } else if (stats.averageScore >= 6) {
      comment += `Tuy nhiên, về kết quả học tập, điểm trung bình ${stats.averageScore}/10 cho thấy con đang gặp một số khó khăn trong việc nắm bắt kiến thức. Đây là điểm con cần đặc biệt chú ý và cải thiện.\n\n`;
    } else {
      comment += `Về kết quả học tập, điểm trung bình ${stats.averageScore}/10 cho thấy con cần được hỗ trợ thêm. Cô/thầy khuyên con hãy mạnh dạn hơn trong việc đặt câu hỏi khi chưa hiểu bài.\n\n`;
    }
  }
  
  // Encouragement
  comment += `Cô/thầy tin rằng với sự chuyên cần và tinh thần cầu tiến, con sẽ sớm đạt được những tiến bộ vượt bậc!`;
  
  return comment;
};

/**
 * Update student attendance with grade info
 */
export const updateStudentAttendanceGrade = async (
  attendanceId: string,
  gradeData: {
    homeworkCompletion?: number;
    testName?: string;
    score?: number;
    bonusPoints?: number;
    note?: string;
  }
): Promise<void> => {
  try {
    const docRef = doc(db, STUDENT_ATTENDANCE_COLLECTION, attendanceId);
    await updateDoc(docRef, {
      ...gradeData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating attendance grade:', error);
    throw new Error('Không thể cập nhật điểm số');
  }
};

/**
 * Batch update grades for multiple attendance records
 */
export const batchUpdateAttendanceGrades = async (
  updates: Array<{
    id: string;
    homeworkCompletion?: number;
    testName?: string;
    score?: number;
    bonusPoints?: number;
    note?: string;
  }>
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    updates.forEach(update => {
      const { id, ...data } = update;
      const docRef = doc(db, STUDENT_ATTENDANCE_COLLECTION, id);
      batch.update(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error batch updating grades:', error);
    throw new Error('Không thể cập nhật điểm số');
  }
};

// ==================== PDF GENERATION ====================

/**
 * Interface for PDF report data
 */
export interface StudentPDFReportData {
  student: {
    fullName: string;
    code: string;
    className: string;
    branch?: string;
  };
  month: number;
  year: number;
  attendance: {
    totalSessions: number;
    attended: number;
    onTime: number;
    late: number;
    absent: number;
    rate: number;
  };
  homework: {
    total: number;
    completed: number;
    rate: number;
    avgScore?: number;
  };
  monthlyComment?: string;
  testResults: Array<{
    testName: string;
    score: number | null;
    comment?: string;
  }>;
}

/**
 * Generate HTML template for PDF
 */
function generatePDFHTML(data: StudentPDFReportData): string {
  const escapeHtml = (text: string | undefined): string => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  return `
    <div style="padding: 24px; font-family: 'Arial', sans-serif; font-size: 13px; line-height: 1.5; color: #333; background: #fff;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #4F46E5;">
        <h1 style="color: #4F46E5; margin: 0; font-size: 24px; font-weight: bold;">BRISKY ENGLISH</h1>
        <h2 style="margin: 12px 0 0; font-size: 18px; color: #1F2937;">BÁO CÁO HỌC TẬP THÁNG ${data.month}/${data.year}</h2>
      </div>

      <!-- Student Info -->
      <div style="border: 1px solid #E5E7EB; padding: 16px; margin-bottom: 16px; border-radius: 8px; background: #F9FAFB;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; width: 50%;"><strong>Học sinh:</strong> ${escapeHtml(data.student.fullName)}</td>
            <td style="padding: 4px 0;"><strong>Mã HS:</strong> ${escapeHtml(data.student.code)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong>Lớp:</strong> ${escapeHtml(data.student.className)}</td>
            ${data.student.branch ? `<td style="padding: 4px 0;"><strong>Cơ sở:</strong> ${escapeHtml(data.student.branch)}</td>` : '<td></td>'}
          </tr>
        </table>
      </div>

      <!-- Attendance Stats -->
      <div style="border: 1px solid #E5E7EB; padding: 16px; margin-bottom: 16px; border-radius: 8px;">
        <h3 style="color: #4F46E5; margin: 0 0 12px; font-size: 15px;">📊 THỐNG KÊ ĐIỂM DANH</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">Tổng số buổi</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold;">${data.attendance.totalSessions} buổi</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">Đi học</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold; color: #059669;">${data.attendance.attended} buổi (${data.attendance.rate}%)</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Đúng giờ / Trễ giờ / Vắng</td>
            <td style="padding: 8px 0; text-align: right;">${data.attendance.onTime} / ${data.attendance.late} / ${data.attendance.absent}</td>
          </tr>
        </table>
      </div>

      <!-- Homework Stats -->
      <div style="border: 1px solid #E5E7EB; padding: 16px; margin-bottom: 16px; border-radius: 8px;">
        <h3 style="color: #4F46E5; margin: 0 0 12px; font-size: 15px;">📝 THỐNG KÊ BÀI TẬP VỀ NHÀ</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">Hoàn thành</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold;">${data.homework.completed}/${data.homework.total} bài (${data.homework.rate}%)</td>
          </tr>
          ${data.homework.avgScore !== undefined ? `
          <tr>
            <td style="padding: 8px 0;">Điểm trung bình</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #D97706;">${data.homework.avgScore}/10</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Monthly Comment -->
      ${data.monthlyComment ? `
      <div style="border: 1px solid #D1FAE5; padding: 16px; margin-bottom: 16px; border-radius: 8px; background: #ECFDF5;">
        <h3 style="color: #059669; margin: 0 0 12px; font-size: 15px;">💬 NHẬN XÉT CỦA GIÁO VIÊN</h3>
        <p style="margin: 0; white-space: pre-line; color: #374151;">${escapeHtml(data.monthlyComment)}</p>
      </div>
      ` : ''}

      <!-- Test Results -->
      ${data.testResults.length > 0 ? `
      <div style="border: 1px solid #E5E7EB; padding: 16px; margin-bottom: 16px; border-radius: 8px;">
        <h3 style="color: #4F46E5; margin: 0 0 12px; font-size: 15px;">📋 KẾT QUẢ BÀI KIỂM TRA</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #E5E7EB;">
          <thead>
            <tr style="background: #F3F4F6;">
              <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: left; font-weight: 600;">Bài Test</th>
              <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: center; width: 80px; font-weight: 600;">Điểm</th>
              <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: left; font-weight: 600;">Nhận xét</th>
            </tr>
          </thead>
          <tbody>
            ${data.testResults.map(t => `
              <tr>
                <td style="padding: 10px; border: 1px solid #E5E7EB;">${escapeHtml(t.testName)}</td>
                <td style="padding: 10px; border: 1px solid #E5E7EB; text-align: center; font-weight: bold; color: ${t.score !== null && t.score >= 8 ? '#059669' : t.score !== null && t.score >= 5 ? '#D97706' : '#DC2626'};">${t.score !== null ? t.score : '-'}</td>
                <td style="padding: 10px; border: 1px solid #E5E7EB;">${escapeHtml(t.comment) || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Footer -->
      <div style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 4px 0;">Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} - ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
        <p style="margin: 4px 0;">© EduManager Pro - Hệ thống quản lý giáo dục</p>
      </div>
    </div>
  `;
}

/**
 * Generate PDF for a single student report
 */
export async function generateStudentPDF(data: StudentPDFReportData): Promise<Blob> {
  // Create temporary HTML element
  const container = document.createElement('div');
  container.innerHTML = generatePDFHTML(data);
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  container.style.background = '#fff';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // Handle multi-page if content is too long
    const pageHeight = pdf.internal.pageSize.getHeight();
    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Prepare PDF report data from MonthlyReportData
 */
export function preparePDFReportData(reportData: MonthlyReportData): StudentPDFReportData[] {
  const student = reportData.student;

  return reportData.classReports.map(classReport => {
    // Calculate attendance breakdown
    const onTime = classReport.attendance.filter(a => a.status === AttendanceStatus.ON_TIME).length;
    const late = classReport.attendance.filter(a => a.status === AttendanceStatus.LATE).length;
    const tutored = classReport.attendance.filter(a => a.status === AttendanceStatus.TUTORED).length;
    const absent = classReport.attendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
    const attended = onTime + late + tutored;
    const total = classReport.attendance.length;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return {
      student: {
        fullName: student.fullName,
        code: student.code,
        className: classReport.className,
        branch: student.branch,
      },
      month: reportData.month,
      year: reportData.year,
      attendance: {
        totalSessions: total,
        attended,
        onTime,
        late,
        absent,
        rate,
      },
      homework: {
        total: classReport.homeworkSummary.totalHomeworks,
        completed: classReport.homeworkSummary.completedHomeworks,
        rate: classReport.homeworkSummary.completionRate,
        avgScore: classReport.stats.averageScore ?? undefined,
      },
      monthlyComment: classReport.comment?.teacherComment,
      testResults: classReport.testComments.map(t => ({
        testName: t.testName,
        score: t.score,
        comment: t.comment,
      })),
    };
  });
}
