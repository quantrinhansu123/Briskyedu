/**
 * Debug script for Cam 4.2 class schedule parsing
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { parseScheduleDays } from '../src/services/sessionService';

async function debugCam42Schedule() {
  console.log('=== Debugging Cam 4.2 Schedule ===\n');

  try {
    // Query for class Cam 4.2
    const q = query(
      collection(db, 'classes'),
      where('name', '==', 'Cam 4.2')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('❌ Class "Cam 4.2" not found');
      return;
    }

    const classDoc = snapshot.docs[0];
    const classData = classDoc.data();

    console.log('✅ Found class:', classData.name);
    console.log('Schedule string:', JSON.stringify(classData.schedule));
    console.log('Start date:', classData.startDate);
    console.log('End date:', classData.endDate);
    console.log('');

    // Test schedule parsing
    console.log('=== Testing Schedule Parsing ===');
    const schedule = classData.schedule || '';
    console.log('Input:', schedule);
    console.log('Lowercase:', schedule.toLowerCase());
    console.log('');

    // Test parseScheduleDays function
    const parsedDays = parseScheduleDays(schedule);
    console.log('Parsed days (0=Sun, 1=Mon, ..., 6=Sat):', parsedDays);
    console.log('');

    // Show which days should match
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const vnDayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

    console.log('Expected days:');
    parsedDays.forEach(day => {
      console.log(`  - ${dayNames[day]} (${vnDayNames[day]})`);
    });
    console.log('');

    // Test specific patterns
    console.log('=== Pattern Matching Tests ===');
    const scheduleLower = schedule.toLowerCase();

    console.log('Contains "t4"?', scheduleLower.includes('t4'));
    console.log('Contains "t6"?', scheduleLower.includes('t6'));
    console.log('Contains "thứ 4"?', scheduleLower.includes('thứ 4'));
    console.log('Contains "thứ 6"?', scheduleLower.includes('thứ 6'));
    console.log('');

    // Test regex for numbers
    const numberMatches = schedule.match(/\b([2-7])\b/g);
    console.log('Number matches (\\b([2-7])\\b):', numberMatches);
    console.log('');

    // Test conversion
    if (numberMatches) {
      console.log('Number to day conversion:');
      numberMatches.forEach(num => {
        const n = parseInt(num);
        const jsDay = n === 7 ? 6 : n - 1;
        console.log(`  "${num}" -> Vietnamese day ${n} -> JS day ${jsDay} (${dayNames[jsDay]})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

debugCam42Schedule().then(() => {
  console.log('\n=== Debug Complete ===');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
