import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "edumanager-pro-6180f.firebaseapp.com",
  projectId: "edumanager-pro-6180f",
  storageBucket: "edumanager-pro-6180f.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxxxxxxxxxx"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCenters() {
  const snapshot = await getDocs(collection(db, 'centers'));
  console.log('=== CENTERS DATA ===');
  console.log('Total centers:', snapshot.docs.length);
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log('---');
    console.log('ID:', doc.id);
    console.log('Name:', data.name);
    console.log('Code:', data.code);
    console.log('SignatureUrl:', data.signatureUrl ? `"${data.signatureUrl}"` : '(EMPTY/UNDEFINED)');
    console.log('Manager:', data.manager);
    console.log('IsMain:', data.isMain);
  });
}

checkCenters().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
