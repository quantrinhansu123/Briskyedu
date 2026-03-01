/**
 * Check Pre Starters 26 class sessions
 * Verify: order, dates match schedule, no gaps/duplicates
 *
 * Usage: npx tsx scripts/check-pre-starters26-sessions.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!) });
}
const db = getFirestore();

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

async function checkStarters25() {
  // 1. Find the class
  const classSnap = await db.collection('classes').where('name', '==', 'Pre Starters 26').get();

  if (classSnap.empty) {
    // Try partial match
    const allClasses = await db.collection('classes').get();
    const matches = allClasses.docs.filter(d =>
      (d.data().name || '').toLowerCase().includes('pre starters 26')
    );
    if (matches.length === 0) {
      console.log('❌ Không tìm thấy lớp "Pre Starters 26"');
      console.log('Các lớp có "starters":', allClasses.docs
        .filter(d => (d.data().name || '').toLowerCase().includes('pre starters'))
        .map(d => `${d.id}: ${d.data().name}`)
      );
      return;
    }
    console.log('Found partial matches:', matches.map(d => `${d.id}: ${d.data().name}`));
    return checkClassSessions(matches[0].id, matches[0].data());
  }

  const classDoc = classSnap.docs[0];
  await checkClassSessions(classDoc.id, classDoc.data());
}

async function checkClassSessions(classId: string, classData: any) {
  console.log('='.repeat(60));
  console.log(`📋 Lớp: ${classData.name}`);
  console.log(`   ID: ${classId}`);
  console.log(`   Lịch học: ${classData.schedule || 'N/A'}`);
  console.log(`   Tổng buổi: ${classData.totalSessions || 'N/A'}`);
  console.log(`   Ngày bắt đầu: ${classData.startDate || 'N/A'}`);
  console.log(`   Ngày kết thúc: ${classData.endDate || 'N/A'}`);
  console.log(`   Trạng thái: ${classData.status || 'N/A'}`);
  console.log('='.repeat(60));

  // 2. Get all sessions
  const sessionsSnap = await db.collection('classSessions')
    .where('classId', '==', classId)
    .get();

  const sessions = sessionsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  console.log(`\n📊 Tổng sessions: ${sessions.length}`);

  // 3. Parse schedule to get expected days
  const schedule = classData.schedule || '';
  const expectedDays = parseScheduleDays(schedule);
  console.log(`📅 Ngày học theo lịch: ${expectedDays.map((d: number) => DAY_NAMES[d]).join(', ')}`);

  // 4. Check each session
  const issues: string[] = [];
  let prevSessionNum = 0;

  console.log('\n--- Chi tiết buổi học ---');
  console.log('Buổi | Ngày       | Thứ         | Status    | Issues');
  console.log('-'.repeat(75));

  for (const session of sessions as any[]) {
    const sessionDate = new Date(session.date + 'T00:00:00');
    const actualDay = sessionDate.getDay();
    const expectedDayName = DAY_NAMES[actualDay];
    const rowIssues: string[] = [];

    // Check sessionNumber sequence
    if (session.sessionNumber !== prevSessionNum + 1) {
      rowIssues.push(`Gap: ${prevSessionNum} → ${session.sessionNumber}`);
      issues.push(`Buổi ${session.sessionNumber}: Gap từ ${prevSessionNum}`);
    }

    // Check if date matches schedule days
    if (!expectedDays.includes(actualDay) && session.status !== 'Nghỉ' && session.status !== 'Học bù' && session.status !== 'Bù') {
      rowIssues.push(`Sai thứ! Ngày ${session.date} là ${expectedDayName}, không nằm trong lịch`);
      issues.push(`Buổi ${session.sessionNumber}: Sai thứ - ${session.date} là ${expectedDayName}`);
    }

    // Check dayOfWeek field matches actual date
    if (session.dayOfWeek && session.dayOfWeek !== expectedDayName) {
      // Also check short format
      const shortFormats: Record<string, string> = {
        'Thứ 2': 'Thứ Hai', 'Thứ 3': 'Thứ Ba', 'Thứ 4': 'Thứ Tư',
        'Thứ 5': 'Thứ Năm', 'Thứ 6': 'Thứ Sáu', 'Thứ 7': 'Thứ Bảy',
      };
      const normalized = shortFormats[session.dayOfWeek] || session.dayOfWeek;
      if (normalized !== expectedDayName) {
        rowIssues.push(`dayOfWeek sai: "${session.dayOfWeek}" vs actual "${expectedDayName}"`);
        issues.push(`Buổi ${session.sessionNumber}: dayOfWeek="${session.dayOfWeek}" vs "${expectedDayName}"`);
      }
    }

    const issueStr = rowIssues.length > 0 ? `⚠️ ${rowIssues.join('; ')}` : '✅';
    const statusPad = (session.status || '').padEnd(10);
    console.log(
      `${String(session.sessionNumber).padStart(4)} | ${session.date} | ${(session.dayOfWeek || '').padEnd(11)} | ${statusPad} | ${issueStr}`
    );

    prevSessionNum = session.sessionNumber;
  }

  // 5. Summary
  console.log('\n' + '='.repeat(60));
  if (issues.length === 0) {
    console.log('✅ Không phát hiện lỗi nào!');
  } else {
    console.log(`⚠️ Phát hiện ${issues.length} vấn đề:`);
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  }

  // Check duplicates
  const dateSet = new Set<string>();
  const dupDates: string[] = [];
  for (const s of sessions as any[]) {
    if (dateSet.has(s.date)) dupDates.push(s.date);
    dateSet.add(s.date);
  }
  if (dupDates.length > 0) {
    console.log(`\n⚠️ Ngày bị trùng: ${dupDates.join(', ')}`);
  }

  // Count by status
  const statusCount: Record<string, number> = {};
  for (const s of sessions as any[]) {
    statusCount[s.status] = (statusCount[s.status] || 0) + 1;
  }
  console.log('\n📊 Phân bố trạng thái:');
  for (const [status, count] of Object.entries(statusCount)) {
    console.log(`  ${status}: ${count}`);
  }
}

function parseScheduleDays(schedule: string): number[] {
  if (!schedule) return [];
  const lower = schedule.toLowerCase();
  const days = new Set<number>();

  const DAY_MAP: Record<string, number> = {
    'chủ nhật': 0, 'cn': 0,
    'thứ hai': 1, 'thứ 2': 1, 't2': 1,
    'thứ ba': 2, 'thứ 3': 2, 't3': 2,
    'thứ tư': 3, 'thứ 4': 3, 't4': 3,
    'thứ năm': 4, 'thứ 5': 4, 't5': 4,
    'thứ sáu': 5, 'thứ 6': 5, 't6': 5,
    'thứ bảy': 6, 'thứ 7': 6, 't7': 6,
  };

  for (const [name, num] of Object.entries(DAY_MAP)) {
    if (lower.includes(name)) days.add(num);
  }

  // Number format: "2, 4, 6"
  const numberMatches = schedule.match(/\b([2-7])\b/g);
  if (numberMatches) {
    numberMatches.forEach(num => {
      const n = parseInt(num);
      if (n >= 2 && n <= 7) days.add(n === 7 ? 6 : n - 1);
    });
  }

  return Array.from(days).sort();
}

checkStarters25().catch(console.error);
