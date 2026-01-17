/**
 * Script to validate class sessions against schedule data
 * Kiểm tra tính nhất quán giữa buổi học (classSessions) và lịch học (schedule) của các lớp
 * Run: npx tsx scripts/validate-sessions-vs-schedule.ts
 */

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Init Firebase Admin - try service account first, then ADC
const serviceAccountPath = join(__dirname, '../service-account.json');
if (existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount)
  });
} else {
  // Use Application Default Credentials (from gcloud auth)
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    credential: applicationDefault()
  });
}
const db = getFirestore();

// Day mapping - Vietnamese to JS day (0=Sunday)
const DAY_MAP: Record<string, number> = {
  'chủ nhật': 0, 'cn': 0,
  'thứ 2': 1, 'thứ hai': 1, 't2': 1,
  'thứ 3': 2, 'thứ ba': 2, 't3': 2,
  'thứ 4': 3, 'thứ tư': 3, 't4': 3,
  'thứ 5': 4, 'thứ năm': 4, 't5': 4,
  'thứ 6': 5, 'thứ sáu': 5, 't6': 5,
  'thứ 7': 6, 'thứ bảy': 6, 't7': 6,
};

const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

// Normalize day name for comparison (Thứ Hai = Thứ 2, etc.)
function normalizeDayName(dayName: string): number {
  if (!dayName) return -1;
  const lower = dayName.toLowerCase().trim();
  // Check against DAY_MAP
  for (const [name, num] of Object.entries(DAY_MAP)) {
    if (lower === name || lower.includes(name)) {
      return num;
    }
  }
  // Check against DAY_NAMES format
  const match = dayName.match(/(\d)/);
  if (match) {
    const n = parseInt(match[1]);
    if (n >= 2 && n <= 7) return n === 7 ? 6 : n - 1;
  }
  return -1;
}

interface ClassData {
  id: string;
  name: string;
  schedule?: string;
  scheduleDetails?: Array<{
    dayOfWeek: string;
    dayLabel: string;
    startTime: string;
    endTime: string;
    room?: string;
    teacherId?: string;
    teacher?: string;
  }>;
  startDate?: any;
  endDate?: any;
  status?: string;
  room?: string;
  teacherId?: string;
  teacher?: string;
  totalSessions?: number;
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
  teacherId?: string;
  teacherName?: string;
  status: string;
}

interface Issue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  classId: string;
  className: string;
  message: string;
  details?: string;
}

// Parse schedule string to get days
function parseScheduleDays(schedule: string): number[] {
  if (!schedule) return [];

  const scheduleLower = schedule.toLowerCase();
  const days: Set<number> = new Set();

  // Check for standard day names
  for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
    if (scheduleLower.includes(dayName)) {
      days.add(dayNum);
    }
  }

  // Parse T2-T4-T6 or T2, T4, T6 format
  const tMatches = schedule.match(/T([2-7])/gi);
  if (tMatches) {
    tMatches.forEach(match => {
      const n = parseInt(match.substring(1));
      if (n >= 2 && n <= 7) {
        days.add(n === 7 ? 6 : n - 1);
      }
    });
  }

  // Parse standalone numbers like "2, 4, 6"
  if (days.size === 0) {
    const numberMatches = schedule.match(/\b([2-7])\b/g);
    if (numberMatches) {
      numberMatches.forEach(num => {
        const n = parseInt(num);
        if (n >= 2 && n <= 7) {
          days.add(n === 7 ? 6 : n - 1);
        }
      });
    }
  }

  return Array.from(days).sort();
}

// Parse time from schedule string
function parseScheduleTime(schedule: string): string | null {
  if (!schedule) return null;

  const timeRangeMatch = schedule.match(/(\d{1,2})[h:](\d{2})?\s*[-–]\s*(\d{1,2})[h:](\d{2})?/);
  if (timeRangeMatch) {
    const startHour = timeRangeMatch[1].padStart(2, '0');
    const startMin = (timeRangeMatch[2] || '00').padStart(2, '0');
    const endHour = timeRangeMatch[3].padStart(2, '0');
    const endMin = (timeRangeMatch[4] || '00').padStart(2, '0');
    return `${startHour}:${startMin}-${endHour}:${endMin}`;
  }

  return null;
}

// Get schedule days from scheduleDetails array (new format)
function parseScheduleDetails(details: ClassData['scheduleDetails']): number[] {
  if (!details || details.length === 0) return [];

  return details.map(d => {
    const dayKey = d.dayOfWeek.toLowerCase();
    // Map '2', '3', etc to JS day
    if (/^[2-7]$/.test(d.dayOfWeek)) {
      const n = parseInt(d.dayOfWeek);
      return n === 7 ? 6 : n - 1;
    }
    if (d.dayOfWeek === 'CN') return 0;
    return DAY_MAP[dayKey] ?? -1;
  }).filter(d => d >= 0).sort();
}

async function validateSessions() {
  console.log('🔍 Kiểm tra tính nhất quán buổi học vs lịch học...\n');

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

  const issues: Issue[] = [];

  // Validate each class
  for (const cls of classes) {
    const sessions = sessionsByClass.get(cls.id) || [];

    // Issue 1: Class has no schedule defined
    if (!cls.schedule && (!cls.scheduleDetails || cls.scheduleDetails.length === 0)) {
      issues.push({
        type: 'NO_SCHEDULE',
        severity: 'warning',
        classId: cls.id,
        className: cls.name,
        message: 'Lớp không có lịch học được định nghĩa',
        details: `Status: ${cls.status || 'N/A'}`
      });
      continue;
    }

    // Get expected days from schedule
    let expectedDays: number[] = [];
    let scheduleSource = '';

    if (cls.scheduleDetails && cls.scheduleDetails.length > 0) {
      expectedDays = parseScheduleDetails(cls.scheduleDetails);
      scheduleSource = 'scheduleDetails';
    } else if (cls.schedule) {
      expectedDays = parseScheduleDays(cls.schedule);
      scheduleSource = 'schedule string';
    }

    const expectedTime = cls.schedule ? parseScheduleTime(cls.schedule) : null;

    // Issue 2: Cannot parse schedule
    if (expectedDays.length === 0 && cls.schedule) {
      issues.push({
        type: 'UNPARSEABLE_SCHEDULE',
        severity: 'error',
        classId: cls.id,
        className: cls.name,
        message: 'Không thể parse lịch học',
        details: `Schedule: "${cls.schedule}"`
      });
      continue;
    }

    // Issue 3: No sessions for active class
    if (sessions.length === 0) {
      const isActive = ['Đang học', 'Đang hoạt động', 'Active'].includes(cls.status || '');
      issues.push({
        type: 'NO_SESSIONS',
        severity: isActive ? 'error' : 'info',
        classId: cls.id,
        className: cls.name,
        message: isActive ? 'Lớp đang hoạt động nhưng không có buổi học nào' : 'Lớp không có buổi học',
        details: `Status: ${cls.status}, Schedule: "${cls.schedule}"`
      });
      continue;
    }

    // Sort sessions by date and sessionNumber
    sessions.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.sessionNumber - b.sessionNumber;
    });

    // Issue 4: Check session numbers continuity
    const sessionNumbers = sessions.map(s => s.sessionNumber).filter(n => n > 0);
    const uniqueNumbers = [...new Set(sessionNumbers)].sort((a, b) => a - b);

    // Check for duplicates
    if (sessionNumbers.length !== uniqueNumbers.length) {
      const duplicates: number[] = [];
      const seen = new Set<number>();
      sessionNumbers.forEach(n => {
        if (seen.has(n)) duplicates.push(n);
        seen.add(n);
      });
      issues.push({
        type: 'DUPLICATE_SESSION_NUMBER',
        severity: 'error',
        classId: cls.id,
        className: cls.name,
        message: 'Có số buổi học bị trùng lặp',
        details: `Trùng: ${[...new Set(duplicates)].join(', ')}`
      });
    }

    // Check for gaps
    if (uniqueNumbers.length > 0) {
      const expectedSequence = [];
      for (let i = uniqueNumbers[0]; i <= uniqueNumbers[uniqueNumbers.length - 1]; i++) {
        expectedSequence.push(i);
      }
      const missing = expectedSequence.filter(n => !uniqueNumbers.includes(n));
      if (missing.length > 0 && missing.length <= 10) {
        issues.push({
          type: 'MISSING_SESSION_NUMBERS',
          severity: 'warning',
          classId: cls.id,
          className: cls.name,
          message: 'Thiếu số buổi học trong chuỗi',
          details: `Thiếu: ${missing.join(', ')}`
        });
      }
    }

    // Issue 5: Check day of week consistency
    const wrongDaySessions: SessionData[] = [];
    sessions.forEach(s => {
      if (!s.date) return;
      const sessionDate = new Date(s.date);
      const actualDay = sessionDate.getDay();

      // Check if session's dayOfWeek matches actual date using normalized comparison
      const normalizedSessionDay = normalizeDayName(s.dayOfWeek);
      if (s.dayOfWeek && normalizedSessionDay !== actualDay && normalizedSessionDay !== -1) {
        wrongDaySessions.push(s);
      }

      // Check if actual day is in expected schedule
      if (expectedDays.length > 0 && !expectedDays.includes(actualDay)) {
        // This session is on a day not in schedule (could be makeup session)
        if (s.status !== 'Học bù') {
          issues.push({
            type: 'SESSION_WRONG_DAY',
            severity: 'warning',
            classId: cls.id,
            className: cls.name,
            message: `Buổi ${s.sessionNumber} (${s.date}) rơi vào ${DAY_NAMES[actualDay]} không đúng lịch học`,
            details: `Lịch: ${expectedDays.map(d => DAY_NAMES[d]).join(', ')}, Trạng thái: ${s.status}`
          });
        }
      }
    });

    if (wrongDaySessions.length > 0) {
      issues.push({
        type: 'DAYOFWEEK_MISMATCH',
        severity: 'error',
        classId: cls.id,
        className: cls.name,
        message: `${wrongDaySessions.length} buổi có dayOfWeek không khớp với ngày thực tế`,
        details: wrongDaySessions.slice(0, 5).map(s =>
          `Buổi ${s.sessionNumber}: ${s.date} (thực: ${DAY_NAMES[new Date(s.date).getDay()]}, ghi: ${s.dayOfWeek})`
        ).join('; ')
      });
    }

    // Issue 6: Check session time consistency
    if (expectedTime) {
      const wrongTimeSessions = sessions.filter(s => s.time && s.time !== expectedTime);
      if (wrongTimeSessions.length > 0) {
        issues.push({
          type: 'TIME_MISMATCH',
          severity: 'warning',
          classId: cls.id,
          className: cls.name,
          message: `${wrongTimeSessions.length} buổi có thời gian không khớp với lịch`,
          details: `Lịch: ${expectedTime}, Mẫu: ${wrongTimeSessions.slice(0, 3).map(s => `Buổi ${s.sessionNumber}: ${s.time}`).join(', ')}`
        });
      }
    }

    // Issue 7: Check teacher consistency
    if (cls.teacherId) {
      const wrongTeacherSessions = sessions.filter(s => s.teacherId && s.teacherId !== cls.teacherId);
      if (wrongTeacherSessions.length > 0) {
        issues.push({
          type: 'TEACHER_MISMATCH',
          severity: 'info',
          classId: cls.id,
          className: cls.name,
          message: `${wrongTeacherSessions.length} buổi có giáo viên khác với lớp`,
          details: `Lớp: ${cls.teacher || cls.teacherId}, Khác: ${wrongTeacherSessions.slice(0, 3).map(s => s.teacherName || s.teacherId).join(', ')}`
        });
      }
    }

    // Issue 8: Check room consistency
    if (cls.room) {
      const wrongRoomSessions = sessions.filter(s => s.room && s.room !== cls.room);
      if (wrongRoomSessions.length > 0) {
        issues.push({
          type: 'ROOM_MISMATCH',
          severity: 'info',
          classId: cls.id,
          className: cls.name,
          message: `${wrongRoomSessions.length} buổi có phòng khác với lớp`,
          details: `Lớp: ${cls.room}, Khác: ${[...new Set(wrongRoomSessions.map(s => s.room))].join(', ')}`
        });
      }
    }

    // Issue 9: Invalid session numbers (0 or negative)
    const invalidNumberSessions = sessions.filter(s => s.sessionNumber <= 0);
    if (invalidNumberSessions.length > 0) {
      issues.push({
        type: 'INVALID_SESSION_NUMBER',
        severity: 'error',
        classId: cls.id,
        className: cls.name,
        message: `${invalidNumberSessions.length} buổi có sessionNumber không hợp lệ (<=0)`,
        details: `IDs: ${invalidNumberSessions.slice(0, 5).map(s => s.id).join(', ')}`
      });
    }

    // Issue 10: Check className matches
    const wrongNameSessions = sessions.filter(s => s.className !== cls.name);
    if (wrongNameSessions.length > 0) {
      issues.push({
        type: 'CLASSNAME_MISMATCH',
        severity: 'warning',
        classId: cls.id,
        className: cls.name,
        message: `${wrongNameSessions.length} buổi có className không khớp`,
        details: `Lớp: "${cls.name}", Sai: "${[...new Set(wrongNameSessions.map(s => s.className))].join('", "')}"`
      });
    }

    // Issue 11: totalSessions vs actual count
    if (cls.totalSessions && cls.totalSessions > 0) {
      const sessionCount = sessions.length;
      if (sessionCount > cls.totalSessions) {
        issues.push({
          type: 'EXCESS_SESSIONS',
          severity: 'warning',
          classId: cls.id,
          className: cls.name,
          message: `Số buổi thực tế (${sessionCount}) vượt quá totalSessions (${cls.totalSessions})`,
          details: `Thừa: ${sessionCount - cls.totalSessions} buổi`
        });
      }
    }
  }

  // Check for orphan sessions (sessions with classId that doesn't exist)
  const classIds = new Set(classes.map(c => c.id));
  const orphanSessions = allSessions.filter(s => !classIds.has(s.classId));
  if (orphanSessions.length > 0) {
    const orphanClassIds = [...new Set(orphanSessions.map(s => s.classId))];
    issues.push({
      type: 'ORPHAN_SESSIONS',
      severity: 'error',
      classId: 'MULTIPLE',
      className: 'N/A',
      message: `${orphanSessions.length} buổi học thuộc về lớp không tồn tại`,
      details: `ClassIds: ${orphanClassIds.slice(0, 5).join(', ')}${orphanClassIds.length > 5 ? '...' : ''}`
    });
  }

  // Print report
  console.log('\n' + '='.repeat(80));
  console.log('📊 BÁO CÁO KIỂM TRA TÍNH NHẤT QUÁN');
  console.log('='.repeat(80) + '\n');

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  console.log(`Tổng số vấn đề: ${issues.length}`);
  console.log(`  🔴 Lỗi (Error): ${errorCount}`);
  console.log(`  🟡 Cảnh báo (Warning): ${warningCount}`);
  console.log(`  🔵 Thông tin (Info): ${infoCount}`);
  console.log();

  // Group by type
  const byType = new Map<string, Issue[]>();
  issues.forEach(i => {
    const existing = byType.get(i.type) || [];
    existing.push(i);
    byType.set(i.type, existing);
  });

  // Print errors first, then warnings, then info
  const severityOrder = ['error', 'warning', 'info'];

  for (const severity of severityOrder) {
    const severityIssues = issues.filter(i => i.severity === severity);
    if (severityIssues.length === 0) continue;

    const emoji = severity === 'error' ? '🔴' : severity === 'warning' ? '🟡' : '🔵';
    console.log(`\n${emoji} ${severity.toUpperCase()} (${severityIssues.length})`);
    console.log('-'.repeat(60));

    // Group by type within severity
    const typeGroups = new Map<string, Issue[]>();
    severityIssues.forEach(i => {
      const existing = typeGroups.get(i.type) || [];
      existing.push(i);
      typeGroups.set(i.type, existing);
    });

    for (const [type, typeIssues] of typeGroups) {
      console.log(`\n  [${type}] (${typeIssues.length} cases)`);
      typeIssues.slice(0, 10).forEach(i => {
        console.log(`    • ${i.className}: ${i.message}`);
        if (i.details) console.log(`      → ${i.details}`);
      });
      if (typeIssues.length > 10) {
        console.log(`    ... và ${typeIssues.length - 10} trường hợp khác`);
      }
    }
  }

  // Summary by class
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 TÓM TẮT THEO LỚP');
  console.log('='.repeat(80) + '\n');

  const issuesByClass = new Map<string, Issue[]>();
  issues.forEach(i => {
    if (i.classId === 'MULTIPLE') return;
    const existing = issuesByClass.get(i.classId) || [];
    existing.push(i);
    issuesByClass.set(i.classId, existing);
  });

  // Sort by issue count
  const classIssueArray = [...issuesByClass.entries()].sort((a, b) => b[1].length - a[1].length);

  console.log(`Lớp có vấn đề: ${classIssueArray.length}/${classes.length}\n`);

  classIssueArray.slice(0, 20).forEach(([classId, classIssues]) => {
    const cls = classes.find(c => c.id === classId);
    const errors = classIssues.filter(i => i.severity === 'error').length;
    const warnings = classIssues.filter(i => i.severity === 'warning').length;
    console.log(`${cls?.name || classId}: ${errors > 0 ? `🔴${errors} ` : ''}${warnings > 0 ? `🟡${warnings} ` : ''}(${classIssues.length} issues)`);
  });

  if (classIssueArray.length > 20) {
    console.log(`\n... và ${classIssueArray.length - 20} lớp khác`);
  }

  console.log('\n\n✅ Hoàn thành kiểm tra!');
}

validateSessions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });
