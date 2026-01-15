/**
 * Contract PDF Generator Utility
 * Shared module for generating, printing, and downloading contract PDFs
 * Used by: ContractCreation (preview), ContractList (history)
 * Template matches sample PDF: HĐ_Hoàng Khánh Long - Peter_25_12_2025.pdf
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
  signatureUrl?: string; // URL to signature image for manager confirmation
  // List of all branches for header display
  branches?: Array<{ code: string; address: string }>;
  logoUrl?: string; // URL to company logo
}

/** Default center info (fallback) */
export const DEFAULT_CENTER_INFO: ContractCenterInfo = {
  centerName: 'BRISKY ENGLISH',
  representative: 'Nguyễn Thị Nga',
  address: 'Tây Mỗ, Nam Từ Liêm, Hà Nội',
  phone: '0965.262.311',
  email: 'briskycenter@gmail.com',
  signatureUrl: '/signature-party-a.png',
  logoUrl: '/logo.jpg',
  branches: [
    { code: 'CS1', address: 'Ô 40, LK4, KĐT Tân Tây Đô, Tân Lập, Đan Phượng' },
    { code: 'CS2', address: 'NV1-20, KĐT Coma 6, Tây Mỗ, Nam Từ Liêm' },
    { code: 'CS3', address: 'Ô 7, LK1, KĐT Tân Tây Đô, Tân Lập, Đan Phượng' },
  ],
};

/**
 * Generate contract HTML content for print/download
 * Template matches sample PDF: HĐ_Hoàng Khánh Long - Peter_25_12_2025.pdf
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
    : '';

  // Signature image HTML for manager confirmation
  const signatureUrl = centerInfo.signatureUrl !== undefined ? centerInfo.signatureUrl : '/signature-party-a.png';
  const signatureHTML = signatureUrl
    ? `<img src="${signatureUrl}" alt="Chữ ký" style="height: 50px; max-width: 150px; object-fit: contain;" onerror="this.style.display='none'" />`
    : '';

  // Logo HTML - height ~80px to match 5 lines of text
  const logoUrl = centerInfo.logoUrl || '/logo.jpg';
  const logoHTML = `<img src="${logoUrl}" alt="Logo" style="height: 80px; object-fit: contain;" onerror="this.style.display='none'" />`;

  // Branch list HTML - compact inline
  const branchesHTML = (centerInfo.branches || [])
    .map(b => `<div style="font-size: 10px; margin: 1px 0;"><strong>${b.code}:</strong> ${b.address}</div>`)
    .join('');

  // Table items with 8 columns matching PDF template
  const itemsHTML = (contract.items || [])
    .map(item => {
      const startDate = item.startDate ? new Date(item.startDate).toLocaleDateString('vi-VN') : '';
      const endDate = item.endDate ? new Date(item.endDate).toLocaleDateString('vi-VN') : '';
      const discount = item.discount ? Math.round(item.discount * 100) : 0;

      return `
      <tr>
        <td style="border: 1px solid #000; padding: 3px 4px; text-align: left;">${item.name}</td>
        <td style="border: 1px solid #000; padding: 3px 4px; text-align: center;">${item.className || ''}</td>
        <td style="border: 1px solid #000; padding: 3px 4px; text-align: center;">${item.quantity}</td>
        <td style="border: 1px solid #000; padding: 3px 4px; text-align: center;">${startDate}</td>
        <td style="border: 1px solid #000; padding: 3px 4px; text-align: center;">${endDate}</td>
        <td style="border: 1px solid #000; padding: 3px 4px; text-align: right;">${formatCurrency(item.subtotal || 0).replace(' ₫', '')}</td>
        <td style="border: 1px solid #000; padding: 3px 4px; text-align: center;">${discount > 0 ? discount + '%' : '0'}</td>
        <td style="border: 1px solid #000; padding: 3px 4px; text-align: right;">${formatCurrency(item.finalPrice || 0).replace(' ₫', '')}</td>
      </tr>
    `;
    })
    .join('');

  // Payment method display
  const paymentMethodDisplay = contract.status === ContractStatus.PAID ? 'Toàn phần' :
    (contract.remainingAmount && contract.remainingAmount > 0 ? 'Trả góp' : 'Toàn phần');

  // Remaining amount in words
  const remainingText = (contract.remainingAmount || 0) === 0 ? '(0 đồng)' : '';

  return `
    <!-- Header: Logo + Company Info (left) | Invoice Title (right) - Single row layout -->
    <table style="width: 100%; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 6px;">
      <tr>
        <td style="width: 80px; vertical-align: top;">${logoHTML}</td>
        <td style="vertical-align: top; padding-left: 10px;">
          <div style="font-weight: bold; font-size: 13px;">${centerInfo.centerName}</div>
          <div style="font-size: 10px;">Hotline: ${centerInfo.phone}</div>
          ${branchesHTML}
        </td>
        <td style="text-align: right; vertical-align: top; width: 180px;">
          <div style="font-size: 16px; font-weight: bold;">HOÁ ĐƠN THU TIỀN</div>
          <div style="font-size: 10px; margin-top: 3px;">Mã Hoá đơn: <strong>${contract.code || 'N/A'}</strong></div>
          <div style="font-size: 10px; margin-top: 2px;">Ngày xuất: <strong>${contractDate}</strong></div>
        </td>
      </tr>
    </table>

    <!-- Customer Info: Compact 2-column table layout -->
    <table style="width: 100%; font-size: 11px; margin: 6px 0;">
      <tr>
        <td style="width: 50%;"><strong>Học viên:</strong> ${contract.studentName || '---'}</td>
        <td><strong>Phụ huynh:</strong> ${contract.parentName || '---'}</td>
      </tr>
      <tr>
        <td><strong>Mã học viên:</strong> ${contract.studentId ? `Brk-HV-${contract.studentId.slice(-10)}` : '---'}</td>
        <td><strong>SĐT:</strong> ${contract.parentPhone || '---'}</td>
      </tr>
      <tr>
        <td><strong>Ngày sinh:</strong> ${studentDOB || '---'}</td>
        <td></td>
      </tr>
      <tr>
        <td><strong>Nhân viên thu:</strong> ${centerInfo.representative || ''}</td>
        <td></td>
      </tr>
    </table>

    <!-- Service Table -->
    <div style="margin: 8px 0;">
      <div style="text-align: right; font-size: 9px; margin-bottom: 2px;">Đơn vị: VNĐ</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="border: 1px solid #000; padding: 4px; text-align: left;">Khoá học/ Sản phẩm</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: center;">Lớp học</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: center; width: 40px;">Số buổi</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: center;">Bắt đầu</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: center;">Kết thúc</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: right;">Giá trị</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: center; width: 40px;">ƯĐHĐ</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: right;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      <div style="font-size: 8px; font-style: italic; margin-top: 2px; color: #666;">*ƯĐHĐ: ưu đãi được áp dụng trên hợp đồng</div>
    </div>

    <!-- Financial Summary - Right aligned, compact -->
    <div style="text-align: right; margin: 6px 0; font-size: 11px;">
      <div><strong>Tổng tiền cần thanh toán:</strong> ${formatCurrency(contract.totalAmount || 0).replace(' ₫', '')} VND</div>
      <div><strong>Hình thức thanh toán:</strong> ${paymentMethodDisplay}</div>
      <div><strong>Số tiền đã thanh toán:</strong> ${formatCurrency(contract.paidAmount || 0).replace(' ₫', '')}</div>
      <div><strong>Số tiền nợ còn lại:</strong> ${formatCurrency(contract.remainingAmount || 0).replace(' ₫', '')} VNĐ</div>
      ${remainingText ? `<div style="font-style: italic;">${remainingText}</div>` : ''}
    </div>

    <!-- Signatures: Compact layout -->
    <table style="width: 100%; margin-top: 15px;">
      <tr>
        <td style="width: 50%; text-align: center; vertical-align: top;">
          <div style="font-weight: bold; font-size: 11px;">Người nộp (ký tên)</div>
          <div style="height: 50px;"></div>
        </td>
        <td style="width: 50%; text-align: center; vertical-align: top;">
          <div style="font-weight: bold; font-size: 11px;">Xác Nhận từ quản lý cơ sở</div>
          <div style="height: 50px; display: flex; align-items: center; justify-content: center;">
            ${signatureHTML}
          </div>
          <div style="font-style: italic; font-size: 11px;">${centerInfo.representative || ''}</div>
        </td>
      </tr>
    </table>
  `;
}

/** CSS styles for contract PDF - Optimized for single A4 landscape page */
const CONTRACT_PDF_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  html, body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    line-height: 1.2;
    color: #000;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  body {
    padding: 8mm 10mm;
  }
  @media print {
    @page {
      size: A4 landscape;
      margin: 5mm;
    }
    html, body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;

/**
 * Convert image URL to base64 data URL for embedding in print/PDF
 * This ensures images work in new windows and cross-origin contexts
 */
async function imageToBase64(url: string): Promise<string> {
  return new Promise((resolve) => {
    // Handle empty or invalid URLs
    if (!url) {
      resolve('');
      return;
    }

    const img = new Image();
    // Don't set crossOrigin for same-origin requests to avoid CORS issues
    // Only set for external URLs
    if (url.startsWith('http') && !url.startsWith(window.location.origin)) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve('');
        }
      } catch (e) {
        console.error('Error converting image to base64:', e);
        resolve('');
      }
    };

    img.onerror = (e) => {
      console.error('Error loading image for base64 conversion:', url, e);
      resolve('');
    };

    // Handle relative URLs - convert to absolute for image loading
    if (url.startsWith('/')) {
      img.src = window.location.origin + url;
    } else {
      img.src = url;
    }
  });
}

/**
 * Print contract in new window
 * Converts signature and logo images to base64 to ensure they display in print dialog
 */
export async function printContract(
  contract: Contract,
  centerInfo?: ContractCenterInfo
): Promise<void> {
  // Convert signature to base64 before generating HTML
  // Use center's signature if provided, even if empty string (means center has no signature)
  // Only fallback to default signature if centerInfo is not provided at all
  const signatureUrl = centerInfo?.signatureUrl !== undefined
    ? centerInfo.signatureUrl
    : '/signature-party-a.png';
  const signatureBase64 = signatureUrl ? await imageToBase64(signatureUrl) : '';

  // Convert logo to base64
  const logoUrl = centerInfo?.logoUrl || '/logo.jpg';
  const logoBase64 = await imageToBase64(logoUrl);

  // Create centerInfo with base64 images
  const centerInfoWithBase64: ContractCenterInfo = {
    ...(centerInfo || DEFAULT_CENTER_INFO),
    signatureUrl: signatureBase64,
    logoUrl: logoBase64 || logoUrl,
  };

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Không thể mở cửa sổ in. Vui lòng cho phép popup.');
    return;
  }

  const htmlContent = generateContractHTML(contract, centerInfoWithBase64);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hoá đơn - ${contract.code || 'N/A'}</title>
        <style>${CONTRACT_PDF_STYLES}</style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  printWindow.document.close();

  // Wait for document to be ready before printing
  // This ensures any remaining resources are loaded
  setTimeout(() => {
    printWindow.print();
  }, 100);
}

/**
 * Download contract as PDF (auto-download using jspdf + html2canvas)
 * Generates PDF in A4 landscape and triggers automatic download
 */
export async function downloadContractAsPdf(
  contract: Contract,
  centerInfo?: ContractCenterInfo
): Promise<void> {
  // Format filename: HĐ_StudentName_DD_MM_YYYY.pdf
  const dateStr = contract.contractDate
    ? new Date(contract.contractDate).toLocaleDateString('vi-VN').replace(/\//g, '_')
    : new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
  const studentName = (contract.studentName || 'N/A').replace(/\s+/g, ' ').trim();
  const fileName = `HĐ_${studentName}_${dateStr}.pdf`;

  // Dynamically import jspdf and html2canvas for code splitting
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  // Create temporary container for rendering - A4 landscape optimized (1123px width for 297mm)
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 1100px;
    padding: 8px 15px;
    background: white;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.2;
    font-size: 10px;
    color: #000;
  `;
  container.innerHTML = generateContractHTML(contract, centerInfo);
  document.body.appendChild(container);

  // Wait for images to load
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Capture HTML as canvas
    const canvas = await html2canvas(container, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
    });

    // Calculate PDF dimensions (A4 landscape: 297mm x 210mm)
    const imgWidth = 297; // A4 landscape width in mm
    const pageHeight = 210; // A4 landscape height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF in landscape orientation
    const pdf = new jsPDF('l', 'mm', 'a4');

    // Fit content to single page by scaling if needed
    const scale = imgHeight > pageHeight ? pageHeight / imgHeight : 1;
    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;

    // Center content if scaled down
    const xOffset = (imgWidth - scaledWidth) / 2;
    const yOffset = (pageHeight - scaledHeight) / 2;

    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', xOffset, yOffset, scaledWidth, scaledHeight);

    // Auto download
    pdf.save(fileName);
  } finally {
    // Cleanup
    document.body.removeChild(container);
  }
}
