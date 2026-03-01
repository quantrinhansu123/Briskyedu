/**
 * Check ALL classes for session ordering issues
 * Detects: gaps, wrong dayOfWeek, dates not matching schedule
 *
 * Usage: npx tsx scripts/check-all-class-sessions.ts
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
  const numberMatches = schedule.match(/\b([2-7])\b/g);
  if (numberMatches) {
    numberMatches.forEach(num => {
      const n = parseInt(num);
      if (n >= 2 && n <= 7) days.add(n === 7 ? 6 : n - 1);
    });
  }
  return Array.from(days).sort();
}

async function checkAllClasses() {
  // Get all classes
  const classesSnap = await db.collection('classes').get();
  console.log(`📋 Tổng lớp: ${classesSnap.size}\n`);

  // Get ALL sessions in one query (more efficient)
  const sessionsSnap = await db.collection('classSessions').get();
  const sessionsByClass = new Map<string, any[]>();
  sessionsSnap.docs.forEach(d => {
    const data = { id: d.id, ...d.data() };
    const classId = (data as any).classId;
    if (!sessionsByClass.has(classId)) sessionsByClass.set(classId, []);
    sessionsByClass.get(classId)!.push(data);
  });

  const problemClasses: { name: string; id: string; issues: string[] }[] = [];
  const cleanClasses: string[] = [];

  for (const classDoc of classesSnap.docs) {
    const classData = classDoc.data();
    const classId = classDoc.id;
    const sessions = (sessionsByClass.get(classId) || [])
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    if (sessions.length === 0) continue;

    const issues: string[] = [];
    const expectedDays = parseScheduleDays(classData.schedule || '');
    let prevNum = 0;

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i] as any;
      const correctNum = i + 1;
      const sessionDate = new Date(s.date + 'T00:00:00');
      const actualDay = sessionDate.getDay();
      const correctDayName = DAY_NAMES[actualDay];

      // Check sequence
      if (s.sessionNumber !== correctNum) {
        issues.push(`#${s.sessionNumber} should be #${correctNum} (${s.date})`);
      }

      // Check dayOfWeek format
      if (s.dayOfWeek && s.dayOfWeek !== correctDayName) {
        const shortMap: Record<string, string> = {
          'Thứ 2': 'Thứ Hai', 'Thứ 3': 'Thứ Ba', 'Thứ 4': 'Thứ Tư',
          'Thứ 5': 'Thứ Năm', 'Thứ 6': 'Thứ Sáu', 'Thứ 7': 'Thứ Bảy',
        };
        if ((shortMap[s.dayOfWeek] || s.dayOfWeek) !== correctDayName) {
          issues.push(`dayOfWeek "${s.dayOfWeek}" != "${correctDayName}" (${s.date})`);
        }
      }
    }

    if (issues.length > 0) {
      problemClasses.push({ name: classData.name, id: classId, issues });
    } else {
      cleanClasses.push(classData.name);
    }
  }

  // Report
  console.log('='.repeat(60));
  if (problemClasses.length === 0) {
    console.log('✅ TẤT CẢ các lớp đều OK!');
  } else {
    console.log(`⚠️ ${problemClasses.length} lớp có vấn đề:\n`);
    for (const cls of problemClasses) {
      console.log(`❌ ${cls.name} (${cls.id}) - ${cls.issues.length} issues:`);
      // Show first 5 issues max
      cls.issues.slice(0, 5).forEach(i => console.log(`   ${i}`));
      if (cls.issues.length > 5) console.log(`   ... và ${cls.issues.length - 5} issues nữa`);
      console.log('');
    }
  }
  console.log(`✅ ${cleanClasses.length} lớp OK: ${cleanClasses.join(', ')}`);
}

checkAllClasses().catch(console.error);
