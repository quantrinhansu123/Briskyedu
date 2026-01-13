import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { StaffCheckIn, CheckInVerificationMethod } from '../../types';
import { verifyIpAddress, findWifiByName } from './wifiConfigService';
import { createAttendanceLog, getStaffAttendance } from './staffSalaryService';

const CHECKIN_COLLECTION = 'staffCheckIns';

/**
 * Get the current public IP address using external API
 */
export const getPublicIp = async (): Promise<string> => {
    try {
        // Using ipify API - free and reliable
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error fetching public IP:', error);
        throw new Error('Không thể lấy địa chỉ IP. Vui lòng thử lại.');
    }
};

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayDate = (): string => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

/**
 * Get current time in HH:mm format
 */
const getCurrentTime = (): string => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
};

/**
 * Get check-ins for a staff member (optionally filtered by month/year)
 */
export const getCheckIns = async (
    staffId: string,
    month?: number,
    year?: number
): Promise<StaffCheckIn[]> => {
    // Simple query without orderBy to avoid composite index requirement
    const q = query(
        collection(db, CHECKIN_COLLECTION),
        where('staffId', '==', staffId)
    );

    const snapshot = await getDocs(q);
    let checkIns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffCheckIn));

    // Filter by month/year if provided
    if (month && year) {
        checkIns = checkIns.filter(ci => {
            const [y, m] = ci.date.split('-').map(Number);
            return m === month && y === year;
        });
    }

    // Sort by date descending (client-side)
    return checkIns.sort((a, b) => b.date.localeCompare(a.date));
};

/**
 * Get today's check-in record for a staff member
 */
export const getTodayCheckIn = async (staffId: string): Promise<StaffCheckIn | null> => {
    const today = getTodayDate();
    const q = query(
        collection(db, CHECKIN_COLLECTION),
        where('staffId', '==', staffId),
        where('date', '==', today)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as StaffCheckIn;
};

/**
 * Verification result type
 */
export interface VerificationResult {
    success: boolean;
    method: CheckInVerificationMethod | null;
    matchedWifiId?: string;
    message: string;
}

/**
 * Verify IP or WiFi name for check-in
 */
export const verifyForCheckIn = async (
    ip: string,
    wifiName?: string
): Promise<VerificationResult> => {
    // First, try to match by IP
    const matchedByIp = await verifyIpAddress(ip);
    if (matchedByIp) {
        return {
            success: true,
            method: 'ip',
            matchedWifiId: matchedByIp.id,
            message: `Xác thực thành công qua IP (${matchedByIp.name})`,
        };
    }

    // If IP doesn't match, try WiFi name
    if (wifiName) {
        const matchedByName = await findWifiByName(wifiName);
        if (matchedByName) {
            return {
                success: true,
                method: 'wifi_name',
                matchedWifiId: matchedByName.id,
                message: `Xác thực thành công qua tên WiFi (${matchedByName.name})`,
            };
        }
    }

    // Both failed
    return {
        success: false,
        method: null,
        message: wifiName
            ? 'IP và tên WiFi không khớp với cấu hình. Không thể chấm công.'
            : 'IP không khớp với cấu hình. Vui lòng nhập tên WiFi để xác thực.',
    };
};

/**
 * Perform check-in for a staff member
 */
export const checkIn = async (
    staffId: string,
    staffName: string,
    ip: string,
    verificationMethod: CheckInVerificationMethod,
    matchedWifiId?: string,
    wifiName?: string,
    checkInPhotoUrl?: string
): Promise<StaffCheckIn> => {
    const today = getTodayDate();
    const now = getCurrentTime();

    // Check if already checked in today
    const existing = await getTodayCheckIn(staffId);
    if (existing) {
        throw new Error('Bạn đã chấm công hôm nay rồi.');
    }

    const checkInData: Record<string, any> = {
        staffId,
        staffName,
        date: today,
        checkInTime: now,
        detectedIp: ip,
        verificationMethod,
        status: 'checked_in',
        createdAt: new Date().toISOString(),
    };

    // Only add optional fields if they have values (Firestore doesn't accept undefined)
    if (wifiName) checkInData.detectedWifiName = wifiName;
    if (matchedWifiId) checkInData.matchedWifiId = matchedWifiId;
    if (checkInPhotoUrl) checkInData.checkInPhotoUrl = checkInPhotoUrl;

    const docRef = await addDoc(collection(db, CHECKIN_COLLECTION), checkInData);

    return { id: docRef.id, ...checkInData } as StaffCheckIn;
};

/**
 * Perform check-out for a staff member
 */
export const checkOut = async (staffId: string): Promise<StaffCheckIn> => {
    const existing = await getTodayCheckIn(staffId);
    if (!existing) {
        throw new Error('Bạn chưa chấm công vào hôm nay.');
    }

    if (existing.status === 'checked_out') {
        throw new Error('Bạn đã chấm công ra rồi.');
    }

    const now = getCurrentTime();
    const docRef = doc(db, CHECKIN_COLLECTION, existing.id);

    await updateDoc(docRef, {
        checkOutTime: now,
        status: 'checked_out',
        updatedAt: new Date().toISOString(),
    });

    // Sync to StaffAttendanceLog for salary calculation
    await syncToAttendanceLog(existing, now);

    return {
        ...existing,
        checkOutTime: now,
        status: 'checked_out',
    };
};

/**
 * Sync check-in data to StaffAttendanceLog for salary calculation
 */
const syncToAttendanceLog = async (checkIn: StaffCheckIn, checkOutTime: string): Promise<void> => {
    try {
        // Determine status based on check-in time
        const [hour, minute] = checkIn.checkInTime!.split(':').map(Number);
        const isLate = hour > 8 || (hour === 8 && minute > 30); // After 8:30 is late

        // Format date to DD/MM/YYYY for StaffAttendanceLog
        const [year, month, day] = checkIn.date.split('-');
        const formattedDate = `${day}/${month}/${year}`;

        await createAttendanceLog({
            staffId: checkIn.staffId,
            date: formattedDate,
            checkIn: checkIn.checkInTime!,
            checkOut: checkOutTime,
            status: isLate ? 'Đi muộn' : 'Đúng giờ',
            note: `Chấm công tự động qua ${checkIn.verificationMethod === 'ip' ? 'IP' : 'WiFi name'}`,
            photoUrl: checkIn.checkInPhotoUrl,
        });
    } catch (error) {
        console.error('Error syncing to attendance log:', error);
        // Don't throw - the check-out was successful, just sync failed
    }
};

/**
 * Get check-in statistics for a month
 */
export const getMonthlyStats = async (
    staffId: string,
    month: number,
    year: number
): Promise<{
    totalDays: number;
    onTime: number;
    late: number;
    absent: number;
}> => {
    const checkIns = await getCheckIns(staffId, month, year);

    let onTime = 0;
    let late = 0;

    checkIns.forEach(ci => {
        if (ci.checkInTime) {
            const [hour, minute] = ci.checkInTime.split(':').map(Number);
            if (hour > 8 || (hour === 8 && minute > 30)) {
                late++;
            } else {
                onTime++;
            }
        }
    });

    // Calculate working days in month (excluding weekends)
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
    }

    return {
        totalDays: checkIns.length,
        onTime,
        late,
        absent: workingDays - checkIns.length,
    };
};
