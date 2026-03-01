/**
 * Fix: Delete extra session #49 + standardize dayOfWeek format for Kindy 6
 *
 * 1. Delete session #49 (2026-06-01) to match 48-session config
 * 2. Standardize "Thứ 2"→"Thứ Hai", "Thứ 4"→"Thứ Tư"
 *
 * Usage:
 *   npx tsx scripts/fix-kindy6-day-format.ts          # Dry-run
 *   npx tsx scripts/fix-kindy6-day-format.ts --execute # Apply
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

// Mapping short → full format
const DAY_MAP: Record<string, string> = {
  'Thứ 2': 'Thứ Hai',
  'Thứ 3': 'Thứ Ba',
  'Thứ 4': 'Thứ Tư',
  'Thứ 5': 'Thứ Năm',
  'Thứ 6': 'Thứ Sáu',
  'Thứ 7': 'Thứ Bảy',
  'CN': 'Chủ Nhật',
};

async function fix() {
  console.log(`Mode: ${IS_DRY_RUN ? 'DRY-RUN' : 'EXECUTE'}\n`);

  const snap = await db.collection('classSessions')
    .where('classId', '==', CLASS_ID)
    .get();

  const sessions = snap.docs.map(doc => ({
    id: doc.id,
    num: doc.data().sessionNumber as number,
    date: doc.data().date as string,
    day: doc.data().dayOfWeek as string,
  }));
  sessions.sort((a, b) => a.num - b.num);

  console.log(`Found ${sessions.length} sessions\n`);

  // Find session to delete (last one, #49 if it exists after renumber, or highest number > 48)
  const toDelete = sessions.find(s => s.num === 49);
  if (toDelete) {
    console.log(`DELETE: Session #${toDelete.num} | ${toDelete.date} | ${toDelete.day} | id=${toDelete.id}`);
  }

  // Find sessions needing dayOfWeek fix
  const toFix: { id: string; oldDay: string; newDay: string; num: number }[] = [];
  for (const s of sessions) {
    if (s === toDelete) continue;
    const trimmed = s.day.trim();
    const mapped = DAY_MAP[trimmed];
    if (mapped) {
      toFix.push({ id: s.id, oldDay: trimmed, newDay: mapped, num: s.num });
      console.log(`FIX DAY: #${s.num} | "${trimmed}" → "${mapped}"`);
    }
  }

  console.log(`\nSummary: delete=${toDelete ? 1 : 0}, dayOfWeek fixes=${toFix.length}\n`);

  if (!toDelete && toFix.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  if (IS_DRY_RUN) {
    console.log('DRY-RUN complete. Run with --execute to apply.');
    return;
  }

  const batch = db.batch();
  if (toDelete) {
    batch.delete(db.collection('classSessions').doc(toDelete.id));
  }
  for (const f of toFix) {
    batch.update(db.collection('classSessions').doc(f.id), { dayOfWeek: f.newDay });
  }
  await batch.commit();
  console.log('✓ Done!');
}

fix().catch(console.error);
