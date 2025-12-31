/**
 * useMonthlySalary hook
 * Fetches and manages salary data from monthlySalarySummary collection
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MonthlySalarySummary } from '../../types';

interface UseMonthlySalaryOptions {
  month: number;
  year: number;
  department?: string;
}

interface UseMonthlySalaryResult {
  salaries: MonthlySalarySummary[];
  loading: boolean;
  error: string | null;
  totals: {
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    count: number;
    approvedCount: number;
    pendingCount: number;
    paidCount: number;
  };
  approveSalary: (id: string, approvedBy: string) => Promise<void>;
  markPaid: (id: string) => Promise<void>;
}

export const useMonthlySalary = (
  month: number,
  year: number,
  department?: string
): UseMonthlySalaryResult => {
  const [salaries, setSalaries] = useState<MonthlySalarySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Build query - month and year are required
    const q = query(
      collection(db, 'monthlySalarySummary'),
      where('month', '==', month),
      where('year', '==', year),
      orderBy('staffName')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as MonthlySalarySummary[];

        // Filter by department client-side if specified
        if (department) {
          data = data.filter((s) => s.department === department);
        }

        setSalaries(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching salaries:', err);
        setError('Không thể tải dữ liệu lương');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [month, year, department]);

  // Approve salary (status: calculated -> approved)
  const approveSalary = async (id: string, approvedBy: string) => {
    const docRef = doc(db, 'monthlySalarySummary', id);
    await updateDoc(docRef, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy,
    });
  };

  // Mark as paid (status: approved -> paid)
  const markPaid = async (id: string) => {
    const docRef = doc(db, 'monthlySalarySummary', id);
    await updateDoc(docRef, {
      status: 'paid',
    });
  };

  // Calculate totals
  const totals = {
    totalGross: salaries.reduce((sum, s) => sum + (s.totalGross || 0), 0),
    totalDeductions: salaries.reduce((sum, s) => sum + (s.totalDeductions || 0), 0),
    totalNet: salaries.reduce((sum, s) => sum + (s.totalNet || 0), 0),
    count: salaries.length,
    approvedCount: salaries.filter((s) => s.status === 'approved').length,
    pendingCount: salaries.filter((s) => s.status === 'calculated' || s.status === 'draft').length,
    paidCount: salaries.filter((s) => s.status === 'paid').length,
  };

  return {
    salaries,
    loading,
    error,
    totals,
    approveSalary,
    markPaid,
  };
};

// Helper function to get status badge style
export const getSalaryStatusStyle = (status: string): string => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'approved':
      return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'calculated':
      return 'bg-amber-100 text-amber-700 border-amber-300';
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

// Helper function to get status label
export const getSalaryStatusLabel = (status: string): string => {
  switch (status) {
    case 'paid':
      return 'Đã thanh toán';
    case 'approved':
      return 'Đã duyệt';
    case 'calculated':
      return 'Chờ duyệt';
    case 'draft':
    default:
      return 'Nháp';
  }
};
