/**
 * StudentExpiringSoonWidget
 * Displays list of students about to run out of sessions
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { StudentExpiring } from './types';

interface StudentExpiringSoonWidgetProps {
  students: StudentExpiring[];
  maxDisplay?: number;
}

export const StudentExpiringSoonWidget: React.FC<StudentExpiringSoonWidgetProps> = ({
  students,
  maxDisplay = 10,
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-amber-100/30 transition-all duration-300">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-white" size={18} />
          <h3 className="font-bold text-white text-sm">
            Sắp hết phí ({students.length})
          </h3>
        </div>
      </div>
      <div className="p-3 max-h-48 overflow-y-auto">
        {students.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="bg-amber-50 sticky top-0">
              <tr>
                <th className="text-left py-1.5 px-2">Học viên</th>
                <th className="text-center py-1.5 px-2">Còn</th>
                <th className="text-center py-1.5 px-2">Ngày BĐ HĐ</th>
                <th className="text-right py-1.5 px-2">Dự kiến KT</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, maxDisplay).map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-amber-50/50">
                  <td
                    className="py-1.5 px-2 truncate max-w-[80px]"
                    title={`${s.fullName} - ${s.className}`}
                  >
                    {s.fullName}
                  </td>
                  <td className="py-1.5 px-2 text-center font-bold text-amber-600">
                    {s.remainingSessions}
                  </td>
                  <td className="py-1.5 px-2 text-center text-gray-500">
                    {s.contractStartDate || '-'}
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-600">
                    {s.expectedEndDate || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <AlertTriangle size={24} className="mx-auto mb-1 opacity-30" />
            <span className="text-xs">Không có HS sắp hết phí</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentExpiringSoonWidget;
