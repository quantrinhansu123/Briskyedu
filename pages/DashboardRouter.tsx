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

// Lazy load the main dashboard (contains both admin and teacher views currently)
const Dashboard = lazy(() => import('./Dashboard').then(m => ({ default: m.Dashboard })));

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
 * Future phases will add:
 * - Phase 3: DashboardCSKH for CSKH staff
 * - Phase 4: DashboardGV extracted from Dashboard
 *
 * Current: Routes to main Dashboard which handles role-based rendering internally
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

  // Future: Route to specific dashboards
  // if (isTeacher) {
  //   return <Suspense fallback={<DashboardLoading />}><DashboardGV /></Suspense>;
  // }
  // if (isCSKH) {
  //   return <Suspense fallback={<DashboardLoading />}><DashboardCSKH /></Suspense>;
  // }

  // Currently: Use existing Dashboard which handles role-based rendering
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Dashboard />
    </Suspense>
  );
};

export default DashboardRouter;
