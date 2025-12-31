/**
 * DashboardRouter
 * Routes to appropriate dashboard based on user role
 *
 * Routing logic:
 * - Teachers (GV, TG) → Teacher Dashboard section
 * - CSKH staff → CSKH Dashboard (Phase 3)
 * - Admin/Kế toán → Admin Dashboard
 */

import React, { Suspense, lazy } from 'react';
import { usePermissions } from '../src/hooks/usePermissions';

// Lazy load dashboards
const Dashboard = lazy(() => import('./Dashboard').then(m => ({ default: m.Dashboard })));
const DashboardCSKH = lazy(() => import('./DashboardCSKH').then(m => ({ default: m.DashboardCSKH })));
const DashboardGV = lazy(() => import('./DashboardGV').then(m => ({ default: m.DashboardGV })));

// Loading component
const DashboardLoading: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-teal-50/30 flex items-center justify-center -m-6">
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 rounded-full border-4 border-teal-100"></div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 border-r-teal-300 animate-spin"></div>
        <div className="absolute inset-3 rounded-full border-4 border-transparent border-t-[#FF6B5A] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full animate-pulse"></div>
        </div>
      </div>
      <p className="text-slate-700 mt-5 font-semibold text-lg">Đang tải Dashboard...</p>
    </div>
  </div>
);

/**
 * DashboardRouter Component
 *
 * Routing logic:
 * - CSKH staff → DashboardCSKH (Phase 3)
 * - Teachers (GV/TG) → Dashboard (Phase 4 will extract to DashboardGV)
 * - Admin/Kế toán → Dashboard (main admin view)
 */
export const DashboardRouter: React.FC = () => {
  const { isTeacher, isCSKH, isKeToan, canSeeRevenue } = usePermissions();

  // Log role detection for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('[DashboardRouter] Role detection:', {
      isTeacher,
      isCSKH,
      isKeToan,
      canSeeRevenue,
    });
  }

  // Route teachers to GV Dashboard
  if (isTeacher) {
    return (
      <Suspense fallback={<DashboardLoading />}>
        <DashboardGV />
      </Suspense>
    );
  }

  // Route CSKH staff to CSKH Dashboard
  if (isCSKH) {
    return (
      <Suspense fallback={<DashboardLoading />}>
        <DashboardCSKH />
      </Suspense>
    );
  }

  // Default: Admin/Kế toán/other roles use main Dashboard
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Dashboard />
    </Suspense>
  );
};

export default DashboardRouter;
