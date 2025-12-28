# EduManager Pro - Code Standards

**Last Updated**: December 28, 2025

## Overview

This document defines code standards and best practices for the EduManager Pro project. All developers must follow these standards to maintain code quality, consistency, and architectural integrity across the three-layer pattern (Services → Hooks → Pages).

## TypeScript Standards

### Type Definitions

**Single Source of Truth**: Tất cả interfaces được định nghĩa trong `types.ts`

```typescript
// ✅ Good - Define in types.ts
export interface Student {
  id: string;
  code: string;
  fullName: string;
  status: StudentStatus;
  // ...
}

// ❌ Bad - Don't define types inline in components
const student: { id: string; name: string } = {...};
```

### Enums

Sử dụng string enums với giá trị tiếng Việt:

```typescript
export enum StudentStatus {
  ACTIVE = 'Đang học',
  DEBT = 'Nợ phí',
  RESERVED = 'Bảo lưu',
  DROPPED = 'Nghỉ học',
  TRIAL = 'Học thử',
}
```

### Strict Typing

```typescript
// ✅ Good - Explicit types
const students: Student[] = [];
const loading: boolean = true;

// ❌ Bad - Implicit any
const data = fetchData();
```

## Service Layer Standards

### Pattern: Static Class Methods

```typescript
export class StudentService {
  // ✅ Static methods - no instantiation needed
  static async getStudents(): Promise<Student[]> {
    const snapshot = await getDocs(collection(db, 'students'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Student[];
  }

  static async updateStudent(id: string, data: Partial<Student>): Promise<void> {
    await updateDoc(doc(db, 'students', id), data);
  }
}

// Usage
const students = await StudentService.getStudents();
```

### Error Handling

```typescript
static async deleteStudent(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'students', id));
  } catch (error) {
    console.error('Error deleting student:', error);
    throw new Error('Không thể xóa học viên. Vui lòng thử lại.');
  }
}
```

### Timestamp Conversion

```typescript
// Reading from Firestore
const student = {
  ...doc.data(),
  dob: doc.data().dob?.toDate?.()?.toISOString() || doc.data().dob || '',
  createdAt: doc.data().createdAt?.toDate?.()?.toISOString()
};

// Writing to Firestore
import { Timestamp } from 'firebase/firestore';
await addDoc(collection(db, 'students'), {
  ...studentData,
  dob: Timestamp.fromDate(new Date(studentData.dob)),
  createdAt: Timestamp.now()
});
```

## Hook Layer Standards

### Pattern: Return { data, loading, error }

```typescript
export const useStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'students'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Student[];
        setStudents(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { students, loading, error };
};
```

### Real-time Listeners

```typescript
// ✅ Good - Use onSnapshot for real-time
useEffect(() => {
  const unsubscribe = onSnapshot(query(...), callback);
  return () => unsubscribe();
}, []);

// ❌ Bad - One-time fetch (use only when necessary)
useEffect(() => {
  getDocs(query(...)).then(callback);
}, []);
```

## Component Standards

### Functional Components with TypeScript

```typescript
interface StudentCardProps {
  student: Student;
  onEdit?: (student: Student) => void;
  canDelete?: boolean;
}

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  onEdit,
  canDelete = false
}) => {
  return (
    <div className="p-4 border rounded">
      <h3>{student.fullName}</h3>
      {onEdit && (
        <button onClick={() => onEdit(student)}>Sửa</button>
      )}
    </div>
  );
};
```

### Page Components

```typescript
export const StudentManager: React.FC = () => {
  // 1. Hooks first
  const { students, loading, error } = useStudents();
  const { hasPermission } = usePermissions();

  // 2. Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // 3. Computed values
  const filteredStudents = useMemo(() =>
    students.filter(s => s.fullName.includes(searchTerm)),
    [students, searchTerm]
  );

  // 4. Event handlers
  const handleEdit = useCallback((student: Student) => {
    setSelectedStudent(student);
  }, []);

  // 5. Loading/error states
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  // 6. Main render
  return (
    <div>
      {/* ... */}
    </div>
  );
};
```

## Styling Standards

### TailwindCSS Classes

```tsx
// ✅ Good - Consistent spacing, colors
<div className="p-4 bg-white rounded-lg shadow">
  <h2 className="text-lg font-semibold text-gray-900">Title</h2>
  <p className="mt-2 text-sm text-gray-600">Description</p>
</div>

// ❌ Bad - Inline styles
<div style={{ padding: '16px', backgroundColor: 'white' }}>
```

### Color Palette

```
Primary:   indigo-600 (buttons, links)
Success:   green-600
Warning:   yellow-600
Error:     red-600
Text:      gray-900 (headings), gray-600 (body), gray-500 (muted)
Background: gray-50 (page), white (cards)
```

### Responsive Design

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid */}
</div>
```

## Naming Conventions

### Files

```
services/studentService.ts     # camelCase for services
hooks/useStudents.ts           # useXxx for hooks
pages/StudentManager.tsx       # PascalCase for pages
components/StudentCard.tsx     # PascalCase for components
utils/currencyUtils.ts         # camelCase with Utils suffix
```

### Variables & Functions

```typescript
// Variables: camelCase
const studentList = [];
const isLoading = true;

// Functions: camelCase, verb prefix
const handleSubmit = () => {};
const fetchStudents = async () => {};
const calculateTotal = () => {};

// Boolean: is/has/can prefix
const isActive = true;
const hasPermission = true;
const canEdit = true;
```

### Constants

```typescript
const MAX_STUDENTS_PER_CLASS = 30;
const DEFAULT_PAGE_SIZE = 20;
```

## Import Order

```typescript
// 1. React
import React, { useState, useEffect, useCallback } from 'react';

// 2. Third-party libraries
import { collection, query, onSnapshot } from 'firebase/firestore';

// 3. Internal modules (absolute paths)
import { db } from '@/src/config/firebase';
import { Student, StudentStatus } from '@/types';

// 4. Services & Hooks
import { StudentService } from '@/src/services/studentService';
import { useStudents } from '@/src/hooks/useStudents';

// 5. Components
import { StudentCard } from '@/components/StudentCard';

// 6. Utils & Constants
import { formatCurrency } from '@/src/utils/currencyUtils';
```

## Shared Utility Modules

The project includes comprehensive utility modules for common operations across features.

### Date Utilities (`src/utils/dateUtils.ts`)

Handles safe date formatting for various input types (Firestore Timestamps, Date objects, ISO strings):

```typescript
import {
  formatDateSafe,        // Convert any date format to YYYY-MM-DD
  formatDisplayDate,     // Vietnamese format (DD/MM/YYYY)
  formatDisplayDateTime, // Vietnamese format with time
  getRelativeTime        // Relative time display ("2 giờ trước")
} from '@/src/utils/dateUtils';

// Usage
const formatted = formatDateSafe(firebaseTimestamp);
const display = formatDisplayDate(student.dob);
const relative = getRelativeTime(student.createdAt); // "2 giờ trước"
```

**Features:**
- Safe handling of Firestore Timestamps with `.toDate()` method
- Fallback for string dates and Date objects
- Vietnamese localization for date/time display
- Prevents invalid date errors with try-catch

### Status Utilities (`src/utils/statusUtils.ts`)

Normalize student and class statuses with legacy data compatibility:

```typescript
import {
  normalizeStudentStatus,  // Convert various formats to enum
  getStudentStatusColor,   // Get Tailwind CSS classes
  getClassStatusColor,     // Get Tailwind CSS classes
  getStatusLabel           // Get status display text
} from '@/src/utils/statusUtils';

// Usage - handles legacy data format conversion
const status = normalizeStudentStatus('Đang học'); // Returns StudentStatus.ACTIVE
const status2 = normalizeStudentStatus('active');  // English legacy support
const color = getStudentStatusColor(StudentStatus.ACTIVE);
// Returns: 'bg-green-100 text-green-800'
```

**Features:**
- Legacy English format support ('active', 'debt', 'reserved')
- Vietnamese format support ('Đang học', 'Nợ phí', 'Bảo lưu')
- Tailwind CSS color classes for UI display
- Default safe fallback values

### Validators (`src/utils/validators.ts`)

Comprehensive input validation utilities:

```typescript
import {
  isValidEmail,
  isValidPhoneNumber,
  isValidStudentCode,
  isValidISODate
} from '@/src/utils/validators';

// Usage
if (!isValidEmail(email)) {
  throw new Error('Email không hợp lệ');
}

if (!isValidPhoneNumber(phone)) {
  throw new Error('Số điện thoại không hợp lệ');
}

// In forms - validate before submission
const isFormValid = isValidEmail(formData.email) &&
                   isValidPhoneNumber(formData.phone);
```

### Error Utilities (`src/utils/errorUtils.ts`)

Convert Firebase errors to user-friendly Vietnamese messages:

```typescript
import { getUserFriendlyError } from '@/src/utils/errorUtils';

// Usage in service layer
try {
  await StudentService.deleteStudent(id);
} catch (error) {
  const message = getUserFriendlyError(error);
  console.error(message); // "Không thể xóa học viên. Vui lòng thử lại."
  throw new Error(message);
}
```

### Firestore Utilities (`src/utils/firestoreUtils.ts`)

Consistent Firestore data handling:

```typescript
import {
  normalizeTimestamp,
  createTimestamp,
  extractDocData
} from '@/src/utils/firestoreUtils';

// Usage
const normalizedData = extractDocData(firestoreDoc);
const timestamp = createTimestamp(new Date());
```

### Batch Queries (`src/utils/batchQueries.ts`)

Efficient batch operations for Firestore:

```typescript
import { batchFetchStudents } from '@/src/utils/batchQueries';

// Usage - fetch multiple documents efficiently
const allStudents = await batchFetchStudents(studentIds);
```

### Existing Utilities

- `currencyUtils.ts` - VND currency formatting with thousand separators
- `excelUtils.ts` - Excel import/export functionality
- `scheduleUtils.ts` - Schedule/class schedule parsing and handling

## Custom React Hooks

### Modal State Management (`useModalState.ts`)

```typescript
import { useModalState } from '@/src/hooks/useModalState';

// Usage
const { isOpen, open, close, toggle } = useModalState(false);

// In component
{isOpen && <Modal onClose={close}>Modal Content</Modal>}
<button onClick={open}>Open Modal</button>
<button onClick={close}>Close Modal</button>
<button onClick={toggle}>Toggle Modal</button>
```

**Features:**
- Type-safe modal state management
- Simple open/close/toggle API
- Optional initial state parameter
- Clean state management without external libraries

### Debounce Hook (`useDebounce.ts`)

```typescript
import { useDebounce } from '@/src/hooks/useDebounce';

// Usage - debounce search input (prevents excessive API calls)
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebounce(searchTerm, 300);

useEffect(() => {
  // This effect runs only after 300ms of no changes to searchTerm
  if (debouncedSearchTerm) {
    performSearch(debouncedSearchTerm);
  }
}, [debouncedSearchTerm]);

// In JSX
<input
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  placeholder="Search students..."
/>
```

**Features:**
- Configurable delay in milliseconds
- Prevents excessive function calls (throttling for search, autocomplete)
- Perfect for search inputs, API calls, auto-save features
- Reduces server load and improves UX

## Feature Folder Structure

The project organizes feature-specific code in dedicated folders:

```
src/features/
├── classes/
│   ├── hooks/
│   │   └── useClassManager.ts      # Class management logic
│   └── index.ts
├── students/
│   ├── hooks/
│   │   └── useStudentManager.ts    # Student management logic
│   └── index.ts
```

**Benefits:**
- Encapsulation of feature-specific logic
- Easier to locate related code
- Scalable for large features
- Clear separation of concerns

## Comments

```typescript
// ✅ Good - Explain WHY, not WHAT
// Skip students with negative remaining sessions as they have debt
const activeStudents = students.filter(s => s.remainingSessions >= 0);

// ❌ Bad - Obvious comment
// Loop through students
students.forEach(student => {...});
```

## Error Messages

```typescript
// ✅ Good - Vietnamese, helpful message
throw new Error('Không thể xóa học viên. Vui lòng thử lại.');

// ❌ Bad - English or generic
throw new Error('Error deleting student');
```

## Testing Standards

### Test File Structure

```typescript
import { describe, it, expect, vi } from 'vitest';
import { StudentService } from './studentService';

describe('StudentService', () => {
  describe('getStudents', () => {
    it('should return all students', async () => {
      // Arrange
      const mockStudents = [{ id: '1', fullName: 'Test' }];

      // Act
      const result = await StudentService.getStudents();

      // Assert
      expect(result).toEqual(mockStudents);
    });
  });
});
```

### Mock Firebase

```typescript
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
}));
```

### Test Coverage

The project includes **155+ comprehensive tests** organized by layer:

- **Services** (8 test files): CRUD operations, data validation, error handling
- **Hooks** (2 test files): Real-time listeners, state management, effect cleanup
- **Utilities** (3 test files): Date formatting, status normalization, input validation
- **Permissions** (1 test file): Role-based access control, security

Run coverage report:
```bash
npm run test:coverage
```

## Git Commit Messages

```
feat: Add student import from Excel
fix: Fix attendance calculation for reserved students
refactor: Extract student card into separate component
docs: Update API documentation
test: Add tests for StudentService
```

## Security Best Practices

1. **Never expose API keys** in client code (use environment variables)
2. **Validate all inputs** before sending to Firestore
3. **Use Firestore rules** for server-side validation
4. **Sanitize user input** to prevent XSS
5. **Check permissions** before sensitive operations

## Accessibility Standards

1. **Semantic HTML** - Use proper semantic tags (button, form, etc.)
2. **ARIA Labels** - Add aria-label for icons and interactive elements
3. **Keyboard Navigation** - Ensure all interactive elements are keyboard accessible
4. **Color Contrast** - Maintain WCAG AA contrast ratios
5. **Alt Text** - Provide meaningful descriptions for images

## Architecture Pattern Summary

### Services Layer Pattern
- **Location**: `/src/services/`
- **File Count**: 28 services
- **Implementation**: Static class methods (no instantiation)
- **Responsibility**: Firestore CRUD, business logic
- **Return Type**: Promise<T> or void (no React hooks)
- **Key Constraint**: No side effects, pure functions preferred

### Hooks Layer Pattern
- **Location**: `/src/hooks/`
- **File Count**: 29 hooks
- **Implementation**: React custom hooks with useEffect
- **Responsibility**: Real-time listeners, state management
- **Return Pattern**: `{ data: T[], loading: boolean, error: string | null }`
- **Key Constraint**: Must use onSnapshot for real-time updates

### Pages Layer Pattern
- **Location**: `/pages/`
- **File Count**: 37 pages (7 domains)
- **Implementation**: Functional React components
- **Responsibility**: UI rendering, user interactions
- **Data Source**: Consume hooks exclusively
- **Code Splitting**: All pages lazy-loaded with React.lazy()

## Critical Pattern Violations to Avoid

1. **Service Layer**: Never use React hooks in services
2. **Hook Layer**: Prefer onSnapshot over getDocs for dynamic data
3. **Pages Layer**: Never import from services directly (always use hooks)
4. **Types**: Always define types in `types.ts`, not inline
5. **Timestamps**: Use centralized timestamp conversion utilities

## Technical Debt / Known Issues

Based on the latest codebase review (December 28, 2025):

-   **Quality Score**: 6.5/10 - Indicating areas for improvement across the codebase.
-   **Security**: There are identified weaknesses in current Firestore rules and some areas lack explicit permission checks, which need to be addressed to prevent unauthorized access or data manipulation.
-   **DRY Violations (Timestamp Conversion & Query Building)**: The codebase exhibits duplication in handling Firestore Timestamp conversions and constructing Firestore queries. This leads to redundant code and increased maintenance effort. A centralized utility or helper functions should be implemented to abstract these common operations.
-   **Hooks Consistency**: There's an inconsistency in the `src/hooks/` layer regarding data fetching patterns. Some hooks utilize `onSnapshot` for real-time updates (preferred), while others perform one-time `getDocs` fetches. This mixed approach can lead to unpredictable UI behavior and make debugging more challenging. A consistent approach favoring real-time listeners for dynamic data should be adopted where appropriate.