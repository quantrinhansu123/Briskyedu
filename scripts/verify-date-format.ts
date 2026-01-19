/**
 * Verify Date Format Consistency
 * Check if all sessions use same date format
 *
 * Usage: npx tsx scripts/verify-date-format.ts
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

function detectDateFormat(date: string): string {
  if (!date) return 'empty';

  // YYYY-MM-DD (ISO format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'YYYY-MM-DD';

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return 'DD/MM/YYYY';

  // MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return 'MM/DD/YYYY';

  // Vietnamese format: "Thứ X, DD/MM/YYYY" or "Thứ X, DD Tháng MM YYYY"
  if (/^Thứ/.test(date)) return 'Vietnamese-weekday';

  // ISO timestamp
  if (/^\d{4}-\d{2}-\d{2}T/.test(date)) return 'ISO-timestamp';

  // Firestore timestamp object
  if (typeof date === 'object') return 'Firestore-timestamp';

  return `unknown: ${date.substring(0, 30)}`;
}

async function main() {
  console.log('=== VERIFY DATE FORMAT CONSISTENCY ===\n');

  ACCESS_TOKEN = await getAccessToken();
  console.log('✓ Got access token\n');

  // Fetch all classSessions
  console.log('Fetching classSessions...');
  const allSessions = await queryCollection('classSessions');
  console.log(`Found ${allSessions.length} sessions\n`);

  // Analyze date formats
  const formatCount = new Map<string, number>();
  const samplesByFormat = new Map<string, string[]>();

  for (const session of allSessions) {
    const date = session.date || '';
    const format = detectDateFormat(date);

    formatCount.set(format, (formatCount.get(format) || 0) + 1);

    if (!samplesByFormat.has(format)) {
      samplesByFormat.set(format, []);
    }
    if (samplesByFormat.get(format)!.length < 5) {
      samplesByFormat.get(format)!.push(date);
    }
  }

  console.log('DATE FORMAT DISTRIBUTION:');
  console.log('='.repeat(60));

  for (const [format, count] of formatCount.entries()) {
    const percentage = ((count / allSessions.length) * 100).toFixed(1);
    console.log(`\n${format}: ${count} sessions (${percentage}%)`);
    console.log(`  Samples: ${samplesByFormat.get(format)?.join(', ')}`);
  }

  console.log('\n' + '='.repeat(60));

  if (formatCount.size === 1) {
    console.log('✅ All dates use consistent format!');
  } else {
    console.log('⚠️ Multiple date formats detected!');
    console.log('Recommendation: Standardize to YYYY-MM-DD (ISO format)');
  }
}

main().catch(console.error);
