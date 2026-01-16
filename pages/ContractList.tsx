/**
 * Contract List Page
 * Danh sách hợp đồng với filter và actions
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Eye, Trash2, DollarSign, Filter, X, CreditCard, Printer, Download } from 'lucide-react';
import { Contract, ContractStatus } from '../types';
import { useContracts } from '../src/hooks/useContracts';
import { formatCurrency } from '../src/utils/currencyUtils';
import { printContract, downloadContractAsPdf, ContractCenterInfo, DEFAULT_CENTER_INFO } from '../src/utils/contract-pdf-generator';
import { updateContract } from '../src/services/contractService';
import { createEnrollment } from '../src/services/enrollmentService';
import { useAuth } from '../src/hooks/useAuth';
import { useStaff } from '../src/hooks/useStaff';
import { getCenters, Center } from '../src/services/centerService';
import { StudentService } from '../src/services/studentService';

export const ContractList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const { staff } = useStaff();

  // Create staff lookup map (email/uid -> name)
  const staffMap = React.useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach(s => {
      if (s.email) map.set(s.email, s.name);
      if (s.id) map.set(s.id, s.name);
    });
    return map;
  }, [staff]);

  // Fetch centers for printing contracts
  useEffect(() => {
    const loadCenters = async () => {
      try {
        const centersList = await getCenters();
        setCenters(centersList);
      } catch (error) {
        console.error('Error loading centers:', error);
      }
    };
    loadCenters();
  }, []);

  // Get center info for a specific contract (based on student's branch)
  const getCenterInfoForContract = async (contract: Contract): Promise<ContractCenterInfo> => {
    try {
      // Build branches list from all active centers
      const branches = centers
        .filter(c => c.status === 'Active')
        .map(c => ({ code: c.code, address: c.address }));

      // If contract has studentId, lookup student's branch
      if (contract.studentId) {
        const student = await StudentService.getStudentById(contract.studentId);
        if (student?.branch) {
          const studentCenter = centers.find(c =>
            c.name === student.branch ||
            c.code === student.branch ||
            c.name?.includes(student.branch) ||
            student.branch?.includes(c.name)
          );
          if (studentCenter) {
            return {
              centerName: DEFAULT_CENTER_INFO.centerName, // Always use company name
              representative: studentCenter.manager || DEFAULT_CENTER_INFO.representative,
              address: studentCenter.address || DEFAULT_CENTER_INFO.address,
              phone: DEFAULT_CENTER_INFO.phone, // Use company hotline
              email: studentCenter.email || DEFAULT_CENTER_INFO.email,
              signatureUrl: studentCenter.signatureUrl || '',
              branches,
              logoUrl: '/logo.jpg',
            };
          }
        }
      }
      // Fallback to main center
      const mainCenter = centers.find(c => c.isMain) || centers[0];
      if (mainCenter) {
        return {
          centerName: DEFAULT_CENTER_INFO.centerName, // Always use company name
          representative: mainCenter.manager || DEFAULT_CENTER_INFO.representative,
          address: mainCenter.address || DEFAULT_CENTER_INFO.address,
          phone: DEFAULT_CENTER_INFO.phone, // Use company hotline
          email: mainCenter.email || DEFAULT_CENTER_INFO.email,
          signatureUrl: mainCenter.signatureUrl || '',
          branches,
          logoUrl: '/logo.jpg',
        };
      }
    } catch (error) {
      console.error('Error getting center info for contract:', error);
    }
    return DEFAULT_CENTER_INFO;
  };

  // Handle print contract with correct center info and latest student data
  const handlePrintContract = async (contract: Contract) => {
    const centerInfo = await getCenterInfoForContract(contract);

    // Get latest student data for phone number (in case contract was created without it)
    let contractWithLatestData = { ...contract };
    if (contract.studentId && !contract.parentPhone) {
      try {
        const student = await StudentService.getStudentById(contract.studentId);
        if (student) {
          contractWithLatestData = {
            ...contract,
            parentPhone: student.parentPhone || student.phone || contract.parentPhone,
            parentName: contract.parentName || student.parentName,
          };
        }
      } catch (error) {
        console.error('Error fetching student data for print:', error);
      }
    }

    await printContract(contractWithLatestData, centerInfo);
  };

  // Handle download contract with correct center info and latest student data
  const handleDownloadContract = async (contract: Contract) => {
    const centerInfo = await getCenterInfoForContract(contract);

    // Get latest student data for phone number (in case contract was created without it)
    let contractWithLatestData = { ...contract };
    if (contract.studentId && !contract.parentPhone) {
      try {
        const student = await StudentService.getStudentById(contract.studentId);
        if (student) {
          contractWithLatestData = {
            ...contract,
            parentPhone: student.parentPhone || student.phone || contract.parentPhone,
            parentName: contract.parentName || student.parentName,
          };
        }
      } catch (error) {
        console.error('Error fetching student data for download:', error);
      }
    }

    await downloadContractAsPdf(contractWithLatestData, centerInfo);
  };

  const { contracts, loading, error, deleteContract, updateStatus, refresh } = useContracts(
    statusFilter ? { status: statusFilter } : undefined
  );

  // Compute actual status based on payment amounts (fixes data inconsistency)
  const getComputedStatus = (contract: Contract): ContractStatus => {
    if (contract.status === ContractStatus.CANCELLED) return ContractStatus.CANCELLED;
    if (contract.status === ContractStatus.DRAFT) return ContractStatus.DRAFT;
    if ((contract.remainingAmount || 0) <= 0) return ContractStatus.PAID;
    // Has remaining debt - always show as PARTIAL regardless of paidAmount
    if ((contract.remainingAmount || 0) > 0) return ContractStatus.PARTIAL;
    return contract.status;
  };

  // Create center lookup map for flexible branch matching
  const centerMap = React.useMemo(() => {
    const map = new Map<string, Center>();
    centers.forEach(c => {
      if (c.name) map.set(c.name.toLowerCase(), c);
      if (c.code) map.set(c.code.toLowerCase(), c);
    });
    return map;
  }, [centers]);

  const filteredContracts = contracts.filter(c => {
    const matchesSearch = !searchTerm || (
      c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    // Flexible branch matching: match by name or code, with fallback to direct comparison
    let matchesBranch = !branchFilter;
    if (branchFilter) {
      if (!c.branch) {
        // Contract has no branch - don't match when filtering by branch
        matchesBranch = false;
      } else {
        const contractBranch = c.branch.toLowerCase();
        const filterBranch = branchFilter.toLowerCase();
        const selectedCenter = centers.find(center => center.name === branchFilter);

        if (selectedCenter) {
          // Match by center name or code
          matchesBranch = contractBranch === selectedCenter.name?.toLowerCase() ||
                         contractBranch === selectedCenter.code?.toLowerCase() ||
                         selectedCenter.name?.toLowerCase().includes(contractBranch) ||
                         contractBranch.includes(selectedCenter.name?.toLowerCase() || '');
        } else {
          // Fallback: direct string comparison when center not found
          matchesBranch = contractBranch === filterBranch ||
                         contractBranch.includes(filterBranch) ||
                         filterBranch.includes(contractBranch);
        }
      }
    }
    return matchesSearch && matchesBranch;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa hợp đồng này?')) return;
    try {
      await deleteContract(id);
    } catch (err) {
      alert('Không thể xóa hợp đồng');
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await updateStatus(id, ContractStatus.PAID);
    } catch (err) {
      alert('Không thể cập nhật trạng thái');
    }
  };

  const handleAddPayment = async () => {
    if (!selectedContract?.id || paymentAmount <= 0) return;
    
    setPaymentLoading(true);
    try {
      const currentPaid = selectedContract.paidAmount || 0;
      const newPaidAmount = currentPaid + paymentAmount;
      const totalAmount = selectedContract.totalAmount || 0;
      const newRemainingAmount = totalAmount - newPaidAmount;
      
      const newStatus = newRemainingAmount <= 0 ? ContractStatus.PAID : ContractStatus.PARTIAL;
      
      await updateContract(selectedContract.id, {
        paidAmount: newPaidAmount,
        remainingAmount: Math.max(0, newRemainingAmount),
        status: newStatus,
      });
      
      // Calculate total sessions from contract items
      const totalSessions = (selectedContract.items || [])
        .filter(item => item.type === 'course')
        .reduce((sum, item) => sum + (item.quantity || 0), 0);
      
      // Calculate new paid sessions based on new payment ratio
      const newPaidSessions = newStatus === ContractStatus.PAID
        ? totalSessions
        : Math.floor(totalSessions * (newPaidAmount / totalAmount));
      
      // Update student and create enrollment record
      if (selectedContract.studentId) {
        const { doc, updateDoc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../src/config/firebase');
        const studentRef = doc(db, 'students', selectedContract.studentId);
        const studentSnap = await getDoc(studentRef);
        
        if (studentSnap.exists()) {
          const studentData = studentSnap.data();
          const oldPaidSessions = Math.floor(totalSessions * (currentPaid / totalAmount));
          const sessionDiff = newPaidSessions - oldPaidSessions;
          
          const updateData: Record<string, any> = {
            registeredSessions: (studentData.registeredSessions || 0) + sessionDiff,
          };
          
          // Check for other debt contracts of this student
          const { collection, getDocs, query, where } = await import('firebase/firestore');
          const otherDebtQuery = query(
            collection(db, 'contracts'),
            where('studentId', '==', selectedContract.studentId),
            where('status', '==', 'Nợ hợp đồng')
          );
          const otherDebtSnap = await getDocs(otherDebtQuery);
          
          // Calculate total debt from ALL debt contracts (excluding current if it's now PAID)
          let totalDebt = 0;
          otherDebtSnap.docs.forEach(d => {
            if (d.id !== selectedContract.id) {
              totalDebt += (d.data().remainingAmount || 0);
            }
          });
          
          // Add current contract's remaining if still PARTIAL
          if (newStatus === ContractStatus.PARTIAL) {
            totalDebt += newRemainingAmount;
          }
          
          if (totalDebt > 0) {
            updateData.contractDebt = totalDebt;
            updateData.status = 'Nợ hợp đồng';
          } else {
            updateData.contractDebt = 0;
            updateData.status = 'Đang học';
          }
          
          await updateDoc(studentRef, updateData);
          
          // Create enrollment record for additional payment
          if (sessionDiff > 0) {
            await createEnrollment({
              studentId: selectedContract.studentId,
              studentName: selectedContract.studentName || '',
              sessions: sessionDiff,
              type: 'Thanh toán thêm',
              contractCode: selectedContract.code || '',
              finalAmount: paymentAmount,
              createdDate: new Date().toLocaleDateString('vi-VN'),
              createdBy: user?.displayName || user?.email || 'Unknown',
              note: `Thanh toán thêm HĐ ${selectedContract.code} - ${formatCurrency(paymentAmount)} (${sessionDiff} buổi)`,
            });
          }
        }
      }
      
      setShowPaymentModal(false);
      setSelectedContract(null);
      setPaymentAmount(0);
      refresh?.();
      alert('Ghi nhận thanh toán thành công!');
    } catch (err) {
      alert('Không thể ghi nhận thanh toán');
    } finally {
      setPaymentLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      [ContractStatus.DRAFT]: 'bg-gray-100 text-gray-700',
      [ContractStatus.PENDING]: 'bg-yellow-100 text-yellow-700',
      [ContractStatus.PAID]: 'bg-green-100 text-green-700',
      [ContractStatus.PARTIAL]: 'bg-orange-100 text-orange-700',
      [ContractStatus.CANCELLED]: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-indigo-600" size={24} />
          Danh sách hợp đồng
        </h2>
        <button
          onClick={() => navigate('/finance/contracts/create')}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          <Plus size={16} /> Tạo hợp đồng
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo mã HĐ, tên học viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContractStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value={ContractStatus.DRAFT}>Lưu nháp</option>
            <option value={ContractStatus.PENDING}>Chờ thanh toán</option>
            <option value={ContractStatus.PAID}>Đã thanh toán</option>
            <option value={ContractStatus.PARTIAL}>Nợ hợp đồng</option>
            <option value={ContractStatus.CANCELLED}>Đã hủy</option>
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Tất cả cơ sở</option>
            {centers.filter(c => c.status === 'Active').map(center => (
              <option key={center.id} value={center.name}>{center.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Mã HĐ</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Học viên</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Ngày tạo</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Người tạo</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Tổng tiền</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Còn nợ</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center">Trạng thái</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    Đang tải...
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-red-500">
                  Lỗi: {error}
                </td>
              </tr>
            ) : filteredContracts.length > 0 ? (
              filteredContracts.map((contract) => {
                const computedStatus = getComputedStatus(contract);
                return (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-indigo-600">
                    {contract.code || `HĐ-${contract.id?.slice(0, 6)}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{contract.studentName || '---'}</div>
                    <div className="text-xs text-gray-500">{contract.parentPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {contract.contractDate
                      ? new Date(contract.contractDate).toLocaleDateString('vi-VN')
                      : '---'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {staffMap.get(contract.createdBy) || contract.createdBy || '---'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCurrency(contract.totalAmount || 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    {formatCurrency(contract.remainingAmount || 0)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadge(computedStatus)}`}>
                      {computedStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedContract(contract)}
                        className="text-gray-400 hover:text-indigo-600 p-1"
                        title="Xem chi tiết"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handlePrintContract(contract)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        title="In hợp đồng"
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        onClick={() => handleDownloadContract(contract)}
                        className="text-gray-400 hover:text-green-600 p-1"
                        title="Tải PDF"
                      >
                        <Download size={16} />
                      </button>
                      {computedStatus === ContractStatus.PARTIAL && (
                        <button
                          onClick={() => {
                            setSelectedContract(contract);
                            setPaymentAmount(contract.remainingAmount || 0);
                            setShowPaymentModal(true);
                          }}
                          className="text-gray-400 hover:text-green-600 p-1"
                          title="Thanh toán thêm"
                        >
                          <CreditCard size={16} />
                        </button>
                      )}
                      {computedStatus === ContractStatus.DRAFT && (
                        <button
                          onClick={() => contract.id && handleMarkPaid(contract.id)}
                          className="text-gray-400 hover:text-green-600 p-1"
                          title="Đánh dấu đã thanh toán"
                        >
                          <DollarSign size={16} />
                        </button>
                      )}
                      {(computedStatus === ContractStatus.DRAFT || computedStatus === ContractStatus.CANCELLED) && (
                        <button
                          onClick={() => contract.id && handleDelete(contract.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );})
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={48} className="mx-auto mb-2 opacity-20" />
                  Không tìm thấy hợp đồng nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {!loading && filteredContracts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">Tổng số HĐ</p>
              <p className="text-xl font-bold text-gray-800">{filteredContracts.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Đã thanh toán</p>
              <p className="text-xl font-bold text-green-600">
                {filteredContracts.filter(c => c.status === ContractStatus.PAID).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Nợ hợp đồng</p>
              <p className="text-xl font-bold text-orange-600">
                {filteredContracts.filter(c => c.status === ContractStatus.PARTIAL).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tổng doanh thu</p>
              <p className="text-xl font-bold text-indigo-600">
                {formatCurrency(
                  filteredContracts
                    .filter(c => c.status === ContractStatus.PAID || c.status === ContractStatus.PARTIAL)
                    .reduce((sum, c) => sum + (c.paidAmount || c.totalAmount || 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contract Detail Modal */}
      {selectedContract && !showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Chi tiết hợp đồng</h3>
              <button onClick={() => setSelectedContract(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Contract Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Mã hợp đồng</p>
                  <p className="font-semibold text-indigo-600">{selectedContract.code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ngày tạo</p>
                  <p className="font-medium">{selectedContract.contractDate ? new Date(selectedContract.contractDate).toLocaleDateString('vi-VN') : '---'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Học viên</p>
                  <p className="font-medium">{selectedContract.studentName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phụ huynh</p>
                  <p className="font-medium">{selectedContract.parentName} - {selectedContract.parentPhone}</p>
                </div>
              </div>

              {/* Items */}
              {selectedContract.items && selectedContract.items.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Danh sách sản phẩm/khóa học</p>
                  <table className="w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Tên</th>
                        <th className="px-3 py-2 text-right">Đơn giá</th>
                        <th className="px-3 py-2 text-right">SL</th>
                        <th className="px-3 py-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedContract.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice || 0)}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.finalPrice || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payment Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Tổng tiền</p>
                    <p className="text-lg font-bold">{formatCurrency(selectedContract.totalAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Trạng thái</p>
                    <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${getStatusBadge(selectedContract.status)}`}>
                      {selectedContract.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Đã thanh toán</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(selectedContract.paidAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Còn nợ</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(selectedContract.remainingAmount || 0)}</p>
                  </div>
                </div>
              </div>

              {selectedContract.notes && (
                <div>
                  <p className="text-sm text-gray-500">Ghi chú</p>
                  <p className="text-gray-700">{selectedContract.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              {selectedContract.status === ContractStatus.PARTIAL && (
                <button
                  onClick={() => {
                    setPaymentAmount(selectedContract.remainingAmount || 0);
                    setShowPaymentModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CreditCard size={16} /> Thanh toán thêm
                </button>
              )}
              <button
                onClick={() => setSelectedContract(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Thanh toán thêm</h3>
              <button onClick={() => { setShowPaymentModal(false); setPaymentAmount(0); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500">Hợp đồng: <span className="font-medium text-indigo-600">{selectedContract.code}</span></p>
                <p className="text-sm text-gray-500">Học viên: <span className="font-medium">{selectedContract.studentName}</span></p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Đã thanh toán</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(selectedContract.paidAmount || 0)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Còn nợ</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(selectedContract.remainingAmount || 0)}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền thanh toán</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  max={selectedContract.remainingAmount || 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Còn lại sau khi thanh toán: {formatCurrency(Math.max(0, (selectedContract.remainingAmount || 0) - paymentAmount))}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => { setShowPaymentModal(false); setPaymentAmount(0); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleAddPayment}
                disabled={paymentLoading || paymentAmount <= 0 || paymentAmount > (selectedContract.remainingAmount || 0)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {paymentLoading ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
