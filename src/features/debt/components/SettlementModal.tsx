/**
 * SettlementModal Component
 * Modal for settling student fee debt
 * Allows payment or marking as bad debt
 */

import React, { useState } from 'react';
import { X, CreditCard, AlertTriangle, DollarSign } from 'lucide-react';
import { Student, SettlementInvoice, SettlementStatus } from '../../../../types';
import { SettlementInvoiceService } from '../../../services/settlementInvoiceService';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { formatCurrency } from '../../../utils/currencyUtils';

interface SettlementModalProps {
  student: Student;
  className: string;          // Class name for display
  courseName?: string;        // Curriculum name
  onClose: () => void;
  onSuccess?: () => void;
  staffName?: string;         // Current staff name
}

const PRICE_PER_SESSION = 150000;

export const SettlementModal: React.FC<SettlementModalProps> = ({
  student,
  className,
  courseName,
  onClose,
  onSuccess,
  staffName,
}) => {
  // Calculate debt
  const attendedSessions = student.attendedSessions || 0;
  const registeredSessions = student.registeredSessions || 0;
  const debtSessions = Math.max(0, attendedSessions - registeredSessions);
  const totalAmount = debtSessions * PRICE_PER_SESSION;

  // Form state
  const [settlementType, setSettlementType] = useState<SettlementStatus>('Đã thanh toán');
  const [paymentMethod, setPaymentMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: No debt to settle
    if (debtSessions <= 0) {
      alert('Học viên không có nợ phí để tất toán.');
      return;
    }

    // Sanitize note input (remove potential script tags)
    const sanitizedNote = note.replace(/<[^>]*>/g, '').trim();

    const confirmMsg = settlementType === 'Đã thanh toán'
      ? `Xác nhận thu ${formatCurrency(totalAmount)} từ học viên ${student.fullName}?`
      : `Xác nhận ghi nợ xấu ${formatCurrency(totalAmount)} cho học viên ${student.fullName}?`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      // Use transaction for atomic operations
      await runTransaction(db, async (transaction) => {
        // 1. Get current student state
        const studentRef = doc(db, 'students', student.id);
        const studentSnap = await transaction.get(studentRef);

        if (!studentSnap.exists()) {
          throw new Error('Học viên không tồn tại');
        }

        // 2. Prepare invoice data
        const invoiceData: Omit<SettlementInvoice, 'id' | 'invoiceCode' | 'createdAt'> = {
          invoiceDate: new Date().toISOString(),
          studentId: student.id,
          studentCode: student.code || '',
          studentName: student.fullName,
          studentPhone: student.phone,
          studentDob: student.dob,
          parentName: student.parentName || '',
          courseName: courseName || 'Khóa học tiếng Anh',
          className: className,
          totalSessions: registeredSessions,
          attendedSessions: attendedSessions,
          debtSessions: debtSessions,
          startDate: student.startDate,
          pricePerSession: PRICE_PER_SESSION,
          totalAmount: totalAmount,
          paidAmount: settlementType === 'Đã thanh toán' ? totalAmount : 0,
          remainingAmount: settlementType === 'Đã thanh toán' ? 0 : totalAmount,
          status: settlementType,
          paymentMethod: settlementType === 'Đã thanh toán' ? paymentMethod : undefined,
          collectedByName: staffName,
          note: sanitizedNote || undefined,
        };

        // 3. Create invoice (outside transaction, but acceptable for this use case)
        await SettlementInvoiceService.create(invoiceData);

        // 4. Prepare student update
        const studentUpdate: Record<string, unknown> = {
          status: 'Nghỉ học',
          classId: null,
          classIds: [],
          class: null,
        };

        // If bad debt, also update bad debt fields
        if (settlementType === 'Nợ xấu') {
          studentUpdate.badDebt = true;
          studentUpdate.badDebtSessions = debtSessions;
          studentUpdate.badDebtAmount = totalAmount;
          studentUpdate.badDebtDate = new Date().toISOString();
          studentUpdate.badDebtNote = sanitizedNote || `Nợ ${debtSessions} buổi - Tất toán`;
        }

        // 5. Update student atomically
        transaction.update(studentRef, studentUpdate);
      });

      alert(settlementType === 'Đã thanh toán'
        ? 'Đã tất toán thành công! Học viên chuyển sang trạng thái Nghỉ học.'
        : 'Đã ghi nhận nợ xấu! Học viên chuyển sang trạng thái Nghỉ học.'
      );

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Settlement error:', err);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-red-500 to-red-600 rounded-t-xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CreditCard size={20} />
            Tất toán hợp đồng
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Student Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Học viên:</span>
                <span className="ml-2 font-medium">{student.fullName}</span>
              </div>
              <div>
                <span className="text-gray-500">Mã:</span>
                <span className="ml-2 font-medium">{student.code || '---'}</span>
              </div>
              <div>
                <span className="text-gray-500">Phụ huynh:</span>
                <span className="ml-2 font-medium">{student.parentName || '---'}</span>
              </div>
              <div>
                <span className="text-gray-500">Lớp:</span>
                <span className="ml-2 font-medium">{className}</span>
              </div>
            </div>
          </div>

          {/* Debt Calculation */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} />
              Chi tiết nợ phí
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Số buổi đăng ký:</span>
                <span className="font-medium">{registeredSessions} buổi</span>
              </div>
              <div className="flex justify-between">
                <span>Số buổi đã học:</span>
                <span className="font-medium">{attendedSessions} buổi</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Số buổi nợ:</span>
                <span className="font-bold">+{debtSessions} buổi</span>
              </div>
              <div className="flex justify-between">
                <span>Đơn giá:</span>
                <span>{formatCurrency(PRICE_PER_SESSION)}/buổi</span>
              </div>
              <div className="border-t border-red-200 pt-2 mt-2 flex justify-between text-lg">
                <span className="font-semibold text-red-800">TỔNG TIỀN NỢ:</span>
                <span className="font-bold text-red-600">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Settlement Type */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Hình thức tất toán:
            </label>

            {/* Option 1: Pay */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              settlementType === 'Đã thanh toán'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="settlementType"
                value="Đã thanh toán"
                checked={settlementType === 'Đã thanh toán'}
                onChange={(e) => setSettlementType(e.target.value as SettlementStatus)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-green-700 flex items-center gap-2">
                  <DollarSign size={16} />
                  Thanh toán đầy đủ
                </div>
                {settlementType === 'Đã thanh toán' && (
                  <div className="mt-2">
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'Tiền mặt' | 'Chuyển khoản')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="Tiền mặt">Tiền mặt</option>
                      <option value="Chuyển khoản">Chuyển khoản</option>
                    </select>
                  </div>
                )}
              </div>
            </label>

            {/* Option 2: Bad Debt */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              settlementType === 'Nợ xấu'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="settlementType"
                value="Nợ xấu"
                checked={settlementType === 'Nợ xấu'}
                onChange={(e) => setSettlementType(e.target.value as SettlementStatus)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-red-700 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Ghi nhận nợ xấu
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Phụ huynh không thanh toán, ghi nhận vào danh sách nợ xấu
                </p>
              </div>
            </label>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ghi chú
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ghi chú thêm (nếu có)..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || debtSessions === 0}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
                settlementType === 'Đã thanh toán'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
            >
              {loading ? 'Đang xử lý...' : 'Xác nhận tất toán'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettlementModal;
