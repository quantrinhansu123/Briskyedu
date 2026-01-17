/**
 * Chi tiết kiểm tra data lớp học và buổi học
 * So sánh: schedule, scheduleDetails, startDate, endDate, totalSessions với classSessions
 * Run: npx tsx scripts/audit-class-sessions-detail.ts
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

// Day mapping
const DAY_MAP: Record<string, number> = {
  'chủ nhật': 0, 'cn': 0,
  'thứ 2': 1, 'thứ hai': 1, 't2': 1,
  'thứ 3': 2, 'thứ ba': 2, 't3': 2,
  'thứ 4': 3, 'thứ tư': 3, 't4': 3,
  'thứ 5': 4, 'thứ năm': 4, 't5': 4,
  'thứ 6': 5, 'thứ sáu': 5, 't6': 5,
  'thứ 7': 6, 'thứ bảy': 6, 't7': 6,
};

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

interface ClassData {
  id: string;
  name: string;
  status?: string;
  schedule?: string;
  scheduleDetails?: Array<{
    dayOfWeek: string;
    dayLabel?: string;
    startTime: string;
    endTime: string;
    room?: string;
    teacherId?: string;
    teacher?: string;
  }>;
  startDate?: string;
  endDate?: string;
  totalSessions?: number;
  room?: string;
  teacher?: string;
  teacherId?: string;
}

interface SessionData {
  id: string;
  classId: string;
  className: string;
  sessionNumber: number;
  date: string;
  dayOfWeek: string;
  time?: string;
  status: string;
}

interface ClassAuditResult {
  classId: string;
  className: string;
  status: string;
  // Data completeness
  hasSchedule: boolean;
  hasScheduleDetails: boolean;
  hasStartDate: boolean;
  hasEndDate: boolean;
  hasTotalSessions: boolean;
  // Parsed values
  scheduleDays: string[];
  scheduleTime: string | null;
  startDate: string | null;
  endDate: string | null;
  totalSessions: number | null;
  // Session stats
  sessionCount: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
  sessionsByStatus: Record<string, number>;
  // Validation
  issues: string[];
  warnings: string[];
  isComplete: boolean; // Có đủ data để generate sessions không
}

// Convert Firestore Timestamp or string to ISO date string
function toDateString(value: any): string | null {
  if (!value) return null;
  // Firestore Timestamp
  if (value._seconds !== undefined || value.seconds !== undefined) {
    const seconds = value._seconds ?? value.seconds;
    return new Date(seconds * 1000).toISOString().split('T')[0];
  }
  // Firestore Timestamp with toDate method
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString().split('T')[0];
  }
  // Already a string
  if (typeof value === 'string') {
    return value;
  }
  // Date object
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return null;
}

// Parse schedule string to get days
function parseScheduleDays(schedule: string): number[] {
  if (!schedule) return [];
  const scheduleLower = schedule.toLowerCase();
  const days: Set<number> = new Set();

  for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
    if (scheduleLower.includes(dayName)) {
      days.add(dayNum);
    }
  }

  // Parse T2-T4-T6 format
  const tMatches = schedule.match(/T([2-7])/gi);
  if (tMatches) {
    tMatches.forEach(match => {
      const n = parseInt(match.substring(1));
      if (n >= 2 && n <= 7) days.add(n === 7 ? 6 : n - 1);
    });
  }

  // Parse standalone numbers
  if (days.size === 0) {
    const numberMatches = schedule.match(/\b([2-7])\b/g);
    if (numberMatches) {
      numberMatches.forEach(num => {
        const n = parseInt(num);
        if (n >= 2 && n <= 7) days.add(n === 7 ? 6 : n - 1);
      });
    }
  }

  return Array.from(days).sort();
}

// Parse time from schedule
function parseScheduleTime(schedule: string): string | null {
  if (!schedule) return null;
  const timeMatch = schedule.match(/(\d{1,2})[h:](\d{2})?\s*[-–]\s*(\d{1,2})[h:](\d{2})?/);
  if (timeMatch) {
    const startHour = timeMatch[1].padStart(2, '0');
    const startMin = (timeMatch[2] || '00').padStart(2, '0');
    const endHour = timeMatch[3].padStart(2, '0');
    const endMin = (timeMatch[4] || '00').padStart(2, '0');
    return `${startHour}:${startMin}-${endHour}:${endMin}`;
  }
  return null;
}

// Get days from scheduleDetails
function parseScheduleDetails(details: ClassData['scheduleDetails']): number[] {
  if (!details || details.length === 0) return [];
  return details.map(d => {
    if (/^[2-7]$/.test(d.dayOfWeek)) {
      const n = parseInt(d.dayOfWeek);
      return n === 7 ? 6 : n - 1;
    }
    if (d.dayOfWeek === 'CN') return 0;
    const lower = d.dayOfWeek.toLowerCase();
    return DAY_MAP[lower] ?? -1;
  }).filter(d => d >= 0).sort();
}

// Format date for display
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
}

async function auditClassSessions() {
  console.log('🔍 Kiểm tra chi tiết data lớp học và buổi học...\n');

  // Fetch all classes
  const classesSnap = await db.collection('classes').get();
  const classes: ClassData[] = classesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ClassData));

  console.log(`📚 Tìm thấy ${classes.length} lớp học\n`);

  // Fetch all sessions
  const sessionsSnap = await db.collection('classSessions').get();
  const allSessions: SessionData[] = sessionsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SessionData));

  console.log(`📅 Tìm thấy ${allSessions.length} buổi học\n`);

  // Group sessions by classId
  const sessionsByClass = new Map<string, SessionData[]>();
  allSessions.forEach(s => {
    const existing = sessionsByClass.get(s.classId) || [];
    existing.push(s);
    sessionsByClass.set(s.classId, existing);
  });

  const results: ClassAuditResult[] = [];

  // Audit each class
  for (const cls of classes) {
    const sessions = sessionsByClass.get(cls.id) || [];
    sessions.sort((a, b) => a.date?.localeCompare(b.date || '') || 0);

    const issues: string[] = [];
    const warnings: string[] = [];

    // Convert dates from Firestore format
    const startDateStr = toDateString(cls.startDate);
    const endDateStr = toDateString(cls.endDate);

    // Check data completeness
    const hasSchedule = !!cls.schedule;
    const hasScheduleDetails = !!(cls.scheduleDetails && cls.scheduleDetails.length > 0);
    const hasStartDate = !!startDateStr;
    const hasEndDate = !!endDateStr;
    const hasTotalSessions = typeof cls.totalSessions === 'number' && cls.totalSessions > 0;

    // Parse schedule days
    let scheduleDays: number[] = [];
    if (hasScheduleDetails) {
      scheduleDays = parseScheduleDetails(cls.scheduleDetails);
    } else if (hasSchedule) {
      scheduleDays = parseScheduleDays(cls.schedule!);
    }

    const scheduleTime = cls.schedule ? parseScheduleTime(cls.schedule) : null;

    // Validate data
    if (!hasSchedule && !hasScheduleDetails) {
      issues.push('Thiếu lịch học (schedule hoặc scheduleDetails)');
    } else if (scheduleDays.length === 0) {
      issues.push(`Không parse được ngày học từ: "${cls.schedule}"`);
    }

    if (!hasStartDate) {
      issues.push('Thiếu ngày bắt đầu (startDate)');
    }

    if (!hasEndDate) {
      warnings.push('Thiếu ngày kết thúc (endDate) - sẽ không biết khi nào dừng generate');
    }

    if (!hasTotalSessions) {
      warnings.push('Thiếu tổng số buổi (totalSessions) - khó kiểm tra progress');
    }

    // Session stats
    const sessionsByStatus: Record<string, number> = {};
    sessions.forEach(s => {
      sessionsByStatus[s.status] = (sessionsByStatus[s.status] || 0) + 1;
    });

    const firstSession = sessions[0];
    const lastSession = sessions[sessions.length - 1];

    // Cross-validate sessions with class data
    if (sessions.length > 0) {
      // Check if sessions match schedule days
      const sessionDays = new Set(sessions.map(s => new Date(s.date).getDay()));
      const unexpectedDays = [...sessionDays].filter(d => !scheduleDays.includes(d));
      if (unexpectedDays.length > 0 && scheduleDays.length > 0) {
        warnings.push(`Sessions có ngày không trong lịch: ${unexpectedDays.map(d => DAY_NAMES[d]).join(', ')}`);
      }

      // Check session date range vs class date range
      if (hasStartDate && firstSession && firstSession.date < startDateStr!) {
        warnings.push(`Session đầu (${formatDate(firstSession.date)}) trước startDate (${formatDate(startDateStr)})`);
      }

      if (hasEndDate && lastSession && lastSession.date > endDateStr!) {
        warnings.push(`Session cuối (${formatDate(lastSession.date)}) sau endDate (${formatDate(endDateStr)})`);
      }

      // Check totalSessions vs actual count
      if (hasTotalSessions) {
        if (sessions.length > cls.totalSessions!) {
          warnings.push(`Số sessions (${sessions.length}) > totalSessions (${cls.totalSessions})`);
        } else if (sessions.length < cls.totalSessions! * 0.5) {
          warnings.push(`Số sessions (${sessions.length}) thấp hơn nhiều so với totalSessions (${cls.totalSessions})`);
        }
      }
    } else if (['Đang học', 'Đang hoạt động'].includes(cls.status || '')) {
      // Active class without sessions
      if (issues.length === 0) {
        issues.push('Lớp đang học nhưng chưa có sessions - cần generate');
      }
    }

    // Determine if class has complete data for session generation
    const isComplete = scheduleDays.length > 0 && hasStartDate;

    results.push({
      classId: cls.id,
      className: cls.name,
      status: cls.status || 'N/A',
      hasSchedule,
      hasScheduleDetails,
      hasStartDate,
      hasEndDate,
      hasTotalSessions,
      scheduleDays: scheduleDays.map(d => DAY_NAMES[d]),
      scheduleTime,
      startDate: startDateStr,
      endDate: endDateStr,
      totalSessions: cls.totalSessions || null,
      sessionCount: sessions.length,
      firstSessionDate: firstSession?.date || null,
      lastSessionDate: lastSession?.date || null,
      sessionsByStatus,
      issues,
      warnings,
      isComplete
    });
  }

  // Sort by issues count (most issues first)
  results.sort((a, b) => b.issues.length - a.issues.length || b.warnings.length - a.warnings.length);

  // Print report
  console.log('\n' + '='.repeat(100));
  console.log('📊 BÁO CÁO CHI TIẾT KIỂM TRA DATA LỚP HỌC VÀ BUỔI HỌC');
  console.log('='.repeat(100) + '\n');

  // Summary
  const classesWithIssues = results.filter(r => r.issues.length > 0);
  const classesWithWarnings = results.filter(r => r.warnings.length > 0 && r.issues.length === 0);
  const classesOK = results.filter(r => r.issues.length === 0 && r.warnings.length === 0);
  const incompleteData = results.filter(r => !r.isComplete);
  const noSessions = results.filter(r => r.sessionCount === 0);

  console.log('📈 THỐNG KÊ TỔNG HỢP');
  console.log('-'.repeat(50));
  console.log(`Tổng số lớp: ${results.length}`);
  console.log(`  🔴 Có lỗi: ${classesWithIssues.length}`);
  console.log(`  🟡 Có cảnh báo: ${classesWithWarnings.length}`);
  console.log(`  ✅ OK: ${classesOK.length}`);
  console.log(`  ⚠️ Thiếu data (không thể generate): ${incompleteData.length}`);
  console.log(`  📭 Chưa có sessions: ${noSessions.length}`);
  console.log();

  // Detailed table
  console.log('\n📋 CHI TIẾT TỪNG LỚP');
  console.log('='.repeat(100));

  for (const r of results) {
    const statusIcon = r.issues.length > 0 ? '🔴' : r.warnings.length > 0 ? '🟡' : '✅';
    const sessionIcon = r.sessionCount === 0 ? '📭' : '📅';

    console.log(`\n${statusIcon} ${r.className} (${r.status})`);
    console.log('-'.repeat(60));

    // Data completeness table
    console.log('  📝 Data completeness:');
    console.log(`     schedule: ${r.hasSchedule ? '✓' : '✗'}  scheduleDetails: ${r.hasScheduleDetails ? '✓' : '✗'}  startDate: ${r.hasStartDate ? '✓' : '✗'}  endDate: ${r.hasEndDate ? '✓' : '✗'}  totalSessions: ${r.hasTotalSessions ? '✓' : '✗'}`);

    // Parsed values
    console.log('  📆 Lịch học:');
    console.log(`     Ngày: ${r.scheduleDays.length > 0 ? r.scheduleDays.join(', ') : 'N/A'}`);
    console.log(`     Giờ: ${r.scheduleTime || 'N/A'}`);
    console.log(`     Từ: ${formatDate(r.startDate)} → ${formatDate(r.endDate)}`);
    console.log(`     Tổng buổi: ${r.totalSessions ?? 'N/A'}`);

    // Sessions
    console.log(`  ${sessionIcon} Sessions: ${r.sessionCount}`);
    if (r.sessionCount > 0) {
      console.log(`     Từ: ${formatDate(r.firstSessionDate)} → ${formatDate(r.lastSessionDate)}`);
      const statusStr = Object.entries(r.sessionsByStatus).map(([k, v]) => `${k}: ${v}`).join(', ');
      console.log(`     Trạng thái: ${statusStr}`);
    }

    // Issues
    if (r.issues.length > 0) {
      console.log('  🔴 Lỗi:');
      r.issues.forEach(i => console.log(`     - ${i}`));
    }

    // Warnings
    if (r.warnings.length > 0) {
      console.log('  🟡 Cảnh báo:');
      r.warnings.forEach(w => console.log(`     - ${w}`));
    }

    // Can generate?
    if (!r.isComplete) {
      console.log('  ⚠️ THIẾU DATA - Không thể tự động generate sessions');
    }
  }

  // Classes needing attention
  console.log('\n\n' + '='.repeat(100));
  console.log('🎯 CÁC LỚP CẦN XỬ LÝ');
  console.log('='.repeat(100));

  // 1. Classes with no sessions but complete data (can auto-generate)
  const canGenerate = results.filter(r => r.sessionCount === 0 && r.isComplete && ['Đang học', 'Đang hoạt động'].includes(r.status));
  if (canGenerate.length > 0) {
    console.log('\n📌 Có thể tự động generate sessions:');
    canGenerate.forEach(r => {
      console.log(`   - ${r.className}: ${r.scheduleDays.join(', ')} từ ${formatDate(r.startDate)}`);
    });
  }

  // 2. Classes with no sessions and incomplete data (need manual input)
  const needManualInput = results.filter(r => r.sessionCount === 0 && !r.isComplete && ['Đang học', 'Đang hoạt động'].includes(r.status));
  if (needManualInput.length > 0) {
    console.log('\n📌 Cần nhập thêm data trên UI:');
    needManualInput.forEach(r => {
      console.log(`   - ${r.className}: ${r.issues.join(', ')}`);
    });
  }

  // 3. Classes with session issues
  const sessionIssues = results.filter(r => r.sessionCount > 0 && (r.issues.length > 0 || r.warnings.length > 0));
  if (sessionIssues.length > 0) {
    console.log('\n📌 Có sessions nhưng cần kiểm tra:');
    sessionIssues.forEach(r => {
      const allIssues = [...r.issues, ...r.warnings];
      console.log(`   - ${r.className}: ${allIssues[0]}${allIssues.length > 1 ? ` (+${allIssues.length - 1})` : ''}`);
    });
  }

  console.log('\n\n✅ Hoàn thành kiểm tra!');

  // Save report to file
  const reportPath = join(__dirname, '../plans/reports/audit-260117-class-sessions-detail.md');
  const mdReport = generateMarkdownReport(results, {
    canGenerate,
    needManualInput,
    sessionIssues,
    classesWithIssues,
    classesOK
  });
  writeFileSync(reportPath, mdReport);
  console.log(`\n📄 Đã lưu báo cáo: ${reportPath}`);
}

function generateMarkdownReport(results: ClassAuditResult[], summary: any): string {
  const now = new Date().toLocaleString('vi-VN');

  let md = `# Báo Cáo Kiểm Tra Chi Tiết: Lớp Học & Buổi Học

**Ngày kiểm tra:** ${now}
**Tổng số lớp:** ${results.length}

---

## Tổng Quan

| Metric | Count |
|--------|-------|
| 🔴 Lớp có lỗi | ${summary.classesWithIssues.length} |
| ✅ Lớp OK | ${summary.classesOK.length} |
| 📌 Có thể auto-generate | ${summary.canGenerate.length} |
| ⚠️ Cần nhập thêm data | ${summary.needManualInput.length} |

---

## Các Lớp Cần Xử Lý

### 1. Có thể tự động generate sessions

`;

  if (summary.canGenerate.length > 0) {
    md += '| Lớp | Lịch | Bắt đầu | Kết thúc |\n|-----|------|---------|----------|\n';
    summary.canGenerate.forEach((r: ClassAuditResult) => {
      md += `| ${r.className} | ${r.scheduleDays.join(', ')} | ${r.startDate || 'N/A'} | ${r.endDate || 'N/A'} |\n`;
    });
  } else {
    md += '*Không có*\n';
  }

  md += `
### 2. Cần nhập thêm data trên UI

`;

  if (summary.needManualInput.length > 0) {
    md += '| Lớp | Thiếu |\n|-----|-------|\n';
    summary.needManualInput.forEach((r: ClassAuditResult) => {
      md += `| ${r.className} | ${r.issues.join(', ')} |\n`;
    });
  } else {
    md += '*Không có*\n';
  }

  md += `
---

## Chi Tiết Từng Lớp

`;

  results.forEach(r => {
    const icon = r.issues.length > 0 ? '🔴' : r.warnings.length > 0 ? '🟡' : '✅';
    md += `### ${icon} ${r.className}

- **Status:** ${r.status}
- **Sessions:** ${r.sessionCount}
- **Lịch học:** ${r.scheduleDays.join(', ') || 'N/A'} (${r.scheduleTime || 'N/A'})
- **Thời gian:** ${r.startDate || 'N/A'} → ${r.endDate || 'N/A'}
- **Tổng buổi:** ${r.totalSessions ?? 'N/A'}
`;

    if (r.issues.length > 0) {
      md += '\n**Lỗi:**\n';
      r.issues.forEach(i => md += `- ${i}\n`);
    }

    if (r.warnings.length > 0) {
      md += '\n**Cảnh báo:**\n';
      r.warnings.forEach(w => md += `- ${w}\n`);
    }

    md += '\n';
  });

  return md;
}

auditClassSessions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });
