/**
 * Contract Triggers
 * 
 * Handles:
 * - Add sessions to student when renewal/migration contract is paid
 * - Update student status when new contract is created
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const REGION = 'asia-southeast1';

interface ContractData {
  id?: string;
  code?: string; // Contract code like "Brisky001"
  type: 'Học viên' | 'Học liệu';
  category?: 'Hợp đồng mới' | 'Hợp đồng tái phí' | 'Hợp đồng liên kết';
  studentId?: string;
  studentName?: string;
  items: {
    type: 'course' | 'product';
    id: string;
    name: string;
    quantity: number;
    finalPrice: number;
  }[];
  status: 'Nháp' | 'Đã thanh toán' | 'Nợ hợp đồng' | 'Nợ phí' | 'Đã hủy';
  totalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  nextPaymentDate?: string;
  createdBy: string;
}

/**
 * Trigger: When a contract status changes to PAID
 * Actions:
 * - For renewal/migration contracts: Add sessions to student
 * - For new contracts: Ensure student has sessions
 */
export const onContractUpdate = functions
  .region(REGION)
  .firestore
  .document('contracts/{contractId}')
  .onUpdate(async (change, context) => {
    const contractId = context.params.contractId;
    const before = change.before.data() as ContractData;
    const after = change.after.data() as ContractData;

    console.log(`[onContractUpdate] Contract updated: ${contractId}`);
    console.log(`[onContractUpdate] Status: ${before.status} → ${after.status}`);

    // Only process if status changed to PAID or PARTIAL (Nợ hợp đồng)
    const isPaidOrPartial = after.status === 'Đã thanh toán' || after.status === 'Nợ hợp đồng';
    if (before.status === after.status || !isPaidOrPartial) {
      console.log('[onContractUpdate] Status not changed to PAID/PARTIAL, skipping');
      return null;
    }

    // Only process student contracts
    if (after.type !== 'Học viên' || !after.studentId) {
      console.log('[onContractUpdate] Not a student contract, skipping');
      return null;
    }

    // Calculate total sessions from course items
    const totalSessions = after.items
      .filter(item => item.type === 'course')
      .reduce((sum, item) => sum + (item.quantity || 0), 0);

    if (totalSessions === 0) {
      console.log('[onContractUpdate] No course items, skipping');
      return null;
    }

    // Calculate PAID sessions based on payment ratio
    // For PARTIAL contracts, only count sessions proportional to paid amount
    const paidAmount = after.paidAmount || 0;
    const totalAmount = after.totalAmount || 1;
    const paidSessions = after.status === 'Nợ hợp đồng' 
      ? Math.floor(totalSessions * (paidAmount / totalAmount))
      : totalSessions;

    console.log(`[onContractUpdate] Total sessions: ${totalSessions}, Paid sessions: ${paidSessions}`);
    console.log(`[onContractUpdate] Payment: ${paidAmount}/${totalAmount} = ${Math.round(paidAmount/totalAmount*100)}%`);
    console.log(`[onContractUpdate] Contract category: ${after.category}`);

    // Get student data
    const studentRef = db.collection('students').doc(after.studentId);
    const studentSnap = await studentRef.get();

    if (!studentSnap.exists) {
      console.log('[onContractUpdate] Student not found');
      return null;
    }

    const studentData = studentSnap.data();
    const currentSessions = studentData?.registeredSessions || 0;

    // Handle based on contract category
    // Use paidSessions (not totalSessions) to reflect actual paid amount
    let newSessions = currentSessions;
    
    if (after.category === 'Hợp đồng tái phí' || after.category === 'Hợp đồng liên kết') {
      // Add paid sessions to existing
      newSessions = currentSessions + paidSessions;
      console.log(`[onContractUpdate] Adding ${paidSessions} paid sessions. New total: ${newSessions}`);
    } else {
      // New contract - set sessions if not already set
      if (currentSessions === 0) {
        newSessions = paidSessions;
        console.log(`[onContractUpdate] Setting initial paid sessions: ${newSessions}`);
      } else {
        // Student already has sessions, add more paid sessions
        newSessions = currentSessions + paidSessions;
        console.log(`[onContractUpdate] Student has ${currentSessions} sessions, adding ${paidSessions} paid. New: ${newSessions}`);
      }
    }

    // Update student
    const attendedSessions = studentData?.attendedSessions || 0;
    const updateData: any = {
      registeredSessions: newSessions,
      remainingSessions: newSessions - attendedSessions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update student status based on contract status
    if (after.status === 'Nợ hợp đồng') {
      // Set student status to CONTRACT_DEBT
      updateData.status = 'Nợ hợp đồng';
      updateData.contractDebt = after.remainingAmount || 0;
      if (after.nextPaymentDate) {
        updateData.nextPaymentDate = after.nextPaymentDate;
      }
      console.log(`[onContractUpdate] Updating student status to Nợ hợp đồng (${after.remainingAmount}đ)`);
    } else if (after.category === 'Hợp đồng mới' && studentData?.status === 'Học thử') {
      // If new contract and student was in TRIAL status, update to ACTIVE
      updateData.status = 'Đang học';
      console.log('[onContractUpdate] Updating student status from Học thử to Đang học');
    }

    await studentRef.update(updateData);
    console.log(`[onContractUpdate] Updated student ${after.studentId} with ${newSessions} sessions`);

    // Check if enrollment already exists for this contract (avoid duplicate)
    // Use studentId + contractId for duplicate check (matches client-side logic)
    const existingEnrollment = await db.collection('enrollments')
      .where('studentId', '==', after.studentId)
      .where('contractId', '==', contractId)
      .limit(1)
      .get();
    
    if (existingEnrollment.empty) {
      // Create enrollment record with PAID sessions (not total)
      // Use actual contract code if available, fallback to document ID
      const actualContractCode = after.code || contractId;
      const enrollmentData = {
        studentId: after.studentId,
        studentName: after.studentName || '',
        classId: after.items[0]?.id || '',
        className: after.items[0]?.name || '',
        sessions: paidSessions, // Use paidSessions, not totalSessions
        type: after.category || 'Hợp đồng mới',
        contractCode: actualContractCode,
        contractId: contractId,
        originalAmount: after.totalAmount,
        finalAmount: after.paidAmount || after.totalAmount,
        createdDate: new Date().toLocaleDateString('vi-VN'),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: after.createdBy || 'System',
        note: after.status === 'Nợ hợp đồng'
          ? `HĐ ${contractId} - Thanh toán ${Math.round((paidAmount/totalAmount)*100)}% (${paidSessions}/${totalSessions} buổi)`
          : `HĐ ${contractId} - ${after.category || 'Hợp đồng mới'}`,
      };
      
      await db.collection('enrollments').add(enrollmentData);
      console.log(`[onContractUpdate] Created enrollment: ${paidSessions} sessions`);
    } else {
      console.log(`[onContractUpdate] Enrollment already exists for ${contractId}, skipping`);
    }

    return null;
  });

/**
 * Trigger: When a contract is created (for immediate PAID status)
 */
export const onContractCreate = functions
  .region(REGION)
  .firestore
  .document('contracts/{contractId}')
  .onCreate(async (snap, context) => {
    const contractId = context.params.contractId;
    const contract = snap.data() as ContractData;

    console.log(`[onContractCreate] Contract created: ${contractId}`);

    // Only process if already PAID or PARTIAL
    const isPaidOrPartial = contract.status === 'Đã thanh toán' || contract.status === 'Nợ hợp đồng';
    if (!isPaidOrPartial) {
      console.log('[onContractCreate] Not PAID/PARTIAL status, skipping');
      return null;
    }

    // Process same as update
    if (contract.type !== 'Học viên' || !contract.studentId) {
      return null;
    }

    const totalSessions = contract.items
      .filter(item => item.type === 'course')
      .reduce((sum, item) => sum + (item.quantity || 0), 0);

    if (totalSessions === 0) {
      return null;
    }

    // Calculate PAID sessions based on payment ratio
    const paidAmount = contract.paidAmount || 0;
    const totalAmount = contract.totalAmount || 1;
    const paidSessions = contract.status === 'Nợ hợp đồng'
      ? Math.floor(totalSessions * (paidAmount / totalAmount))
      : totalSessions;

    console.log(`[onContractCreate] Total: ${totalSessions}, Paid: ${paidSessions} (${Math.round(paidAmount/totalAmount*100)}%)`);

    const studentRef = db.collection('students').doc(contract.studentId);
    const studentSnap = await studentRef.get();

    if (!studentSnap.exists) {
      return null;
    }

    const studentData = studentSnap.data();
    const currentSessions = studentData?.registeredSessions || 0;
    
    // Use paidSessions (not totalSessions) to reflect actual paid amount
    let newSessions = currentSessions;
    if (contract.category === 'Hợp đồng tái phí' || contract.category === 'Hợp đồng liên kết') {
      newSessions = currentSessions + paidSessions;
    } else {
      newSessions = currentSessions === 0 ? paidSessions : currentSessions + paidSessions;
    }

    const attendedSessions = studentData?.attendedSessions || 0;
    const updateData: any = {
      registeredSessions: newSessions,
      remainingSessions: newSessions - attendedSessions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update student status based on contract status
    if (contract.status === 'Nợ hợp đồng') {
      updateData.status = 'Nợ hợp đồng';
      updateData.contractDebt = contract.remainingAmount || 0;
      if (contract.nextPaymentDate) {
        updateData.nextPaymentDate = contract.nextPaymentDate;
      }
      console.log(`[onContractCreate] Setting student status to Nợ hợp đồng (${contract.remainingAmount}đ)`);
    } else if (contract.category === 'Hợp đồng mới' && studentData?.status === 'Học thử') {
      updateData.status = 'Đang học';
    }

    await studentRef.update(updateData);
    console.log(`[onContractCreate] Updated student ${contract.studentId} with ${newSessions} sessions`);

    // Check if enrollment already exists (avoid duplicate)
    // Use studentId + contractId for duplicate check (matches client-side logic)
    const existingEnrollment = await db.collection('enrollments')
      .where('studentId', '==', contract.studentId)
      .where('contractId', '==', contractId)
      .limit(1)
      .get();
    
    if (existingEnrollment.empty) {
      // Create enrollment record with PAID sessions
      // Use actual contract code if available, fallback to document ID
      const actualContractCode = contract.code || contractId;
      const enrollmentData = {
        studentId: contract.studentId,
        studentName: contract.studentName || '',
        classId: contract.items[0]?.id || '',
        className: contract.items[0]?.name || '',
        sessions: paidSessions,
        type: contract.category || 'Hợp đồng mới',
        contractCode: actualContractCode,
        contractId: contractId,
        originalAmount: contract.totalAmount,
        finalAmount: contract.paidAmount || contract.totalAmount,
        createdDate: new Date().toLocaleDateString('vi-VN'),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: contract.createdBy || 'System',
        note: contract.status === 'Nợ hợp đồng'
          ? `HĐ ${contractId} - Thanh toán ${Math.round((paidAmount/totalAmount)*100)}% (${paidSessions}/${totalSessions} buổi)`
          : `HĐ ${contractId} - ${contract.category || 'Hợp đồng mới'}`,
      };
      
      await db.collection('enrollments').add(enrollmentData);
      console.log(`[onContractCreate] Created enrollment: ${paidSessions} sessions`);
    } else {
      console.log(`[onContractCreate] Enrollment already exists for ${contractId}, skipping`);
    }

    return null;
  });
