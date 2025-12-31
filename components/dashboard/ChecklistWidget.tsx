/**
 * ChecklistWidget
 * Displays daily checklist tasks
 */

import React from 'react';
import { CheckSquare } from 'lucide-react';
import { ChecklistItem } from './types';

interface ChecklistWidgetProps {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
}

export const ChecklistWidget: React.FC<ChecklistWidgetProps> = ({
  items,
  onToggle,
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-indigo-100/30 transition-all duration-300">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="text-white" size={18} />
          <h3 className="font-bold text-white text-sm">Việc cần làm hôm nay</h3>
        </div>
      </div>
      <div className="p-3">
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => onToggle(item.id)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span
                  className={`flex-1 text-xs ${
                    item.done ? 'line-through text-gray-400' : 'text-gray-700'
                  }`}
                >
                  {item.task}
                </span>
                {item.count > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                    {item.count}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <CheckSquare size={24} className="mx-auto mb-1 opacity-30" />
            <span className="text-xs">Không có việc cần làm</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChecklistWidget;
