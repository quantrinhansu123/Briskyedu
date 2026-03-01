import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!) });
const db = getFirestore();

async function main() {
  const classesSnap = await db.collection('classes').get();
  const sessionsSnap = await db.collection('classSessions').get();
  const byClass = new Map<string, number>();
  sessionsSnap.docs.forEach(d => {
    const cid = d.data().classId;
    byClass.set(cid, (byClass.get(cid) || 0) + 1);
  });

  console.log('Lớp | totalSessions | Actual | Diff');
  console.log('-'.repeat(60));
  for (const doc of classesSnap.docs) {
    const d = doc.data();
    const total = d.totalSessions || 0;
    const actual = byClass.get(doc.id) || 0;
    if (total > 0 && actual !== total) {
      console.log(`${(d.name || '').padEnd(20)} | ${String(total).padStart(4)} | ${String(actual).padStart(4)} | ${actual > total ? '+' : ''}${actual - total}`);
    }
  }
}
main().catch(console.error);
