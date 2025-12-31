/**
 * StudentDebtWidget
 * Displays list of students with debt
 */

import React from 'react';
import { Clock } from 'lucide-react';
import { StudentDebt } from './types';

interface StudentDebtWidgetProps {
  students: StudentDebt[];
  maxDisplay?: number;
}

export const StudentDebtWidget: React.FC<StudentDebtWidgetProps> = ({
  students,
  maxDisplay = 10,
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-rose-100/30 transition-all duration-300">
      <div className="bg-gradient-to-r from-rose-500 to-red-500 p-3">
        <div className="flex items-center gap-2">
          <Clock className="text-white" size={18} />
          <h3 className="font-bold text-white text-sm">Nợ phí ({students.length})</h3>
        </div>
      </div>
      <div className="p-3 max-h-48 overflow-y-auto">
        {students.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="bg-rose-50 sticky top-0">
              <tr>
                <th className="text-left py-1.5 px-2">Học viên</th>
                <th className="text-right py-1.5 px-2">Lớp</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, maxDisplay).map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-rose-50/50">
                  <td
                    className="py-1.5 px-2 truncate max-w-[120px]"
                    title={s.fullName}
                  >
                    {s.fullName}
                  </td>
                  <td
                    className="py-1.5 px-2 text-right text-gray-500 truncate max-w-[80px]"
                    title={s.className}
                  >
                    {s.className}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <Clock size={24} className="mx-auto mb-1 opacity-30" />
            <span className="text-xs">Không có HS nợ phí</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDebtWidget;
