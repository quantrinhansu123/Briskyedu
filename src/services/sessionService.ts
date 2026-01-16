/**
 * Session Service
 * Quản lý buổi học (Class Sessions)
 * Mỗi buổi học được tạo tự động từ lịch học của lớp
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ClassSession {
  id?: string;
  classId: string;
  className: string;
  sessionNumber: number; // Buổi thứ mấy
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Thứ 2, Thứ 3, etc.
  time?: string; // 18:00-19:30
  room?: string;
  teacherId?: string;
  teacherName?: string;
  status: 'Chưa học' | 'Đã học' | 'Nghỉ' | 'Học bù';
  attendanceId?: string; // Link to attendance record if taken
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

const COLLECTION_NAME = 'classSessions';

// Vietnamese day name mapping
const DAY_MAP: Record<string, number> = {
  'chủ nhật': 0, 'cn': 0,
  'thứ 2': 1, 'thứ hai': 1, 't2': 1,
  'thứ 3': 2, 'thứ ba': 2, 't3': 2,
  'thứ 4': 3, 'thứ tư': 3, 't4': 3,
  'thứ 5': 4, 'thứ năm': 4, 't5': 4,
  'thứ 6': 5, 'thứ sáu': 5, 't6': 5,
  'thứ 7': 6, 'thứ bảy': 6, 't7': 6,
};

const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/**
 * Parse schedule string to get days of week
 * Examples: "Thứ 2, 4, 6 (18h-19h30)", "T3, T5", "Thứ hai, Thứ tư"
 */
export const parseScheduleDays = (schedule: string): number[] => {
  if (!schedule) return [];
  
  const scheduleLower = schedule.toLowerCase();
  const days: Set<number> = new Set();
  
  // Check for Vietnamese day names
  for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
    if (scheduleLower.includes(dayName)) {
      days.add(dayNum);
    }
  }
  
  // Check for number format: "2, 4, 6" or "Thứ 2, 4"
  const numberMatches = schedule.match(/\b([2-7])\b/g);
  if (numberMatches) {
    numberMatches.forEach(num => {
      const n = parseInt(num);
      if (n >= 2 && n <= 7) {
        days.add(n === 7 ? 6 : n - 1); // Convert to JS day (0-6)
      }
    });
  }
  
  return Array.from(days).sort();
};

/**
 * Parse time from schedule string
 * Examples: "(18h-19h30)", "18:00-19:30"
 */
export const parseScheduleTime = (schedule: string): string | null => {
  if (!schedule) return null;
  
  // Match patterns like "18h-19h30", "18:00-19:30", "(18h-19h30)"
  const timeMatch = schedule.match(/(\d{1,2})[h:]?(\d{0,2})?\s*[-–]\s*(\d{1,2})[h:]?(\d{0,2})?/);
  if (timeMatch) {
    const startHour = timeMatch[1].padStart(2, '0');
    const startMin = (timeMatch[2] || '00').padStart(2, '0');
    const endHour = timeMatch[3].padStart(2, '0');
    const endMin = (timeMatch[4] || '00').padStart(2, '0');
    return `${startHour}:${startMin}-${endHour}:${endMin}`;
  }
  
  return null;
};

/**
 * Generate sessions for a class based on schedule
 */
export const generateSessionsForClass = async (
  classData: {
    id: string;
    name: string;
    schedule?: string;
    startDate?: string;
    endDate?: string;
    room?: string;
    teacherId?: string;
    teacherName?: string;
    totalSessions?: number;
  },
  options?: {
    fromDate?: Date;
    toDate?: Date;
    maxSessions?: number;
  }
): Promise<ClassSession[]> => {
  const { schedule, startDate, endDate } = classData;
  
  if (!schedule) {
    console.warn(`Class ${classData.name} has no schedule defined`);
    return [];
  }
  
  const scheduleDays = parseScheduleDays(schedule);
  if (scheduleDays.length === 0) {
    console.warn(`Could not parse schedule for class ${classData.name}: ${schedule}`);
    return [];
  }
  
  const time = parseScheduleTime(schedule);
  
  // Determine date range
  const fromDate = options?.fromDate || (startDate ? new Date(startDate) : new Date());
  const toDate = options?.toDate || (endDate ? new Date(endDate) : new Date(fromDate.getTime() + 90 * 24 * 60 * 60 * 1000)); // Default 90 days
  const maxSessions = options?.maxSessions || classData.totalSessions || 50;
  
  const sessions: ClassSession[] = [];
  let currentDate = new Date(fromDate);
  let sessionNumber = 1;
  
  while (currentDate <= toDate && sessionNumber <= maxSessions) {
    const dayOfWeek = currentDate.getDay();
    
    if (scheduleDays.includes(dayOfWeek)) {
      sessions.push({
        classId: classData.id,
        className: classData.name,
        sessionNumber,
        date: currentDate.toISOString().split('T')[0],
        dayOfWeek: DAY_NAMES[dayOfWeek],
        time: time || undefined,
        room: classData.room,
        teacherId: classData.teacherId,
        teacherName: classData.teacherName,
        status: 'Chưa học',
        createdAt: new Date().toISOString(),
      });
      sessionNumber++;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return sessions;
};

/**
 * Save generated sessions to Firestore
 */
export const saveSessionsToFirestore = async (sessions: ClassSession[]): Promise<number> => {
  if (sessions.length === 0) return 0;
  
  const batch = writeBatch(db);
  let count = 0;
  
  for (const session of sessions) {
    const docRef = doc(collection(db, COLLECTION_NAME));
    batch.set(docRef, {
      ...session,
      createdAt: new Date().toISOString(),
    });
    count++;
    
    // Firestore batch limit is 500
    if (count % 400 === 0) {
      await batch.commit();
    }
  }
  
  await batch.commit();
  return count;
};

/**
 * Get sessions for a class
 */
export const getSessionsByClass = async (
  classId: string,
  options?: {
    status?: ClassSession['status'];
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }
): Promise<ClassSession[]> => {
  try {
    // Query without orderBy to avoid index requirements, sort client-side
    const q = query(
      collection(db, COLLECTION_NAME),
      where('classId', '==', classId)
    );

    const snapshot = await getDocs(q);
    let sessions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ClassSession[];

    // Sort by date client-side
    sessions.sort((a, b) => a.date.localeCompare(b.date));

    // Filter out invalid sessions (sessionNumber <= 0)
    sessions = sessions.filter(s => s.sessionNumber > 0);

    // Client-side filtering
    if (options?.status) {
      sessions = sessions.filter(s => s.status === options.status);
    }
    if (options?.fromDate) {
      sessions = sessions.filter(s => s.date >= options.fromDate!);
    }
    if (options?.toDate) {
      sessions = sessions.filter(s => s.date <= options.toDate!);
    }
    if (options?.limit) {
      sessions = sessions.slice(0, options.limit);
    }

    return sessions;
  } catch (error) {
    console.error('Error getting sessions for class', classId, ':', error);
    throw error;
  }
};

/**
 * Get pending sessions (not yet attended) - includes past sessions that weren't marked
 */
export const getUpcomingSessions = async (
  classId: string,
  limit: number = 10
): Promise<ClassSession[]> => {
  // Get all "Chưa học" sessions, including past ones for makeup attendance
  return getSessionsByClass(classId, {
    status: 'Chưa học',
    limit,
  });
};

/**
 * Get all pending sessions across all classes
 */
export const getAllPendingSessions = async (
  options?: { classIds?: string[]; fromDate?: string; toDate?: string }
): Promise<ClassSession[]> => {
  try {
    const today = options?.fromDate || new Date().toISOString().split('T')[0];
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'Chưa học'),
      where('date', '>=', today),
      orderBy('date', 'asc')
    );
    
    const snapshot = await getDocs(q);
    let sessions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ClassSession[];
    
    if (options?.classIds && options.classIds.length > 0) {
      sessions = sessions.filter(s => options.classIds!.includes(s.classId));
    }
    if (options?.toDate) {
      sessions = sessions.filter(s => s.date <= options.toDate!);
    }
    
    return sessions;
  } catch (error) {
    console.error('Error getting pending sessions:', error);
    throw error;
  }
};

/**
 * Update session status (after attendance)
 */
export const updateSessionStatus = async (
  sessionId: string,
  status: ClassSession['status'],
  attendanceId?: string
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, sessionId);
    await updateDoc(docRef, {
      status,
      attendanceId: attendanceId || null,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating session:', error);
    throw error;
  }
};

/**
 * Delete sessions for a class
 */
export const deleteSessionsByClass = async (classId: string): Promise<number> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('classId', '==', classId)
    );
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    return snapshot.size;
  } catch (error) {
    console.error('Error deleting sessions:', error);
    throw error;
  }
};

/**
 * Check if session exists for class + date
 */
export const getSessionByClassAndDate = async (
  classId: string,
  date: string
): Promise<ClassSession | null> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('classId', '==', classId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as ClassSession;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

/**
 * Add a makeup session
 */
export const addMakeupSession = async (
  classData: { id: string; name: string; teacherId?: string; teacherName?: string; room?: string },
  date: string,
  time?: string,
  note?: string
): Promise<string> => {
  try {
    const dayOfWeek = new Date(date).getDay();
    
    // Get last session number for this class
    const sessions = await getSessionsByClass(classData.id);
    const maxSessionNum = sessions.reduce((max, s) => Math.max(max, s.sessionNumber || 0), 0);
    
    const session: Omit<ClassSession, 'id'> = {
      classId: classData.id,
      className: classData.name,
      sessionNumber: maxSessionNum + 1,
      date,
      dayOfWeek: DAY_NAMES[dayOfWeek],
      time,
      room: classData.room,
      teacherId: classData.teacherId,
      teacherName: classData.teacherName,
      status: 'Học bù',
      note: note || 'Buổi học bù',
      createdAt: new Date().toISOString(),
    };
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), session);
    return docRef.id;
  } catch (error) {
    console.error('Error adding makeup session:', error);
    throw error;
  }
};
