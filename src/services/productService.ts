/**
 * Product Service
 * Handle products/items CRUD for inventory and contracts
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const PRODUCTS_COLLECTION = 'products';

export type ProductStatus = 'Kích hoạt' | 'Tạm khoá' | 'Ngừng bán';
export type ProductCategory = 'Sách' | 'Học liệu' | 'Đồng phục' | 'Khác';

export interface Product {
  id?: string;
  name: string;
  code?: string;
  category: ProductCategory;
  price: number;
  stock: number;
  branchStock?: Record<string, number>;
  minStock?: number;
  description?: string;
  status: ProductStatus;
  createdAt?: string;
  updatedAt?: string;
}

export const createProduct = async (data: Omit<Product, 'id'>): Promise<string> => {
  try {
    const productData = {
      ...data,
      status: data.status || 'Kích hoạt',
      stock: data.stock || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), productData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating product:', error);
    throw new Error('Không thể tạo sản phẩm');
  }
};

export const getProducts = async (filters?: {
  status?: ProductStatus;
  category?: ProductCategory;
}): Promise<Product[]> => {
  try {
    let q = query(collection(db, PRODUCTS_COLLECTION), orderBy('createdAt', 'desc'));
    
    if (filters?.status) {
      q = query(collection(db, PRODUCTS_COLLECTION), where('status', '==', filters.status), orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    let products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Product));
    
    if (filters?.category) {
      products = products.filter(p => p.category === filters.category);
    }
    
    return products;
  } catch (error) {
    console.error('Error getting products:', error);
    throw new Error('Không thể tải danh sách sản phẩm');
  }
};

export const updateProduct = async (id: string, data: Partial<Product>): Promise<void> => {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating product:', error);
    throw new Error('Không thể cập nhật sản phẩm');
  }
};

export const updateStock = async (id: string, quantity: number, type: 'add' | 'subtract'): Promise<void> => {
  try {
    const products = await getProducts();
    const product = products.find(p => p.id === id);
    if (!product) throw new Error('Sản phẩm không tồn tại');
    
    const newStock = type === 'add' ? product.stock + quantity : product.stock - quantity;
    if (newStock < 0) throw new Error('Số lượng tồn kho không đủ');
    
    await updateProduct(id, { stock: newStock });
  } catch (error) {
    console.error('Error updating stock:', error);
    throw error;
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting product:', error);
    throw new Error('Không thể xóa sản phẩm');
  }
};

export const subscribeToProducts = (
  callback: (products: Product[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, PRODUCTS_COLLECTION), orderBy('createdAt', 'desc'));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Product));
      callback(products);
    },
    (error) => {
      console.error('Error subscribing to products:', error);
      onError?.(error);
    }
  );
};
