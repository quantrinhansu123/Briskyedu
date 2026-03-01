/**
 * Import/Export Buttons Component
 * Dùng chung cho các trang cần nhập/xuất Excel
 */

import React, { useRef, useState } from 'react';
import { Download, Upload, FileSpreadsheet, X, AlertCircle, CheckCircle } from 'lucide-react';
import {
  exportToExcel,
  exportTemplate,
  readExcelFile,
  mapExcelToFields
} from '../src/utils/excelUtils';
import { ModalPortal } from '@/components/modal-portal';

interface ImportExportButtonsProps {
  // For export
  data: any[];
  prepareExport: (data: any[]) => Record<string, any>[];
  exportFileName: string;
  
  // For import
  fields: { key: string; label: string; example?: string; required?: boolean }[];
  mapping: { excelColumn: string; dbField: string; transform?: (val: any) => any }[];
  onImport: (data: Record<string, any>[]) => Promise<{ success: number; errors: string[] }>;
  templateFileName: string;
  
  // Optional
  entityName?: string; // "Học viên", "Nhân viên", etc.
}

export const ImportExportButtons: React.FC<ImportExportButtonsProps> = ({
  data,
  prepareExport,
  exportFileName,
  fields,
  mapping,
  onImport,
  templateFileName,
  entityName = 'dữ liệu'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, any>[] | null>(null);

  // Export current data
  const handleExport = () => {
    if (data.length === 0) {
      alert(`Không có ${entityName} nào để xuất`);
      return;
    }
    const exportData = prepareExport(data);
    exportToExcel(exportData, exportFileName, entityName);
  };

  // Download template
  const handleDownloadTemplate = () => {
    exportTemplate(fields, templateFileName, 'Mẫu nhập liệu');
  };

  // Handle file select
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await readExcelFile(file);
      const mappedData = mapExcelToFields(rawData, mapping);
      
      // Filter out empty rows
      const validData = mappedData.filter(row => {
        const requiredFields = fields.filter(f => f.required).map(f => f.key);
        return requiredFields.every(field => row[field]);
      });

      setPreviewData(validData);
      setShowImportModal(true);
      setImportResult(null);
    } catch (err) {
      console.error('Error reading file:', err);
      alert('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng file.');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Confirm import
  const handleConfirmImport = async () => {
    if (!previewData || previewData.length === 0) return;

    setImporting(true);
    try {
      const result = await onImport(previewData);
      setImportResult(result);
    } catch (err) {
      console.error('Import error:', err);
      setImportResult({ success: 0, errors: ['Lỗi không xác định khi import'] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
          title="Tải file mẫu Excel"
        >
          <FileSpreadsheet size={16} />
          Tải mẫu
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-green-500 text-green-600 rounded-lg hover:bg-green-50"
          title="Import từ Excel"
        >
          <Upload size={16} />
          Import
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50"
          title="Xuất ra Excel"
        >
          <Download size={16} />
          Export
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                Import {entityName} từ Excel
              </h3>
              <button 
                onClick={() => { setShowImportModal(false); setPreviewData(null); setImportResult(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {importResult ? (
                // Show result
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${importResult.success > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center gap-2">
                      {importResult.success > 0 ? (
                        <CheckCircle className="text-green-600" size={24} />
                      ) : (
                        <AlertCircle className="text-red-600" size={24} />
                      )}
                      <span className={`font-semibold ${importResult.success > 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Đã import thành công {importResult.success} {entityName}
                      </span>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <p className="font-semibold text-yellow-700 mb-2">
                        Có {importResult.errors.length} lỗi:
                      </p>
                      <ul className="text-sm text-yellow-600 list-disc list-inside max-h-40 overflow-y-auto">
                        {importResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                // Show preview
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Tìm thấy <span className="font-bold text-indigo-600">{previewData?.length || 0}</span> {entityName} hợp lệ
                    </p>
                  </div>

                  {previewData && previewData.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-gray-600">#</th>
                              {fields.slice(0, 4).map(f => (
                                <th key={f.key} className="px-3 py-2 text-left text-gray-600">
                                  {f.label.split('(')[0].trim()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {previewData.slice(0, 10).map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                {fields.slice(0, 4).map(f => (
                                  <td key={f.key} className="px-3 py-2 text-gray-700 truncate max-w-[150px]">
                                    {row[f.key] || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {previewData.length > 10 && (
                        <div className="px-3 py-2 bg-gray-50 text-center text-sm text-gray-500">
                          ... và {previewData.length - 10} {entityName} khác
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Không tìm thấy dữ liệu hợp lệ trong file</p>
                      <p className="text-xs mt-1">Vui lòng kiểm tra file Excel đúng định dạng mẫu</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => { setShowImportModal(false); setPreviewData(null); setImportResult(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                {importResult ? 'Đóng' : 'Hủy'}
              </button>
              {!importResult && previewData && previewData.length > 0 && (
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Đang import...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Xác nhận Import
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
};
