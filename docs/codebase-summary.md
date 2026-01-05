# EduManager Pro Codebase Summary

**Last Updated**: January 5, 2026

## 🎯 Project Overview

EduManager Pro is a comprehensive education center management system designed for Vietnamese language learning centers. It facilitates the management of students, classes, attendance, staff salaries, contracts, and various financial operations. The system is built with a modern technology stack, focusing on real-time data updates and a robust three-layer architecture.

## 🚀 Key Technologies

-   **Frontend**: React 19.2.0, TypeScript 5.9.3, Vite 7.2.6, TailwindCSS (via classes), Recharts 3.5.1, lucide-react, xlsx
-   **Backend**: Firebase (Authentication, Firestore, Cloud Functions, Storage, Hosting)
-   **Routing**: react-router-dom 7 with HashRouter

## 📊 Codebase Statistics (Latest Audit: Jan 5, 2026)

| Component | Count | Location |
|-----------|-------|----------|
| **Pages** | 40 | `/pages/` (8 domains + dashboard router) |
| **Services** | 37 | `/src/services/` (static class methods) |
| **Hooks** | 35+ | `/src/hooks/` (real-time listeners + salary hooks) |
| **Utilities** | 12 | `/src/utils/` (date, status, validators, firestore, batch, currency, excel, schedule) |
| **Shared Components** | 17 | `/components/` (6 root + 11 dashboard widgets) |
| **Cloud Functions** | 15+ | `/functions/src/triggers/` + utilities |
| **Feature Modules** | 7 | `/src/features/` (students, classes, attendance, contracts, reports, debt, inventory) |
| **Firestore Collections** | 37+ | Multiple domains (students, classes, staff, contracts, attendance, etc.) |
| **TypeScript Interfaces** | 50+ | `types.ts` (single source of truth) |
| **TypeScript Enums** | 7 | `types.ts` (StudentStatus, ClassStatus, AttendanceStatus, ContractType/Category/Status, StaffRole) |
| **Test Files** | 294+ | Unit, integration, permissions, dashboards, debt settlement |
| **Maintenance Scripts** | 18+ | `/scripts/` (data seeding, consistency checks, migrations) |

## 🧩 Domain-Based Module Structure (40 Pages)

The application is organized into 8 functional domains with 40 pages distributed across them:

| Domain | Pages (10) | Key Features |
|--------|-------|--------------|
| **Auth/Dashboard** | 4 | Login, Dashboard (main), DashboardRouter, DashboardCSKH, DashboardGV |
| **Training** | 7 | ClassManager, Schedule, Attendance, TutoringManager, HomeworkManager, HolidayManager, AttendanceHistory |
| **Customers** | 7 | StudentManager, StudentDetail, ParentManager, FeedbackManager, TrialStudents, CustomerDatabase, EnrollmentHistory |
| **Business** | 2 | CampaignManager, LeadManagement (CRM) |
| **HR** | 7 | StaffManager, SalaryConfig, WorkConfirmation, SalaryReportTeacher, SalaryReportStaff, LeaveRequestManager, StaffRewardPenalty, CenterSettings |
| **Finance** | 6 | ContractList, ContractCreation, InvoiceManager, DebtManager, DebtManagement, RevenueReport |
| **Reports** | 2 | TrainingReport, MonthlyReport |
| **Settings** | 5 | RoomManager, ProductManager, CurriculumManager, HolidayManager, InventoryManager |
| **Total** | **40** | |

**Recent Fixes (Jan 5, 2026)**:
- Training: Attendance sessions, schedule room conflict, tutoring reserve, homework filter
- Customers: Modal scroll issues, trial student filter, contract class/discount selection
- HR: Staff 18+ age validation, salary custom button, work confirmation save/filter, leave request validations, salary report edit

**Architecture Pattern**: Each domain has corresponding services in `/src/services/` (37 total) for CRUD operations and hooks in `/src/hooks/` (39 total) for real-time listeners. Complex features use `/src/features/` modules for encapsulated domain logic (7 feature modules: students, classes, attendance, contracts, reports, debt, inventory).

## 🏗️ Architectural Patterns

### Three-Layer Architecture

The application strictly follows a 3-layer pattern for clear separation of concerns:

1. **Services Layer** (`src/services/` - 37 files)
   - Static class methods (no instantiation)
   - Firestore CRUD operations and complex business logic
   - Returns plain data or promises (no React hooks)
   - Includes specialized services: StudentService, ClassService, StaffService, ContractService, PermissionService, LeaveRequestService, etc.
   - Example: `StudentService.getStudents()`, `ClassService.updateClass()`, `LeaveRequestService.createRequest()`

2. **Hooks Layer** (`src/hooks/` - 39 files)
   - React custom hooks wrapping services
   - Real-time listeners using `onSnapshot` for dynamic updates
   - Returns `{ data, loading, error }` pattern
   - Client-side filtering and state management
   - Specialized hooks: useStudents, useClasses, useStaff, useContracts, useLeaveRequests, useLeaveBalance, useMonthlySalary, useAutoWorkSessions, useSettlementInvoices, etc.
   - Example: `useStudents()`, `useClasses()`, `useMonthlySalary()`, `useSettlementInvoices()`

3. **Pages Layer** (`pages/` - 40 files)
   - UI components consuming hooks for data
   - User interactions and form handling
   - Lazy-loaded for performance optimization
   - Domain-based organization (8 domains + 3 dashboard pages + 1 router)
   - Recent additions: DashboardRouter (phase 2), DashboardCSKH (phase 3 - CSKH staff), DashboardGV (phase 4 - teachers)

### Complementary Patterns

-   **Real-time Updates**: Extensive use of Firestore `onSnapshot` listeners in hooks for dynamic UI updates
-   **Role-Based Permissions**: Implemented via `permissionService.ts` to control user access
-   **Client-Side Routing**: `react-router-dom` with `HashRouter` for navigation
-   **Lazy Loading**: All page components are lazy-loaded to optimize performance
-   **Single Source of Truth**: All types in `types.ts` (27 interfaces, 9 enums)

## ☁️ Cloud Functions (15+ Total)

Serverless functions in `/functions/src/triggers/` and utilities for automation and backend operations:

**Core Triggers:**
- `onClassCreate/Update/Delete` - Class management, session generation, cascade updates
- `onStudentCreate/Update/Delete` - Student record synchronization, bad debt calculation
- `onContractCreate/Update` - Auto-enrollment with paid session tracking
- `onAttendanceWrite` - Real-time attendance stats, tutoring session triggers
- `onSessionComplete` - Work session completion, salary calculation
- `onHolidayUpdate` - Apply/unapply sessions during holidays

**Specialized Triggers:**
- `homeworkTriggers` - Homework assignment and submission tracking
- `staffTriggers` - Staff account creation, permission management
- `settlementInvoiceTriggers` - Debt settlement invoice generation and tracking (NEW)
- `calculateMonthlySalaries` - Monthly salary calculation (1st of month)
- `recalculateStudentStats` - Daily 2 AM batch updates

**Utilities:**
- Batch operations (bulk updates, exports)
- Schedule parsers for class timing
- PDF generation for settlement invoices

**Features:**
- Event-driven triggers (student enrollment, attendance changes)
- Background processing for salary calculations and reports
- Automatic data consistency maintenance
- Real-time synchronization across 37+ collections
- Cascade operations for class/staff/parent deletes

## ⚠️ Recent Changes & Quality Assessment

-   **Quality Score**: 6.5/10 (as of Dec 2025)
-   **Latest Work**: Multi-module bug fixes across Training, Customer, and HR (January 5, 2026)
     - Training Module: Fixed attendance sessions, schedule room conflicts, tutoring reserves, homework filters
     - Customer Module: Fixed modal scroll issues, trial student filtering, contract class/discount selection
     - HR Module: Fixed staff age validation (18+), salary custom buttons, work confirmation saves/filters, leave request validations, salary report edits
     - Test Coverage: 294+ tests covering all fixes (unit, integration, permissions, dashboards, debt settlement)
-   **Previous Work (Jan 3, 2026)**:
     - Dashboard Phase 1-4 (✅): Reusable widgets, DashboardRouter, DashboardCSKH, DashboardGV
     - Monthly Salary (✅): Unified salary calculation with Cloud Function triggers
     - Settlement Invoices (✅): Debt settlement tracking and PDF generation
-   **Security**: P0 priority issues identified in Firestore rules and missing permission checks (in progress)
-   **Code Quality Issues**:
     - DRY violations in timestamp conversion and Firestore query building
     - Inconsistent hook patterns (mix of onSnapshot vs getDocs approaches)
     - Performance optimization needed for dashboard data filtering (memoization)

## 🗄️ Firestore Collections (37+ Total)

The system utilizes 37+ Firestore collections across multiple domains:

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
