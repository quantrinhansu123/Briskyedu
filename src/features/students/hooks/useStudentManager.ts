/**
 * Student Manager Hook
 * State management for StudentManager page
 */

import { useState, useMemo, useCallback } from 'react';
import { useStudents } from '../../../hooks/useStudents';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAuth } from '../../../hooks/useAuth';
import { Student, StudentStatus } from '../../../../types';
import { normalizeStudentStatus } from '../../../utils/statusUtils';

export type StudentModalType =
  | 'create'
  | 'edit'
  | 'detail'
  | 'enrollment'
  | 'transfer'
  | 'reserve'
  | 'care'
  | null;

export function useStudentManager(options?: {
  initialStatusFilter?: StudentStatus;
  classId?: string;
}) {
  // Permissions
  const { canCreate, canEdit, canDelete, shouldShowOnlyOwnClasses, shouldHideParentPhone, staffId } = usePermissions();
  const { staffData } = useAuth();

  // Core data
  const { students: allStudents, loading, error } = useStudents();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(options?.initialStatusFilter || 'all');
  const [classFilter, setClassFilter] = useState<string>(options?.classId || 'all');

  // Modal state
  const [activeModal, setActiveModal] = useState<StudentModalType>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Normalize and filter students
  const filteredStudents = useMemo(() => {
    return allStudents
      .map(student => ({
        ...student,
        status: normalizeStudentStatus(student.status)
      }))
      .filter(student => {
        // Search filter
        const matchesSearch = !searchTerm ||
          student.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.phone?.includes(searchTerm) ||
          student.parentPhone?.includes(searchTerm);

        // Status filter
        const matchesStatus = statusFilter === 'all' || student.status === statusFilter;

        // Class filter
        const matchesClass = classFilter === 'all' ||
          student.classId === classFilter ||
          student.classIds?.includes(classFilter);

        return matchesSearch && matchesStatus && matchesClass;
      });
  }, [allStudents, searchTerm, statusFilter, classFilter]);

  // Unique classes for filter dropdown
  const uniqueClasses = useMemo(() => {
    const classSet = new Set<string>();
    allStudents.forEach(s => {
      if (s.classId) classSet.add(s.classId);
      s.classIds?.forEach(id => classSet.add(id));
    });
    return Array.from(classSet).sort();
  }, [allStudents]);

  // Stats
  const stats = useMemo(() => {
    const result = {
      total: filteredStudents.length,
      active: 0,
      trial: 0,
      debt: 0,
      reserved: 0,
      dropped: 0
    };

    filteredStudents.forEach(s => {
      const status = s.status;
      if (status === StudentStatus.ACTIVE) result.active++;
      else if (status === StudentStatus.TRIAL) result.trial++;
      else if (status === StudentStatus.DEBT || status === StudentStatus.CONTRACT_DEBT) result.debt++;
      else if (status === StudentStatus.RESERVED) result.reserved++;
      else if (status === StudentStatus.DROPPED) result.dropped++;
    });

    return result;
  }, [filteredStudents]);

  // Modal handlers
  const openModal = useCallback((modal: StudentModalType, student?: Student) => {
    setSelectedStudent(student || null);
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setTimeout(() => setSelectedStudent(null), 200);
  }, []);

  // Toast helper
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return {
    // Data
    students: filteredStudents,
    allStudents,
    loading,
    error,

    // Permissions
    canCreateStudent: canCreate('students'),
    canEditStudent: canEdit('students'),
    canDeleteStudent: canDelete('students'),
    hideParentPhone: shouldHideParentPhone('students'),

    // Filters
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    classFilter,
    setClassFilter,
    uniqueClasses,

    // Stats
    stats,

    // Modal
    activeModal,
    selectedStudent,
    openModal,
    closeModal,

    // Toast
    toast,
    showToast
  };
}
