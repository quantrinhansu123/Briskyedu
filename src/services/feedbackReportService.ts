/**
 * Feedback Report Service
 * Generates PDF and Excel reports for student feedback.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface FeedbackData {
  id?: string;
  studentName?: string;
  type: 'Call' | 'Form';
  date?: string;
  createdAt?: string;
  teacherScore?: number;
  curriculumScore?: number;
  customerServiceScore?: number;
  facilityScore?: number;
  averageScore?: number;
  content?: string;
  notes?: string;
}

interface StudentInfo {
  fullName: string;
  code?: string;
  className?: string;
}

interface FeedbackStats {
  total: number;
  callCount: number;
  formCount: number;
  avgScore: string | number;
  teacherAvg: string | number;
  curriculumAvg: string | number;
  serviceAvg: string | number;
  facilityAvg: string | number;
}

/**
 * Generate PDF report for student feedback
 */
export async function generateFeedbackPDF(
  student: StudentInfo,
  feedbacks: FeedbackData[],
  stats: FeedbackStats
): Promise<void> {
  const html = generateReportHTML(student, feedbacks, stats);

  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    const reportElement = container.querySelector('#feedback-report') as HTMLElement;
    if (!reportElement) {
      throw new Error('Report element not found');
    }

    const canvas = await html2canvas(reportElement, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Handle multi-page if content is too long
    const pageHeight = 297;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const fileName = `BaoCaoFeedback_${student.fullName?.replace(/\s+/g, '_') || 'HocVien'}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generate Excel report for student feedback
 */
export function generateFeedbackExcel(
  student: StudentInfo,
  feedbacks: FeedbackData[],
  stats: FeedbackStats
): void {
  // Summary sheet
  const summaryData = [
    { 'Chỉ số': 'Học viên', 'Giá trị': student.fullName },
    { 'Chỉ số': 'Mã HV', 'Giá trị': student.code || '' },
    { 'Chỉ số': 'Lớp', 'Giá trị': student.className || '' },
    { 'Chỉ số': 'Tổng phản hồi', 'Giá trị': stats.total },
    { 'Chỉ số': 'Qua điện thoại', 'Giá trị': stats.callCount },
    { 'Chỉ số': 'Qua Form', 'Giá trị': stats.formCount },
    { 'Chỉ số': 'Điểm TB', 'Giá trị': stats.avgScore },
    { 'Chỉ số': 'Giáo viên TB', 'Giá trị': stats.teacherAvg },
    { 'Chỉ số': 'Chương trình TB', 'Giá trị': stats.curriculumAvg },
    { 'Chỉ số': 'CSKH TB', 'Giá trị': stats.serviceAvg },
    { 'Chỉ số': 'Cơ sở TB', 'Giá trị': stats.facilityAvg },
  ];

  // Feedback detail sheet
  const feedbackData = feedbacks.map((fb, idx) => ({
    STT: idx + 1,
    'Ngày': fb.date || fb.createdAt || '',
    'Loại': fb.type === 'Call' ? 'Điện thoại' : 'Form',
    'Giáo viên': fb.teacherScore || '',
    'Chương trình': fb.curriculumScore || '',
    'CSKH': fb.customerServiceScore || '',
    'Cơ sở': fb.facilityScore || '',
    'Điểm TB': fb.averageScore || '',
    'Nội dung': fb.content || fb.notes || '',
  }));

  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan');

  if (feedbackData.length > 0) {
    const wsDetail = XLSX.utils.json_to_sheet(feedbackData);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi tiết phản hồi');
  }

  const fileName = `BaoCaoFeedback_${student.fullName?.replace(/\s+/g, '_') || 'HocVien'}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Generate HTML template for PDF report
 */
function generateReportHTML(
  student: StudentInfo,
  feedbacks: FeedbackData[],
  stats: FeedbackStats
): string {
  const recentFeedbacks = feedbacks.slice(0, 5);

  return `
    <div id="feedback-report" style="
      width: 210mm;
      padding: 15mm;
      font-family: Arial, sans-serif;
      font-size: 11pt;
      background: #fff;
      box-sizing: border-box;
    ">
      <h2 style="color: #1E4D78; margin-bottom: 5px; margin-top: 0;">Báo cáo phản hồi khách hàng</h2>
      <p style="color: #666; margin-bottom: 20px;">Học viên: ${student.fullName || ''} ${student.code ? `- ${student.code}` : ''}</p>

      <!-- Summary -->
      <div style="display: flex; gap: 10px; margin-bottom: 20px;">
        <div style="flex:1; background:#e3f2fd; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:24pt; font-weight:bold; color:#1976d2;">${stats.total}</div>
          <div style="font-size:9pt; color:#1976d2;">Tổng phản hồi</div>
        </div>
        <div style="flex:1; background:#e8f5e9; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:24pt; font-weight:bold; color:#388e3c;">${stats.callCount}</div>
          <div style="font-size:9pt; color:#388e3c;">Qua điện thoại</div>
        </div>
        <div style="flex:1; background:#f3e5f5; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:24pt; font-weight:bold; color:#7b1fa2;">${stats.formCount}</div>
          <div style="font-size:9pt; color:#7b1fa2;">Qua Form</div>
        </div>
        <div style="flex:1; background:#fff3e0; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:24pt; font-weight:bold; color:#f57c00;">${stats.avgScore}</div>
          <div style="font-size:9pt; color:#f57c00;">Điểm TB</div>
        </div>
      </div>

      <!-- Score breakdown -->
      <h3 style="color:#333; margin-bottom:10px;">Điểm đánh giá chi tiết</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">Giáo viên</td>
          <td style="padding:8px; border:1px solid #ddd; text-align:right; font-weight:bold;">${stats.teacherAvg}/5</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">Chương trình học</td>
          <td style="padding:8px; border:1px solid #ddd; text-align:right; font-weight:bold;">${stats.curriculumAvg}/5</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">Chăm sóc khách hàng</td>
          <td style="padding:8px; border:1px solid #ddd; text-align:right; font-weight:bold;">${stats.serviceAvg}/5</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">Cơ sở vật chất</td>
          <td style="padding:8px; border:1px solid #ddd; text-align:right; font-weight:bold;">${stats.facilityAvg}/5</td>
        </tr>
      </table>

      <!-- Recent feedbacks -->
      <h3 style="color:#333; margin-bottom:10px;">Phản hồi gần đây (${recentFeedbacks.length}/${feedbacks.length})</h3>
      ${recentFeedbacks.map(fb => `
        <div style="background:#f5f5f5; padding:10px; border-radius:6px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span style="font-weight:bold;">${fb.date || fb.createdAt || ''}</span>
            <span style="font-size:9pt; background:${fb.type === 'Call' ? '#e8f5e9' : '#f3e5f5'}; padding:2px 8px; border-radius:10px;">
              ${fb.type === 'Call' ? 'Điện thoại' : 'Form'}
            </span>
          </div>
          <div style="font-size:10pt; color:#666;">${fb.content || fb.notes || 'Không có nội dung'}</div>
          ${fb.averageScore ? `<div style="font-size:10pt; margin-top:5px;"><strong>Điểm TB:</strong> ${fb.averageScore}</div>` : ''}
        </div>
      `).join('')}

      <p style="color:#999; font-size:9pt; margin-top:20px; text-align:center;">
        Xuất ngày ${new Date().toLocaleDateString('vi-VN')}
      </p>
    </div>
  `;
}
