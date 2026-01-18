/**
 * Session Collection Triggers
 * 
 * Handles:
 * - Update class progress when session status changes
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { SessionData } from '../types';

const db = admin.firestore();
const REGION = 'asia-southeast1';

/**
 * Trigger: When a session is updated
 * Actions:
 * - Update class progress when session marked as completed
 */
export const onSessionUpdate = functions
  .region(REGION)
  .firestore
  .document('classSessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const sessionId = context.params.sessionId;
    const before = change.before.data() as SessionData;
    const after = change.after.data() as SessionData;

    // Only process if status changed
    if (before.status === after.status) {
      return null;
    }

    console.log(`[onSessionUpdate] Session ${sessionId} status: "${before.status}" → "${after.status}"`);

    // Update class progress
    await updateClassProgress(after.classId);

    return null;
  });

/**
 * Trigger: When a session is created
 * (Usually by onClassCreate, but could be manual)
 */
export const onSessionCreate = functions
  .region(REGION)
  .firestore
  .document('classSessions/{sessionId}')
  .onCreate(async (snap, context) => {
    const sessionData = snap.data() as SessionData;
    
    console.log(`[onSessionCreate] Session created for class ${sessionData.classId}`);

    // Update class progress
    await updateClassProgress(sessionData.classId);

    return null;
  });

/**
 * Trigger: When a session is deleted
 */
export const onSessionDelete = functions
  .region(REGION)
  .firestore
  .document('classSessions/{sessionId}')
  .onDelete(async (snap, context) => {
    const sessionData = snap.data() as SessionData;
    
    console.log(`[onSessionDelete] Session deleted from class ${sessionData.classId}`);

    // Update class progress
    await updateClassProgress(sessionData.classId);

    return null;
  });

/**
 * Helper: Update class progress based on sessions
 */
async function updateClassProgress(classId: string): Promise<void> {
  const sessionsSnapshot = await db
    .collection('classSessions')
    .where('classId', '==', classId)
    .get();

  const total = sessionsSnapshot.size;
  let completed = 0;

  sessionsSnapshot.forEach(doc => {
    const session = doc.data() as SessionData;
    if (session.status === 'Đã học') {
      completed++;
    }
  });

  const progress = `${completed}/${total}`;

  await db.collection('classes').doc(classId).update({
    completedSessions: completed,
    progress,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`[updateClassProgress] Class ${classId} progress: ${progress}`);
}
