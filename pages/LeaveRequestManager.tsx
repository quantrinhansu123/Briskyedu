/**
 * Leave Request Manager Page
 * - Staff: Submit leave requests, view own requests
 * - Admin: View all, approve/reject
 *
 * UI Reference: WorkConfirmation.tsx pattern
 */
import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  User,
  FileText,
  Filter,
  Search
} from 'lucide-react';
import { useLeaveRequests } from '../src/hooks/useLeaveRequests';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { useLeaveBalance } from '../src/hooks/useLeaveBalance';
import { LeaveRequest, LeaveType, LeaveRequestStatus } from '../types';

// Leave types for dropdown
const LEAVE_TYPES: LeaveType[] = [
  'Nghỉ phép',
  'Nghỉ ốm',
  'Nghỉ việc riêng',
  'Nghỉ không lương'
];

export const LeaveRequestManager: React.FC = () => {
  const { staffId, staffData } = useAuth();
  const { canApprove } = usePermissions();
  const canApproveLeave = canApprove('leave_request');

  // Determine if showing all (admin) or own (staff)
  const filterOptions = canApproveLeave ? undefined : { staffId: staffId || '' };
  const {
    requests,
    loading,
    error,
    submitRequest,
    approveRequest,
    rejectRequest,
    deleteRequest
  } = useLeaveRequests(filterOptions);

  // Leave balance for current staff
  const { balance, checkBalance, refreshBalance } = useLeaveBalance(
    staffData?.id,
    staffData?.name
  );

  // UI State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'Nghỉ phép' as LeaveType,
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (searchTerm && !r.staffName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [requests, statusFilter, searchTerm]);

  // Calculate days
  const calculateDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = endDate.getTime() - startDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate || !form.reason) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (!staffData) {
      alert('Không tìm thấy thông tin nhân viên');
      return;
    }

    // Validation: No past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(form.startDate);
    const endDate = new Date(form.endDate);

    if (startDate < today) {
      alert('Không thể chọn ngày nghỉ trong quá khứ');
      return;
    }

    if (endDate < startDate) {
      alert('Ngày kết thúc phải sau ngày bắt đầu');
      return;
    }

    // Validation: Advance notice for long leave
    const requestedDays = calculateDays(form.startDate, form.endDate);
    const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Same-day or next-day request not allowed
    if (daysUntilStart < 1) {
      alert('Phải xin nghỉ trước ít nhất 1 ngày');
      return;
    }

    // 3+ days leave requires 3+ days advance notice
    if (requestedDays >= 3 && daysUntilStart < 3) {
      alert(`Nghỉ từ 3 ngày trở lên phải báo trước ít nhất 3 ngày (hiện tại chỉ còn ${daysUntilStart} ngày)`);
      return;
    }

    // 5+ days leave requires 7+ days advance notice
    if (requestedDays >= 5 && daysUntilStart < 7) {
      alert(`Nghỉ từ 5 ngày trở lên phải báo trước ít nhất 7 ngày (hiện tại chỉ còn ${daysUntilStart} ngày)`);
      return;
    }

    // Check balance for paid leave (Nghỉ phép)
    if (form.leaveType === 'Nghỉ phép') {
      const { hasBalance, remaining, requested } = await checkBalance(
        form.startDate,
        form.endDate,
        form.leaveType
      );
      if (!hasBalance) {
        alert(`Không đủ ngày phép. Còn lại: ${remaining} ngày, yêu cầu: ${requested} ngày`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await submitRequest({
        staffId: staffData.id,
        staffName: staffData.name,
        staffCode: staffData.code,
        position: staffData.position,
        branch: staffData.branch,
        startDate: form.startDate,
        endDate: form.endDate,
        leaveType: form.leaveType,
        reason: form.reason,
      });
      setShowSubmitModal(false);
      setForm({ startDate: '', endDate: '', leaveType: 'Nghỉ phép', reason: '' });
      // Refresh balance after submit
      refreshBalance();
    } catch (err) {
      console.error('Submit error:', err);
      alert('Có lỗi khi gửi đơn');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle approve
  const handleApprove = async (request: LeaveRequest) => {
    if (!staffData) return;
    try {
      await approveRequest(request.id, staffData.id, staffData.name);
    } catch (err) {
      console.error('Approve error:', err);
      alert('Có lỗi khi phê duyệt');
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!selectedRequest || !staffData || !rejectReason) {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }
    try {
      await rejectRequest(
        selectedRequest.id,
        staffData.id,
        staffData.name,
        rejectReason
      );
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectReason('');
    } catch (err) {
      console.error('Reject error:', err);
      alert('Có lỗi khi từ chối');
    }
  };

  // Status badge colors
  const getStatusColor = (status: LeaveRequestStatus) => {
    switch (status) {
      case 'Chờ phê duyệt': return 'bg-yellow-100 text-yellow-800';
      case 'Đã phê duyệt': return 'bg-green-100 text-green-800';
      case 'Từ chối': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="p-6">Đang tải...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">Lỗi: {error}</div>;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Xin nghỉ phép</h1>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus size={20} />
          Tạo đơn xin nghỉ
        </button>
      </div>

      {/* Balance Card - Only show for staff (not admin) */}
      {!canApproveLeave && balance && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-80">Số ngày phép còn lại ({new Date().getFullYear()})</div>
              <div className="text-3xl font-bold">{balance.remaining} <span className="text-lg font-normal">/ {balance.quota} ngày</span></div>
            </div>
            <div className="text-right text-sm opacity-80">
              <div>Đã dùng: {balance.used} ngày</div>
              <div>Đang chờ duyệt: {balance.pending} ngày</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Tìm theo tên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Chờ phê duyệt">Chờ phê duyệt</option>
          <option value="Đã phê duyệt">Đã phê duyệt</option>
          <option value="Từ chối">Từ chối</option>
        </select>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nhân viên</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Loại nghỉ</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Thời gian</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Số ngày</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Lý do</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Trạng thái</th>
              {canApproveLeave && (
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Thao tác</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={canApproveLeave ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                  Không có đơn xin nghỉ nào
                </td>
              </tr>
            ) : (
              filteredRequests.map(request => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{request.staffName}</div>
                    <div className="text-sm text-gray-500">{request.position}</div>
                  </td>
                  <td className="px-4 py-3">{request.leaveType}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {new Date(request.startDate).toLocaleDateString('vi-VN')}
                      {request.startDate !== request.endDate && (
                        <> - {new Date(request.endDate).toLocaleDateString('vi-VN')}</>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {calculateDays(request.startDate, request.endDate)} ngày
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={request.reason}>
                    {request.reason}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                    {request.status === 'Từ chối' && request.rejectionReason && (
                      <div className="text-xs text-red-600 mt-1">
                        {request.rejectionReason}
                      </div>
                    )}
                  </td>
                  {canApproveLeave && (
                    <td className="px-4 py-3">
                      {request.status === 'Chờ phê duyệt' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(request)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Phê duyệt"
                          >
                            <CheckCircle size={20} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowRejectModal(true);
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Từ chối"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Tạo đơn xin nghỉ</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Loại nghỉ</label>
                <select
                  value={form.leaveType}
                  onChange={(e) => setForm({...form, leaveType: e.target.value as LeaveType})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {LEAVE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={form.startDate}
                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                    onChange={(e) => setForm({...form, startDate: e.target.value, endDate: e.target.value > form.endDate ? e.target.value : form.endDate})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                    onChange={(e) => setForm({...form, endDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {form.startDate && form.endDate && (
                <div className="text-sm text-gray-600">
                  Tổng: {calculateDays(form.startDate, form.endDate)} ngày nghỉ
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Lý do xin nghỉ</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({...form, reason: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Nhập lý do..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Đang gửi...' : 'Gửi đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Từ chối đơn xin nghỉ</h2>

            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="font-medium">{selectedRequest.staffName}</div>
              <div className="text-sm text-gray-600">
                {selectedRequest.leaveType}: {new Date(selectedRequest.startDate).toLocaleDateString('vi-VN')}
                {selectedRequest.startDate !== selectedRequest.endDate && (
                  <> - {new Date(selectedRequest.endDate).toLocaleDateString('vi-VN')}</>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Lý do từ chối *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder="Nhập lý do từ chối..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveRequestManager;
