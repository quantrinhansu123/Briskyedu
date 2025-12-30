/**
 * Dashboard Page
 * Warm Education Design - Teal & Coral Theme
 * Aesthetic: Professional, Warm, Memorable
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  BookOpen, 
  TrendingUp,
  Gift,
  Package,
  DollarSign,
  AlertCircle,
  X,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  CalendarDays,
  Wallet,
  PieChart as PieChartIcon,
  BarChart3,
  Heart,
  Cake,
  Box,
  ChevronRight,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { collection, getDocs, query, where, orderBy, limit, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { formatCurrency } from '../src/utils/currencyUtils';
import { getRevenueSummary, RevenueByCategory } from '../src/services/financialReportService';
import { seedAllData, clearAllData } from '../scripts/seedAllData';
import { useSalaryReport } from '../src/hooks/useSalaryReport';
import { useProducts } from '../src/hooks/useProducts';
import { usePermissions } from '../src/hooks/usePermissions';

// Warm Education Color Palette - Teal & Coral Theme
const COLORS = {
  noPhi: '#0D9488',      // Teal - Nợ phí (primary)
  hocThu: '#F59E0B',     // Amber - Học thử
  baoLuu: '#6366F1',     // Indigo - Bảo lưu
  nghiHoc: '#EF4444',    // Red - Nghỉ học
  hvMoi: '#10B981',      // Emerald - HV mới
  hocPhi: '#FF6B5A',     // Coral - Học phí (accent)
};

const PIE_COLORS = ['#0D9488', '#FF6B5A', '#F59E0B', '#10B981', '#6366F1'];

// Gradient definitions for cards - Warm Education Theme
const GRADIENTS = {
  primary: 'from-teal-500 via-teal-600 to-emerald-600',
  secondary: 'from-emerald-400 to-teal-500',
  warm: 'from-[#FF6B5A] to-[#FF8F7A]',
  cool: 'from-slate-600 to-slate-800',
  accent: 'from-amber-400 to-orange-500',
};

interface StudentData {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  className?: string;
  currentClassName?: string;
  status?: string;
  hasDebt?: boolean;
  createdAt?: string;
  parentPhone?: string;
}

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  avgPerClass: number;
  studentsByStatus: { name: string; value: number; color: string }[];
  revenueData: { month: string; expected: number; actual: number }[];
  debtStats: { noPhi: number; noHocPhi: number };
  totalRevenue: number;
  totalDebt: number;
  totalBadDebt: number; // Nợ xấu (học sinh nghỉ học còn nợ)
  badDebtStudents: number; // Số học sinh nợ xấu
  salaryForecast: { position: string; amount: number }[];
  salaryPercent: number;
  businessHealth: { metric: string; value: number; status: string }[];
  lowStockProducts: { name: string; quantity: number }[];
  upcomingBirthdays: { name: string; position: string; date: string; dayOfMonth: number; branch?: string }[];
  studentBirthdays: { id: string; name: string; position: string; date: string; dayOfMonth: number; branch?: string }[];
  classStats: { name: string; count: number }[];
}

export const Dashboard: React.FC = () => {
  // Permission check for revenue visibility
  const { canSeeRevenue, isTeacher } = usePermissions();

  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalClasses: 0,
    avgPerClass: 0,
    studentsByStatus: [],
    revenueData: [],
    debtStats: { noPhi: 0, noHocPhi: 0 },
    totalRevenue: 0,
    totalDebt: 0,
    totalBadDebt: 0,
    badDebtStudents: 0,
    salaryForecast: [],
    salaryPercent: 0,
    businessHealth: [],
    lowStockProducts: [],
    upcomingBirthdays: [],
    studentBirthdays: [],
    classStats: [],
  });
  const [loading, setLoading] = useState(true);
  const [currentMonth] = useState('Tháng hiện tại');
  
  // State cho bảng thống kê
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsCategory, setStatsCategory] = useState('Lương nhân viên');
  const [statsSortOrder, setStatsSortOrder] = useState('asc'); // asc = thấp đến cao
  const [statsLimit, setStatsLimit] = useState(5);
  
  // Fetch salary report data
  const { summaries: salaryReportData } = useSalaryReport(statsMonth, statsYear);
  
  // Fetch products data (realtime)
  const { products: allProducts } = useProducts();
  
  // State cho bảng sinh nhật
  const [birthdayFilter, setBirthdayFilter] = useState<'month' | 'week' | 'today'>('month');
  const [birthdayType, setBirthdayType] = useState<'staff' | 'student'>('staff');
  const [birthdayGifts, setBirthdayGifts] = useState<Record<string, { giftPrepared: boolean; giftGiven: boolean }>>({});
  const [birthdayBranch, setBirthdayBranch] = useState<string>('all');
  
  // State cho bảng vật phẩm kho
  const [stockFilter, setStockFilter] = useState<'low' | 'all'>('low');
  
  // State cho chi nhánh/cơ sở
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [centerList, setCenterList] = useState<{ id: string; name: string }[]>([]);
  
  // Fetch centers from Firestore
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const centersSnap = await getDocs(collection(db, 'centers'));
        const centers = centersSnap.docs
          .filter(d => d.data().status === 'Active')
          .map(d => ({
            id: d.id,
            name: d.data().name || '',
          }));
        setCenterList(centers);
      } catch (err) {
        console.error('Error fetching centers:', err);
      }
    };
    fetchCenters();
  }, []);

  // Build branches array with colors
  const branchColors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'];
  const branches = [
    { id: 'all', name: 'Tất cả cơ sở', color: 'bg-gray-500', textColor: 'text-gray-700' },
    ...centerList.map((c, idx) => ({
      id: c.name,
      name: c.name,
      color: branchColors[idx % branchColors.length],
      textColor: `text-${branchColors[idx % branchColors.length].replace('bg-', '').replace('-500', '')}-700`
    }))
  ];
  const selectedBranchData = branches.find(b => b.id === selectedBranch) || branches[0];
  
  // State cho modal danh sách học viên
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  
  // State cho doanh số bán hàng từ báo cáo tài chính
  const [revenuePieData, setRevenuePieData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [seeding, setSeeding] = useState(false);

  // Seed test data
  const handleSeedData = async () => {
    if (seeding) return;
    if (!confirm('Bạn có muốn tạo dữ liệu test TOÀN BỘ cho app không?\n\nSẽ tạo: Students, Classes, Parents, Contracts, Staff, Products, Leads, Campaigns, Attendance, Tutoring, Feedback, Invoices, Work Sessions...')) return;
    
    setSeeding(true);
    try {
      const results = await seedAllData();
      const total = Object.values(results).reduce((a, b) => a + b, 0);
      alert(`✅ Đã tạo ${total} records thành công!\n\nChi tiết:\n${Object.entries(results).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
      fetchDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error seeding data:', error);
      alert('❌ Lỗi khi tạo dữ liệu: ' + (error as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  // Clear all data
  const handleClearData = async () => {
    if (seeding) return;
    if (!confirm('⚠️ CẢNH BÁO: Bạn có chắc muốn XÓA TOÀN BỘ dữ liệu không?\n\nHành động này không thể hoàn tác!')) return;
    if (!confirm('Xác nhận lần cuối: XÓA TẤT CẢ DỮ LIỆU?')) return;
    
    setSeeding(true);
    try {
      await clearAllData();
      alert('✅ Đã xóa toàn bộ dữ liệu!');
      fetchDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('❌ Lỗi khi xóa dữ liệu: ' + (error as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Load birthday gifts for current month/year
  useEffect(() => {
    const thisYear = new Date().getFullYear();
    const thisMonth = new Date().getMonth() + 1;
    
    const unsubscribe = onSnapshot(
      query(collection(db, 'birthdayGifts'), where('year', '==', thisYear), where('month', '==', thisMonth)),
      (snapshot) => {
        const gifts: Record<string, { giftPrepared: boolean; giftGiven: boolean }> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          gifts[data.studentId] = {
            giftPrepared: data.giftPrepared || false,
            giftGiven: data.giftGiven || false,
          };
        });
        setBirthdayGifts(gifts);
      }
    );
    return () => unsubscribe();
  }, []);

  // Toggle gift status
  const toggleGiftStatus = async (studentId: string, studentName: string, field: 'giftPrepared' | 'giftGiven') => {
    const thisYear = new Date().getFullYear();
    const thisMonth = new Date().getMonth() + 1;
    const docId = `${studentId}_${thisYear}_${thisMonth}`;
    const docRef = doc(db, 'birthdayGifts', docId);
    
    const currentStatus = birthdayGifts[studentId]?.[field] || false;
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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as StudentData[];
      setAllStudents(students);
      
      // Fetch classes
      const classesSnap = await getDocs(collection(db, 'classes'));
      const classes = classesSnap.docs.map(d => d.data());
      
      // Fetch contracts for revenue
      const contractsSnap = await getDocs(collection(db, 'contracts'));
      const contracts = contractsSnap.docs.map(d => d.data());
      
      // Calculate stats
      const totalStudents = students.length;
      const totalClasses = classes.length;
      const avgPerClass = totalClasses > 0 ? (totalStudents / totalClasses).toFixed(1) : 0;
      
      // Students by status - fetch real data (dùng giá trị Vietnamese từ enum)
      const statusCounts = {
        'Nợ phí': students.filter(s => s.hasDebt || s.status === 'Nợ phí').length,
        'Học thử': students.filter(s => s.status === 'Học thử').length,
        'Bảo lưu': students.filter(s => s.status === 'Bảo lưu').length,
        'Nghỉ học': students.filter(s => s.status === 'Nghỉ học').length,
        'HV mới': students.filter(s => {
          if (!s.createdAt) return false;
          const created = new Date(s.createdAt);
          const now = new Date();
          return (now.getTime() - created.getTime()) < 30 * 24 * 60 * 60 * 1000;
        }).length,
      };
      
      const studentsByStatus = [
        { name: 'Nợ phí', value: statusCounts['Nợ phí'], color: COLORS.noPhi },
        { name: 'Học thử', value: statusCounts['Học thử'], color: COLORS.hocThu },
        { name: 'Bảo lưu', value: statusCounts['Bảo lưu'], color: COLORS.baoLuu },
        { name: 'Nghỉ học', value: statusCounts['Nghỉ học'], color: COLORS.nghiHoc },
        { name: 'HV mới', value: statusCounts['HV mới'], color: COLORS.hvMoi },
      ];
      
      // Revenue calculation
      const paidContracts = contracts.filter(c => c.status === 'Paid' || c.status === 'Đã thanh toán');
      const debtContracts = contracts.filter(c => c.status === 'Debt' || c.status === 'Nợ phí');
      
      const totalRevenue = paidContracts.reduce((sum, c) => sum + (c.finalTotal || c.totalAmount || 0), 0);
      const totalDebt = debtContracts.reduce((sum, c) => sum + (c.finalTotal || c.totalAmount || 0), 0);
      
      // Calculate bad debt from students who dropped out with debt
      const badDebtStudentsList = students.filter((s: any) => s.badDebt === true);
      const totalBadDebt = badDebtStudentsList.reduce((sum: number, s: any) => sum + (s.badDebtAmount || 0), 0);
      const badDebtStudents = badDebtStudentsList.length;
      
      // Fetch financial report data for pie chart
      try {
        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const financialSummary = await getRevenueSummary(currentMonth);
        
        if (financialSummary.revenueByCategory.length > 0) {
          setRevenuePieData(financialSummary.revenueByCategory.map(item => ({
            name: item.category,
            value: item.amount,
            color: item.color,
          })));
        } else {
          // No data - show empty
          setRevenuePieData([]);
        }
      } catch (err) {
        console.error('Error fetching financial data:', err);
        setRevenuePieData([]);
      }
      
      // Revenue comparison data from contracts
      const revenueData = totalRevenue > 0 ? [
        { month: 'Kỳ vọng', expected: totalRevenue * 1.2, actual: 0 },
        { month: 'Thực tế', expected: 0, actual: totalRevenue },
        { month: 'Chênh lệch', expected: 0, actual: totalRevenue * 0.2 },
      ] : [];
      
      // Products are now loaded via useProducts() hook with realtime updates
      // No need to fetch here - see allProducts from useProducts()
      
      // Fetch staff for birthday and salary - real data from Firebase
      const staffSnap = await getDocs(collection(db, 'staff'));
      const staffList = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Also get staff from staffSalaries if staff collection is empty
      let allStaff = staffList;
      if (staffList.length === 0) {
        const staffSalariesSnap = await getDocs(collection(db, 'staffSalaries'));
        const uniqueStaff = new Map();
        staffSalariesSnap.docs.forEach(d => {
          const data = d.data();
          if (!uniqueStaff.has(data.staffId)) {
            uniqueStaff.set(data.staffId, {
              id: data.staffId,
              name: data.staffName,
              position: data.position,
              birthDate: data.birthDate || data.dob,
            });
          }
        });
        allStaff = Array.from(uniqueStaff.values());
      }
      
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      
      // Get all birthdays in current month (for filter to work)
      // Check multiple possible field names
      const upcomingBirthdays = allStaff
        .filter((s: any) => {
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          if (!bdayStr) return false;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          if (isNaN(bday.getTime())) return false;
          // Include all birthdays in current month
          return bday.getMonth() === thisMonth;
        })
        .map((s: any) => {
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          return {
            name: s.name || s.staffName,
            position: s.position || 'Nhân viên',
            date: `${String(bday.getDate()).padStart(2, '0')}/${String(bday.getMonth() + 1).padStart(2, '0')}/${bday.getFullYear()}`,
            dayOfMonth: bday.getDate(),
            branch: s.branch || s.center || '',
          };
        })
        .sort((a: any, b: any) => a.dayOfMonth - b.dayOfMonth);
      
      console.log('Staff list:', allStaff.length, 'Birthdays this month:', upcomingBirthdays.length);
      
      // Student birthdays - similar logic
      const studentBirthdays = students
        .filter((s: any) => {
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          if (!bdayStr) return false;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          if (isNaN(bday.getTime())) return false;
          return bday.getMonth() === thisMonth;
        })
        .map((s: any) => {
          const bdayStr = s['sinh nhật'] || s['ngày sinh'] || s.birthDate || s.dob || s.dateOfBirth;
          const bday = bdayStr.toDate ? bdayStr.toDate() : new Date(bdayStr);
          return {
            id: s.id,
            name: s.name || s.fullName,
            position: 'Học viên',
            date: `${String(bday.getDate()).padStart(2, '0')}/${String(bday.getMonth() + 1).padStart(2, '0')}/${bday.getFullYear()}`,
            dayOfMonth: bday.getDate(),
            branch: s.branch || '',
          };
        })
        .sort((a: any, b: any) => a.dayOfMonth - b.dayOfMonth);
      
      console.log('Student birthdays this month:', studentBirthdays.length);
      
      // Class stats from real data
      const classStats = classes.slice(0, 5).map((c: any) => ({
        name: c.name,
        count: c.currentStudents || 0,
      }));
      
      // Fetch work sessions for real salary calculation
      const workSessionsSnap = await getDocs(collection(db, 'workSessions'));
      const workSessions = workSessionsSnap.docs.map(d => d.data());
      const confirmedSessions = workSessions.filter((ws: any) => ws.status === 'Đã xác nhận');
      
      // Calculate salary by position from confirmed work sessions
      const salaryByPosition: { [key: string]: number } = {
        'Giáo viên Việt': 0,
        'Giáo viên Nước ngoài': 0,
        'Trợ giảng': 0,
      };
      
      // Salary rates per session
      const salaryRates: { [key: string]: number } = {
        'Giáo viên Việt': 200000,
        'Giáo viên Nước ngoài': 400000,
        'Trợ giảng': 100000,
      };
      
      confirmedSessions.forEach((ws: any) => {
        const pos = ws.position || 'Trợ giảng';
        const rate = salaryRates[pos] || 100000;
        if (pos.includes('Việt') || pos === 'Giáo viên') {
          salaryByPosition['Giáo viên Việt'] += rate;
        } else if (pos.includes('Nước ngoài') || pos.includes('NN')) {
          salaryByPosition['Giáo viên Nước ngoài'] += rate;
        } else {
          salaryByPosition['Trợ giảng'] += rate;
        }
      });
      
      const tongLuong = Object.values(salaryByPosition).reduce((a, b) => a + b, 0);
      
      const salaryForecast = [
        { position: 'Lương giáo viên Việt', amount: salaryByPosition['Giáo viên Việt'] },
        { position: 'Lương giáo viên NN', amount: salaryByPosition['Giáo viên Nước ngoài'] },
        { position: 'Lương trợ giảng', amount: salaryByPosition['Trợ giảng'] },
        { position: 'Tổng', amount: tongLuong },
      ];
      const salaryPercent = totalRevenue > 0 ? Math.round((tongLuong / totalRevenue) * 100 * 100) / 100 : 0;
      
      // Chỉ số sức khỏe doanh nghiệp - tính từ dữ liệu thực
      const activeStudents = students.filter((s: any) => s.status === 'Đang học').length;
      const debtStudents = students.filter((s: any) => s.hasDebt || s.status === 'Nợ phí').length;
      const droppedStudents = statusCounts['Nghỉ học'];
      
      const tiLeTaiTuc = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;
      const tiLeNoPhi = totalStudents > 0 ? Math.round((debtStudents / totalStudents) * 100) : 0;
      const tiLeNghiHoc = totalStudents > 0 ? Math.round((droppedStudents / totalStudents) * 100) : 0;
      
      // Tính điểm hài lòng từ feedback
      let diemHaiLong = 0;
      try {
        const feedbackSnap = await getDocs(collection(db, 'feedbacks'));
        if (feedbackSnap.size > 0) {
          const totalRating = feedbackSnap.docs.reduce((sum, doc) => sum + (doc.data().rating || 0), 0);
          diemHaiLong = Math.round((totalRating / feedbackSnap.size) * 20); // rating 1-5 -> 20-100%
        }
      } catch (err) {
        console.log('No feedback data');
      }
      
      const tiSuatLoiNhuan = totalRevenue > 0 ? Math.round(((totalRevenue - tongLuong) / totalRevenue) * 100) : 0;
      
      // Đánh giá nghịch: <10% Tốt, <20% Khá, <30% Trung Bình, <50% Yếu, >=50% Rất yếu
      const getStatusInverse = (value: number, hasData: boolean = true) => {
        if (!hasData) return 'Chưa có dữ liệu';
        if (value < 10) return 'Tốt';
        if (value < 20) return 'Khá';
        if (value < 30) return 'Trung Bình';
        if (value < 50) return 'Yếu';
        return 'Rất yếu';
      };
      
      // Đánh giá thuận: >80% Tốt, >60% Khá, >40% TB, >20% Yếu
      const getStatusNormal = (value: number, hasData: boolean = true) => {
        if (!hasData) return 'Chưa có dữ liệu';
        if (value >= 80) return 'Tốt';
        if (value >= 60) return 'Khá';
        if (value >= 40) return 'Trung Bình';
        if (value >= 20) return 'Yếu';
        return 'Rất yếu';
      };
      
      const hasStudentData = totalStudents > 0;
      const hasFeedbackData = diemHaiLong > 0;
      const hasRevenueData = totalRevenue > 0;
      
      const businessHealth = [
        { metric: 'Tỉ lệ tái tục', value: tiLeTaiTuc, status: getStatusNormal(tiLeTaiTuc, hasStudentData) },
        { metric: 'Tỉ lệ nợ phí', value: tiLeNoPhi, status: getStatusInverse(tiLeNoPhi, hasStudentData) },
        { metric: 'Tỉ lệ nghỉ học', value: tiLeNghiHoc, status: getStatusInverse(tiLeNghiHoc, hasStudentData) },
        { metric: 'Điểm số hài lòng', value: diemHaiLong, status: getStatusNormal(diemHaiLong, hasFeedbackData) },
        { metric: 'Tỉ suất lợi nhuận', value: tiSuatLoiNhuan, status: getStatusNormal(tiSuatLoiNhuan, hasRevenueData) },
      ];
      
      setStats({
        totalStudents,
        totalClasses,
        avgPerClass: Number(avgPerClass),
        studentsByStatus,
        revenueData,
        debtStats: { 
          noPhi: Math.round(totalDebt * 0.6), 
          noHocPhi: Math.round(totalDebt * 0.4) 
        },
        totalRevenue,
        totalDebt,
        totalBadDebt,
        badDebtStudents,
        salaryForecast,
        salaryPercent,
        businessHealth,
        lowStockProducts: [], // Now using useProducts() hook with realtime
        upcomingBirthdays,
        studentBirthdays,
        classStats,
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Show empty data on error - no mock data
      setStats({
        totalStudents: 0,
        totalClasses: 0,
        avgPerClass: 0,
        studentsByStatus: [
          { name: 'Nợ phí', value: 0, color: COLORS.noPhi },
          { name: 'Học thử', value: 0, color: COLORS.hocThu },
          { name: 'Bảo lưu', value: 0, color: COLORS.baoLuu },
          { name: 'Nghỉ học', value: 0, color: COLORS.nghiHoc },
          { name: 'HV mới', value: 0, color: COLORS.hvMoi },
        ],
        revenueData: [],
        debtStats: { noPhi: 0, noHocPhi: 0 },
        totalRevenue: 0,
        totalDebt: 0,
        totalBadDebt: 0,
        badDebtStudents: 0,
        salaryForecast: [],
        salaryPercent: 0,
        businessHealth: [],
        lowStockProducts: [],
        upcomingBirthdays: [],
        studentBirthdays: [],
        classStats: [],
      });
      setRevenuePieData([]);
    } finally {
      setLoading(false);
    }
  };

  // Pie chart: Doanh số vs Nợ phí
  const revenueDebtPieData = [
    { name: 'Đã thanh toán', value: stats.totalRevenue, color: '#3B82F6' },
    { name: 'Nợ phí', value: stats.totalDebt, color: '#F59E0B' },
  ];

  // Lọc học viên theo category
  const getStudentsByCategory = (category: string): StudentData[] => {
    const now = new Date();
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    
    switch (category) {
      case 'Nợ phí':
        return allStudents.filter(s => s.hasDebt || s.status === 'Nợ phí');
      case 'Học thử':
        return allStudents.filter(s => s.status === 'Học thử');
      case 'Bảo lưu':
        return allStudents.filter(s => s.status === 'Bảo lưu');
      case 'Nghỉ học':
        return allStudents.filter(s => s.status === 'Nghỉ học');
      case 'HV mới':
        return allStudents.filter(s => {
          if (!s.createdAt) return false;
          const created = new Date(s.createdAt);
          return created.getTime() > thirtyDaysAgo;
        });
      default:
        return [];
    }
  };

  // Handle click vào cột chart
  const handleBarClick = (data: any) => {
    if (data && data.name) {
      setSelectedCategory(data.name);
      setShowStudentModal(true);
    }
  };

  const filteredStudents = selectedCategory ? getStudentsByCategory(selectedCategory) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-teal-50/30 flex items-center justify-center -m-6">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-teal-100"></div>
            {/* Spinning teal ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 border-r-teal-300 animate-spin"></div>
            {/* Inner spinning coral ring */}
            <div className="absolute inset-3 rounded-full border-4 border-transparent border-t-[#FF6B5A] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}></div>
            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-slate-700 mt-5 font-semibold text-lg">Đang tải dữ liệu...</p>
          <p className="text-slate-400 text-sm mt-1">Vui lòng đợi trong giây lát</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFBF5] via-white to-teal-50/20 -m-6 p-6">
      {/* Decorative background elements - Warm Education Theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse"></div>
        <div className="absolute top-1/3 -left-40 w-80 h-80 bg-[#FF6B5A] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-40 right-1/4 w-72 h-72 bg-amber-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '4s' }}></div>
        <div className="absolute top-2/3 left-1/3 w-64 h-64 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '6s' }}></div>
      </div>

      <div className="relative z-10 space-y-6">
        {/* Hero Header - Teal Gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 p-6 shadow-2xl shadow-teal-500/20">
          {/* Decorative pattern overlay */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)"/>
            </svg>
          </div>
          {/* Animated shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-shimmer"></div>
          
          {/* Content */}
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left: Welcome & Branch */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl">
                <Sparkles className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="text-white/80" size={14} />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full px-4 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer hover:bg-white/30 transition-all appearance-none pr-8"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px' }}
                  >
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id} className="bg-white text-gray-800">{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Right: Stats Cards */}
            <div className="flex flex-wrap gap-4">
              {/* Students Card */}
              <div className="group relative bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-default">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                    <Users className="text-white" size={22} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Học viên</div>
                    <div className="text-3xl font-bold text-white">{stats.totalStudents}</div>
                  </div>
                </div>
              </div>
              
              {/* Classes Card */}
              <div className="group relative bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-default">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                    <BookOpen className="text-white" size={22} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs font-medium uppercase tracking-wider">Lớp học</div>
                    <div className="text-3xl font-bold text-white">{stats.totalClasses}</div>
                  </div>
                </div>
              </div>
              
              {/* Average Card */}
              <div className="group relative bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-default">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                    <TrendingUp className="text-white" size={22} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs font-medium uppercase tracking-wider">TB/Lớp</div>
                    <div className="text-3xl font-bold text-white">{stats.avgPerClass}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Full width when revenue hidden */}
          <div className={`col-span-12 ${canSeeRevenue ? 'lg:col-span-7' : ''} space-y-6`}>
            {/* Student Stats Bar Chart */}
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-teal-100/30 transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-lg shadow-teal-500/30">
                    <BarChart3 className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Thống kê học viên</h3>
                    <span className="text-xs text-gray-500">{currentMonth}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {stats.studentsByStatus.map((item, idx) => (
                    <div key={idx} className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  ))}
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.studentsByStatus} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(255,255,255,0.95)', 
                        border: 'none', 
                        borderRadius: '12px', 
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)' 
                      }} 
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} onClick={handleBarClick} className="cursor-pointer">
                      {stats.studentsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {stats.studentsByStatus.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setSelectedCategory(item.name); setShowStudentModal(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium"
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-700">{item.name}</span>
                    <span className="text-gray-400">({item.value})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Revenue Comparison - Only for revenue-allowed roles */}
            {canSeeRevenue && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                    <Wallet className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Doanh thu</h3>
                    <span className="text-xs text-gray-500">{currentMonth}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    {formatCurrency(stats.totalRevenue)}
                  </div>
                </div>
              </div>
              {stats.revenueData.length > 0 ? (
                <>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={stats.revenueData.map(r => ({ name: r.month, value: r.expected || r.actual }))}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => `${(v/1000000).toFixed(0)}tr`} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          <Cell fill="#0D9488" />
                          <Cell fill="#10b981" />
                          <Cell fill="#f43f5e" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-4 mt-4 text-xs justify-center">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 rounded-full">
                      <div className="w-2.5 h-2.5 bg-teal-500 rounded-full"></div>
                      <span className="text-gray-700">Kỳ vọng</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                      <span className="text-gray-700">Thực tế</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-full">
                      <div className="w-2.5 h-2.5 bg-rose-500 rounded-full"></div>
                      <span className="text-gray-700">Chênh lệch</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-gray-400">
                  <Wallet size={40} className="mb-2 opacity-30" />
                  <span className="text-sm">Chưa có dữ liệu doanh thu</span>
                </div>
              )}
            </div>
            )}
          </div>

          {/* Right Column - Pie Charts - Only for revenue-allowed roles */}
          {canSeeRevenue && (
          <div className="col-span-12 lg:col-span-5 space-y-6">
            {/* Revenue Pie Chart */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-[#FF6B5A]/10 transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[#FF6B5A] to-[#FF8F7A] rounded-xl shadow-lg shadow-[#FF6B5A]/30">
                    <PieChartIcon className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-gray-800">Doanh số bán hàng</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold bg-gradient-to-r from-[#FF6B5A] to-[#FF8F7A] bg-clip-text text-transparent">
                    {formatCurrency(revenuePieData.reduce((sum, item) => sum + item.value, 0) || stats.totalRevenue)}
                  </div>
                  <span className="text-xs text-gray-500">{currentMonth}</span>
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenuePieData.length > 0 ? revenuePieData : [{ name: 'Chưa có', value: 1, color: '#e5e7eb' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={revenuePieData.length > 0 ? ({ percent }) => `${(percent * 100).toFixed(0)}%` : undefined}
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {(revenuePieData.length > 0 ? revenuePieData : [{ color: '#e5e7eb' }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-gray-600 text-sm">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue vs Debt Pie Chart */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-amber-100/30 transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                    <DollarSign className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-gray-800">Doanh số / Nợ phí</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    {formatCurrency(stats.totalRevenue + stats.totalDebt)}
                  </div>
                  <span className="text-xs text-gray-500">Tổng cộng</span>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueDebtPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={({ percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {revenueDebtPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ background: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-between items-center mt-4 pt-4 border-t border-gray-100 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                  <span className="text-sm text-gray-600">Đã thu:</span>
                  <span className="font-semibold text-teal-600">{formatCurrency(stats.totalRevenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-sm text-gray-600">Nợ phí:</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(stats.totalDebt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-600">Nợ xấu:</span>
                  <span className="font-semibold text-red-600">{formatCurrency(stats.totalBadDebt)} ({stats.badDebtStudents} HV)</span>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Revenue-only Section - Lead/Admin/Ketoan can see salary & health metrics */}
        {canSeeRevenue && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Left Column - Salary & Health */}
          <div className="space-y-6">
            {/* Dự báo lương */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Wallet className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white">Dự báo lương</h3>
                  </div>
                  <span className="text-sm text-white/80 bg-white/10 px-3 py-1 rounded-full">{currentMonth}</span>
                </div>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <tbody>
                    {stats.salaryForecast.map((item, idx) => (
                      <tr key={idx} className={idx === stats.salaryForecast.length - 1 ? 'font-bold border-t-2 border-emerald-200' : 'border-b border-gray-100'}>
                        <td className="py-2.5 text-gray-700">{item.position}</td>
                        <td className="py-2.5 text-right font-semibold text-emerald-600">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-emerald-200 bg-emerald-50/50">
                      <td className="py-2.5 font-semibold text-gray-800">Chiếm tỉ lệ</td>
                      <td className="py-2.5 text-right font-bold text-emerald-600">{stats.salaryPercent}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chỉ số sức khỏe doanh nghiệp */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
              <div className="bg-gradient-to-r from-slate-600 to-slate-800 p-4 text-center">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Activity className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-white">CHỈ SỐ SỨC KHỎE DOANH NGHIỆP</h3>
                </div>
                <p className="text-white/80 text-sm">{currentMonth}</p>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 border-b-2 border-slate-200">
                    <tr>
                      <th className="text-left py-2 font-medium">Hạng mục</th>
                      <th className="text-center py-2 font-medium">Số liệu</th>
                      <th className="text-right py-2 font-medium">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.businessHealth.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 text-gray-700">{item.metric}</td>
                        <td className="py-2.5 text-center font-medium">{item.value}%</td>
                        <td className={`py-2.5 text-right font-semibold ${
                          item.status === 'Tốt' ? 'text-emerald-600' : 
                          item.status === 'Khá' ? 'text-blue-600' :
                          item.status === 'Trung Bình' ? 'text-amber-500' : 
                          item.status === 'Yếu' ? 'text-rose-500' : 
                          item.status === 'Chưa có dữ liệu' ? 'text-gray-500' : 'text-rose-600'
                        }`}>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            item.status === 'Tốt' ? 'bg-emerald-100' : 
                            item.status === 'Khá' ? 'bg-blue-100' :
                            item.status === 'Trung Bình' ? 'bg-amber-100' : 
                            item.status === 'Yếu' ? 'bg-rose-100' : 
                            item.status === 'Chưa có dữ liệu' ? 'bg-gray-100' : 'bg-rose-200'
                          }`}>{item.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Stats only */}
          <div className="space-y-6">
            {/* THỐNG KÊ */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-teal-100/30 transition-all duration-300">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <BarChart3 className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-white">THỐNG KÊ</h3>
                </div>
              </div>
              <div className="p-4">
                {/* Filter row - interactive */}
                <div className="grid grid-cols-2 gap-3 text-sm mb-4 p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Xem theo tháng</span>
                    <select 
                      value={`${statsMonth}-${statsYear}`}
                      onChange={(e) => {
                        const [m, y] = e.target.value.split('-').map(Number);
                        setStatsMonth(m);
                        setStatsYear(y);
                      }}
                      className="text-teal-600 font-semibold bg-transparent border-none text-right cursor-pointer focus:outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - i);
                        const val = `${d.getMonth() + 1}-${d.getFullYear()}`;
                        const label = `${d.getMonth() + 1}/${d.getFullYear()}`;
                        return <option key={val} value={val}>{label}</option>;
                      })}
                    </select>
                  </div>
                  <div></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Hạng mục thống kê</span>
                    <select 
                      value={statsCategory}
                      onChange={(e) => setStatsCategory(e.target.value)}
                      className="text-teal-600 font-semibold bg-transparent border-none text-right cursor-pointer focus:outline-none"
                    >
                      <option value="Lương nhân viên">Lương nhân viên</option>
                      <option value="Số lượng học sinh">Số lượng học sinh</option>
                      <option value="Doanh thu">Doanh thu</option>
                    </select>
                  </div>
                  <div></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Kiểu xem</span>
                    <select 
                      value={statsSortOrder}
                      onChange={(e) => setStatsSortOrder(e.target.value)}
                      className="text-teal-600 font-semibold bg-transparent border-none text-right cursor-pointer focus:outline-none"
                    >
                      <option value="asc">Từ thấp tới cao</option>
                      <option value="desc">Từ cao tới thấp</option>
                    </select>
                  </div>
                  <div></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Hiển thị</span>
                    <select 
                      value={statsLimit}
                      onChange={(e) => setStatsLimit(Number(e.target.value))}
                      className="text-teal-600 font-semibold bg-transparent border-none text-right cursor-pointer focus:outline-none"
                    >
                      <option value={5}>TOP 5</option>
                      <option value={10}>TOP 10</option>
                      <option value={20}>TOP 20</option>
                    </select>
                  </div>
                </div>

                {/* Stats table */}
                <table className="w-full text-sm">
                  <thead className="bg-teal-50/50 border-b-2 border-teal-100">
                    <tr>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">Tên nhân viên</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-600">Lương tạm tính</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const sortedData = [...salaryReportData]
                        .sort((a, b) => statsSortOrder === 'asc' 
                          ? a.estimatedSalary - b.estimatedSalary 
                          : b.estimatedSalary - a.estimatedSalary)
                        .slice(0, statsLimit);
                      
                      return sortedData.length > 0 ? (
                        sortedData.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-teal-50/30 transition-colors">
                            <td className="py-2.5 px-3 text-gray-700">{item.staffName}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-teal-600">{formatCurrency(item.estimatedSalary)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="py-6 text-center text-gray-400">
                            <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                            Chưa có dữ liệu lương
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DIỄN GIẢI HẠNG MỤC */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl transition-all duration-300">
              <div className="bg-gradient-to-r from-slate-500 to-gray-600 p-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <ChevronRight className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-white">DIỄN GIẢI HẠNG MỤC</h3>
                </div>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 border-b-2 border-gray-200">
                    <tr>
                      <th className="text-left py-2 font-medium">Hạng mục</th>
                      <th className="text-left py-2 font-medium">Diễn giải</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-700">Tỉ lệ đi học</td>
                      <td className="py-2.5 text-gray-500 italic">Tỉ lệ chuyên cần của toàn trung tâm</td>
                    </tr>
                    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-700">Tỉ lệ bồi bài</td>
                      <td className="py-2.5 text-gray-500 italic">Tỉ lệ nghỉ được bồi</td>
                    </tr>
                    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-700">Số lượng học sinh</td>
                      <td className="py-2.5 text-gray-500 italic">Số học sinh đang học + nợ phí đang học</td>
                    </tr>
                    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-700">Doanh thu thực tế</td>
                      <td className="py-2.5 text-gray-500 italic">Doanh thu thực tế hiện tại</td>
                    </tr>
                    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-700">Lợi nhuận thực tế</td>
                      <td className="py-2.5 text-gray-500 italic">Doanh thu - chi phí GV + trợ giảng</td>
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-700">Lương nhân viên</td>
                      <td className="py-2.5 text-gray-500 italic">Xếp hạng lương nhận được của NV</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Common Widgets Section - All office staff can see (not teachers) */}
        {!isTeacher && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Left Column - Products */}
          <div className="space-y-6">
            {/* Vật phẩm còn lại trong kho */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-amber-100/30 transition-all duration-300">
              <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Box className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-white">VẬT PHẨM CÒN LẠI TRONG KHO</h3>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 text-sm mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <span className="text-gray-600">Hiển thị</span>
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as any)}
                    className="text-amber-600 font-semibold bg-transparent border-none cursor-pointer focus:outline-none"
                  >
                    <option value="low">Sắp hết hàng</option>
                    <option value="all">Tất cả</option>
                  </select>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-amber-50/50 border-b-2 border-amber-100">
                    <tr>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">Tên sản phẩm</th>
                      <th className="text-right py-2.5 px-3 font-medium text-gray-600">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredProducts = stockFilter === 'low'
                        ? allProducts.filter(p => p.stock < (p.minStock || 10))
                        : allProducts;

                      return filteredProducts.length > 0 ? (
                        filteredProducts.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-amber-50/30 transition-colors">
                            <td className="py-2.5 px-3 text-gray-700">{item.name}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${item.stock < 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              <span className={`px-2 py-1 rounded-full ${item.stock < 5 ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                                {item.stock}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="py-8 text-center text-gray-400">
                            <Box size={32} className="mx-auto mb-2 opacity-30" />
                            {stockFilter === 'low' ? 'Không có sản phẩm sắp hết hàng' : 'Chưa có dữ liệu sản phẩm trong kho'}
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Birthdays */}
          <div className="space-y-6">
            {/* SINH NHẬT */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-[#FF6B5A]/10 transition-all duration-300">
              <div className="bg-gradient-to-r from-[#FF6B5A] to-[#FF8F7A] p-4 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Cake className="text-white" size={20} />
                  </div>
                  <h3 className="font-bold text-white">SINH NHẬT</h3>
                </div>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setBirthdayType('staff')}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${
                      birthdayType === 'staff'
                        ? 'bg-white text-[#FF6B5A] shadow-md'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    Nhân sự
                  </button>
                  <button
                    onClick={() => setBirthdayType('student')}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${
                      birthdayType === 'student'
                        ? 'bg-white text-[#FF6B5A] shadow-md'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    Học sinh
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Hiển thị theo</span>
                    <select
                      value={birthdayFilter}
                      onChange={(e) => setBirthdayFilter(e.target.value as any)}
                      className="text-[#FF6B5A] font-semibold bg-transparent border-none cursor-pointer focus:outline-none"
                    >
                      <option value="today">Hôm nay</option>
                      <option value="week">Tuần này</option>
                      <option value="month">Tháng này</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600">Cơ sở</span>
                    <select
                      value={birthdayBranch}
                      onChange={(e) => setBirthdayBranch(e.target.value)}
                      className="text-[#FF6B5A] font-semibold bg-transparent border-none cursor-pointer focus:outline-none"
                    >
                      <option value="all">Tất cả</option>
                      {centerList.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-orange-50/50 border-b-2 border-orange-100">
                    <tr>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">{birthdayType === 'staff' ? 'Tên nhân sự' : 'Tên học viên'}</th>
                      <th className="text-center py-2.5 px-3 font-medium text-gray-600">Ngày SN</th>
                      {birthdayType === 'student' && (
                        <>
                          <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap">Chuẩn bị</th>
                          <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap">Đã tặng</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const now = new Date();
                      const today = now.getDate();
                      const thisMonth = now.getMonth();
                      const thisYear = now.getFullYear();

                      const birthdayData = birthdayType === 'staff' ? stats.upcomingBirthdays : stats.studentBirthdays;

                      const filteredBirthdays = birthdayData.filter((item: any) => {
                        const [day, month] = item.date.split('/').map(Number);

                        // Filter by branch for both staff and students
                        if (birthdayBranch !== 'all') {
                          if (item.branch !== birthdayBranch) return false;
                        }

                        if (birthdayFilter === 'today') {
                          return day === today && month === thisMonth + 1;
                        } else if (birthdayFilter === 'week') {
                          const bdayThisYear = new Date(thisYear, month - 1, day);
                          const diffDays = Math.ceil((bdayThisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          return diffDays >= 0 && diffDays <= 7;
                        } else {
                          return month === thisMonth + 1;
                        }
                      });

                      return filteredBirthdays.length > 0 ? (
                        filteredBirthdays.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                            <td className="py-2.5 px-3 text-gray-700">{item.name}</td>
                            <td className="py-2.5 px-3 text-center font-medium text-[#FF6B5A]">{item.date}</td>
                            {birthdayType === 'student' && (
                              <>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    onClick={() => toggleGiftStatus(item.id, item.name, 'giftPrepared')}
                                    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                                      birthdayGifts[item.id]?.giftPrepared
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-gray-300 hover:border-emerald-400'
                                    }`}
                                    title="Đã chuẩn bị quà"
                                  >
                                    {birthdayGifts[item.id]?.giftPrepared && <Gift size={14} />}
                                  </button>
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    onClick={() => toggleGiftStatus(item.id, item.name, 'giftGiven')}
                                    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                                      birthdayGifts[item.id]?.giftGiven
                                        ? 'bg-[#FF6B5A] border-[#FF6B5A] text-white'
                                        : 'border-gray-300 hover:border-[#FF6B5A]'
                                    }`}
                                    title="Đã tặng quà"
                                  >
                                    {birthdayGifts[item.id]?.giftGiven && <Heart size={14} />}
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={birthdayType === 'student' ? 4 : 2} className="py-6 text-center text-gray-400">
                            <Cake size={32} className="mx-auto mb-2 opacity-30" />
                            Không có sinh nhật {birthdayFilter === 'today' ? 'hôm nay' : birthdayFilter === 'week' ? 'tuần này' : 'tháng này'}
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Dev Tools - Hidden (uncomment for development)
      <div className="fixed bottom-4 right-4 z-40 flex gap-2">
        <button
          onClick={handleSeedData}
          disabled={seeding}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
        >
          {seeding ? '⏳ Đang xử lý...' : '🌱 Seed Data'}
        </button>
        <button
          onClick={handleClearData}
          disabled={seeding}
          className="bg-rose-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-rose-700 disabled:opacity-50 text-sm font-medium"
        >
          {seeding ? '⏳ Đang xử lý...' : '🗑️ Xóa Data'}
        </button>
      </div>
      */}

      {/* Modal danh sách học viên */}
      {showStudentModal && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: stats.studentsByStatus.find(s => s.name === selectedCategory)?.color || '#3b82f6' }}>
              <h2 className="text-lg font-bold text-white">
                Danh sách học viên: {selectedCategory}
              </h2>
              <button
                onClick={() => setShowStudentModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Không có học viên trong danh mục này</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-gray-500 mb-3">
                    Tổng: {filteredStudents.length} học viên
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="text-left p-2">STT</th>
                        <th className="text-left p-2">Họ tên</th>
                        <th className="text-left p-2">Lớp</th>
                        <th className="text-left p-2">Liên hệ</th>
                        <th className="text-left p-2">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredStudents.map((student, idx) => (
                        <tr key={student.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-gray-500">{idx + 1}</td>
                          <td className="p-2 font-medium">{student.fullName}</td>
                          <td className="p-2">{student.className || student.currentClassName || '-'}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              {student.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {student.phone}
                                </span>
                              )}
                              {student.parentPhone && !student.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {student.parentPhone} (PH)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              student.hasDebt ? 'bg-red-100 text-red-700' :
                              student.status === 'Trial' || student.status === 'Học thử' ? 'bg-orange-100 text-orange-700' :
                              student.status === 'Reserved' || student.status === 'Bảo lưu' ? 'bg-yellow-100 text-yellow-700' :
                              student.status === 'Dropped' || student.status === 'Nghỉ học' ? 'bg-gray-100 text-gray-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {student.status || (student.hasDebt ? 'Nợ phí' : 'HV mới')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowStudentModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
