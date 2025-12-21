/**
 * Staff Service
 * Firebase operations for staff management - Static class pattern
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
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Staff } from '../../types';

export class StaffService {
  private static readonly COLLECTION = 'staff';

  static async getStaff(filters?: {
    department?: string;
    role?: string;
    status?: string;
  }): Promise<Staff[]> {
    try {
      const q = query(collection(db, this.COLLECTION), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);

      let staffList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Staff[];

      // Client-side filtering
      if (filters?.department) {
        staffList = staffList.filter(s => s.department === filters.department);
      }
      if (filters?.role) {
        staffList = staffList.filter(s => s.role === filters.role);
      }
      if (filters?.status) {
        staffList = staffList.filter(s => s.status === filters.status);
      }

      return staffList;
    } catch (error) {
      console.error('Error fetching staff:', error);
      throw error;
    }
  }

  static async getStaffById(id: string): Promise<Staff | null> {
    try {
      const docRef = doc(db, this.COLLECTION, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Staff;
      }
      return null;
    } catch (error) {
      console.error('Error fetching staff by id:', error);
      throw error;
    }
  }

  static async createStaff(data: Omit<Staff, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.COLLECTION), {
        ...data,
        status: data.status || 'Active',
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating staff:', error);
      throw error;
    }
  }

  static async updateStaff(id: string, data: Partial<Staff>): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating staff:', error);
      throw error;
    }
  }

  static async deleteStaff(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION, id));
    } catch (error) {
      console.error('Error deleting staff:', error);
      throw error;
    }
  }

  // Get staff by role (for dropdowns)
  static async getTeachers(): Promise<Staff[]> {
    const allStaff = await this.getStaff();
    return allStaff.filter(s =>
      s.role === 'Giáo viên' ||
      s.position === 'Giáo Viên Việt' ||
      s.position === 'Giáo Viên Nước Ngoài'
    );
  }

  static async getAssistants(): Promise<Staff[]> {
    const allStaff = await this.getStaff();
    return allStaff.filter(s => s.role === 'Trợ giảng' || s.position === 'Trợ Giảng');
  }
}

// Legacy named exports for backwards compatibility during migration
export const getStaff = StaffService.getStaff.bind(StaffService);
export const getStaffById = StaffService.getStaffById.bind(StaffService);
export const createStaff = StaffService.createStaff.bind(StaffService);
export const updateStaff = StaffService.updateStaff.bind(StaffService);
export const deleteStaff = StaffService.deleteStaff.bind(StaffService);
export const getTeachers = StaffService.getTeachers.bind(StaffService);
export const getAssistants = StaffService.getAssistants.bind(StaffService);
