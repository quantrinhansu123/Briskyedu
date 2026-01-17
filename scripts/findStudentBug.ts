import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findStudent() {
  console.log('🔍 Searching for student with name containing "Ngọc" or "Bon"...\n');

  const studentsRef = collection(db, 'students');
  const snapshot = await getDocs(studentsRef);

  console.log(`Found ${snapshot.size} total students\n`);

  const matches: any[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (
      data.fullName?.includes('Ngọc') ||
      data.fullName?.includes('Bon') ||
      data.fullName?.includes('Khánh')
    ) {
      matches.push({
        id: doc.id,
        ...data,
      });
    }
  });

  console.log(`Found ${matches.length} matching students:\n`);

  matches.forEach((student) => {
    console.log('━'.repeat(80));
    console.log(`👤 Student: ${student.fullName}`);
    console.log(`   ID: ${student.id}`);
    console.log(`   Code: ${student.studentCode || 'N/A'}`);
    console.log(`   DOB: ${student.dob || 'N/A'}`);
    console.log(`   Status: ${student.status}`);
    console.log(`   Registered Sessions: ${student.registeredSessions || 0}`);
    console.log(`   Attended Sessions: ${student.attendedSessions || 0}`);
    console.log(`   Remaining Sessions: ${student.remainingSessions || 0}`);
    console.log(`   Debt Sessions: ${student.debtSessions || 0}`);
    console.log(`   Has Debt: ${student.hasDebt || false}`);
    console.log(`   Class ID: ${student.classId || 'N/A'}`);
    console.log(`   Class IDs: ${JSON.stringify(student.classIds || [])}`);
    console.log(`   Start Date: ${student.startDate || 'N/A'}`);
    console.log(`   Expected End Date: ${student.expectedEndDate || 'N/A'}`);
    console.log(`   Last Attendance: ${student.lastAttendanceDate || 'N/A'}`);
    console.log();
  });

  // For the specific student, get their contracts
  const targetStudent = matches.find(s =>
    (s.fullName?.includes('Phạm Khánh Ngọc') || s.fullName?.includes('Bon')) &&
    s.dob?.includes('06/08/2013')
  );

  if (targetStudent) {
    console.log('━'.repeat(80));
    console.log('📋 Checking contracts for target student...\n');

    const contractsRef = collection(db, 'contracts');
    const contractQuery = query(contractsRef, where('studentId', '==', targetStudent.id));
    const contractsSnapshot = await getDocs(contractQuery);

    console.log(`Found ${contractsSnapshot.size} contracts:\n`);

    contractsSnapshot.forEach((doc) => {
      const contract = doc.data();
      console.log(`Contract ID: ${doc.id}`);
      console.log(`  Code: ${contract.code || 'N/A'}`);
      console.log(`  Status: ${contract.status}`);
      console.log(`  Category: ${contract.category}`);
      console.log(`  Total Amount: ${contract.totalAmount}`);
      console.log(`  Paid Amount: ${contract.paidAmount}`);
      console.log(`  Items:`, JSON.stringify(contract.items, null, 2));
      console.log();
    });

    // Check enrollment records
    console.log('━'.repeat(80));
    console.log('📚 Checking enrollment records...\n');

    const enrollmentsRef = collection(db, 'enrollments');
    const enrollQuery = query(enrollmentsRef, where('studentId', '==', targetStudent.id));
    const enrollSnapshot = await getDocs(enrollQuery);

    console.log(`Found ${enrollSnapshot.size} enrollment records:\n`);

    enrollSnapshot.forEach((doc) => {
      const enroll = doc.data();
      console.log(`Enrollment ID: ${doc.id}`);
      console.log(`  Type: ${enroll.type}`);
      console.log(`  Sessions: ${enroll.sessions}`);
      console.log(`  Contract Code: ${enroll.contractCode}`);
      console.log(`  Created Date: ${enroll.createdDate}`);
      console.log(`  Note: ${enroll.note || 'N/A'}`);
      console.log();
    });
  }

  process.exit(0);
}

findStudent().catch(console.error);
