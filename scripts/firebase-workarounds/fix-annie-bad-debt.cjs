#!/usr/bin/env node
/**
 * Fix Annie's Bad Debt Data
 * Clears incorrect bad debt for student who has paid settlement invoice
 *
 * Usage: node fix-annie-bad-debt.cjs
 */

const https = require('https');
const { execSync } = require('child_process');

const CONFIG = {
  projectId: 'edumanager-pro-6180f',
  databaseId: '(default)'
};

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

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function main() {
  const studentId = 'QMrL5pXdm0YQahjjTC3W';
  const invoiceCode = 'STL-20251229-217';

  console.log('=== Fix Annie Bad Debt Data ===\n');
  console.log(`Student ID: ${studentId}`);
  console.log(`Invoice Code: ${invoiceCode}\n`);

  // Update student document
  console.log('Updating student document...');

  const updateData = {
    fields: {
      badDebt: { booleanValue: false },
      badDebtSessions: { integerValue: '0' },
      badDebtAmount: { integerValue: '0' },
      badDebtDate: { nullValue: null },
      badDebtNote: { stringValue: `Fixed: Đã có invoice thanh toán ${invoiceCode}` },
    }
  };

  try {
    await firestoreRequest(
      'PATCH',
      `/documents/students/${studentId}?updateMask.fieldPaths=badDebt&updateMask.fieldPaths=badDebtSessions&updateMask.fieldPaths=badDebtAmount&updateMask.fieldPaths=badDebtDate&updateMask.fieldPaths=badDebtNote`,
      updateData
    );

    console.log('✅ Successfully cleared Annie\'s bad debt!\n');
    console.log('Verification:');
    console.log('- Dashboard should NOT show Annie in "Nợ xấu" section');
    console.log('- Student profile should NOT show "Nợ xấu" badge');
    console.log('\nURL: https://edumanager-pro-6180f.web.app');

  } catch (error) {
    console.error('❌ Error updating student:', error.message);
    process.exit(1);
  }
}

main();
