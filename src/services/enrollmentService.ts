/**
 * Enrollment Service
 * Firebase operations for enrollment records
 */

import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { EnrollmentRecord } from '../../types';

const COLLECTION_NAME = 'enrollments';

/**
 * Check if enrollment already exists for student + contract combination
 * Returns existing enrollment if found, null otherwise
 */
export const checkDuplicateEnrollment = async (
  studentId: string | undefined,
  contractId: string | undefined
): Promise<EnrollmentRecord | null> => {
  // Skip check if no contractId (manual enrollments allowed to be multiple)
  if (!studentId || !contractId) return null;

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('studentId', '==', studentId),
      where('contractId', '==', contractId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as EnrollmentRecord;
  } catch (error) {
    console.error('Error checking duplicate enrollment:', error);
    return null; // Fail-safe: allow creation if check fails
  }
};

export const getEnrollments = async (filters?: {
  type?: string;
  month?: number;
  year?: number;
}): Promise<EnrollmentRecord[]> => {
  try {
    let q = query(collection(db, COLLECTION_NAME), orderBy('createdDate', 'desc'));
    
    const snapshot = await getDocs(q);
    let records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as EnrollmentRecord[];

    // Client-side filtering for type, month, year
    if (filters?.type && filters.type !== 'ALL') {
      records = records.filter(r => r.type === filters.type);
    }
    
    if (filters?.month && filters?.year) {
      records = records.filter(r => {
        const date = new Date(r.createdDate.split('/').reverse().join('-'));
        return date.getMonth() + 1 === filters.month && date.getFullYear() === filters.year;
      });
    }

    return records;
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    throw error;
  }
};

export const createEnrollment = async (data: Omit<EnrollmentRecord, 'id'>): Promise<string> => {
  try {
    // Check for duplicate enrollment (by studentId + contractId)
    const existing = await checkDuplicateEnrollment(data.studentId, data.contractId);
    if (existing) {
      console.warn(
        `Enrollment already exists for student ${data.studentId} + contract ${data.contractId}. ` +
        `Skipping creation. Existing ID: ${existing.id}`
      );
      return existing.id;
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating enrollment:', error);
    throw error;
  }
};

export const updateEnrollment = async (id: string, data: Partial<EnrollmentRecord>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating enrollment:', error);
    throw error;
  }
};

export const deleteEnrollment = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    throw error;
  }
};

/**
 * Check if enrollment exists for a contract
 */
export const getEnrollmentByContractCode = async (contractCode: string): Promise<EnrollmentRecord | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('contractCode', '==', contractCode)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as EnrollmentRecord;
  } catch (error) {
    console.error('Error finding enrollment by contract:', error);
    return null;
  }
};

/**
 * Delete enrollment by contract code (for cascade delete)
 */
export const deleteEnrollmentByContractCode = async (contractCode: string): Promise<void> => {
  try {
    const enrollment = await getEnrollmentByContractCode(contractCode);
    if (enrollment) {
      await deleteEnrollment(enrollment.id);
    }
  } catch (error) {
    console.error('Error deleting enrollment by contract:', error);
  }
};
