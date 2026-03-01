import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!) });
const db = getFirestore();

// Delete ALL extra sessions beyond totalSessions for ALL classes
async function main() {
  const classesSnap = await db.collection('classes').get();
  const sessionsSnap = await db.collection('classSessions').get();

  const byClass = new Map<string, any[]>();
  sessionsSnap.docs.forEach(d => {
    const cid = d.data().classId;
    if (!byClass.has(cid)) byClass.set(cid, []);
    byClass.get(cid)!.push({ ref: d.ref, id: d.id, ...d.data() });
  });

  for (const classDoc of classesSnap.docs) {
    const d = classDoc.data();
    const total = d.totalSessions || 0;
    const sessions = (byClass.get(classDoc.id) || []).sort((a: any, b: any) => a.date.localeCompare(b.date));

    if (total > 0 && sessions.length > total) {
      const extras = sessions.slice(total);
      for (const s of extras) {
        if (s.attendanceId) { console.log(`SKIP ${d.name} ${s.id} (attendance)`); continue; }
        console.log(`DELETE ${d.name}: ${s.id} #${s.sessionNumber} ${s.date}`);
        await s.ref.delete();
      }
    }
  }

  // Wait and verify
  await new Promise(r => setTimeout(r, 3000));
  const verifySnap = await db.collection('classSessions').get();
  const verifyByClass = new Map<string, number>();
  verifySnap.docs.forEach(d => {
    const cid = d.data().classId;
    verifyByClass.set(cid, (verifyByClass.get(cid) || 0) + 1);
  });

  console.log('\nVerification:');
  for (const classDoc of classesSnap.docs) {
    const d = classDoc.data();
    const total = d.totalSessions || 0;
    const actual = verifyByClass.get(classDoc.id) || 0;
    if (total > 0 && actual !== total) {
      console.log(`  ${d.name}: expected=${total} actual=${actual}`);
    }
  }
  console.log('Done');
}
main().catch(console.error);
