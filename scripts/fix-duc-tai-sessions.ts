/**
 * Fix Đức Tài's remainingSessions data
 * One-time script to correct stale data after bug fix
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccount = require('../service-account-key.json');
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixDucTaiSessions() {
  const studentId = 'wZzHCHwsWS86VTa2syFd';

  const studentRef = db.collection('students').doc(studentId);
  const studentDoc = await studentRef.get();

  if (!studentDoc.exists) {
    console.error('Student not found');
    return;
  }

  const data = studentDoc.data()!;
  const registered = data.registeredSessions || 0;
  const attended = data.attendedSessions || 0;
  const correctRemaining = registered - attended;

  console.log(`Student: ${data.fullName}`);
  console.log(`Registered: ${registered}`);
  console.log(`Attended: ${attended}`);
  console.log(`Current remainingSessions: ${data.remainingSessions}`);
  console.log(`Correct remainingSessions: ${correctRemaining}`);

  if (data.remainingSessions !== correctRemaining) {
    await studentRef.update({
      remainingSessions: correctRemaining
    });
    console.log(`✅ Updated remainingSessions to ${correctRemaining}`);
  } else {
    console.log('✅ Data already correct');
  }
}

fixDucTaiSessions().catch(console.error);
