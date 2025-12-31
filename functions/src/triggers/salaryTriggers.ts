/**
 * Salary Cloud Functions
 *
 * Handles salary calculations and sync between collections:
 * - Monthly scheduled salary calculation
 * - Real-time sync when rewards/penalties are created
 * - Manual recalculation callable function
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const REGION = 'asia-southeast1';

// Position salary configuration (mirrored from frontend)
const POSITION_SALARY_CONFIG: Record<string, {
  baseMultiplier: number;
  hasKpiBonus: boolean;
  hasCommission: boolean;
  defaultBaseSalary: number;
}> = {
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

function getPositionConfig(position: string) {
  return POSITION_SALARY_CONFIG[position] || DEFAULT_CONFIG;
}

// MonthlySalarySummary interface
interface MonthlySalarySummary {
  staffId: string;
  staffName: string;
  position: string;
  department: string;
  month: number;
  year: number;
  baseSalary: number;
  positionBonus: number;
  workDays: number;
  workSessions: number;
  sessionRate: number;
  kpiBonus: number;
  commission: number;
  rewards: number;
  penalties: number;
  latePenalty: number;
  otherDeductions: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  status: 'draft' | 'calculated' | 'approved' | 'paid';
  calculatedAt: string;
}

/**
 * Calculate salary for a single staff member
 */
async function calculateStaffSalary(
  staffId: string,
  staff: admin.firestore.DocumentData,
  month: number,
  year: number
): Promise<MonthlySalarySummary> {
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
    } else {
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
  } else {
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
export const calculateMonthlySalaries = functions
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
          await db.collection('monthlySalarySummary').add(summary as any);
        } else {
          // Update existing
          await existingSnap.docs[0].ref.update(summary as any);
        }

        successCount++;
      } catch (error) {
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
export const onRewardPenaltyCreate = functions
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
      } else {
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
export const recalculateSalary = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn cần đăng nhập để thực hiện thao tác này.'
      );
    }

    // Check admin permission
    const callerDoc = await db.collection('staff').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Không tìm thấy thông tin người dùng.');
    }

    const callerData = callerDoc.data();
    const allowedRoles = ['Quản trị viên', 'Quản lý'];
    if (!allowedRoles.includes(callerData?.role || '')) {
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
    const summary = await calculateStaffSalary(staffId, staffDoc.data()!, month, year);

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
export const calculateAllSalariesForMonth = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn cần đăng nhập để thực hiện thao tác này.'
      );
    }

    // Check admin permission
    const callerDoc = await db.collection('staff').doc(context.auth.uid).get();
    if (!callerDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Không tìm thấy thông tin người dùng.');
    }

    const callerData = callerDoc.data();
    const allowedRoles = ['Quản trị viên', 'Quản lý'];
    if (!allowedRoles.includes(callerData?.role || '')) {
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
    const results: { staffId: string; success: boolean; error?: string }[] = [];

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
          await db.collection('monthlySalarySummary').add(summary as any);
        } else {
          await existingSnap.docs[0].ref.update(summary as any);
        }

        successCount++;
        results.push({ staffId: staffDoc.id, success: true });
      } catch (error: any) {
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
