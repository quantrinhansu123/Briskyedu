# EduManager Pro - System Architecture

**Last Updated**: December 28, 2025

## Overview

EduManager Pro uses a strict 3-layer architecture (Services → Hooks → Pages) with Firebase as the backend. This is a Single Page Application (SPA) with client-side rendering and real-time data synchronization. The system manages 35 Firestore collections across 7 domains via:
- **28 Services**: Static class methods for CRUD operations
- **27 Hooks**: Real-time listeners with onSnapshot pattern
- **36 Pages**: Domain-organized UI components

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    React 19 Application                      ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │   Pages     │  │  Components │  │      Router         │ ││
│  │  │  (36 pages) │  │  (shared)   │  │  (HashRouter)       │ ││
│  │  └──────┬──────┘  └─────────────┘  └─────────────────────┘ ││
│  │         │                                                    ││
│  │  ┌──────▼─────────────────────────────────────────────────┐ ││
│  │  │                    Hooks Layer                          │ ││
│  │  │  • Real-time listeners (onSnapshot)                     │ ││
│  │  │  • State management                                     │ ││
│  │  │  • Client-side filtering                                │ ││
│  │  └──────┬─────────────────────────────────────────────────┘ ││
│  │         │                                                    ││
│  │  ┌──────▼─────────────────────────────────────────────────┐ ││
│  │  │                   Services Layer                        │ ││
│  │  │  • Firestore CRUD operations                            │ ││
│  │  │  • Business logic                                       │ ││
│  │  │  • Static class methods                                 │ ││
│  │  └──────┬─────────────────────────────────────────────────┘ ││
│  └─────────┼───────────────────────────────────────────────────┘│
└────────────┼────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FIREBASE SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Firebase   │  │  Cloud      │  │      Cloud              │ │
│  │  Auth       │  │  Firestore  │  │      Functions          │ │
│  │             │  │  (NoSQL DB) │  │      (serverless)       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                  │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐  │
│  │  Cloud      │  │           Firebase Hosting               │  │
│  │  Storage    │  │           (Static hosting)               │  │
│  └─────────────┘  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Three-Layer Architecture

### Layer 1: Services (`src/services/`)

**Purpose**: Firestore CRUD operations và business logic

**Pattern**: Static class methods

```typescript
export class StudentService {
  static async getStudents(filters?: { status?: StudentStatus }): Promise<Student[]> {
    const q = query(collection(db, 'students'), where('status', '==', filters?.status));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
  }

  static async updateStudent(id: string, data: Partial<Student>): Promise<void> {
    await updateDoc(doc(db, 'students', id), data);
  }
}
```

**Key Services**:
- `studentService.ts` - Student CRUD
- `classService.ts` - Class management
- `attendanceService.ts` - Attendance tracking
- `contractService.ts` - Contract management
- `permissionService.ts` - Role-based access control

### Layer 2: Hooks (`src/hooks/`)

**Purpose**: React state management + real-time listeners

**Pattern**: Custom hooks với `{ data, loading, error }`

```typescript
export const useStudents = (filters?: { status?: StudentStatus }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { students, loading, error };
};
```

**Key Hooks**:
- `useStudents.ts` - Real-time student data
- `useClasses.ts` - Real-time class data
- `useAuth.ts` - Authentication state
- `usePermissions.tsx` - Permission checking

### Layer 3: Pages (`pages/`)

**Purpose**: UI rendering và user interactions

**Pattern**: Consume hooks, render UI

```typescript
export const StudentManager = () => {
  const { students, loading } = useStudents();
  const { hasPermission } = usePermissions();

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {students.map(student => (
        <StudentCard
          key={student.id}
          student={student}
          canEdit={hasPermission('students:edit')}
        />
      ))}
    </div>
  );
};
```

## Data Flow

```
┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│   Firestore  │ ──► │    Service    │ ──► │    Hook     │
│   (Database) │     │ (CRUD + Logic)│     │ (State)     │
└──────────────┘     └───────────────┘     └──────┬──────┘
       ▲                                          │
       │                                          ▼
       │                                   ┌─────────────┐
       │                                   │    Page     │
       │                                   │    (UI)     │
       │                                   └──────┬──────┘
       │                                          │
       └──────────────────────────────────────────┘
                    (User Actions)
```

## Real-time Updates

Hệ thống sử dụng Firestore `onSnapshot` cho real-time updates:

```typescript
// Data automatically updates across all components
const unsubscribe = onSnapshot(
  query(collection(db, 'students')),
  (snapshot) => {
    // Auto-update UI when data changes
    setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }
);
```

## Authentication & Authorization

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │ ──► │  Firebase   │ ──► │   useAuth   │
│   Page      │     │    Auth     │     │    Hook     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ Protected   │
                                        │   Route     │
                                        └─────────────┘
```

### Authorization (Role-Based)

```
┌─────────────────────────────────────────────────────────┐
│                    PERMISSION HIERARCHY                  │
├─────────────────────────────────────────────────────────┤
│  Quản trị viên (Admin)    → Full access                 │
│  Quản lý (Manager)        → Most features, no admin     │
│  Giáo viên (Teacher)      → Classes, attendance, salary │
│  Trợ giảng (Assistant)    → Limited class access        │
│  Nhân viên/Sale/Văn phòng → CRM, basic features         │
└─────────────────────────────────────────────────────────┘
```

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/staff/$(request.auth.uid))
          .data.role in ['Quản trị viên', 'Quản lý'];
    }

    function isStaff() {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/staff/$(request.auth.uid));
    }

    match /students/{studentId} {
      allow read: if isStaff();
      allow write: if isStaff();
    }
    // ... more rules
  }
}
```

## Firestore Collections (35 Total)

The system utilizes 35 Firestore collections organized across multiple domains:

| Category | Collections | Purpose |
|----------|-------------|---------|
| **Core** | students, classes, staff | Core entities |
| **Operational** | attendance, studentAttendance, contracts, enrollments, workSessions, invoices | Business operations |
| **Business** | leads, campaigns, parents, feedback | CRM and customer relations |
| **Configuration** | products, rooms, curriculum, salaryConfigs, centerSettings | System configuration |
| **Finance** | invoices, contracts, revenue, debt | Financial management |
| **Reporting** | reports, analytics | Business intelligence |

For a comprehensive and up-to-date schema with all 35 collections, refer to `docs/FIRESTORE_SCHEMA.md`.

## Cloud Functions Architecture (8 Triggers)

Serverless functions in `/functions/src/triggers/` provide backend automation:

```
┌─────────────────────────────────────────┐
│     Cloud Functions (8 Triggers)        │
├─────────────────────────────────────────┤
│  ├─ Scheduled Tasks                     │
│  │  └─ Data synchronization, cleanup    │
│  ├─ Event Triggers                      │
│  │  └─ Student enrollment, attendance   │
│  ├─ Webhook Processors                  │
│  │  └─ External integrations            │
│  ├─ Batch Operations                    │
│  │  └─ Bulk updates, exports            │
│  └─ Background Processing               │
│     └─ Reports, notifications           │
└─────────────────────────────────────────┘
```

**Benefits**:
- Offload heavy computation from client
- Automate recurring tasks
- Enforce business logic at backend
- Decouple frontend from backend operations

## Route Structure

Routes are organized by domain within `App.tsx` using `react-router-dom`'s `HashRouter`. This approach helps categorize features and define clear navigation paths:
-   `/training/*`: Classes, schedule, attendance, tutoring
-   `/customers/*`: Students, parents, feedback
-   `/business/*`: Leads, campaigns (CRM)
-   `/hr/*`: Staff, salary, work confirmation
-   `/finance/*`: Contracts, invoices, revenue, debt
-   `/reports/*`: Training, finance, monthly reports
-   `/settings/*`: Products, rooms, curriculum, center config

## Module Dependencies

```
types.ts (Single Source of Truth)
    │
    ├── src/config/firebase.ts
    │       │
    │       ├── src/services/*.ts
    │       │       │
    │       │       └── src/hooks/*.ts
    │       │               │
    │       │               └── pages/*.tsx
    │       │
    │       └── src/utils/*.ts
    │
    └── components/*.tsx
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DEPLOYMENT FLOW                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Developer  ──►  npm run build  ──►  firebase deploy    │
│                       │                    │             │
│                       ▼                    ▼             │
│              ┌─────────────┐       ┌─────────────┐      │
│              │   dist/     │       │  Firebase   │      │
│              │  (static)   │  ──►  │  Hosting    │      │
│              └─────────────┘       └─────────────┘      │
│                                                          │
│  Rules  ──►  firebase deploy --only firestore:rules     │
│                       │                                  │
│                       ▼                                  │
│              ┌─────────────┐                            │
│              │  Firestore  │                            │
│              │   Rules     │                            │
│              └─────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Non-standard folder structure**: Source files at root level (not in `src/`) for faster development
2. **Static class methods for services**: Simpler than instantiated classes
3. **Real-time listeners by default**: `onSnapshot` instead of `getDocs` for live updates
4. **Single types.ts file**: All interfaces in one place for easier maintenance
5. **HashRouter**: Works better with Firebase Hosting static deployment
6. **Vietnamese UI text**: All statuses and enums in Vietnamese for end users
