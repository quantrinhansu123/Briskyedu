# EduManager Pro - Project Roadmap

**Last Updated**: December 28, 2025

## Vision

Build a comprehensive, efficient, and user-friendly education center management system for Vietnamese language learning centers. The system manages 35+ Firestore collections across 7 domains with robust real-time synchronization and role-based access control.

## Roadmap Overview

```
2025 Q4                          2026 Q1                          2026 Q2
├── v1.0 Core System             ├── v1.1 Enhancements           ├── v1.2 Advanced
│   ├── Student Management       │   ├── Mobile Responsive       │   ├── Parent Portal
│   ├── Class Management         │   ├── Notifications           │   ├── Student Portal
│   ├── Attendance               │   ├── Analytics Dashboard     │   ├── Mobile App
│   ├── Finance                  │   └── API Integrations        │   └── AI Features
│   └── Reports                  │                                │
└── v1.0 Release (Dec 2025)      └── v1.1 Release (Mar 2026)     └── v1.2 Release (Jun 2026)
```

## Current Status (December 28, 2025)

**System Health**: 6.5/10 - Quality score indicates room for improvement
**Phase**: Version 1.0 Complete, Codebase Review Phase Active
**Active Plan**: `plans/251226-2134-codebase-review/plan.md`
**Critical Items**: 4 P0 security issues identified, targeting v1.1

### Codebase Metrics (Latest Audit)

- **Services**: 28 static class methods in `src/services/`
- **Hooks**: 27 real-time listeners in `src/hooks/`
- **Pages**: 36 domain-organized components in `pages/`
- **Collections**: 35 Firestore collections
- **Cloud Functions**: 8 serverless triggers
- **Test Coverage**: 155+ tests (unit, integration)

### Recent Work Summary

- **Completed**: Full codebase audit across 28 services, 27 hooks, 36 pages
- **In Progress**: Security issue remediation
- **Next Priority**: Implement codebase review recommendations

## Version 1.0 (Released - Dec 2025)

### Features ✅

| Category | Feature | Status |
|----------|---------|--------|
| **Core** | | |
| | User Authentication | ✅ Done |
| | Role-based Authorization | ✅ Done |
| | Dashboard | ✅ Done |
| **Training** | | |
| | Class Management | ✅ Done |
| | Schedule View | ✅ Done |
| | Attendance Tracking | ✅ Done |
| | Homework Management | ✅ Done |
| | Tutoring Sessions | ✅ Done |
| **Students** | | |
| | Student CRUD | ✅ Done |
| | Trial Students | ✅ Done |
| | Parent Management | ✅ Done |
| | Enrollment History | ✅ Done |
| **HR** | | |
| | Staff Management | ✅ Done |
| | Salary Configuration | ✅ Done |
| | Work Confirmation | ✅ Done |
| | Reward/Penalty | ✅ Done |
| **Finance** | | |
| | Contract Creation | ✅ Done |
| | Debt Management | ✅ Done |
| | Revenue Reports | ✅ Done |
| **CRM** | | |
| | Customer Database | ✅ Done |
| | Campaign Management | ✅ Done |
| **Reports** | | |
| | Training Report | ✅ Done |
| | Monthly Report | ✅ Done |
| | Financial Report | ✅ Done |

### Goals

- [x] Core functionality complete
- [x] All CRUD operations working
- [x] Real-time data sync
- [x] Role-based access control
- [x] Production deployment
- [x] User documentation

## Version 1.1 (Q1 2026) - Active Phase

### Critical Focus: Codebase Quality & Security

Per the active review plan (`plans/251226-2134-codebase-review/plan.md`), v1.1 prioritizes:

**Phase 1: Security Hardening (P0)**

Critical security issues from codebase audit (Dec 2025):
- [ ] Firestore rules hardening - apply principle of least privilege across 35 collections
- [ ] Permission checks - add explicit permission verification in all CRUD operations
- [ ] Input validation - validate user inputs in forms and API submissions
- [ ] Sensitive data handling - encrypt confidential information
- [ ] Target Quality Score: 9.0/10

**Phase 2: Code Quality & Maintenance (P1)**

Identified technical debt:
- [ ] DRY violations - consolidate timestamp conversion utility, centralize Firestore query builders
- [ ] Hook consistency - standardize onSnapshot vs getDocs usage across 27 hooks
- [ ] Service layer refactoring - simplify complex methods in 28 services
- [ ] Error boundary improvement - comprehensive error logging and user feedback
- [ ] Test coverage - achieve 95%+ across all layers

**Phase 3: User Experience Enhancements**
- [ ] Mobile responsive improvements - ensure 36 pages render correctly on mobile
- [ ] Enhanced error messages - clear, actionable feedback for users
- [ ] Performance optimization - reduce Firestore query overhead
- [ ] Real-time sync improvements - better handling of connection drops

### Secondary Features

| Feature | Priority | Status |
|---------|----------|--------|
| Mobile Responsive | High | Planned |
| Push Notifications | High | Planned |
| Enhanced Dashboard | Medium | Planned |
| Email Integration | Medium | Planned |
| Zalo Integration | Medium | Planned |
| Data Export | Low | Planned |

## Version 1.2 (Q2 2026)

### Planned Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Parent Portal | High | Parents view student progress |
| Student Portal | Medium | Students view schedule, homework |
| Mobile App | Medium | Native mobile application |
| AI Assistant | Low | AI-powered insights, recommendations |
| Multi-branch | Low | Support multiple locations |

### Considerations

- React Native for mobile app
- Firebase Cloud Messaging for push
- OpenAI/Gemini for AI features

## Version 2.0 (Future)

### Vision Features

- Online learning integration
- Video conferencing
- E-learning content management
- Advanced analytics/BI
- Multi-tenant SaaS model

## Feature Requests Backlog

| ID | Feature | Requested By | Priority | Status |
|----|---------|--------------|----------|--------|
| FR-001 | Bulk student import | Admin | High | Planned v1.1 |
| FR-002 | SMS notifications | Admin | Medium | Under review |
| FR-003 | Calendar export | Teacher | Low | Backlog |
| FR-004 | Grade book | Teacher | Medium | Planned v1.2 |
| FR-005 | Fee calculator | Finance | Medium | Backlog |

## Technical Debt Roadmap

| Item | Priority | Target Version |
|------|----------|----------------|
| Add comprehensive tests | High | v1.0 |
| Refactor large components | Medium | v1.1 |
| Optimize Firestore queries | Medium | v1.1 |
| Add error boundary logging | Low | v1.1 |
| Implement caching | Low | v1.2 |
| Address Security Issues (Firestore rules, permission checks) | High | v1.1 |
| Refactor DRY Violations (Timestamp Conversion & Query Building) | Medium | v1.1 |
| Standardize Hooks Consistency | Medium | v1.1 |

## Dependencies

### External Dependencies

| Dependency | Current Version | Target | Notes |
|------------|-----------------|--------|-------|
| React | 19.2.0 | 19.x | Latest stable |
| TypeScript | 5.9.3 | 5.x+ | Strict mode enabled |
| Firebase | 12.6.0 | Latest | SDK with Blaze plan features |
| Vite | 7.2.6 | 7.x+ | Fast build tooling |
| react-router-dom | 7.10 | 7.x+ | HashRouter for SPA |
| TailwindCSS | Latest | Latest | Utility-first styling |
| Vitest | Latest | Latest | Unit testing |

### Infrastructure Dependencies

- Firebase Blaze plan (for Cloud Functions)
- Custom domain (optional)
- SSL certificate (Firebase provided)

## Success Metrics

### v1.0 Success Criteria

- [x] All core features functional
- [x] < 5 critical bugs at launch
- [x] Page load < 3 seconds
- [x] 90% user satisfaction

### v1.1 Success Criteria

- [ ] Mobile usability score > 80
- [ ] 50% reduction in support requests
- [ ] User engagement +20%

## Review Schedule

| Date | Milestone | Review Type |
|------|-----------|-------------|
| Dec 2025 | v1.0 Release | Full review |
| Jan 2026 | v1.0 + 1 month | Feedback review |
| Mar 2026 | v1.1 Release | Feature review |
| Jun 2026 | v1.2 Release | Annual review |

## Contact

For roadmap discussions:
- GitHub Issues: Feature requests
- Slack: #edumanager-roadmap
- Email: [project-email]
