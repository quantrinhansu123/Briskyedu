/**
 * StockWidget
 * Displays product stock information
 */

import React, { useState } from 'react';
import { Box } from 'lucide-react';
import { ProductStock } from './types';

interface StockWidgetProps {
  products: ProductStock[];
  defaultFilter?: 'low' | 'all';
}

export const StockWidget: React.FC<StockWidgetProps> = ({
  products,
  defaultFilter = 'low',
}) => {
  const [filter, setFilter] = useState<'low' | 'all'>(defaultFilter);

  const filteredProducts =
    filter === 'low'
      ? products.filter((p) => p.stock < (p.minStock || 10))
      : products;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-200/50 border border-white/60 overflow-hidden hover:shadow-xl hover:shadow-amber-100/30 transition-all duration-300">
      <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-4 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Box className="text-white" size={20} />
          </div>
          <h3 className="font-bold text-white">VẬT PHẨM CÒN LẠI TRONG KHO</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <span className="text-gray-600">Hiển thị</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'low' | 'all')}
            className="text-amber-600 font-semibold bg-transparent border-none cursor-pointer focus:outline-none"
          >
            <option value="low">Sắp hết hàng</option>
            <option value="all">Tất cả</option>
          </select>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-amber-50/50 border-b-2 border-amber-100">
            <tr>
              <th className="text-left py-2.5 px-3 font-medium text-gray-600">
                Tên sản phẩm
              </th>
              <th className="text-right py-2.5 px-3 font-medium text-gray-600">
                Số lượng
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length > 0 ? (
              filteredProducts.map((item, idx) => (
                <tr
                  key={idx}
                  className="border-b border-gray-100 hover:bg-amber-50/30 transition-colors"
                >
                  <td className="py-2.5 px-3 text-gray-700">{item.name}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold ${
                      item.stock < 5 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    <span
                      className={`px-2 py-1 rounded-full ${
                        item.stock < 5 ? 'bg-rose-100' : 'bg-emerald-100'
                      }`}
                    >
                      {item.stock}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="py-8 text-center text-gray-400">
                  <Box size={32} className="mx-auto mb-2 opacity-30" />
                  {filter === 'low'
                    ? 'Không có sản phẩm sắp hết hàng'
                    : 'Chưa có dữ liệu sản phẩm trong kho'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockWidget;
