/**
 * SalaryWidget
 * Displays salary information (for teachers or admin view)
 */

import React from 'react';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '../../src/utils/currencyUtils';
import { SalaryForecastItem } from './types';

interface SalaryWidgetProps {
  // For admin view
  forecast?: SalaryForecastItem[];
  salaryPercent?: number;
  currentMonth?: string;
  // For teacher view
  confirmedSalary?: number;
  pendingSalary?: number;
  confirmedSessions?: number;
  totalSessions?: number;
  variant?: 'admin' | 'teacher';
}

export const SalaryWidget: React.FC<SalaryWidgetProps> = ({
  forecast = [],
  salaryPercent = 0,
  currentMonth = 'Tháng hiện tại',
  confirmedSalary = 0,
  pendingSalary = 0,
  confirmedSessions = 0,
  totalSessions = 0,
  variant = 'admin',
}) => {
  if (variant === 'teacher') {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Wallet className="text-white" size={20} />
            </div>
            <h3 className="font-bold text-white">Lương tháng này</h3>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Đã xác nhận:</span>
            <span className="text-lg font-bold text-emerald-600">
              {formatCurrency(confirmedSalary)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Chờ xác nhận:</span>
            <span className="text-lg font-bold text-amber-600">
              {formatCurrency(pendingSalary)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 bg-teal-50 rounded-xl px-3">
            <span className="font-semibold text-gray-700">Tổng dự kiến:</span>
            <span className="text-xl font-bold text-teal-600">
              {formatCurrency(confirmedSalary + pendingSalary)}
            </span>
          </div>
          <div className="text-center text-xs text-gray-500 pt-2">
            {confirmedSessions} buổi xác nhận / {totalSessions} tổng buổi
          </div>
        </div>
      </div>
    );
  }

  // Admin view
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Wallet className="text-white" size={20} />
            </div>
            <h3 className="font-bold text-white">Dự báo lương</h3>
          </div>
          <span className="text-sm text-white/80 bg-white/10 px-3 py-1 rounded-full">
            {currentMonth}
          </span>
        </div>
      </div>
      <div className="p-4">
        <table className="w-full text-sm">
          <tbody>
            {forecast.map((item, idx) => (
              <tr
                key={idx}
                className={
                  idx === forecast.length - 1
                    ? 'font-bold border-t-2 border-emerald-200'
                    : 'border-b border-gray-100'
                }
              >
                <td className="py-2.5 text-gray-700">{item.position}</td>
                <td className="py-2.5 text-right font-semibold text-emerald-600">
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-emerald-200 bg-emerald-50/50">
              <td className="py-2.5 font-semibold text-gray-800">Chiếm tỉ lệ</td>
              <td className="py-2.5 text-right font-bold text-emerald-600">
                {salaryPercent}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalaryWidget;
