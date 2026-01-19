/**
 * Audit script to compare class session data between Firestore and expected values
 * Uses Firebase REST API for faster execution
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'edumanager-pro-6180f';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Get access token from gcloud CLI
async function getAccessToken(): Promise<string> {
  const { execSync } = await import('child_process');
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
  return token;
}

let ACCESS_TOKEN = '';

interface ClassData {
  id: string;
  code: string;
  name: string;
  totalSessions: number;
  completedSessions: number;
  status: string;
  teacherName?: string;
  schedule?: any;
}

interface ClassSessionData {
  id: string;
  classId: string;
  sessionNumber: number;
  status: string;
  date: string;
}

interface AuditResult {
  classId: string;
  classCode: string;
  className: string;
  status: string;
  totalSessionsInClass: number;
  completedSessionsInClass: number;
  actualSessionsInDB: number;
  actualCompletedInDB: number;
  inconsistencies: string[];
}

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

async function fetchCollection(collectionName: string): Promise<any[]> {
  const url = `${FIRESTORE_BASE_URL}/${collectionName}?pageSize=1000`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    }
  });
  const data = await response.json();

  if (!data.documents) return [];
  return data.documents.map(parseDocument);
}

async function auditClassSessions() {
  console.log('=== CLASS SESSION AUDIT ===\n');
  console.log('Using Firebase REST API...\n');

  // Get access token
  ACCESS_TOKEN = await getAccessToken();
  console.log('Access token obtained.\n');

  // Fetch all classes
  console.log('Fetching classes...');
  const classes: ClassData[] = await fetchCollection('classes');
  console.log(`Found ${classes.length} classes\n`);

  // Fetch all class sessions
  console.log('Fetching class sessions...');
  const allSessions: ClassSessionData[] = await fetchCollection('classSessions');
  console.log(`Found ${allSessions.length} total sessions\n`);

  // Group sessions by classId
  const sessionsByClass = new Map<string, ClassSessionData[]>();
  for (const session of allSessions) {
    const classId = session.classId;
    if (!sessionsByClass.has(classId)) {
      sessionsByClass.set(classId, []);
    }
    sessionsByClass.get(classId)!.push(session);
  }

  const results: AuditResult[] = [];

  // Analyze each class
  for (const cls of classes) {
    const sessions = sessionsByClass.get(cls.id) || [];
    const actualCompleted = sessions.filter(s => s.status === 'Đã học').length;

    const inconsistencies: string[] = [];

    // Check 1: totalSessions vs actual sessions count
    if (cls.totalSessions !== sessions.length) {
      inconsistencies.push(
        `totalSessions (${cls.totalSessions}) != actual sessions (${sessions.length})`
      );
    }

    // Check 2: completedSessions vs actual completed count
    if (cls.completedSessions !== actualCompleted) {
      inconsistencies.push(
        `completedSessions (${cls.completedSessions}) != actual completed (${actualCompleted})`
      );
    }

    // Check 3: Session numbers should be sequential
    const sessionNumbers = sessions.map(s => s.sessionNumber).sort((a, b) => a - b);
    const expectedNumbers = Array.from({ length: sessions.length }, (_, i) => i + 1);
    const hasGaps = sessionNumbers.some((num, idx) => num !== expectedNumbers[idx]);
    if (hasGaps && sessions.length > 0) {
      inconsistencies.push(
        `Session numbers not sequential: [${sessionNumbers.join(',')}]`
      );
    }

    results.push({
      classId: cls.id,
      classCode: cls.code || 'N/A',
      className: cls.name || 'N/A',
      status: cls.status || 'N/A',
      totalSessionsInClass: cls.totalSessions || 0,
      completedSessionsInClass: cls.completedSessions || 0,
      actualSessionsInDB: sessions.length,
      actualCompletedInDB: actualCompleted,
      inconsistencies
    });
  }

  // Sort by class code for easier reading
  results.sort((a, b) => a.classCode.localeCompare(b.classCode));

  // Output results
  console.log('\n=== AUDIT RESULTS ===\n');
  console.log('CODE         | NAME                 | TOTAL | COMPL | ACTUAL | ACT_COMPL | STATUS');
  console.log('-'.repeat(90));

  let issueCount = 0;
  for (const r of results) {
    const hasIssues = r.inconsistencies.length > 0;
    if (hasIssues) issueCount++;

    const name = r.className.substring(0, 20).padEnd(20);
    const code = r.classCode.padEnd(12);
    const icon = hasIssues ? '❌' : '✓';

    console.log(
      `${code} | ${name} | ${String(r.totalSessionsInClass).padStart(5)} | ${String(r.completedSessionsInClass).padStart(5)} | ${String(r.actualSessionsInDB).padStart(6)} | ${String(r.actualCompletedInDB).padStart(9)} | ${icon}`
    );

    if (hasIssues) {
      for (const issue of r.inconsistencies) {
        console.log(`  └─ ${issue}`);
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total classes: ${results.length}`);
  console.log(`Classes with issues: ${issueCount}`);
  console.log(`Classes OK: ${results.length - issueCount}`);

  // Output JSON for further analysis
  const outputDir = 'E:/Github_Repos/edumanager-pro/plans/reports/ui-test-260118-1038-class-data-audit';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'class-audit-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed data saved to: ${outputPath}`);

  return results;
}

auditClassSessions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
