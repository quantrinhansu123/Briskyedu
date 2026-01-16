// Debug script to check session data for a specific class
const admin = require('firebase-admin');
const serviceAccount = require('./edumanager-pro-6180f-firebase-adminsdk-j95fx-1cde5db25f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugSessions() {
  try {
    // Get all classes to find Starters 23
    console.log('=== Searching for class "Starters 23" ===');
    const classesSnap = await db.collection('classes').get();

    let startersClass = null;
    classesSnap.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('Starters 23')) {
        startersClass = { id: doc.id, ...data };
        console.log('\nFound class:', {
          id: doc.id,
          name: data.name,
          schedule: data.schedule,
          startDate: data.startDate,
          endDate: data.endDate,
          totalSessions: data.totalSessions,
          progress: data.progress,
          status: data.status
        });
      }
    });

    if (!startersClass) {
      console.log('\n❌ Class "Starters 23" not found!');
      return;
    }

    // Query sessions for this class
    console.log('\n=== Querying classSessions collection ===');
    const sessionsSnap = await db.collection('classSessions')
      .where('classId', '==', startersClass.id)
      .get();

    console.log(`\nFound ${sessionsSnap.size} sessions for class ${startersClass.name}`);

    if (sessionsSnap.empty) {
      console.log('\n❌ NO SESSIONS FOUND in classSessions collection!');
      console.log('\nThis explains why:');
      console.log('1. Modal shows "0/18 buổi" - calculated from totalSessions/progress field');
      console.log('2. Attendance page shows "Chưa có buổi học" - queries classSessions collection');
      console.log('\n⚠️  SOLUTION: Need to generate sessions using the "Tạo 18 buổi học" button in modal');
    } else {
      console.log('\n✓ Sessions exist:');
      const sessions = [];
      sessionsSnap.forEach(doc => {
        sessions.push({ id: doc.id, ...doc.data() });
      });

      sessions.sort((a, b) => a.sessionNumber - b.sessionNumber);

      sessions.slice(0, 5).forEach(s => {
        console.log(`  - Buổi ${s.sessionNumber}: ${s.date} (${s.dayOfWeek}) - ${s.status}`);
      });

      if (sessions.length > 5) {
        console.log(`  ... and ${sessions.length - 5} more sessions`);
      }

      // Check for attendance records
      console.log('\n=== Checking attendance records ===');
      const attendanceSnap = await db.collection('attendance')
        .where('classId', '==', startersClass.id)
        .get();

      console.log(`Found ${attendanceSnap.size} attendance records`);

      if (attendanceSnap.size > 0) {
        attendanceSnap.forEach(doc => {
          const data = doc.data();
          console.log(`  - ${data.date}: ${data.present || 0} present, ${data.absent || 0} absent (sessionId: ${data.sessionId || 'NONE'})`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

debugSessions();
