import React, { useState, useMemo } from 'react';
import { Info, Calendar, DollarSign, Clock, Users, Plus, ShieldAlert, CheckCircle, AlertTriangle, XCircle, Eye } from 'lucide-react';
import { useStaffSalary, useStaffAttendance } from '../src/hooks/useStaffSalary';
import { useStaff } from '../src/hooks/useStaff';
import { usePermissions } from '../src/hooks/usePermissions';

export const SalaryReportStaff: React.FC = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'commission'>('attendance');

  // Permission check: Only Admin/KeToan can see ALL salaries
  const { canSeeAllSalaries, staffId: currentStaffId } = usePermissions();

  // Fetch staff salary data
  const { salaries: allSalaries, loading, error, totalSalary: allTotalSalary } = useStaffSalary(selectedMonth, selectedYear);

  // Filter salaries based on permission
  const salaries = useMemo(() => {
    if (canSeeAllSalaries) return allSalaries;
    return allSalaries.filter(s => s.staffId === currentStaffId);
  }, [allSalaries, canSeeAllSalaries, currentStaffId]);

  // Recalculate total for filtered data
  const totalSalary = useMemo(() => {
    return salaries.reduce((sum, s) => sum + s.totalSalary, 0);
  }, [salaries]);

  // Fetch staff list for dropdown (Văn phòng department only)
  const { staff: allStaff } = useStaff();
  const officeStaff = useMemo(() =>
    allStaff.filter(s => s.department === 'Văn phòng' || s.department === 'Điều hành'),
    [allStaff]
  );

  // Get selected staff salary
  const selectedSalary = salaries.find(s => s.staffId === selectedStaffId);

  // Fetch attendance for selected staff
  const { logs: attendanceLogs, loading: loadingAttendance } = useStaffAttendance(
    selectedStaffId || '',
    selectedMonth,
    selectedYear
  );

  // State for attendance detail modal
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);

  // Calculate attendance stats
  const attendanceStats = useMemo(() => {
    if (!attendanceLogs || attendanceLogs.length === 0) {
      return { total: 0, onTime: 0, late: 0, earlyLeave: 0, absent: 0 };
    }
    let onTime = 0, late = 0, earlyLeave = 0, absent = 0;
    attendanceLogs.forEach(log => {
      if (log.status === 'Đúng giờ') onTime++;
      else if (log.status === 'Đi muộn') late++;
      else if (log.status === 'Về sớm') earlyLeave++;
      else absent++;
    });
    return { total: attendanceLogs.length, onTime, late, earlyLeave, absent };
  }, [attendanceLogs]);

  // Generate month options
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`,
      });
    }
    return options;
  }, []);

  const handleMonthChange = (value: string) => {
    const [m, y] = value.split('-').map(Number);
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('vi-VN') + ' đ';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Permission Notice */}
      {!canSeeAllSalaries && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
          <ShieldAlert className="text-amber-600" size={20} />
          <span className="text-sm text-amber-800">
            Bạn chỉ có thể xem thông tin lương của chính mình. Liên hệ Admin hoặc Kế toán để xem báo cáo đầy đủ.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900 bg-cyan-300 px-4 py-1.5 shadow-sm border border-gray-200">
            {canSeeAllSalaries ? 'Báo cáo lương Nhân viên' : 'Lương của tôi'}
          </h2>
          <div className="flex gap-3 text-sm">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium flex items-center gap-1">
              <Users size={14} />
              {salaries.length} nhân viên
            </span>
            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium flex items-center gap-1">
              <DollarSign size={14} />
              Tổng: {formatCurrency(totalSalary)}
            </span>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mr-2">Xem theo tháng</label>
          <select
            className="border border-gray-300 rounded px-3 py-1 text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-green-500"
            value={`${selectedMonth}-${selectedYear}`}
            onChange={(e) => handleMonthChange(e.target.value)}
          >
            {monthOptions.map(opt => (
              <option key={`${opt.month}-${opt.year}`} value={`${opt.month}-${opt.year}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6">
        {/* LEFT: Master List */}
        <div className="w-full xl:w-5/12 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-800 border-collapse">
              <thead className="bg-white text-gray-900 font-bold text-xs uppercase border-b-2 border-gray-300">
                <tr>
                  <th className="px-3 py-3 border border-gray-300">Tên nhân sự</th>
                  <th className="px-3 py-3 border border-gray-300 text-center">Vị trí</th>
                  <th className="px-3 py-3 border border-gray-300 text-right">Lương cứng</th>
                  <th className="px-3 py-3 border border-gray-300 text-center">Công</th>
                  <th className="px-3 py-3 border border-gray-300 text-right">Tạm tính</th>
                  <th className="px-3 py-3 border border-gray-300 text-right">Thực nhận</th>
                  <th className="px-3 py-3 border border-gray-300 text-center w-10">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {salaries.length > 0 ? salaries.map((staff) => {
                  // Calculate estimated salary: baseSalary / 26 standard days * actual work days
                  const standardWorkDays = 26;
                  const estimatedSalary = Math.round((staff.baseSalary + (staff.positionBonus || 0)) / standardWorkDays * staff.workDays);

                  return (
                    <tr
                      key={staff.id}
                      className={`hover:bg-green-50 cursor-pointer transition-colors ${selectedStaffId === staff.staffId ? 'bg-green-100' : ''}`}
                      onClick={() => setSelectedStaffId(staff.staffId)}
                    >
                      <td className="px-3 py-3 border border-gray-200">
                        <div className="font-bold">{staff.staffName}</div>
                      </td>
                      <td className="px-3 py-3 border border-gray-200 text-center text-xs">{staff.position}</td>
                      <td className="px-3 py-3 border border-gray-200 text-right">{staff.baseSalary.toLocaleString()}</td>
                      <td className="px-3 py-3 border border-gray-200 text-center">{staff.workDays}</td>
                      <td className="px-3 py-3 border border-gray-200 text-right text-blue-600">{estimatedSalary.toLocaleString()}</td>
                      <td className="px-3 py-3 border border-gray-200 text-right font-bold text-green-700">{staff.totalSalary.toLocaleString()}</td>
                      <td className="px-3 py-3 border border-gray-200 text-center">
                        <Info size={16} className="text-gray-400 hover:text-green-600 inline-block" />
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                      <DollarSign size={48} className="mx-auto mb-2 opacity-20" />
                      Chưa có dữ liệu lương tháng này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Detail View */}
        <div className="w-full xl:w-7/12 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          {selectedSalary ? (
            <>
              <div className="bg-green-500 px-4 py-2 flex justify-between items-center text-white border-b border-green-600">
                <div>
                  <h3 className="font-bold text-sm uppercase">Chi tiết lương & KPI</h3>
                </div>
                <div className="text-right text-xs">
                  <span>Nhân viên: </span>
                  <span className="font-bold">{selectedSalary.staffName}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                <button
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'attendance' ? 'border-green-500 text-green-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveTab('attendance')}
                >
                  <Clock size={14} /> Bảng chấm công
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'commission' ? 'border-green-500 text-green-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveTab('commission')}
                >
                  <DollarSign size={14} /> Hoa hồng / KPI
                </button>
              </div>

              <div className="p-4 flex-1">
                {activeTab === 'attendance' && (
                  <div className="space-y-4">
                    {loadingAttendance ? (
                      <div className="text-center py-8 text-gray-500">Đang tải...</div>
                    ) : (
                      <>
                        {/* Attendance Stats Summary */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 text-center">
                            <p className="text-2xl font-bold text-indigo-700">{attendanceStats.total}</p>
                            <p className="text-xs text-indigo-600">Tổng công</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <CheckCircle size={14} className="text-green-600" />
                              <p className="text-2xl font-bold text-green-700">{attendanceStats.onTime}</p>
                            </div>
                            <p className="text-xs text-green-600">Đúng giờ</p>
                          </div>
                          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <AlertTriangle size={14} className="text-yellow-600" />
                              <p className="text-2xl font-bold text-yellow-700">{attendanceStats.late}</p>
                            </div>
                            <p className="text-xs text-yellow-600">Đi muộn</p>
                          </div>
                          <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <XCircle size={14} className="text-red-600" />
                              <p className="text-2xl font-bold text-red-700">{attendanceStats.earlyLeave + attendanceStats.absent}</p>
                            </div>
                            <p className="text-xs text-red-600">Về sớm/Vắng</p>
                          </div>
                        </div>

                        {/* Attendance Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-center border-collapse border border-gray-300">
                            <thead className="bg-orange-50 text-gray-800 font-bold text-xs uppercase">
                              <tr>
                                <th className="border border-gray-300 px-2 py-2">Ngày</th>
                                <th className="border border-gray-300 px-2 py-2">Giờ vào</th>
                                <th className="border border-gray-300 px-2 py-2">Giờ ra</th>
                                <th className="border border-gray-300 px-2 py-2">Trạng thái</th>
                                <th className="border border-gray-300 px-2 py-2">Chi tiết</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendanceLogs.length > 0 ? attendanceLogs.map((log) => (
                                <tr
                                  key={log.id}
                                  className="hover:bg-gray-50 cursor-pointer"
                                  onClick={() => setSelectedAttendance(log)}
                                >
                                  <td className="border border-gray-300 px-2 py-2">{log.date}</td>
                                  <td className="border border-gray-300 px-2 py-2 text-green-700">{log.checkIn}</td>
                                  <td className="border border-gray-300 px-2 py-2 text-red-700">{log.checkOut}</td>
                                  <td className="border border-gray-300 px-2 py-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${log.status === 'Đúng giờ' ? 'bg-green-50 text-green-700 border-green-200' :
                                      log.status === 'Đi muộn' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                        log.status === 'Về sớm' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                          'bg-red-50 text-red-700 border-red-200'
                                      }`}>
                                      {log.status}
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 px-2 py-2">
                                    <Eye size={16} className="inline-block text-indigo-500 hover:text-indigo-700" />
                                  </td>
                                </tr>
                              )) : (
                                <tr>
                                  <td colSpan={5} className="py-8 text-gray-400 italic">Chưa có dữ liệu chấm công</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Attendance Detail Modal */}
                        {selectedAttendance && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedAttendance(null)}>
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-4 flex justify-between items-center">
                                <h3 className="font-bold">Chi tiết chấm công</h3>
                                <button onClick={() => setSelectedAttendance(null)} className="hover:bg-white/20 p-1 rounded">
                                  <XCircle size={20} />
                                </button>
                              </div>
                              <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-500">Ngày</p>
                                    <p className="font-semibold">{selectedAttendance.date}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-500">Trạng thái</p>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${selectedAttendance.status === 'Đúng giờ' ? 'bg-green-100 text-green-700' :
                                      selectedAttendance.status === 'Đi muộn' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>{selectedAttendance.status}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-500">Giờ vào</p>
                                    <p className="font-semibold text-green-700">{selectedAttendance.checkIn}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-500">Giờ ra</p>
                                    <p className="font-semibold text-red-700">{selectedAttendance.checkOut}</p>
                                  </div>
                                </div>
                                {selectedAttendance.note && (
                                  <div className="pt-4 border-t">
                                    <p className="text-sm text-gray-500">Ghi chú</p>
                                    <p className="text-gray-700 italic">{selectedAttendance.note}</p>
                                  </div>
                                )}
                                {selectedAttendance.photoUrl && (
                                  <div className="pt-4 border-t">
                                    <p className="text-sm text-gray-500 mb-2">Ảnh chấm công</p>
                                    <img
                                      src={selectedAttendance.photoUrl}
                                      alt="Check-in photo"
                                      className="w-full max-h-48 object-contain rounded-lg border"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'commission' && (
                  <div>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 p-3 rounded border border-gray-300">
                        <p className="text-xs text-gray-500 uppercase font-bold">Lương cứng</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedSalary.baseSalary)}</p>
                      </div>
                      <div className="bg-indigo-50 p-3 rounded border border-indigo-300">
                        <p className="text-xs text-indigo-700 uppercase font-bold">Phụ cấp vị trí</p>
                        <p className="text-lg font-bold text-indigo-700">{formatCurrency(selectedSalary.positionBonus || 0)}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded border border-green-300">
                        <p className="text-xs text-green-700 uppercase font-bold">Tổng thực nhận</p>
                        <p className="text-lg font-bold text-green-700">{formatCurrency(selectedSalary.totalSalary)}</p>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-300 rounded overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-orange-50 text-xs uppercase font-bold text-gray-700 border-b border-gray-300">
                          <tr>
                            <th className="px-4 py-2 border-r border-gray-300">Mô tả</th>
                            <th className="px-4 py-2 text-right">Giá trị</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="px-4 py-2 border-r border-gray-200">Lương cơ bản ({selectedSalary.workDays} công)</td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(selectedSalary.baseSalary)}</td>
                          </tr>
                          {(selectedSalary.positionBonus || 0) > 0 && (
                            <tr className="bg-indigo-50/50">
                              <td className="px-4 py-2 border-r border-gray-200 text-indigo-700">Phụ cấp vị trí (Lead/Quản lý)</td>
                              <td className="px-4 py-2 text-right font-medium text-indigo-700">+{formatCurrency(selectedSalary.positionBonus || 0)}</td>
                            </tr>
                          )}
                          {(selectedSalary.kpiBonus || 0) > 0 && (
                            <tr className="bg-amber-50/50">
                              <td className="px-4 py-2 border-r border-gray-200 text-amber-700">Thưởng KPI</td>
                              <td className="px-4 py-2 text-right font-medium text-amber-700">+{formatCurrency(selectedSalary.kpiBonus || 0)}</td>
                            </tr>
                          )}
                          {selectedSalary.commission > 0 && (
                            <tr>
                              <td className="px-4 py-2 border-r border-gray-200">Hoa hồng doanh số</td>
                              <td className="px-4 py-2 text-right font-medium">{formatCurrency(selectedSalary.commission)}</td>
                            </tr>
                          )}
                          {selectedSalary.allowance > 0 && (
                            <tr>
                              <td className="px-4 py-2 border-r border-gray-200">Phụ cấp khác</td>
                              <td className="px-4 py-2 text-right font-medium">{formatCurrency(selectedSalary.allowance)}</td>
                            </tr>
                          )}
                          {selectedSalary.deduction > 0 && (
                            <tr>
                              <td className="px-4 py-2 border-r border-gray-200 text-red-600">Khấu trừ (đi muộn, phạt...)</td>
                              <td className="px-4 py-2 text-right font-medium text-red-600">-{formatCurrency(selectedSalary.deduction)}</td>
                            </tr>
                          )}
                          <tr className="bg-gray-50 font-bold">
                            <td className="px-4 py-2 border-r border-gray-300 text-gray-900">Tổng thực nhận</td>
                            <td className="px-4 py-2 text-right text-green-700">{formatCurrency(selectedSalary.totalSalary)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 p-10 flex-col gap-2">
              <Info size={48} className="opacity-20" />
              <p>Chọn một nhân viên để xem chi tiết lương</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
