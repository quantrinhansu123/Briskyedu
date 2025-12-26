# EduManager Pro Codebase Summary

**Last Updated**: December 26, 2025

## 🎯 Project Overview

EduManager Pro is a comprehensive education center management system designed for Vietnamese language learning centers. It facilitates the management of students, classes, attendance, staff salaries, contracts, and various financial operations. The system is built with a modern technology stack, focusing on real-time data updates and a robust architecture.

## 🚀 Key Technologies

-   **Frontend**: React 19.2.0, TypeScript 5.9.3, Vite 7.2.6, TailwindCSS (via classes), Recharts 3.5.1, lucide-react, xlsx
-   **Backend**: Firebase (Authentication, Firestore, Cloud Functions, Storage, Hosting)
-   **Routing**: react-router-dom 7 with HashRouter

## 📊 Codebase Statistics

-   **Pages**: 36 components in the `/pages/` directory
-   **Services**: 28 services in `/src/services/`
-   **Hooks**: 27 custom hooks in `/src/hooks/`
-   **Utilities**: 9 utility modules in `/src/utils/`
-   **Shared Components**: 5 components in `/components/`
-   **Cloud Functions**: 8 triggers in `/functions/src/triggers/`
-   **Firestore Collections**: 28+ distinct collections
-   **Test Files**: 7 test files (covering services, hooks, utilities)

## 🧩 Module Structure

The application is structured into several key modules, reflecting different functional areas:

-   **Training**: `ClassManager`, `Schedule`, `Attendance`, `HomeworkManager`, `TutoringManager`, `HolidayManager`
-   **Customers**: `StudentManager`, `StudentDetail`, `ParentManager`, `TrialStudents`, `FeedbackManager`
-   **HR**: `StaffManager`, `SalaryConfig`, `WorkConfirmation`, `StaffRewardPenalty`, `SalaryReports`
-   **Finance**: `ContractCreation`, `ContractList`, `InvoiceManager`, `DebtManagement`, `RevenueReport`
-   **Business**: `CustomerDatabase` (leads), `CampaignManager`
-   **Settings**: `ProductManager`, `InventoryManager`, `RoomManager`, `CurriculumManager`, `CenterSettings`
-   **Reports**: `Dashboard`, `TrainingReport`, `MonthlyReport`

## 🏗️ Architectural Patterns

-   **Three-Layer Architecture**: A strict pattern separating concerns into:
    1.  **Services Layer** (`src/services/`): Handles Firestore CRUD operations, complex business logic, and returns plain data or promises. Services are implemented as static class methods.
    2.  **Hooks Layer** (`src/hooks/`): Wraps services with React state management, uses `onSnapshot` for real-time Firestore updates, and returns `{ data, loading, error }`.
    3.  **Pages Layer** (`pages/`): Consumes hooks for data, renders UI, and manages user interactions.
-   **Real-time Updates**: Extensive use of Firestore `onSnapshot` listeners in hooks for dynamic UI updates.
-   **Role-Based Permissions**: Implemented via `permissionService.ts` to control user access.
-   **Client-Side Routing**: `react-router-dom` with `HashRouter` for navigation.
-   **Lazy Loading**: All page components are lazy-loaded to optimize performance.

## ⚠️ Recent Changes & Quality Assessment

-   **Quality Score**: 6.5/10 (as of Dec 26, 2025)
-   **Security**: Identified issues in Firestore rules and missing permission checks require attention.
-   **Code Duplication**: DRY (Don't Repeat Yourself) violations found, particularly in timestamp conversion and Firestore query building.
-   **Hooks Consistency**: Inconsistent patterns detected in hooks; some use real-time listeners, while others employ fetch-based approaches.

## 🗄️ Firestore Collections

The system utilizes 28+ Firestore collections, including:

-   `students`: Student records with enrollment history.
-   `classes`: Class definitions and schedules.
-   `staff`: Staff/teacher profiles with roles and permissions.
-   `attendance`/`studentAttendance`: Records for student attendance.
-   `contracts`: Payment contracts and enrollment details.
-   `workSessions`: Teacher work sessions for salary calculation.
-   `leads`/`campaigns`: CRM and marketing data.

For a detailed schema, refer to `docs/FIRESTORE_SCHEMA.md`.
