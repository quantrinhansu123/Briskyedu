/**
 * WorkDaysWidget
 * Displays number of confirmed work days this month
 */

import React from 'react';
import { CalendarCheck } from 'lucide-react';

interface WorkDaysWidgetProps {
  workDays: number;
  label?: string;
}

export const WorkDaysWidget: React.FC<WorkDaysWidgetProps> = ({
  workDays,
  label = 'Đã xác nhận',
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-white/60 hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/30">
          <CalendarCheck className="text-white" size={22} />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Ngày công tháng này</h3>
          <span className="text-xs text-gray-500">{label}</span>
        </div>
      </div>
      <div className="text-center py-4">
        <span className="text-5xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          {workDays}
        </span>
        <span className="text-gray-500 ml-2 text-lg">ngày</span>
      </div>
    </div>
  );
};

export default WorkDaysWidget;
