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
    orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AllowedWifi } from '../../types';

const WIFI_COLLECTION = 'allowedWifis';

/**
 * Get all allowed WiFi configurations
 */
export const getAllowedWifis = async (): Promise<AllowedWifi[]> => {
    const snapshot = await getDocs(collection(db, WIFI_COLLECTION));
    const wifis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllowedWifi));
    // Sort by name client-side to avoid needing index
    return wifis.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Get active allowed WiFi configurations only
 */
export const getActiveWifis = async (): Promise<AllowedWifi[]> => {
    // Simple query without orderBy to avoid composite index requirement
    const q = query(
        collection(db, WIFI_COLLECTION),
        where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    const wifis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllowedWifi));
    // Sort by name client-side
    return wifis.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Get a single WiFi by ID
 */
export const getWifiById = async (id: string): Promise<AllowedWifi | null> => {
    const docRef = doc(db, WIFI_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as AllowedWifi;
    }
    return null;
};

/**
 * Create a new WiFi configuration
 */
export const createWifi = async (data: Omit<AllowedWifi, 'id'>): Promise<string> => {
    const docData = {
        ...data,
        createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, WIFI_COLLECTION), docData);
    return docRef.id;
};

/**
 * Update an existing WiFi configuration
 */
export const updateWifi = async (id: string, data: Partial<AllowedWifi>): Promise<void> => {
    const docRef = doc(db, WIFI_COLLECTION, id);
    await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
    });
};

/**
 * Delete a WiFi configuration
 */
export const deleteWifi = async (id: string): Promise<void> => {
    const docRef = doc(db, WIFI_COLLECTION, id);
    await deleteDoc(docRef);
};

/**
 * Verify if an IP address is in the allowed list
 * Returns the matching WiFi if found, null otherwise
 */
export const verifyIpAddress = async (ip: string): Promise<AllowedWifi | null> => {
    const wifis = await getActiveWifis();
    return wifis.find(wifi => wifi.publicIp === ip) || null;
};

/**
 * Find WiFi by name (case-insensitive)
 * Used when IP doesn't match but user provides WiFi name
 */
export const findWifiByName = async (name: string): Promise<AllowedWifi | null> => {
    const wifis = await getActiveWifis();
    const normalizedName = name.toLowerCase().trim();
    return wifis.find(wifi => wifi.name.toLowerCase().trim() === normalizedName) || null;
};
