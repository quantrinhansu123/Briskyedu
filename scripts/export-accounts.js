/**
 * Script to export all staff accounts with email and password
 * Run: node scripts/export-accounts.js [format]
 * Format: json (default) or csv
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
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
console.log('Project ID:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function exportAccounts() {
  try {
    const format = process.argv[2] || 'json'; // json or csv
    
    console.log('\n📋 Fetching all staff accounts...\n');
    
    // Get all staff documents
    const staffSnapshot = await getDocs(collection(db, 'staff'));
    
    const accounts = [];
    let hasAccountCount = 0;
    let noAccountCount = 0;
    
    staffSnapshot.forEach(doc => {
      const data = doc.data();
      const account = {
        id: doc.id,
        name: data.name || '(Chưa có tên)',
        code: data.code || '(Chưa có mã)',
        email: data.email || '(Chưa có email)',
        password: data.plainPassword || '(Chưa có mật khẩu)',
        role: data.role || '(Chưa có vai trò)',
        department: data.department || '(Chưa có phòng ban)',
        position: data.position || '(Chưa có chức vụ)',
        status: data.status || 'Active',
        hasAccount: !!(data.uid && data.email),
      };
      
      accounts.push(account);
      
      if (account.hasAccount) {
        hasAccountCount++;
      } else {
        noAccountCount++;
      }
    });
    
    // Sort by name
    accounts.sort((a, b) => a.name.localeCompare(b.name));
    
    // Display summary
    console.log('📊 Tổng kết:');
    console.log(`   Tổng số nhân viên: ${accounts.length}`);
    console.log(`   Có tài khoản: ${hasAccountCount}`);
    console.log(`   Chưa có tài khoản: ${noAccountCount}\n`);
    
    // Display accounts with passwords
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📝 DANH SÁCH TÀI KHOẢN VÀ MẬT KHẨU');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    accounts.forEach((acc, index) => {
      if (acc.hasAccount) {
        console.log(`${index + 1}. ${acc.name} (${acc.code})`);
        console.log(`   Email: ${acc.email}`);
        console.log(`   Mật khẩu: ${acc.password}`);
        console.log(`   Vai trò: ${acc.role} | Phòng ban: ${acc.department}`);
        console.log('');
      }
    });
    
    // Display accounts without passwords
    if (noAccountCount > 0) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('⚠️  NHÂN VIÊN CHƯA CÓ TÀI KHOẢN');
      console.log('═══════════════════════════════════════════════════════════════\n');
      
      accounts.forEach((acc, index) => {
        if (!acc.hasAccount) {
          console.log(`${index + 1}. ${acc.name} (${acc.code})`);
          console.log(`   Email: ${acc.email}`);
          console.log(`   Vai trò: ${acc.role} | Phòng ban: ${acc.department}`);
          console.log('');
        }
      });
    }
    
    // Export to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    if (format === 'csv') {
      // Export as CSV
      const csvHeader = 'STT,Tên,Mã,Email,Mật khẩu,Vai trò,Phòng ban,Chức vụ,Trạng thái,Có tài khoản\n';
      const csvRows = accounts.map((acc, index) => {
        return [
          index + 1,
          acc.name,
          acc.code,
          acc.email,
          acc.password,
          acc.role,
          acc.department,
          acc.position,
          acc.status,
          acc.hasAccount ? 'Có' : 'Không'
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      });
      
      const csvContent = csvHeader + csvRows.join('\n');
      const csvFileName = `accounts-${timestamp}.csv`;
      writeFileSync(csvFileName, '\ufeff' + csvContent, 'utf8'); // BOM for Excel
      
      console.log(`\n✅ Đã xuất file CSV: ${csvFileName}`);
    } else {
      // Export as JSON
      const jsonFileName = `accounts-${timestamp}.json`;
      writeFileSync(jsonFileName, JSON.stringify(accounts, null, 2), 'utf8');
      
      console.log(`\n✅ Đã xuất file JSON: ${jsonFileName}`);
    }
    
    // Create a simple text file with just email:password pairs
    const simpleFileName = `accounts-simple-${timestamp}.txt`;
    const simpleContent = accounts
      .filter(acc => acc.hasAccount)
      .map(acc => `${acc.email}:${acc.password}`)
      .join('\n');
    
    if (simpleContent) {
      writeFileSync(simpleFileName, simpleContent, 'utf8');
      console.log(`✅ Đã xuất file đơn giản (email:password): ${simpleFileName}`);
    }
    
    console.log('\n🎉 Hoàn thành!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

exportAccounts();
