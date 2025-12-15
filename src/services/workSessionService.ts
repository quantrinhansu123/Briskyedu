/**
 * Work Session Service
 * Handle work confirmation/session CRUD
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const WORK_SESSIONS_COLLECTION = 'workSessions';

export type WorkStatus = 'Chờ xác nhận' | 'Đã xác nhận' | 'Từ chối';
export type WorkType = 'Dạy chính' | 'Trợ giảng' | 'Nhận xét' | 'Dạy thay' | 'Bồi bài';

export interface WorkSession {
  id?: string;
  staffId?: string;
  staffName: string;
  position: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  classId?: string;
  className?: string;
  type: WorkType;
  status: WorkStatus;
  studentCount?: number;
  salary?: number;
  note?: string;
  
  // Thông tin dạy thay (chỉ dùng khi type = 'Dạy thay')
  substituteForStaffName?: string; // Dạy thay cho GV nào
  substituteReason?: SubstituteReason; // Lý do dạy thay
  
  confirmedAt?: string;
  confirmedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SubstituteReason = 'Nghỉ phép' | 'Nghỉ ốm' | 'Bận việc đột xuất' | 'Nghỉ không lương' | 'Khác';

export const createWorkSession = async (data: Omit<WorkSession, 'id'>): Promise<string> => {
  try {
    const sessionData = {
      ...data,
      status: data.status || 'Chờ xác nhận',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, WORK_SESSIONS_COLLECTION), sessionData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating work session:', error);
    throw new Error('Không thể tạo công');
  }
};

export const getWorkSessions = async (filters?: {
  staffId?: string;
  status?: WorkStatus;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<WorkSession[]> => {
  try {
    let q = query(collection(db, WORK_SESSIONS_COLLECTION), orderBy('date', 'desc'));
    
    if (filters?.staffId) {
      q = query(collection(db, WORK_SESSIONS_COLLECTION), where('staffId', '==', filters.staffId));
    }
    
    if (filters?.status) {
      q = query(collection(db, WORK_SESSIONS_COLLECTION), where('status', '==', filters.status));
    }
    
    const snapshot = await getDocs(q);
    let sessions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as WorkSession));
    
    // Client-side date filter
    if (filters?.date) {
      sessions = sessions.filter(s => s.date === filters.date);
    }
    if (filters?.startDate) {
      sessions = sessions.filter(s => s.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      sessions = sessions.filter(s => s.date <= filters.endDate!);
    }
    
    return sessions;
  } catch (error) {
    console.error('Error getting work sessions:', error);
    throw new Error('Không thể tải danh sách công');
  }
};

export const updateWorkSession = async (id: string, data: Partial<WorkSession>): Promise<void> => {
  try {
    const docRef = doc(db, WORK_SESSIONS_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating work session:', error);
    throw new Error('Không thể cập nhật công');
  }
};

export const confirmWorkSession = async (id: string, confirmedBy?: string): Promise<void> => {
  try {
    await updateWorkSession(id, {
      status: 'Đã xác nhận',
      confirmedAt: new Date().toISOString(),
      confirmedBy,
    });
  } catch (error) {
    console.error('Error confirming work session:', error);
    throw new Error('Không thể xác nhận công');
  }
};

export const confirmAllWorkSessions = async (ids: string[], confirmedBy?: string): Promise<void> => {
  if (!ids || ids.length === 0) {
    throw new Error('Không có công nào để xác nhận');
  }
  
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    
    console.log('Confirming sessions:', ids);
    
    ids.forEach(id => {
      const docRef = doc(db, WORK_SESSIONS_COLLECTION, id);
      batch.update(docRef, {
        status: 'Đã xác nhận',
        confirmedAt: now,
        confirmedBy: confirmedBy || 'system',
        updatedAt: now,
      });
    });
    
    await batch.commit();
    console.log('Batch commit successful');
  } catch (error: any) {
    console.error('Error confirming all work sessions:', error);
    console.error('Error details:', error?.code, error?.message);
    throw new Error(`Không thể xác nhận hàng loạt: ${error?.message || 'Unknown error'}`);
  }
};

export const deleteWorkSession = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, WORK_SESSIONS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting work session:', error);
    throw new Error('Không thể xóa công');
  }
};

// =============================================
// AUDIT LOG cho sửa/xóa công
// =============================================
export interface WorkSessionAuditLog {
  id?: string;
  workSessionId: string;
  action: 'create' | 'update' | 'delete' | 'confirm' | 'unconfirm';
  performedBy: string; // Tên người thực hiện
  performedByRole: string; // Role của người thực hiện
  performedAt: string;
  previousData?: Partial<WorkSession>; // Dữ liệu trước khi thay đổi
  newData?: Partial<WorkSession>; // Dữ liệu sau khi thay đổi
  reason?: string; // Lý do sửa/xóa
}

const AUDIT_LOG_COLLECTION = 'workSessionAuditLogs';

export const createAuditLog = async (log: Omit<WorkSessionAuditLog, 'id'>): Promise<void> => {
  try {
    await addDoc(collection(db, AUDIT_LOG_COLLECTION), {
      ...log,
      performedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Không throw error để không block action chính
  }
};

// Update với audit log
export const updateWorkSessionWithAudit = async (
  id: string, 
  previousData: WorkSession,
  newData: Partial<WorkSession>,
  performer: { name: string; role: string },
  reason?: string
): Promise<void> => {
  try {
    // Update work session
    const docRef = doc(db, WORK_SESSIONS_COLLECTION, id);
    await updateDoc(docRef, {
      ...newData,
      updatedAt: new Date().toISOString(),
    });
    
    // Create audit log
    await createAuditLog({
      workSessionId: id,
      action: 'update',
      performedBy: performer.name,
      performedByRole: performer.role,
      performedAt: new Date().toISOString(),
      previousData: {
        staffName: previousData.staffName,
        date: previousData.date,
        timeStart: previousData.timeStart,
        timeEnd: previousData.timeEnd,
        className: previousData.className,
        type: previousData.type,
        status: previousData.status,
      },
      newData,
      reason,
    });
  } catch (error) {
    console.error('Error updating work session with audit:', error);
    throw new Error('Không thể cập nhật công');
  }
};

// Delete với audit log
export const deleteWorkSessionWithAudit = async (
  id: string,
  sessionData: WorkSession,
  performer: { name: string; role: string },
  reason?: string
): Promise<void> => {
  try {
    // Create audit log first (trước khi xóa)
    await createAuditLog({
      workSessionId: id,
      action: 'delete',
      performedBy: performer.name,
      performedByRole: performer.role,
      performedAt: new Date().toISOString(),
      previousData: {
        staffName: sessionData.staffName,
        date: sessionData.date,
        timeStart: sessionData.timeStart,
        timeEnd: sessionData.timeEnd,
        className: sessionData.className,
        type: sessionData.type,
        status: sessionData.status,
      },
      reason,
    });
    
    // Delete work session
    const docRef = doc(db, WORK_SESSIONS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting work session with audit:', error);
    throw new Error('Không thể xóa công');
  }
};

// Get audit logs cho 1 work session
export const getWorkSessionAuditLogs = async (workSessionId: string): Promise<WorkSessionAuditLog[]> => {
  try {
    const q = query(
      collection(db, AUDIT_LOG_COLLECTION),
      where('workSessionId', '==', workSessionId),
      orderBy('performedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as WorkSessionAuditLog));
  } catch (error) {
    console.error('Error getting audit logs:', error);
    return [];
  }
};
