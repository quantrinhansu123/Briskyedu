/**
 * LeaveRequest Service - CRUD operations for staff leave requests
 * Pattern: Static class methods (same as workSessionService)
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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { LeaveRequest, LeaveRequestStatus } from '../../types';

const COLLECTION = 'leaveRequests';

export class LeaveRequestService {
  /**
   * Get all leave requests (for admin)
   */
  static async getAll(): Promise<LeaveRequest[]> {
    const q = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeaveRequest[];
  }

  /**
   * Get leave requests by staff ID
   */
  static async getByStaffId(staffId: string): Promise<LeaveRequest[]> {
    const q = query(
      collection(db, COLLECTION),
      where('staffId', '==', staffId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeaveRequest[];
  }

  /**
   * Get pending requests (for admin review)
   */
  static async getPending(): Promise<LeaveRequest[]> {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'Chờ phê duyệt'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeaveRequest[];
  }

  /**
   * Submit new leave request
   */
  static async submit(data: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      status: 'Chờ phê duyệt' as LeaveRequestStatus,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  }

  /**
   * Approve leave request
   */
  static async approve(
    id: string,
    approvedBy: string,
    approvedByName: string
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      status: 'Đã phê duyệt' as LeaveRequestStatus,
      approvedBy,
      approvedByName,
      approvalDate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Reject leave request
   */
  static async reject(
    id: string,
    approvedBy: string,
    approvedByName: string,
    rejectionReason: string
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      status: 'Từ chối' as LeaveRequestStatus,
      approvedBy,
      approvedByName,
      approvalDate: new Date().toISOString(),
      rejectionReason,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Delete leave request (only pending ones should be deletable)
   */
  static async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }

  /**
   * Update leave request (for editing pending requests)
   */
  static async update(id: string, data: Partial<LeaveRequest>): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Get single leave request by ID
   */
  static async getById(id: string): Promise<LeaveRequest | null> {
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as LeaveRequest;
  }

  /**
   * Get approved leaves for a date range (for Work Confirmation sync)
   */
  static async getApprovedForDateRange(
    startDate: string,
    endDate: string
  ): Promise<LeaveRequest[]> {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'Đã phê duyệt')
    );
    const snapshot = await getDocs(q);

    // Filter by date range client-side (overlapping dates)
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as LeaveRequest)
      .filter(leave => {
        // Check if leave period overlaps with requested range
        return leave.endDate >= startDate && leave.startDate <= endDate;
      });
  }
}

export default LeaveRequestService;
