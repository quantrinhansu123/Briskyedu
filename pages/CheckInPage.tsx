import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Clock,
    CheckCircle,
    XCircle,
    Wifi,
    AlertTriangle,
    LogIn,
    LogOut,
    Calendar,
    Camera,
    RefreshCw,
    Loader2,
    Eye
} from 'lucide-react';
import { useCheckIn, useCheckInHistory } from '../src/hooks/useCheckIn';
import { CameraCapture } from '../components/CameraCapture';
import { uploadCheckInPhoto, dataURLtoBlob } from '../src/services/photoUploadService';
import { useAuth } from '../src/hooks/useAuth';

export const CheckInPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, staffData } = useAuth();
    const {
        todayCheckIn,
        publicIp,
        verification,
        loading,
        error,
        actionLoading,
        checkIn,
        checkOut,
        verifyWithWifiName,
        refresh,
    } = useCheckIn();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [showWifiInput, setShowWifiInput] = useState(false);
    const [wifiName, setWifiName] = useState('');
    const [activeTab, setActiveTab] = useState<'checkin' | 'history'>('checkin');

    // Camera state
    const [showCamera, setShowCamera] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Open camera for check-in
    const handleOpenCamera = () => {
        setShowCamera(true);
        setUploadError(null);
    };

    // Handle captured photo
    const handlePhotoCapture = async (photoDataUrl: string) => {
        setShowCamera(false);
        setIsUploading(true);
        setUploadError(null);

        try {
            const staffId = staffData?.id || user?.uid || '';

            // Convert to blob and upload
            const blob = dataURLtoBlob(photoDataUrl);
            const photoUrl = await uploadCheckInPhoto(staffId, blob, 'checkin');

            // Now perform check-in with photo URL
            const success = await checkIn(wifiName || undefined, photoUrl);
            if (success) {
                setShowWifiInput(false);
                setWifiName('');
            }
        } catch (err: any) {
            console.error('Error uploading photo:', err);
            setUploadError(err.message || 'Không thể upload ảnh. Vui lòng thử lại.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleVerifyWifi = async () => {
        if (!wifiName.trim()) return;
        await verifyWithWifiName(wifiName.trim());
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    <span className="text-gray-500">Đang tải thông tin chấm công...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header with Tabs */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Chấm công</h1>
                    <p className="text-gray-500 mt-1">{formatDate(currentTime)}</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('checkin')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'checkin'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Clock className="w-4 h-4 inline-block mr-2" />
                        Chấm công
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Calendar className="w-4 h-4 inline-block mr-2" />
                        Lịch sử
                    </button>
                </div>
            </div>

            {activeTab === 'checkin' ? (
                <>
                    {/* Main CheckIn Card */}
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl text-white overflow-hidden">
                        <div className="p-8 text-center">
                            {/* Current Time Display */}
                            <div className="text-6xl font-light tracking-tight mb-2">
                                {formatTime(currentTime)}
                            </div>

                            {/* IP Info */}
                            <div className="flex items-center justify-center gap-2 text-indigo-200 mb-8">
                                <Wifi size={16} />
                                <span className="text-sm font-mono">IP: {publicIp || 'Đang tải...'}</span>
                            </div>

                            {/* Status & Actions */}
                            {todayCheckIn ? (
                                <div className="space-y-4">
                                    {/* Already Checked In */}
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full">
                                        <CheckCircle size={18} />
                                        <span>Đã chấm công vào lúc {todayCheckIn.checkInTime}</span>
                                    </div>

                                    {todayCheckIn.status === 'checked_in' ? (
                                        <div>
                                            <button
                                                onClick={checkOut}
                                                disabled={actionLoading}
                                                className="flex items-center justify-center gap-2 mx-auto px-8 py-4 bg-white text-purple-600 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                                            >
                                                {actionLoading ? (
                                                    <Loader2 className="animate-spin" size={24} />
                                                ) : (
                                                    <LogOut size={24} />
                                                )}
                                                Chấm công Ra
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/30 rounded-full">
                                            <CheckCircle size={18} />
                                            <span>Đã chấm công ra lúc {todayCheckIn.checkOutTime}</span>
                                        </div>
                                    )}
                                </div>
                            ) : verification?.success ? (
                                <div className="space-y-4">
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/30 rounded-full">
                                        <CheckCircle size={18} />
                                        <span>{verification.message}</span>
                                    </div>

                                    <div>
                                        <button
                                            onClick={handleOpenCamera}
                                            disabled={actionLoading || isUploading}
                                            className="flex items-center justify-center gap-2 mx-auto px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                                        >
                                            {(actionLoading || isUploading) ? (
                                                <Loader2 className="animate-spin" size={24} />
                                            ) : (
                                                <Camera size={24} />
                                            )}
                                            {isUploading ? 'Đang tải ảnh...' : 'Chụp ảnh & Chấm công'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* IP Not Matched */}
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/30 rounded-full">
                                        <AlertTriangle size={18} />
                                        <span>IP không khớp với cấu hình</span>
                                    </div>

                                    {!showWifiInput ? (
                                        <div className="space-y-2">
                                            <p className="text-indigo-200 text-sm">
                                                Nhập tên WiFi để xác thực
                                            </p>
                                            <button
                                                onClick={() => setShowWifiInput(true)}
                                                className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                            >
                                                Nhập tên WiFi
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="max-w-sm mx-auto space-y-3">
                                            <input
                                                type="text"
                                                value={wifiName}
                                                onChange={(e) => setWifiName(e.target.value)}
                                                placeholder="Nhập tên WiFi đang kết nối..."
                                                className="w-full px-4 py-3 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                                                autoFocus
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setShowWifiInput(false);
                                                        setWifiName('');
                                                    }}
                                                    className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                                >
                                                    Hủy
                                                </button>
                                                <button
                                                    onClick={handleVerifyWifi}
                                                    disabled={!wifiName.trim()}
                                                    className="flex-1 px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium disabled:opacity-50"
                                                >
                                                    Xác thực
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                            <XCircle size={20} />
                            <span>{error}</span>
                            <button onClick={refresh} className="ml-auto p-1 hover:bg-red-100 rounded">
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    )}

                    {/* Upload Error Display */}
                    {uploadError && (
                        <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg">
                            <AlertTriangle size={20} />
                            <span>{uploadError}</span>
                            <button onClick={() => setUploadError(null)} className="ml-auto p-1 hover:bg-orange-100 rounded">
                                <XCircle size={16} />
                            </button>
                        </div>
                    )}

                    {/* Today's Summary */}
                    {todayCheckIn && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Chi tiết hôm nay</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500">Giờ vào</p>
                                    <p className="text-xl font-semibold text-gray-900">{todayCheckIn.checkInTime || '—'}</p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500">Giờ ra</p>
                                    <p className="text-xl font-semibold text-gray-900">{todayCheckIn.checkOutTime || '—'}</p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500">Xác thực</p>
                                    <p className="text-lg font-medium text-gray-900 capitalize">
                                        {todayCheckIn.verificationMethod === 'ip' ? 'IP' : 'WiFi Name'}
                                    </p>
                                </div>
                                <div className="text-center p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500">Trạng thái</p>
                                    <p className={`text-lg font-medium ${todayCheckIn.status === 'checked_out' ? 'text-green-600' : 'text-indigo-600'
                                        }`}>
                                        {todayCheckIn.status === 'checked_out' ? 'Đã ra' : 'Đang làm việc'}
                                    </p>
                                </div>
                            </div>

                            {/* Check-in Photo */}
                            {todayCheckIn.checkInPhotoUrl && (
                                <div className="mt-4 pt-4 border-t">
                                    <p className="text-sm text-gray-500 mb-2">Ảnh chấm công</p>
                                    <img
                                        src={todayCheckIn.checkInPhotoUrl}
                                        alt="Check-in photo"
                                        className="w-24 h-24 rounded-lg object-cover border"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <CheckInHistory />
            )}

            {/* Camera Capture Modal */}
            <CameraCapture
                isOpen={showCamera}
                onCapture={handlePhotoCapture}
                onClose={() => setShowCamera(false)}
                title="Chụp ảnh chấm công"
            />
        </div>
    );
};

// History Component
const CheckInHistory: React.FC = () => {
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [selectedCheckIn, setSelectedCheckIn] = useState<any>(null);

    const { checkIns, stats, loading, error, refresh } = useCheckInHistory(month, year);

    const formatDateDisplay = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    const months = [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
        'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
        'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];

    return (
        <div className="space-y-6">
            {/* Month Selector */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {months.map((m, idx) => (
                            <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {[2024, 2025, 2026].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={refresh}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    <RefreshCw size={16} />
                    Làm mới
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <Calendar className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.totalDays}</p>
                                <p className="text-sm text-gray-500">Ngày công</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.onTime}</p>
                                <p className="text-sm text-gray-500">Đúng giờ</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-100 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.late}</p>
                                <p className="text-sm text-gray-500">Đi muộn</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <XCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.absent}</p>
                                <p className="text-sm text-gray-500">Vắng</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-red-500">{error}</div>
                ) : checkIns.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>Không có dữ liệu chấm công trong tháng này</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giờ vào</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giờ ra</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Xác thực</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chi tiết</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {checkIns.map((ci) => {
                                const isLate = ci.checkInTime && (
                                    Number(ci.checkInTime.split(':')[0]) > 8 ||
                                    (Number(ci.checkInTime.split(':')[0]) === 8 && Number(ci.checkInTime.split(':')[1]) > 30)
                                );

                                return (
                                    <tr
                                        key={ci.id}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => setSelectedCheckIn(ci)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatDateDisplay(ci.date)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {ci.checkInTime || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {ci.checkOutTime || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <span className={`px-2 py-1 rounded-full text-xs ${ci.verificationMethod === 'ip'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {ci.verificationMethod === 'ip' ? 'IP' : 'WiFi'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {isLate ? (
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                                                    Đi muộn
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                                    Đúng giờ
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Check-in Detail Modal */}
            {selectedCheckIn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedCheckIn(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                            <h3 className="text-lg font-semibold">Chi tiết chấm công</h3>
                            <button onClick={() => setSelectedCheckIn(null)} className="p-1 hover:bg-white/20 rounded-full">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Ngày</p>
                                    <p className="font-medium">{formatDateDisplay(selectedCheckIn.date)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Trạng thái</p>
                                    <p className="font-medium">{selectedCheckIn.status === 'checked_out' ? 'Đã ra' : 'Đang làm việc'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Giờ vào</p>
                                    <p className="font-medium">{selectedCheckIn.checkInTime || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Giờ ra</p>
                                    <p className="font-medium">{selectedCheckIn.checkOutTime || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Xác thực</p>
                                    <p className="font-medium">{selectedCheckIn.verificationMethod === 'ip' ? 'IP Address' : 'WiFi Name'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">IP</p>
                                    <p className="font-medium font-mono text-sm">{selectedCheckIn.detectedIp}</p>
                                </div>
                            </div>

                            {/* Check-in Photo */}
                            {selectedCheckIn.checkInPhotoUrl && (
                                <div className="pt-4 border-t">
                                    <p className="text-sm text-gray-500 mb-3">Ảnh chấm công</p>
                                    <img
                                        src={selectedCheckIn.checkInPhotoUrl}
                                        alt="Check-in photo"
                                        className="w-full max-h-64 object-contain rounded-lg border"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
