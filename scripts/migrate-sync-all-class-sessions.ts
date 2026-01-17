/**
 * Migration Script: Sync All Class Sessions
 *
 * For each class:
 * 1. Parse schedule
 * 2. Generate expected sessions
 * 3. Add missing sessions
 * 4. Remove excess sessions (without attendance)
 * 5. Report discrepancies
 *
 * Usage:
 *   npx tsx scripts/migrate-sync-all-class-sessions.ts --dry-run  # Preview changes
 *   npx tsx scripts/migrate-sync-all-class-sessions.ts            # Execute migration
 */

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Init Firebase Admin SDK
const serviceAccountPath = join(__dirname, '../service-account.json');
try {
  if (existsSync(serviceAccountPath)) {
    const serviceAccountRaw = readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountRaw);
    // Validate required service account fields
    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      throw new Error('Invalid service account: missing project_id or private_key');
    }
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      credential: applicationDefault()
    });
  }
} catch (err) {
  console.error('Failed to initialize Firebase Admin:', err);
  process.exit(1);
}
const db = getFirestore();

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

  // Parse Vietnamese day names
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

  // Fallback: Parse standalone numbers
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

interface MigrationReport {
  classId: string;
  className: string;
  schedule: string;
  existingCount: number;
  expectedCount: number;
  added: number;
  removed: number;
  preserved: number;
  errors: string[];
}

// ============= Helpers =============

function normalizeDate(date: string | { toDate: () => Date } | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return null;
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
const MIGRATION_TIMESTAMP = new Date().toISOString();

async function migrateAllClassSessions() {
  console.log('=== Session Migration Script ===');
  console.log(`Started at: ${MIGRATION_TIMESTAMP}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  console.log('');

  const reports: MigrationReport[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;

  // 1. Fetch all classes
  const classesSnap = await db.collection('classes').get();
  console.log(`Found ${classesSnap.size} classes`);
  console.log('');

  for (const classDoc of classesSnap.docs) {
    const classData = { id: classDoc.id, ...classDoc.data() } as ClassData;

    const report: MigrationReport = {
      classId: classData.id,
      className: classData.name,
      schedule: classData.schedule || 'NO SCHEDULE',
      existingCount: 0,
      expectedCount: 0,
      added: 0,
      removed: 0,
      preserved: 0,
      errors: [],
    };

    try {
      // Skip classes without schedule
      if (!classData.schedule) {
        report.errors.push('No schedule defined');
        reports.push(report);
        continue;
      }

      // 2. Get existing sessions
      const existingSnap = await db.collection('classSessions')
        .where('classId', '==', classData.id)
        .get();

      const existingSessions = existingSnap.docs.map(d => ({
        id: d.id,
        ...d.data() as { date: string; attendanceId?: string; sessionNumber: number },
      }));
      report.existingCount = existingSessions.length;

      // 3. Generate expected sessions
      const expectedSessions = generateSessionsForClass(classData);
      report.expectedCount = expectedSessions.length;

      if (expectedSessions.length === 0) {
        report.errors.push('Could not parse schedule');
        reports.push(report);
        continue;
      }

      // 4. Calculate diff
      const existingDates = new Set(existingSessions.map(s => s.date));
      const expectedDates = new Set(expectedSessions.map(s => s.date));

      const toAdd = expectedSessions.filter(s => !existingDates.has(s.date));
      // SAFETY: Only remove sessions WITHOUT attendanceId to preserve attendance records
      // Sessions with any truthy attendanceId value are preserved
      const toRemove = existingSessions.filter(s =>
        !expectedDates.has(s.date) && !s.attendanceId
      );
      const preserved = existingSessions.filter(s =>
        !expectedDates.has(s.date) && s.attendanceId
      );

      report.added = toAdd.length;
      report.removed = toRemove.length;
      report.preserved = preserved.length;

      // 5. Execute changes
      if (!DRY_RUN && (toAdd.length > 0 || toRemove.length > 0)) {
        const batch = db.batch();

        // Delete excess sessions
        toRemove.forEach(s => {
          batch.delete(db.collection('classSessions').doc(s.id));
        });

        // Add missing sessions
        const maxExisting = Math.max(0, ...existingSessions.map(s => s.sessionNumber || 0));
        let nextNum = maxExisting + 1;

        toAdd.forEach(s => {
          const ref = db.collection('classSessions').doc();
          batch.set(ref, {
            ...s,
            sessionNumber: nextNum++,
            createdAt: MIGRATION_TIMESTAMP,
          });
        });

        await batch.commit();
      }

      totalAdded += toAdd.length;
      totalRemoved += toRemove.length;

      // Log progress
      if (toAdd.length > 0 || toRemove.length > 0) {
        console.log(`[${classData.name}] +${toAdd.length} -${toRemove.length} sessions`);
      }

    } catch (err) {
      report.errors.push(err instanceof Error ? err.message : String(err));
      console.error(`[${classData.name}] Error:`, err);
    }

    reports.push(report);
  }

  // 6. Print summary
  console.log('');
  console.log('=== Migration Summary ===');
  console.log(`Total classes: ${reports.length}`);
  console.log(`Classes with errors: ${reports.filter(r => r.errors.length > 0).length}`);
  console.log(`Classes modified: ${reports.filter(r => r.added > 0 || r.removed > 0).length}`);
  console.log(`Total sessions added: ${totalAdded}`);
  console.log(`Total sessions removed: ${totalRemoved}`);
  console.log('');

  // 7. Save report
  const reportsDir = join(__dirname, '..', 'plans', 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = join(reportsDir, `migration-sessions-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify({
    timestamp: MIGRATION_TIMESTAMP,
    dryRun: DRY_RUN,
    summary: {
      totalClasses: reports.length,
      classesWithErrors: reports.filter(r => r.errors.length > 0).length,
      classesModified: reports.filter(r => r.added > 0 || r.removed > 0).length,
      totalAdded,
      totalRemoved,
    },
    reports,
  }, null, 2));
  console.log(`Report saved to: ${reportPath}`);

  if (DRY_RUN) {
    console.log('');
    console.log('[DRY RUN] No actual changes were made.');
    console.log('Run without --dry-run to execute migration.');
  }
}

// Run
migrateAllClassSessions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
