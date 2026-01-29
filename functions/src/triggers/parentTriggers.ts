/**
 * Parent Collection Triggers
 *
 * Handles:
 * - Sync parent name/phone to linked students when parent is updated
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const REGION = 'asia-southeast1';

interface ParentData {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  relationship?: 'Bố' | 'Mẹ' | 'Ông/Bà' | 'Khác';
}

/**
 * Trigger: When a parent is updated
 * Actions:
 * - Sync parent name/phone to all linked students
 */
export const onParentUpdate = functions
  .region(REGION)
  .firestore
  .document('parents/{parentId}')
  .onUpdate(async (change, context) => {
    const parentId = context.params.parentId;
    const before = change.before.data() as ParentData;
    const after = change.after.data() as ParentData;

    console.log(`[onParentUpdate] Parent updated: ${after.name} (${parentId})`);

    // Check if name or phone changed
    const nameChanged = before.name !== after.name;
    const phoneChanged = before.phone !== after.phone;

    if (!nameChanged && !phoneChanged) {
      console.log(`[onParentUpdate] No name/phone changes - skipping sync`);
      return null;
    }

    console.log(`[onParentUpdate] Changes detected - name: ${nameChanged}, phone: ${phoneChanged}`);

    // Find all students linked to this parent
    const studentsSnapshot = await db
      .collection('students')
      .where('parentId', '==', parentId)
      .get();

    if (studentsSnapshot.empty) {
      console.log(`[onParentUpdate] No students found for parent ${parentId}`);
      return null;
    }

    console.log(`[onParentUpdate] Found ${studentsSnapshot.size} students to update`);

    // Batch update students
    const batch = db.batch();
    studentsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        parentName: after.name,
        parentPhone: after.phone,
      });
    });

    await batch.commit();
    console.log(`[onParentUpdate] Synced parent ${parentId} (${after.name}) to ${studentsSnapshot.size} students`);

    return null;
  });
