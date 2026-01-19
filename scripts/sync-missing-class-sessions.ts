/**
 * Sync Missing Class Sessions
 * Uses Firebase Auth (email/password) to authenticate before accessing Firestore
 *
 * Usage:
 *   npx tsx scripts/sync-missing-class-sessions.ts --dry-run  # Preview changes
 *   npx tsx scripts/sync-missing-class-sessions.ts             # Execute sync
 *   npx tsx scripts/sync-missing-class-sessions.ts "Cam 4.2"   # Sync specific class
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  Timestamp,
} from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Auth credentials - will be passed via env or args
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sangquang2904@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============= Schedule Parsing =============

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

  // Parse T2, T4, T6 format
  const tMatches = schedule.match(/T([2-7])/gi);
  if (tMatches) {
    tMatches.forEach(match => {
      const n = parseInt(match.substring(1));
      if (n >= 2 && n <= 7) {
        days.add(n === 7 ? 6 : n - 1);
      }
    });
  }

  // Fallback
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

// ============= Types =============

interface ClassData {
  id: string;
  name: string;
  schedule?: string;
  startDate?: string | { toDate: () => Date };
  endDate?: string | { toDate: () => Date };
  totalSessions?: number;
  room?: string;
  teacherId?: string;
  teacher?: string;
  status?: string;
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

// ============= Helpers =============

function normalizeDate(date: string | { toDate: () => Date } | Timestamp | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return null;
  }
  if (date instanceof Timestamp) {
    return date.toDate().toISOString().split('T')[0];
  }
  if (typeof date === 'object' && 'toDate' in date) {
    return date.toDate().toISOString().split('T')[0];
  }
  return null;
}

function generateSessionsForClass(classData: ClassData): ClassSession[] {
  const { schedule } = classData;
  if (!schedule) return [];

  const scheduleDays = parseScheduleDays(schedule);
  if (scheduleDays.length === 0) return [];

  const time = parseScheduleTime(schedule);

  const startDate = normalizeDate(classData.startDate) || new Date().toISOString().split('T')[0];
  const endDate = normalizeDate(classData.endDate);
  const maxSessions = classData.totalSessions || 50;

  const fromDate = new Date(startDate);
  const toDate = endDate
    ? new Date(endDate)
    : new Date(fromDate.getTime() + 365 * 24 * 60 * 60 * 1000);

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
        teacherName: classData.teacher,
        status: 'Chưa học',
      });
      sessionNumber++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
}

// ============= Main Script =============

const DRY_RUN = process.argv.includes('--dry-run');
// Find target class: argument that doesn't start with -- and is not a path/executable
const TARGET_CLASS = process.argv.slice(2).find(arg =>
  !arg.startsWith('--') &&
  !arg.includes('.ts') &&
  !arg.includes('tsx') &&
  !arg.includes('npx') &&
  !arg.includes('node') &&
  !arg.includes(':') && // Skip paths like E:\
  !arg.includes('\\') &&
  !arg.includes('/')
);
const ACTIVE_STATUSES = ['Đang học', 'Đang hoạt động', 'Active', 'active'];

async function syncMissingSessions() {
  console.log('=== Sync Missing Class Sessions ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  if (TARGET_CLASS) {
    console.log(`Target: ${TARGET_CLASS}`);
  }
  console.log('');

  // 1. Authenticate
  console.log('🔐 Authenticating...');
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log(`✅ Logged in as ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error('❌ Authentication failed:', err);
    process.exit(1);
  }
  console.log('');

  // 2. Fetch classes
  console.log('📊 Fetching classes...');
  const classesSnap = await getDocs(collection(db, 'classes'));
  let classes: ClassData[] = classesSnap.docs.map(d => ({
    id: d.id,
    ...d.data() as Omit<ClassData, 'id'>,
  }));

  // Filter by target class if specified
  if (TARGET_CLASS) {
    classes = classes.filter(c => c.name === TARGET_CLASS);
    if (classes.length === 0) {
      console.error(`❌ Class "${TARGET_CLASS}" not found!`);
      process.exit(1);
    }
  } else {
    // Only process active classes
    classes = classes.filter(c => ACTIVE_STATUSES.includes(c.status || ''));
  }

  console.log(`Found ${classes.length} classes to process`);
  console.log('');

  let totalAdded = 0;
  let totalRemoved = 0;
  let classesModified = 0;

  for (const cls of classes) {
    console.log(`\n📚 ${cls.name}`);
    console.log(`   Schedule: ${cls.schedule || 'N/A'}`);

    if (!cls.schedule) {
      console.log('   ⚠️ No schedule - skipped');
      continue;
    }

    // 3. Get existing sessions
    const existingSnap = await getDocs(
      query(collection(db, 'classSessions'), where('classId', '==', cls.id))
    );

    const existingSessions = existingSnap.docs.map(d => ({
      id: d.id,
      ...d.data() as { date: string; attendanceId?: string; sessionNumber: number },
    }));

    console.log(`   Existing sessions: ${existingSessions.length}`);

    // 4. Generate expected sessions
    const expectedSessions = generateSessionsForClass(cls);
    console.log(`   Expected sessions: ${expectedSessions.length}`);

    if (expectedSessions.length === 0) {
      console.log('   ⚠️ Could not parse schedule - skipped');
      continue;
    }

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

    if (toAdd.length === 0 && toRemove.length === 0) {
      console.log('   ✅ Already synced');
      continue;
    }

    console.log(`   → Add: ${toAdd.length}, Remove: ${toRemove.length}, Preserve: ${preserved.length}`);

    // 6. Execute
    if (!DRY_RUN) {
      const batch = writeBatch(db);

      toRemove.forEach(s => {
        batch.delete(doc(db, 'classSessions', s.id));
      });

      // Add new sessions first (without sessionNumber)
      const newSessionRefs: { ref: ReturnType<typeof doc>; session: typeof toAdd[0] }[] = [];
      toAdd.forEach(s => {
        const ref = doc(collection(db, 'classSessions'));
        newSessionRefs.push({ ref, session: s });
      });

      // Merge existing (kept) + new sessions, sort by date, renumber ALL
      const keptSessions = existingSessions.filter(s => !toRemove.some(r => r.id === s.id));
      const allSessionsToNumber = [
        ...keptSessions.map(s => ({ ...s, isNew: false })),
        ...toAdd.map((s, i) => ({ ...s, id: newSessionRefs[i].ref.id, isNew: true }))
      ].sort((a, b) => a.date.localeCompare(b.date));

      // Renumber all sessions by date order
      allSessionsToNumber.forEach((s, index) => {
        const correctNumber = index + 1;
        if (s.isNew) {
          // New session - add to batch
          const refInfo = newSessionRefs.find(r => r.ref.id === s.id);
          if (refInfo) {
            batch.set(refInfo.ref, {
              ...refInfo.session,
              sessionNumber: correctNumber,
              createdAt: new Date().toISOString(),
            });
          }
        } else if (s.sessionNumber !== correctNumber) {
          // Existing session with wrong number - update
          batch.update(doc(db, 'classSessions', s.id), { sessionNumber: correctNumber });
        }
      });

      await batch.commit();
      console.log('   ✅ Synced');
    }

    totalAdded += toAdd.length;
    totalRemoved += toRemove.length;
    classesModified++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   Classes modified: ${classesModified}`);
  console.log(`   Sessions added: ${totalAdded}`);
  console.log(`   Sessions removed: ${totalRemoved}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made. Run without --dry-run to execute.');
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

syncMissingSessions().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
