/**
 * DashboardCSKH
 * Dashboard for CSKH (Customer Service) staff
 *
 * Widgets based on Excel Specs:
 * - TN CSKH (Leader): All 8 widgets
 * - NV CSKH (Staff): 6 widgets (no Revenue, no Sales charts)
 */

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/hooks/useAuth';
import { formatCurrency } from '../src/utils/currencyUtils';
import {
  DashboardStats,
  RevenueChart,
  SalesChart,
  BirthdayWidget,
  StudentDebtWidget,
  StudentExpiringSoonWidget,
  WorkDaysWidget,
  ChecklistWidget,
  type DashboardStatsData,
  type Center,
  type BirthdayPerson,
  type GiftStatus,
} from '../components/dashboard';

interface CSKHStats {
  // Student stats
  totalStudents: number;
  totalClasses: number;
  avgPerClass: number;
  studentsByStatus: { name: string; value: number; color: string }[];
  // Revenue (Leader only)
  salesData: { name: string; value: number; color: string }[];
  revenueData: { month: string; expected: number; actual: number }[];
  // Work days
  myWorkDays: number;
  // Lists
  studentsExpiringSoon: { id: string; fullName: string; className: string; remainingSessions: number }[];
  studentsWithDebt: { id: string; fullName: string; className: string; status: string }[];
  // Birthdays
  staffBirthdays: BirthdayPerson[];
  studentBirthdays: BirthdayPerson[];
}

const COLORS = {
  noPhi: '#0D9488',
  hocThu: '#F59E0B',
  baoLuu: '#6366F1',
  nghiHoc: '#EF4444',
  hvMoi: '#10B981',
};

const PIE_COLORS = ['#0D9488', '#FF6B5A', '#F59E0B', '#10B981', '#6366F1'];

export const DashboardCSKH: React.FC = () => {
  const { isCSKHLeader, staffId } = usePermissions();
  const { user } = useAuth();

  const [stats, setStats] = useState<CSKHStats>({
    totalStudents: 0,
    totalClasses: 0,
    avgPerClass: 0,
    studentsByStatus: [],
    salesData: [],
    revenueData: [],
    myWorkDays: 0,
    studentsExpiringSoon: [],
    studentsWithDebt: [],
    staffBirthdays: [],
    studentBirthdays: [],
  });

  const [checklistItems, setChecklistItems] = useState<{ id: string; task: string; count: number; done: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [giftStatus, setGiftStatus] = useState<Record<string, GiftStatus>>({});

  // Fetch centers
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const centersSnap = await getDocs(collection(db, 'centers'));
        const centerData = centersSnap.docs
          .filter(d => d.data().status === 'Active')
          .map(d => ({ id: d.id, name: d.data().name || '' }));
        setCenters(centerData);
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);

  // Load birthday gifts
  useEffect(() => {
    const thisYear = new Date().getFullYear();
    const thisMonth = new Date().getMonth() + 1;

    const unsubscribe = onSnapshot(
      query(collection(db, 'birthdayGifts'), where('year', '==', thisYear), where('month', '==', thisMonth)),
      (snapshot) => {
        const gifts: Record<string, GiftStatus> = {};
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          gifts[data.studentId] = {
            giftPrepared: data.giftPrepared || false,
            giftGiven: data.giftGiven || false,
          };
        });
        setGiftStatus(gifts);
      }
    );
    return () => unsubscribe();
  }, []);

  // Toggle gift status
  const handleToggleGift = async (studentId: string, studentName: string, field: 'giftPrepared' | 'giftGiven') => {
    const thisYear = new Date().getFullYear();
    const thisMonth = new Date().getMonth() + 1;
    const docId = `${studentId}_${thisYear}_${thisMonth}`;
    const docRef = doc(db, 'birthdayGifts', docId);

    const currentStatus = giftStatus[studentId]?.[field] || false;
    const newStatus = !currentStatus;

    await setDoc(docRef, {
      studentId,
      studentName,
      year: thisYear,
      month: thisMonth,
      [field]: newStatus,
      [`${field === 'giftPrepared' ? 'preparedAt' : 'givenAt'}`]: newStatus ? new Date().toISOString() : null,
    }, { merge: true });
  };

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const thisMonth = currentMonth + 1;

        // Fetch students
        const studentsSnap = await getDocs(collection(db, 'students'));
        const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch classes
        const classesSnap = await getDocs(collection(db, 'classes'));
        const classes = classesSnap.docs.map(d => d.data());

        // Fetch staff
        const staffSnap = await getDocs(collection(db, 'staff'));
        const staffList = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch work sessions
        const workSessionsSnap = await getDocs(collection(db, 'workSessions'));
        const workSessions = workSessionsSnap.docs.map(d => d.data());

        // Calculate student stats by status
        const statusCount = {
          'Đang học': 0,
          'Học thử': 0,
          'Bảo lưu': 0,
          'Nghỉ học': 0,
          'Nợ phí': 0,
        };
        students.forEach((s: any) => {
          const status = s.status || 'Đang học';
          if (status in statusCount) {
            statusCount[status as keyof typeof statusCount]++;
          }
        });

        const studentsByStatus = [
          { name: 'Đang học', value: statusCount['Đang học'], color: COLORS.hvMoi },
          { name: 'Nợ phí', value: statusCount['Nợ phí'], color: COLORS.noPhi },
          { name: 'Học thử', value: statusCount['Học thử'], color: COLORS.hocThu },
          { name: 'Bảo lưu', value: statusCount['Bảo lưu'], color: COLORS.baoLuu },
          { name: 'Nghỉ học', value: statusCount['Nghỉ học'], color: COLORS.nghiHoc },
        ];

        // Calculate work days for current user
        const currentUserId = staffId || user?.uid || '';
        const myWorkDays = workSessions.filter((ws: any) => {
          const wsDate = ws.date ? new Date(ws.date) : null;
          if (!wsDate) return false;
          return (
            ws.staffId === currentUserId &&
            ws.status === 'Đã xác nhận' &&
            wsDate.getMonth() === currentMonth &&
            wsDate.getFullYear() === currentYear
          );
        }).length;

        // Students expiring soon (remainingSessions <= 5)
        const EXPIRY_THRESHOLD = 5;
        const studentsExpiringSoon = students
          .filter((s: any) =>
            s.status === 'Đang học' &&
            s.remainingSessions !== undefined &&
            s.remainingSessions <= EXPIRY_THRESHOLD &&
            s.remainingSessions > 0
          )
          .map((s: any) => ({
            id: s.id,
            fullName: s.fullName || s.name || '',
            className: s.currentClassName || s.className || s.class || '-',
            remainingSessions: s.remainingSessions,
          }))
          .sort((a: any, b: any) => a.remainingSessions - b.remainingSessions);

        // Students with debt
        const studentsWithDebt = students
          .filter((s: any) =>
            s.hasDebt === true || s.status === 'Nợ phí' ||
            (s.remainingSessions !== undefined && s.remainingSessions < 0)
          )
          .map((s: any) => ({
            id: s.id,
            fullName: s.fullName || s.name || '',
            className: s.currentClassName || s.className || s.class || '-',
            status: s.status || 'Nợ phí',
          }));

        // Staff birthdays this month
        const staffBirthdays = staffList
          .filter((s: any) => {
            if (!s.dob) return false;
            const dob = new Date(s.dob);
            return dob.getMonth() + 1 === thisMonth;
          })
          .map((s: any) => {
            const dob = new Date(s.dob);
            return {
              id: s.id,
              name: s.fullName || s.name || '',
              position: s.position || '',
              date: `${dob.getDate()}/${thisMonth}`,
              dayOfMonth: dob.getDate(),
              branch: s.centerName || s.branch || '',
            };
          })
          .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

        // Student birthdays this month
        const studentBirthdays = students
          .filter((s: any) => {
            if (!s.dob) return false;
            const dob = new Date(s.dob);
            return dob.getMonth() + 1 === thisMonth && s.status === 'Đang học';
          })
          .map((s: any) => {
            const dob = new Date(s.dob);
            return {
              id: s.id,
              name: s.fullName || s.name || '',
              position: 'Học sinh',
              date: `${dob.getDate()}/${thisMonth}`,
              dayOfMonth: dob.getDate(),
              branch: s.centerName || s.branch || '',
            };
          })
          .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

        // Revenue data (for Leader only - mock for now)
        const salesData = isCSKHLeader ? [
          { name: 'Học phí mới', value: 45000000, color: PIE_COLORS[0] },
          { name: 'Tái phí', value: 30000000, color: PIE_COLORS[1] },
          { name: 'Tutoring', value: 15000000, color: PIE_COLORS[2] },
        ] : [];

        const revenueData = isCSKHLeader ? [
          { month: 'T10', expected: 100000000, actual: 95000000 },
          { month: 'T11', expected: 110000000, actual: 108000000 },
          { month: 'T12', expected: 120000000, actual: 90000000 },
        ] : [];

        setStats({
          totalStudents: students.filter((s: any) => s.status === 'Đang học').length,
          totalClasses: classes.filter((c: any) => c.status !== 'Đã kết thúc').length,
          avgPerClass: classes.length > 0
            ? Math.round(students.filter((s: any) => s.status === 'Đang học').length / classes.length * 10) / 10
            : 0,
          studentsByStatus,
          salesData,
          revenueData,
          myWorkDays,
          studentsExpiringSoon,
          studentsWithDebt,
          staffBirthdays,
          studentBirthdays,
        });

        // Set checklist items
        setChecklistItems([
          { id: '1', task: 'Nhắc HS sắp hết phí', count: studentsExpiringSoon.length, done: false },
          { id: '2', task: 'Nhắc HS nợ phí', count: studentsWithDebt.length, done: false },
          { id: '3', task: 'Chúc mừng sinh nhật', count: studentBirthdays.length, done: false },
        ]);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching CSKH dashboard data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [isCSKHLeader, staffId, user?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-teal-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-teal-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 animate-spin"></div>
          </div>
          <p className="text-slate-700 mt-5 font-semibold">Đang tải Dashboard CSKH...</p>
        </div>
      </div>
    );
  }

  // Prepare data for widgets
  const dashboardStatsData: DashboardStatsData = {
    totalStudents: stats.totalStudents,
    totalClasses: stats.totalClasses,
    avgPerClass: stats.avgPerClass,
    studentsByStatus: stats.studentsByStatus,
  };

  return (
    <div className="space-y-6">
      {/* Header with Work Days */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard CSKH</h1>
          <p className="text-slate-500 text-sm">
            {isCSKHLeader ? 'Trưởng nhóm CSKH' : 'Nhân viên CSKH'}
          </p>
        </div>
        <WorkDaysWidget workDays={stats.myWorkDays} />
      </div>

      {/* Row 1: Student Stats + Charts (Leader only) */}
      <div className="grid grid-cols-12 gap-6">
        <div className={isCSKHLeader ? "col-span-4" : "col-span-12"}>
          <DashboardStats data={dashboardStatsData} />
        </div>
        {isCSKHLeader && (
          <>
            <div className="col-span-4">
              <RevenueChart data={stats.salesData} title="Doanh số bán hàng" />
            </div>
            <div className="col-span-4">
              <SalesChart data={stats.revenueData} />
            </div>
          </>
        )}
      </div>

      {/* Row 2: Lists - Expiring + Debt */}
      <div className="grid grid-cols-2 gap-6">
        <StudentExpiringSoonWidget students={stats.studentsExpiringSoon} />
        <StudentDebtWidget students={stats.studentsWithDebt} />
      </div>

      {/* Row 3: Birthday + Checklist */}
      <div className="grid grid-cols-2 gap-6">
        <BirthdayWidget
          staffBirthdays={stats.staffBirthdays}
          studentBirthdays={stats.studentBirthdays}
          centers={centers}
          giftStatus={giftStatus}
          onToggleGift={handleToggleGift}
        />
        <ChecklistWidget
          items={checklistItems}
          onToggle={(id) => {
            setChecklistItems(prev =>
              prev.map(item =>
                item.id === id ? { ...item, done: !item.done } : item
              )
            );
          }}
        />
      </div>
    </div>
  );
};

export default DashboardCSKH;
