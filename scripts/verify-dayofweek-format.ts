/**
 * Verify dayOfWeek Format Consistency
 * Check if all sessions use same format for dayOfWeek field
 *
 * Usage: npx tsx scripts/verify-dayofweek-format.ts
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
  if (field.timestampValue !== undefined) return field.timestampValue;
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

async function main() {
  console.log('=== VERIFY dayOfWeek FORMAT CONSISTENCY ===\n');

  ACCESS_TOKEN = await getAccessToken();
  console.log('✓ Got access token\n');

  // Fetch all classSessions
  console.log('Fetching classSessions...');
  const allSessions = await queryCollection('classSessions');
  console.log(`Found ${allSessions.length} sessions\n`);

  // Analyze dayOfWeek formats
  const formatCount = new Map<string, number>();
  const samplesByFormat = new Map<string, any[]>();

  // Expected format: "Thứ Hai", "Thứ Ba", etc.
  const EXPECTED_FORMAT = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  for (const session of allSessions) {
    const dayOfWeek = session.dayOfWeek || '';
    let format = 'unknown';

    if (!dayOfWeek) {
      format = 'empty';
    } else if (EXPECTED_FORMAT.includes(dayOfWeek)) {
      format = 'Vietnamese-full'; // "Thứ Hai", "Thứ Ba", etc.
    } else if (/^T\d$/.test(dayOfWeek)) {
      format = 'Vietnamese-short-T2'; // "T2", "T3", etc.
    } else if (/^Thứ \d$/.test(dayOfWeek)) {
      format = 'Vietnamese-num'; // "Thứ 2", "Thứ 3", etc.
    } else if (/^\d$/.test(dayOfWeek)) {
      format = 'number-only'; // "2", "3", etc.
    } else {
      format = `other: ${dayOfWeek}`;
    }

    formatCount.set(format, (formatCount.get(format) || 0) + 1);

    if (!samplesByFormat.has(format)) {
      samplesByFormat.set(format, []);
    }
    if (samplesByFormat.get(format)!.length < 5) {
      samplesByFormat.get(format)!.push({
        className: session.className,
        sessionNumber: session.sessionNumber,
        date: session.date,
        dayOfWeek: dayOfWeek
      });
    }
  }

  console.log('dayOfWeek FORMAT DISTRIBUTION:');
  console.log('='.repeat(70));

  for (const [format, count] of formatCount.entries()) {
    const percentage = ((count / allSessions.length) * 100).toFixed(1);
    console.log(`\n${format}: ${count} sessions (${percentage}%)`);
    console.log('  Samples:');
    for (const sample of samplesByFormat.get(format)!) {
      console.log(`    - ${sample.className} #${sample.sessionNumber}: "${sample.dayOfWeek}" (${sample.date})`);
    }
  }

  console.log('\n' + '='.repeat(70));

  // Check for issues
  const hasEmpty = formatCount.has('empty');
  const formatTypes = [...formatCount.keys()].filter(f => f !== 'empty' && f !== 'Vietnamese-full');

  if (formatTypes.length === 0 && !hasEmpty) {
    console.log('✅ All dayOfWeek values use consistent format (Vietnamese-full)!');
  } else {
    console.log('⚠️ Issues detected:');
    if (hasEmpty) {
      console.log(`   - ${formatCount.get('empty')} sessions have empty dayOfWeek`);
    }
    if (formatTypes.length > 0) {
      console.log(`   - Non-standard formats found: ${formatTypes.join(', ')}`);
    }
  }
}

main().catch(console.error);
