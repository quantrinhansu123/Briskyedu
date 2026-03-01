/**
 * Fix ALL classes with session ordering issues
 * - Renumber all sessions sequentially by date
 * - Standardize dayOfWeek format
 *
 * Usage:
 *   npx tsx scripts/fix-all-class-sessions.ts          # Dry run
 *   npx tsx scripts/fix-all-class-sessions.ts --execute # Apply
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
const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

async function fixAllSessions() {
  console.log(IS_DRY_RUN ? '🔍 DRY RUN' : '🚀 EXECUTE MODE');

  const sessionsSnap = await db.collection('classSessions').get();
  console.log(`📊 Tổng sessions: ${sessionsSnap.size}`);

  // Group by classId
  const byClass = new Map<string, any[]>();
  sessionsSnap.docs.forEach(d => {
    const data = { id: d.id, ...d.data() };
    const cid = (data as any).classId;
    if (!byClass.has(cid)) byClass.set(cid, []);
    byClass.get(cid)!.push(data);
  });

  let totalFixed = 0;
  let classesFixed = 0;
  // Firestore batch limit = 500, use multiple batches
  let batch = db.batch();
  let batchCount = 0;

  for (const [classId, sessions] of byClass) {
    sessions.sort((a: any, b: any) => a.date.localeCompare(b.date));
    let classFixCount = 0;

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i] as any;
      const correctNum = i + 1;
      const sessionDate = new Date(s.date + 'T00:00:00');
      const correctDay = DAY_NAMES[sessionDate.getDay()];

      const needsNum = s.sessionNumber !== correctNum;
      const needsDay = s.dayOfWeek !== correctDay;

      if (needsNum || needsDay) {
        const updateData: any = {};
        if (needsNum) updateData.sessionNumber = correctNum;
        if (needsDay) updateData.dayOfWeek = correctDay;

        if (!IS_DRY_RUN) {
          batch.update(db.collection('classSessions').doc(s.id), updateData);
          batchCount++;
          // Commit every 400 to stay under 500 limit
          if (batchCount >= 400) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
        classFixCount++;
        totalFixed++;
      }
    }

    if (classFixCount > 0) {
      classesFixed++;
      console.log(`  Fix ${s(classFixCount)} sessions: ${(sessions[0] as any).className || classId}`);
    }
  }

  // Commit remaining
  if (!IS_DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n📝 Tổng: ${totalFixed} sessions trong ${classesFixed} lớp`);
  if (IS_DRY_RUN) {
    console.log('💡 Chạy: npx tsx scripts/fix-all-class-sessions.ts --execute');
  } else {
    console.log('✅ Đã cập nhật Firestore!');
  }
}

function s(n: number) { return String(n).padStart(3); }

fixAllSessions().catch(console.error);
