/**
 * Salary Config Service
 * Handle salary configuration CRUD operations
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
} from 'firebase/firestore';
import { db } from '../config/firebase';

const SALARY_RULES_COLLECTION = 'salaryRules';
const SALARY_RANGES_COLLECTION = 'salaryRanges';

export type SalaryMethod = 'Theo ca' | 'Theo giờ' | 'Nhận xét' | 'Cố định';
export type WorkMethod = 'Cố định' | 'Theo sĩ số';
export type RangeType = 'Teaching' | 'AssistantFeedback';

export interface SalaryRule {
  id?: string;
  staffId: string;
  staffName: string;
  position: string;
  classId?: string;
  className?: string;
  classCode?: string;
  salaryMethod: SalaryMethod;
  baseRate: number;
  workMethod: WorkMethod;
  avgStudents?: number;
  ratePerSession: number;
  ratePerMinute?: number; // Đơn giá theo phút (cho salaryMethod='Theo giờ')
  allowance?: number;
  kpiBonus?: number;
  note?: string;
  salaryCycle?: string;
  effectiveDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryRangeConfig {
  id?: string;
  type: RangeType;
  rangeLabel: string;
  minStudents?: number;
  maxStudents?: number;
  method?: string;
  amount: number;
  effectiveDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// SALARY RULES
// ============================================

export const createSalaryRule = async (data: Omit<SalaryRule, 'id'>): Promise<string> => {
  try {
    const ruleData = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, SALARY_RULES_COLLECTION), ruleData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating salary rule:', error);
    throw new Error('Không thể tạo cấu hình lương');
  }
};

export const getSalaryRules = async (staffId?: string): Promise<SalaryRule[]> => {
  try {
    let q = query(collection(db, SALARY_RULES_COLLECTION), orderBy('createdAt', 'desc'));
    
    if (staffId) {
      q = query(collection(db, SALARY_RULES_COLLECTION), where('staffId', '==', staffId));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as SalaryRule));
  } catch (error) {
    console.error('Error getting salary rules:', error);
    throw new Error('Không thể tải cấu hình lương');
  }
};

export const updateSalaryRule = async (id: string, data: Partial<SalaryRule>): Promise<void> => {
  try {
    const docRef = doc(db, SALARY_RULES_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating salary rule:', error);
    throw new Error('Không thể cập nhật cấu hình lương');
  }
};

export const deleteSalaryRule = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, SALARY_RULES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting salary rule:', error);
    throw new Error('Không thể xóa cấu hình lương');
  }
};

// ============================================
// SALARY RANGES (Mức lương theo sĩ số)
// ============================================

export const createSalaryRange = async (data: Omit<SalaryRangeConfig, 'id'>): Promise<string> => {
  try {
    const rangeData = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, SALARY_RANGES_COLLECTION), rangeData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating salary range:', error);
    throw new Error('Không thể tạo mức lương');
  }
};

export const getSalaryRanges = async (type?: RangeType): Promise<SalaryRangeConfig[]> => {
  try {
    let q;
    
    if (type) {
      q = query(collection(db, SALARY_RANGES_COLLECTION), where('type', '==', type), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, SALARY_RANGES_COLLECTION), orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>),
    } as SalaryRangeConfig));
  } catch (error) {
    console.error('Error getting salary ranges:', error);
    // Fallback: get without ordering if index doesn't exist
    try {
      const fallbackSnapshot = await getDocs(collection(db, SALARY_RANGES_COLLECTION));
      const results = fallbackSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as SalaryRangeConfig));
      // Filter by type if specified
      if (type) {
        return results.filter(r => r.type === type);
      }
      return results;
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      throw new Error('Không thể tải mức lương');
    }
  }
};

export const updateSalaryRange = async (id: string, data: Partial<SalaryRangeConfig>): Promise<void> => {
  try {
    const docRef = doc(db, SALARY_RANGES_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating salary range:', error);
    throw new Error('Không thể cập nhật mức lương');
  }
};

export const deleteSalaryRange = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, SALARY_RANGES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting salary range:', error);
    throw new Error('Không thể xóa mức lương');
  }
};

// ============================================
// SALARY CALCULATION
// ============================================

export const calculateSalary = (
  baseRate: number,
  workMethod: WorkMethod,
  studentCount: number,
  ranges: SalaryRangeConfig[]
): number => {
  if (workMethod === 'Cố định') {
    return baseRate;
  }
  
  // Theo sĩ số - tìm range phù hợp
  const applicableRange = ranges.find(r => {
    if (r.minStudents !== undefined && r.maxStudents !== undefined) {
      return studentCount >= r.minStudents && studentCount <= r.maxStudents;
    }
    return false;
  });
  
  if (applicableRange) {
    return applicableRange.amount;
  }
  
  return baseRate;
};
