// Debug script using Firebase client SDK
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
dotenv.config({ path: join(__dirname, '.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugSessions() {
  try {
    // Get all classes to find Starters 23
    console.log('=== Searching for class "Starters 23" ===');
    const classesSnap = await getDocs(collection(db, 'classes'));

    let startersClass = null;
    classesSnap.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('Starters 23')) {
        startersClass = { id: doc.id, ...data };
        console.log('\n✓ Found class:', {
          id: doc.id,
          name: data.name,
          schedule: data.schedule,
          startDate: data.startDate?.toDate?.()?.toISOString?.() || data.startDate,
          endDate: data.endDate?.toDate?.()?.toISOString?.() || data.endDate,
          totalSessions: data.totalSessions,
          progress: data.progress,
          status: data.status
        });
      }
    });

    if (!startersClass) {
      console.log('\n❌ Class "Starters 23" not found!');
      process.exit(1);
    }

    // Query sessions for this class
    console.log('\n=== Querying classSessions collection ===');
    const sessionsQuery = query(
      collection(db, 'classSessions'),
      where('classId', '==', startersClass.id)
    );
    const sessionsSnap = await getDocs(sessionsQuery);

    console.log(`\n📊 Found ${sessionsSnap.size} sessions for class "${startersClass.name}"`);

    if (sessionsSnap.empty) {
      console.log('\n❌ NO SESSIONS FOUND in classSessions collection!');
      console.log('\n📌 ROOT CAUSE IDENTIFIED:');
      console.log('  1. Modal shows "0/18 buổi" - calculated from totalSessions or progress field in class document');
      console.log('  2. Attendance page shows "Chưa có buổi học" - queries classSessions collection which is EMPTY');
      console.log('\n💡 SOLUTION:');
      console.log('  - User must click "Tạo 18 buổi học" button in ClassDetailModal');
      console.log('  - This will populate classSessions collection with actual session documents');
      console.log('  - Then attendance page dropdown will show available sessions');
    } else {
      console.log('\n✓ Sessions exist in Firestore:');
      const sessions = [];
      sessionsSnap.forEach(doc => {
        sessions.push({ id: doc.id, ...doc.data() });
      });

      sessions.sort((a, b) => a.sessionNumber - b.sessionNumber);

      console.log('\nFirst 5 sessions:');
      sessions.slice(0, 5).forEach(s => {
        console.log(`  Buổi ${s.sessionNumber}: ${s.date} (${s.dayOfWeek}) - Status: ${s.status}`);
      });

      if (sessions.length > 5) {
        console.log(`  ... and ${sessions.length - 5} more sessions`);
      }

      // Check for attendance records
      console.log('\n=== Checking attendance records ===');
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('classId', '==', startersClass.id)
      );
      const attendanceSnap = await getDocs(attendanceQuery);

      console.log(`Found ${attendanceSnap.size} attendance records`);

      if (attendanceSnap.size > 0) {
        attendanceSnap.forEach(doc => {
          const data = doc.data();
          console.log(`  Date: ${data.date} | Present: ${data.present || 0}, Absent: ${data.absent || 0} | SessionId: ${data.sessionId || 'NONE'}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugSessions();
