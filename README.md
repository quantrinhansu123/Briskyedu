# EduManager Pro: Education Center Management System

EduManager Pro is a comprehensive web-based application for Vietnamese language learning centers. Built with React 19, TypeScript, and Firebase, it manages students, classes, attendance, staff, contracts, and financials with real-time synchronization across 35+ Firestore collections.

**Status**: v1.0 Stable | Active Codebase Review Phase | 6.5/10 Quality Score

## Quick Stats

| Metric | Value | Location |
|--------|-------|----------|
| **Pages** | 36 | 7 domains |
| **Services** | 28 | Static class methods |
| **Hooks** | 27 | Real-time listeners |
| **Collections** | 35 | Firestore |
| **Cloud Functions** | 8 | Serverless triggers |
| **Test Coverage** | 155+ tests | Unit, integration |

## Key Features

*   **Student Management**: Enrollment, status tracking, detailed profiles, enrollment history.
*   **Class & Attendance**: Class scheduling, real-time attendance, history tracking, tutoring.
*   **Staff & HR**: Staff profiles, roles, salary configuration, work confirmations, rewards/penalties.
*   **Financials**: Contract management, invoicing, debt tracking, revenue reports.
*   **CRM**: Lead management, campaign tracking, customer feedback, database.
*   **Reporting**: Real-time dashboards, training and monthly reports.

## Tech Stack

*   **Frontend**: React 19, TypeScript, Vite 7, TailwindCSS
*   **Backend**: Firebase (Auth, Firestore, Cloud Functions, Hosting)
*   **Routing**: `react-router-dom` with `HashRouter`
*   **Charting**: Recharts
*   **Icons**: `lucide-react`

## Quick Start (Development)

To get EduManager Pro running locally, follow these steps:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-repo/edumanager-pro.git
    cd edumanager-pro
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Firebase**:
    Create a `.env.local` file in the project root and add your Firebase project configuration:
    ```
    VITE_FIREBASE_API_KEY=YOUR_API_KEY
    VITE_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
    VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
    VITE_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
    VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
    VITE_FIREBASE_APP_ID=YOUR_APP_ID
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY  # Optional, for AI features
    ```
4.  **Start Firebase Emulators (for local development)**:
    ```bash
    firebase emulators:start
    ```
5.  **Run the development server**:
    ```bash
    npm run dev
    ```
    The application will be accessible at `http://localhost:5173` (or another port if 5173 is in use).

## Testing

*   **Run tests in watch mode**: `npm run test`
*   **Run tests once (for CI/CD)**: `npm run test:run`
*   **Generate coverage report**: `npm run test:coverage`

## Deployment

To deploy to Firebase Hosting:
```bash
npm run build
firebase deploy
```

For production deployment guide, see `docs/deployment-guide.md`.

## Architecture

EduManager Pro uses a strict **three-layer architecture**:

1. **Services** (`src/services/` - 28 files): Firestore CRUD with static methods
2. **Hooks** (`src/hooks/` - 27 files): Real-time listeners with `onSnapshot`
3. **Pages** (`pages/` - 36 files): UI components consuming hooks

This pattern ensures clean separation of concerns and maintainable code.

For detailed architecture documentation, refer to `docs/system-architecture.md`.

## Recent Changes (December 28, 2025)

- **Codebase Review**: Completed full audit of all 28 services, 27 hooks, 36 pages
- **Quality Assessment**: 6.5/10 score with identified security (P0) and code quality (P1) issues
- **Active Plan**: Phase-based remediation plan in `plans/251226-2134-codebase-review/`
- **Documentation**: Updated all core documentation files with latest statistics and audit findings

## Development

For complete development guide, see `docs/QUICKSTART.md` or `CLAUDE.md`.

### Common Commands

```bash
npm run dev              # Start dev server
npm run build           # Production build
npm run test            # Run tests (watch mode)
npm run test:coverage   # Test coverage report
firebase emulators:start # Local Firebase emulators
```

## Documentation

Complete documentation available in the `docs/` directory:

- `docs/codebase-summary.md` - Codebase overview and statistics
- `docs/system-architecture.md` - Architecture and data flow
- `docs/code-standards.md` - Coding standards and patterns
- `docs/project-roadmap.md` - Development roadmap and timeline
- `docs/FIRESTORE_SCHEMA.md` - Database schema (35 collections)
- `docs/decisions/` - Architecture decision records (ADRs)

## Current Focus

The project is in the **Codebase Review Phase** targeting v1.1 (Q1 2026):

1. **Security Hardening** (P0): Firestore rules, permission checks
2. **Code Quality** (P1): DRY violations, hook consistency, test coverage
3. **User Features** (P2): Mobile responsive, notifications, integrations

See `docs/project-roadmap.md` for complete roadmap.
