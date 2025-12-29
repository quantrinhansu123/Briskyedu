/**
 * Settlement Invoice Service
 * Handles debt settlement invoices CRUD for students with fee debt
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
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SettlementInvoice } from '../../types';

const COLLECTION = 'settlementInvoices';

// Generate invoice code: STL-YYYYMMDD-XXX
const generateInvoiceCode = (): string => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `STL-${dateStr}-${random}`;
};

export class SettlementInvoiceService {
  // Create new settlement invoice
  static async create(
    data: Omit<SettlementInvoice, 'id' | 'invoiceCode' | 'createdAt'>
  ): Promise<string> {
    const invoiceData: Omit<SettlementInvoice, 'id'> = {
      ...data,
      invoiceCode: generateInvoiceCode(),
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), invoiceData);
    return docRef.id;
  }

  // Get all settlement invoices
  static async getAll(): Promise<SettlementInvoice[]> {
    const q = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SettlementInvoice[];
  }

  // Get by student ID
  static async getByStudentId(studentId: string): Promise<SettlementInvoice[]> {
    const q = query(
      collection(db, COLLECTION),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SettlementInvoice[];
  }

  // Get single invoice by ID
  static async getById(id: string): Promise<SettlementInvoice | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as SettlementInvoice;
  }

  // Update invoice
  static async update(
    id: string,
    data: Partial<SettlementInvoice>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  // Delete invoice
  static async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }
}

export default SettlementInvoiceService;
