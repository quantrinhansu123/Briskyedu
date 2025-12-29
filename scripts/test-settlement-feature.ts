/**
 * Automated Test Script - Settlement Feature
 *
 * Tests Student Debt Settlement functionality using Firebase Admin SDK.
 * Run: npx tsx scripts/test-settlement-feature.ts
 *
 * Uses Admin SDK to bypass Firestore security rules for testing.
 * All test data uses TEST_ prefix and is auto-cleaned after run.
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin (uses default credentials)
let app: App;
if (getApps().length === 0) {
  app = initializeApp({
    projectId: 'edumanager-pro-6180f',
  });
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

const TEST_PREFIX = 'TEST_';
const PRICE_PER_SESSION = 150000;

// ============================================================================
// TYPES
// ============================================================================

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface TestStudent {
  id: string;
  fullName: string;
  code: string;
  status: string;
  registeredSessions: number;
  attendedSessions: number;
  parentName: string;
  classId: string;
  phone?: string;
  dob?: string;
}

interface SettlementInvoice {
  invoiceCode: string;
  invoiceDate: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  parentName: string;
  courseName: string;
  className: string;
  totalSessions: number;
  attendedSessions: number;
  debtSessions: number;
  pricePerSession: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'Đã thanh toán' | 'Nợ xấu';
  createdAt: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(): void {
  console.log('\n' + '═'.repeat(60));
  log('         SETTLEMENT FEATURE - AUTOMATED TEST', 'cyan');
  console.log('═'.repeat(60));
  log('Environment: Production (Admin SDK + TEST_ prefix)', 'dim');
  console.log('═'.repeat(60) + '\n');
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Generate invoice code: STL-YYYYMMDD-XXX
function generateInvoiceCode(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `STL-${dateStr}-${random}`;
}

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

function createTestStudent(overrides: Partial<TestStudent> = {}): TestStudent {
  const id = `${TEST_PREFIX}student_${Date.now()}`;
  return {
    id,
    fullName: 'Test Student',
    code: 'TS001',
    status: 'Đang học',
    registeredSessions: 10,
    attendedSessions: 15, // 5 sessions debt
    parentName: 'Test Parent',
    classId: 'test-class-id',
    phone: '0901234567',
    dob: '2015-01-01',
    ...overrides,
  };
}

function createTestInvoice(
  student: TestStudent,
  status: 'Đã thanh toán' | 'Nợ xấu'
): Omit<SettlementInvoice, 'invoiceCode' | 'createdAt'> {
  const debtSessions = Math.max(0, student.attendedSessions - student.registeredSessions);
  const totalAmount = debtSessions * PRICE_PER_SESSION;

  return {
    invoiceDate: new Date().toISOString(),
    studentId: student.id,
    studentCode: student.code,
    studentName: student.fullName,
    parentName: student.parentName,
    courseName: 'English Course',
    className: 'Test Class',
    totalSessions: student.registeredSessions,
    attendedSessions: student.attendedSessions,
    debtSessions,
    pricePerSession: PRICE_PER_SESSION,
    totalAmount,
    paidAmount: status === 'Đã thanh toán' ? totalAmount : 0,
    remainingAmount: status === 'Đã thanh toán' ? 0 : totalAmount,
    status,
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

async function cleanup(): Promise<void> {
  log('Cleaning up test data...', 'dim');

  // Delete test students
  const studentsSnap = await db.collection('students').get();
  for (const docSnap of studentsSnap.docs) {
    if (docSnap.id.startsWith(TEST_PREFIX)) {
      await docSnap.ref.delete();
    }
  }

  // Delete test invoices
  const invoicesSnap = await db.collection('settlementInvoices').get();
  for (const docSnap of invoicesSnap.docs) {
    const data = docSnap.data();
    if (data.studentId?.startsWith(TEST_PREFIX)) {
      await docSnap.ref.delete();
    }
  }

  log('Cleanup complete', 'dim');
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTest(
  id: string,
  name: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    log(`✓ ${id}: ${name} (${duration}ms)`, 'green');
    return { id, name, passed: true, duration };
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    log(`✗ ${id}: ${name} (${duration}ms)`, 'red');
    log(`  Error: ${error}`, 'red');
    return { id, name, passed: false, error, duration };
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

async function testDebtCalculation(): Promise<void> {
  // TC01: Verify debt calculation
  const student = createTestStudent({
    registeredSessions: 10,
    attendedSessions: 15,
  });

  const debtSessions = student.attendedSessions - student.registeredSessions;
  assert(debtSessions === 5, `Expected debtSessions=5, got ${debtSessions}`);

  const totalAmount = debtSessions * PRICE_PER_SESSION;
  assert(totalAmount === 750000, `Expected totalAmount=750000, got ${totalAmount}`);
}

async function testSettlementPaid(): Promise<void> {
  // TC02: Create invoice with "Đã thanh toán" status
  const student = createTestStudent();

  // Save student to Firestore
  await db.collection('students').doc(student.id).set(student);

  // Create invoice
  const invoiceData = createTestInvoice(student, 'Đã thanh toán');
  const fullInvoice: SettlementInvoice = {
    ...invoiceData,
    invoiceCode: generateInvoiceCode(),
    createdAt: new Date().toISOString(),
  };

  const invoiceRef = await db.collection('settlementInvoices').add(fullInvoice);

  // Verify invoice created
  const savedInvoice = await invoiceRef.get();
  assert(savedInvoice.exists, 'Invoice should exist');

  const data = savedInvoice.data() as SettlementInvoice;
  assert(data.status === 'Đã thanh toán', `Expected status "Đã thanh toán", got "${data.status}"`);
  assert(data.paidAmount === data.totalAmount, 'paidAmount should equal totalAmount');
  assert(data.remainingAmount === 0, 'remainingAmount should be 0');
}

async function testSettlementBadDebt(): Promise<void> {
  // TC03: Create invoice with "Nợ xấu" status
  const student = createTestStudent({
    id: `${TEST_PREFIX}student_baddebt_${Date.now()}`,
  });

  // Save student to Firestore
  await db.collection('students').doc(student.id).set(student);

  // Create invoice
  const invoiceData = createTestInvoice(student, 'Nợ xấu');
  const fullInvoice: SettlementInvoice = {
    ...invoiceData,
    invoiceCode: generateInvoiceCode(),
    createdAt: new Date().toISOString(),
  };

  const invoiceRef = await db.collection('settlementInvoices').add(fullInvoice);

  // Verify invoice created
  const savedInvoice = await invoiceRef.get();
  assert(savedInvoice.exists, 'Invoice should exist');

  const data = savedInvoice.data() as SettlementInvoice;
  assert(data.status === 'Nợ xấu', `Expected status "Nợ xấu", got "${data.status}"`);
  assert(data.paidAmount === 0, 'paidAmount should be 0 for bad debt');
  assert(data.remainingAmount === data.totalAmount, 'remainingAmount should equal totalAmount');
}

async function testDebtBlockingLogic(): Promise<void> {
  // TC04: Verify hasDebt calculation
  const studentWithDebt = createTestStudent({
    registeredSessions: 10,
    attendedSessions: 15,
  });
  const hasDebt1 = studentWithDebt.attendedSessions > studentWithDebt.registeredSessions;
  assert(hasDebt1 === true, 'Student with more attended than registered should have debt');

  const studentNoDebt = createTestStudent({
    registeredSessions: 10,
    attendedSessions: 8,
  });
  const hasDebt2 = studentNoDebt.attendedSessions > studentNoDebt.registeredSessions;
  assert(hasDebt2 === false, 'Student with less attended than registered should not have debt');

  const studentEqual = createTestStudent({
    registeredSessions: 10,
    attendedSessions: 10,
  });
  const hasDebt3 = studentEqual.attendedSessions > studentEqual.registeredSessions;
  assert(hasDebt3 === false, 'Student with equal sessions should not have debt');
}

async function testInvoiceCodeFormat(): Promise<void> {
  // TC05: Verify invoice code format STL-YYYYMMDD-XXX
  const code = generateInvoiceCode();
  const pattern = /^STL-\d{8}-\d{3}$/;
  assert(pattern.test(code), `Invoice code "${code}" does not match pattern STL-YYYYMMDD-XXX`);

  // Verify date part is valid
  const datePart = code.slice(4, 12);
  const year = parseInt(datePart.slice(0, 4));
  const month = parseInt(datePart.slice(4, 6));
  const day = parseInt(datePart.slice(6, 8));

  assert(year >= 2024 && year <= 2030, `Year ${year} out of reasonable range`);
  assert(month >= 1 && month <= 12, `Month ${month} out of range`);
  assert(day >= 1 && day <= 31, `Day ${day} out of range`);
}

// ============================================================================
// REPORTING
// ============================================================================

function generateFailureReport(results: TestResult[]): string {
  const failed = results.filter((r) => !r.passed);
  const timestamp = new Date().toISOString();

  let report = `# Test Failure Report - Settlement Feature

**Date:** ${timestamp}
**Total Tests:** ${results.length}
**Passed:** ${results.filter((r) => r.passed).length}
**Failed:** ${failed.length}

---

`;

  for (const test of failed) {
    report += `## Failed: ${test.id} - ${test.name}

**Error:** ${test.error}
**Duration:** ${test.duration}ms

### Manual UI Test Instructions:

1. Start dev server: \`npm run dev\`
2. Go to: \`/#/finance/debt\`
3. Find student with debt (attendedSessions > registeredSessions)
4. Click "Tất toán"
5. Test the specific scenario that failed

### Debug Info:

- Test ID: ${test.id}
- Error: ${test.error}

---

`;
  }

  report += `## All Test Results

| ID | Name | Status | Duration |
|----|------|--------|----------|
`;

  for (const test of results) {
    const status = test.passed ? '✓ Pass' : '✗ Fail';
    report += `| ${test.id} | ${test.name} | ${status} | ${test.duration}ms |\n`;
  }

  return report;
}

function printSummary(results: TestResult[], totalTime: number): void {
  console.log('\n' + '═'.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  if (passed === total) {
    log(`RESULT: ${passed}/${total} tests passed ✓`, 'green');
  } else {
    log(`RESULT: ${passed}/${total} tests passed ✗`, 'red');
  }

  log(`Total time: ${totalTime}ms`, 'dim');
  console.log('═'.repeat(60) + '\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  logHeader();

  log('Using Firebase Admin SDK with TEST_ prefix isolation', 'cyan');
  log('All test data will be auto-cleaned after run', 'dim');

  // Cleanup before tests
  await cleanup();

  log('\nRunning tests...\n', 'cyan');

  const startTime = Date.now();
  const results: TestResult[] = [];

  // Run all test cases
  results.push(await runTest('TC01', 'Debt Calculation', () => testDebtCalculation()));
  results.push(await runTest('TC02', 'Settlement - Paid', () => testSettlementPaid()));
  results.push(await runTest('TC03', 'Settlement - Bad Debt', () => testSettlementBadDebt()));
  results.push(await runTest('TC04', 'Debt Blocking Logic', () => testDebtBlockingLogic()));
  results.push(await runTest('TC05', 'Invoice Code Format', () => testInvoiceCodeFormat()));

  const totalTime = Date.now() - startTime;

  // Print summary
  printSummary(results, totalTime);

  // Generate failure report if needed
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    const report = generateFailureReport(results);
    const reportPath = path.join(
      process.cwd(),
      'plans',
      'reports',
      `test-failure-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-settlement.md`
    );

    // Ensure directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, report);
    log(`\nFailure report generated: ${reportPath}`, 'yellow');
    log('Please test manually using UI instructions in the report.', 'yellow');
  }

  // Cleanup after tests
  await cleanup();

  // Exit with appropriate code
  process.exit(failed.length > 0 ? 1 : 0);
}

// Run
main().catch((err) => {
  log(`\nFatal error: ${err.message}`, 'red');
  process.exit(1);
});
