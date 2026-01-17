/**
 * Fix signature URL for CS2 - add missing .png extension
 * Run: npx tsx scripts/fixSignatureUrl.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize with service account or default credentials
initializeApp({
  projectId: 'edumanager-pro-6180f',
});

const db = getFirestore();

async function fixSignatureUrl() {
  console.log('Fixing signature URL for CS2...');

  const centerRef = db.collection('centers').doc('0J778bdmhUs9d036nx9E');

  await centerRef.update({
    signatureUrl: '/signature-party-2.png',
    updatedAt: new Date().toISOString(),
  });

  console.log('✅ Updated CS2 signatureUrl to /signature-party-2.png');

  // Verify
  const doc = await centerRef.get();
  console.log('Verified:', doc.data()?.signatureUrl);
}

fixSignatureUrl().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
