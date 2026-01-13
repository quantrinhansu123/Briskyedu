/**
 * Permission Service
 * Quản lý phân quyền theo phòng ban và vị trí
 */

// Định nghĩa các Role (11 roles)
export type UserRole =
  // Điều Hành
  | 'admin'           // Quản lý (Admin) - Full quyền
  // Đào Tạo
  | 'gv_viet'         // Giáo viên Việt
  | 'gv_nuocngoai'    // Giáo viên nước ngoài
  | 'tro_giang'       // Trợ giảng
  // Văn Phòng - CSKH
  | 'cskh_lead'       // Trưởng Nhóm CSKH (sees revenue)
  | 'cskh_staff'      // NV CSKH (no revenue)
  // Văn Phòng - CM (Chuyên Môn)
  | 'cm_lead'         // Trưởng Nhóm CM (same as cskh_lead)
  | 'cm_staff'        // NV CM (same as cskh_staff)
  // Văn Phòng - Sale
  | 'sale_lead'       // Trưởng Nhóm Sale (same as cskh_lead)
  | 'sale_staff'      // NV Sale (same as cskh_staff)
  // Văn Phòng - Kế Toán
  | 'ketoan';         // Kế toán

// Định nghĩa các Module
export type ModuleKey =
  | 'dashboard'
  | 'classes'
  | 'schedule'
  | 'holidays'
  | 'attendance'
  | 'attendance_history'
  | 'enrollment_history'
  | 'tutoring'
  | 'homework'
  | 'students'
  | 'students_reserved'
  | 'students_dropped'
  | 'students_trial'
  | 'parents'
  | 'feedback'
  | 'leads'
  | 'campaigns'
  | 'staff'
  | 'salary_config'
  | 'work_confirmation'
  | 'leave_request'
  | 'salary_teacher'
  | 'salary_staff'
  | 'contracts'
  | 'invoices'
  | 'revenue'
  | 'debt'
  | 'reports_training'
  | 'reports_finance'
  | 'reports_learning'    // Báo cáo Học Tập (MonthlyReport)
  | 'settings'
  | 'reward_penalty'      // Gap #6: Thưởng/Phạt
  | 'personal_profile'    // Gap #7: Thông tin cá nhân
  | 'checkin'             // Staff check-in
  | 'wifi_management';    // WiFi management (admin only)

// Định nghĩa quyền cho từng action
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';

// Định nghĩa quyền đặc biệt
export interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve?: boolean;
  // Các điều kiện đặc biệt
  onlyOwnClasses?: boolean;      // Chỉ xem lớp mình dạy
  hideParentPhone?: boolean;      // Ẩn SĐT phụ huynh
  requireApproval?: boolean;      // Cần admin duyệt
  onlyOwnData?: boolean;          // Chỉ xem data của mình (Gap #4)
  onlyUpdateStatus?: boolean;     // Chỉ update status, không edit full (Gap #5)
}

// Permission matrix theo role
export const ROLE_PERMISSIONS: Record<UserRole, Partial<Record<ModuleKey, ModulePermission>>> = {
  // ========================================
  // ADMIN - Full quyền
  // ========================================
  admin: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    classes: { view: true, create: true, edit: true, delete: true },
    schedule: { view: true, create: true, edit: true, delete: true },
    holidays: { view: true, create: true, edit: true, delete: true },
    attendance: { view: true, create: true, edit: true, delete: true },
    attendance_history: { view: true, create: true, edit: true, delete: true },
    enrollment_history: { view: true, create: true, edit: true, delete: true },
    tutoring: { view: true, create: true, edit: true, delete: true },
    homework: { view: true, create: true, edit: true, delete: true },
    students: { view: true, create: true, edit: true, delete: true },
    students_reserved: { view: true, create: true, edit: true, delete: true },
    students_dropped: { view: true, create: true, edit: true, delete: true },
    students_trial: { view: true, create: true, edit: true, delete: true },
    parents: { view: true, create: true, edit: true, delete: true },
    feedback: { view: true, create: true, edit: true, delete: true },
    leads: { view: true, create: true, edit: true, delete: true },
    campaigns: { view: true, create: true, edit: true, delete: true },
    staff: { view: true, create: true, edit: true, delete: true },
    salary_config: { view: true, create: true, edit: true, delete: true },
    work_confirmation: { view: true, create: true, edit: true, delete: true, approve: true },
    leave_request: { view: true, create: true, edit: true, delete: true, approve: true },
    salary_teacher: { view: true, create: true, edit: true, delete: true },
    salary_staff: { view: true, create: true, edit: true, delete: true },
    contracts: { view: true, create: true, edit: true, delete: true },
    invoices: { view: true, create: true, edit: true, delete: true, approve: true },
    revenue: { view: true, create: true, edit: true, delete: true },
    debt: { view: true, create: true, edit: true, delete: true },
    reports_training: { view: true, create: true, edit: true, delete: true },
    reports_finance: { view: true, create: true, edit: true, delete: true },
    reports_learning: { view: true, create: true, edit: true, delete: true },
    settings: { view: true, create: true, edit: true, delete: true },
    reward_penalty: { view: true, create: true, edit: true, delete: true },
    personal_profile: { view: true, create: false, edit: true, delete: false },
    checkin: { view: true, create: true, edit: true, delete: true },
    wifi_management: { view: true, create: true, edit: true, delete: true },
  },

  // ========================================
  // CSKH_LEAD - Trưởng Nhóm CSKH (Văn phòng)
  // Can see revenue
  // ========================================
  cskh_lead: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: true, edit: true, delete: false },
    schedule: { view: true, create: true, edit: true, delete: false },
    holidays: { view: true, create: true, edit: true, delete: false },
    attendance: { view: true, create: true, edit: true, delete: false },
    attendance_history: { view: true, create: false, edit: false, delete: false },
    enrollment_history: { view: true, create: true, edit: true, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false },
    homework: { view: true, create: true, edit: true, delete: false },
    students: { view: true, create: true, edit: true, delete: false },
    students_reserved: { view: true, create: true, edit: true, delete: false },
    students_dropped: { view: true, create: true, edit: true, delete: false },
    students_trial: { view: true, create: true, edit: true, delete: false },
    parents: { view: true, create: true, edit: true, delete: false },
    feedback: { view: true, create: true, edit: true, delete: false },
    leads: { view: true, create: true, edit: true, delete: false },
    campaigns: { view: true, create: true, edit: true, delete: false },
    staff: { view: true, create: false, edit: false, delete: false },
    salary_config: { view: false, create: false, edit: false, delete: false },
    work_confirmation: { view: true, create: true, edit: true, delete: false, approve: true },
    leave_request: { view: true, create: true, edit: true, delete: false, approve: true },
    salary_teacher: { view: false, create: false, edit: false, delete: false }, // CSKH Lead không phải GV/TG
    salary_staff: { view: true, create: false, edit: false, delete: false, onlyOwnData: true }, // Xem lương NV của mình
    contracts: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false, requireApproval: true },
    revenue: { view: true, create: false, edit: false, delete: false }, // CAN SEE REVENUE
    debt: { view: true, create: true, edit: true, delete: false },
    reports_training: { view: true, create: false, edit: false, delete: false },
    reports_finance: { view: true, create: false, edit: false, delete: false },
    reports_learning: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    reward_penalty: { view: true, create: false, edit: false, delete: false },
    personal_profile: { view: true, create: false, edit: true, delete: false },
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // CSKH_STAFF - NV CSKH (Văn phòng)
  // Cannot see revenue
  // ========================================
  cskh_staff: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false },    // Staff: view only per spec
    schedule: { view: true, create: false, edit: false, delete: false },   // Staff: view only per spec
    holidays: { view: true, create: false, edit: false, delete: false },   // Staff: view only per spec
    attendance: { view: true, create: true, edit: true, delete: false },
    attendance_history: { view: true, create: false, edit: false, delete: false },
    enrollment_history: { view: true, create: true, edit: true, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false },
    homework: { view: true, create: true, edit: true, delete: false },
    students: { view: true, create: true, edit: true, delete: false },
    students_reserved: { view: true, create: true, edit: true, delete: false },
    students_dropped: { view: true, create: true, edit: true, delete: false },
    students_trial: { view: true, create: true, edit: true, delete: false },
    parents: { view: true, create: true, edit: true, delete: false },
    feedback: { view: true, create: true, edit: true, delete: false },
    leads: { view: true, create: true, edit: true, delete: false, onlyUpdateStatus: true }, // Gap #5: Chỉ update trạng thái
    campaigns: { view: true, create: false, edit: false, delete: false }, // Gap #4: Không tạo/sửa chiến dịch
    staff: { view: false, create: false, edit: false, delete: false }, // Gap #3: Ẩn danh sách nhân viên
    salary_config: { view: false, create: false, edit: false, delete: false },
    work_confirmation: { view: true, create: true, edit: true, delete: false, approve: false }, // Cannot approve
    leave_request: { view: true, create: true, edit: true, delete: false, approve: false },
    salary_teacher: { view: false, create: false, edit: false, delete: false }, // CSKH Staff không phải GV/TG
    salary_staff: { view: true, create: false, edit: false, delete: false, onlyOwnData: true }, // Xem lương NV của mình
    contracts: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false, requireApproval: true },
    revenue: { view: false, create: false, edit: false, delete: false }, // CANNOT SEE REVENUE
    debt: { view: false, create: false, edit: false, delete: false }, // Ẩn công nợ khỏi CSKH Staff
    reports_training: { view: true, create: false, edit: false, delete: false },
    reports_finance: { view: false, create: false, edit: false, delete: false }, // No finance reports
    reports_learning: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    reward_penalty: { view: true, create: false, edit: false, delete: false },
    personal_profile: { view: true, create: false, edit: true, delete: false },
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // CM_LEAD - Trưởng Nhóm Chuyên Môn (Văn phòng)
  // Gap fixes: #1 leads, #2 campaigns, #3 staff, #4 salary_teacher, #5 finance, #6 reports_finance
  // ========================================
  cm_lead: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: true, edit: true, delete: false },
    schedule: { view: true, create: true, edit: true, delete: false },
    holidays: { view: true, create: true, edit: true, delete: false },
    attendance: { view: true, create: true, edit: true, delete: false },
    attendance_history: { view: true, create: false, edit: false, delete: false },
    enrollment_history: { view: true, create: true, edit: true, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false },
    homework: { view: true, create: true, edit: true, delete: false },
    students: { view: true, create: true, edit: true, delete: false },
    students_reserved: { view: true, create: true, edit: true, delete: false },
    students_dropped: { view: true, create: true, edit: true, delete: false },
    students_trial: { view: true, create: true, edit: true, delete: false },
    parents: { view: true, create: true, edit: true, delete: false },
    feedback: { view: true, create: true, edit: true, delete: false },
    leads: { view: false, create: false, edit: false, delete: false }, // Gap #1: Hide Kinh Doanh
    campaigns: { view: false, create: false, edit: false, delete: false }, // Gap #2: Hide Kinh Doanh
    staff: { view: false, create: false, edit: false, delete: false }, // Gap #3: Hide staff list
    salary_config: { view: false, create: false, edit: false, delete: false },
    work_confirmation: { view: true, create: true, edit: true, delete: false, approve: true },
    leave_request: { view: true, create: true, edit: true, delete: false, approve: true },
    salary_teacher: { view: false, create: false, edit: false, delete: false }, // CM Lead không phải GV/TG
    salary_staff: { view: true, create: false, edit: false, delete: false, onlyOwnData: true }, // Xem lương NV của mình
    contracts: { view: false, create: false, edit: false, delete: false }, // Gap #5: Hide Tài Chính
    invoices: { view: false, create: false, edit: false, delete: false }, // Gap #5: Hide Tài Chính
    revenue: { view: false, create: false, edit: false, delete: false }, // Gap #5: Hide Tài Chính
    debt: { view: false, create: false, edit: false, delete: false }, // Gap #5: Hide Tài Chính
    reports_training: { view: true, create: false, edit: false, delete: false },
    reports_finance: { view: false, create: false, edit: false, delete: false }, // Gap #6: Hide reports_finance
    reports_learning: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    reward_penalty: { view: true, create: false, edit: false, delete: false },
    personal_profile: { view: true, create: false, edit: true, delete: false },
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // CM_STAFF - NV Chuyên Môn (Văn phòng)
  // Gap fixes: #7 leads, #8 campaigns, #9 staff, #10 salary_teacher, #11 finance
  // ========================================
  cm_staff: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false },    // Staff: view only per spec
    schedule: { view: true, create: false, edit: false, delete: false },   // Staff: view only per spec
    holidays: { view: true, create: false, edit: false, delete: false },   // Staff: view only per spec
    attendance: { view: true, create: true, edit: true, delete: false },
    attendance_history: { view: true, create: false, edit: false, delete: false },
    enrollment_history: { view: true, create: true, edit: true, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false },
    homework: { view: true, create: true, edit: true, delete: false },
    students: { view: true, create: true, edit: true, delete: false },
    students_reserved: { view: true, create: true, edit: true, delete: false },
    students_dropped: { view: true, create: true, edit: true, delete: false },
    students_trial: { view: true, create: true, edit: true, delete: false },
    parents: { view: true, create: true, edit: true, delete: false },
    feedback: { view: true, create: true, edit: true, delete: false },
    leads: { view: false, create: false, edit: false, delete: false }, // Gap #7: Hide Kinh Doanh
    campaigns: { view: false, create: false, edit: false, delete: false }, // Gap #8: Hide Kinh Doanh
    staff: { view: false, create: false, edit: false, delete: false }, // Gap #9: Hide staff list
    salary_config: { view: false, create: false, edit: false, delete: false },
    work_confirmation: { view: true, create: true, edit: true, delete: false, approve: false },
    leave_request: { view: true, create: true, edit: true, delete: false, approve: false },
    salary_teacher: { view: false, create: false, edit: false, delete: false }, // CM Staff không phải GV/TG
    salary_staff: { view: true, create: false, edit: false, delete: false, onlyOwnData: true }, // Xem lương NV của mình
    contracts: { view: false, create: false, edit: false, delete: false }, // Gap #11: Hide Tài Chính
    invoices: { view: false, create: false, edit: false, delete: false }, // Gap #11: Hide Tài Chính
    revenue: { view: false, create: false, edit: false, delete: false }, // CANNOT SEE REVENUE
    debt: { view: false, create: false, edit: false, delete: false }, // Gap #11: Hide Tài Chính
    reports_training: { view: true, create: false, edit: false, delete: false },
    reports_finance: { view: false, create: false, edit: false, delete: false },
    reports_learning: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    reward_penalty: { view: true, create: false, edit: false, delete: false },
    personal_profile: { view: true, create: false, edit: true, delete: false },
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // SALE_LEAD - Trưởng Nhóm Sale (Văn phòng)
  // Gap fix: #1 salary_teacher (same as cskh_lead)
  // ========================================
  sale_lead: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: true, edit: true, delete: false },
    schedule: { view: true, create: true, edit: true, delete: false },
    holidays: { view: true, create: true, edit: true, delete: false },
    attendance: { view: true, create: true, edit: true, delete: false },
    attendance_history: { view: true, create: false, edit: false, delete: false },
    enrollment_history: { view: true, create: true, edit: true, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false },
    homework: { view: true, create: true, edit: true, delete: false },
    students: { view: true, create: true, edit: true, delete: false },
    students_reserved: { view: true, create: true, edit: true, delete: false },
    students_dropped: { view: true, create: true, edit: true, delete: false },
    students_trial: { view: true, create: true, edit: true, delete: false },
    parents: { view: true, create: true, edit: true, delete: false },
    feedback: { view: true, create: true, edit: true, delete: false },
    leads: { view: true, create: true, edit: true, delete: false },
    campaigns: { view: true, create: true, edit: true, delete: false },
    staff: { view: true, create: false, edit: false, delete: false },
    salary_config: { view: false, create: false, edit: false, delete: false },
    work_confirmation: { view: true, create: true, edit: true, delete: false, approve: true },
    leave_request: { view: true, create: true, edit: true, delete: false, approve: true },
    salary_teacher: { view: false, create: false, edit: false, delete: false }, // Sale Lead không phải GV/TG
    salary_staff: { view: true, create: false, edit: false, delete: false, onlyOwnData: true }, // Xem lương NV của mình
    contracts: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false, requireApproval: true },
    revenue: { view: true, create: false, edit: false, delete: false }, // CAN SEE REVENUE
    debt: { view: true, create: true, edit: true, delete: false },
    reports_training: { view: true, create: false, edit: false, delete: false },
    reports_finance: { view: true, create: false, edit: false, delete: false },
    reports_learning: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    reward_penalty: { view: true, create: false, edit: false, delete: false },
    personal_profile: { view: true, create: false, edit: true, delete: false },
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // SALE_STAFF - NV Sale (Văn phòng)
  // Gap fixes: #2 leads, #3 campaigns, #4 staff, #5 salary_teacher (same as cskh_staff)
  // ========================================
  sale_staff: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false },    // Staff: view only per spec
    schedule: { view: true, create: false, edit: false, delete: false },   // Staff: view only per spec
    holidays: { view: true, create: false, edit: false, delete: false },   // Staff: view only per spec
    attendance: { view: true, create: true, edit: true, delete: false },
    attendance_history: { view: true, create: false, edit: false, delete: false },
    enrollment_history: { view: true, create: true, edit: true, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false },
    homework: { view: true, create: true, edit: true, delete: false },
    students: { view: true, create: true, edit: true, delete: false },
    students_reserved: { view: true, create: true, edit: true, delete: false },
    students_dropped: { view: true, create: true, edit: true, delete: false },
    students_trial: { view: true, create: true, edit: true, delete: false },
    parents: { view: true, create: true, edit: true, delete: false },
    feedback: { view: true, create: true, edit: true, delete: false },
    leads: { view: true, create: true, edit: true, delete: false, onlyUpdateStatus: true }, // Gap #2: Only update status
    campaigns: { view: true, create: false, edit: false, delete: false }, // Gap #3: Read-only
    staff: { view: false, create: false, edit: false, delete: false }, // Gap #4: Hidden
    salary_config: { view: false, create: false, edit: false, delete: false },
    work_confirmation: { view: true, create: true, edit: true, delete: false, approve: false }, // Cannot approve
    leave_request: { view: true, create: true, edit: true, delete: false, approve: false },
    salary_teacher: { view: false, create: false, edit: false, delete: false }, // Sale Staff không phải GV/TG
    salary_staff: { view: true, create: false, edit: false, delete: false, onlyOwnData: true }, // Xem lương NV của mình
    contracts: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false, requireApproval: true },
    revenue: { view: false, create: false, edit: false, delete: false }, // CANNOT SEE REVENUE
    debt: { view: true, create: true, edit: true, delete: false },
    reports_training: { view: true, create: false, edit: false, delete: false },
    reports_finance: { view: false, create: false, edit: false, delete: false }, // No finance reports
    reports_learning: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    reward_penalty: { view: true, create: false, edit: false, delete: false },
    personal_profile: { view: true, create: false, edit: true, delete: false },
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // KẾ TOÁN (Văn phòng)
  // Gap fixes: #12-14 Đào Tạo mgmt, #15-17 Đào Tạo ops, #18 invoices no delete, #19 reports_training
  // ========================================
  ketoan: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: true, edit: true, delete: false }, // Gap #12: Full Đào Tạo access
    schedule: { view: true, create: true, edit: true, delete: false }, // Gap #13: Full Đào Tạo access
    holidays: { view: true, create: true, edit: true, delete: false }, // Gap #14: Full Đào Tạo access
    attendance: { view: true, create: true, edit: true, delete: false }, // Gap #15: Full Đào Tạo operations
    attendance_history: { view: true, create: false, edit: false, delete: false },
    enrollment_history: { view: true, create: false, edit: false, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false }, // Gap #16: Full Đào Tạo operations
    homework: { view: true, create: true, edit: true, delete: false }, // Gap #17: Full Đào Tạo operations
    students: { view: true, create: false, edit: false, delete: false },
    students_reserved: { view: true, create: false, edit: false, delete: false },
    students_dropped: { view: true, create: false, edit: false, delete: false },
    students_trial: { view: false, create: false, edit: false, delete: false },
    parents: { view: true, create: false, edit: false, delete: false },
    feedback: { view: false, create: false, edit: false, delete: false },
    leads: { view: false, create: false, edit: false, delete: false },
    campaigns: { view: false, create: false, edit: false, delete: false },
    staff: { view: true, create: false, edit: false, delete: false },
    salary_config: { view: true, create: true, edit: true, delete: false },
    work_confirmation: { view: true, create: false, edit: false, delete: false },
    leave_request: { view: true, create: true, edit: false, delete: false }, // Xem tất cả, tạo riêng
    salary_teacher: { view: true, create: true, edit: true, delete: false },
    salary_staff: { view: true, create: true, edit: true, delete: false },
    contracts: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false }, // Gap #18: NO DELETE
    revenue: { view: true, create: true, edit: true, delete: false },
    debt: { view: true, create: true, edit: true, delete: false },
    reports_training: { view: true, create: false, edit: false, delete: false }, // Gap #19: Can view reports_training
    reports_finance: { view: true, create: true, edit: false, delete: false },
    reports_learning: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    reward_penalty: { view: true, create: false, edit: false, delete: false },
    personal_profile: { view: true, create: false, edit: true, delete: false },
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // GIÁO VIÊN VIỆT (Đào tạo)
  // Gap fixes: #1 students, #2 feedback, #3 staff, #4 salary_config, #5 work_confirmation
  // ========================================
  gv_viet: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true, hideParentPhone: true },
    schedule: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    holidays: { view: true, create: false, edit: false, delete: false }, // VIEW ONLY per spec
    attendance: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    attendance_history: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    enrollment_history: { view: false, create: false, edit: false, delete: false }, // Ẩn
    tutoring: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    homework: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    students: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true }, // View only, own classes
    students_reserved: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    students_dropped: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    students_trial: { view: false, create: false, edit: false, delete: false }, // Ẩn
    parents: { view: false, create: false, edit: false, delete: false }, // Ẩn
    feedback: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true }, // Chỉ xem, không tạo
    leads: { view: false, create: false, edit: false, delete: false }, // Ẩn
    campaigns: { view: false, create: false, edit: false, delete: false }, // Ẩn
    staff: { view: false, create: false, edit: false, delete: false }, // Ẩn danh sách nhân viên
    salary_config: { view: true, create: false, edit: false, delete: false, onlyOwnData: true }, // Xem cấu hình lương của mình
    work_confirmation: { view: false, create: false, edit: false, delete: false }, // Ẩn xác nhận công
    leave_request: { view: true, create: true, edit: false, delete: false }, // Xem riêng, tạo nghỉ phép
    salary_teacher: { view: true, create: false, edit: false, delete: false }, // Chỉ xem lương của mình
    salary_staff: { view: false, create: false, edit: false, delete: false }, // Ẩn
    contracts: { view: false, create: false, edit: false, delete: false }, // Ẩn
    invoices: { view: false, create: false, edit: false, delete: false }, // Ẩn
    revenue: { view: false, create: false, edit: false, delete: false }, // Ẩn
    debt: { view: false, create: false, edit: false, delete: false }, // Ẩn
    reports_training: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    reports_finance: { view: false, create: false, edit: false, delete: false }, // Ẩn
    reports_learning: { view: false, create: false, edit: false, delete: false }, // GV không có access Học Tập
    settings: { view: false, create: false, edit: false, delete: false }, // Ẩn
    reward_penalty: { view: true, create: false, edit: false, delete: false }, // Hiển thị All
    personal_profile: { view: true, create: false, edit: true, delete: false }, // Sửa thông tin cá nhân
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // GIÁO VIÊN NƯỚC NGOÀI (Đào tạo)
  // Gap fixes: #1 students, #2 feedback, #3 staff, #4 salary_config, #5 work_confirmation
  // ========================================
  gv_nuocngoai: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true, hideParentPhone: true },
    schedule: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    holidays: { view: true, create: false, edit: false, delete: false }, // VIEW ONLY per spec
    attendance: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    attendance_history: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    enrollment_history: { view: false, create: false, edit: false, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    homework: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    students: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true }, // View only, own classes
    students_reserved: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    students_dropped: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    students_trial: { view: false, create: false, edit: false, delete: false },
    parents: { view: false, create: false, edit: false, delete: false },
    feedback: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true }, // Chỉ xem, không tạo
    leads: { view: false, create: false, edit: false, delete: false },
    campaigns: { view: false, create: false, edit: false, delete: false },
    staff: { view: false, create: false, edit: false, delete: false }, // Ẩn danh sách nhân viên
    salary_config: { view: true, create: false, edit: false, delete: false, onlyOwnData: true }, // Xem cấu hình lương của mình
    work_confirmation: { view: false, create: false, edit: false, delete: false }, // Ẩn xác nhận công
    salary_teacher: { view: true, create: false, edit: false, delete: false },
    salary_staff: { view: false, create: false, edit: false, delete: false },
    contracts: { view: false, create: false, edit: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    revenue: { view: false, create: false, edit: false, delete: false },
    debt: { view: false, create: false, edit: false, delete: false },
    reports_training: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    reports_finance: { view: false, create: false, edit: false, delete: false },
    reports_learning: { view: false, create: false, edit: false, delete: false }, // GV không có access Học Tập
    settings: { view: false, create: false, edit: false, delete: false },
    reward_penalty: { view: true, create: false, edit: false, delete: false }, // Hiển thị All
    personal_profile: { view: true, create: false, edit: true, delete: false }, // Sửa thông tin cá nhân
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // TRỢ GIẢNG (Đào tạo)
  // Gap fixes: #1 students, #2 feedback, #3 staff, #4 salary_config, #5 work_confirmation
  // ========================================
  tro_giang: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true, hideParentPhone: true },
    schedule: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    holidays: { view: true, create: false, edit: false, delete: false }, // VIEW ONLY per spec
    attendance: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    attendance_history: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    enrollment_history: { view: false, create: false, edit: false, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    homework: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    students: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true }, // View only, own classes
    students_reserved: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    students_dropped: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    students_trial: { view: false, create: false, edit: false, delete: false },
    parents: { view: false, create: false, edit: false, delete: false },
    feedback: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true }, // Chỉ xem, không tạo
    leads: { view: false, create: false, edit: false, delete: false },
    campaigns: { view: false, create: false, edit: false, delete: false },
    staff: { view: false, create: false, edit: false, delete: false }, // Ẩn danh sách nhân viên
    salary_config: { view: true, create: false, edit: false, delete: false, onlyOwnData: true }, // Xem cấu hình lương của mình
    work_confirmation: { view: false, create: false, edit: false, delete: false }, // Ẩn xác nhận công
    salary_teacher: { view: true, create: false, edit: false, delete: false },
    salary_staff: { view: false, create: false, edit: false, delete: false },
    contracts: { view: false, create: false, edit: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    revenue: { view: false, create: false, edit: false, delete: false },
    debt: { view: false, create: false, edit: false, delete: false },
    reports_training: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    reports_finance: { view: false, create: false, edit: false, delete: false },
    reports_learning: { view: false, create: false, edit: false, delete: false }, // GV không có access Học Tập
    settings: { view: false, create: false, edit: false, delete: false },
    reward_penalty: { view: true, create: false, edit: false, delete: false }, // Hiển thị All
    personal_profile: { view: true, create: false, edit: true, delete: false }, // Sửa thông tin cá nhân
    checkin: { view: true, create: true, edit: false, delete: false },
    wifi_management: { view: false, create: false, edit: false, delete: false },
  },
};

// Map position string to role
export const POSITION_TO_ROLE: Record<string, UserRole> = {
  // ========================================
  // Điều Hành - Admin variations
  // ========================================
  'Quản lý (Admin)': 'admin',
  'Quản trị viên': 'admin',
  'Quản lý': 'admin',
  'Admin': 'admin',
  'admin': 'admin',

  // ========================================
  // Đào Tạo - Giáo viên Việt variations
  // ========================================
  'Giáo Viên Việt': 'gv_viet',
  'Giáo viên Việt': 'gv_viet',
  'GV Việt': 'gv_viet',
  'Giáo viên': 'gv_viet', // Default teacher

  // ========================================
  // Đào Tạo - Giáo viên nước ngoài variations
  // ========================================
  'Giáo Viên Nước Ngoài': 'gv_nuocngoai',
  'Giáo viên nước ngoài': 'gv_nuocngoai',
  'GV Ngoại': 'gv_nuocngoai',
  'GV NN': 'gv_nuocngoai',
  'GVNN': 'gv_nuocngoai',

  // ========================================
  // Đào Tạo - Trợ giảng variations
  // ========================================
  'Trợ Giảng': 'tro_giang',
  'Trợ giảng': 'tro_giang',
  'TG': 'tro_giang',

  // ========================================
  // Văn Phòng - CSKH
  // ========================================
  'Trưởng Nhóm CSKH': 'cskh_lead',
  'NV CSKH': 'cskh_staff',
  'Tư vấn viên': 'cskh_staff',
  'Lễ tân': 'cskh_staff',
  'CSKH': 'cskh_staff',
  'Nhân viên': 'cskh_staff', // Default office staff

  // ========================================
  // Văn Phòng - CM (Chuyên Môn / Học Thuật)
  // ========================================
  'Trưởng Nhóm CM': 'cm_lead',
  'Trưởng Nhóm Học Thuật': 'cm_lead',
  'Trưởng Nhóm Chuyên Môn': 'cm_lead',
  'CM Leader': 'cm_lead',
  'NV CM': 'cm_staff',
  'NV Chuyên Môn': 'cm_staff',

  // ========================================
  // Văn Phòng - Kế Toán
  // ========================================
  'Kế toán': 'ketoan',
  'Kế Toán': 'ketoan',

  // ========================================
  // Văn Phòng - Sale
  // ========================================
  'Trưởng Nhóm Sale': 'sale_lead',
  'NV Sale': 'sale_staff',
  'Sale': 'sale_staff',
};

// Helper functions
export const getRoleFromPosition = (position: string): UserRole => {
  return POSITION_TO_ROLE[position] || 'cskh_staff'; // Default to restricted role
};

// Role category helpers
export const isTeamLead = (role: UserRole): boolean => {
  return ['admin', 'cskh_lead', 'cm_lead', 'sale_lead'].includes(role);
};

export const canSeeRevenue = (role: UserRole): boolean => {
  // CM Lead should NOT see revenue (per spec Image 1)
  return ['admin', 'cskh_lead', 'sale_lead', 'ketoan'].includes(role);
};

// Can see ALL salary data (not just own)
// Only Admin and KeToan have this privilege (per spec)
export const canSeeAllSalaries = (role: UserRole): boolean => {
  return ['admin', 'ketoan'].includes(role);
};

export const isTeacher = (role: UserRole): boolean => {
  return ['gv_viet', 'gv_nuocngoai', 'tro_giang'].includes(role);
};

export const isOfficeStaff = (role: UserRole): boolean => {
  return ['cskh_lead', 'cskh_staff', 'cm_lead', 'cm_staff', 'sale_lead', 'sale_staff', 'ketoan'].includes(role);
};

// CSKH role checks (for dashboard routing)
export const isCSKH = (role: UserRole): boolean => {
  return ['cskh_lead', 'cskh_staff'].includes(role);
};

export const isCSKHLeader = (role: UserRole): boolean => {
  return role === 'cskh_lead';
};

export const isKeToan = (role: UserRole): boolean => {
  return role === 'ketoan';
};

export const hasPermission = (
  role: UserRole,
  module: ModuleKey,
  action: PermissionAction
): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  if (!permissions) return false;
  return permissions[action] === true;
};

export const getModulePermission = (
  role: UserRole,
  module: ModuleKey
): ModulePermission | null => {
  return ROLE_PERMISSIONS[role]?.[module] || null;
};

export const canView = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'view');
};

export const canCreate = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'create');
};

export const canEdit = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'edit');
};

export const canDelete = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'delete');
};

export const canApprove = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'approve');
};

export const shouldShowOnlyOwnClasses = (role: UserRole, module: ModuleKey): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  return permissions?.onlyOwnClasses === true;
};

export const shouldHideParentPhone = (role: UserRole, module: ModuleKey): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  return permissions?.hideParentPhone === true;
};

export const requiresApproval = (role: UserRole, module: ModuleKey): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  return permissions?.requireApproval === true;
};

export const shouldShowOnlyOwnData = (role: UserRole, module: ModuleKey): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  return permissions?.onlyOwnData === true;
};

export const shouldOnlyUpdateStatus = (role: UserRole, module: ModuleKey): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  return permissions?.onlyUpdateStatus === true;
};

// Get visible menu items for a role
export const getVisibleMenuItems = (role: UserRole): ModuleKey[] => {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return [];

  return Object.entries(permissions)
    .filter(([_, perm]) => perm.view)
    .map(([module]) => module as ModuleKey);
};
