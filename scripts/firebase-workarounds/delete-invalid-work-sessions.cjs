#!/usr/bin/env node
/**
 * Delete Invalid Work Sessions
 *
 * Xóa các work sessions ngày 21/12/2025 (Chủ nhật) - dữ liệu lỗi do timezone bug
 * Các lớp không có lịch học vào Chủ nhật, nhưng do bug timezone nên work sessions
 * được tạo sai ngày.
 *
 * Usage:
 *   node delete-invalid-work-sessions.cjs --dry-run   # Preview only
 *   node delete-invalid-work-sessions.cjs --execute   # Actually delete
 */

const https = require('https');
const { execSync } = require('child_process');

const CONFIG = {
  projectId: 'edumanager-pro-6180f',
  databaseId: '(default)'
};

// Target dates to delete (Sunday sessions that shouldn't exist)
const INVALID_DATES = ['2025-12-21'];

function getAccessToken() {
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Error getting access token. Run: gcloud auth login');
    process.exit(1);
  }
}

async function firestoreRequest(method, path, body = null) {
  const token = getAccessToken();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${CONFIG.projectId}/databases/${CONFIG.databaseId}${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function parseFirestoreValue(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return value.timestampValue;
  return value;
}

async function queryWorkSessions() {
  console.log('Querying workSessions collection...\n');

  const structuredQuery = {
    from: [{ collectionId: 'workSessions' }],
    limit: 500
  };

  const result = await firestoreRequest('POST', '/documents:runQuery', { structuredQuery });

  if (!Array.isArray(result)) return [];

  return result
    .filter(r => r.document)
    .map(r => {
      const fields = r.document.fields || {};
      return {
        id: r.document.name.split('/').pop(),
        fullPath: r.document.name,
        date: parseFirestoreValue(fields.date || {}),
        staffName: parseFirestoreValue(fields.staffName || {}),
        className: parseFirestoreValue(fields.className || {}),
        isFromTKB: parseFirestoreValue(fields.isFromTKB || {}),
        status: parseFirestoreValue(fields.status || {})
      };
    });
}

async function deleteDocument(docPath) {
  const path = docPath.replace(`projects/${CONFIG.projectId}/databases/${CONFIG.databaseId}/documents/`, '/documents/');
  await firestoreRequest('DELETE', path);
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isExecute = args.includes('--execute');

  if (!isDryRun && !isExecute) {
    console.log(`
Delete Invalid Work Sessions
============================
Xóa các work sessions ngày Chủ nhật (21/12/2025) - dữ liệu lỗi timezone

Usage:
  node delete-invalid-work-sessions.cjs --dry-run   # Xem trước, không xóa
  node delete-invalid-work-sessions.cjs --execute   # Thực hiện xóa

Target dates: ${INVALID_DATES.join(', ')}
`);
    return;
  }

  try {
    const allSessions = await queryWorkSessions();
    console.log(`Total sessions found: ${allSessions.length}`);

    // Filter sessions with invalid dates
    const invalidSessions = allSessions.filter(s => INVALID_DATES.includes(s.date));

    console.log(`\nSessions to delete (date in ${INVALID_DATES.join(', ')}): ${invalidSessions.length}\n`);

    if (invalidSessions.length === 0) {
      console.log('No invalid sessions found. Nothing to delete.');
      return;
    }

    // Group by date for summary
    const byDate = {};
    invalidSessions.forEach(s => {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    });

    console.log('Summary:');
    Object.keys(byDate).sort().forEach(date => {
      console.log(`  ${date}: ${byDate[date].length} sessions`);
    });

    console.log('\nDetails:');
    invalidSessions.forEach(s => {
      console.log(`  [${s.date}] ${s.staffName} - ${s.className} (${s.status})`);
    });

    if (isDryRun) {
      console.log('\n[DRY RUN] No changes made. Use --execute to delete.');
      return;
    }

    // Execute deletion
    console.log('\n[EXECUTING] Deleting sessions...\n');
    let deleted = 0;
    let failed = 0;

    for (const session of invalidSessions) {
      try {
        await deleteDocument(session.fullPath);
        console.log(`  ✓ Deleted: ${session.staffName} - ${session.className} (${session.date})`);
        deleted++;
      } catch (err) {
        console.log(`  ✗ Failed: ${session.staffName} - ${session.className}: ${err.message}`);
        failed++;
      }
    }

    console.log(`\n========================================`);
    console.log(`Deleted: ${deleted} | Failed: ${failed}`);
    console.log(`========================================`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
