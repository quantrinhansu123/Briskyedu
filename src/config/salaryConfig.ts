/**
 * Position-based Salary Configuration
 * Defines salary multipliers and bonus eligibility for each position
 */

import { PositionSalaryConfig } from '../../types';

// Position salary configurations
// baseMultiplier: 1.0 = staff, 1.3 = lead, 1.5 = management
export const POSITION_SALARY_CONFIG: Record<string, PositionSalaryConfig> = {
  // CSKH Team
  'Trưởng Nhóm CSKH': {
    position: 'Trưởng Nhóm CSKH',
    baseMultiplier: 1.3,
    hasKpiBonus: true,
    hasCommission: false,
    defaultBaseSalary: 8000000,
  },
  'NV CSKH': {
    position: 'NV CSKH',
    baseMultiplier: 1.0,
    hasKpiBonus: true,
    hasCommission: false,
    defaultBaseSalary: 6000000,
  },
  'Lễ tân': {
    position: 'Lễ tân',
    baseMultiplier: 1.0,
    hasKpiBonus: true,
    hasCommission: false,
    defaultBaseSalary: 5500000,
  },
  'Tư vấn viên': {
    position: 'Tư vấn viên',
    baseMultiplier: 1.0,
    hasKpiBonus: true,
    hasCommission: false,
    defaultBaseSalary: 5500000,
  },

  // CM Team (Chuyên Môn)
  'Trưởng Nhóm CM': {
    position: 'Trưởng Nhóm CM',
    baseMultiplier: 1.3,
    hasKpiBonus: true,
    hasCommission: false,
    defaultBaseSalary: 8000000,
  },
  'NV CM': {
    position: 'NV CM',
    baseMultiplier: 1.0,
    hasKpiBonus: true,
    hasCommission: false,
    defaultBaseSalary: 6000000,
  },

  // Sale Team
  'Trưởng Nhóm Sale': {
    position: 'Trưởng Nhóm Sale',
    baseMultiplier: 1.3,
    hasKpiBonus: true,
    hasCommission: true,
    defaultBaseSalary: 7000000,
  },
  'NV Sale': {
    position: 'NV Sale',
    baseMultiplier: 1.0,
    hasKpiBonus: true,
    hasCommission: true,
    defaultBaseSalary: 5000000,
  },

  // Finance
  'Kế toán': {
    position: 'Kế toán',
    baseMultiplier: 1.0,
    hasKpiBonus: false,
    hasCommission: false,
    defaultBaseSalary: 7000000,
  },

  // Management
  'Quản lý (Admin)': {
    position: 'Quản lý (Admin)',
    baseMultiplier: 1.5,
    hasKpiBonus: true,
    hasCommission: false,
    defaultBaseSalary: 12000000,
  },
  'Quản lý': {
    position: 'Quản lý',
    baseMultiplier: 1.5,
    hasKpiBonus: true,
    hasCommission: false,
    defaultBaseSalary: 12000000,
  },
};

// Default config for unknown positions
const DEFAULT_POSITION_CONFIG: PositionSalaryConfig = {
  position: 'Unknown',
  baseMultiplier: 1.0,
  hasKpiBonus: false,
  hasCommission: false,
};

/**
 * Get position salary configuration
 * @param position - Staff position name
 * @returns PositionSalaryConfig for the position or default config
 */
export const getPositionConfig = (position: string): PositionSalaryConfig => {
  if (!position) return DEFAULT_POSITION_CONFIG;

  // Direct match
  if (POSITION_SALARY_CONFIG[position]) {
    return POSITION_SALARY_CONFIG[position];
  }

  // Normalized match (case-insensitive, partial match)
  const normalizedPosition = position.toLowerCase().trim();
  for (const [key, config] of Object.entries(POSITION_SALARY_CONFIG)) {
    if (key.toLowerCase() === normalizedPosition) {
      return config;
    }
  }

  // Return default with position name
  return {
    ...DEFAULT_POSITION_CONFIG,
    position,
  };
};

/**
 * Calculate position bonus based on base salary and multiplier
 * @param baseSalary - Base salary amount
 * @param position - Staff position name
 * @returns Position bonus amount (0 if multiplier is 1.0)
 */
export const calculatePositionBonus = (baseSalary: number, position: string): number => {
  const config = getPositionConfig(position);
  return baseSalary * (config.baseMultiplier - 1);
};

/**
 * Check if position is eligible for KPI bonus
 */
export const hasKpiBonus = (position: string): boolean => {
  return getPositionConfig(position).hasKpiBonus;
};

/**
 * Check if position is eligible for commission
 */
export const hasCommission = (position: string): boolean => {
  return getPositionConfig(position).hasCommission;
};
