# EduManager Pro Codebase Summary

**Last Updated**: December 31, 2025

## 🎯 Project Overview

EduManager Pro is a comprehensive education center management system designed for Vietnamese language learning centers. It facilitates the management of students, classes, attendance, staff salaries, contracts, and various financial operations. The system is built with a modern technology stack, focusing on real-time data updates and a robust three-layer architecture.

## 🚀 Key Technologies

-   **Frontend**: React 19.2.0, TypeScript 5.9.3, Vite 7.2.6, TailwindCSS (via classes), Recharts 3.5.1, lucide-react, xlsx
-   **Backend**: Firebase (Authentication, Firestore, Cloud Functions, Storage, Hosting)
-   **Routing**: react-router-dom 7 with HashRouter

## 📊 Codebase Statistics (Latest Audit: Dec 31, 2025)

| Component | Count | Location |
|-----------|-------|----------|
| **Pages** | 37 | `/pages/` (8 domains) |
| **Services** | 37 | `/src/services/` (static class methods) |
| **Hooks** | 35 | `/src/hooks/` (real-time listeners) |
| **Utilities** | 12 | `/src/utils/` |
| **Shared Components** | 6 | `/components/` |
| **Cloud Functions** | 11 | `/functions/src/triggers/` + utilities |
| **Feature Modules** | 7 | `/src/features/` with specialized logic |
| **Firestore Collections** | 36+ | Multiple domains |
| **TypeScript Interfaces** | 28+ | `types.ts` (single source of truth) |
| **TypeScript Enums** | 9+ | `types.ts` |
| **Test Files** | 294 | Unit, integration, permissions, dashboards |
| **Maintenance Scripts** | 18+ | `/scripts/` (data seeding, consistency checks) |

## 🧩 Domain-Based Module Structure

The application is organized into 8 functional domains with 37 pages distributed across them:

| Domain | Pages | Key Features |
|--------|-------|--------------|
| **Training** | 7 | Classes, Schedule, Attendance, Tutoring, Homework, Holidays, AttendanceHistory |
| **Customers** | 7 | Students, StudentDetail, Parents, Feedback, Trial, Database, EnrollmentHistory |
| **Business** | 2 | Campaigns, CRM |
| **HR** | 7 | Staff, SalaryConfig, WorkConfirmation, SalaryReports (Teacher/Staff), LeaveRequests, Rewards, Penalties |
| **Finance** | 6 | ContractList, ContractCreate, Invoices, Debt, Revenue, Enrollment |
| **Reports** | 2 | Training, Monthly |
| **Settings** | 5 | Products, Rooms, Curriculum, Center, Inventory |
| **Core** | 2 | Dashboard, Login |
| **Total** | **37** | |

**Architecture Pattern**: Each domain has corresponding services in `/src/services/` (37 total) for CRUD operations and hooks in `/src/hooks/` (35 total) for real-time listeners. Complex features use `/src/features/` modules for encapsulated domain logic.

## 🏗️ Architectural Patterns

### Three-Layer Architecture

The application strictly follows a 3-layer pattern for clear separation of concerns:

1. **Services Layer** (`src/services/` - 37 files)
   - Static class methods (no instantiation)
   - Firestore CRUD operations and complex business logic
   - Returns plain data or promises (no React hooks)
   - Includes specialized services: StudentService, ClassService, StaffService, ContractService, PermissionService, LeaveRequestService, etc.
   - Example: `StudentService.getStudents()`, `ClassService.updateClass()`, `LeaveRequestService.createRequest()`

2. **Hooks Layer** (`src/hooks/` - 35 files)
   - React custom hooks wrapping services
   - Real-time listeners using `onSnapshot` for dynamic updates
   - Returns `{ data, loading, error }` pattern
   - Client-side filtering and state management
   - Specialized hooks: useStudents, useClasses, useStaff, useContracts, useLeaveRequests, useLeaveBalance, etc.
   - Example: `useStudents()`, `useClasses()`, `useLeaveRequests()`

3. **Pages Layer** (`pages/` - 37 files)
   - UI components consuming hooks for data
   - User interactions and form handling
   - Lazy-loaded for performance optimization
   - Domain-based organization (8 domains)

### Complementary Patterns

-   **Real-time Updates**: Extensive use of Firestore `onSnapshot` listeners in hooks for dynamic UI updates
-   **Role-Based Permissions**: Implemented via `permissionService.ts` to control user access
-   **Client-Side Routing**: `react-router-dom` with `HashRouter` for navigation
-   **Lazy Loading**: All page components are lazy-loaded to optimize performance
-   **Single Source of Truth**: All types in `types.ts` (27 interfaces, 9 enums)

## ☁️ Cloud Functions (11 Total)

Serverless functions in `/functions/src/triggers/` and utilities for automation and backend operations:

**Triggers (9):**
- `onClassCreate/Update/Delete` - Class management with real-time updates
- `onStudentCreate/Update/Delete` - Student record synchronization
- `onContractCreate/Update` - Contract enrollment tracking
- `onAttendanceWrite` - Real-time attendance updates
- `onSessionComplete` - Work session completion and salary calculation
- `onHolidayUpdate` - Holiday period management
- `homeworkTriggers` - Homework assignment tracking
- `staffTriggers` - Staff account and permission management

**Utilities (2):**
- Batch operations (bulk updates, exports)
- Schedule parsers for class timing

**Features:**
- Event-driven triggers (student enrollment, attendance changes)
- Background processing for reports and notifications
- Automatic data consistency maintenance
- Real-time synchronization across collections

## ⚠️ Recent Changes & Quality Assessment

-   **Quality Score**: 6.5/10 (as of Dec 26, 2025)
-   **Latest Work**: Permission & Dashboard completion (December 31, 2025)
     - Permission System: Fixed CSKH/CM/Sale Staff over-permissioned modules
     - Office Dashboard: Added 4 new CSKH/Sale widgets
     - Teacher Dashboard: Complete GV/TG implementation with 7 widgets
     - Test Coverage: Increased from 226 to 294 tests
-   **Security**: P0 priority issues identified in Firestore rules and missing permission checks (in progress)
-   **Code Quality Issues**:
     - DRY violations in timestamp conversion and Firestore query building
     - Inconsistent hook patterns (mix of onSnapshot vs getDocs approaches)
     - Performance optimization needed for dashboard data filtering (memoization)

## 🗄️ Firestore Collections (36 Total)

The system utilizes 36 Firestore collections across multiple domains:

**Core Collections**:
- `students` - Student records with enrollment history
- `classes` - Class definitions and schedules
- `staff` - Staff/teacher profiles with roles and permissions

**Operational Collections**:
- `attendance`, `studentAttendance` - Attendance tracking records
- `contracts`, `enrollments` - Payment contracts and enrollment details
- `workSessions` - Teacher work sessions for salary calculation
- `invoices` - Financial invoicing records
- `settlementInvoices` - Debt settlement invoices for students with fee debt (NEW)

**Business Collections**:
- `leads`, `campaigns` - CRM and marketing data
- `parents`, `feedback` - Parent contacts and student feedback

**Configuration Collections**:
- `products`, `rooms`, `curriculum` - Center configuration
- `salaryConfigs`, `centerSettings` - System settings

For a detailed schema with all 36 collections, refer to `docs/FIRESTORE_SCHEMA.md`.
