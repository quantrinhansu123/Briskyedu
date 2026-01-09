/**
 * Contract PDF Generator Utility
 * Shared module for generating, printing, and downloading contract PDFs
 * Used by: ContractCreation (preview), ContractList (history)
 */

import { Contract, ContractStatus } from '@/types';
import { formatCurrency } from './currencyUtils';

/** Center information for contract header */
export interface ContractCenterInfo {
  centerName: string;
  representative: string;
  address: string;
  phone: string;
  email: string;
}

/** Default center info (fallback) */
export const DEFAULT_CENTER_INFO: ContractCenterInfo = {
  centerName: 'TRUNG TÂM ANH NGỮ BRISKY',
  representative: 'Nguyễn Văn A - Giám đốc',
  address: 'Tây Mỗ, Nam Từ Liêm, Hà Nội',
  phone: '0912.345.678',
  email: 'contact@brisky.edu.vn',
};

/**
 * Generate contract HTML content for print/download
 * This is the ORIGINAL template from ContractCreation
 */
export function generateContractHTML(
  contract: Contract,
  centerInfo: ContractCenterInfo = DEFAULT_CENTER_INFO
): string {
  const contractDate = contract.contractDate
    ? new Date(contract.contractDate).toLocaleDateString('vi-VN')
    : new Date().toLocaleDateString('vi-VN');

  const studentDOB = contract.studentDOB
    ? new Date(contract.studentDOB).toLocaleDateString('vi-VN')
    : '---';

  const statusClass = contract.status === ContractStatus.PAID
    ? 'color: #16a34a; font-weight: bold;'
    : 'color: #ea580c;';

  const itemsHTML = (contract.items || [])
    .map((item, idx) => `
      <tr>
        <td style="border: 1px solid #333; padding: 8px;">${idx + 1}</td>
        <td style="border: 1px solid #333; padding: 8px;">${item.name}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align: right;">${formatCurrency(item.unitPrice || 0)}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align: center;">${item.quantity}</td>
        <td style="border: 1px solid #333; padding: 8px; text-align: right;">${formatCurrency(item.finalPrice || 0)}</td>
      </tr>
    `)
    .join('');

  return `
    <!-- Company Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="font-size: 24px; margin: 0; text-transform: uppercase; color: #4338ca;">${centerInfo.centerName}</h1>
      <p style="margin: 5px 0; color: #666;">Địa chỉ: ${centerInfo.address}</p>
      <p style="margin: 5px 0; color: #666;">Hotline: ${centerInfo.phone} | Email: ${centerInfo.email}</p>
    </div>

    <!-- Contract Title -->
    <div style="text-align: center; margin: 30px 0;">
      <h2 style="font-size: 20px; text-transform: uppercase; margin: 0;">HỢP ĐỒNG ĐĂNG KÝ KHÓA HỌC</h2>
      <p style="margin: 5px 0; color: #666;">Số: <strong>${contract.code || 'N/A'}</strong></p>
      <p style="margin: 5px 0; color: #666;">Ngày: ${contractDate}</p>
    </div>

    <!-- Party A - Center -->
    <div style="margin: 20px 0;">
      <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
        BÊN A: ${centerInfo.centerName}
      </div>
      <div style="font-size: 14px; line-height: 1.8;">
        <p style="margin: 4px 0;"><strong>Đại diện:</strong> ${centerInfo.representative}</p>
        <p style="margin: 4px 0;"><strong>Địa chỉ:</strong> ${centerInfo.address}</p>
        <p style="margin: 4px 0;"><strong>Điện thoại:</strong> ${centerInfo.phone}</p>
      </div>
    </div>

    <!-- Party B - Customer -->
    <div style="margin: 20px 0;">
      <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
        BÊN B: PHỤ HUYNH / HỌC VIÊN
      </div>
      <div style="font-size: 14px; line-height: 1.8;">
        <p style="margin: 4px 0;"><strong>Học viên:</strong> ${contract.studentName || '---'}</p>
        <p style="margin: 4px 0;"><strong>Ngày sinh:</strong> ${studentDOB}</p>
        <p style="margin: 4px 0;"><strong>Phụ huynh:</strong> ${contract.parentName || '---'}</p>
        <p style="margin: 4px 0;"><strong>Điện thoại:</strong> ${contract.parentPhone || '---'}</p>
      </div>
    </div>

    <!-- Contract Items -->
    <div style="margin: 20px 0;">
      <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
        NỘI DUNG HỢP ĐỒNG
      </div>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="border: 1px solid #333; padding: 8px; text-align: left;">STT</th>
            <th style="border: 1px solid #333; padding: 8px; text-align: left;">Nội dung</th>
            <th style="border: 1px solid #333; padding: 8px; text-align: right;">Đơn giá</th>
            <th style="border: 1px solid #333; padding: 8px; text-align: center;">SL</th>
            <th style="border: 1px solid #333; padding: 8px; text-align: right;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
          <tr style="font-weight: bold; background: #f9f9f9;">
            <td colspan="4" style="border: 1px solid #333; padding: 8px; text-align: right;">TỔNG CỘNG:</td>
            <td style="border: 1px solid #333; padding: 8px; text-align: right; color: #4338ca;">${formatCurrency(contract.totalAmount || 0)}</td>
          </tr>
        </tbody>
      </table>
      ${contract.totalAmountInWords ? `
        <div style="font-style: italic; background: #eef2ff; padding: 10px; margin: 10px 0; border-radius: 4px;">
          <strong>Bằng chữ:</strong> <em>${contract.totalAmountInWords}</em>
        </div>
      ` : ''}
    </div>

    <!-- Payment Info -->
    <div style="margin: 20px 0;">
      <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
        THÔNG TIN THANH TOÁN
      </div>
      <div style="font-size: 14px; line-height: 1.8;">
        <p style="margin: 4px 0;"><strong>Hình thức:</strong> ${contract.paymentMethod || '---'}</p>
        <p style="margin: 4px 0;"><strong>Trạng thái:</strong> <span style="${statusClass}">${contract.status}</span></p>
        <p style="margin: 4px 0;"><strong>Đã thanh toán:</strong> ${formatCurrency(contract.paidAmount || 0)}</p>
        <p style="margin: 4px 0;"><strong>Còn lại:</strong> ${formatCurrency(contract.remainingAmount || 0)}</p>
      </div>
    </div>

    <!-- Terms -->
    <div style="margin: 20px 0;">
      <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
        ĐIỀU KHOẢN HỢP ĐỒNG
      </div>
      <ol style="font-size: 14px; line-height: 1.8; padding-left: 20px;">
        <li>Bên B cam kết thanh toán đầy đủ học phí theo thỏa thuận.</li>
        <li>Bên A cam kết cung cấp dịch vụ giảng dạy theo chương trình đã đăng ký.</li>
        <li>Học phí đã đóng không được hoàn trả, trừ trường hợp bất khả kháng.</li>
        <li>Bên B có quyền bảo lưu khóa học trong thời gian tối đa 3 tháng.</li>
        <li>Hợp đồng có hiệu lực kể từ ngày ký.</li>
      </ol>
    </div>

    <!-- Signatures -->
    <div style="display: flex; justify-content: space-between; margin-top: 50px;">
      <div style="text-align: center; width: 200px;">
        <p style="font-weight: bold; margin: 0;">ĐẠI DIỆN BÊN A</p>
        <p style="font-size: 12px; color: #666; margin: 5px 0;">(Ký, ghi rõ họ tên)</p>
        <div style="border-top: 1px solid #333; margin-top: 60px; padding-top: 5px;"></div>
      </div>
      <div style="text-align: center; width: 200px;">
        <p style="font-weight: bold; margin: 0;">ĐẠI DIỆN BÊN B</p>
        <p style="font-size: 12px; color: #666; margin: 5px 0;">(Ký, ghi rõ họ tên)</p>
        <div style="border-top: 1px solid #333; margin-top: 60px; padding-top: 5px;"></div>
      </div>
    </div>
  `;
}

/** CSS styles for contract PDF */
const CONTRACT_PDF_STYLES = `
  body {
    font-family: 'Times New Roman', serif;
    padding: 40px;
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.6;
  }
  @media print {
    body { padding: 20px; }
  }
`;

/**
 * Print contract in new window
 */
export function printContract(
  contract: Contract,
  centerInfo?: ContractCenterInfo
): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Không thể mở cửa sổ in. Vui lòng cho phép popup.');
    return;
  }

  const htmlContent = generateContractHTML(contract, centerInfo);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hợp đồng - ${contract.code || 'N/A'}</title>
        <style>${CONTRACT_PDF_STYLES}</style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

/**
 * Download contract as PDF (auto-download using jspdf + html2canvas)
 * Generates PDF and triggers automatic download
 */
export async function downloadContractAsPdf(
  contract: Contract,
  centerInfo?: ContractCenterInfo
): Promise<void> {
  const fileName = `HopDong_${contract.code || 'N/A'}_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Dynamically import jspdf and html2canvas for code splitting
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  // Create temporary container for rendering
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 794px;
    padding: 40px;
    background: white;
    font-family: 'Times New Roman', serif;
    line-height: 1.6;
  `;
  container.innerHTML = generateContractHTML(contract, centerInfo);
  document.body.appendChild(container);

  try {
    // Capture HTML as canvas
    const canvas = await html2canvas(container, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Calculate PDF dimensions (A4)
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add more pages if content exceeds one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Auto download
    pdf.save(fileName);
  } finally {
    // Cleanup
    document.body.removeChild(container);
  }
}
