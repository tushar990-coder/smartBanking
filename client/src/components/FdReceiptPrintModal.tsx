import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAmountInWordsMarathi } from '../utils/marathiWords';

interface FdAccountDetails {
  fdAccountID: number;
  accountNo: string;
  memberID: number;
  memberName: string;
  memberCode: string;
  fdSchemeID: number;
  schemeName: string;
  schemeCode: string;
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  nomineeName?: string;
  nomineeRelation?: string;
  remarks?: string;
  branchName?: string;
  mobileNo?: string;
}

interface Props {
  account: FdAccountDetails;
  onClose: () => void;
}

const FdReceiptPrintModal: React.FC<Props> = ({ account, onClose }) => {
  const [sanstha, setSanstha] = useState<any>(null);
  const [printMode, setPrintMode] = useState<'blank' | 'preprinted'>('blank');
  const [copies, setCopies] = useState<'dual' | 'single'>('dual');
  
  // Offset & Styling controls for pre-printed stationery
  const [topOffset, setTopOffset] = useState<number>(0);
  const [leftOffset, setLeftOffset] = useState<number>(0);
  const [showHeader, setShowHeader] = useState<boolean>(true);

  const receiptRef = useRef<HTMLDivElement>(null);
  const API_URL = '/api';

  useEffect(() => {
    fetchSansthaDetails();
  }, []);

  const fetchSansthaDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/SansthaDetails`);
      if (response.data && response.data.length > 0) {
        setSanstha(response.data[0]);
      }
    } catch (err) {
      console.error('Sanstha details fetch failed', err);
    }
  };

  const handleModeChange = (mode: 'blank' | 'preprinted') => {
    setPrintMode(mode);
    if (mode === 'preprinted') {
      setShowHeader(false);
    } else {
      setShowHeader(true);
    }
  };

  // High quality vector print & PDF export (preserves perfect Marathi Devanagari fonts)
  const handlePrintOrPdf = () => {
    const originalTitle = document.title;
    document.title = `FD_Receipt_${account.accountNo}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // WhatsApp Direct Share Handler
  const handleWhatsAppShare = () => {
    const sansthaName = sanstha?.sansthaName || 'स्मार्ट मल्टीस्टेट पतसंस्था लि.';
    const depositWords = getAmountInWordsMarathi(account.depositAmount || 0);

    const message = 
`🏦 *${sansthaName}*
----------------------------------------
*मुदत ठेव पावती (Fixed Deposit Receipt)*

नमस्कार *${account.memberName}*,
तुमचे नवीन मुदत ठेव खाते यशस्वीरित्या उघडले गेले आहे.

📄 *पावती क्रमांक:* ${account.accountNo}
👤 *सभासद कोड:* ${account.memberCode || '-'}
💰 *ठेव रक्कम:* ₹ ${account.depositAmount?.toLocaleString('en-IN')} (${depositWords})
📊 *मुदत ठेव योजना:* ${account.schemeName}
📈 *वार्षिक व्याजदर:* ${account.interestRate}%
🗓️ *ठेव दिनांक:* ${formatDate(account.openingDate)}
⏰ *मुदतपूर्ती तारीख:* ${formatDate(account.maturityDate)}
💵 *मुदतपूर्ती रक्कम:* ₹ ${account.maturityAmount?.toLocaleString('en-IN')}
${account.nomineeName ? `👨‍👩‍👧 *वारसदार:* ${account.nomineeName} (${account.nomineeRelation || '-'})` : ''}

सदर पावती संस्थेकडून प्राप्त करून घ्यावी.
धन्यवाद! 🙏
*${sansthaName}*`;

    const encodedMsg = encodeURIComponent(message);
    const cleanMobile = account.mobileNo ? account.mobileNo.replace(/\D/g, '') : '';
    if (!navigator.onLine) {
      alert('इंटरनेट कनेक्शन उपलब्ध नाही (Offline Mode). कृपया पावती प्रिंट करा.');
      return;
    }

    // Open WhatsApp Web or Mobile app
    const waUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encodedMsg}`;
    window.open(waUrl, '_blank');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (amount: number) =>
    `₹ ${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const depositInWords = getAmountInWordsMarathi(account.depositAmount || 0);
  const maturityInWords = getAmountInWordsMarathi(account.maturityAmount || 0);

  // Compact Single Half-A4 (A5 Size) Receipt Card Component
  const RenderReceiptCard = ({ copyType }: { copyType: 'ग्राहक प्रत (Member Copy)' | 'दप्तर प्रत (Office Copy)' }) => (
    <div
      className={`p-3.5 relative ${
        printMode === 'blank'
          ? 'border-2 border-double border-primary/80 rounded-md bg-white shadow-2xs'
          : 'border-transparent'
      } text-[11px] leading-tight font-sans`}
    >
      {/* Background Watermark */}
      {printMode === 'blank' && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-0">
          <div className="text-center">
            <span className="text-6xl">🏦</span>
            <h2 className="text-3xl font-black tracking-widest uppercase mt-1">SMART BANKING</h2>
          </div>
        </div>
      )}

      <div className="relative z-10 space-y-2">
        {/* Header Block (Sanstha Name & Info) */}
        {showHeader && (
          <div className="text-center border-b border-primary/30 pb-1.5 space-y-0.5">
            <div className="flex items-center justify-between text-[9px] font-bold text-primary">
              <span>मल्टीस्टेट को-ऑपरेटिव्ह पतसंस्था</span>
              <span className="bg-primary/10 border border-primary/30 text-primary px-2 py-0.5 rounded font-black text-[9px]">
                {copyType}
              </span>
            </div>
            <h1 className="text-base font-black text-primary tracking-wide">
              {sanstha?.sansthaName || 'स्मार्ट मल्टीस्टेट को-ऑपरेटिव्ह पतसंस्था लि.'}
            </h1>
            <p className="text-[9px] font-medium text-slate-600">
              {sanstha?.address ? `${sanstha.address}, ${sanstha.village || ''} ${sanstha.taluka ? 'ता. ' + sanstha.taluka : ''}` : 'मुख्य कार्यालय: लक्ष्मी रोड, पुणे - ४११०३०'}
            </p>
            <div className="flex items-center justify-center gap-3 text-[9px] text-slate-500 font-medium pt-0.5">
              <span>नोंदणी क्र: <strong>{sanstha?.registrationNo || 'REG/MS/1024/2020'}</strong></span>
              <span>•</span>
              <span>संपर्क: <strong>{sanstha?.contactNo || '9876543210'}</strong></span>
              {account.branchName && (
                <>
                  <span>•</span>
                  <span>शाखा: <strong className="text-primary font-bold">{account.branchName}</strong></span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Certificate Title Banner */}
        {printMode === 'blank' && (
          <div className="flex items-center justify-between border-y border-primary/20 py-1 my-1 text-[10px]">
            <div className="font-bold text-slate-700 font-mono">
              पावती क्र: <strong className="text-primary font-black text-xs">{account.accountNo}</strong>
            </div>
            <div className="bg-gradient-to-r from-primary via-[#004a75] to-primary text-white font-black px-4 py-0.5 rounded-full text-[10px] tracking-wider uppercase shadow-2xs">
              मुदत ठेव पावती (FIXED DEPOSIT RECEIPT)
            </div>
            <div className="font-bold text-slate-700 font-mono text-right">
              दिनांक: <strong className="text-slate-900">{formatDate(account.openingDate)}</strong>
            </div>
          </div>
        )}

        {/* Official Legal Statement */}
        <div className="bg-slate-50/90 border border-slate-200 p-2 rounded text-[10px] leading-snug text-slate-800 text-justify">
          प्रमाणित करण्यात येते की, श्री/श्रीमती <strong className="text-slate-950 font-bold">{account.memberName}</strong> (सभासद कोड: <strong className="text-primary font-mono font-bold">{account.memberCode || '-'}</strong>) यांनी शाखेत <strong className="text-primary font-black">{formatCurrency(account.depositAmount)}</strong> ठेव जमा केली असून नियमानुसार स्वीकारण्यात आली आहे.
        </div>

        {/* Particulars Grid Table */}
        <div className="border border-slate-300 rounded overflow-hidden text-[10px]">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-slate-200 bg-slate-100/60">
                <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200 w-1/4">पावती / खाते क्र.</td>
                <td className="p-1.5 font-black text-primary font-mono text-xs w-1/4">{account.accountNo}</td>
                <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200 border-l w-1/4">ठेव दिनांक</td>
                <td className="p-1.5 font-bold text-slate-900 w-1/4">{formatDate(account.openingDate)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">ठेव मुद्दल रक्कम (₹)</td>
                <td className="p-1.5 font-black text-primary text-xs" colSpan={3}>
                  {formatCurrency(account.depositAmount)} <span className="font-bold text-slate-700 italic font-normal">({depositInWords})</span>
                </td>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-100/60">
                <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">ठेव योजना (Scheme)</td>
                <td className="p-1.5 font-bold text-slate-900">{account.schemeName} ({account.schemeCode || '-'})</td>
                <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200 border-l">वार्षिक व्याजदर (%)</td>
                <td className="p-1.5 font-black text-slate-900">{account.interestRate}% प्रतिवर्ष</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">मुदतपूर्ती दिनांक</td>
                <td className="p-1.5 font-extrabold text-emerald-800">{formatDate(account.maturityDate)}</td>
                <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200 border-l">मुदतपूर्ती रक्कम (₹)</td>
                <td className="p-1.5 font-black text-emerald-700 text-xs">{formatCurrency(account.maturityAmount)}</td>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-100/60">
                <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">मुदतपूर्ती अक्षरी रक्कम</td>
                <td className="p-1.5 font-bold text-slate-800 italic" colSpan={3}>
                  {maturityInWords}
                </td>
              </tr>
              {account.nomineeName ? (
                <tr>
                  <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200">वारसदाराचे नाव व नाते</td>
                  <td className="p-1.5 font-bold text-slate-900" colSpan={3}>
                    {account.nomineeName} {account.nomineeRelation ? `(${account.nomineeRelation})` : ''}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* 3-Signature Footer */}
        <div className="pt-4 flex items-end justify-between text-[10px] font-bold text-slate-900">
          <div className="text-center w-28 border-t border-slate-400 pt-0.5">
            ठेवदाराची सही<br />
            <span className="text-[8px] text-slate-500 font-normal">(Depositor Sign)</span>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full border border-dashed border-primary/40 flex items-center justify-center text-[8px] text-primary/60 font-bold mx-auto text-center p-0.5">
              संस्थेचा शिक्का<br />(Official Seal)
            </div>
          </div>
          <div className="text-center w-36 border-t border-slate-400 pt-0.5">
            शाखा व्यवस्थापक / अधिकारी<br />
            <span className="text-[8px] text-slate-500 font-normal">(Manager Sign)</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-start z-50 p-3 overflow-hidden print:p-0 print:bg-white print:static print:inset-auto print:block">
      {/* ========================================================
          TOP CONTROL PANEL (HIDDEN WHEN PRINTING)
         ======================================================== */}
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl mb-3 p-3.5 no-print shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              🖨️
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">मुदत ठेव पावती सेटिंग्स (Print / Save PDF / WhatsApp)</h2>
              <p className="text-[10px] text-slate-500">अचूक मराठी फॉन्टसह पावती प्रिंंट करा, PDF सेव्ह करा किंवा WhatsApp वर पाठवा.</p>
            </div>
          </div>
          
          {/* Action Buttons: Print / Save PDF, WhatsApp Share, Close */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintOrPdf}
              className="bg-primary hover:bg-[#00426b] text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>🖨️</span> प्रिंट / PDF सेव्ह करा
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>📲</span> WhatsApp शेअर
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer"
            >
              ❌ बंद करा
            </button>
          </div>
        </div>

        {/* Configuration Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          {/* Copies Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">१. पावती मांडणी (Layout):</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setCopies('dual')}
                className={`flex-1 py-1 px-2 text-[10px] font-bold rounded transition-colors ${
                  copies === 'dual' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                📄 A4 वर २ पावत्या
              </button>
              <button
                type="button"
                onClick={() => setCopies('single')}
                className={`flex-1 py-1 px-2 text-[10px] font-bold rounded transition-colors ${
                  copies === 'single' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                📑 १ पावती (A5)
              </button>
            </div>
          </div>

          {/* Paper Mode Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">२. कागद प्रकार (Paper Mode):</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => handleModeChange('blank')}
                className={`flex-1 py-1 px-2 text-[10px] font-bold rounded transition-colors ${
                  printMode === 'blank' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                📜 कोरा कागद
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('preprinted')}
                className={`flex-1 py-1 px-2 text-[10px] font-bold rounded transition-colors ${
                  printMode === 'preprinted' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                📑 छापील पावती
              </button>
            </div>
          </div>

          {/* Top Offset Slider */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">
              ३. वरचे अंतर (Top Margin): <span className="text-primary font-mono font-extrabold">{topOffset} mm</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="80"
                value={topOffset}
                onChange={(e) => setTopOffset(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <input
                type="number"
                min="0"
                max="80"
                value={topOffset}
                onChange={(e) => setTopOffset(Number(e.target.value) || 0)}
                className="w-12 border border-gray-300 rounded px-1 py-0.5 text-center bg-white font-mono font-bold text-xs"
              />
            </div>
          </div>

          {/* Left Offset Slider */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">
              ४. डावे अंतर (Left Margin): <span className="text-primary font-mono font-extrabold">{leftOffset} mm</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="80"
                value={leftOffset}
                onChange={(e) => setLeftOffset(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <input
                type="number"
                min="0"
                max="80"
                value={leftOffset}
                onChange={(e) => setLeftOffset(Number(e.target.value) || 0)}
                className="w-12 border border-gray-300 rounded px-1 py-0.5 text-center bg-white font-mono font-bold text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          SCROLLABLE PREVIEW CANVAS AREA (FULL A4 CONTAINER)
         ======================================================== */}
      <div className="flex-1 w-full overflow-y-auto p-4 flex justify-center bg-slate-900/40 rounded-xl no-print-scroll">
        <div
          ref={receiptRef}
          className="w-full max-w-3xl bg-white text-slate-900 shadow-2xl print:shadow-none transition-all duration-150 print-area relative p-4 space-y-4"
          style={{
            marginTop: `${topOffset}mm`,
            marginLeft: `${leftOffset}mm`,
          }}
        >
          {/* Top Receipt Copy 1 */}
          <RenderReceiptCard copyType="ग्राहक प्रत (Member Copy)" />

          {/* Dashed Separator Line for Cut-out */}
          {copies === 'dual' && (
            <>
              <div className="relative flex items-center justify-center my-2 no-print-line">
                <div className="border-t-2 border-dashed border-slate-400 w-full"></div>
                <span className="absolute bg-white px-3 text-[10px] font-bold text-slate-500 font-mono tracking-wider">
                  ✂️ ------------------ इथून कापा (Cut Here) ------------------ ✂️
                </span>
              </div>

              {/* Bottom Receipt Copy 2 */}
              <RenderReceiptCard copyType="दप्तर प्रत (Office Copy)" />
            </>
          )}
        </div>
      </div>

      {/* Embedded CSS for Clean Vector PDF & A4 Printing */}
      <style>{`
        @media print {
          .no-print, .no-print-scroll {
            display: none !important;
          }
          html, body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
          .fixed, .backdrop-blur-xs {
            position: static !important;
            background: transparent !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            inset: auto !important;
          }
          .print-area {
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin-top: 0 !important;
            margin-left: 0 !important;
            padding: 2mm !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
};

export default FdReceiptPrintModal;
