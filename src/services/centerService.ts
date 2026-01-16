/**
 * Center Service
 * Handle center/branch settings CRUD
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const CENTERS_COLLECTION = 'centers';
const SETTINGS_COLLECTION = 'settings';
const CENTER_SETTINGS_DOC = 'centerSettings';

export interface Center {
  id?: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email?: string;
  manager?: string;
  workingHours?: string;
  signatureUrl?: string; // URL to signature image for contract signing
  isMain: boolean;
  status: 'Active' | 'Inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface CenterSettings {
  companyName: string;
  taxCode?: string;
  logo?: string;
  primaryColor?: string;
  defaultCenter?: string;
  currency: string;
  timezone: string;
}

export const createCenter = async (data: Omit<Center, 'id'>): Promise<string> => {
  try {
    const centerData = {
      ...data,
      status: data.status || 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const docRef = doc(collection(db, CENTERS_COLLECTION));
    await setDoc(docRef, centerData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating center:', error);
    throw new Error('Không thể tạo trung tâm');
  }
};

export const getCenters = async (): Promise<Center[]> => {
  try {
    const q = query(collection(db, CENTERS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Center));
  } catch (error) {
    console.error('Error getting centers:', error);
    throw new Error('Không thể tải danh sách trung tâm');
  }
};

export const updateCenter = async (id: string, data: Partial<Center>): Promise<void> => {
  try {
    const docRef = doc(db, CENTERS_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating center:', error);
    throw new Error('Không thể cập nhật trung tâm');
  }
};

export const deleteCenter = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, CENTERS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting center:', error);
    throw new Error('Không thể xóa trung tâm');
  }
};

export const getSettings = async (): Promise<CenterSettings | null> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CENTER_SETTINGS_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as CenterSettings;
    }
    return null;
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
};

export const saveSettings = async (settings: CenterSettings): Promise<void> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CENTER_SETTINGS_DOC);
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    throw new Error('Không thể lưu cài đặt');
  }
};
