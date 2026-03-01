/**
 * Test Comment Print Preview
 *
 * Shows a print preview of test comment report with editable fields.
 * User can edit content before printing using browser's native print.
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Printer, FileText, Edit3 } from 'lucide-react';
import { TestComment, SkillScore, SkillContent } from '../../../../types';
import { ModalPortal } from '@/components/modal-portal';

// Branch addresses configuration
const BRISKY_BRANCHES = [
  'CS 1: Ô 40, LK4, KĐT Tân Tây Đô, Đan Phượng.',
  'CS 2: NV120, Coma6, Tây Mỗ, Nam Từ Liêm.',
  'CS 3: Ô 7, LK1, KĐT Tân Tây Đô, Đan Phượng.',
];
const BRISKY_HOTLINE = '0967.030.457';

// Colors
const COLORS = {
  headerBg: '#E8F0F7',
  headerText: '#1E4D78',
  border: '#2E86AB',
  scoreHighlight: '#F0F7F4',
  linkColor: '#2E86AB',
};

export interface TestCommentPrintPreviewProps {
  comment: TestComment;
  onClose: () => void;
  onExportPDF?: () => void;
}

export const TestCommentPrintPreview: React.FC<TestCommentPrintPreviewProps> = ({
  comment,
  onClose,
  onExportPDF
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);

  // Editable fields
  const [editData, setEditData] = useState<TestComment>(comment);

  // Reset edit data when comment changes
  useEffect(() => {
    setEditData(comment);
  }, [comment]);

  // Format score display
  const formatScore = (score: SkillScore | undefined): string => {
    if (!score) return '-/-';
    const scoreStr = score.score.toString().replace('.', ',');
    return `${scoreStr}/${score.maxScore}`;
  };

  // Handle print
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Không thể mở cửa sổ in. Vui lòng cho phép popup.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Báo cáo bài Test - ${editData.studentName}</title>
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.4;
            color: #000;
            margin: 0;
            padding: 0;
          }
          .print-container {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            padding: 5mm;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid ${COLORS.border};
            padding: 6px 8px;
            vertical-align: top;
          }
          th {
            background: ${COLORS.headerBg};
            color: ${COLORS.headerText};
          }
          .header-row {
            display: flex;
            align-items: flex-start;
            margin-bottom: 15px;
          }
          .logo {
            width: 80px;
            margin-right: 15px;
          }
          .title {
            text-align: center;
            margin: 10px 0;
          }
          .signature {
            text-align: right;
            margin-top: 20px;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Update skill content
  const updateContent = (field: 'content' | 'strengths' | 'improvements', skill: keyof SkillContent, value: string) => {
    setEditData(prev => ({
      ...prev,
      [field]: {
        ...(prev[field] as SkillContent || {}),
        [skill]: value
      }
    }));
  };

  const hasContent = editData.content?.listening || editData.content?.readingWriting || editData.content?.speaking;
  const hasStrengths = editData.strengths?.listening || editData.strengths?.readingWriting || editData.strengths?.speaking;
  const hasImprovements = editData.improvements?.listening || editData.improvements?.readingWriting || editData.improvements?.speaking;

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-hidden">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-gray-800">Xem trước báo cáo</h3>
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${
                editMode
                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Edit3 size={14} />
              {editMode ? 'Đang chỉnh sửa' : 'Chỉnh sửa'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <FileText size={18} />
                Xuất PDF
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Printer size={18} />
              In báo cáo
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Print Preview Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div
            ref={printRef}
            className="print-container bg-white mx-auto shadow-lg"
            style={{
              width: '210mm',
              minHeight: '297mm',
              padding: '12mm 18mm',
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: '12pt',
              lineHeight: '1.4',
              color: '#000',
            }}
          >
            {/* Header with Logo */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div style={{ flexShrink: 0, marginRight: '15px' }}>
                <img src="/logo.jpg" alt="Brisky Logo" style={{ width: '100px', height: 'auto' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '14pt', color: COLORS.headerText, marginBottom: '4px' }}>
                  HỆ THỐNG ANH NGỮ QUỐC TẾ BRISKY
                </div>
                {BRISKY_BRANCHES.map((branch, i) => (
                  <div key={i} style={{ fontSize: '11pt' }}>{branch}</div>
                ))}
                <div style={{ fontSize: '11pt' }}><strong>Hotline:</strong> {BRISKY_HOTLINE}</div>
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', margin: '15px 0' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16pt', textDecoration: 'underline' }}>
                ĐÁNH GIÁ KẾT QUẢ BÀI TEST
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '14pt', marginTop: '6px' }}>
                {editData.testName}
              </div>
              {editData.unit && <div style={{ fontSize: '12pt', marginTop: '3px' }}>({editData.unit})</div>}
              {editData.book && <div style={{ fontSize: '12pt', marginTop: '3px' }}>Book: {editData.book}</div>}
            </div>

            {/* Student Info */}
            <div style={{ margin: '15px 0' }}>
              <div style={{ marginBottom: '8px' }}><strong>Student's name:</strong> {editData.studentName}</div>
              {editData.videoLink && (
                <div>
                  <strong>Link video bài test của con:</strong><br/>
                  <a href={editData.videoLink} style={{ color: COLORS.linkColor, wordBreak: 'break-all' }}>
                    {editData.videoLink}
                  </a>
                </div>
              )}
            </div>

            {/* Score Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '15px 0', border: `1px solid ${COLORS.border}` }}>
              <thead>
                <tr>
                  <th style={{ border: `1px solid ${COLORS.border}`, padding: '8px', width: '15%', background: COLORS.headerBg, color: COLORS.headerText }}></th>
                  <th style={{ border: `1px solid ${COLORS.border}`, padding: '8px', width: '28%', textAlign: 'center', background: COLORS.headerBg, color: COLORS.headerText }}>
                    Listening<br/><span style={{ fontWeight: 'normal' }}>(Nghe)</span>
                  </th>
                  <th style={{ border: `1px solid ${COLORS.border}`, padding: '8px', width: '29%', textAlign: 'center', background: COLORS.headerBg, color: COLORS.headerText }}>
                    Reading and Writing<br/><span style={{ fontWeight: 'normal' }}>(Đọc và Viết)</span>
                  </th>
                  <th style={{ border: `1px solid ${COLORS.border}`, padding: '8px', width: '28%', textAlign: 'center', background: COLORS.headerBg, color: COLORS.headerText }}>
                    Speaking<br/><span style={{ fontWeight: 'normal' }}>(Nói)</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Scores Row */}
                <tr>
                  <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px', fontWeight: 'bold', background: COLORS.headerBg, color: COLORS.headerText }}>Điểm số</td>
                  <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', background: COLORS.scoreHighlight }}>
                    {formatScore(editData.listeningScore)}
                  </td>
                  <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', background: COLORS.scoreHighlight }}>
                    {formatScore(editData.readingWritingScore)}
                  </td>
                  <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', background: COLORS.scoreHighlight }}>
                    {formatScore(editData.speakingScore)}
                  </td>
                </tr>

                {/* Content Row */}
                {hasContent && (
                  <tr>
                    <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px', fontWeight: 'bold', verticalAlign: 'top', background: COLORS.headerBg, color: COLORS.headerText }}>Nội dung</td>
                    {['listening', 'readingWriting', 'speaking'].map((skill) => (
                      <td key={skill} style={{ border: `1px solid ${COLORS.border}`, padding: '8px', verticalAlign: 'top', fontSize: '11pt' }}>
                        {editMode ? (
                          <textarea
                            value={(editData.content as SkillContent)?.[skill as keyof SkillContent] || ''}
                            onChange={(e) => updateContent('content', skill as keyof SkillContent, e.target.value)}
                            className="w-full min-h-[60px] p-1 border border-orange-300 rounded text-sm resize-y"
                          />
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{(editData.content as SkillContent)?.[skill as keyof SkillContent] || ''}</div>
                        )}
                      </td>
                    ))}
                  </tr>
                )}

                {/* Strengths Row */}
                {hasStrengths && (
                  <tr>
                    <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px', fontWeight: 'bold', verticalAlign: 'top', background: COLORS.headerBg, color: COLORS.headerText }}>Nội dung con làm tốt</td>
                    {['listening', 'readingWriting', 'speaking'].map((skill) => (
                      <td key={skill} style={{ border: `1px solid ${COLORS.border}`, padding: '8px', verticalAlign: 'top', fontSize: '11pt' }}>
                        {editMode ? (
                          <textarea
                            value={(editData.strengths as SkillContent)?.[skill as keyof SkillContent] || ''}
                            onChange={(e) => updateContent('strengths', skill as keyof SkillContent, e.target.value)}
                            className="w-full min-h-[60px] p-1 border border-orange-300 rounded text-sm resize-y"
                          />
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{(editData.strengths as SkillContent)?.[skill as keyof SkillContent] || ''}</div>
                        )}
                      </td>
                    ))}
                  </tr>
                )}

                {/* Improvements Row */}
                {hasImprovements && (
                  <tr>
                    <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px', fontWeight: 'bold', verticalAlign: 'top', background: COLORS.headerBg, color: COLORS.headerText }}>Nội dung con cần cải thiện</td>
                    {['listening', 'readingWriting', 'speaking'].map((skill) => (
                      <td key={skill} style={{ border: `1px solid ${COLORS.border}`, padding: '8px', verticalAlign: 'top', fontSize: '11pt' }}>
                        {editMode ? (
                          <textarea
                            value={(editData.improvements as SkillContent)?.[skill as keyof SkillContent] || ''}
                            onChange={(e) => updateContent('improvements', skill as keyof SkillContent, e.target.value)}
                            className="w-full min-h-[60px] p-1 border border-orange-300 rounded text-sm resize-y"
                          />
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{(editData.improvements as SkillContent)?.[skill as keyof SkillContent] || ''}</div>
                        )}
                      </td>
                    ))}
                  </tr>
                )}

                {/* Learning Attitude Row */}
                {editData.learningAttitude && (
                  <tr>
                    <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px', fontWeight: 'bold', verticalAlign: 'top', background: COLORS.headerBg, color: COLORS.headerText }}>
                      Thái độ học tập của con trong quá trình học vừa rồi
                    </td>
                    <td colSpan={3} style={{ border: `1px solid ${COLORS.border}`, padding: '8px', verticalAlign: 'top', fontSize: '11pt' }}>
                      {editMode ? (
                        <textarea
                          value={editData.learningAttitude || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, learningAttitude: e.target.value }))}
                          className="w-full min-h-[80px] p-1 border border-orange-300 rounded text-sm resize-y"
                        />
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{editData.learningAttitude}</div>
                      )}
                    </td>
                  </tr>
                )}

                {/* Parent Message Row */}
                {editData.parentMessage && (
                  <tr>
                    <td style={{ border: `1px solid ${COLORS.border}`, padding: '8px', fontWeight: 'bold', verticalAlign: 'top', background: COLORS.headerBg, color: COLORS.headerText }}>
                      Lời nhắn nhủ phụ huynh
                    </td>
                    <td colSpan={3} style={{ border: `1px solid ${COLORS.border}`, padding: '8px', verticalAlign: 'top', fontSize: '11pt' }}>
                      {editMode ? (
                        <textarea
                          value={editData.parentMessage || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, parentMessage: e.target.value }))}
                          className="w-full min-h-[60px] p-1 border border-orange-300 rounded text-sm resize-y"
                        />
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{editData.parentMessage}</div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Referral Program */}
            <div style={{ margin: '20px 0 15px 0', textAlign: 'justify', fontSize: '11pt' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Chương trình "GỬI LỜI YÊU THƯƠNG" tới bố mẹ có con theo học tại BRISKY!
              </div>
              <p style={{ margin: '0 0 8px 0' }}>
                Brisky rất cảm ơn bố mẹ khi đã tin tưởng gửi gắm con và giới thiệu thêm bạn bè, con cháu tham gia lớp học. Thay lời cảm ơn và tri ân tới bố mẹ, khi giới thiệu một học sinh thành công, Brisky xin gửi tặng 200k/1 bạn giới thiệu thành công (Trừ vào khóa học tới của con hoặc tiền mặt).
              </p>
              <p style={{ margin: 0 }}>Brisky xin cảm ơn bố mẹ thật nhiều ạ!</p>
            </div>

            {/* Teacher Signature */}
            <div style={{ textAlign: 'right', marginTop: '25px' }}>
              <div style={{ fontWeight: 'bold' }}>Giáo viên chủ nhiệm</div>
              <div style={{ marginTop: '20px', fontStyle: 'italic', fontSize: '14pt' }}>
                {editMode ? (
                  <input
                    type="text"
                    value={editData.teacherName || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, teacherName: e.target.value }))}
                    className="w-40 p-1 border border-orange-300 rounded text-right"
                    placeholder="Ms./Mr. ___________"
                  />
                ) : (
                  editData.teacherName || 'Ms./Mr. ___________'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        {editMode && (
          <div className="p-3 bg-orange-50 border-t border-orange-200 text-center text-sm text-orange-700">
            Đang ở chế độ chỉnh sửa - Các thay đổi chỉ áp dụng cho bản in này, không lưu vào hệ thống
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
};

export default TestCommentPrintPreview;
