/**
 * Invoice Manager Page
 * Hóa đơn bán sách/sản phẩm
 */

import React, { useState } from 'react';
import { FileText, Plus, Search, X, Trash2, CheckCircle, XCircle, Printer, AlertTriangle } from 'lucide-react';
import { useInvoices } from '../src/hooks/useInvoices';
import { Invoice, InvoiceItem, InvoiceStatus } from '../src/services/invoiceService';
import { formatCurrency } from '../src/utils/currencyUtils';
import { usePermissions } from '../src/hooks/usePermissions';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  'Chờ thanh toán': 'bg-yellow-100 text-yellow-700',
  'Đã thanh toán': 'bg-green-100 text-green-700',
  'Đã hủy': 'bg-red-100 text-red-700',
};

export const InvoiceManager: React.FC = () => {
  const { invoices, loading, error, totalRevenue, pendingCount, createInvoice, markAsPaid, cancelInvoice, deleteInvoice } = useInvoices();
  
  // Permissions
  const { canCreate, canDelete, requiresApproval, isAdmin } = usePermissions();
  const canCreateInvoice = canCreate('invoices');
  const canDeleteInvoice = canDelete('invoices');
  const needsApprovalToDelete = requiresApproval('invoices');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleMarkPaid = async (id: string) => {
    try {
      await markAsPaid(id);
    } catch (err) {
      alert('Không thể cập nhật');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Hủy hóa đơn này?')) return;
    try {
      await cancelInvoice(id);
    } catch (err) {
      alert('Không thể hủy');
    }
  };

  const handleDelete = async (id: string) => {
    // CSKH needs admin approval to delete
    if (needsApprovalToDelete && !isAdmin) {
      setPendingDeleteId(id);
      alert('Yêu cầu xóa hóa đơn đã được gửi. Cần Admin duyệt để hoàn tất.');
      return;
    }
    
    if (!confirm('Xóa hóa đơn này?')) return;
    try {
      await deleteInvoice(id);
    } catch (err) {
      alert('Không thể xóa');
    }
  };

  // Filter invoices
  let filteredInvoices = invoices.filter(i => {
    const search = searchTerm.toLowerCase();
    const invoiceCode = (i.invoiceCode || '').toLowerCase();
    const customerName = (i.customerName || '').toLowerCase();
    const studentName = (i.studentName || '').toLowerCase();
    return invoiceCode.includes(search) || customerName.includes(search) || studentName.includes(search);
  });
  
  if (statusFilter) {
    filteredInvoices = filteredInvoices.filter(i => i.status === statusFilter);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileText className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Hóa đơn bán sách</h2>
              <p className="text-sm text-gray-500">Quản lý hóa đơn bán sản phẩm</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              Doanh thu: {formatCurrency(totalRevenue)}
            </span>
            <span className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium">
              Chờ TT: {pendingCount}
            </span>
            {canCreateInvoice && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <Plus size={16} /> Tạo hóa đơn
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Tìm theo mã HĐ, khách hàng..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="Chờ thanh toán">Chờ thanh toán</option>
            <option value="Đã thanh toán">Đã thanh toán</option>
            <option value="Đã hủy">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-600">
              <tr>
                <th className="px-4 py-3">Mã HĐ</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      Đang tải...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-red-500">Lỗi: {error}</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <FileText size={48} className="mx-auto mb-2 opacity-20" />
                    Chưa có hóa đơn nào
                  </td>
                </tr>
              ) : filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {invoice.invoiceCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{invoice.customerName}</div>
                    {invoice.customerPhone && (
                      <div className="text-xs text-gray-500">{invoice.customerPhone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600">
                      {invoice.items.slice(0, 2).map((item, idx) => (
                        <div key={idx}>{item.productName} x{item.quantity}</div>
                      ))}
                      {invoice.items.length > 2 && (
                        <div className="text-gray-400">+{invoice.items.length - 2} sản phẩm khác</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(invoice.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[invoice.status]}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('vi-VN') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {invoice.status === 'Chờ thanh toán' && (
                        <>
                          <button
                            onClick={() => invoice.id && handleMarkPaid(invoice.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Thanh toán"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => invoice.id && handleCancel(invoice.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Hủy"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {(canDeleteInvoice || needsApprovalToDelete) && (
                        <button
                          onClick={() => invoice.id && handleDelete(invoice.id)}
                          className={`p-1 rounded ${needsApprovalToDelete && !isAdmin ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-red-600'}`}
                          title={needsApprovalToDelete && !isAdmin ? "Xóa (cần Admin duyệt)" : "Xóa"}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <InvoiceModal
          onClose={() => setShowModal(false)}
          onSubmit={async (data) => {
            await createInvoice(data);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

// Invoice Modal
interface InvoiceModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<Invoice, 'id' | 'invoiceCode'>) => Promise<void>;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    studentName: '',
    paymentMethod: 'Tiền mặt',
    note: '',
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) {
      alert('Vui lòng nhập tên khách hàng');
      return;
    }
    if (items.some(i => !i.productName)) {
      alert('Vui lòng nhập tên sản phẩm');
      return;
    }
    if (items.some(i => i.unitPrice <= 0)) {
      alert('Vui lòng nhập đơn giá cho tất cả sản phẩm');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        items,
        subtotal,
        discount,
        total,
        status: 'Chờ thanh toán',
      });
    } catch (err) {
      console.error('Invoice creation error:', err);
      alert(`Không thể tạo hoá đơn: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-xl font-bold text-gray-800">Tạo hóa đơn mới</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên khách hàng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SĐT</label>
              <input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sản phẩm <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Tên sản phẩm"
                    value={item.productName}
                    onChange={(e) => updateItem(index, 'productName', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="SL"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Đơn giá"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)}
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <span className="w-28 text-right font-medium">{formatCurrency(item.total)}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              + Thêm sản phẩm
            </button>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Tạm tính:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span>Giảm giá:</span>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm"
              />
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
              <span>Tổng cộng:</span>
              <span className="text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment & Note */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hình thức TT</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option>Tiền mặt</option>
                <option>Chuyển khoản</option>
                <option>Thẻ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <input
                type="text"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Đang tạo...' : 'Tạo hóa đơn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
