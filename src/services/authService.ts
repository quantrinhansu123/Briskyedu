import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { Staff } from '../../types';
import { sanitizeFirebaseError } from '../utils/errorUtils';

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
      
      // Create staff document in Firestore
      await setDoc(doc(db, 'staff', user.uid), {
        uid: user.uid,
        email: email,
        ...staffData,
        status: 'Active',
        permissions: {
          canManageStudents: staffData.role === 'Quản trị viên',
          canManageClasses: staffData.role === 'Quản trị viên',
          canManageStaff: staffData.role === 'Quản trị viên',
          canManageFinance: staffData.role === 'Quản trị viên',
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
}
