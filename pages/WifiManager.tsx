import React, { useState } from 'react';
import { Wifi, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, ShieldAlert, RefreshCw, Loader2 } from 'lucide-react';
import { useWifiConfig } from '../src/hooks/useWifiConfig';
import { usePermissions } from '../src/hooks/usePermissions';
import { AllowedWifi } from '../types';
import { getPublicIp } from '../src/services/checkInService';

export const WifiManager: React.FC = () => {
    const { wifis, loading, error, createWifi, updateWifi, deleteWifi, toggleActive, refresh } = useWifiConfig();
    const { isAdmin } = usePermissions();

    const [showModal, setShowModal] = useState(false);
    const [editingWifi, setEditingWifi] = useState<AllowedWifi | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        publicIp: '',
        branch: '',
        isActive: true,
    });
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [fetchingIp, setFetchingIp] = useState(false);

    // Quick fetch current IP
    const handleFetchCurrentIp = async () => {
        setFetchingIp(true);
        try {
            const ip = await getPublicIp();
            setFormData({ ...formData, publicIp: ip });
        } catch (err) {
            console.error('Error fetching IP:', err);
        } finally {
            setFetchingIp(false);
        }
    };

    // Check admin permission
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <ShieldAlert className="w-16 h-16 mb-4 text-red-400" />
                <h3 className="text-xl font-medium text-gray-600">Không có quyền truy cập</h3>
                <p className="mt-2">Chỉ Admin mới có thể quản lý cấu hình WiFi.</p>
            </div>
        );
    }

    const handleOpenModal = (wifi?: AllowedWifi) => {
        if (wifi) {
            setEditingWifi(wifi);
            setFormData({
                name: wifi.name,
                publicIp: wifi.publicIp,
                branch: wifi.branch || '',
                isActive: wifi.isActive,
            });
        } else {
            setEditingWifi(null);
            setFormData({ name: '', publicIp: '', branch: '', isActive: true });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingWifi(null);
        setFormData({ name: '', publicIp: '', branch: '', isActive: true });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.publicIp.trim()) return;

        setSaving(true);
        try {
            if (editingWifi) {
                await updateWifi(editingWifi.id, formData);
            } else {
                await createWifi(formData);
            }
            handleCloseModal();
        } catch (err) {
            console.error('Error saving WiFi:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteWifi(id);
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Error deleting WiFi:', err);
        }
    };

    const handleToggle = async (wifi: AllowedWifi) => {
        await toggleActive(wifi.id, !wifi.isActive);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý WiFi</h1>
                    <p className="text-gray-500 mt-1">Cấu hình mạng WiFi được phép chấm công</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={refresh}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        <RefreshCw size={18} />
                        Làm mới
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                        <Plus size={18} />
                        Thêm WiFi
                    </button>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* WiFi List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tên WiFi
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                IP Public
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Cơ sở
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Trạng thái
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Thao tác
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {wifis.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    <Wifi className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p>Chưa có WiFi nào được cấu hình</p>
                                    <button
                                        onClick={() => handleOpenModal()}
                                        className="mt-3 text-indigo-600 hover:text-indigo-800"
                                    >
                                        Thêm WiFi đầu tiên
                                    </button>
                                </td>
                            </tr>
                        ) : (
                            wifis.map((wifi) => (
                                <tr key={wifi.id} className={!wifi.isActive ? 'bg-gray-50 opacity-60' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${wifi.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                                                <Wifi className={`w-5 h-5 ${wifi.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                                            </div>
                                            <span className="font-medium text-gray-900">{wifi.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                                            {wifi.publicIp}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                        {wifi.branch || '—'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => handleToggle(wifi)}
                                            className="flex items-center gap-2"
                                        >
                                            {wifi.isActive ? (
                                                <>
                                                    <ToggleRight className="w-6 h-6 text-green-500" />
                                                    <span className="text-green-600 text-sm">Hoạt động</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                                                    <span className="text-gray-500 text-sm">Tắt</span>
                                                </>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(wifi)}
                                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                title="Sửa"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            {deleteConfirm === wifi.id ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleDelete(wifi.id)}
                                                        className="px-2 py-1 text-xs text-white bg-red-500 rounded hover:bg-red-600"
                                                    >
                                                        Xác nhận
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm(null)}
                                                        className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                                                    >
                                                        Hủy
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setDeleteConfirm(wifi.id)}
                                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {editingWifi ? 'Sửa WiFi' : 'Thêm WiFi mới'}
                            </h3>
                            <button
                                onClick={handleCloseModal}
                                className="p-1 text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tên WiFi (SSID) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ví dụ: Office_WiFi"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    IP Public <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.publicIp}
                                        onChange={(e) => setFormData({ ...formData, publicIp: e.target.value })}
                                        placeholder="Ví dụ: 118.69.123.456"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={handleFetchCurrentIp}
                                        disabled={fetchingIp}
                                        className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                                        title="Lấy IP hiện tại"
                                    >
                                        {fetchingIp ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                                        Lấy IP
                                    </button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Bấm "Lấy IP" để tự động điền IP public hiện tại của mạng bạn đang kết nối
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cơ sở
                                </label>
                                <input
                                    type="text"
                                    value={formData.branch}
                                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                                    placeholder="Ví dụ: Cơ sở 1"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="isActive" className="text-sm text-gray-700">
                                    Kích hoạt (cho phép chấm công)
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Đang lưu...' : editingWifi ? 'Cập nhật' : 'Thêm mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
