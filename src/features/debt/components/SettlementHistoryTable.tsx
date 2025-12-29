/**
 * SettlementHistoryTable Component
 * Reusable table for displaying settlement invoice history
 * Used in DebtManagement (all invoices) and StudentDetail (per student)
 */

import React, { useState } from 'react';
import { Eye, Download, FileText, Loader2 } from 'lucide-react';
import { SettlementInvoice } from '../../../../types';
import { previewSettlementInvoice, downloadSettlementInvoicePDF } from '../../../services/settlementInvoicePdfService';
import { formatCurrency } from '../../../utils/currencyUtils';

interface SettlementHistoryTableProps {
  invoices: SettlementInvoice[];
  loading: boolean;
  showStudentName?: boolean; // Hide in StudentDetail context
}

/**
 * Format ISO date to Vietnamese format (DD/MM/YYYY)
 */
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '---';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
};

export const SettlementHistoryTable: React.FC<SettlementHistoryTableProps> = ({
  invoices,
  loading,
  showStudentName = true,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (invoice: SettlementInvoice) => {
    setDownloadingId(invoice.id);
    try {
      await downloadSettlementInvoicePDF(invoice);
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Có lỗi khi tải PDF. Vui lòng thử lại.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20} />
        Đang tải...
      </div>
    );
  }

  // Empty state
  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText size={48} className="mx-auto mb-3 opacity-30" />
        <p>Chưa có phiếu tất toán nào</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-600">
            <th className="px-3 py-3 text-left font-medium">Mã phiếu</th>
            {showStudentName && (
              <th className="px-3 py-3 text-left font-medium">Học viên</th>
            )}
            <th className="px-3 py-3 text-left font-medium">Lớp</th>
            <th className="px-3 py-3 text-center font-medium">Số buổi</th>
            <th className="px-3 py-3 text-right font-medium">Số tiền</th>
            <th className="px-3 py-3 text-center font-medium">Trạng thái</th>
            <th className="px-3 py-3 text-center font-medium">Ngày</th>
            <th className="px-3 py-3 text-center font-medium">Hành động</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-gray-50">
              <td className="px-3 py-3 font-mono text-xs text-gray-600">
                {invoice.invoiceCode}
              </td>
              {showStudentName && (
                <td className="px-3 py-3 font-medium text-gray-800">
                  {invoice.studentName}
                </td>
              )}
              <td className="px-3 py-3 text-gray-600">
                {invoice.className}
              </td>
              <td className="px-3 py-3 text-center text-red-600 font-medium">
                +{invoice.debtSessions}
              </td>
              <td className="px-3 py-3 text-right font-medium">
                {formatCurrency(invoice.totalAmount)}
              </td>
              <td className="px-3 py-3 text-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  invoice.status === 'Đã thanh toán'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {invoice.status}
                </span>
              </td>
              <td className="px-3 py-3 text-center text-gray-500">
                {formatDate(invoice.createdAt)}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => previewSettlementInvoice(invoice)}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                    title="Xem trước"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(invoice)}
                    disabled={downloadingId === invoice.id}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                    title="Tải PDF"
                  >
                    {downloadingId === invoice.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SettlementHistoryTable;
