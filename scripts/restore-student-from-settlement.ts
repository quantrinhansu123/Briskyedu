/**
 * Script: Restore Student from Accidental Settlement
 *
 * This script reverses a settlement by:
 * 1. Finding and deleting the settlement invoice
 * 2. Restoring student status and class assignment
 *
 * Usage:
 *   npx tsx scripts/restore-student-from-settlement.ts --student-name "Phạm Khánh Ngọc"
 *   npx tsx scripts/restore-student-from-settlement.ts --student-id "abc123"
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin with service account
const serviceAccountPath = path.resolve(__dirname, '../service-account.json');

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error('❌ Không tìm thấy file service-account.json');
  console.error('   Vui lòng download từ Firebase Console:');
  console.error('   https://console.firebase.google.com/project/edumanager-pro-6180f/settings/serviceaccounts/adminsdk');
  console.error('   Sau đó đặt file vào thư mục gốc project với tên: service-account.json');
  process.exit(1);
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
let studentName = '';
let studentId = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--student-name' && args[i + 1]) {
    studentName = args[i + 1];
  }
  if (args[i] === '--student-id' && args[i + 1]) {
    studentId = args[i + 1];
  }
}

async function findStudent(): Promise<admin.firestore.DocumentSnapshot | null> {
  if (studentId) {
    const doc = await db.collection('students').doc(studentId).get();
    return doc.exists ? doc : null;
  }

  if (studentName) {
    // Search by name (partial match)
    const snapshot = await db.collection('students').get();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.fullName?.includes(studentName)) {
        return doc;
      }
    }
  }

  return null;
}

async function findSettlementInvoice(studentId: string): Promise<admin.firestore.DocumentSnapshot | null> {
  const snapshot = await db.collection('settlementInvoices')
    .where('studentId', '==', studentId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0];
}

async function findClassByName(className: string): Promise<string | null> {
  const snapshot = await db.collection('classes')
    .where('name', '==', className)
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].id;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RESTORE STUDENT FROM ACCIDENTAL SETTLEMENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!studentName && !studentId) {
    console.error('❌ Cần cung cấp --student-name hoặc --student-id');
    console.error('   Ví dụ: npx tsx scripts/restore-student-from-settlement.ts --student-name "Khánh Ngọc"');
    process.exit(1);
  }

  // 1. Find student
  console.log('🔍 Tìm học viên...');
  const studentDoc = await findStudent();

  if (!studentDoc) {
    console.error('❌ Không tìm thấy học viên');
    process.exit(1);
  }

  const student = studentDoc.data()!;
  console.log(`✅ Tìm thấy: ${student.fullName} (ID: ${studentDoc.id})`);
  console.log(`   Status hiện tại: ${student.status}`);
  console.log(`   Registered: ${student.registeredSessions || 0}`);
  console.log(`   Attended: ${student.attendedSessions || 0}`);
  console.log(`   ClassId: ${student.classId || 'null'}`);

  // 2. Find settlement invoice
  console.log('\n🔍 Tìm phiếu tất toán...');
  const invoiceDoc = await findSettlementInvoice(studentDoc.id);

  if (invoiceDoc) {
    const invoice = invoiceDoc.data()!;
    console.log(`✅ Tìm thấy invoice: ${invoice.invoiceCode}`);
    console.log(`   Ngày tạo: ${invoice.createdAt}`);
    console.log(`   Lớp: ${invoice.className}`);
    console.log(`   Status: ${invoice.status}`);

    // Delete invoice
    console.log('\n🗑️  Xóa phiếu tất toán...');
    await invoiceDoc.ref.delete();
    console.log('✅ Đã xóa phiếu tất toán');

    // 3. Restore student
    console.log('\n📝 Khôi phục thông tin học viên...');

    // Find class ID from invoice className
    let classId = null;
    if (invoice.className) {
      classId = await findClassByName(invoice.className);
      if (classId) {
        console.log(`   Tìm thấy lớp: ${invoice.className} (ID: ${classId})`);
      }
    }

    // Calculate correct status
    const registered = student.registeredSessions || 0;
    const attended = student.attendedSessions || 0;
    const remaining = registered - attended;

    let newStatus = 'Đang học';
    if (remaining < 0) {
      newStatus = 'Nợ phí';
    } else if (remaining === 0 && registered > 0) {
      newStatus = 'Đã học hết phí';
    }

    const updateData: Record<string, any> = {
      status: newStatus,
      remainingSessions: remaining,
      badDebt: false,
      badDebtSessions: 0,
      badDebtAmount: 0,
      badDebtDate: admin.firestore.FieldValue.delete(),
      badDebtNote: admin.firestore.FieldValue.delete(),
    };

    if (classId) {
      updateData.classId = classId;
      updateData.classIds = [classId];
    }

    if (remaining < 0) {
      updateData.debtSessions = Math.abs(remaining);
      updateData.debtStartDate = new Date().toISOString();
    } else {
      updateData.debtSessions = 0;
      updateData.debtStartDate = admin.firestore.FieldValue.delete();
    }

    await studentDoc.ref.update(updateData);

    console.log('✅ Đã khôi phục học viên:');
    console.log(`   Status: ${newStatus}`);
    console.log(`   Remaining sessions: ${remaining}`);
    if (classId) {
      console.log(`   Class: ${invoice.className}`);
    }

  } else {
    console.log('⚠️  Không tìm thấy phiếu tất toán');
    console.log('   Có thể học viên chưa được tất toán hoặc invoice đã bị xóa');

    // Still offer to fix status
    const registered = student.registeredSessions || 0;
    const attended = student.attendedSessions || 0;
    const remaining = registered - attended;

    if (remaining > 0 && student.status === 'Nợ phí') {
      console.log('\n📝 Phát hiện status không đúng, đang sửa...');

      await studentDoc.ref.update({
        status: 'Đang học',
        remainingSessions: remaining,
        debtSessions: 0,
        debtStartDate: admin.firestore.FieldValue.delete(),
      });

      console.log(`✅ Đã sửa status từ "Nợ phí" → "Đang học" (còn ${remaining} buổi)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ HOÀN TẤT');
  console.log('═══════════════════════════════════════════════════════════');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
