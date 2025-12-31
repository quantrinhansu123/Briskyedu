/**
 * SalesChart Widget
 * Displays sales bar chart with revenue comparison
 */

import React from 'react';
import { Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '../../src/utils/currencyUtils';
import { SalesDataPoint } from './types';

interface SalesChartProps {
  data: SalesDataPoint[];
  totalRevenue: number;
  currentMonth?: string;
}

export const SalesChart: React.FC<SalesChartProps> = ({
  data,
  totalRevenue,
  currentMonth = 'Tháng hiện tại',
}) => {
  const chartData = data.map((r) => ({
    name: r.month,
    value: r.expected || r.actual,
  }));

  return (
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
            {formatCurrency(totalRevenue)}
          </div>
        </div>
      </div>
      {data.length > 0 ? (
        <>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}tr`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                  }}
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
              <div className="w-2.5 h-2.5 bg-teal-500 rounded-full" />
              <span className="text-gray-700">Kỳ vọng</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              <span className="text-gray-700">Thực tế</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-full">
              <div className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
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
  );
};

export default SalesChart;
