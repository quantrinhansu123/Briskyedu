import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from '../config/firebase';
import app from '../config/firebase';
import { Staff } from '../../types';
import { sanitizeFirebaseError } from '../utils/errorUtils';

const functions = getFunctions(app, 'asia-southeast1');

export interface AuthUser extends FirebaseUser {
  role?: string;
  staffData?: Staff;
}

export class AuthService {
  
  // Sign in with email and password
  static async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Fetch staff data
      const staffDoc = await getDoc(doc(db, 'staff', user.uid));
      if (staffDoc.exists()) {
        return {
          ...user,
          role: staffDoc.data().role,
          staffData: { id: staffDoc.id, ...staffDoc.data() }
        } as AuthUser;
      }
      
      return user as AuthUser;
    } catch (error) {
      console.error('Sign in error:', error);
      throw new Error(sanitizeFirebaseError(error));
    }
  }
  
  // Sign out
  static async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }
  
  // Register new staff with email and password (via Cloud Function)
  // Uses Admin SDK on server to avoid auto-login issue
  static async registerStaff(
    email: string,
    password: string,
    staffData: {
      name: string;
      code: string;
      role: string;
      department: string;
      position: string;
      phone: string;
      dob?: string;
      startDate?: string;
      branch?: string;
      roles?: string[];
    }
  ): Promise<string> {
    try {
      // Client-side validation before Cloud Function call
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        throw new Error('Email không hợp lệ');
      }
      if (!password || password.length < 6) {
        throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
      }
      if (!staffData.name?.trim()) {
        throw new Error('Tên nhân viên là bắt buộc');
      }
      if (!staffData.code?.trim()) {
        throw new Error('Mã nhân viên là bắt buộc');
      }
      if (!staffData.role) {
        throw new Error('Vai trò là bắt buộc');
      }

      const registerFn = httpsCallable<
        { email: string; password: string; staffData: typeof staffData },
        { success: boolean; message: string; uid?: string }
      >(functions, 'registerStaffWithAccount');

      // Add timeout to prevent hanging (30s)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 30000);
      });

      const result = await Promise.race([
        registerFn({ email, password, staffData }),
        timeoutPromise
      ]);

      if (!result.data.success || !result.data.uid) {
        throw new Error(result.data.message || 'Không thể tạo tài khoản');
      }

      return result.data.uid;
    } catch (error: any) {
      console.error('Register error:', error);
      if (error.message === 'TIMEOUT') {
        throw new Error('Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại sau.');
      }
      throw new Error(sanitizeFirebaseError(error));
    }
  }
  
  // Get current user
  static getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }
  
  // Listen to auth state changes
  static onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    let unsubscribeStaff: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Cleanup previous staff listener
      if (unsubscribeStaff) {
        unsubscribeStaff();
        unsubscribeStaff = null;
      }

      if (user) {
        // Setup real-time listener for staff document
        unsubscribeStaff = onSnapshot(
          doc(db, 'staff', user.uid),
          (staffDoc) => {
            if (!staffDoc.exists()) {
              console.warn('Staff document deleted - forcing logout');
              this.signOut().catch(console.error);
              callback(null);
              return;
            }
            const staffData = { id: staffDoc.id, ...staffDoc.data() } as Staff;
            callback({
              ...user,
              role: staffData.role,
              staffData
            } as AuthUser);
          },
          async (error) => {
            console.error('Staff listener error:', error);
            // Fallback: fetch staff data once, or logout if critical
            try {
              const staffDoc = await getDoc(doc(db, 'staff', user.uid));
              if (!staffDoc.exists()) {
                console.warn('Staff document not found - forcing logout');
                await this.signOut();
                callback(null);
                return;
              }
              const staffData = { id: staffDoc.id, ...staffDoc.data() } as Staff;
              callback({
                ...user,
                role: staffData.role,
                staffData
              } as AuthUser);
            } catch (fallbackError) {
              console.error('Fallback fetch failed - forcing logout:', fallbackError);
              await this.signOut();
              callback(null);
            }
          }
        );
      } else {
        callback(null);
      }
    });

    // Return combined unsubscribe function
    return () => {
      if (unsubscribeStaff) {
        unsubscribeStaff();
      }
      unsubscribeAuth();
    };
  }

  // Update staff password (admin only - uses Cloud Function)
  static async updateStaffPassword(staffId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Client-side validation
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
      }

      const updatePasswordFn = httpsCallable<
        { staffId: string; newPassword: string },
        { success: boolean; message: string }
      >(functions, 'updateStaffPassword');

      // Add timeout to prevent hanging (30s)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 30000);
      });

      const result = await Promise.race([
        updatePasswordFn({ staffId, newPassword }),
        timeoutPromise
      ]);

      return result.data;
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.message === 'TIMEOUT') {
        throw new Error('Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại sau.');
      }
      throw new Error(error.message || 'Có lỗi xảy ra khi đổi mật khẩu.');
    }
  }

  // Create account for existing staff (admin only - uses Cloud Function)
  static async createStaffAccount(
    staffId: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string; uid?: string }> {
    try {
      // Client-side validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        throw new Error('Email không hợp lệ');
      }
      if (!password || password.length < 6) {
        throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
      }

      const createAccountFn = httpsCallable<
        { staffId: string; email: string; password: string },
        { success: boolean; message: string; uid?: string }
      >(functions, 'createStaffAccount');

      // Add timeout to prevent hanging (30s)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 30000);
      });

      const result = await Promise.race([
        createAccountFn({ staffId, email, password }),
        timeoutPromise
      ]);

      return result.data;
    } catch (error: any) {
      console.error('Error creating account:', error);
      if (error.message === 'TIMEOUT') {
        throw new Error('Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại sau.');
      }
      throw new Error(error.message || 'Có lỗi xảy ra khi tạo tài khoản.');
    }
  }
}
