/**
 * Financial Report Service
 * Quản lý báo cáo tài chính
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
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type RevenueCategory = 'Học phí' | 'Sách vở' | 'Đồng phục' | 'Khác';
export type TransactionType = 'income' | 'expense';

export interface FinancialTransaction {
  id?: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  type: TransactionType;
  category: RevenueCategory;
  amount: number;
  description?: string;
  studentId?: string;
  studentName?: string;
  contractId?: string;
  invoiceId?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface RevenueByCategory {
  category: RevenueCategory;
  amount: number;
  percentage: number;
  color: string;
}

export interface MonthlyRevenue {
  month: string;
  expected: number;
  actual: number;
  difference: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  revenueByCategory: RevenueByCategory[];
  monthlyRevenue: MonthlyRevenue[];
  debtAmount: number;
}

const COLLECTION = 'financialTransactions';

const CATEGORY_COLORS: Record<RevenueCategory, string> = {
  'Học phí': '#3b82f6',    // Blue
  'Sách vở': '#f97316',    // Orange
  'Đồng phục': '#22c55e',  // Green
  'Khác': '#8b5cf6',       // Purple
};

// Get all transactions
export const getTransactions = async (month?: string): Promise<FinancialTransaction[]> => {
  try {
    let q;
    if (month) {
      q = query(
        collection(db, COLLECTION),
        where('month', '==', month),
        orderBy('date', 'desc')
      );
    } else {
      q = query(collection(db, COLLECTION), orderBy('date', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>)
    })) as FinancialTransaction[];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    // Fallback without orderBy if index not ready
    const snapshot = await getDocs(collection(db, COLLECTION));
    const transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FinancialTransaction[];
    
    if (month) {
      return transactions.filter(t => t.month === month);
    }
    return transactions;
  }
};

// Get revenue summary for dashboard
export const getRevenueSummary = async (month?: string): Promise<FinancialSummary> => {
  const transactions = await getTransactions(month);
  
  const incomeTransactions = transactions.filter(t => t.type === 'income');
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  
  const totalRevenue = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Group by category
  const categoryTotals: Record<RevenueCategory, number> = {
    'Học phí': 0,
    'Sách vở': 0,
    'Đồng phục': 0,
    'Khác': 0,
  };
  
  incomeTransactions.forEach(t => {
    if (categoryTotals[t.category] !== undefined) {
      categoryTotals[t.category] += t.amount;
    }
  });
  
  const revenueByCategory: RevenueByCategory[] = Object.entries(categoryTotals)
    .filter(([_, amount]) => amount > 0)
    .map(([category, amount]) => ({
      category: category as RevenueCategory,
      amount,
      percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0,
      color: CATEGORY_COLORS[category as RevenueCategory],
    }));
  
  return {
    totalRevenue,
    totalExpense,
    netIncome: totalRevenue - totalExpense,
    revenueByCategory,
    monthlyRevenue: [], // Can be expanded later
    debtAmount: 0, // Can be calculated from contracts
  };
};

// Add transaction
export const addTransaction = async (transaction: Omit<FinancialTransaction, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...transaction,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

// Update transaction
export const updateTransaction = async (id: string, data: Partial<FinancialTransaction>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

// Delete transaction
export const deleteTransaction = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

// Seed test data
export const seedFinancialData = async (): Promise<void> => {
  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  
  const testTransactions: Omit<FinancialTransaction, 'id'>[] = [
    // Học phí - chiếm phần lớn
    { date: `${currentMonth}-01`, month: currentMonth, type: 'income', category: 'Học phí', amount: 45000000, description: 'Học phí lớp A1 - tháng 12', studentName: 'Nguyễn Văn A' },
    { date: `${currentMonth}-02`, month: currentMonth, type: 'income', category: 'Học phí', amount: 38000000, description: 'Học phí lớp A2 - tháng 12', studentName: 'Trần Thị B' },
    { date: `${currentMonth}-03`, month: currentMonth, type: 'income', category: 'Học phí', amount: 52000000, description: 'Học phí lớp B1 - tháng 12', studentName: 'Lê Văn C' },
    { date: `${currentMonth}-05`, month: currentMonth, type: 'income', category: 'Học phí', amount: 28000000, description: 'Học phí lớp C1 - tháng 12', studentName: 'Phạm Thị D' },
    { date: `${currentMonth}-08`, month: currentMonth, type: 'income', category: 'Học phí', amount: 35000000, description: 'Học phí lớp D1 - tháng 12', studentName: 'Hoàng Văn E' },
    
    // Sách vở
    { date: `${currentMonth}-02`, month: currentMonth, type: 'income', category: 'Sách vở', amount: 12500000, description: 'Bán sách Academy Starter 1', studentName: 'Nhiều học viên' },
    { date: `${currentMonth}-04`, month: currentMonth, type: 'income', category: 'Sách vở', amount: 8700000, description: 'Bán sách Academy Starter 2', studentName: 'Nhiều học viên' },
    { date: `${currentMonth}-10`, month: currentMonth, type: 'income', category: 'Sách vở', amount: 15300000, description: 'Bán sách giáo trình mới', studentName: 'Nhiều học viên' },
    
    // Đồng phục
    { date: `${currentMonth}-01`, month: currentMonth, type: 'income', category: 'Đồng phục', amount: 4500000, description: 'Bán đồng phục học viên mới', studentName: '15 học viên' },
    { date: `${currentMonth}-15`, month: currentMonth, type: 'income', category: 'Đồng phục', amount: 3200000, description: 'Bán đồng phục bổ sung', studentName: '10 học viên' },
    
    // Khác
    { date: `${currentMonth}-05`, month: currentMonth, type: 'income', category: 'Khác', amount: 2500000, description: 'Phí thi chứng chỉ', studentName: '5 học viên' },
    { date: `${currentMonth}-12`, month: currentMonth, type: 'income', category: 'Khác', amount: 1800000, description: 'Phí hoạt động ngoại khóa', studentName: 'Lớp A1' },
  ];
  
  // Check if data already exists
  const existing = await getTransactions(currentMonth);
  if (existing.length > 0) {
    console.log('Financial data already exists for this month');
    return;
  }
  
  // Add all transactions
  for (const transaction of testTransactions) {
    await addTransaction(transaction);
  }
  
  console.log(`Seeded ${testTransactions.length} financial transactions`);
};
