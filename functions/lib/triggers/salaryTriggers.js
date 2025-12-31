"use strict";
/**
 * Salary Cloud Functions
 *
 * Handles salary calculations and sync between collections:
 * - Monthly scheduled salary calculation
 * - Real-time sync when rewards/penalties are created
 * - Manual recalculation callable function
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAllSalariesForMonth = exports.recalculateSalary = exports.onRewardPenaltyCreate = exports.calculateMonthlySalaries = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const REGION = 'asia-southeast1';
// Position salary configuration (mirrored from frontend)
const POSITION_SALARY_CONFIG = {
    'Trưởng Nhóm CSKH': { baseMultiplier: 1.3, hasKpiBonus: true, hasCommission: false, defaultBaseSalary: 8000000 },
    'NV CSKH': { baseMultiplier: 1.0, hasKpiBonus: true, hasCommission: false, defaultBaseSalary: 6000000 },
    'Lễ tân': { baseMultiplier: 1.0, hasKpiBonus: true, hasCommission: false, defaultBaseSalary: 5500000 },
    'Tư vấn viên': { baseMultiplier: 1.0, hasKpiBonus: true, hasCommission: false, defaultBaseSalary: 5500000 },
    'Trưởng Nhóm CM': { baseMultiplier: 1.3, hasKpiBonus: true, hasCommission: false, defaultBaseSalary: 8000000 },
    'NV CM': { baseMultiplier: 1.0, hasKpiBonus: true, hasCommission: false, defaultBaseSalary: 6000000 },
    'Trưởng Nhóm Sale': { baseMultiplier: 1.3, hasKpiBonus: true, hasCommission: true, defaultBaseSalary: 7000000 },
    'NV Sale': { baseMultiplier: 1.0, hasKpiBonus: true, hasCommission: true, defaultBaseSalary: 5000000 },
    'Kế toán': { baseMultiplier: 1.0, hasKpiBonus: false, hasCommission: false, defaultBaseSalary: 7000000 },
    'Quản lý (Admin)': { baseMultiplier: 1.5, hasKpiBonus: true, hasCommission: false, defaultBaseSalary: 12000000 },
    'Quản lý': { baseMultiplier: 1.5, hasKpiBonus: true, hasCommission: false, defaultBaseSalary: 12000000 },
};
const DEFAULT_CONFIG = { baseMultiplier: 1.0, hasKpiBonus: false, hasCommission: false, defaultBaseSalary: 0 };
function getPositionConfig(position) {
    return POSITION_SALARY_CONFIG[position] || DEFAULT_CONFIG;
}
/**
 * Calculate salary for a single staff member
 */
async function calculateStaffSalary(staffId, staff, month, year) {
    // Get rewards/penalties for this month
    const rewardsSnap = await db.collection('rewardPenalties')
        .where('staffId', '==', staffId)
        .where('month', '==', month)
        .where('year', '==', year)
        .get();
    let rewards = 0;
    let penalties = 0;
    rewardsSnap.forEach(doc => {
        const rp = doc.data();
        if (rp.type === 'reward' || rp.type === 'Thưởng') {
            rewards += rp.amount || 0;
        }
        else {
            penalties += rp.amount || 0;
        }
    });
    // Get position config
    const posConfig = getPositionConfig(staff.position || '');
    const baseSalary = staff.salary || posConfig.defaultBaseSalary || 0;
    const positionBonus = baseSalary * (posConfig.baseMultiplier - 1);
    // Calculate based on department
    let workSessions = 0;
    let sessionRate = 0;
    let workDays = 0;
    if (staff.department === 'Đào Tạo') {
        // Teachers: count work sessions
        const sessionsSnap = await db.collection('workSessions')
            .where('staffId', '==', staffId)
            .where('status', '==', 'Completed')
            .get();
        sessionsSnap.forEach(doc => {
            const session = doc.data();
            const sessionDate = session.date ? new Date(session.date) : null;
            if (sessionDate &&
                sessionDate.getMonth() + 1 === month &&
                sessionDate.getFullYear() === year) {
                workSessions++;
            }
        });
        // Get rate from salaryRules
        const ruleSnap = await db.collection('salaryRules')
            .where('staffId', '==', staffId)
            .limit(1)
            .get();
        if (!ruleSnap.empty) {
            sessionRate = ruleSnap.docs[0].data().baseRate || 0;
        }
    }
    else {
        // Office staff: count work days from staffAttendance
        const attendanceSnap = await db.collection('staffAttendance')
            .where('staffId', '==', staffId)
            .get();
        attendanceSnap.forEach(doc => {
            const att = doc.data();
            if (att.date) {
                // Parse date format: DD/MM/YYYY
                const parts = att.date.split('/');
                if (parts.length === 3) {
                    const [, m, y] = parts.map(Number); // Skip day, only need month and year
                    if (m === month && y === year && att.status !== 'Nghỉ không phép') {
                        workDays++;
                    }
                }
            }
        });
    }
    const earnedFromWork = staff.department === 'Đào Tạo'
        ? workSessions * sessionRate
        : (baseSalary / 22) * workDays; // 22 work days per month
    const totalGross = earnedFromWork + positionBonus + rewards;
    const totalDeductions = penalties;
    const totalNet = totalGross - totalDeductions;
    return {
        staffId,
        staffName: staff.name || '',
        position: staff.position || '',
        department: staff.department || '',
        month,
        year,
        baseSalary,
        positionBonus,
        workDays,
        workSessions,
        sessionRate,
        kpiBonus: 0,
        commission: 0,
        rewards,
        penalties,
        latePenalty: 0,
        otherDeductions: 0,
        totalGross,
        totalDeductions,
        totalNet,
        status: 'calculated',
        calculatedAt: new Date().toISOString(),
    };
}
/**
 * Scheduled function: Calculate monthly salaries
 * Runs on 1st of each month at 1:00 AM Vietnam time
 */
exports.calculateMonthlySalaries = functions
    .region(REGION)
    .pubsub.schedule('0 1 1 * *')
    .timeZone('Asia/Ho_Chi_Minh')
    .onRun(async () => {
    const now = new Date();
    // Calculate for previous month
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    console.log(`Calculating salaries for ${month}/${year}`);
    // Get all active staff
    const staffSnap = await db.collection('staff')
        .where('status', '==', 'Active')
        .get();
    let successCount = 0;
    let errorCount = 0;
    for (const staffDoc of staffSnap.docs) {
        try {
            const staff = staffDoc.data();
            const summary = await calculateStaffSalary(staffDoc.id, staff, month, year);
            // Check if summary already exists
            const existingSnap = await db.collection('monthlySalarySummary')
                .where('staffId', '==', staffDoc.id)
                .where('month', '==', month)
                .where('year', '==', year)
                .limit(1)
                .get();
            if (existingSnap.empty) {
                await db.collection('monthlySalarySummary').add(summary);
            }
            else {
                // Update existing
                await existingSnap.docs[0].ref.update(summary);
            }
            successCount++;
        }
        catch (error) {
            console.error(`Error calculating salary for ${staffDoc.id}:`, error);
            errorCount++;
        }
    }
    console.log(`Salary calculation complete: ${successCount} success, ${errorCount} errors`);
    return null;
});
/**
 * Trigger: Update salary summary when reward/penalty is created
 */
exports.onRewardPenaltyCreate = functions
    .region(REGION)
    .firestore
    .document('rewardPenalties/{docId}')
    .onCreate(async (snap) => {
    const rp = snap.data();
    const { staffId, month, year, type, amount } = rp;
    if (!staffId || !month || !year) {
        console.log('Missing required fields in rewardPenalty document');
        return null;
    }
    // Find existing summary for this month
    const summarySnap = await db.collection('monthlySalarySummary')
        .where('staffId', '==', staffId)
        .where('month', '==', month)
        .where('year', '==', year)
        .limit(1)
        .get();
    if (!summarySnap.empty) {
        const summaryRef = summarySnap.docs[0].ref;
        const summary = summarySnap.docs[0].data();
        const isReward = type === 'reward' || type === 'Thưởng';
        if (isReward) {
            await summaryRef.update({
                rewards: (summary.rewards || 0) + (amount || 0),
                totalGross: (summary.totalGross || 0) + (amount || 0),
                totalNet: (summary.totalNet || 0) + (amount || 0),
            });
        }
        else {
            await summaryRef.update({
                penalties: (summary.penalties || 0) + (amount || 0),
                totalDeductions: (summary.totalDeductions || 0) + (amount || 0),
                totalNet: (summary.totalNet || 0) - (amount || 0),
            });
        }
        console.log(`Updated salary summary for ${staffId}: ${type} ${amount}`);
    }
    return null;
});
/**
 * Callable function: Manual salary recalculation
 */
exports.recalculateSalary = functions
    .region(REGION)
    .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Bạn cần đăng nhập để thực hiện thao tác này.');
    }
    // Check admin permission
    const callerDoc = await db.collection('staff').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Không tìm thấy thông tin người dùng.');
    }
    const callerData = callerDoc.data();
    const allowedRoles = ['Quản trị viên', 'Quản lý'];
    if (!allowedRoles.includes((callerData === null || callerData === void 0 ? void 0 : callerData.role) || '')) {
        throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền tính lại lương.');
    }
    const { staffId, month, year } = data;
    if (!staffId || !month || !year) {
        throw new functions.https.HttpsError('invalid-argument', 'Thiếu thông tin nhân viên hoặc tháng/năm.');
    }
    // Get staff data
    const staffDoc = await db.collection('staff').doc(staffId).get();
    if (!staffDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Không tìm thấy nhân viên.');
    }
    // Calculate salary
    const summary = await calculateStaffSalary(staffId, staffDoc.data(), month, year);
    // Delete existing and create new
    const existingSnap = await db.collection('monthlySalarySummary')
        .where('staffId', '==', staffId)
        .where('month', '==', month)
        .where('year', '==', year)
        .get();
    const batch = db.batch();
    existingSnap.forEach(doc => batch.delete(doc.ref));
    batch.set(db.collection('monthlySalarySummary').doc(), summary);
    await batch.commit();
    return {
        success: true,
        message: `Đã tính lại lương cho tháng ${month}/${year}`,
        summary,
    };
});
/**
 * Callable function: Calculate all staff salaries for a specific month
 */
exports.calculateAllSalariesForMonth = functions
    .region(REGION)
    .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Bạn cần đăng nhập để thực hiện thao tác này.');
    }
    // Check admin permission
    const callerDoc = await db.collection('staff').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Không tìm thấy thông tin người dùng.');
    }
    const callerData = callerDoc.data();
    const allowedRoles = ['Quản trị viên', 'Quản lý'];
    if (!allowedRoles.includes((callerData === null || callerData === void 0 ? void 0 : callerData.role) || '')) {
        throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền tính lương.');
    }
    const { month, year } = data;
    if (!month || !year) {
        throw new functions.https.HttpsError('invalid-argument', 'Thiếu thông tin tháng/năm.');
    }
    // Get all active staff
    const staffSnap = await db.collection('staff')
        .where('status', '==', 'Active')
        .get();
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    for (const staffDoc of staffSnap.docs) {
        try {
            const staff = staffDoc.data();
            const summary = await calculateStaffSalary(staffDoc.id, staff, month, year);
            // Check if summary already exists
            const existingSnap = await db.collection('monthlySalarySummary')
                .where('staffId', '==', staffDoc.id)
                .where('month', '==', month)
                .where('year', '==', year)
                .limit(1)
                .get();
            if (existingSnap.empty) {
                await db.collection('monthlySalarySummary').add(summary);
            }
            else {
                await existingSnap.docs[0].ref.update(summary);
            }
            successCount++;
            results.push({ staffId: staffDoc.id, success: true });
        }
        catch (error) {
            errorCount++;
            results.push({ staffId: staffDoc.id, success: false, error: error.message });
        }
    }
    return {
        success: errorCount === 0,
        message: `Đã tính lương cho ${successCount}/${staffSnap.size} nhân viên`,
        successCount,
        errorCount,
        results,
    };
});
//# sourceMappingURL=salaryTriggers.js.map