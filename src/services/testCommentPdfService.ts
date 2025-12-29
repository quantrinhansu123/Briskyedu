/**
 * Test Comment PDF Service
 *
 * Generates PDF reports in Brisky format for test comments.
 * Layout follows the official Brisky template with:
 * - Header with logo and branch addresses
 * - Score table (3 columns: Listening, Reading/Writing, Speaking)
 * - Content descriptions, strengths, improvements per skill
 * - Learning attitude and parent message sections
 * - Teacher signature
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { TestComment, SkillScore, SkillContent } from '../../types';

// Branch addresses configuration
const BRISKY_BRANCHES = [
  'CS 1: Ô 40, LK4, KĐT Tân Tây Đô, Đan Phượng.',
  'CS 2: NV120, Coma6, Tây Mỗ, Nam Từ Liêm.',
  'CS 3: Ô 7, LK1, KĐT Tân Tây Đô, Đan Phượng.',
];
const BRISKY_HOTLINE = '0967.030.457';
const BRISKY_REFERRAL_MESSAGE = `Chương trình "GỬI LỜI YÊU THƯƠNG" tới bố mẹ có con theo học tại BRISKY!

Brisky rất cảm ơn bố mẹ khi đã tin tưởng gửi gắm con và giới thiệu thêm bạn bè, con cháu tham gia lớp học. Thay lời cảm ơn và tri ân tới bố mẹ, khi giới thiệu một học sinh thành công, Brisky xin gửi tặng 200k/1 bạn giới thiệu thành công (Trừ vào khóa học tới của con hoặc tiền mặt).

Brisky xin cảm ơn bố mẹ thật nhiều ạ!`;

// Ocean Academic Color Palette - Professional yet warm for English education
const COLORS = {
  headerBg: '#E8F0F7',        // Soft sky blue
  headerText: '#1E4D78',      // Deep ocean
  border: '#2E86AB',          // Brisky accent blue
  altRow: '#F8FAFC',          // Pearl white
  scoreHighlight: '#F0F7F4',  // Mint hint for score cells
  linkColor: '#2E86AB',       // Match border for links
};

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format score display (e.g., "12/13" or "8,5/10")
 */
function formatScore(score: SkillScore | undefined): string {
  if (!score) return '-/-';
  // Use comma for decimal in Vietnamese format
  const scoreStr = score.score.toString().replace('.', ',');
  return `${scoreStr}/${score.maxScore}`;
}

/**
 * Convert newlines to HTML line breaks and preserve formatting
 */
function formatText(text: string | undefined): string {
  if (!text) return '';
  return escapeHtml(text)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .join('<br/>');
}

/**
 * Generate HTML template for Brisky PDF
 */
function generateBriskyPDFHTML(data: TestComment): string {
  const hasContent = data.content?.listening || data.content?.readingWriting || data.content?.speaking;
  const hasStrengths = data.strengths?.listening || data.strengths?.readingWriting || data.strengths?.speaking;
  const hasImprovements = data.improvements?.listening || data.improvements?.readingWriting || data.improvements?.speaking;

  return `
    <div id="brisky-pdf" style="
      width: 210mm;
      padding: 12mm 18mm;
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      box-sizing: border-box;
    ">
      <!-- Header with Logo -->
      <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
        <div style="flex-shrink: 0; margin-right: 15px;">
          <img src="/logo.jpg" alt="Brisky Logo" style="width: 100px; height: auto;" crossorigin="anonymous" />
        </div>
        <div style="flex: 1;">
          <div style="font-weight: bold; font-size: 14pt; color: ${COLORS.headerText}; margin-bottom: 4px;">
            HỆ THỐNG ANH NGỮ QUỐC TẾ BRISKY
          </div>
          ${BRISKY_BRANCHES.map(branch => `<div style="font-size: 11pt;">${escapeHtml(branch)}</div>`).join('')}
          <div style="font-size: 11pt;"><strong>Hotline:</strong> ${BRISKY_HOTLINE}</div>
        </div>
      </div>

      <!-- Title -->
      <div style="text-align: center; margin: 15px 0;">
        <div style="font-weight: bold; font-size: 16pt; text-decoration: underline;">ĐÁNH GIÁ KẾT QUẢ BÀI TEST</div>
        <div style="font-weight: bold; font-size: 14pt; margin-top: 6px;">${escapeHtml(data.testName)}</div>
        ${data.unit ? `<div style="font-size: 12pt; margin-top: 3px;">(${escapeHtml(data.unit)})</div>` : ''}
        ${data.book ? `<div style="font-size: 12pt; margin-top: 3px;">Book: ${escapeHtml(data.book)}</div>` : ''}
      </div>

      <!-- Student Info -->
      <div style="margin: 15px 0;">
        <div style="margin-bottom: 8px;"><strong>Student's name:</strong> ${escapeHtml(data.studentName)}</div>
        ${data.videoLink ? `
          <div>
            <strong>Link video bài test của con:</strong><br/>
            <a href="${escapeHtml(data.videoLink)}" style="color: ${COLORS.linkColor}; word-break: break-all;">${escapeHtml(data.videoLink)}</a>
          </div>
        ` : ''}
      </div>

      <!-- Score Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; border: 1px solid ${COLORS.border};">
        <thead>
          <tr>
            <th style="border: 1px solid ${COLORS.border}; padding: 8px; width: 15%; background: ${COLORS.headerBg}; color: ${COLORS.headerText};"></th>
            <th style="border: 1px solid ${COLORS.border}; padding: 8px; width: 28%; text-align: center; background: ${COLORS.headerBg}; color: ${COLORS.headerText};">
              Listening<br/><span style="font-weight: normal;">(Nghe)</span>
            </th>
            <th style="border: 1px solid ${COLORS.border}; padding: 8px; width: 29%; text-align: center; background: ${COLORS.headerBg}; color: ${COLORS.headerText};">
              Reading and Writing<br/><span style="font-weight: normal;">(Đọc và Viết)</span>
            </th>
            <th style="border: 1px solid ${COLORS.border}; padding: 8px; width: 28%; text-align: center; background: ${COLORS.headerBg}; color: ${COLORS.headerText};">
              Speaking<br/><span style="font-weight: normal;">(Nói)</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Scores Row -->
          <tr>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; font-weight: bold; background: ${COLORS.headerBg}; color: ${COLORS.headerText};">Điểm số</td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; text-align: center; font-weight: bold; font-size: 14pt; background: ${COLORS.scoreHighlight};">
              ${formatScore(data.listeningScore)}
            </td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; text-align: center; font-weight: bold; font-size: 14pt; background: ${COLORS.scoreHighlight};">
              ${formatScore(data.readingWritingScore)}
            </td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; text-align: center; font-weight: bold; font-size: 14pt; background: ${COLORS.scoreHighlight};">
              ${formatScore(data.speakingScore)}
            </td>
          </tr>

          ${hasContent ? `
          <!-- Content Row -->
          <tr>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; font-weight: bold; vertical-align: top; background: ${COLORS.headerBg}; color: ${COLORS.headerText};">Nội dung</td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.content?.listening)}
            </td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.content?.readingWriting)}
            </td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.content?.speaking)}
            </td>
          </tr>
          ` : ''}

          ${hasStrengths ? `
          <!-- Strengths Row -->
          <tr>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; font-weight: bold; vertical-align: top; background: ${COLORS.headerBg}; color: ${COLORS.headerText};">Nội dung con làm tốt</td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.strengths?.listening)}
            </td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.strengths?.readingWriting)}
            </td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.strengths?.speaking)}
            </td>
          </tr>
          ` : ''}

          ${hasImprovements ? `
          <!-- Improvements Row -->
          <tr>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; font-weight: bold; vertical-align: top; background: ${COLORS.headerBg}; color: ${COLORS.headerText};">Nội dung con cần cải thiện</td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.improvements?.listening)}
            </td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.improvements?.readingWriting)}
            </td>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.improvements?.speaking)}
            </td>
          </tr>
          ` : ''}

          ${data.learningAttitude ? `
          <!-- Learning Attitude Row -->
          <tr>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; font-weight: bold; vertical-align: top; background: ${COLORS.headerBg}; color: ${COLORS.headerText};">
              Thái độ học tập của con trong quá trình học vừa rồi
            </td>
            <td colspan="3" style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.learningAttitude)}
            </td>
          </tr>
          ` : ''}

          ${data.parentMessage ? `
          <!-- Parent Message Row -->
          <tr>
            <td style="border: 1px solid ${COLORS.border}; padding: 8px; font-weight: bold; vertical-align: top; background: ${COLORS.headerBg}; color: ${COLORS.headerText};">
              Lời nhắn nhủ phụ huynh
            </td>
            <td colspan="3" style="border: 1px solid ${COLORS.border}; padding: 8px; vertical-align: top; font-size: 11pt;">
              ${formatText(data.parentMessage)}
            </td>
          </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- Referral Program -->
      <div style="margin: 20px 0 15px 0; text-align: justify; font-size: 11pt;">
        <div style="font-weight: bold; margin-bottom: 8px;">
          Chương trình "GỬI LỜI YÊU THƯƠNG" tới bố mẹ có con theo học tại BRISKY!
        </div>
        <p style="margin: 0 0 8px 0;">
          Brisky rất cảm ơn bố mẹ khi đã tin tưởng gửi gắm con và giới thiệu thêm bạn bè, con cháu tham gia lớp học. Thay lời cảm ơn và tri ân tới bố mẹ, khi giới thiệu một học sinh thành công, Brisky xin gửi tặng 200k/1 bạn giới thiệu thành công (Trừ vào khóa học tới của con hoặc tiền mặt).
        </p>
        <p style="margin: 0;">Brisky xin cảm ơn bố mẹ thật nhiều ạ!</p>
      </div>

      <!-- Teacher Signature -->
      <div style="text-align: right; margin-top: 25px;">
        <div style="font-weight: bold;">Giáo viên chủ nhiệm</div>
        <div style="margin-top: 20px; font-style: italic; font-size: 14pt;">
          ${escapeHtml(data.teacherName) || 'Ms./Mr. ___________'}
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate PDF for a single test comment report (Brisky format)
 */
export async function generateTestCommentPDF(data: TestComment): Promise<Blob> {
  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = generateBriskyPDFHTML(data);
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.background = '#fff';
  document.body.appendChild(container);

  // Wait for images to load
  const images = container.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Continue even if image fails
          }
        })
    )
  );

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    // Handle multi-page if content is too long
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = position - pdfHeight;  // Shift image UP by page height for next page
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
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
 * Generate and download PDF for a test comment
 */
export async function downloadTestCommentPDF(data: TestComment): Promise<void> {
  const blob = await generateTestCommentPDF(data);
  const filename = `${data.studentName}_${data.testName}_${data.testDate || new Date().toISOString().split('T')[0]}.pdf`;
  downloadBlob(blob, filename);
}
