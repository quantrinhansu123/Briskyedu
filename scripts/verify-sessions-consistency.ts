/**
 * Verify Sessions Consistency
 * - Check session order (1→N) for each class
 * - Check duplicate dates
 * - Check session count matches totalSessions
 *
 * Usage: npx tsx scripts/verify-sessions-consistency.ts
 */

import { execSync } from 'child_process';

const PROJECT_ID = 'edumanager-pro-6180f';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getAccessToken(): Promise<string> {
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
  return token;
}

let ACCESS_TOKEN = '';

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

function parseDocument(doc: any): any {
  const id = doc.name.split('/').pop();
  const fields: any = { id };
  for (const [key, value] of Object.entries(doc.fields || {})) {
    fields[key] = extractValue(value);
  }
  return fields;
}

async function queryCollection(collectionPath: string): Promise<any[]> {
  const allDocs: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = `${FIRESTORE_BASE_URL}/${collectionPath}?pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const data = await response.json();
    const docs = (data.documents || []).map(parseDocument);
    allDocs.push(...docs);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allDocs;
}

interface Issue {
  classId: string;
  className: string;
  type: 'order' | 'duplicate' | 'count' | 'gap';
  detail: string;
}

async function main() {
  console.log('=== VERIFY SESSIONS CONSISTENCY ===\n');

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
  const sessionsByClass = new Map<string, any[]>();
  for (const session of allSessions) {
    const classId = session.classId;
    if (!sessionsByClass.has(classId)) {
      sessionsByClass.set(classId, []);
    }
    sessionsByClass.get(classId)!.push(session);
  }

  const issues: Issue[] = [];
  let totalOk = 0;
  let totalIssues = 0;

  console.log('Checking each class...\n');
  console.log('Class Name'.padEnd(25) + ' | Expected | Actual | Order | Duplicates');
  console.log('-'.repeat(80));

  for (const cls of classes) {
    const sessions = sessionsByClass.get(cls.id) || [];
    const expectedCount = cls.totalSessions || 0;
    const actualCount = sessions.length;

    // Sort by sessionNumber
    sessions.sort((a, b) => (a.sessionNumber || 0) - (b.sessionNumber || 0));

    // Check 1: Count matches
    const countMatch = actualCount === expectedCount;

    // Check 2: Session order is sequential (1, 2, 3, ... N)
    let orderOk = true;
    const gaps: number[] = [];
    for (let i = 0; i < sessions.length; i++) {
      const expected = i + 1;
      const actual = sessions[i].sessionNumber;
      if (actual !== expected) {
        orderOk = false;
        gaps.push(expected);
      }
    }

    // Check 3: No duplicate dates
    const dateCount = new Map<string, number>();
    for (const session of sessions) {
      const date = session.date || '';
      dateCount.set(date, (dateCount.get(date) || 0) + 1);
    }
    const duplicateDates = Array.from(dateCount.entries())
      .filter(([_, count]) => count > 1)
      .map(([date, count]) => `${date}(x${count})`);

    const className = (cls.name || 'Unknown').substring(0, 24).padEnd(25);
    const orderStatus = orderOk ? '✓' : '✗';
    const dupStatus = duplicateDates.length === 0 ? '✓' : duplicateDates.length.toString();

    console.log(`${className} | ${expectedCount.toString().padStart(8)} | ${actualCount.toString().padStart(6)} | ${orderStatus.padStart(5)} | ${dupStatus}`);

    // Record issues
    if (!countMatch) {
      issues.push({
        classId: cls.id,
        className: cls.name,
        type: 'count',
        detail: `Expected ${expectedCount}, got ${actualCount}`
      });
      totalIssues++;
    }

    if (!orderOk) {
      issues.push({
        classId: cls.id,
        className: cls.name,
        type: 'order',
        detail: `Missing session numbers: ${gaps.slice(0, 5).join(', ')}${gaps.length > 5 ? '...' : ''}`
      });
      totalIssues++;
    }

    if (duplicateDates.length > 0) {
      issues.push({
        classId: cls.id,
        className: cls.name,
        type: 'duplicate',
        detail: duplicateDates.slice(0, 3).join(', ')
      });
      totalIssues++;
    }

    if (countMatch && orderOk && duplicateDates.length === 0) {
      totalOk++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total classes: ${classes.length}`);
  console.log(`Classes OK: ${totalOk}`);
  console.log(`Classes with issues: ${classes.length - totalOk}`);
  console.log(`Total sessions: ${allSessions.length}`);
  console.log(`Expected sessions: ${classes.reduce((sum, c) => sum + (c.totalSessions || 0), 0)}`);

  if (issues.length > 0) {
    console.log('\nISSUES FOUND:');
    for (const issue of issues) {
      console.log(`  [${issue.type.toUpperCase()}] ${issue.className}: ${issue.detail}`);
    }
  } else {
    console.log('\n✅ All classes have consistent session data!');
  }
}

main().catch(console.error);
