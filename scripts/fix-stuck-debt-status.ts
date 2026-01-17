/**
 * Script: Fix Stuck Debt Status
 *
 * This script finds and fixes students who have:
 * - status = 'Nợ phí' (Debt)
 * - BUT remainingSessions > 0 (meaning they're not actually in debt)
 *
 * Usage: npx tsx scripts/fix-stuck-debt-status.ts [--dry-run]
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Firebase config from environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

interface StudentData {
  id: string;
  fullName: string;
  code?: string;
  status: string;
  registeredSessions?: number;
  attendedSessions?: number;
  remainingSessions?: number;
  debtSessions?: number;
}

async function findAndFixStuckStudents(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FIX STUCK DEBT STATUS SCRIPT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Mode: ${isDryRun ? '🔍 DRY-RUN (no changes)' : '⚡ LIVE (will update)'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('🔍 Searching for students with stuck "Nợ phí" status...\n');

  // Query students with "Nợ phí" status
  const q = query(collection(db, 'students'), where('status', '==', 'Nợ phí'));
  const snapshot = await getDocs(q);

  console.log(`Found ${snapshot.size} students with "Nợ phí" status\n`);

  const stuckStudents: StudentData[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const registered = data.registeredSessions || 0;
    const attended = data.attendedSessions || 0;
    const remaining = registered - attended;

    // Student is stuck if they have remaining sessions but status is "Nợ phí"
    if (remaining > 0) {
      stuckStudents.push({
        id: docSnap.id,
        fullName: data.fullName || 'Unknown',
        code: data.code,
        status: data.status,
        registeredSessions: registered,
        attendedSessions: attended,
        remainingSessions: remaining,
        debtSessions: data.debtSessions,
      });
    }
  }

  if (stuckStudents.length === 0) {
    console.log('✅ No students with stuck "Nợ phí" status found!');
    return;
  }

  console.log(`Found ${stuckStudents.length} students with STUCK status:\n`);

  for (const student of stuckStudents) {
    console.log(`📋 ${student.fullName} (${student.code || student.id})`);
    console.log(`   Status: ${student.status}`);
    console.log(`   Registered: ${student.registeredSessions} sessions`);
    console.log(`   Attended: ${student.attendedSessions} sessions`);
    console.log(`   Remaining: ${student.remainingSessions} sessions (should be "Đang học")`);
    console.log(`   Debt Sessions (incorrect): ${student.debtSessions || 0}`);

    if (isDryRun) {
      console.log(`   [DRY-RUN] Would update: status → "Đang học", clear debt fields`);
    } else {
      try {
        const studentRef = doc(db, 'students', student.id);
        await updateDoc(studentRef, {
          status: 'Đang học',
          remainingSessions: student.remainingSessions,
          debtSessions: 0,
          debtStartDate: null,
        });
        console.log(`   ✅ Fixed: status → "Đang học", cleared debt fields`);
      } catch (error) {
        console.log(`   ❌ Error: ${error}`);
      }
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  if (isDryRun) {
    console.log(`  ℹ️  DRY-RUN complete. ${stuckStudents.length} students would be fixed.`);
    console.log('  Run without --dry-run to apply changes.');
  } else {
    console.log(`  ✅ Fixed ${stuckStudents.length} students successfully!`);
  }
  console.log('═══════════════════════════════════════════════════════════');
}

findAndFixStuckStudents()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
