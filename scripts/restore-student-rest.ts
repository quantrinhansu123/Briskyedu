/**
 * Script: Restore Student using Firestore REST API
 * Uses gcloud access token - no service account needed
 */

import { execSync } from 'child_process';

const PROJECT_ID = 'edumanager-pro-6180f';
const DATABASE = '(default)';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents`;

// Get access token from gcloud
function getAccessToken(): string {
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
  return token;
}

async function firestoreQuery(collectionPath: string, fieldPath: string, op: string, value: string) {
  const token = getAccessToken();

  const body = {
    structuredQuery: {
      from: [{ collectionId: collectionPath }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op,
          value: { stringValue: value }
        }
      },
      limit: 50
    }
  };

  const response = await fetch(`${BASE_URL}:runQuery`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Query failed: ${error}`);
  }

  return response.json();
}

async function firestoreUpdate(documentPath: string, fields: Record<string, any>) {
  const token = getAccessToken();

  // Convert fields to Firestore format
  const firestoreFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) {
      firestoreFields[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      firestoreFields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      firestoreFields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      firestoreFields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      firestoreFields[key] = {
        arrayValue: {
          values: value.map(v => ({ stringValue: v }))
        }
      };
    }
  }

  const fieldPaths = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join('&');
  const url = `${BASE_URL}/${documentPath}?${fieldPaths}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: firestoreFields })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Update failed: ${error}`);
  }

  return response.json();
}

async function firestoreDelete(documentPath: string) {
  const token = getAccessToken();

  const response = await fetch(`${BASE_URL}/${documentPath}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Delete failed: ${error}`);
  }

  return true;
}

function parseFirestoreValue(value: any): any {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue !== undefined) {
    return value.arrayValue.values?.map(parseFirestoreValue) || [];
  }
  return value;
}

function parseDocument(doc: any) {
  const name = doc.document?.name || doc.name;
  const id = name?.split('/').pop();
  const fields = doc.document?.fields || doc.fields || {};

  const data: Record<string, any> = { id };
  for (const [key, value] of Object.entries(fields)) {
    data[key] = parseFirestoreValue(value);
  }
  return data;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RESTORE STUDENT - REST API');
  console.log('═══════════════════════════════════════════════════════════\n');

  const searchName = process.argv[2] || 'Khánh Ngọc';
  console.log(`🔍 Tìm học viên với tên chứa: "${searchName}"...\n`);

  // 1. Query students with "Nợ phí" status
  console.log('📋 Tìm học viên có status "Nợ phí"...');
  const debtStudents = await firestoreQuery('students', 'status', 'EQUAL', 'Nợ phí');

  // Filter by name
  const matchingStudents = debtStudents
    .filter((r: any) => r.document)
    .map(parseDocument)
    .filter((s: any) => s.fullName?.includes(searchName));

  if (matchingStudents.length === 0) {
    console.log('⚠️  Không tìm thấy học viên có status "Nợ phí" với tên này.');

    // Try all students with this name
    console.log('\n📋 Tìm tất cả học viên...');
    const allStudentsResult = await firestoreQuery('students', 'status', 'NOT_EQUAL', '');
    const allMatching = allStudentsResult
      .filter((r: any) => r.document)
      .map(parseDocument)
      .filter((s: any) => s.fullName?.includes(searchName));

    if (allMatching.length > 0) {
      console.log(`\nTìm thấy ${allMatching.length} học viên:`);
      allMatching.forEach((s: any) => {
        console.log(`  - ${s.fullName} (ID: ${s.id})`);
        console.log(`    Status: ${s.status}`);
        console.log(`    Registered: ${s.registeredSessions || 0}, Attended: ${s.attendedSessions || 0}`);
      });
    }
    return;
  }

  console.log(`✅ Tìm thấy ${matchingStudents.length} học viên:\n`);

  for (const student of matchingStudents) {
    console.log(`📋 ${student.fullName} (ID: ${student.id})`);
    console.log(`   Status: ${student.status}`);
    console.log(`   Registered: ${student.registeredSessions || 0}`);
    console.log(`   Attended: ${student.attendedSessions || 0}`);
    console.log(`   ClassId: ${student.classId || 'null'}`);

    const remaining = (student.registeredSessions || 0) - (student.attendedSessions || 0);

    // 2. Find settlement invoice
    console.log('\n🔍 Tìm phiếu tất toán...');
    const invoices = await firestoreQuery('settlementInvoices', 'studentId', 'EQUAL', student.id);
    const parsedInvoices = invoices
      .filter((r: any) => r.document)
      .map(parseDocument);

    if (parsedInvoices.length > 0) {
      const invoice = parsedInvoices[0];
      console.log(`✅ Tìm thấy invoice: ${invoice.invoiceCode}`);
      console.log(`   Ngày tạo: ${invoice.createdAt}`);
      console.log(`   Lớp: ${invoice.className}`);

      // Delete invoice
      console.log('\n🗑️  Xóa phiếu tất toán...');
      const invoicePath = `settlementInvoices/${invoice.id}`;
      await firestoreDelete(invoicePath);
      console.log('✅ Đã xóa phiếu tất toán');
    } else {
      console.log('⚠️  Không tìm thấy phiếu tất toán');
    }

    // 3. Restore student status
    if (remaining > 0) {
      console.log('\n📝 Khôi phục status học viên...');
      const studentPath = `students/${student.id}`;
      await firestoreUpdate(studentPath, {
        status: 'Đang học',
        remainingSessions: remaining,
        debtSessions: 0,
        debtStartDate: null,
        badDebt: false,
        badDebtSessions: 0,
        badDebtAmount: 0,
        badDebtDate: null,
        badDebtNote: null
      });
      console.log(`✅ Đã khôi phục: status → "Đang học" (còn ${remaining} buổi)`);
    } else if (remaining < 0) {
      console.log('\n📝 Khôi phục status học viên (vẫn nợ)...');
      const studentPath = `students/${student.id}`;
      await firestoreUpdate(studentPath, {
        status: 'Nợ phí',
        remainingSessions: remaining,
        debtSessions: Math.abs(remaining),
        badDebt: false,
        badDebtSessions: 0,
        badDebtAmount: 0,
        badDebtDate: null,
        badDebtNote: null
      });
      console.log(`✅ Đã khôi phục: status → "Nợ phí" (nợ ${Math.abs(remaining)} buổi)`);
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ HOÀN TẤT');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
