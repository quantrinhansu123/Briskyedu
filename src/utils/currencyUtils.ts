/**
 * Currency Utilities
 * - Format numbers to VND currency
 * - Convert numbers to Vietnamese words
 */

/**
 * Format number to VND currency
 * @example formatCurrency(1000000) => "1.000.000 ₫"
 */
export const formatCurrency = (amount: number): string => {
  // Guard against NaN, undefined, null, Infinity
  if (!isFinite(amount) || amount === null || amount === undefined) {
    return '0 ₫';
  }

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

/**
 * Format number with thousand separators
 * @example formatNumber(1000000) => "1.000.000"
 */
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Convert number to Vietnamese words
 * @example numberToWords(1234567) => "Một triệu hai trăm ba mươi tư ngàn năm trăm sáu mươi bảy đồng"
 */
export const numberToWords = (num: number): string => {
  if (num === 0) return 'Không đồng';
  
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const levels = ['', 'nghìn', 'triệu', 'tỷ'];
  
  const readGroup = (n: number): string => {
    let result = '';
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const unit = n % 10;
    
    if (hundred > 0) {
      result += units[hundred] + ' trăm';
      if (ten === 0 && unit !== 0) {
        result += ' lẻ';
      }
    }
    
    if (ten > 1) {
      result += (result ? ' ' : '') + units[ten] + ' mươi';
      if (unit === 1) {
        result += ' mốt';
      } else if (unit > 0) {
        result += ' ' + units[unit];
      }
    } else if (ten === 1) {
      result += (result ? ' ' : '') + 'mười';
      if (unit > 0) {
        result += ' ' + units[unit];
      }
    } else if (unit > 0) {
      result += (result ? ' ' : '') + units[unit];
    }
    
    return result;
  };
  
  const groups: string[] = [];
  let tempNum = num;
  let levelIndex = 0;
  
  while (tempNum > 0) {
    const group = tempNum % 1000;
    if (group > 0) {
      let groupText = readGroup(group);
      if (levelIndex > 0) {
        groupText += ' ' + levels[levelIndex];
      }
      groups.unshift(groupText);
    }
    tempNum = Math.floor(tempNum / 1000);
    levelIndex++;
  }
  
  let result = groups.join(' ');
  
  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);
  
  // Add "đồng" at the end
  result += ' đồng';
  
  return result;
};

/**
 * Parse Vietnamese currency string to number
 * @example parseCurrency("1.000.000") => 1000000
 */
export const parseCurrency = (str: string): number => {
  return parseInt(str.replace(/\./g, '').replace(/[^\d]/g, '')) || 0;
};

/**
 * Calculate discount amount
 * @param amount Original amount
 * @param discountPercent Discount percentage (0-1)
 * @returns Discounted amount
 */
export const calculateDiscount = (amount: number, discountPercent: number): number => {
  return amount * (1 - discountPercent);
};

/**
 * Calculate percentage
 * @param part Part value
 * @param total Total value
 * @returns Percentage (0-100)
 */
export const calculatePercentage = (part: number, total: number): number => {
  if (total === 0) return 0;
  return (part / total) * 100;
};
