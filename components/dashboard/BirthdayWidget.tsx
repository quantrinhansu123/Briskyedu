/**
 * BirthdayWidget
 * Displays birthday list for staff and students with filters
 */

import React, { useState } from 'react';
import { Cake, Gift, Heart } from 'lucide-react';
import { BirthdayPerson, GiftStatus, Center } from './types';

type BirthdayFilter = 'today' | 'week' | 'month';
type BirthdayType = 'staff' | 'student';

interface BirthdayWidgetProps {
  staffBirthdays: BirthdayPerson[];
  studentBirthdays: BirthdayPerson[];
  centers: Center[];
  giftStatus?: Record<string, GiftStatus>;
  onToggleGift?: (studentId: string, studentName: string, field: 'giftPrepared' | 'giftGiven') => void;
  defaultFilter?: BirthdayFilter;
  defaultType?: BirthdayType;
}

export const BirthdayWidget: React.FC<BirthdayWidgetProps> = ({
  staffBirthdays,
  studentBirthdays,
  centers,
  giftStatus = {},
  onToggleGift,
  defaultFilter = 'month',
  defaultType = 'staff',
}) => {
  const [filter, setFilter] = useState<BirthdayFilter>(defaultFilter);
  const [type, setType] = useState<BirthdayType>(defaultType);
  const [branch, setBranch] = useState<string>('all');

  const now = new Date();
  const today = now.getDate();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const birthdayData = type === 'staff' ? staffBirthdays : studentBirthdays;

  const filteredBirthdays = birthdayData.filter((item) => {
    const [day, month] = item.date.split('/').map(Number);

    // Filter by branch
    if (branch !== 'all' && item.branch !== branch) {
      return false;
    }

    if (filter === 'today') {
      return day === today && month === thisMonth + 1;
    } else if (filter === 'week') {
      const bdayThisYear = new Date(thisYear, month - 1, day);
      const diffDays = Math.ceil(
        (bdayThisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays >= 0 && diffDays <= 7;
    } else {
      return month === thisMonth + 1;
    }
  });

  return (
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
            onClick={() => setType('staff')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${
              type === 'staff'
                ? 'bg-white text-[#FF6B5A] shadow-md'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            Nhân sự
          </button>
          <button
            onClick={() => setType('student')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${
              type === 'student'
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
              value={filter}
              onChange={(e) => setFilter(e.target.value as BirthdayFilter)}
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
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="text-[#FF6B5A] font-semibold bg-transparent border-none cursor-pointer focus:outline-none"
            >
              <option value="all">Tất cả</option>
              {centers.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-orange-50/50 border-b-2 border-orange-100">
            <tr>
              <th className="text-left py-2.5 px-3 font-medium text-gray-600">
                {type === 'staff' ? 'Tên nhân sự' : 'Tên học viên'}
              </th>
              <th className="text-center py-2.5 px-3 font-medium text-gray-600">
                Ngày SN
              </th>
              {type === 'student' && (
                <>
                  <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap">
                    Chuẩn bị
                  </th>
                  <th className="text-center py-2.5 px-2 font-medium text-gray-600 whitespace-nowrap">
                    Đã tặng
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredBirthdays.length > 0 ? (
              filteredBirthdays.map((item, idx) => (
                <tr
                  key={idx}
                  className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors"
                >
                  <td className="py-2.5 px-3 text-gray-700">{item.name}</td>
                  <td className="py-2.5 px-3 text-center font-medium text-[#FF6B5A]">
                    {item.date}
                  </td>
                  {type === 'student' && (
                    <>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() =>
                            onToggleGift?.(item.id, item.name, 'giftPrepared')
                          }
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                            giftStatus[item.id]?.giftPrepared
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-gray-300 hover:border-emerald-400'
                          }`}
                          title="Đã chuẩn bị quà"
                        >
                          {giftStatus[item.id]?.giftPrepared && (
                            <Gift size={14} />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() =>
                            onToggleGift?.(item.id, item.name, 'giftGiven')
                          }
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                            giftStatus[item.id]?.giftGiven
                              ? 'bg-[#FF6B5A] border-[#FF6B5A] text-white'
                              : 'border-gray-300 hover:border-[#FF6B5A]'
                          }`}
                          title="Đã tặng quà"
                        >
                          {giftStatus[item.id]?.giftGiven && <Heart size={14} />}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={type === 'student' ? 4 : 2}
                  className="py-6 text-center text-gray-400"
                >
                  <Cake size={32} className="mx-auto mb-2 opacity-30" />
                  Không có sinh nhật{' '}
                  {filter === 'today'
                    ? 'hôm nay'
                    : filter === 'week'
                    ? 'tuần này'
                    : 'tháng này'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BirthdayWidget;
