/**
 * useSettlementInvoices Hook
 * Real-time listener for settlement invoices
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SettlementInvoice } from '../../types';

interface UseSettlementInvoicesOptions {
  studentId?: string;
}

export const useSettlementInvoices = (options?: UseSettlementInvoicesOptions) => {
  const [invoices, setInvoices] = useState<SettlementInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    if (options?.studentId) {
      constraints.unshift(where('studentId', '==', options.studentId));
    }

    const q = query(collection(db, 'settlementInvoices'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as SettlementInvoice[];
        setInvoices(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching settlement invoices:', err);
        setError('Không thể tải danh sách hóa đơn tất toán');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [options?.studentId]);

  return { invoices, loading, error };
};

export default useSettlementInvoices;
