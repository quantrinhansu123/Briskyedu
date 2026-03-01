import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!) });
const db = getFirestore();

const IS_DRY_RUN = !process.argv.includes('--execute');

async function main() {
  console.log(IS_DRY_RUN ? '🔍 DRY RUN' : '🚀 EXECUTE');
  const classesSnap = await db.collection('classes').get();
  const sessionsSnap = await db.collection('classSessions').get();

  const byClass = new Map<string, any[]>();
  sessionsSnap.docs.forEach(d => {
    const data = { id: d.id, ...d.data() };
    const cid = (data as any).classId;
    if (!byClass.has(cid)) byClass.set(cid, []);
    byClass.get(cid)!.push(data);
  });

  for (const classDoc of classesSnap.docs) {
    const d = classDoc.data();
    const total = d.totalSessions || 0;
    const sessions = (byClass.get(classDoc.id) || []).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const actual = sessions.length;

    if (total > 0 && actual > total) {
      const extra = sessions.slice(total);
      console.log(`\n${d.name}: ${actual} sessions, expected ${total}, removing ${extra.length}`);
      for (const s of extra as any[]) {
        if (s.attendanceId) {
          console.log(`  SKIP #${s.sessionNumber} ${s.date} (has attendance)`);
          continue;
        }
        console.log(`  DELETE #${s.sessionNumber} ${s.date} ${s.status}`);
        if (!IS_DRY_RUN) {
          await db.collection('classSessions').doc(s.id).delete();
        }
      }
    }
  }
  console.log(IS_DRY_RUN ? '\n💡 npx tsx scripts/fix-extra-sessions.ts --execute' : '\n✅ Done');
}
main().catch(console.error);
