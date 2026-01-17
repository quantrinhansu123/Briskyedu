/**
 * Audit Sessions for Specific Classes
 * Target: 16 lớp có vấn đề data inconsistency
 * Run: npx tsx scripts/audit-specific-classes-sessions.ts
 */

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Init Firebase Admin
const serviceAccountPath = join(__dirname, '../service-account.json');
if (existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
} else {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    credential: applicationDefault()
  });
}
const db = getFirestore();

// Target classes to audit
const TARGET_CLASSES = [
  'Cam 4.2', 'Sunny 5', 'Kindy 4', 'Cam 4.3', 'Ket 1C', 'Ket 2B',
  'Pre - Starters 27', 'English 3.2', 'Pet 1A', 'Let 2A',
  'Starter 28', 'Cam 3.1', 'Kindy 12', 'Cam 4.1', 'Kindy 15', 'Starter 23'
];

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

interface ClassData {
  id: string;
  name: string;
  status?: string;
  schedule?: string;
  scheduleDetails?: Array<{
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room?: string;
  }>;
  startDate?: any;
  endDate?: any;
  totalSessions?: number;
  room?: string;
  teacherId?: string;
  teacherName?: string;
}

interface SessionData {
  id: string;
  classId: string;
  className: string;
  sessionNumber: number;
  date: string;
  dayOfWeek: string;
  time?: string;
  room?: string;
  status: string;
  attendanceId?: string;
  teacherId?: string;
  teacherName?: string;
}

interface SessionIssue {
  sessionId: string;
  sessionNumber: number;
  date: string;
  type: 'DUPLICATE_NUMBER' | 'DUPLICATE_DATE' | 'WRONG_DAY' | 'DAYOFWEEK_MISMATCH' | 'INVALID_NUMBER' | 'CLASSNAME_MISMATCH' | 'HAS_ATTENDANCE';
  severity: 'error' | 'warning' | 'info';
  message: string;
  hasAttendance: boolean;
}

interface ClassAudit {
  classId: string;
  className: string;
  classStatus: string;
  // Class schedule info
  scheduleString: string;
  scheduleDays: string[];
  startDate: string | null;
  endDate: string | null;
  totalSessionsExpected: number | null;
  // Session stats
  totalSessions: number;
  sessionsWithAttendance: number;
  sessionsByStatus: Record<string, number>;
  // Issues
  issues: SessionIssue[];
  issuesSummary: Record<string, number>;
  // Session details for review
  sessions: Array<{
    id: string;
    number: number;
    date: string;
    dayOfWeek: string;
    actualDay: string;
    time: string;
    status: string;
    hasAttendance: boolean;
    issues: string[];
  }>;
}

// Convert Firestore Timestamp to date string
function toDateString(value: any): string | null {
  if (!value) return null;
  if (value._seconds !== undefined || value.seconds !== undefined) {
    const seconds = value._seconds ?? value.seconds;
    return new Date(seconds * 1000).toISOString().split('T')[0];
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString().split('T')[0];
  }
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return null;
}

// Parse schedule days from scheduleDetails or schedule string
function parseScheduleDays(cls: ClassData): number[] {
  const days: Set<number> = new Set();

  // Try scheduleDetails first (more accurate)
  if (cls.scheduleDetails && cls.scheduleDetails.length > 0) {
    cls.scheduleDetails.forEach(d => {
      if (/^[2-7]$/.test(d.dayOfWeek)) {
        const n = parseInt(d.dayOfWeek);
        days.add(n === 7 ? 6 : n - 1);
      } else if (d.dayOfWeek === 'CN') {
        days.add(0);
      }
    });
  }

  // Fallback to schedule string
  if (days.size === 0 && cls.schedule) {
    const schedule = cls.schedule.toLowerCase();
    const dayMap: Record<string, number> = {
      'cn': 0, 'chủ nhật': 0,
      't2': 1, 'thứ 2': 1, 'thứ hai': 1,
      't3': 2, 'thứ 3': 2, 'thứ ba': 2,
      't4': 3, 'thứ 4': 3, 'thứ tư': 3,
      't5': 4, 'thứ 5': 4, 'thứ năm': 4,
      't6': 5, 'thứ 6': 5, 'thứ sáu': 5,
      't7': 6, 'thứ 7': 6, 'thứ bảy': 6,
    };
    for (const [name, num] of Object.entries(dayMap)) {
      if (schedule.includes(name)) days.add(num);
    }
    // Parse T2, T4 format
    const tMatches = cls.schedule.match(/T([2-7])/gi);
    if (tMatches) {
      tMatches.forEach(m => {
        const n = parseInt(m.substring(1));
        days.add(n === 7 ? 6 : n - 1);
      });
    }
  }

  return Array.from(days).sort();
}

// Get actual day of week from date
function getActualDay(dateStr: string): number {
  return new Date(dateStr).getDay();
}

async function auditClasses() {
  console.log('🔍 Kiểm tra chi tiết sessions của 16 lớp...\n');

  // Fetch all classes
  const classesSnap = await db.collection('classes').get();
  const allClasses: ClassData[] = classesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ClassData));

  // Filter target classes
  const targetClasses = allClasses.filter(c =>
    TARGET_CLASSES.some(name => c.name.toLowerCase() === name.toLowerCase())
  );

  console.log(`📚 Tìm thấy ${targetClasses.length}/${TARGET_CLASSES.length} lớp target\n`);

  // Check missing classes
  const foundNames = targetClasses.map(c => c.name.toLowerCase());
  const missingClasses = TARGET_CLASSES.filter(name =>
    !foundNames.includes(name.toLowerCase())
  );
  if (missingClasses.length > 0) {
    console.log(`⚠️ Không tìm thấy: ${missingClasses.join(', ')}\n`);
  }

  // Fetch all sessions for target classes
  const classIds = targetClasses.map(c => c.id);
  const sessionsSnap = await db.collection('classSessions').get();
  const allSessions: SessionData[] = sessionsSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as SessionData))
    .filter(s => classIds.includes(s.classId));

  console.log(`📅 Tìm thấy ${allSessions.length} sessions cho ${targetClasses.length} lớp\n`);

  // Group sessions by classId
  const sessionsByClass = new Map<string, SessionData[]>();
  allSessions.forEach(s => {
    const existing = sessionsByClass.get(s.classId) || [];
    existing.push(s);
    sessionsByClass.set(s.classId, existing);
  });

  const audits: ClassAudit[] = [];

  // Audit each class
  for (const cls of targetClasses) {
    const sessions = sessionsByClass.get(cls.id) || [];
    sessions.sort((a, b) => a.date?.localeCompare(b.date || '') || 0);

    const scheduleDays = parseScheduleDays(cls);
    const issues: SessionIssue[] = [];

    // Check for duplicate session numbers
    const numberCounts = new Map<number, SessionData[]>();
    sessions.forEach(s => {
      const existing = numberCounts.get(s.sessionNumber) || [];
      existing.push(s);
      numberCounts.set(s.sessionNumber, existing);
    });

    for (const [num, dupSessions] of numberCounts) {
      if (dupSessions.length > 1) {
        dupSessions.forEach(s => {
          issues.push({
            sessionId: s.id,
            sessionNumber: s.sessionNumber,
            date: s.date,
            type: 'DUPLICATE_NUMBER',
            severity: 'error',
            message: `Buổi ${num} bị trùng (${dupSessions.length} sessions)`,
            hasAttendance: !!s.attendanceId
          });
        });
      }
    }

    // Check for duplicate dates
    const dateCounts = new Map<string, SessionData[]>();
    sessions.forEach(s => {
      if (!s.date) return;
      const existing = dateCounts.get(s.date) || [];
      existing.push(s);
      dateCounts.set(s.date, existing);
    });

    for (const [date, dupSessions] of dateCounts) {
      if (dupSessions.length > 1) {
        dupSessions.forEach(s => {
          issues.push({
            sessionId: s.id,
            sessionNumber: s.sessionNumber,
            date: s.date,
            type: 'DUPLICATE_DATE',
            severity: 'error',
            message: `Ngày ${date} bị trùng (${dupSessions.length} sessions)`,
            hasAttendance: !!s.attendanceId
          });
        });
      }
    }

    // Check each session
    for (const s of sessions) {
      // Invalid session number
      if (s.sessionNumber <= 0) {
        issues.push({
          sessionId: s.id,
          sessionNumber: s.sessionNumber,
          date: s.date,
          type: 'INVALID_NUMBER',
          severity: 'error',
          message: `SessionNumber không hợp lệ: ${s.sessionNumber}`,
          hasAttendance: !!s.attendanceId
        });
      }

      // Check dayOfWeek matches actual date
      if (s.date && s.dayOfWeek) {
        const actualDay = getActualDay(s.date);
        const storedDay = s.dayOfWeek;
        const actualDayName = DAY_NAMES[actualDay];

        // Normalize stored day for comparison
        let storedDayNum = -1;
        if (storedDay.match(/T[2-7]|CN/i)) {
          storedDayNum = storedDay.toUpperCase() === 'CN' ? 0 : parseInt(storedDay.substring(1)) - 1;
        } else if (storedDay.match(/Thứ \d/)) {
          const m = storedDay.match(/\d/);
          if (m) storedDayNum = parseInt(m[0]) - 1;
        } else if (storedDay.includes('Chủ nhật')) {
          storedDayNum = 0;
        }

        if (storedDayNum !== -1 && storedDayNum !== actualDay) {
          issues.push({
            sessionId: s.id,
            sessionNumber: s.sessionNumber,
            date: s.date,
            type: 'DAYOFWEEK_MISMATCH',
            severity: 'error',
            message: `dayOfWeek "${storedDay}" không khớp với date ${s.date} (thực tế: ${actualDayName})`,
            hasAttendance: !!s.attendanceId
          });
        }
      }

      // Check if date matches schedule
      if (s.date && scheduleDays.length > 0) {
        const actualDay = getActualDay(s.date);
        if (!scheduleDays.includes(actualDay) && s.status !== 'Học bù') {
          issues.push({
            sessionId: s.id,
            sessionNumber: s.sessionNumber,
            date: s.date,
            type: 'WRONG_DAY',
            severity: 'warning',
            message: `Ngày ${s.date} (${DAY_NAMES[actualDay]}) không nằm trong lịch học (${scheduleDays.map(d => DAY_NAMES[d]).join(', ')})`,
            hasAttendance: !!s.attendanceId
          });
        }
      }

      // Check className matches
      if (s.className !== cls.name) {
        issues.push({
          sessionId: s.id,
          sessionNumber: s.sessionNumber,
          date: s.date,
          type: 'CLASSNAME_MISMATCH',
          severity: 'warning',
          message: `className "${s.className}" khác với class.name "${cls.name}"`,
          hasAttendance: !!s.attendanceId
        });
      }

      // Info: has attendance (important for fix decisions)
      if (s.attendanceId) {
        issues.push({
          sessionId: s.id,
          sessionNumber: s.sessionNumber,
          date: s.date,
          type: 'HAS_ATTENDANCE',
          severity: 'info',
          message: `Buổi đã điểm danh (attendanceId: ${s.attendanceId})`,
          hasAttendance: true
        });
      }
    }

    // Count sessions by status
    const sessionsByStatus: Record<string, number> = {};
    sessions.forEach(s => {
      sessionsByStatus[s.status] = (sessionsByStatus[s.status] || 0) + 1;
    });

    // Count issues by type
    const issuesSummary: Record<string, number> = {};
    issues.forEach(i => {
      issuesSummary[i.type] = (issuesSummary[i.type] || 0) + 1;
    });

    // Prepare session details
    const sessionDetails = sessions.map(s => {
      const actualDay = s.date ? getActualDay(s.date) : -1;
      const sessionIssues = issues
        .filter(i => i.sessionId === s.id && i.type !== 'HAS_ATTENDANCE')
        .map(i => i.type);
      return {
        id: s.id,
        number: s.sessionNumber,
        date: s.date || 'N/A',
        dayOfWeek: s.dayOfWeek || 'N/A',
        actualDay: actualDay >= 0 ? DAY_NAMES[actualDay] : 'N/A',
        time: s.time || 'N/A',
        status: s.status,
        hasAttendance: !!s.attendanceId,
        issues: sessionIssues
      };
    });

    audits.push({
      classId: cls.id,
      className: cls.name,
      classStatus: cls.status || 'N/A',
      scheduleString: cls.schedule || 'N/A',
      scheduleDays: scheduleDays.map(d => DAY_NAMES[d]),
      startDate: toDateString(cls.startDate),
      endDate: toDateString(cls.endDate),
      totalSessionsExpected: cls.totalSessions || null,
      totalSessions: sessions.length,
      sessionsWithAttendance: sessions.filter(s => !!s.attendanceId).length,
      sessionsByStatus,
      issues: issues.filter(i => i.type !== 'HAS_ATTENDANCE'),
      issuesSummary,
      sessions: sessionDetails
    });
  }

  // Sort by issue count
  audits.sort((a, b) => b.issues.length - a.issues.length);

  // Generate report
  const report = generateReport(audits, missingClasses);

  // Save report
  const reportPath = join(__dirname, '../plans/reports/audit-260117-1251-specific-classes-sessions.md');
  writeFileSync(reportPath, report);
  console.log(`\n📄 Đã lưu báo cáo: ${reportPath}`);

  // Print summary
  printSummary(audits);
}

function generateReport(audits: ClassAudit[], missingClasses: string[]): string {
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' });

  let md = `# Báo Cáo Kiểm Tra Sessions - 16 Lớp Target

**Ngày kiểm tra:** ${now}
**Tổng số lớp kiểm tra:** ${audits.length}/${TARGET_CLASSES.length}

---

## 📊 Tổng Quan

| Metric | Count |
|--------|-------|
| Lớp có lỗi (error) | ${audits.filter(a => a.issues.some(i => i.severity === 'error')).length} |
| Lớp có cảnh báo (warning) | ${audits.filter(a => a.issues.some(i => i.severity === 'warning') && !a.issues.some(i => i.severity === 'error')).length} |
| Lớp OK | ${audits.filter(a => a.issues.length === 0).length} |
| Tổng sessions | ${audits.reduce((sum, a) => sum + a.totalSessions, 0)} |
| Sessions đã điểm danh | ${audits.reduce((sum, a) => sum + a.sessionsWithAttendance, 0)} |

`;

  if (missingClasses.length > 0) {
    md += `
### ⚠️ Lớp không tìm thấy trong database

${missingClasses.map(c => `- ${c}`).join('\n')}

`;
  }

  md += `---

## 🔴 Phân Tích Lỗi Theo Loại

`;

  // Aggregate issues by type
  const issueTypeStats: Record<string, { count: number; classes: string[] }> = {};
  audits.forEach(a => {
    a.issues.forEach(i => {
      if (!issueTypeStats[i.type]) {
        issueTypeStats[i.type] = { count: 0, classes: [] };
      }
      issueTypeStats[i.type].count++;
      if (!issueTypeStats[i.type].classes.includes(a.className)) {
        issueTypeStats[i.type].classes.push(a.className);
      }
    });
  });

  for (const [type, stats] of Object.entries(issueTypeStats)) {
    const severity = type.includes('DUPLICATE') || type === 'INVALID_NUMBER' || type === 'DAYOFWEEK_MISMATCH' ? '🔴' : '🟡';
    md += `### ${severity} ${type}

- **Số lượng:** ${stats.count} issues
- **Các lớp:** ${stats.classes.join(', ')}

`;
  }

  md += `---

## 📋 Chi Tiết Từng Lớp

`;

  for (const audit of audits) {
    const icon = audit.issues.some(i => i.severity === 'error') ? '🔴' :
                 audit.issues.some(i => i.severity === 'warning') ? '🟡' : '✅';

    md += `### ${icon} ${audit.className}

**ID:** \`${audit.classId}\`
**Status:** ${audit.classStatus}
**Lịch học:** ${audit.scheduleString} → Ngày: ${audit.scheduleDays.join(', ') || 'N/A'}
**Thời gian:** ${audit.startDate || 'N/A'} → ${audit.endDate || 'N/A'}
**Tổng buổi expected:** ${audit.totalSessionsExpected ?? 'N/A'}

#### Sessions: ${audit.totalSessions} (đã điểm danh: ${audit.sessionsWithAttendance})

`;

    if (audit.issues.length > 0) {
      md += `#### Issues (${audit.issues.length})

| # | Date | Type | Message | Has Attendance |
|---|------|------|---------|----------------|
`;
      audit.issues.forEach(i => {
        md += `| ${i.sessionNumber} | ${i.date} | ${i.type} | ${i.message} | ${i.hasAttendance ? '⚠️ Có' : 'Không'} |\n`;
      });
    } else {
      md += `✅ Không có lỗi\n`;
    }

    // Session table (limit to first 20 for readability)
    if (audit.sessions.length > 0) {
      md += `
#### Danh sách sessions (${audit.sessions.length} buổi)

| # | Date | Stored Day | Actual Day | Time | Status | Attendance | Issues |
|---|------|------------|------------|------|--------|------------|--------|
`;
      audit.sessions.slice(0, 30).forEach(s => {
        const dayMatch = s.dayOfWeek === s.actualDay ||
                         (s.dayOfWeek.includes(s.actualDay)) ? '✓' : '❌';
        md += `| ${s.number} | ${s.date} | ${s.dayOfWeek} | ${s.actualDay} ${dayMatch} | ${s.time} | ${s.status} | ${s.hasAttendance ? '✓' : ''} | ${s.issues.join(', ') || '-'} |\n`;
      });
      if (audit.sessions.length > 30) {
        md += `| ... | ... | ... | ... | ... | ... | ... | (${audit.sessions.length - 30} sessions nữa) |\n`;
      }
    }

    md += '\n---\n\n';
  }

  md += `## 🛠️ Đề Xuất Xử Lý

### Safe Fixes (có thể auto-fix)
1. **CLASSNAME_MISMATCH**: Update session.className = class.name
2. **DAYOFWEEK_MISMATCH**: Update session.dayOfWeek theo actual date

### Cần Review Thủ Công
1. **DUPLICATE_NUMBER**: Chọn 1 session giữ lại, merge attendanceId nếu có
2. **DUPLICATE_DATE**: Tương tự, kiểm tra xem có phải 2 ca học cùng ngày không
3. **WRONG_DAY**: Xác định đây là buổi học bù hay lỗi data

### Sessions Có Attendance (⚠️ QUAN TRỌNG)
Các sessions đã có attendanceId **KHÔNG NÊN XÓA** - cần preserve hoặc merge khi fix.

`;

  return md;
}

function printSummary(audits: ClassAudit[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TÓM TẮT');
  console.log('='.repeat(80));

  const errorClasses = audits.filter(a => a.issues.some(i => i.severity === 'error'));
  const warningClasses = audits.filter(a =>
    a.issues.some(i => i.severity === 'warning') &&
    !a.issues.some(i => i.severity === 'error')
  );
  const okClasses = audits.filter(a => a.issues.length === 0);

  console.log(`\n🔴 Lớp có lỗi (${errorClasses.length}):`);
  errorClasses.forEach(a => {
    const errorTypes = [...new Set(a.issues.filter(i => i.severity === 'error').map(i => i.type))];
    console.log(`   - ${a.className}: ${errorTypes.join(', ')}`);
  });

  console.log(`\n🟡 Lớp có cảnh báo (${warningClasses.length}):`);
  warningClasses.forEach(a => {
    const warnTypes = [...new Set(a.issues.filter(i => i.severity === 'warning').map(i => i.type))];
    console.log(`   - ${a.className}: ${warnTypes.join(', ')}`);
  });

  console.log(`\n✅ Lớp OK (${okClasses.length}):`);
  okClasses.forEach(a => console.log(`   - ${a.className}`));

  console.log('\n');
}

auditClasses()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });
