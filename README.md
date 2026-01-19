# EduManager Pro: Education Center Management System

EduManager Pro is a comprehensive web-based application for Vietnamese language learning centers. Built with React 19, TypeScript, and Firebase, it manages students, classes, attendance, staff, contracts, and financials with real-time synchronization across 35+ Firestore collections.

**Status**: v1.0.1 Stable | ClassProgress Feature + Bug Fixes (Jan 18, 2026) | 6.5/10 Quality Score

## Quick Stats

| Metric | Value | Location |
|--------|-------|----------|
| **Pages** | 44 | 8 domains + dashboards |
| **Services** | 42 | 79% functions, 21% classes |
| **Hooks** | 38 | 30% real-time, 70% fetch |
| **Collections** | 37+ | Firestore (NoSQL) |
| **Cloud Functions** | 16 | Event-driven triggers + utilities |
| **Test Coverage** | 294+ | Unit, integration, permissions |
| **Scripts** | 58 | Maintenance, migrations, audits |

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

1. **Services** (`src/services/` - 42 files): 79% named functions, 21% static classes
2. **Hooks** (`src/hooks/` - 38 files): 30% onSnapshot (real-time), 70% getDocs (fetch)
3. **Pages** (`pages/` - 44 files): UI components consuming hooks
4. **Features** (`src/features/` - 32 files): Domain-specific encapsulated logic

**Hybrid Service Pattern**: Modern services use function exports, legacy use static classes (StudentService, ClassService, StaffService, AuthService).

See `docs/system-architecture.md` for details.

## Recent Changes (January 18, 2026)

**ClassProgress Feature** ✅ (commits 2feb5cc → d2e412b)
- **Frontend**: Display student class progress with fallback (2feb5cc)
- **Scripts**: Backfill classProgress for existing students (d7655fb)
- **Functions**: Init classProgress on contract payment (3659e7e)
- **Triggers**: Track classProgress on attendance updates (8687704)
- **Types**: Added ClassProgress interface for session tracking (d2e412b)

**Previous Work** (Jan 5, 2026): Multi-module bug fixes (Training, Customer, HR)

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

The project is in the **Production Stabilization Phase** (v1.0.1):

1. **Permission & Dashboard** ✅: Complete GV/TG teacher dashboard implementation
2. **Security Hardening** (P0): Firestore rules, permission checks (in progress)
3. **Code Quality** (P1): DRY violations, hook consistency (planned v1.1)
4. **User Features** (P2): Mobile responsive, notifications (planned v1.2)

See `docs/project-roadmap.md` for complete roadmap.
