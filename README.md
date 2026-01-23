# EduManager Pro - Education Center Management System

Vietnamese education center management system built with React 19, TypeScript, and Firebase. Manages students, classes, attendance, staff salaries, contracts, and financial operations for language learning centers.

**Status**: v1.0.1 Stable | Jan 22, 2026 | Quality 6.5/10
**Tech Stack**: React 19 + TypeScript + Firebase + Vite 7
**Architecture**: Three-Layer Pattern (Services → Hooks → Pages)

## Quick Stats

| Metric | Value | Details |
|--------|-------|---------|
| **Pages** | 44 | 8 domains (Training, Customers, HR, Finance, etc.) |
| **Services** | 42 | Hybrid: 79% functions, 21% classes |
| **Hooks** | 38 | 30% real-time (onSnapshot), 70% fetch |
| **Collections** | 37+ | Firestore NoSQL database |
| **Cloud Functions** | 16 | Event triggers + scheduled jobs |
| **Tests** | 294+ | Unit + integration + permissions |
| **Scripts** | 58 | Maintenance + migrations |

## Key Features

- **Student Management**: Enrollment tracking, multi-class support, classProgress tracking
- **Class & Attendance**: Real-time scheduling, attendance, tutoring sessions, homework
- **Staff & HR**: RBAC (11 roles), salary calculation, work confirmations, leave requests
- **Financials**: Contracts, invoices, debt tracking, revenue reports, settlement PDFs
- **CRM**: Lead management, campaigns, customer feedback, parent database
- **Reporting**: Role-based dashboards (Admin/Teacher/CSKH), training & monthly reports

## Quick Start

### Prerequisites

- Node.js >= 18.x, npm >= 9.x
- Firebase project with Blaze plan
- Git for version control

### Installation

```bash
# Clone repository
git clone <repository-url>
cd edumanager-pro

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# Start Firebase emulators (optional)
firebase emulators:start

# Start development server
npm run dev
```

### Environment Variables

Required in `.env.local`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
GEMINI_API_KEY=  # Optional - AI features
```

## Development Commands

```bash
# Development
npm run dev              # Start dev server on port 5173
npm run build            # Production build
npm run preview          # Preview production build

# Testing
npm run test             # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Generate coverage report

# Firebase
npm run setup:admin      # Create initial admin account
firebase deploy          # Deploy to Firebase Hosting
firebase deploy --only firestore:rules  # Deploy rules only

# Emulators
firebase emulators:start # Auth:9099, Firestore:8080, Functions:5001

# Data Maintenance
npx tsx scripts/seedAllData.ts            # Seed demo data
npx tsx scripts/checkDataConsistency.ts   # Verify integrity
```

## Project Structure

**Non-standard**: Source files at root level, not inside `src/`.

```
/                           # Root level
├── App.tsx                 # HashRouter routing
├── index.tsx               # React entry point
├── types.ts                # Single source of truth (967 LOC)
├── pages/                  # 44 page components
├── components/             # Shared UI + dashboard widgets
├── src/
│   ├── config/firebase.ts  # Firebase initialization
│   ├── services/           # 42 Firestore CRUD services
│   ├── hooks/              # 38 React hooks (real-time + fetch)
│   ├── utils/              # 14 utilities (currency, date, etc.)
│   ├── features/           # 32 feature-specific modules
│   └── test/               # Test setup
├── functions/              # 16 Cloud Functions
├── scripts/                # 58 maintenance scripts
├── docs/                   # Documentation
└── firestore.rules         # Security rules
```

## Architecture Overview

### Three-Layer Pattern

```
┌─────────────────────────────────────────────┐
│  Pages (44)  →  UI rendering, user events  │
└────────────────┬────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│  Hooks (38)  →  React state, real-time     │
└────────────────┬────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────┐
│  Services (42) → Firestore CRUD + logic    │
└────────────────┬────────────────────────────┘
                 ▼
         Firebase Backend
```

**Services**: Hybrid pattern (79% function exports, 21% static classes)
**Hooks**: 30% onSnapshot (real-time), 70% getDocs (fetch)
**Pages**: Domain-organized, all lazy-loaded

### Domain Organization

- `/training/*` - Classes, schedule, attendance, tutoring
- `/customers/*` - Students, parents, feedback
- `/business/*` - Leads, campaigns (CRM)
- `/hr/*` - Staff, salary, work confirmation
- `/finance/*` - Contracts, invoices, revenue, debt
- `/reports/*` - Training, finance, monthly reports
- `/settings/*` - Products, rooms, curriculum, center config

## Firebase Backend

### Firestore Collections (37+)

**Core**: students, classes, staff
**Operational**: attendance, contracts, enrollments, workSessions
**Finance**: invoices, revenue, debt, settlementInvoices
**Business**: leads, campaigns, parents, feedback
**Config**: products, rooms, curriculum, salaryConfigs

See [FIRESTORE_SCHEMA.md](docs/FIRESTORE_SCHEMA.md) for complete schema.

### Cloud Functions (16)

**Triggers**: Class auto-sync, student stats, contract processing, attendance updates
**Scheduled**: Monthly salary (1st), daily stats (2 AM)
**Utilities**: Batch operations, PDF generation, schedule parsers

## Authentication & Permissions

- Firebase Auth (email/password)
- 11 roles: Admin, Kế toán, CSKH Lead/Staff, Sale Lead/Staff, CM Lead/Staff, GV Việt/Nước ngoài, Trợ giảng
- Permission hook: `src/hooks/usePermissions.tsx`
- Firestore security rules enforce role-based access

## Testing

```bash
# Run tests
npm run test            # Watch mode
npm run test:run        # Single run
npm run test:coverage   # Coverage report

# Run specific test
npx vitest run src/services/studentService.test.ts
```

**Coverage**: 294+ tests (~10% coverage, target 80%+)
**Framework**: Vitest + React Testing Library + jsdom

## Deployment

```bash
# Build and deploy
npm run build
firebase deploy

# Deploy rules only
firebase deploy --only firestore:rules

# View deployment
firebase hosting:channel:list
```

See [Deployment Guide](docs/deployment-guide.md) for detailed instructions.

## Documentation

### Core Documentation

- [Project Overview & PDR](docs/project-overview-pdr.md) - Vision, requirements, success metrics
- [System Architecture](docs/system-architecture.md) - Diagrams, data flow, Cloud Functions
- [Code Standards](docs/code-standards.md) - Coding patterns, guidelines
- [Codebase Summary](docs/codebase-summary.md) - Stats, structure, recent changes
- [Deployment Guide](docs/deployment-guide.md) - Firebase deployment, monitoring
- [Firestore Schema](docs/FIRESTORE_SCHEMA.md) - Database schema (37+ collections)
- [Project Roadmap](docs/project-roadmap.md) - Timeline, milestones, v1.1/v1.2 plans
- [Architecture Decisions](docs/decisions/) - 9 ADRs explaining key choices

### Developer Resources

- [CLAUDE.md](CLAUDE.md) - AI assistant context and workflows
- [QUICKSTART.md](docs/journals/QUICKSTART.md) - Quick development guide
- [API Documentation](docs/journals/API.md) - API reference

## Recent Changes

**Jan 22, 2026**: Documentation comprehensive update
**Jan 18, 2026**: ClassProgress feature (frontend + scripts + functions)
**Jan 5, 2026**: Multi-module bug fixes (Training, Customer, HR)
**Dec 31, 2025**: v1.0.1 Dashboard & Salary system

See [Codebase Summary](docs/codebase-summary.md) for detailed change history.

## Current Status & Roadmap

**Phase**: Production Stabilization (v1.0.1)

**Priorities**:
1. Security Hardening (P0): Firestore rules audit, permission checks
2. Code Quality (P1): DRY violations, hook consistency
3. User Features (P2): Mobile responsive, notifications

**Quality Score**: 6.5/10
- ✅ Clean architecture, comprehensive features
- ⚠️ Test coverage ~10% (target: 80%+)
- ⚠️ Security hardening needed
- ⚠️ Technical debt (DRY violations, large files)

See [Project Roadmap](docs/project-roadmap.md) for v1.1/v1.2 plans.

## Contributing

### Development Workflow

1. Create feature branch from `main`
2. Implement changes following [Code Standards](docs/code-standards.md)
3. Run tests: `npm run test:run`
4. Run linting: `npx tsc --noEmit`
5. Create pull request with description
6. Code review and approval
7. Merge to `main`

### Commit Conventions

Follow conventional commits:

```
feat: Add student import from Excel
fix: Fix attendance calculation for reserved students
refactor: Extract student card component
docs: Update API documentation
test: Add StudentService tests
```

## Important Patterns

### Vietnamese Language

All UI text and enums in Vietnamese:
- Status values: `'Đang học'`, `'Bảo lưu'`, `'Nghỉ học'`
- Use existing enum values from `types.ts`

### Currency Handling

```typescript
import { formatCurrency } from '@/src/utils/currencyUtils';
const formatted = formatCurrency(50000); // "50.000 ₫"
```

### Timestamp Conversion

```typescript
// Reading from Firestore
const student = {
  ...doc.data(),
  dob: doc.data().dob?.toDate?.()?.toISOString() || ''
};

// Writing to Firestore
import { Timestamp } from 'firebase/firestore';
await addDoc(collection(db, 'students'), {
  dob: Timestamp.fromDate(new Date(studentData.dob))
});
```

## Troubleshooting

### Build Errors

```bash
rm -rf node_modules dist && npm install && npm run build
```

### Permission Denied (Firestore)

Ensure user has staff document: `staff/{userId}`

```bash
firebase deploy --only firestore:rules
```

### Environment Variables Not Working

- Variables must start with `VITE_`
- Rebuild after changing `.env.local`
- Verify `.gitignore` excludes `.env.local`

## Support & Resources

- **Documentation**: See `docs/` directory
- **Issues**: GitHub Issues for bug reports
- **Firebase Console**: https://console.firebase.google.com
- **Firebase Status**: https://status.firebase.google.com

## License

Private - Educational use only

---

**Project**: edumanager-pro
**Repository**: GitHub (private)
**Firebase Project**: edumanager-pro
**Last Updated**: January 22, 2026
