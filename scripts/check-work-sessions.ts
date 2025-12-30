import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Init Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../service-account.json'), 'utf8')
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
  // 1. Check class schedules
  console.log('=== CLASS SCHEDULES (Đang học) ===');
  const classesSnap = await db.collection('classes').where('status', '==', 'Đang học').get();
  classesSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`${d.name}: ${d.schedule || 'N/A'}`);
  });

  // 2. Check all work sessions
  console.log('\n=== ALL WORK SESSIONS ===');
  const sessionsSnap = await db.collection('workSessions').get();
  const allSessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  console.log(`Total sessions: ${allSessions.length}`);

  // Group by date
  const byDate: Record<string, any[]> = {};
  allSessions.forEach((s: any) => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  Object.keys(byDate).sort().forEach(date => {
    console.log(`\n${date} (${byDate[date].length} sessions):`);
    byDate[date].forEach((s: any) => {
      console.log(`  - ${s.staffName} | ${s.className} | ${s.type} | isFromTKB: ${s.isFromTKB} | status: ${s.status}`);
    });
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
