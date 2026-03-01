import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ClassModel, ClassStatus } from '../../types';
import { ClassService } from '../services/classService';

// Helper to convert Timestamp to date string
const timestampToDateStr = (ts: any): string => {
  if (!ts) return '';
  if (ts instanceof Timestamp || (ts && typeof ts.toDate === 'function')) {
    return ts.toDate().toISOString().split('T')[0];
  }
  if (typeof ts === 'string') return ts;
  return '';
};

export const useClasses = (filters?: {
  status?: ClassStatus;
  teacherId?: string;
  searchTerm?: string;
}) => {
  const [allClasses, setAllClasses] = useState<ClassModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Realtime listener
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      collection(db, 'classes'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            // Convert Timestamp to string for dates
            startDate: timestampToDateStr(docData.startDate),
            endDate: timestampToDateStr(docData.endDate),
          };
        }) as ClassModel[];
        setAllClasses(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Lỗi khi tải danh sách lớp học');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Client-side filtering
  const classes = useMemo(() => {
    let filtered = allClasses;
    
    if (filters?.status) {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    if (filters?.teacherId) {
      filtered = filtered.filter(c => c.teacherId === filters.teacherId);
    }
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(term) ||
        c.curriculum?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [allClasses, filters?.status, filters?.teacherId, filters?.searchTerm]);

  const refreshClasses = () => {
    // No-op for realtime - data auto-updates
  };

  const createClass = async (classData: Omit<ClassModel, 'id'>) => {
    try {
      const id = await ClassService.createClass(classData);
      await refreshClasses();
      return id;
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo lớp học');
      throw err;
    }
  };

  const updateClass = async (id: string, updates: Partial<ClassModel>) => {
    try {
      await ClassService.updateClass(id, updates);
      await refreshClasses();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật lớp học');
      throw err;
    }
  };

  const deleteClass = async (id: string, forceDelete: boolean = false): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const result = await ClassService.deleteClass(id, forceDelete);
      if (result.success) {
        await refreshClasses();
      }
      return result;
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa lớp học');
      return { success: false, message: err.message || 'Lỗi khi xóa lớp học' };
    }
  };

  return {
    classes,
    loading,
    error,
    refreshClasses,
    createClass,
    updateClass,
    deleteClass
  };
};

export const useClass = (id: string) => {
  const [classData, setClassData] = useState<ClassModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClass = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await ClassService.getClassById(id);
        setClassData(data);
      } catch (err: any) {
        setError(err.message || 'Lỗi khi tải thông tin lớp học');
        console.error('Error fetching class:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchClass();
    }
  }, [id]);

  return { classData, loading, error };
};
