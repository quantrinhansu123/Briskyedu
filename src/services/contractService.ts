/**
 * Contract Service
 * Handle contract CRUD operations with Firestore
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Contract, ContractStatus, ContractType, PaymentMethod, EnrollmentRecord } from '../../types';
import * as enrollmentService from './enrollmentService';

const CONTRACTS_COLLECTION = 'contracts';

/**
 * Generate contract code (Brisky01-999)
 */
export const generateContractCode = async (): Promise<string> => {
  try {
    const contractsRef = collection(db, CONTRACTS_COLLECTION);
    const snapshot = await getDocs(contractsRef);
    
    if (snapshot.empty) {
      return 'Brisky001';
    }
    
    // Find highest number from existing contracts
    let maxNumber = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const code = data.code || '';
      // Extract number from code (support both Brisky and BRISKY formats)
      const match = code.match(/\d+/);
      if (match) {
        const num = parseInt(match[0]) || 0;
        if (num > maxNumber) maxNumber = num;
      }
    });
    
    const nextNumber = maxNumber + 1;
    
    if (nextNumber > 999) {
      throw new Error('Đã đạt giới hạn mã hợp đồng (999)');
    }
    
    return `Brisky${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating contract code:', error);
    // Fallback to timestamp-based code
    const timestamp = Date.now().toString().slice(-6);
    return `Brisky${timestamp}`;
  }
};

/**
 * Create new contract
 */
export const createContract = async (contractData: Partial<Contract>): Promise<string> => {
  try {
    const code = await generateContractCode();
    
    const contract: Omit<Contract, 'id'> = {
      code,
      type: contractData.type || ContractType.STUDENT,
      studentId: contractData.studentId || '',
      studentName: contractData.studentName || '',
      studentDOB: contractData.studentDOB || '',
      parentName: contractData.parentName || '',
      parentPhone: contractData.parentPhone || '',
      items: contractData.items || [],
      subtotal: contractData.subtotal || 0,
      totalDiscount: contractData.totalDiscount || 0,
      totalAmount: contractData.totalAmount || 0,
      totalAmountInWords: contractData.totalAmountInWords || '',
      paymentMethod: contractData.paymentMethod || PaymentMethod.CASH,
      paidAmount: contractData.paidAmount || 0,
      remainingAmount: contractData.remainingAmount || 0,
      contractDate: contractData.contractDate || new Date().toISOString(),
      paymentDate: contractData.paymentDate || null,
      status: contractData.status || ContractStatus.DRAFT,
      notes: contractData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: contractData.createdBy || 'unknown',
    };
    
    const docRef = await addDoc(collection(db, CONTRACTS_COLLECTION), contract);
    
    // Auto-create enrollment record for tracking
    try {
      const totalSessions = contract.items.reduce((sum, item) => {
        if (item.type === 'course') {
          return sum + (item.quantity || 0);
        }
        return sum;
      }, 0);
      
      // Determine enrollment type based on existing contracts
      const existingContracts = await getContracts({ studentId: contract.studentId });
      const enrollmentType: EnrollmentRecord['type'] = 
        existingContracts.length > 1 ? 'Hợp đồng tái phí' : 'Hợp đồng mới';
      
      const enrollmentData: Omit<EnrollmentRecord, 'id'> = {
        studentName: contract.studentName,
        studentId: contract.studentId,
        sessions: totalSessions,
        type: enrollmentType,
        contractCode: contract.code,
        contractId: docRef.id,
        originalAmount: contract.subtotal,
        finalAmount: contract.totalAmount,
        createdDate: new Date().toLocaleDateString('vi-VN'),
        createdBy: contract.createdBy,
        staff: contract.createdBy,
        note: contract.notes || '',
      };
      
      await enrollmentService.createEnrollment(enrollmentData);
    } catch (enrollError) {
      console.warn('Failed to create enrollment record:', enrollError);
      // Don't fail contract creation if enrollment fails
    }
    
    return docRef.id;
  } catch (error: any) {
    console.error('Error creating contract:', error);
    throw new Error(error.message || 'Không thể tạo hợp đồng');
  }
};

/**
 * Get contract by ID
 */
export const getContract = async (id: string): Promise<Contract | null> => {
  try {
    const docRef = doc(db, CONTRACTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Contract;
  } catch (error) {
    console.error('Error getting contract:', error);
    throw new Error('Không thể tải hợp đồng');
  }
};

/**
 * Get all contracts with filters
 * Note: Filters are applied client-side to avoid Firestore composite index requirements
 */
export const getContracts = async (filters?: {
  studentId?: string;
  status?: ContractStatus;
  type?: ContractType;
}): Promise<Contract[]> => {
  try {
    const constraints: QueryConstraint[] = [];
    
    // Only filter by studentId server-side (single field, no index needed)
    if (filters?.studentId) {
      constraints.push(where('studentId', '==', filters.studentId));
    }
    
    constraints.push(orderBy('createdAt', 'desc'));
    
    const q = query(collection(db, CONTRACTS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    
    let contracts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Contract));
    
    // Apply status and type filters client-side
    if (filters?.status) {
      contracts = contracts.filter(c => c.status === filters.status);
    }
    
    if (filters?.type) {
      contracts = contracts.filter(c => c.type === filters.type);
    }
    
    return contracts;
  } catch (error) {
    console.error('Error getting contracts:', error);
    throw new Error('Không thể tải danh sách hợp đồng');
  }
};

/**
 * Update contract
 */
export const updateContract = async (id: string, data: Partial<Contract>): Promise<void> => {
  try {
    const docRef = doc(db, CONTRACTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating contract:', error);
    throw new Error('Không thể cập nhật hợp đồng');
  }
};

/**
 * Delete contract (with cascade delete enrollment)
 */
export const deleteContract = async (id: string): Promise<void> => {
  try {
    // Get contract first to get the code
    const contract = await getContract(id);
    
    const docRef = doc(db, CONTRACTS_COLLECTION, id);
    await deleteDoc(docRef);
    
    // Cascade delete enrollment record
    if (contract?.code) {
      try {
        await enrollmentService.deleteEnrollmentByContractCode(contract.code);
      } catch (enrollError) {
        console.warn('Failed to delete enrollment record:', enrollError);
      }
    }
  } catch (error) {
    console.error('Error deleting contract:', error);
    throw new Error('Không thể xóa hợp đồng');
  }
};

/**
 * Update contract status
 */
export const updateContractStatus = async (
  id: string,
  status: ContractStatus
): Promise<void> => {
  try {
    const docRef = doc(db, CONTRACTS_COLLECTION, id);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating contract status:', error);
    throw new Error('Không thể cập nhật trạng thái hợp đồng');
  }
};

/**
 * Record payment for contract
 */
export const recordPayment = async (
  id: string,
  amount: number,
  paymentDate?: string
): Promise<void> => {
  try {
    const contract = await getContract(id);
    if (!contract) {
      throw new Error('Hợp đồng không tồn tại');
    }
    
    const newPaidAmount = contract.paidAmount + amount;
    const newRemainingAmount = contract.totalAmount - newPaidAmount;
    
    const docRef = doc(db, CONTRACTS_COLLECTION, id);
    await updateDoc(docRef, {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      paymentDate: paymentDate || new Date().toISOString(),
      status: newRemainingAmount === 0 ? ContractStatus.PAID : ContractStatus.PARTIAL,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    throw new Error('Không thể ghi nhận thanh toán');
  }
};
