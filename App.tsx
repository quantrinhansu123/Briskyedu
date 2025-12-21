
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { ClassManager } from './pages/ClassManager';
import { StudentManager } from './pages/StudentManager';
import { TrialStudents } from './pages/TrialStudents';
import { Schedule } from './pages/Schedule';
import { HolidayManager } from './pages/HolidayManager';
import { TutoringManager } from './pages/TutoringManager';
import { AttendanceHistory } from './pages/AttendanceHistory';
import { Attendance } from './pages/Attendance';
import { StudentDetail } from './pages/StudentDetail';
import { StaffManager } from './pages/StaffManager';
import { ProductManager } from './pages/ProductManager';
import { InventoryManager } from './pages/InventoryManager';
import { RoomManager } from './pages/RoomManager';
import { EnrollmentHistory } from './pages/EnrollmentHistory';
import { ParentManager } from './pages/ParentManager';
import { SalaryConfig } from './pages/SalaryConfig';
import { StaffRewardPenalty } from './pages/StaffRewardPenalty';
import { WorkConfirmation } from './pages/WorkConfirmation';
import { SalaryReportTeacher } from './pages/SalaryReportTeacher';
import { SalaryReportStaff } from './pages/SalaryReportStaff';
import { ContractCreation } from './pages/ContractCreation';
import { ContractList } from './pages/ContractList';
import { FeedbackManager } from './pages/FeedbackManager';
import { RevenueReport } from './pages/RevenueReport';
import { DebtManagement } from './pages/DebtManagement';
import { CustomerDatabase } from './pages/CustomerDatabase';
import { CampaignManager } from './pages/CampaignManager';
import { TrainingReport } from './pages/TrainingReport';
import { InvoiceManager } from './pages/InvoiceManager';
import { CenterSettings } from './pages/CenterSettings';
import { CurriculumManager } from './pages/CurriculumManager';
import { HomeworkManager } from './pages/HomeworkManager';
import { MonthlyReport } from './pages/MonthlyReport';
import { Login } from './pages/Login';
import { StudentStatus } from './types';
import { useAuth } from './src/hooks/useAuth';

// Placeholder components for routes not fully implemented
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-96 text-gray-400">
    <div className="text-6xl mb-4">🚧</div>
    <h3 className="text-xl font-medium text-gray-600">Trang đang phát triển</h3>
    <p className="mt-2">{title}</p>
  </div>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden print:block print:h-auto print:overflow-visible">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden print:block print:overflow-visible">
        <Header title="Hệ thống quản lý trung tâm" />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6 print:p-0 print:overflow-visible">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />

                {/* Training Routes */}
                <Route path="/training/classes" element={<ClassManager />} />
                <Route path="/training/schedule" element={<Schedule />} />
                <Route path="/training/holidays" element={<HolidayManager />} />
                <Route path="/training/attendance" element={<Attendance />} />
                <Route path="/training/tutoring" element={<TutoringManager />} />
                <Route path="/training/homework" element={<HomeworkManager />} />
                <Route path="/training/attendance-history" element={<AttendanceHistory />} />
                <Route path="/training/enrollment" element={<EnrollmentHistory />} />

                {/* Customer Routes */}
                <Route path="/customers/students" element={<StudentManager key="all-students" title="Danh sách học viên" />} />
                <Route path="/customers/student-detail/:id" element={<StudentDetail />} />
                <Route path="/customers/parents" element={<ParentManager />} />
                <Route path="/customers/dropped" element={<StudentManager key="dropped-students" initialStatusFilter={StudentStatus.DROPPED} title="Danh sách học viên đã nghỉ" />} />
                <Route path="/customers/reserved" element={<StudentManager key="reserved-students" initialStatusFilter={StudentStatus.RESERVED} title="Danh sách học viên bảo lưu" />} />
                <Route path="/customers/trial" element={<TrialStudents />} />
                <Route path="/customers/feedback" element={<FeedbackManager />} />

                {/* Business Routes */}
                <Route path="/business/leads" element={<CustomerDatabase />} />
                <Route path="/business/campaigns" element={<CampaignManager />} />

                {/* HR Routes */}
                <Route path="/hr/staff" element={<StaffManager />} />
                <Route path="/hr/salary" element={<SalaryConfig />} />
                <Route path="/hr/rewards" element={<StaffRewardPenalty />} />
                <Route path="/hr/work-confirmation" element={<WorkConfirmation />} />
                <Route path="/hr/salary-teacher" element={<SalaryReportTeacher />} />
                <Route path="/hr/salary-staff" element={<SalaryReportStaff />} />

                {/* Finance Routes */}
                <Route path="/finance/contracts" element={<ContractList />} />
                <Route path="/finance/contracts/create" element={<ContractCreation />} />
                <Route path="/finance/invoices" element={<InvoiceManager />} />
                <Route path="/finance/revenue" element={<RevenueReport />} />
                <Route path="/finance/debt" element={<DebtManagement />} />

                {/* Report Routes */}
                <Route path="/reports/training" element={<TrainingReport />} />
                <Route path="/reports/finance" element={<RevenueReport />} />
                <Route path="/reports/monthly" element={<MonthlyReport />} />

                {/* Settings Routes */}
                <Route path="/settings/staff" element={<StaffManager />} />
                <Route path="/settings/products" element={<ProductManager />} />
                <Route path="/settings/inventory" element={<InventoryManager />} />
                <Route path="/settings/rooms" element={<RoomManager />} />
                <Route path="/settings/center" element={<CenterSettings />} />
                <Route path="/settings/curriculum" element={<CurriculumManager />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </HashRouter>
  );
};

export default App;
