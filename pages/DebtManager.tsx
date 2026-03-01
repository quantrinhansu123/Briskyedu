/**
 * Debt Manager Page
 * Quản lý công nợ học viên
 */

import React, { useState } from 'react';
import { AlertTriangle, Search, CheckCircle, Phone, User, Calendar, DollarSign, X, MessageSquare } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { useDebt } from '../src/hooks/useDebt';
import { DebtRecord } from '../src/services/debtService';
import { formatCurrency } from '../src/utils/currencyUtils';

export const DebtManager: React.FC = () => {
  const { debts, totalDebt, loading, error, markAsPaid, updateNote } = useDebt();
  const [searchTerm, setSearchTerm] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtRecord | null>(null);

  const handleMarkPaid = async (debt: DebtRecord) => {
    setSelectedDebt(debt);
    setShowPayModal(true);
  };

  const confirmPayment = async (amount: number) => {
    if (!selectedDebt) return;
    try {
      await markAsPaid(selectedDebt.id, amount);
      setShowPayModal(false);
      setSelectedDebt(null);
    } catch (err) {
      alert('Không thể cập nhật');
    }
  };

  // Filter debts
  const filteredDebts = debts.filter(d =>
    d.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.contractCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check overdue
  const today = new Date().toISOString().split('T')[0];
  const overdueCount = debts.filter(d => d.dueDate && d.dueDate < today).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Quản lý công nợ</h2>
              <p className="text-sm text-gray-500">Theo dõi và thu hồi công nợ học viên</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
              Tổng nợ: {formatCurrency(totalDebt)}
            </span>
            <span className="text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-medium">
              Quá hạn: {overdueCount}
            </span>
            <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium">
              {debts.length} học viên
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Tìm theo tên học viên, lớp, mã HĐ..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Debt List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-red-50 text-xs uppercase font-semibold text-gray-600">
              <tr>
                <th className="px-4 py-3">Mã HĐ</th>
                <th className="px-4 py-3">Học viên</th>
                <th className="px-4 py-3">Lớp</th>
                <th className="px-4 py-3">Phụ huynh</th>
                <th className="px-4 py-3 text-right">Tổng phí</th>
                <th className="px-4 py-3 text-right">Đã đóng</th>
                <th className="px-4 py-3 text-right">Còn nợ</th>
                <th className="px-4 py-3 text-center">Hạn thanh toán</th>
                <th className="px-4 py-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                      Đang tải...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-red-500">Lỗi: {error}</td>
                </tr>
              ) : filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    <CheckCircle size={48} className="mx-auto mb-2 opacity-20 text-green-500" />
                    <p>Không có công nợ nào</p>
                  </td>
                </tr>
              ) : filteredDebts.map((debt) => {
                const isOverdue = debt.dueDate && debt.dueDate < today;
                return (
                  <tr key={debt.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {debt.contractCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="font-medium text-gray-900">{debt.studentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{debt.className}</td>
                    <td className="px-4 py-3">
                      {debt.parentPhone ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Phone size={12} className="text-gray-400" />
                          <span>{debt.parentPhone}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(debt.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(debt.paidAmount)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-red-600">{formatCurrency(debt.debtAmount)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {debt.dueDate ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                          isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Calendar size={12} />
                          {debt.dueDate}
                          {isOverdue && <AlertTriangle size={12} />}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleMarkPaid(debt)}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 flex items-center gap-1"
                        >
                          <DollarSign size={12} />
                          Thu tiền
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        {debts.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Hiển thị {filteredDebts.length} / {debts.length} công nợ
            </span>
            <div className="flex gap-4 text-sm">
              <span>Tổng còn nợ: <strong className="text-red-600">{formatCurrency(totalDebt)}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPayModal && selectedDebt && (
        <PaymentModal
          debt={selectedDebt}
          onClose={() => { setShowPayModal(false); setSelectedDebt(null); }}
          onConfirm={confirmPayment}
        />
      )}
    </div>
  );
};

// Payment Modal
interface PaymentModalProps {
  debt: DebtRecord;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ debt, onClose, onConfirm }) => {
  const [amount, setAmount] = useState(debt.debtAmount);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm(debt.paidAmount + amount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-800">Xác nhận thanh toán</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Học viên:</span>
              <span className="font-medium">{debt.studentName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Mã HĐ:</span>
              <span className="font-mono">{debt.contractCode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tổng phí:</span>
              <span>{formatCurrency(debt.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Đã đóng:</span>
              <span className="text-green-600">{formatCurrency(debt.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
              <span className="text-red-600">Còn nợ:</span>
              <span className="text-red-600">{formatCurrency(debt.debtAmount)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số tiền thu <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              max={debt.debtAmount}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Thanh toán tối đa: {formatCurrency(debt.debtAmount)}
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || amount <= 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle size={16} />
              {loading ? 'Đang xử lý...' : 'Xác nhận thu tiền'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
