/**
 * Fix Pre Starters 26 sessions
 * - Renumber all sessions sequentially by date (1, 2, 3, ...)
 * - Standardize dayOfWeek format ("Thứ 2" → "Thứ Hai")
 *
 * Usage:
 *   npx tsx scripts/fix-pre-starters26-sessions.ts          # Dry run
 *   npx tsx scripts/fix-pre-starters26-sessions.ts --execute # Apply changes
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!) });
}
const db = getFirestore();

const IS_DRY_RUN = !process.argv.includes('--execute');
const CLASS_ID = '9VaF2wIAevwaKPUxZ6Na'; // Pre Starters 26

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

async function fixStarters25() {
  console.log(IS_DRY_RUN ? '🔍 DRY RUN - Không thay đổi dữ liệu' : '🚀 EXECUTE MODE - Sẽ cập nhật Firestore');
  console.log('');

  // Get all sessions sorted by date
  const sessionsSnap = await db.collection('classSessions')
    .where('classId', '==', CLASS_ID)
    .get();

  const sessions = sessionsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  })).sort((a: any, b: any) => a.date.localeCompare(b.date));

  console.log(`📊 Tổng sessions: ${sessions.length}`);

  let updateCount = 0;
  const batch = db.batch();

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i] as any;
    const correctNumber = i + 1;

    // Calculate correct dayOfWeek from actual date
    const sessionDate = new Date(session.date + 'T00:00:00');
    const correctDayOfWeek = DAY_NAMES[sessionDate.getDay()];

    const needsNumberFix = session.sessionNumber !== correctNumber;
    const needsDayFix = session.dayOfWeek !== correctDayOfWeek;

    if (needsNumberFix || needsDayFix) {
      const changes: string[] = [];
      const updateData: any = {};

      if (needsNumberFix) {
        changes.push(`sessionNumber: ${session.sessionNumber} → ${correctNumber}`);
        updateData.sessionNumber = correctNumber;
      }
      if (needsDayFix) {
        changes.push(`dayOfWeek: "${session.dayOfWeek}" → "${correctDayOfWeek}"`);
        updateData.dayOfWeek = correctDayOfWeek;
      }

      console.log(`  Fix buổi ${session.date}: ${changes.join(', ')}`);

      if (!IS_DRY_RUN) {
        batch.update(db.collection('classSessions').doc(session.id), updateData);
      }
      updateCount++;
    }
  }

  if (updateCount === 0) {
    console.log('\n✅ Không cần sửa gì!');
    return;
  }

  console.log(`\n📝 Tổng cần sửa: ${updateCount} sessions`);

  if (!IS_DRY_RUN) {
    await batch.commit();
    console.log('✅ Đã cập nhật Firestore thành công!');
  } else {
    console.log('\n💡 Chạy với --execute để áp dụng thay đổi:');
    console.log('   npx tsx scripts/fix-pre-starters26-sessions.ts --execute');
  }
}

fixStarters25().catch(console.error);
