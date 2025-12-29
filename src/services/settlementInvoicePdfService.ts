/**
 * Settlement Invoice PDF Service
 *
 * Generates PDF invoices in Brisky format for fee settlement.
 * Layout follows the official Brisky template with:
 * - Header with logo and branch addresses
 * - Invoice info and student details
 * - Session calculation table
 * - Payment summary
 * - Signatures
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SettlementInvoice } from '../../types';
import { formatCurrency } from '../utils/currencyUtils';

// Branch addresses configuration (shared with testCommentPdfService)
const BRISKY_BRANCHES = [
  'CS 1: Ô 40, LK4, KĐT Tân Tây Đô, Đan Phượng.',
  'CS 2: NV120, Coma6, Tây Mỗ, Nam Từ Liêm.',
  'CS 3: Ô 7, LK1, KĐT Tân Tây Đô, Đan Phượng.',
];
const BRISKY_HOTLINE = '0967.030.457';

// Ocean Academic Color Palette - Professional yet warm for English education
const COLORS = {
  headerBg: '#E8F0F7',        // Soft sky blue
  headerText: '#1E4D78',      // Deep ocean
  border: '#2E86AB',          // Brisky accent blue
  altRow: '#F8FAFC',          // Pearl white
  amountHighlight: '#FEF3C7', // Amber hint for amounts
  badDebt: '#FEE2E2',         // Red hint for bad debt
  paid: '#D1FAE5',            // Green hint for paid
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
 * Format date to Vietnamese format (DD/MM/YYYY)
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '---';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
}

/**
 * Generate HTML template for Settlement Invoice PDF
 */
function generateSettlementInvoiceHTML(data: SettlementInvoice): string {
  const isPaid = data.status === 'Đã thanh toán';
  const statusBg = isPaid ? COLORS.paid : COLORS.badDebt;
  const statusText = isPaid ? '#065F46' : '#991B1B';

  return `
    <div id="settlement-invoice-pdf" style="
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
      <div style="text-align: center; margin: 20px 0;">
        <div style="font-weight: bold; font-size: 18pt; text-decoration: underline; color: ${COLORS.headerText};">
          PHIẾU TẤT TOÁN HỢP ĐỒNG
        </div>
        <div style="font-size: 12pt; margin-top: 8px; color: #666;">
          Mã phiếu: <strong>${escapeHtml(data.invoiceCode)}</strong>
        </div>
        <div style="font-size: 12pt; color: #666;">
          Ngày lập: <strong>${formatDate(data.invoiceDate)}</strong>
        </div>
      </div>

      <!-- Student Info Section -->
      <div style="margin: 20px 0; padding: 15px; background: ${COLORS.altRow}; border-radius: 8px; border: 1px solid #E5E7EB;">
        <div style="font-weight: bold; font-size: 13pt; margin-bottom: 10px; color: ${COLORS.headerText};">
          THÔNG TIN HỌC VIÊN
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 0; width: 50%;">
              <strong>Họ tên:</strong> ${escapeHtml(data.studentName)}
            </td>
            <td style="padding: 5px 0;">
              <strong>Mã HV:</strong> ${escapeHtml(data.studentCode) || '---'}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">
              <strong>Ngày sinh:</strong> ${formatDate(data.studentDob)}
            </td>
            <td style="padding: 5px 0;">
              <strong>SĐT:</strong> ${escapeHtml(data.studentPhone) || '---'}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;" colspan="2">
              <strong>Phụ huynh:</strong> ${escapeHtml(data.parentName) || '---'}
            </td>
          </tr>
        </table>
      </div>

      <!-- Course Info Section -->
      <div style="margin: 20px 0; padding: 15px; background: ${COLORS.altRow}; border-radius: 8px; border: 1px solid #E5E7EB;">
        <div style="font-weight: bold; font-size: 13pt; margin-bottom: 10px; color: ${COLORS.headerText};">
          THÔNG TIN KHÓA HỌC
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 0; width: 50%;">
              <strong>Khóa học:</strong> ${escapeHtml(data.courseName)}
            </td>
            <td style="padding: 5px 0;">
              <strong>Lớp:</strong> ${escapeHtml(data.className)}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">
              <strong>Ngày bắt đầu:</strong> ${formatDate(data.startDate)}
            </td>
            <td style="padding: 5px 0;">
              <strong>Ngày kết thúc:</strong> ${formatDate(data.endDate) || 'Hiện tại'}
            </td>
          </tr>
        </table>
      </div>

      <!-- Session Calculation Table -->
      <div style="margin: 20px 0;">
        <div style="font-weight: bold; font-size: 13pt; margin-bottom: 10px; color: ${COLORS.headerText};">
          CHI TIẾT TẤT TOÁN
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid ${COLORS.border};">
          <thead>
            <tr>
              <th style="border: 1px solid ${COLORS.border}; padding: 10px; background: ${COLORS.headerBg}; color: ${COLORS.headerText}; text-align: left;">
                Hạng mục
              </th>
              <th style="border: 1px solid ${COLORS.border}; padding: 10px; background: ${COLORS.headerBg}; color: ${COLORS.headerText}; text-align: center; width: 25%;">
                Số lượng
              </th>
              <th style="border: 1px solid ${COLORS.border}; padding: 10px; background: ${COLORS.headerBg}; color: ${COLORS.headerText}; text-align: right; width: 25%;">
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px;">
                Số buổi đăng ký
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: center;">
                ${data.totalSessions} buổi
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: right;">
                ---
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px;">
                Số buổi đã học
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: center;">
                ${data.attendedSessions} buổi
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: right;">
                ---
              </td>
            </tr>
            <tr style="background: ${COLORS.amountHighlight};">
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; font-weight: bold; color: #92400E;">
                Số buổi nợ
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: center; font-weight: bold; color: #92400E;">
                +${data.debtSessions} buổi
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: right;">
                ---
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px;">
                Đơn giá / buổi
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: center;">
                ---
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: right;">
                ${formatCurrency(data.pricePerSession)}
              </td>
            </tr>
            ${data.discount ? `
            <tr>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px;">
                Giảm giá
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: center;">
                ---
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 10px; text-align: right; color: #059669;">
                -${formatCurrency(data.discount)}
              </td>
            </tr>
            ` : ''}
            <tr style="background: ${statusBg};">
              <td style="border: 1px solid ${COLORS.border}; padding: 12px; font-weight: bold; font-size: 14pt;" colspan="2">
                TỔNG TIỀN CẦN THANH TOÁN
              </td>
              <td style="border: 1px solid ${COLORS.border}; padding: 12px; text-align: right; font-weight: bold; font-size: 16pt; color: ${statusText};">
                ${formatCurrency(data.totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Payment Status Section -->
      <div style="margin: 20px 0; padding: 15px; background: ${statusBg}; border-radius: 8px; border: 2px solid ${isPaid ? '#10B981' : '#EF4444'};">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; width: 50%;">
              <strong>Trạng thái:</strong>
              <span style="font-weight: bold; font-size: 14pt; color: ${statusText}; margin-left: 10px;">
                ${escapeHtml(data.status)}
              </span>
            </td>
            <td style="padding: 8px 0;">
              ${isPaid ? `<strong>Phương thức:</strong> ${escapeHtml(data.paymentMethod) || '---'}` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <strong>Số tiền đã thu:</strong>
              <span style="font-weight: bold; color: ${statusText}; margin-left: 10px;">
                ${formatCurrency(data.paidAmount)}
              </span>
            </td>
            <td style="padding: 8px 0;">
              <strong>Còn lại:</strong>
              <span style="font-weight: bold; color: ${data.remainingAmount > 0 ? '#DC2626' : '#059669'}; margin-left: 10px;">
                ${formatCurrency(data.remainingAmount)}
              </span>
            </td>
          </tr>
          ${data.note ? `
          <tr>
            <td style="padding: 8px 0;" colspan="2">
              <strong>Ghi chú:</strong> ${escapeHtml(data.note)}
            </td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding: 0 20px;">
        <div style="text-align: center; width: 40%;">
          <div style="font-weight: bold;">Người lập phiếu</div>
          <div style="margin-top: 50px; font-style: italic;">
            ${escapeHtml(data.collectedByName) || '_______________'}
          </div>
        </div>
        <div style="text-align: center; width: 40%;">
          <div style="font-weight: bold;">Phụ huynh xác nhận</div>
          <div style="margin-top: 50px; font-style: italic;">
            ${escapeHtml(data.parentName) || '_______________'}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 30px; text-align: center; font-size: 10pt; color: #666; border-top: 1px solid #E5E7EB; padding-top: 15px;">
        Phiếu này được in tự động từ hệ thống EduManager Pro<br/>
        Ngày in: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}
      </div>
    </div>
  `;
}

/**
 * Generate PDF for settlement invoice (Brisky format)
 */
export async function generateSettlementInvoicePDF(data: SettlementInvoice): Promise<Blob> {
  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = generateSettlementInvoiceHTML(data);
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
      position = position - pdfHeight;
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
 * Generate and download PDF for settlement invoice
 */
export async function downloadSettlementInvoicePDF(data: SettlementInvoice): Promise<void> {
  const blob = await generateSettlementInvoicePDF(data);
  const filename = `TatToan_${data.studentName}_${data.invoiceCode}.pdf`;
  downloadBlob(blob, filename);
}
