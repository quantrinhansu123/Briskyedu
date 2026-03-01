/**
 * Batch operation utilities
 * Firestore has a limit of 500 operations per batch
 */

import * as admin from 'firebase-admin';

const BATCH_SIZE = 500;

export interface BatchOperation {
  type: 'set' | 'update' | 'delete';
  ref: FirebaseFirestore.DocumentReference;
  data?: Record<string, any>;
}

/**
 * Execute batch operations, automatically splitting if > 500
 */
export async function executeBatch(operations: BatchOperation[]): Promise<number> {
  if (operations.length === 0) return 0;

  const db = admin.firestore();
  let totalProcessed = 0;

  // Split into chunks of BATCH_SIZE
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const chunk = operations.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const op of chunk) {
      switch (op.type) {
        case 'set':
          batch.set(op.ref, op.data!);
          break;
        case 'update':
          batch.update(op.ref, op.data!);
          break;
        case 'delete':
          batch.delete(op.ref);
          break;
      }
    }

    await batch.commit();
    totalProcessed += chunk.length;
  }

  return totalProcessed;
}

/**
 * Cascade update a field across multiple documents
 */
export async function cascadeUpdate(
  collection: string,
  queryField: string,
  queryValue: string,
  updateFields: Record<string, any>
): Promise<number> {
  const db = admin.firestore();
  
  const snapshot = await db
    .collection(collection)
    .where(queryField, '==', queryValue)
    .get();

  if (snapshot.empty) return 0;

  const operations: BatchOperation[] = snapshot.docs.map(doc => ({
    type: 'update' as const,
    ref: doc.ref,
    data: updateFields
  }));

  return executeBatch(operations);
}

/**
 * Delete all documents matching a query
 */
export async function cascadeDelete(
  collection: string,
  queryField: string,
  queryValue: string
): Promise<number> {
  const db = admin.firestore();

  const snapshot = await db
    .collection(collection)
    .where(queryField, '==', queryValue)
    .get();

  if (snapshot.empty) return 0;

  const operations: BatchOperation[] = snapshot.docs.map(doc => ({
    type: 'delete' as const,
    ref: doc.ref
  }));

  return executeBatch(operations);
}

/**
 * Cascade update với điều kiện date >= effectiveDate
 * Dùng khi đổi GV - chỉ update sessions từ ngày hiệu lực trở đi
 */
export async function cascadeUpdateFromDate(
  collectionName: string,
  classId: string,
  effectiveDate: string, // YYYY-MM-DD
  updateFields: Record<string, any>
): Promise<number> {
  const db = admin.firestore();

  const snapshot = await db
    .collection(collectionName)
    .where('classId', '==', classId)
    .where('date', '>=', effectiveDate)
    .get();

  if (snapshot.empty) return 0;

  const operations: BatchOperation[] = snapshot.docs.map(doc => ({
    type: 'update' as const,
    ref: doc.ref,
    data: updateFields
  }));

  return executeBatch(operations);
}
