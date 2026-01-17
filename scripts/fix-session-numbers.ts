/**
 * Script to fix classSessions with sessionNumber = 0 or undefined
 * This recalculates sessionNumber based on date order for each class
 *
 * Run: npx tsx scripts/fix-session-numbers.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ service-account.json not found at:', serviceAccountPath);
  console.log('Please download service account key from Firebase Console');
  process.exit(1);
}

initializeApp({
  credential: cert(require(serviceAccountPath))
});

const db = getFirestore();

interface ClassSession {
  id: string;
  classId: string;
  className: string;
  date: string;
  sessionNumber: number;
  status: string;
}

async function fixSessionNumbers() {
  console.log('🔧 Starting session number fix...\n');

  // Get all class sessions
  const sessionsSnap = await db.collection('classSessions').get();
  console.log(`📊 Found ${sessionsSnap.size} total sessions\n`);

  // Group sessions by classId
  const sessionsByClass = new Map<string, ClassSession[]>();

  sessionsSnap.docs.forEach(doc => {
    const data = doc.data();
    const session: ClassSession = {
      id: doc.id,
      classId: data.classId,
      className: data.className || 'Unknown',
      date: data.date || '',
      sessionNumber: data.sessionNumber || 0,
      status: data.status || 'Chưa học'
    };

    const existing = sessionsByClass.get(session.classId) || [];
    existing.push(session);
    sessionsByClass.set(session.classId, existing);
  });

  console.log(`📚 Found ${sessionsByClass.size} classes with sessions\n`);

  let totalFixed = 0;
  let totalClasses = 0;

  for (const [classId, sessions] of sessionsByClass.entries()) {
    // Sort by date
    sessions.sort((a, b) => a.date.localeCompare(b.date));

    const sessionsToFix = sessions.filter(s => !s.sessionNumber || s.sessionNumber === 0);

    if (sessionsToFix.length === 0) continue;

    totalClasses++;
    console.log(`\n📖 Class: ${sessions[0].className} (${classId})`);
    console.log(`   Total sessions: ${sessions.length}, Need fix: ${sessionsToFix.length}`);

    // Recalculate session numbers based on date order
    const batch = db.batch();
    let batchCount = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const correctNumber = i + 1;

      if (session.sessionNumber !== correctNumber) {
        const docRef = db.collection('classSessions').doc(session.id);
        batch.update(docRef, { sessionNumber: correctNumber });
        batchCount++;
        totalFixed++;

        if (session.sessionNumber === 0) {
          console.log(`   ✓ Session ${session.date}: 0 → ${correctNumber}`);
        } else {
          console.log(`   ✓ Session ${session.date}: ${session.sessionNumber} → ${correctNumber}`);
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Fixed ${batchCount} sessions`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Done! Fixed ${totalFixed} sessions across ${totalClasses} classes`);
}

fixSessionNumbers().catch(console.error);
