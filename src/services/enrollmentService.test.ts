import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnrollmentRecord } from '../../types';

// Define mocks with hoisting compatible approach
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', async () => {
  return {
    collection: vi.fn((...args: unknown[]) => mockCollection(...args)),
    getDocs: vi.fn((...args: unknown[]) => mockGetDocs(...args)),
    addDoc: vi.fn((...args: unknown[]) => mockAddDoc(...args)),
    query: vi.fn((...args: unknown[]) => mockQuery(...args)),
    where: vi.fn((...args: unknown[]) => mockWhere(...args)),
    Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })) },
    doc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    orderBy: vi.fn()
  };
});

vi.mock('../config/firebase', () => ({
  db: {}
}));

// Import after mocking
import {
  checkDuplicateEnrollment,
  createEnrollment
} from './enrollmentService';

describe('Enrollment Service - Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReturnValue({});
    mockWhere.mockReturnValue({});
    mockCollection.mockReturnValue({});
  });

  describe('checkDuplicateEnrollment', () => {
    it('should return null if studentId is undefined', async () => {
      const result = await checkDuplicateEnrollment(undefined, 'contract123');
      expect(result).toBeNull();
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('should return null if contractId is undefined', async () => {
      const result = await checkDuplicateEnrollment('student123', undefined);
      expect(result).toBeNull();
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('should return null if no duplicate found', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: []
      });

      const result = await checkDuplicateEnrollment('student123', 'contract456');

      expect(result).toBeNull();
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should return existing enrollment if duplicate found', async () => {
      const existingEnrollment = {
        id: 'existing123',
        data: () => ({
          studentId: 'student123',
          contractId: 'contract456',
          studentName: 'Test Student',
          type: 'Hợp đồng mới'
        })
      };

      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [existingEnrollment]
      });

      const result = await checkDuplicateEnrollment('student123', 'contract456');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('existing123');
      expect(result?.studentId).toBe('student123');
    });

    it('should return null and log error if query fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetDocs.mockRejectedValueOnce(new Error('Query failed'));

      const result = await checkDuplicateEnrollment('student123', 'contract456');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error checking duplicate enrollment:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createEnrollment', () => {
    const newEnrollmentData: Omit<EnrollmentRecord, 'id'> = {
      studentId: 'student123',
      studentName: 'Test Student',
      studentCode: 'TS001',
      classId: 'class456',
      className: 'Lớp A',
      contractCode: 'CTR001',
      contractId: 'contract789',
      contractValue: 5000000,
      sessions: 20,
      type: 'Hợp đồng mới',
      createdDate: '29/12/2025',
      notes: '',
      status: 'Đang học'
    };

    it('should return existing ID if duplicate enrollment found', async () => {
      const existingEnrollment = {
        id: 'existingId123',
        data: () => ({
          studentId: 'student123',
          contractId: 'contract789',
          studentName: 'Test Student',
          type: 'Hợp đồng mới'
        })
      };

      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [existingEnrollment]
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await createEnrollment(newEnrollmentData);

      expect(result).toBe('existingId123');
      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Enrollment already exists')
      );

      warnSpy.mockRestore();
    });

    it('should create new enrollment if no duplicate exists', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: []
      });

      mockAddDoc.mockResolvedValueOnce({ id: 'newId456' });

      const result = await createEnrollment(newEnrollmentData);

      expect(result).toBe('newId456');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should skip duplicate check and create if contractId is missing', async () => {
      const dataWithoutContract = {
        ...newEnrollmentData,
        contractId: undefined
      };

      mockAddDoc.mockResolvedValueOnce({ id: 'newId789' });

      const result = await createEnrollment(dataWithoutContract as Omit<EnrollmentRecord, 'id'>);

      expect(result).toBe('newId789');
      // Should not query for duplicates when contractId is undefined
      expect(mockGetDocs).not.toHaveBeenCalled();
      expect(mockAddDoc).toHaveBeenCalled();
    });
  });
});
