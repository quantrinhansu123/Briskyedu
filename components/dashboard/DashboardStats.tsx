/**
 * DashboardStats Widget
 * Displays student statistics with bar chart
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { StudentStatus } from './types';

interface DashboardStatsProps {
  studentsByStatus: StudentStatus[];
  currentMonth?: string;
  onCategoryClick?: (category: string) => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  studentsByStatus,
  currentMonth = 'Tháng hiện tại',
  onCategoryClick,
}) => {
  const handleBarClick = (data: { name?: string }) => {
    if (data?.name && onCategoryClick) {
      onCategoryClick(data.name);
    }
  };

  return (
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
          {studentsByStatus.map((item, idx) => (
            <div
              key={idx}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          ))}
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={studentsByStatus}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              }}
            />
            <Bar
              dataKey="value"
              radius={[8, 8, 0, 0]}
              onClick={handleBarClick}
              className="cursor-pointer"
            >
              {studentsByStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {studentsByStatus.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onCategoryClick?.(item.name)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium"
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-700">{item.name}</span>
            <span className="text-gray-400">({item.value})</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardStats;
