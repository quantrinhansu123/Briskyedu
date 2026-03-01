
import React, { useState, useMemo } from 'react';
import { Search, Filter, Calendar, FileDown, ArrowUpRight, ArrowDownRight, MoreHorizontal, ChevronDown, X, FileText, User, CreditCard, Clock } from 'lucide-react';
import { ModalPortal } from '@/components/modal-portal';
import { EnrollmentRecord } from '../types';
import { useEnrollments } from '../src/hooks/useEnrollments';
import { useContracts } from '../src/hooks/useContracts';
import * as XLSX from 'xlsx';

export const EnrollmentHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState<number | ''>(new Date().getMonth() + 1);
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [selectedRecord, setSelectedRecord] = useState<EnrollmentRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch from Firebase
  const { enrollments, loading, error } = useEnrollments({
    type: typeFilter !== 'ALL' ? typeFilter : undefined,
    month: monthFilter ? monthFilter : undefined,
    year: yearFilter,
  });
  const { contracts } = useContracts({});
  
  // Get contract details for selected record
  const selectedContract = useMemo(() => {
    if (!selectedRecord?.contractId && !selectedRecord?.contractCode) return null;
    return contracts.find(c => 
      c.id === selectedRecord.contractId || 
      c.code === selectedRecord.contractCode
    );
  }, [selectedRecord, contracts]);

  const handleViewDetail = (record: EnrollmentRecord) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const filteredData = useMemo(() => {
    return enrollments.filter(item => {
      const matchesSearch = item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.contractCode?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [enrollments, searchTerm]);

  const getTypeBadge = (type: EnrollmentRecord['type']) => {
    switch(type) {
        case 'Hợp đồng mới': return 'bg-green-100 text-green-700 border-green-200';
        case 'Hợp đồng tái phí': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Ghi danh thủ công': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'Tặng buổi': return 'bg-red-100 text-red-700 border-red-200';
        case 'Nhận tặng buổi': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'Chuyển lớp': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        case 'Xóa khỏi lớp': return 'bg-gray-100 text-gray-600 border-gray-200';
        default: return 'bg-gray-100 text-gray-600';
    }
  };

  const totalRevenue = filteredData.reduce((sum, item) => sum + (item.finalAmount || 0), 0);
  const totalSessions = filteredData.reduce((sum, item) => sum + (item.sessions || 0), 0);

  const exportToExcel = () => {
    const data = filteredData.map((item, index) => ({
      'STT': index + 1,
      'Học viên': item.studentName,
      'Số buổi': item.sessions,
      'Loại ghi danh': item.type,
      'Mã HĐ': item.contractCode || '-',
      'Số tiền': item.finalAmount ? item.finalAmount.toLocaleString('vi-VN') + 'đ' : '-',
      'Ngày': item.createdDate || item.createdAt?.split('T')[0] || '-',
      'Nhân viên': item.staff || item.createdBy,
      'Ghi chú': item.reason || item.note || item.notes || '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ghi danh');
    const fileName = monthFilter 
      ? `LichSuGhiDanh_T${monthFilter}_${yearFilter}.xlsx`
      : `LichSuGhiDanh_${yearFilter}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Summary */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
         <div>
             <h2 className="text-xl font-bold text-gray-800">Lịch sử ghi danh</h2>
             <p className="text-sm text-gray-500 mt-1">Quản lý toàn bộ lịch sử ghi danh và hợp đồng</p>
         </div>
         <div className="flex gap-4">
             <div className="text-right px-4 border-r border-gray-100">
                 <p className="text-xs text-gray-500 uppercase font-bold">Doanh thu (View)</p>
                 <p className="text-lg font-bold text-indigo-600">{totalRevenue.toLocaleString()} đ</p>
             </div>
             <div className="text-right px-2">
                 <p className="text-xs text-gray-500 uppercase font-bold">Tổng số buổi</p>
                 <p className="text-lg font-bold text-gray-800">{totalSessions} buổi</p>
             </div>
         </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex flex-col md:flex-row gap-3 flex-1">
             <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Tìm học viên, mã HĐ..." 
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <select 
                className="pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm text-gray-700"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
             >
                <option value="ALL">Tất cả kiểu ghi danh</option>
                <option value="Hợp đồng mới">Hợp đồng mới</option>
                <option value="Hợp đồng tái phí">Hợp đồng tái phí</option>
                <option value="Ghi danh thủ công">Ghi danh thủ công</option>
                <option value="Tặng buổi">Tặng buổi</option>
                <option value="Nhận tặng buổi">Nhận tặng buổi</option>
                <option value="Chuyển lớp">Chuyển lớp</option>
                <option value="Xóa khỏi lớp">Xóa khỏi lớp</option>
             </select>
             <div className="flex items-center gap-2">
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value ? parseInt(e.target.value) : '')}
                  className="pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm text-gray-700"
                >
                  <option value="">Tất cả tháng</option>
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(parseInt(e.target.value))}
                  className="pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm text-gray-700"
                >
                  {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
             </div>
          </div>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
             <FileDown size={18} /> Xuất Excel
          </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500">
                    <tr>
                        <th className="px-3 py-3 text-center whitespace-nowrap">No</th>
                        <th className="px-3 py-3 whitespace-nowrap">Tên học viên</th>
                        <th className="px-3 py-3 text-center whitespace-nowrap">Số buổi</th>
                        <th className="px-3 py-3 whitespace-nowrap">Kiểu ghi danh</th>
                        <th className="px-3 py-3 whitespace-nowrap">Hợp đồng</th>
                        <th className="px-3 py-3 text-right whitespace-nowrap">Số tiền</th>
                        <th className="px-3 py-3 whitespace-nowrap">Ngày tạo</th>
                        <th className="px-3 py-3 whitespace-nowrap">Người tạo</th>
                        <th className="px-3 py-3 whitespace-nowrap">Ghi chú</th>
                        <th className="px-2 py-3"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredData.length > 0 ? (
                        filteredData.map((record, index) => (
                            <tr key={record.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-3 py-3 text-center font-medium text-gray-400">{index + 1}</td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                    <span className="font-bold text-gray-900">{record.studentName}</span>
                                </td>
                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                    <span className={`font-bold ${record.sessions < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                                        {record.sessions}
                                    </span>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                    <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold uppercase ${getTypeBadge(record.type)}`}>
                                        {record.type}
                                    </span>
                                </td>
                                <td className="px-3 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                                    {record.contractCode || '---'}
                                </td>
                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                    <span className="font-bold text-gray-900">{record.finalAmount.toLocaleString()} đ</span>
                                </td>
                                <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                                    {record.createdDate}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap" title={record.createdBy}>
                                    <span className="text-xs text-gray-700">
                                        {record.createdBy.length > 12 ? record.createdBy.slice(0, 10) + '...' : record.createdBy}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-gray-500 text-xs max-w-[150px] truncate" title={record.note}>
                                    {record.note || '-'}
                                </td>
                                <td className="px-2 py-3 text-right">
                                    <button 
                                      onClick={() => handleViewDetail(record)}
                                      className="text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Xem chi tiết"
                                    >
                                        <MoreHorizontal size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                                Không tìm thấy dữ liệu ghi danh nào.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
                Hiển thị {filteredData.length} bản ghi
            </span>
            <div className="flex gap-2">
                <button className="px-3 py-1 bg-white border border-gray-200 rounded text-xs font-medium disabled:opacity-50 text-gray-600 hover:bg-gray-50" disabled>Trước</button>
                <button className="px-3 py-1 bg-white border border-gray-200 rounded text-xs font-medium hover:bg-gray-50 text-gray-600">Sau</button>
            </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedRecord && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-blue-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Chi tiết ghi danh</h3>
                <p className="text-sm text-indigo-600">{selectedRecord.studentName}</p>
              </div>
              <button 
                onClick={() => { setShowDetailModal(false); setSelectedRecord(null); }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={22} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Enrollment Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                  <FileText size={16} className="text-indigo-500" />
                  Thông tin ghi danh
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-500">Loại ghi danh</p>
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${getTypeBadge(selectedRecord.type)}`}>
                      {selectedRecord.type}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500">Số buổi</p>
                    <p className="font-bold text-gray-900">{selectedRecord.sessions} buổi</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500">Số tiền</p>
                    <p className="font-bold text-indigo-600">{selectedRecord.finalAmount?.toLocaleString() || 0} đ</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500">Ngày tạo</p>
                    <p className="font-medium text-gray-900">{selectedRecord.createdDate}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500">Người tạo</p>
                    <p className="font-medium text-gray-900 truncate" title={selectedRecord.createdBy}>{selectedRecord.createdBy}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500">Trạng thái</p>
                    <p className="font-medium text-green-600">{selectedRecord.status || 'Đã xác nhận'}</p>
                  </div>
                </div>
                {selectedRecord.note && (
                  <div>
                    <p className="text-gray-500 text-sm">Ghi chú</p>
                    <p className="text-gray-700 text-sm bg-white p-2 rounded border break-words">{selectedRecord.note}</p>
                  </div>
                )}
              </div>

              {/* Contract Info */}
              {selectedRecord.contractCode && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <CreditCard size={16} className="text-blue-500" />
                    Thông tin hợp đồng
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-gray-500">Mã hợp đồng</p>
                      <p className="font-mono font-bold text-blue-600 truncate" title={selectedRecord.contractCode}>{selectedRecord.contractCode}</p>
                    </div>
                    {selectedContract ? (
                      <>
                        {selectedContract.sessions && (
                          <div className="min-w-0">
                            <p className="text-gray-500">Tổng buổi HĐ</p>
                            <p className="font-bold text-gray-900">{selectedContract.sessions} buổi</p>
                          </div>
                        )}
                        {(selectedContract.finalAmount || selectedContract.amount) && (
                          <div className="min-w-0">
                            <p className="text-gray-500">Giá trị HĐ</p>
                            <p className="font-bold text-gray-900">{(selectedContract.finalAmount || selectedContract.amount)?.toLocaleString()} đ</p>
                          </div>
                        )}
                        {selectedContract.startDate && (
                          <div className="min-w-0">
                            <p className="text-gray-500">Ngày ký</p>
                            <p className="font-medium text-gray-900">{selectedContract.startDate}</p>
                          </div>
                        )}
                        {selectedContract.className && (
                          <div className="min-w-0">
                            <p className="text-gray-500">Lớp học</p>
                            <p className="font-medium text-gray-900 truncate" title={selectedContract.className}>{selectedContract.className}</p>
                          </div>
                        )}
                        {selectedContract.status && (
                          <div className="min-w-0">
                            <p className="text-gray-500">Trạng thái HĐ</p>
                            <p className={`font-medium ${selectedContract.status === 'Đang học' ? 'text-green-600' : 'text-gray-600'}`}>
                              {selectedContract.status}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="col-span-2 text-gray-500 text-xs italic">
                        Không tìm thấy thông tin chi tiết hợp đồng
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Student Info */}
              <div className="bg-green-50 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                  <User size={16} className="text-green-500" />
                  Thông tin học viên
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-500">Họ và tên</p>
                    <p className="font-bold text-gray-900 truncate" title={selectedRecord.studentName}>{selectedRecord.studentName}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500">Mã học viên</p>
                    <p className="font-mono text-gray-600 truncate" title={selectedRecord.studentId}>{selectedRecord.studentId}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => { setShowDetailModal(false); setSelectedRecord(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
