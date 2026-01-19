/**
 * Sync Missing Class Sessions via Firestore REST API
 * Uses gcloud access token for authentication
 *
 * Usage:
 *   npx tsx scripts/sync-sessions-rest-api.ts --dry-run  # Preview
 *   npx tsx scripts/sync-sessions-rest-api.ts            # Execute
 *   npx tsx scripts/sync-sessions-rest-api.ts "Cam 4.2"  # Specific class
 */

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'edumanager-pro-6180f';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Get gcloud access token
function getAccessToken(): string {
  // First try environment variable
  if (process.env.GCLOUD_ACCESS_TOKEN) {
    return process.env.GCLOUD_ACCESS_TOKEN;
  }

  // Then try gcloud CLI
  try {
    return execSync('gcloud auth print-access-token', {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    console.error('Failed to get gcloud access token.');
    console.error('Either set GCLOUD_ACCESS_TOKEN env var or run: gcloud auth login');
    process.exit(1);
  }
}

const ACCESS_TOKEN = getAccessToken();

// ============= REST API Helpers =============

async function firestoreGet(path: string): Promise<any> {
  const url = `${BASE_URL}/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} - ${err}`);
  }
  return res.json();
}

async function firestoreList(collectionPath: string, pageSize = 100): Promise<any[]> {
  const docs: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${BASE_URL}/${collectionPath}`);
    url.searchParams.set('pageSize', String(pageSize));
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LIST ${collectionPath} failed: ${res.status} - ${err}`);
    }
    const data = await res.json();
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return docs;
}

async function firestoreQuery(collectionPath: string, filters: any[]): Promise<any[]> {
  const url = `${BASE_URL}:runQuery`;

  const structuredQuery: any = {
    from: [{ collectionId: collectionPath }],
  };

  if (filters.length > 0) {
    structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters: filters.map(f => ({
          fieldFilter: {
            field: { fieldPath: f.field },
            op: f.op,
            value: f.value,
          },
        })),
      },
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QUERY ${collectionPath} failed: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.filter((d: any) => d.document).map((d: any) => d.document);
}

async function firestoreBatchWrite(writes: any[]): Promise<void> {
  const url = `${BASE_URL.replace('/documents', '')}:batchWrite`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`BATCH_WRITE failed: ${res.status} - ${err}`);
  }
}

// ============= Document Parsing =============

function parseFirestoreValue(value: any): any {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if (value.mapValue !== undefined) {
    const obj: any = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      obj[k] = parseFirestoreValue(v);
    }
    return obj;
  }
  return value;
}

function parseDocument(doc: any): any {
  const id = doc.name.split('/').pop();
  const fields = doc.fields || {};
  const data: any = { id };
  for (const [k, v] of Object.entries(fields)) {
    data[k] = parseFirestoreValue(v as any);
  }
  return data;
}

function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    const fields: any = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

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

  const tMatches = schedule.match(/T([2-7])/gi);
  if (tMatches) {
    tMatches.forEach(match => {
      const n = parseInt(match.substring(1));
      if (n >= 2 && n <= 7) {
        days.add(n === 7 ? 6 : n - 1);
      }
    });
  }

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

// ============= Session Generation =============

interface ClassData {
  id: string;
  name: string;
  schedule?: string;
  startDate?: string;
  endDate?: string;
  totalSessions?: number;
  room?: string;
  teacherId?: string;
  teacher?: string;
  status?: string;
}

function generateSessionsForClass(cls: ClassData, holidays: Set<string>): any[] {
  const { schedule } = cls;
  if (!schedule) return [];

  const scheduleDays = parseScheduleDays(schedule);
  if (scheduleDays.length === 0) return [];

  const time = parseScheduleTime(schedule);

  const startDate = cls.startDate || new Date().toISOString().split('T')[0];
  const endDate = cls.endDate;
  const maxSessions = cls.totalSessions || 50;

  const fromDate = new Date(startDate);
  const toDate = endDate
    ? new Date(endDate)
    : new Date(fromDate.getTime() + 365 * 24 * 60 * 60 * 1000);

  const sessions: any[] = [];
  const currentDate = new Date(fromDate);
  let sessionNumber = 1;

  while (currentDate <= toDate && sessionNumber <= maxSessions) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = currentDate.toISOString().split('T')[0];

    // Skip holidays
    if (scheduleDays.includes(dayOfWeek) && !holidays.has(dateStr)) {
      sessions.push({
        classId: cls.id,
        className: cls.name,
        sessionNumber,
        date: dateStr,
        dayOfWeek: DAY_NAMES[dayOfWeek],
        time: time || null,
        room: cls.room || null,
        teacherId: cls.teacherId || null,
        teacherName: cls.teacher || null,
        status: 'Chưa học',
        createdAt: new Date().toISOString(),
      });
      sessionNumber++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
}

// ============= Main Script =============

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_CLASS = process.argv.slice(2).find(arg =>
  !arg.startsWith('--') &&
  !arg.includes('.ts') &&
  !arg.includes('tsx') &&
  !arg.includes('npx') &&
  !arg.includes('node') &&
  !arg.includes(':') &&
  !arg.includes('\\') &&
  !arg.includes('/')
);
const ACTIVE_STATUSES = ['Đang học', 'Đang hoạt động', 'Active', 'active'];

// Global holidays cache
let holidayDates: Set<string> | null = null;

async function loadHolidays(): Promise<Set<string>> {
  if (holidayDates) return holidayDates;

  console.log('📅 Loading holidays...');
  const holidayDocs = await firestoreList('holidays');
  holidayDates = new Set<string>();

  for (const doc of holidayDocs) {
    const data = parseDocument(doc);
    // Handle both single date and date range
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        holidayDates.add(d.toISOString().split('T')[0]);
      }
    } else if (data.date) {
      holidayDates.add(data.date);
    }
  }

  console.log(`   Found ${holidayDates.size} holiday dates`);
  return holidayDates;
}

// ============= Backfill Attendance Links =============

async function backfillAttendanceLinks(dryRun: boolean): Promise<{ updated: number }> {
  console.log('\n📎 Backfilling attendance links...');

  // Get all sessions with status='Chưa học'
  const sessionDocs = await firestoreQuery('classSessions', [
    { field: 'status', op: 'EQUAL', value: { stringValue: 'Chưa học' } },
  ]);
  const sessions = sessionDocs.map(parseDocument);
  console.log(`   Found ${sessions.length} incomplete sessions`);

  // Get all attendance records
  const attendanceDocs = await firestoreList('attendance');
  const attendanceRecords = attendanceDocs.map(parseDocument);
  console.log(`   Found ${attendanceRecords.length} attendance records`);

  // Build lookup by classId + date
  const attendanceByClassDate = new Map<string, any>();
  for (const att of attendanceRecords) {
    if (att.classId && att.date) {
      const key = `${att.classId}_${att.date}`;
      attendanceByClassDate.set(key, att);
    }
  }

  // Find sessions that have matching attendance but aren't linked
  const toUpdate: Array<{ session: any; attendance: any }> = [];
  for (const session of sessions) {
    if (session.attendanceId) continue; // Already linked
    const key = `${session.classId}_${session.date}`;
    const attendance = attendanceByClassDate.get(key);
    if (attendance) {
      toUpdate.push({ session, attendance });
    }
  }

  console.log(`   Sessions to link: ${toUpdate.length}`);

  if (toUpdate.length === 0) {
    return { updated: 0 };
  }

  if (!dryRun) {
    const writes: any[] = [];
    for (const { session, attendance } of toUpdate) {
      writes.push({
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/classSessions/${session.id}`,
          fields: {
            ...Object.fromEntries(
              Object.entries(session)
                .filter(([k]) => k !== 'id')
                .map(([k, v]) => [k, toFirestoreValue(v)])
            ),
            attendanceId: { stringValue: attendance.id },
            status: { stringValue: 'Đã học' },
          },
        },
      });
    }

    for (let i = 0; i < writes.length; i += 500) {
      await firestoreBatchWrite(writes.slice(i, i + 500));
    }
    console.log(`   ✅ Linked ${toUpdate.length} sessions to attendance records`);
  }

  return { updated: toUpdate.length };
}

async function syncMissingSessions() {
  console.log('=== Sync Missing Sessions (REST API) ===');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  if (TARGET_CLASS) {
    console.log(`Target: ${TARGET_CLASS}`);
  }
  console.log('');

  // Load holidays first
  const holidays = await loadHolidays();
  console.log('');

  // 1. Fetch classes
  console.log('📊 Fetching classes...');
  const classDocs = await firestoreList('classes');
  let classes: ClassData[] = classDocs.map(parseDocument);

  if (TARGET_CLASS) {
    classes = classes.filter(c => c.name === TARGET_CLASS);
    if (classes.length === 0) {
      console.error(`❌ Class "${TARGET_CLASS}" not found!`);
      process.exit(1);
    }
  } else {
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

    // 2. Get existing sessions
    const existingDocs = await firestoreQuery('classSessions', [
      { field: 'classId', op: 'EQUAL', value: { stringValue: cls.id } },
    ]);

    const existingSessions = existingDocs.map(parseDocument);
    console.log(`   Existing sessions: ${existingSessions.length}`);

    // 3. Generate expected sessions (with holiday exclusion)
    const expectedSessions = generateSessionsForClass(cls, holidays);
    console.log(`   Expected sessions: ${expectedSessions.length}`);

    if (expectedSessions.length === 0) {
      console.log('   ⚠️ Could not parse schedule - skipped');
      continue;
    }

    // 4. Calculate diff
    const existingDates = new Set(existingSessions.map((s: any) => s.date));
    const expectedDates = new Set(expectedSessions.map(s => s.date));

    const toAdd = expectedSessions.filter(s => !existingDates.has(s.date));
    const toRemove = existingSessions.filter((s: any) =>
      !expectedDates.has(s.date) && !s.attendanceId
    );

    if (toAdd.length === 0 && toRemove.length === 0) {
      console.log('   ✅ Already synced');
      continue;
    }

    console.log(`   → Add: ${toAdd.length}, Remove: ${toRemove.length}`);

    // 5. Execute
    if (!DRY_RUN) {
      const writes: any[] = [];

      // Deletes
      for (const s of toRemove) {
        writes.push({
          delete: `projects/${PROJECT_ID}/databases/(default)/documents/classSessions/${s.id}`,
        });
      }

      // Creates
      const maxExisting = Math.max(0, ...existingSessions.map((s: any) => s.sessionNumber || 0));
      let nextNum = maxExisting + 1;

      for (const s of toAdd) {
        const docId = `${cls.id}_${s.date}`;
        const fields: any = {};
        for (const [k, v] of Object.entries({ ...s, sessionNumber: nextNum++ })) {
          fields[k] = toFirestoreValue(v);
        }
        writes.push({
          update: {
            name: `projects/${PROJECT_ID}/databases/(default)/documents/classSessions/${docId}`,
            fields,
          },
        });
      }

      // Batch write (max 500 per batch)
      for (let i = 0; i < writes.length; i += 500) {
        await firestoreBatchWrite(writes.slice(i, i + 500));
      }

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

  // Backfill attendance links
  const backfillResult = await backfillAttendanceLinks(DRY_RUN);
  console.log(`   Sessions linked to attendance: ${backfillResult.updated}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made.');
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

syncMissingSessions().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
