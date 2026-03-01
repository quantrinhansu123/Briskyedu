/**
 * LegacyImportModal Component
 * Excel bulk import for legacyAttendedSessions (admin-only)
 * Flow: upload file → parse → preview → confirm → apply
 */

import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import {
  parseExcelFile,
  generateImportPreview,
  applyLegacyImport,
  LegacyImportPreview,
} from '../../../services/legacy-session-import-service';
import { ModalPortal } from '@/components/modal-portal';

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'upload' | 'preview' | 'result';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export const LegacyImportModal: React.FC<Props> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState<Step>('upload');
  const [previews, setPreviews] = useState<LegacyImportPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matchedCount = previews.filter(p => p.matched).length;
  const unmatchedCount = previews.filter(p => !p.matched).length;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setLoading(true);
    try {
      const rows = await parseExcelFile(file);
      const preview = await generateImportPreview(rows);
      setPreviews(preview);
      setStep('preview');
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi không xác định');
    } finally {
      setLoading(false);
      // Reset file input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApply = async () => {
    if (!confirm(`Xác nhận cập nhật ${matchedCount} học viên?`)) return;
    setLoading(true);
    try {
      const res = await applyLegacyImport(previews);
      setResult(res);
      setStep('result');
      if (res.success > 0) onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi áp dụng');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPreviews([]);
    setResult(null);
    setErrorMsg('');
    setStep('upload');
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h3 className="text-xl font-bold text-gray-900">Import buổi học cũ (Legacy)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
                <p className="font-semibold">Hướng dẫn:</p>
                <p>Upload file Excel (.xlsx, .xls) với cấu trúc:</p>
                <table className="w-full text-xs mt-2 border-collapse">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="border border-blue-300 px-3 py-1.5 text-left">Cột A - Mã HV</th>
                      <th className="border border-blue-300 px-3 py-1.5 text-left">Cột B - Họ tên</th>
                      <th className="border border-blue-300 px-3 py-1.5 text-left">Cột C - Đã học (cũ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-blue-300 px-3 py-1.5">BRS001</td>
                      <td className="border border-blue-300 px-3 py-1.5">Nguyễn Văn A</td>
                      <td className="border border-blue-300 px-3 py-1.5">80</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-blue-600 mt-1">Dòng đầu tiên là tiêu đề (tự động bỏ qua). Khớp theo mã HV trước, nếu không có thì khớp theo tên.</p>
              </div>

              {/* Upload zone */}
              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  loading ? 'border-gray-200 bg-gray-50' : 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'
                }`}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3 text-gray-500">
                    <Loader size={36} className="animate-spin" />
                    <p>Đang xử lý file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-500">
                    <Upload size={36} className="text-indigo-400" />
                    <p className="font-medium text-gray-700">Nhấn để chọn file Excel</p>
                    <p className="text-sm">Chấp nhận: .xlsx, .xls</p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              {errorMsg && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-4">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{matchedCount}</p>
                  <p className="text-sm text-green-600">Khớp - sẽ cập nhật</p>
                </div>
                <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{unmatchedCount}</p>
                  <p className="text-sm text-red-600">Không khớp - bỏ qua</p>
                </div>
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{previews.length}</p>
                  <p className="text-sm text-gray-600">Tổng dòng</p>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                    <tr>
                      <th className="px-3 py-3 text-left">Mã HV</th>
                      <th className="px-3 py-3 text-left">Họ tên (file)</th>
                      <th className="px-3 py-3 text-left">Học viên khớp</th>
                      <th className="px-3 py-3 text-center">Buổi cũ (hiện)</th>
                      <th className="px-3 py-3 text-center">Buổi cũ (mới)</th>
                      <th className="px-3 py-3 text-center">Còn lại (trước)</th>
                      <th className="px-3 py-3 text-center">Còn lại (sau)</th>
                      <th className="px-3 py-3 text-left">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previews.map((p, idx) => (
                      <tr key={idx} className={p.matched ? 'bg-white hover:bg-green-50' : 'bg-red-50'}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{p.row.code || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{p.row.fullName || '-'}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{p.studentName || '-'}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{p.matched ? p.currentLegacy : '-'}</td>
                        <td className="px-3 py-2 text-center font-semibold text-indigo-700">{p.matched ? p.row.legacySessions : '-'}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{p.matched ? p.currentRemaining : '-'}</td>
                        <td className={`px-3 py-2 text-center font-semibold ${p.matched ? (p.newRemaining < 0 ? 'text-red-600' : 'text-green-700') : ''}`}>
                          {p.matched ? p.newRemaining : '-'}
                        </td>
                        <td className="px-3 py-2">
                          {p.matched ? (
                            <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                              <CheckCircle size={12} /> Khớp
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                              <AlertTriangle size={12} /> {p.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step: Result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-green-700">{result.success}</p>
                  <p className="text-sm text-green-600">Cập nhật thành công</p>
                </div>
                {result.failed > 0 && (
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-red-700">{result.failed}</p>
                    <p className="text-sm text-red-600">Thất bại</p>
                  </div>
                )}
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-semibold text-red-800 mb-2">Chi tiết lỗi:</p>
                  <ul className="space-y-1 text-sm text-red-700">
                    {result.errors.map((e, i) => <li key={i}>- {e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
          <div>
            {step === 'preview' && (
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Chọn file khác
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              {step === 'result' ? 'Đóng' : 'Hủy'}
            </button>
            {step === 'preview' && matchedCount > 0 && (
              <button
                onClick={handleApply}
                disabled={loading}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader size={14} className="animate-spin" />}
                Áp dụng ({matchedCount} học viên)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default LegacyImportModal;
