/**
 * Fix Specific Class Sessions
 * Regenerate sessions for a specific class to sync with current schedule
 *
 * Usage: npx tsx scripts/fix-specific-class-sessions.ts "Cam 4.2"
 *        npx tsx scripts/fix-specific-class-sessions.ts "Cam 4.2" --dry-run
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
} from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============= Schedule Parsing (copied from sessionService.ts) =============

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

function parseScheduleDays(schedule: string): number[] {
  if (!schedule) return [];
  const scheduleLower = schedule.toLowerCase();
  const days: Set<number> = new Set();

  for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
    if (scheduleLower.includes(dayName)) {
      days.add(dayNum);
    }
  }

  const numberMatches = schedule.match(/\b([2-7])\b/g);
  if (numberMatches) {
    numberMatches.forEach(num => {
      const n = parseInt(num);
      if (n >= 2 && n <= 7) {
        days.add(n === 7 ? 6 : n - 1);
      }
    });
  }

  return Array.from(days).sort();
}

function parseScheduleTime(schedule: string): string | null {
  if (!schedule) return null;
  const timeMatch = schedule.match(/(\d{1,2})[h:]?(\d{0,2})?\s*[-–]\s*(\d{1,2})[h:]?(\d{0,2})?/);
  if (timeMatch) {
    const startHour = timeMatch[1].padStart(2, '0');
    const startMin = (timeMatch[2] || '00').padStart(2, '0');
    const endHour = timeMatch[3].padStart(2, '0');
    const endMin = (timeMatch[4] || '00').padStart(2, '0');
    return `${startHour}:${startMin}-${endHour}:${endMin}`;
  }
  return null;
}

interface ClassSession {
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

function generateSessionsForClass(classData: {
  id: string;
  name: string;
  schedule?: string;
  startDate?: string;
  endDate?: string;
  totalSessions?: number;
  room?: string;
  teacherId?: string;
  teacherName?: string;
}): ClassSession[] {
  const { schedule, startDate, endDate, totalSessions } = classData;

  if (!schedule) return [];

  const scheduleDays = parseScheduleDays(schedule);
  if (scheduleDays.length === 0) return [];

  const time = parseScheduleTime(schedule);

  const fromDate = startDate ? new Date(startDate) : new Date();
  const toDate = endDate ? new Date(endDate) : new Date(fromDate.getTime() + 90 * 24 * 60 * 60 * 1000);
  const maxSessions = totalSessions || 50;

  const sessions: ClassSession[] = [];
  const currentDate = new Date(fromDate);
  let sessionNumber = 1;

  while (currentDate <= toDate && sessionNumber <= maxSessions) {
    const dayOfWeek = currentDate.getDay();

    if (scheduleDays.includes(dayOfWeek)) {
      sessions.push({
        classId: classData.id,
        className: classData.name,
        sessionNumber,
        date: currentDate.toISOString().split('T')[0],
        dayOfWeek: DAY_NAMES[dayOfWeek],
        time: time || undefined,
        room: classData.room,
        teacherId: classData.teacherId,
        teacherName: classData.teacherName,
        status: 'Chưa học',
      });
      sessionNumber++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
}

// ============= Main Script =============

const CLASS_NAME = process.argv[2] || 'Cam 4.2';
const DRY_RUN = process.argv.includes('--dry-run');

async function fixClassSessions() {
  console.log('=== Fix Class Sessions Script ===');
  console.log(`Target class: ${CLASS_NAME}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  console.log('');

  // 1. Find the class
  const classesSnap = await getDocs(
    query(collection(db, 'classes'), where('name', '==', CLASS_NAME))
  );

  if (classesSnap.empty) {
    console.error(`Class "${CLASS_NAME}" not found!`);
    process.exit(1);
  }

  const classDoc = classesSnap.docs[0];
  const classData = classDoc.data();
  const classId = classDoc.id;

  console.log('Class found:');
  console.log(`  ID: ${classId}`);
  console.log(`  Name: ${classData.name}`);
  console.log(`  Schedule: ${classData.schedule}`);
  console.log(`  Start: ${classData.startDate}`);
  console.log(`  End: ${classData.endDate}`);
  console.log(`  Total sessions: ${classData.totalSessions || 'N/A'}`);
  console.log('');

  // 2. Parse schedule
  const days = parseScheduleDays(classData.schedule || '');
  const time = parseScheduleTime(classData.schedule || '');
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  console.log('Parsed schedule:');
  console.log(`  Days: ${days.map(d => dayNames[d]).join(', ')} (indices: ${days.join(', ')})`);
  console.log(`  Time: ${time || 'N/A'}`);
  console.log('');

  // 3. Get existing sessions
  const existingSnap = await getDocs(
    query(collection(db, 'classSessions'), where('classId', '==', classId))
  );

  const existingSessions = existingSnap.docs.map(d => ({
    id: d.id,
    ...d.data() as { date: string; dayOfWeek: string; attendanceId?: string; sessionNumber: number },
  }));

  console.log(`Existing sessions: ${existingSessions.length}`);
  existingSessions.slice(0, 5).forEach(s => {
    console.log(`  - Buổi ${s.sessionNumber}: ${s.date} (${s.dayOfWeek})${s.attendanceId ? ' [HAS ATTENDANCE]' : ''}`);
  });
  if (existingSessions.length > 5) {
    console.log(`  ... và ${existingSessions.length - 5} buổi khác`);
  }
  console.log('');

  // 4. Generate expected sessions
  const expectedSessions = await generateSessionsForClass({
    id: classId,
    name: classData.name,
    schedule: classData.schedule,
    startDate: classData.startDate,
    endDate: classData.endDate,
    totalSessions: classData.totalSessions,
    room: classData.room,
    teacherId: classData.teacherId,
    teacherName: classData.teacher,
  });

  console.log(`Expected sessions: ${expectedSessions.length}`);
  expectedSessions.slice(0, 5).forEach(s => {
    console.log(`  - Buổi ${s.sessionNumber}: ${s.date} (${s.dayOfWeek})`);
  });
  if (expectedSessions.length > 5) {
    console.log(`  ... và ${expectedSessions.length - 5} buổi khác`);
  }
  console.log('');

  // 5. Calculate diff
  const existingDates = new Set(existingSessions.map(s => s.date));
  const expectedDates = new Set(expectedSessions.map(s => s.date));

  const toAdd = expectedSessions.filter(s => !existingDates.has(s.date));
  const toRemove = existingSessions.filter(s =>
    !expectedDates.has(s.date) && !s.attendanceId
  );
  const preserved = existingSessions.filter(s =>
    !expectedDates.has(s.date) && s.attendanceId
  );

  console.log('=== DIFF ===');
  console.log(`Sessions to ADD: ${toAdd.length}`);
  toAdd.forEach(s => console.log(`  + ${s.date} (${s.dayOfWeek})`));

  console.log(`Sessions to REMOVE: ${toRemove.length}`);
  toRemove.forEach(s => console.log(`  - ${s.date} (${s.dayOfWeek})`));

  if (preserved.length > 0) {
    console.log(`Sessions PRESERVED (has attendance): ${preserved.length}`);
    preserved.forEach(s => console.log(`  ~ ${s.date} (${s.dayOfWeek})`));
  }
  console.log('');

  // 6. Execute
  if (DRY_RUN) {
    console.log('[DRY RUN] No changes made.');
    return;
  }

  if (toAdd.length === 0 && toRemove.length === 0) {
    console.log('No changes needed. Sessions already synced.');
    return;
  }

  console.log('Executing changes...');
  const batch = writeBatch(db);

  toRemove.forEach(s => {
    batch.delete(doc(db, 'classSessions', s.id));
  });

  // Calculate next session number
  const maxExisting = Math.max(0, ...existingSessions.map(s => s.sessionNumber || 0));
  let nextNum = maxExisting + 1;

  toAdd.forEach(s => {
    const ref = doc(collection(db, 'classSessions'));
    batch.set(ref, {
      ...s,
      sessionNumber: nextNum++,
      createdAt: new Date().toISOString(),
    });
  });

  await batch.commit();

  console.log('');
  console.log('=== DONE ===');
  console.log(`Added: ${toAdd.length} sessions`);
  console.log(`Removed: ${toRemove.length} sessions`);
  console.log(`Preserved: ${preserved.length} sessions (had attendance)`);
}

fixClassSessions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
