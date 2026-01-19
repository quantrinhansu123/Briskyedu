/**
 * Backfill Script: Fix Class Sessions Architecture
 * - Fix session numbers (sort by date, reassign 1→N)
 * - Create missing sessions cho mỗi class
 * - Update class.completedSessions count
 * - Generate classCode cho classes chưa có
 *
 * Usage: npx tsx scripts/backfill-class-sessions.ts [--dry-run]
 */

import { execSync } from 'child_process';

const PROJECT_ID = 'edumanager-pro-6180f';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const DRY_RUN = process.argv.includes('--dry-run');

// Get access token from gcloud CLI
async function getAccessToken(): Promise<string> {
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
  return token;
}

let ACCESS_TOKEN = '';

// Helper to extract value from Firestore REST format
function extractValue(field: any): any {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return parseInt(field.integerValue);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.arrayValue !== undefined) {
    return (field.arrayValue.values || []).map(extractValue);
  }
  if (field.mapValue !== undefined) {
    const result: any = {};
    for (const [key, val] of Object.entries(field.mapValue.fields || {})) {
      result[key] = extractValue(val);
    }
    return result;
  }
  return null;
}

// Parse document from REST response
function parseDocument(doc: any): any {
  const id = doc.name.split('/').pop();
  const fields: any = { id };
  for (const [key, value] of Object.entries(doc.fields || {})) {
    fields[key] = extractValue(value);
  }
  return fields;
}

// Query collection
async function queryCollection(collectionPath: string): Promise<any[]> {
  const url = `${FIRESTORE_BASE_URL}/${collectionPath}?pageSize=1000`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  const data = await response.json();
  return (data.documents || []).map(parseDocument);
}

// Update document
async function updateDocument(collectionPath: string, docId: string, fields: Record<string, any>): Promise<void> {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would update ${collectionPath}/${docId}:`, fields);
    return;
  }

  const firestoreFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      firestoreFields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      firestoreFields[key] = { integerValue: String(value) };
    } else if (typeof value === 'boolean') {
      firestoreFields[key] = { booleanValue: value };
    }
  }

  const url = `${FIRESTORE_BASE_URL}/${collectionPath}/${docId}?updateMask.fieldPaths=${Object.keys(fields).join('&updateMask.fieldPaths=')}`;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });
}

// Create document
async function createDocument(collectionPath: string, fields: Record<string, any>): Promise<string> {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would create ${collectionPath}:`, fields);
    return 'dry-run-id';
  }

  const firestoreFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      firestoreFields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      firestoreFields[key] = { integerValue: String(value) };
    } else if (typeof value === 'boolean') {
      firestoreFields[key] = { booleanValue: value };
    }
  }

  const url = `${FIRESTORE_BASE_URL}/${collectionPath}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });
  const data = await response.json();
  return data.name?.split('/').pop() || 'created';
}

// Generate class code
function generateClassCode(className: string, existingCodes: Set<string>): string {
  // Extract prefix from class name
  const name = className.toLowerCase();
  let prefix = '';

  if (name.includes('cambridge') || name.includes('cam')) prefix = 'CAM';
  else if (name.includes('ielts')) prefix = 'IEL';
  else if (name.includes('ket')) prefix = 'KET';
  else if (name.includes('pet')) prefix = 'PET';
  else if (name.includes('starters')) prefix = 'STA';
  else if (name.includes('pre-starters') || name.includes('pre starters')) prefix = 'PST';
  else if (name.includes('kindy')) prefix = 'KIN';
  else if (name.includes('sunny')) prefix = 'SUN';
  else if (name.includes('english')) prefix = 'ENG';
  else if (name.includes('tiếng trung') || name.includes('hsk')) prefix = 'HSK';
  else prefix = className.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');

  // Find next available number
  let num = 1;
  while (existingCodes.has(`${prefix}${String(num).padStart(2, '0')}`)) {
    num++;
  }

  const code = `${prefix}${String(num).padStart(2, '0')}`;
  existingCodes.add(code);
  return code;
}

// Parse Vietnamese day names
const DAY_MAP: Record<string, number> = {
  'chủ nhật': 0, 'cn': 0,
  'thứ 2': 1, 'thứ hai': 1, 't2': 1,
  'thứ 3': 2, 'thứ ba': 2, 't3': 2,
  'thứ 4': 3, 'thứ tư': 3, 't4': 3,
  'thứ 5': 4, 'thứ năm': 4, 't5': 4,
  'thứ 6': 5, 'thứ sáu': 5, 't6': 5,
  'thứ 7': 6, 'thứ bảy': 6, 't7': 6,
};

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

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

async function main() {
  console.log('=== CLASS SESSIONS BACKFILL ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no changes)' : 'LIVE'}\n`);

  ACCESS_TOKEN = await getAccessToken();
  console.log('✓ Got access token\n');

  // 1. Fetch all classes
  console.log('Fetching classes...');
  const classes = await queryCollection('classes');
  console.log(`Found ${classes.length} classes\n`);

  // 2. Fetch all classSessions
  console.log('Fetching classSessions...');
  const allSessions = await queryCollection('classSessions');
  console.log(`Found ${allSessions.length} total sessions\n`);

  // Group sessions by classId
  const sessionsByClass: Map<string, any[]> = new Map();
  for (const session of allSessions) {
    const classId = session.classId;
    if (!sessionsByClass.has(classId)) {
      sessionsByClass.set(classId, []);
    }
    sessionsByClass.get(classId)!.push(session);
  }

  // Track existing class codes
  const existingCodes = new Set<string>();
  for (const cls of classes) {
    if (cls.code) existingCodes.add(cls.code);
  }

  let totalFixed = 0;
  let totalCreated = 0;
  let totalCodeGenerated = 0;

  // 3. Process each class
  for (const cls of classes) {
    console.log(`\n--- ${cls.name} (${cls.id}) ---`);
    const sessions = sessionsByClass.get(cls.id) || [];
    const totalSessions = cls.totalSessions || 0;

    // 3.1 Generate classCode if missing
    if (!cls.code) {
      const newCode = generateClassCode(cls.name, existingCodes);
      console.log(`  Generating classCode: ${newCode}`);
      await updateDocument('classes', cls.id, { code: newCode });
      totalCodeGenerated++;
    }

    // 3.2 Fix session numbers
    if (sessions.length > 0) {
      // Sort by date
      sessions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      let needsFix = false;
      for (let i = 0; i < sessions.length; i++) {
        if (sessions[i].sessionNumber !== i + 1) {
          needsFix = true;
          break;
        }
      }

      if (needsFix) {
        console.log(`  Fixing ${sessions.length} session numbers...`);
        for (let i = 0; i < sessions.length; i++) {
          const session = sessions[i];
          const newNumber = i + 1;
          if (session.sessionNumber !== newNumber) {
            await updateDocument('classSessions', session.id, { sessionNumber: newNumber });
            totalFixed++;
          }
        }
      }
    }

    // 3.3 Create missing sessions
    const existingCount = sessions.length;
    const missingCount = Math.max(0, totalSessions - existingCount);

    if (missingCount > 0) {
      console.log(`  Creating ${missingCount} missing sessions (${existingCount} → ${totalSessions})...`);

      // Get last date or use today
      const lastDate = sessions.length > 0
        ? new Date(sessions[sessions.length - 1].date)
        : new Date();

      const scheduleDays = parseScheduleDays(cls.schedule || '');
      let currentDate = new Date(lastDate);
      let created = 0;

      for (let sessionNum = existingCount + 1; sessionNum <= totalSessions && created < missingCount; sessionNum++) {
        // Find next valid date
        currentDate.setDate(currentDate.getDate() + 1);

        // If schedule defined, find next matching day
        if (scheduleDays.length > 0) {
          while (!scheduleDays.includes(currentDate.getDay())) {
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }

        const dateStr = currentDate.toISOString().split('T')[0];
        await createDocument('classSessions', {
          classId: cls.id,
          className: cls.name,
          sessionNumber: sessionNum,
          date: dateStr,
          dayOfWeek: DAY_NAMES[currentDate.getDay()],
          status: 'Chưa học',
          createdAt: new Date().toISOString(),
        });
        created++;
        totalCreated++;
      }
    }

    // 3.4 Update completedSessions count
    const completedCount = sessions.filter(s => s.status === 'Đã học').length;
    if (cls.completedSessions !== completedCount) {
      console.log(`  Updating completedSessions: ${cls.completedSessions || 0} → ${completedCount}`);
      await updateDocument('classes', cls.id, { completedSessions: completedCount });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Classes processed: ${classes.length}`);
  console.log(`Session numbers fixed: ${totalFixed}`);
  console.log(`Sessions created: ${totalCreated}`);
  console.log(`Class codes generated: ${totalCodeGenerated}`);
  console.log(`\nDone! ${DRY_RUN ? '(DRY-RUN - no actual changes made)' : ''}`);
}

main().catch(console.error);
