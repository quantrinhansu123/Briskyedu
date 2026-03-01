/**
 * Fix script: Renumber classSessions for Kindy 6 (classId: 0UKu4Er3vJmSKrUCAlvR)
 *
 * Problem: Sessions were generated twice, causing:
 *   - Batch 1 (1-25): mostly correct dates but missing 12/1/2026
 *   - Batch 1 (26-29): wrong dates (jumped ahead)
 *   - Batch 2 (49): rogue session with date 12/1/2026 (missing from batch 1)
 *   - Batch 2 (50-68): correct dates but wrong numbers
 *
 * Fix: Sort ALL sessions by date → renumber 1, 2, 3... sequentially
 *
 * Usage:
 *   npx tsx scripts/fix-kindy6-sessions.ts          # Dry-run (default)
 *   npx tsx scripts/fix-kindy6-sessions.ts --execute # Apply changes
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!) });
}
const db = getFirestore();

const CLASS_ID = '0UKu4Er3vJmSKrUCAlvR';
const IS_DRY_RUN = !process.argv.includes('--execute');

async function fixSessions() {
  console.log(`Mode: ${IS_DRY_RUN ? 'DRY-RUN (no changes)' : 'EXECUTE (will update Firestore)'}\n`);

  // 1. Fetch all sessions for this class
  const snap = await db.collection('classSessions')
    .where('classId', '==', CLASS_ID)
    .get();

  console.log(`Found ${snap.size} sessions for classId ${CLASS_ID}\n`);

  // 2. Sort by date (chronological order)
  const sessions = snap.docs.map(doc => ({
    id: doc.id,
    date: doc.data().date as string,
    currentNumber: doc.data().sessionNumber as number,
    status: doc.data().status as string,
    dayOfWeek: doc.data().dayOfWeek as string,
  }));

  sessions.sort((a, b) => a.date.localeCompare(b.date));

  // 3. Calculate new numbers and show diff
  let changedCount = 0;
  const updates: { id: string; oldNum: number; newNum: number; date: string }[] = [];

  console.log('Session renumbering plan:');
  console.log('─'.repeat(70));

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const newNum = i + 1;
    const changed = s.currentNumber !== newNum;
    if (changed) changedCount++;

    const marker = changed ? '  ← CHANGE' : '';
    console.log(
      `  #${String(newNum).padStart(2)} | ${s.date} (${s.dayOfWeek.padEnd(8)}) | ${s.status.padEnd(10)} | was #${s.currentNumber}${marker}`
    );

    if (changed) {
      updates.push({ id: s.id, oldNum: s.currentNumber, newNum, date: s.date });
    }
  }

  console.log('─'.repeat(70));
  console.log(`\nTotal: ${sessions.length} sessions, ${changedCount} need renumbering\n`);

  if (changedCount === 0) {
    console.log('Nothing to update!');
    return;
  }

  // 4. Apply updates
  if (IS_DRY_RUN) {
    console.log('DRY-RUN complete. Run with --execute to apply changes.');
    return;
  }

  console.log('Applying updates...');
  const batch = db.batch();
  for (const u of updates) {
    const ref = db.collection('classSessions').doc(u.id);
    batch.update(ref, { sessionNumber: u.newNum });
  }
  await batch.commit();
  console.log(`✓ Updated ${changedCount} sessions successfully!`);
}

fixSessions().catch(console.error);
