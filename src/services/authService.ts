import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
          staffData: staffDoc.data()
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
  
  // Register new staff with email and password
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
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name
      await updateProfile(user, {
        displayName: staffData.name
      });

      // Determine permissions based on role
      const isAdmin = staffData.role === 'Quản trị viên' || staffData.role === 'Quản lý';

      // Create staff document in Firestore with UID as document ID
      await setDoc(doc(db, 'staff', user.uid), {
        uid: user.uid,
        email: email,
        name: staffData.name,
        code: staffData.code,
        role: staffData.role,
        roles: staffData.roles || [staffData.role],
        department: staffData.department,
        position: staffData.position,
        phone: staffData.phone,
        dob: staffData.dob || '',
        startDate: staffData.startDate || new Date().toISOString().split('T')[0],
        branch: staffData.branch || '',
        status: 'Active',
        permissions: {
          canManageStudents: isAdmin,
          canManageClasses: isAdmin,
          canManageStaff: isAdmin,
          canManageFinance: isAdmin,
          canViewReports: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return user.uid;
    } catch (error) {
      console.error('Register error:', error);
      throw new Error(sanitizeFirebaseError(error));
    }
  }
  
  // Get current user
  static getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }
  
  // Listen to auth state changes
  static onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch staff data
        const staffDoc = await getDoc(doc(db, 'staff', user.uid));
        if (staffDoc.exists()) {
          callback({
            ...user,
            role: staffDoc.data().role,
            staffData: staffDoc.data()
          } as AuthUser);
        } else {
          callback(user as AuthUser);
        }
      } else {
        callback(null);
      }
    });
  }

  // Update staff password (admin only - uses Cloud Function)
  static async updateStaffPassword(staffId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const updatePasswordFn = httpsCallable<
        { staffId: string; newPassword: string },
        { success: boolean; message: string }
      >(functions, 'updateStaffPassword');

      const result = await updatePasswordFn({ staffId, newPassword });
      return result.data;
    } catch (error: any) {
      console.error('Error updating password:', error);
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
      const createAccountFn = httpsCallable<
        { staffId: string; email: string; password: string },
        { success: boolean; message: string; uid?: string }
      >(functions, 'createStaffAccount');

      const result = await createAccountFn({ staffId, email, password });
      return result.data;
    } catch (error: any) {
      console.error('Error creating account:', error);
      throw new Error(error.message || 'Có lỗi xảy ra khi tạo tài khoản.');
    }
  }
}
