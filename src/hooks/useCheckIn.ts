import { useState, useEffect, useCallback } from 'react';
import { StaffCheckIn } from '../../types';
import {
    getPublicIp,
    getTodayCheckIn,
    getCheckIns,
    checkIn as doCheckIn,
    checkOut as doCheckOut,
    verifyForCheckIn,
    getMonthlyStats,
    VerificationResult,
} from '../services/checkInService';
import { useAuth } from './useAuth';

export const useCheckIn = () => {
    const { user, staffData } = useAuth();
    const [todayCheckIn, setTodayCheckIn] = useState<StaffCheckIn | null>(null);
    const [publicIp, setPublicIp] = useState<string | null>(null);
    const [verification, setVerification] = useState<VerificationResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const staffId = staffData?.id || user?.uid || '';
    const staffName = staffData?.name || user?.displayName || '';

    // Fetch current IP and today's check-in status
    const initialize = useCallback(async () => {
        if (!staffId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // First, get IP - this should rarely fail
        let ip = '';
        try {
            ip = await getPublicIp();
            setPublicIp(ip);
        } catch (err: any) {
            console.error('Error fetching IP:', err);
            setError('Không thể lấy IP. Vui lòng kiểm tra kết nối mạng.');
            setLoading(false);
            return;
        }

        try {
            // Then fetch check-in status
            const checkIn = await getTodayCheckIn(staffId);
            setTodayCheckIn(checkIn);

            // Verify IP if not already checked in
            if (!checkIn && ip) {
                try {
                    const result = await verifyForCheckIn(ip);
                    setVerification(result);
                } catch (verifyErr: any) {
                    console.error('Error verifying IP:', verifyErr);
                    // Show IP not matched so user can enter WiFi name
                    setVerification({
                        success: false,
                        method: null,
                        message: 'Không thể xác thực IP. Vui lòng nhập tên WiFi.',
                    });
                }
            }
        } catch (err: any) {
            console.error('Error initializing check-in:', err);
            // Still allow check-in if we have IP, show verification failed
            setVerification({
                success: false,
                method: null,
                message: 'Không thể tải dữ liệu. Vui lòng nhập tên WiFi để xác thực.',
            });
        } finally {
            setLoading(false);
        }
    }, [staffId]);

    useEffect(() => {
        initialize();
    }, [initialize]);

    // Verify with custom WiFi name
    const verifyWithWifiName = async (wifiName: string): Promise<void> => {
        if (!publicIp) {
            setError('Chưa có thông tin IP');
            return;
        }

        try {
            const result = await verifyForCheckIn(publicIp, wifiName);
            setVerification(result);
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Perform check-in
    const checkIn = async (wifiName?: string, photoUrl?: string): Promise<boolean> => {
        if (!staffId || !publicIp || !verification?.success) {
            setError('Không đủ thông tin để chấm công');
            return false;
        }

        setActionLoading(true);
        setError(null);
        try {
            const result = await doCheckIn(
                staffId,
                staffName,
                publicIp,
                verification.method!,
                verification.matchedWifiId,
                wifiName,
                photoUrl
            );
            setTodayCheckIn(result);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        } finally {
            setActionLoading(false);
        }
    };

    // Perform check-out
    const checkOut = async (): Promise<boolean> => {
        if (!staffId) {
            setError('Không đủ thông tin để chấm công ra');
            return false;
        }

        setActionLoading(true);
        setError(null);
        try {
            const result = await doCheckOut(staffId);
            setTodayCheckIn(result);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        } finally {
            setActionLoading(false);
        }
    };

    return {
        todayCheckIn,
        publicIp,
        verification,
        loading,
        error,
        actionLoading,
        checkIn,
        checkOut,
        verifyWithWifiName,
        refresh: initialize,
    };
};

// Hook for check-in history
export const useCheckInHistory = (month?: number, year?: number) => {
    const { user, staffData } = useAuth();
    const [checkIns, setCheckIns] = useState<StaffCheckIn[]>([]);
    const [stats, setStats] = useState<{
        totalDays: number;
        onTime: number;
        late: number;
        absent: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const staffId = staffData?.id || user?.uid || '';

    const fetchHistory = useCallback(async () => {
        if (!staffId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const now = new Date();
            const m = month || now.getMonth() + 1;
            const y = year || now.getFullYear();

            const [history, monthStats] = await Promise.all([
                getCheckIns(staffId, m, y),
                getMonthlyStats(staffId, m, y),
            ]);

            setCheckIns(history);
            setStats(monthStats);
        } catch (err: any) {
            console.error('Error fetching check-in history:', err);
            setError(err.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    }, [staffId, month, year]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    return {
        checkIns,
        stats,
        loading,
        error,
        refresh: fetchHistory,
    };
};
