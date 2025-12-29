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
const BRISKY_HOTLINE = '0965.262.311';

// Brisky template uses simple black borders and minimal colors

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
 * Layout matches Brisky "HÓA ĐƠN THU TIỀN" template exactly
 */
function generateSettlementInvoiceHTML(data: SettlementInvoice): string {
  // Calculate final amount after discount
  const finalAmount = data.totalAmount - (data.discount || 0);
  // Use current date as end date if not provided (handle empty string edge case)
  const endDate = data.endDate?.trim() || new Date().toISOString();

  return `
    <div id="settlement-invoice-pdf" style="
      width: 210mm;
      padding: 10mm 15mm;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      box-sizing: border-box;
    ">
      <!-- Header Row: Logo+Info LEFT, Invoice Info RIGHT -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
        <!-- Left: Logo + Company Info -->
        <div style="display: flex; align-items: flex-start;">
          <img src="/logo.jpg" alt="Brisky Logo" style="width: 80px; height: auto; margin-right: 12px;" crossorigin="anonymous" />
          <div>
            <div style="font-weight: bold; font-size: 12pt;">BRISKY ENGLISH</div>
            <div style="font-size: 10pt;">Hotline: ${BRISKY_HOTLINE}</div>
            ${BRISKY_BRANCHES.map(branch => `<div style="font-size: 9pt;">${escapeHtml(branch)}</div>`).join('')}
          </div>
        </div>
        <!-- Right: Invoice Info -->
        <div style="text-align: right;">
          <div style="font-weight: bold; font-size: 14pt;">HÓA ĐƠN THU TIỀN</div>
          <div style="font-size: 10pt; margin-top: 5px;">Mã Hoá đơn:</div>
          <div style="font-size: 11pt; font-weight: bold;">${escapeHtml(data.invoiceCode)}</div>
          <div style="font-size: 10pt; margin-top: 3px;">Ngày xuất: ${formatDate(data.invoiceDate)}</div>
        </div>
      </div>

      <!-- Student Info: 2-column inline (matching Brisky layout) -->
      <div style="display: flex; justify-content: space-between; margin: 15px 0; padding: 10px 0; border-top: 1px solid #ddd;">
        <div style="flex: 1;">
          <div style="margin-bottom: 5px;"><strong>Học viên:</strong> ${escapeHtml(data.studentName)}</div>
          <div style="margin-bottom: 5px;"><strong>Mã học viên:</strong> ${escapeHtml(data.studentCode) || '---'}</div>
          <div style="margin-bottom: 5px;"><strong>Ngày sinh:</strong> ${formatDate(data.studentDob)}</div>
          <div><strong>Nhân viên thu:</strong> ${escapeHtml(data.collectedByName) || '---'}</div>
        </div>
        <div style="flex: 1; text-align: right;">
          <div style="margin-bottom: 5px;"><strong>Phụ huynh:</strong> ${escapeHtml(data.parentName) || '---'}</div>
          <div><strong>SĐT:</strong> ${escapeHtml(data.studentPhone) || '---'}</div>
        </div>
      </div>

      <!-- Table Header: "Đơn vị: VNĐ" right-aligned -->
      <div style="text-align: right; margin-bottom: 5px; font-size: 10pt;">Đơn vị: VNĐ</div>

      <!-- 8-Column Table (Brisky format) -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 10pt;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="border: 1px solid #000; padding: 8px; text-align: center;">Khoá học/<br/>Sản phẩm</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;">Lớp học</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;">Số buổi</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;">Bắt đầu</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;">Kết thúc</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;">Giá trị</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;">ƯĐHĐ</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px;">Buổi học nợ<br/>(Tất toán ${data.debtSessions} buổi)</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${escapeHtml(data.className)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${data.debtSessions}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${formatDate(data.startDate)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${formatDate(endDate)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(data.totalAmount)}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${data.discount ? formatCurrency(data.discount) : '0'}</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatCurrency(finalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Note below table -->
      <div style="font-size: 9pt; margin-top: 5px; font-style: italic;">*ƯĐHĐ: ưu đãi được áp dụng trên hợp đồng</div>

      <!-- Summary Section: Right-aligned (matching Brisky format) -->
      <div style="text-align: right; margin: 20px 0; line-height: 1.8;">
        <div>Tổng tiền cần thanh toán: <strong>${formatCurrency(finalAmount)} VND</strong></div>
        <div>Hình thức thanh toán: <strong>${escapeHtml(data.paymentMethod) || 'Toàn phần'}</strong></div>
        <div>Số tiền đã thanh toán: <strong>${formatCurrency(data.paidAmount)}</strong></div>
        <div>Số tiền nợ còn lại: <strong>${formatCurrency(data.remainingAmount)} VNĐ</strong></div>
        ${data.remainingAmount === 0 ? '<div style="font-size: 10pt;">(0 đồng)</div>' : ''}
      </div>

      ${data.note ? `<div style="margin: 10px 0; font-size: 10pt;"><strong>Ghi chú:</strong> ${escapeHtml(data.note)}</div>` : ''}

      <!-- Signatures (Brisky labels) -->
      <div style="display: flex; justify-content: space-around; margin-top: 40px;">
        <div style="text-align: center; width: 40%;">
          <div style="font-weight: bold;">Người nộp (ký tên)</div>
          <div style="margin-top: 60px;">_______________</div>
        </div>
        <div style="text-align: center; width: 40%;">
          <div style="font-weight: bold;">Xác Nhận từ quản lý cơ sở</div>
          <div style="margin-top: 60px;">_______________</div>
        </div>
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
