/**
 * Batch Query Utilities
 * Efficiently batch Firestore queries to avoid N+1 problems
 */

import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Split array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch fetch documents by IDs
 * Firestore `in` query limit is 30 items, so we chunk accordingly
 *
 * @param collectionName - Firestore collection name
 * @param ids - Array of document IDs to fetch
 * @returns Map of id -> document data
 */
export async function batchGetByIds<T extends { id: string }>(
  collectionName: string,
  ids: string[]
): Promise<Map<string, T>> {
  if (ids.length === 0) return new Map();

  const results = new Map<string, T>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  // Firestore `in` query limit is 30
  const chunks = chunkArray(uniqueIds, 30);

  const promises = chunks.map(async (chunk) => {
    const q = query(
      collection(db, collectionName),
      where(documentId(), 'in', chunk)
    );
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(doc => {
      results.set(doc.id, { id: doc.id, ...doc.data() } as T);
    });
  });

  await Promise.all(promises);

  return results;
}

/**
 * Batch fetch documents by a field value
 * Useful for fetching related documents (e.g., all students in a class)
 *
 * @param collectionName - Firestore collection name
 * @param fieldName - Field to query
 * @param values - Array of values to match
 * @returns Map of fieldValue -> documents array
 */
export async function batchGetByField<T extends Record<string, unknown>>(
  collectionName: string,
  fieldName: string,
  values: string[]
): Promise<Map<string, T[]>> {
  if (values.length === 0) return new Map();

  const results = new Map<string, T[]>();
  const uniqueValues = [...new Set(values.filter(Boolean))];

  // Initialize empty arrays for each value
  uniqueValues.forEach(v => results.set(v, []));

  // Firestore `in` query limit is 30
  const chunks = chunkArray(uniqueValues, 30);

  const promises = chunks.map(async (chunk) => {
    const q = query(
      collection(db, collectionName),
      where(fieldName, 'in', chunk)
    );
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(doc => {
      const data = { id: doc.id, ...doc.data() } as T;
      const fieldValue = data[fieldName] as string;
      const existing = results.get(fieldValue) || [];
      existing.push(data);
      results.set(fieldValue, existing);
    });
  });

  await Promise.all(promises);

  return results;
}

/**
 * Enrich documents with related data
 * Useful for adding class names to students, etc.
 *
 * @param documents - Array of documents to enrich
 * @param relatedCollection - Collection to fetch related data from
 * @param foreignKey - Field in documents containing the related ID
 * @param enrichKey - Key to add the enriched data under
 * @returns Enriched documents
 */
export async function enrichWithRelated<
  T extends Record<string, unknown>,
  R extends { id: string }
>(
  documents: T[],
  relatedCollection: string,
  foreignKey: keyof T,
  enrichKey: string
): Promise<(T & Record<string, R | undefined>)[]> {
  const relatedIds = documents
    .map(doc => doc[foreignKey] as string)
    .filter(Boolean);

  const relatedMap = await batchGetByIds<R>(relatedCollection, relatedIds);

  return documents.map(doc => ({
    ...doc,
    [enrichKey]: relatedMap.get(doc[foreignKey] as string)
  }));
}
