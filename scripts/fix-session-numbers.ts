/**
 * Script to fix classSessions with incorrect sessionNumber
 * This recalculates sessionNumber based on date order for each class
 * Also standardizes dayOfWeek format to "Thứ Hai", "Thứ Ba", etc.
 *
 * Run: npx tsx scripts/fix-session-numbers.ts
 * Dry run: npx tsx scripts/fix-session-numbers.ts --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

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

const DRY_RUN = process.argv.includes('--dry-run');

// Standardized day names (matching toLocaleDateString 'vi-VN' output)
const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

interface ClassSession {
  id: string;
  classId: string;
  className: string;
  date: string;
  sessionNumber: number;
  dayOfWeek: string;
  status: string;
}

async function fixSessionNumbers() {
  console.log('🔧 Starting session number and dayOfWeek fix...');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

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
      dayOfWeek: data.dayOfWeek || '',
      status: data.status || 'Chưa học'
    };

    const existing = sessionsByClass.get(session.classId) || [];
    existing.push(session);
    sessionsByClass.set(session.classId, existing);
  });

  console.log(`📚 Found ${sessionsByClass.size} classes with sessions\n`);

  let totalFixed = 0;
  let totalDayOfWeekFixed = 0;
  let totalClasses = 0;

  for (const [classId, sessions] of sessionsByClass.entries()) {
    // Sort by date
    sessions.sort((a, b) => a.date.localeCompare(b.date));

    // Check which sessions need fixing (number OR dayOfWeek)
    const needsFix = sessions.some((s, i) => {
      const correctNumber = i + 1;
      const correctDayOfWeek = s.date ? DAY_NAMES[new Date(s.date).getDay()] : '';
      return s.sessionNumber !== correctNumber || s.dayOfWeek !== correctDayOfWeek;
    });

    if (!needsFix) continue;

    totalClasses++;
    console.log(`\n📖 Class: ${sessions[0].className} (${classId})`);
    console.log(`   Total sessions: ${sessions.length}`);

    // Recalculate session numbers and dayOfWeek based on date order
    const batch = db.batch();
    let batchCount = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const correctNumber = i + 1;
      const correctDayOfWeek = session.date ? DAY_NAMES[new Date(session.date).getDay()] : '';

      const updates: { sessionNumber?: number; dayOfWeek?: string } = {};

      if (session.sessionNumber !== correctNumber) {
        updates.sessionNumber = correctNumber;
        totalFixed++;
        console.log(`   ✓ ${session.date}: #${session.sessionNumber} → #${correctNumber}`);
      }

      if (session.dayOfWeek !== correctDayOfWeek && correctDayOfWeek) {
        updates.dayOfWeek = correctDayOfWeek;
        totalDayOfWeekFixed++;
        if (!updates.sessionNumber) {
          console.log(`   ✓ ${session.date}: "${session.dayOfWeek}" → "${correctDayOfWeek}"`);
        }
      }

      if (Object.keys(updates).length > 0) {
        const docRef = db.collection('classSessions').doc(session.id);
        batch.update(docRef, updates);
        batchCount++;
      }
    }

    if (batchCount > 0 && !DRY_RUN) {
      await batch.commit();
      console.log(`   ✅ Fixed ${batchCount} sessions`);
    } else if (batchCount > 0) {
      console.log(`   🔍 Would fix ${batchCount} sessions (dry run)`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Done!`);
  console.log(`   Sessions renumbered: ${totalFixed}`);
  console.log(`   DayOfWeek fixed: ${totalDayOfWeekFixed}`);
  console.log(`   Classes affected: ${totalClasses}`);
  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made. Run without --dry-run to execute.');
  }
}

fixSessionNumbers().catch(console.error);
