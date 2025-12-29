/**
 * Delete duplicate enrollment records
 * Removes enrollments where contractCode looks like a document ID
 * Run: npx tsx scripts/delete-duplicate-enrollment.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

console.log('🔥 Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteDuplicateEnrollments() {
  console.log('🔍 Finding duplicate enrollments with contractCode = document ID...\n');

  const enrollmentsSnap = await getDocs(collection(db, 'enrollments'));

  const duplicates: Array<{ id: string; contractCode: string; studentName: string; contractId?: string }> = [];

  enrollmentsSnap.docs.forEach(docSnap => {
    const data = docSnap.data();
    const contractCode = data.contractCode || '';
    const contractId = data.contractId || '';

    // Detect if contractCode is actually a document ID:
    // - Long alphanumeric string (20+ chars)
    // - OR matches contractId (meaning someone used ID instead of code)
    const isDocumentId = (
      (contractCode.length > 15 && /^[a-zA-Z0-9]+$/.test(contractCode)) ||
      (contractCode === contractId && contractCode.length > 10)
    );

    if (isDocumentId) {
      duplicates.push({
        id: docSnap.id,
        contractCode,
        contractId,
        studentName: data.studentName || 'Unknown'
      });
    }
  });

  if (duplicates.length === 0) {
    console.log('✅ No duplicate enrollments found');
    process.exit(0);
  }

  console.log(`Found ${duplicates.length} potential duplicates:\n`);
  duplicates.forEach(d => {
    console.log(`  📄 Document ID: ${d.id}`);
    console.log(`     contractCode: ${d.contractCode}`);
    console.log(`     contractId: ${d.contractId || 'N/A'}`);
    console.log(`     studentName: ${d.studentName}\n`);
  });

  // Confirm before delete
  console.log('⚠️  Press Ctrl+C to cancel, or wait 3 seconds to delete...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Delete duplicates
  console.log('🗑️  Deleting duplicates...\n');
  for (const dup of duplicates) {
    await deleteDoc(doc(db, 'enrollments', dup.id));
    console.log(`  ✅ Deleted: ${dup.id} (${dup.studentName})`);
  }

  console.log(`\n✅ Deleted ${duplicates.length} duplicate enrollment(s)`);
  process.exit(0);
}

deleteDuplicateEnrollments().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
