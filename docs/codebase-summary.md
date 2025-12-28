# EduManager Pro Codebase Summary

**Last Updated**: December 28, 2025

## 🎯 Project Overview

EduManager Pro is a comprehensive education center management system designed for Vietnamese language learning centers. It facilitates the management of students, classes, attendance, staff salaries, contracts, and various financial operations. The system is built with a modern technology stack, focusing on real-time data updates and a robust three-layer architecture.

## 🚀 Key Technologies

-   **Frontend**: React 19.2.0, TypeScript 5.9.3, Vite 7.2.6, TailwindCSS (via classes), Recharts 3.5.1, lucide-react, xlsx
-   **Backend**: Firebase (Authentication, Firestore, Cloud Functions, Storage, Hosting)
-   **Routing**: react-router-dom 7 with HashRouter

## 📊 Codebase Statistics

| Component | Count | Location |
|-----------|-------|----------|
| **Pages** | 37 | `/pages/` (7 domains) |
| **Services** | 28 | `/src/services/` (static class methods) |
| **Hooks** | 29 | `/src/hooks/` (real-time listeners) |
| **Utilities** | 12 | `/src/utils/` |
| **Shared Components** | 5 | `/components/` |
| **Cloud Functions** | 8 | `/functions/src/triggers/` |
| **Firestore Collections** | 35 | Multiple domains |
| **TypeScript Interfaces** | 27 | `types.ts` (single source of truth) |
| **TypeScript Enums** | 9 | `types.ts` |
| **Test Files** | 18 | Various (unit, integration, utilities) |
| **Maintenance Scripts** | 18 | `/scripts/` (data seeding, consistency checks) |

## 🧩 Domain-Based Module Structure

The application is organized into 7 functional domains with 37 pages distributed across them:

| Domain | Pages | Key Features |
|--------|-------|--------------|
| **Training** | 7 | Classes, Schedule, Attendance, Tutoring, Homework, Holidays, AttendanceHistory |
| **Customers** | 7 | Students, StudentDetail, Parents, Feedback, Trial, Database, EnrollmentHistory |
| **Business** | 2 | Campaigns, Leads (CRM) |
| **HR** | 6 | Staff, SalaryConfig, WorkConfirmation, SalaryReports (Teacher/Staff), Rewards |
| **Finance** | 6 | ContractList, ContractCreate, Invoices, Debt, Revenue, EnrollmentSync |
| **Reports** | 2 | Training, Monthly |
| **Settings** | 5 | Products, Rooms, Curriculum, Inventory, Center |
| **Core** | 2 | Dashboard, Login |

**Service-to-Page Mapping**: Each domain has corresponding services in `/src/services/` for CRUD operations and hooks in `/src/hooks/` for real-time listeners.

## 🏗️ Architectural Patterns

### Three-Layer Architecture

The application strictly follows a 3-layer pattern for clear separation of concerns:

1. **Services Layer** (`src/services/` - 28 files)
   - Static class methods (no instantiation)
   - Firestore CRUD operations and complex business logic
   - Returns plain data or promises (no React hooks)
   - Example: `StudentService.getStudents()`, `ClassService.updateClass()`

2. **Hooks Layer** (`src/hooks/` - 29 files)
   - React custom hooks wrapping services
   - Real-time listeners using `onSnapshot` for dynamic updates
   - Returns `{ data, loading, error }` pattern
   - Client-side filtering and state management
   - Example: `useStudents()`, `useClasses()`

3. **Pages Layer** (`pages/` - 37 files)
   - UI components consuming hooks for data
   - User interactions and form handling
   - Lazy-loaded for performance optimization
   - Domain-based organization (7 domains)

### Complementary Patterns

-   **Real-time Updates**: Extensive use of Firestore `onSnapshot` listeners in hooks for dynamic UI updates
-   **Role-Based Permissions**: Implemented via `permissionService.ts` to control user access
-   **Client-Side Routing**: `react-router-dom` with `HashRouter` for navigation
-   **Lazy Loading**: All page components are lazy-loaded to optimize performance
-   **Single Source of Truth**: All types in `types.ts` (27 interfaces, 9 enums)

## ☁️ Cloud Functions (8 Triggers)

Serverless functions in `/functions/src/triggers/` for automation and backend operations:
- Scheduled tasks for data synchronization
- Webhook processors for external integrations
- Batch operations (bulk updates, exports)
- Event-driven triggers (student enrollment, attendance changes)
- Background processing for reports and notifications

## ⚠️ Recent Changes & Quality Assessment

-   **Quality Score**: 6.5/10 (as of Dec 26, 2025)
-   **Codebase Review**: Completed December 28, 2025. Full audit performed across all layers.
-   **Active Plan**: Codebase review implementation plan exists in `plans/251226-2134-codebase-review/plan.md`
-   **Security**: P0 priority issues identified in Firestore rules and missing permission checks require immediate attention.
-   **Code Quality Issues**:
     - DRY violations in timestamp conversion and Firestore query building
     - Inconsistent hook patterns (mix of onSnapshot vs getDocs approaches)
     - Missing explicit permission checks in some operations

## 🗄️ Firestore Collections (35 Total)

The system utilizes 35 Firestore collections across multiple domains:

**Core Collections**:
- `students` - Student records with enrollment history
- `classes` - Class definitions and schedules
- `staff` - Staff/teacher profiles with roles and permissions

**Operational Collections**:
- `attendance`, `studentAttendance` - Attendance tracking records
- `contracts`, `enrollments` - Payment contracts and enrollment details
- `workSessions` - Teacher work sessions for salary calculation
- `invoices` - Financial invoicing records

**Business Collections**:
- `leads`, `campaigns` - CRM and marketing data
- `parents`, `feedback` - Parent contacts and student feedback

**Configuration Collections**:
- `products`, `rooms`, `curriculum` - Center configuration
- `salaryConfigs`, `centerSettings` - System settings

For a detailed schema with all 35 collections, refer to `docs/FIRESTORE_SCHEMA.md`.
