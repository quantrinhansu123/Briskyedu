/**
 * useStudents Hook (Realtime)
 * - Sử dụng onSnapshot để tự động cập nhật khi data thay đổi
 */

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Student, StudentStatus } from '../../types';
import { StudentService } from '../services/studentService';

export const useStudents = (filters?: {
  status?: StudentStatus;
  classId?: string;
  searchTerm?: string;
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Realtime listener
  useEffect(() => {
    setLoading(true);
    setError(null);

    // Build query with filters
    let q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    
    if (filters?.status) {
      q = query(collection(db, 'students'), 
        where('status', '==', filters.status),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        try {
          let studentsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            dob: doc.data().dob?.toDate?.()?.toISOString() || doc.data().dob || '',
            careHistory: doc.data().careHistory?.map((log: any) => ({
              ...log,
              date: log.date?.toDate?.()?.toISOString() || log.date
            })) || []
          })) as Student[];

          // Client-side search filter
          if (filters?.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            studentsList = studentsList.filter(s =>
              s.fullName?.toLowerCase().includes(term) ||
              s.code?.toLowerCase().includes(term) ||
              s.phone?.includes(term) ||
              s.parentName?.toLowerCase().includes(term) ||
              s.parentPhone?.includes(term)
            );
          }

          // Client-side class filter
          if (filters?.classId) {
            studentsList = studentsList.filter(s => s.classId === filters.classId);
          }

          setStudents(studentsList);
          setLoading(false);
        } catch (err) {
          console.error('Error processing students:', err);
          setError('Không thể tải danh sách học viên');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Snapshot error:', err);
        setError('Lỗi kết nối realtime');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [filters?.status, filters?.classId, filters?.searchTerm]);

  const refreshStudents = () => {
    // With realtime listener, manual refresh is not needed
  };

  const createStudent = async (studentData: Omit<Student, 'id'>) => {
    try {
      const id = await StudentService.createStudent(studentData);
      return id;
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo học viên');
      throw err;
    }
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    try {
      await StudentService.updateStudent(id, updates);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật học viên');
      throw err;
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      await StudentService.deleteStudent(id);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa học viên');
      throw err;
    }
  };

  return {
    students,
    loading,
    error,
    refreshStudents,
    createStudent,
    updateStudent,
    deleteStudent
  };
};

export const useStudent = (id: string) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Realtime listener for single student
  useEffect(() => {
    if (!id) {
      setStudent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(db, 'students', id);
    const unsubscribe = onSnapshot(docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setStudent({
            id: docSnap.id,
            ...docSnap.data(),
            dob: docSnap.data().dob?.toDate?.()?.toISOString() || docSnap.data().dob || '',
            careHistory: docSnap.data().careHistory?.map((log: any) => ({
              ...log,
              date: log.date?.toDate?.()?.toISOString() || log.date
            })) || []
          } as Student);
        } else {
          setStudent(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Snapshot error:', err);
        setError('Lỗi kết nối realtime');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  return { student, loading, error };
};
