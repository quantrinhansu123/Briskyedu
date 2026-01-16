/**
 * Student Service (Refactored)
 * - Students có parentId reference đến parents collection
 * - parentName/parentPhone được denormalize để hiển thị nhanh
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  QueryConstraint,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Student, StudentStatus, CareLog } from '../../types';
import { getParent, createParent, findParentByPhone } from './parentService';
import { convertTimestamp } from '../utils/firestoreUtils';

const COLLECTION_NAME = 'students';

export class StudentService {
  
  // Get all students with optional filters
  static async getStudents(filters?: {
    status?: StudentStatus;
    classId?: string;
    searchTerm?: string;
    parentId?: string;
  }): Promise<Student[]> {
    try {
      const constraints: QueryConstraint[] = [];
      
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      
      if (filters?.classId) {
        constraints.push(where('currentClassId', '==', filters.classId));
      }
      
      if (filters?.parentId) {
        constraints.push(where('parentId', '==', filters.parentId));
      }
      
      constraints.push(orderBy('createdAt', 'desc'));
      
      const q = query(collection(db, COLLECTION_NAME), ...constraints);
      const snapshot = await getDocs(q);
      
      let students = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dob: convertTimestamp(doc.data().dob),
        careHistory: (doc.data().careHistory as CareLog[] || []).map((log) => ({
          ...log,
          date: convertTimestamp(log.date)
        }))
      })) as Student[];
      
      // Client-side search if searchTerm provided
      if (filters?.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        students = students.filter(s => 
          s.fullName.toLowerCase().includes(term) ||
          s.code.toLowerCase().includes(term) ||
          s.phone?.includes(term) ||
          s.parentName?.toLowerCase().includes(term)
        );
      }
      
      return students;
    } catch (error) {
      console.error('Error getting students:', error);
      throw error;
    }
  }
  
  // Get single student by ID
  static async getStudentById(id: string): Promise<Student | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          dob: convertTimestamp(docSnap.data().dob),
          careHistory: (docSnap.data().careHistory as CareLog[] || []).map((log) => ({
            ...log,
            date: convertTimestamp(log.date)
          }))
        } as Student;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting student:', error);
      throw error;
    }
  }
  
  // Create new student with parent linking
  static async createStudent(studentData: Omit<Student, 'id'> & {
    parentId?: string;
    newParentName?: string;
    newParentPhone?: string;
  }): Promise<string> {
    try {
      let parentId = studentData.parentId;
      let parentName = studentData.parentName;
      let parentPhone = studentData.parentPhone;
      
      // If no parentId but has parent info, find or create parent
      if (!parentId && studentData.newParentPhone) {
        // Try to find existing parent by phone
        const existingParent = await findParentByPhone(studentData.newParentPhone);
        
        if (existingParent) {
          parentId = existingParent.id;
          parentName = existingParent.name;
          parentPhone = existingParent.phone;
        } else if (studentData.newParentName) {
          // Create new parent
          parentId = await createParent({
            name: studentData.newParentName,
            phone: studentData.newParentPhone,
          });
          parentName = studentData.newParentName;
          parentPhone = studentData.newParentPhone;
        }
      } else if (parentId) {
        // Get parent info for denormalization
        const parent = await getParent(parentId);
        if (parent) {
          parentName = parent.name;
          parentPhone = parent.phone;
        }
      }
      
      const { newParentName, newParentPhone, ...restData } = studentData;
      
      // Validate and convert dob - handle empty string case
      let dobValue: Timestamp | null = null;
      if (studentData.dob && studentData.dob.trim() !== '') {
        const dobDate = new Date(studentData.dob);
        if (!isNaN(dobDate.getTime())) {
          dobValue = Timestamp.fromDate(dobDate);
        }
      }

      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...restData,
        parentId: parentId || null,
        parentName: parentName || null,
        parentPhone: parentPhone || null,
        dob: dobValue,
        careHistory: studentData.careHistory?.map(log => ({
          ...log,
          date: log.date ? Timestamp.fromDate(new Date(log.date)) : null
        })) || [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating student:', error);
      throw error;
    }
  }
  
  // Update student
  static async updateStudent(id: string, updates: Partial<Student> & {
    newParentId?: string;
  }): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      // Get current student to check parentId
      const currentStudent = await this.getStudentById(id);
      
      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: Timestamp.now()
      };
      
      // If parentId changed, update denormalized fields
      if (updates.newParentId) {
        const parent = await getParent(updates.newParentId);
        if (parent) {
          updateData.parentId = parent.id;
          updateData.parentName = parent.name;
          updateData.parentPhone = parent.phone;
        }
        delete updateData.newParentId;
      }
      
      // Sync parent info to parents collection if parentName/parentPhone changed
      if (currentStudent?.parentId && (updates.parentName || updates.parentPhone)) {
        const { updateParent } = await import('./parentService');
        const parentUpdates: Record<string, string> = {};
        if (updates.parentName) parentUpdates.name = updates.parentName;
        if (updates.parentPhone) parentUpdates.phone = updates.parentPhone;

        await updateParent(currentStudent.parentId, parentUpdates);
      }
      
      // Convert date strings to Timestamps
      if (updates.dob) {
        updateData.dob = Timestamp.fromDate(new Date(updates.dob));
      }
      
      if (updates.careHistory) {
        updateData.careHistory = updates.careHistory.map(log => ({
          ...log,
          date: Timestamp.fromDate(new Date(log.date))
        }));
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating student:', error);
      throw error;
    }
  }
  
  // Delete student
  static async deleteStudent(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  }
  
  // Add care log to student
  static async addCareLog(studentId: string, careLog: Omit<CareLog, 'id'>): Promise<void> {
    try {
      const student = await this.getStudentById(studentId);
      if (!student) throw new Error('Student not found');
      
      const newLog: CareLog = {
        ...careLog,
        id: `LOG_${Date.now()}`
      };
      
      const updatedHistory = [...(student.careHistory || []), newLog];
      await this.updateStudent(studentId, { careHistory: updatedHistory });
    } catch (error) {
      console.error('Error adding care log:', error);
      throw error;
    }
  }
  
  // Get students by birthday month
  static async getStudentsByBirthdayMonth(month: number): Promise<Student[]> {
    try {
      const allStudents = await this.getStudents();
      return allStudents.filter(student => {
        const studentMonth = new Date(student.dob).getMonth() + 1;
        return studentMonth === month;
      });
    } catch (error) {
      console.error('Error getting students by birthday month:', error);
      throw error;
    }
  }
  
  // Bulk update student status (for class changes)
  static async bulkUpdateStudentStatus(
    studentIds: string[], 
    status: StudentStatus,
    classId?: string,
    className?: string
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      for (const studentId of studentIds) {
        const docRef = doc(db, COLLECTION_NAME, studentId);
        batch.update(docRef, {
          status,
          currentClassId: classId || null,
          currentClassName: className || null,
          updatedAt: Timestamp.now()
        });
      }
      
      await batch.commit();
    } catch (error) {
      console.error('Error bulk updating students:', error);
      throw error;
    }
  }
}
