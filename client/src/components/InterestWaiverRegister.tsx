import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  Award, 
  ShieldAlert,
  Building2,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface WaiverRecord {
  loanCollectionID: number;
  loanAccountID: number;
  receiptNo: string;
  collectionDate: string;
  totalAmountReceived: number;
  principalCollected: number;
  interestCollected: number;
  interestWaived: number;
  penaltyWaived: number;
  isOTS: boolean;
  resolutionNo?: string;
  paymentMode: string;
  remarks?: string;
  loanAccount?: {
    loanAccountNo: string;
    sanctionedAmount: number;
    member?: {
      firstName: string;
      lastName: string;
      memberCode?: string;
    };
  };
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatDisplayDate = (dStr?: string | null) => {
  if (!dStr) return '-';
  try {
    const clean = dStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dStr;
  }
};

export default function InterestWaiverRegister() {
  const [records, setRecords] = useState<WaiverRecord[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWaiverRecords();
    fetchSansthaDetails();
  }, []);

  const fetchSansthaDetails = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data) {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSansthaDetail(res.data[0]);
        } else if (!Array.isArray(res.data)) {
          setSansthaDetail(res.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWaiverRecords = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/LoanCollections');
      const filtered = (response.data || []).filter((c: any) => 
        c.isOTS || (c.interestWaived && c.interestWaived > 0) || (c.penaltyWaived && c.penaltyWaived > 0)
      );
      setRecords(filtered);
    } catch (err) {
      console.error('Error fetching interest waiver register', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchSearch =
      !searchTerm.trim() ||
      r.receiptNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.loanAccount?.loanAccountNo && r.loanAccount.loanAccountNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.loanAccount?.member &&
        `${r.loanAccount.member.firstName} ${r.loanAccount.member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.resolutionNo && r.resolutionNo.toLowerCase().includes(searchTerm.toLowerCase()));

    const cDate = r.collectionDate.split('T')[0];
    const matchStart = !startDate || cDate >= startDate;
    const matchEnd = !endDate || cDate <= endDate;

    return matchSearch && matchStart && matchEnd;
  });

  const totalWaivedSum = filteredRecords.reduce((sum, r) => sum + (r.interestWaived || 0) + (r.penaltyWaived || 0), 0);
  const totalReceivedSum = filteredRecords.reduce((sum, r) => sum + (r.totalAmountReceived || 0), 0);
  const totalPrincipalSum = filteredRecords.reduce((sum, r) => sum + (r.principalCollected || 0), 0);
  const totalInterestSum = filteredRecords.reduce((sum, r) => sum + (r.interestCollected || 0), 0);

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      alert('एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
      return;
    }

    const excelRows: any[] = [];
    let sr = 1;

    filteredRecords.forEach((r) => {
      excelRows.push({
        'अ.क्र.': sr++,
        'दिनांक': formatDisplayDate(r.collectionDate),
        'पावती नं.': r.receiptNo,
        'खाते नं.': r.loanAccount?.loanAccountNo || '-',
        'कर्जदाराचे नाव': r.loanAccount?.member ? `${r.loanAccount.member.firstName} ${r.loanAccount.member.lastName}` : '-',
        'ठराव क्र.': r.resolutionNo || '-',
        'वसूल मुद्दल (₹)': r.principalCollected || 0,
        'वसूल व्याज (₹)': r.interestCollected || 0,
        'सूट दिलेले व्याज (₹)': r.interestWaived || 0,
        'सूट दिलेला दंड (₹)': r.penaltyWaived || 0,
        'एकूण सूट (₹)': (r.interestWaived || 0) + (r.penaltyWaived || 0),
        'एकूण वसूल रक्कम (₹)': r.totalAmountReceived || 0,
        'प्रकार': r.isOTS ? 'OTS (तडजोड)' : 'व्याज सूट (Waiver)',
        'शेरा': r.remarks || '-'
      });
    });

    excelRows.push({
      'अ.क्र.': '' as any,
      'दिनांक': '',
      'पावती नं.': '',
      'खाते नं.': '',
      'कर्जदाराचे नाव': 'एकूण बेरीज (Grand Total):',
      'ठराव क्र.': `एकूण खाती: ${filteredRecords.length}`,
      'वसूल मुद्दल (₹)': totalPrincipalSum,
      'वसूल व्याज (₹)': totalInterestSum,
      'सूट दिलेले व्याज (₹)': '',
      'सूट दिलेला दंड (₹)': '',
      'एकूण सूट (₹)': totalWaivedSum,
      'एकूण वसूल रक्कम (₹)': totalReceivedSum,
      'प्रकार': '',
      'शेरा': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'OTS_Waiver_Register');
    XLSX.writeFile(workbook, `OTS_Waiver_Register_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 landscape;
              margin: 6mm 6mm 8mm 6mm;
            }
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: transparent !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            tfoot {
              display: table-footer-group;
            }
          }
        `}
      </style>

      {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print space-y-1.5">
        
        {/* Row 1: Title + Inline Filters + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          
          {/* Left: Compact Title */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Award size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>कर्ज व्याज सूट व तडजोड अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(OTS & Waiver Register)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* From Date */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पर्यंत:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* Search View Button */}
            <button
              onClick={fetchWaiverRecords}
              disabled={loading}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
              <span>पहा</span>
            </button>
          </div>

          {/* Right: Export & Print Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredRecords.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={filteredRecords.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredRecords.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="A4 प्रिंट काढा"
            >
              <Printer size={12} />
              <span>प्रिंट (A4)</span>
            </button>
          </div>

        </div>

        {/* Row 2: In-Table Search + Summary Metrics Strip */}
        <div className="pt-1.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="relative w-64 max-w-full">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="पावती नं, खाते क्र., नाव किंवा ठराव क्र. शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              तडजोड खाती: <strong className="text-primary font-bold">{filteredRecords.length}</strong>
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              वसूल मुद्दल: <strong className="text-primary font-bold">₹ {fmtCurrency(totalPrincipalSum)}</strong>
            </span>
            <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
              एकूण वसुली: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalReceivedSum)}</strong>
            </span>
            <span className="bg-amber-50 px-2 py-0.5 rounded text-amber-900 border border-amber-300 font-extrabold">
              एकूण सूट रक्कम: ₹ {fmtCurrency(totalWaivedSum)}
            </span>
          </div>
        </div>

      </div>

      {/* Main Printable Document Frame */}
      <div 
        ref={reportRef} 
        className="print-area bg-white mx-auto max-w-7xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between"
      >
        <div>
          
          {/* Official Bank Header Box (Exact Reference Format) */}
          <div className="border border-gray-900 p-3 relative text-center">
            
            {/* Registration Top Bar */}
            <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2">
              <div>
                <span>रजि. नं. - </span>
                <span className="font-mono">{sansthaDetail?.registrationNo || '-'}</span>
              </div>
              <div>
                <span>रजि. दि. - </span>
                <span className="font-mono">{sansthaDetail?.registrationDate ? formatDisplayDate(sansthaDetail.registrationDate) : '-'}</span>
              </div>
            </div>

            {/* Central Sanstha Name */}
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight leading-snug font-serif uppercase">
              {sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
            </h1>

            {/* Subtitle / Address */}
            <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1">
              {sansthaDetail?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
            </p>
          </div>

          {/* Report Title Banner Section */}
          <div className="mt-3 mb-2 flex items-center justify-between">
            <div className="w-28 hidden sm:block"></div>

            {/* Title Banner Box */}
            <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif text-center">
                कर्ज व्याज सूट व तडजोड अहवाल (OTS & Waiver Register)
              </h2>
            </div>

            {/* Date Tag on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>कालावधी : </span>
              <span className="font-mono">{formatDisplayDate(startDate)} ते {formatDisplayDate(endDate)}</span>
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse border border-gray-900 text-xs">
              <thead>
                <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                  <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center">अ.क्र.</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[8%] text-center">दिनांक</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[8%] text-center">पावती नं.</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[9%] text-center">खाते नं.</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[18%] text-left">कर्जदाराचे नाव</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[8%] text-center">ठराव क्र.</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-right">वसूल मुद्दल</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[9%] text-right">वसूल व्याज</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-right text-amber-900 font-bold">सूट रक्कम</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-right font-extrabold text-emerald-900">एकूण वसुली</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[8%] text-center">प्रकार</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[7%] text-left">शेरा</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      निवडलेल्या कालावधीत कोणतीही व्याज सूट किंवा तडजोड नोंद आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((row, idx) => {
                    const waiverAmt = (row.interestWaived || 0) + (row.penaltyWaived || 0);
                    return (
                      <tr key={row.loanCollectionID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                        <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">
                          {idx + 1}
                        </td>
                        <td className="border border-gray-900 py-1 px-1.5 text-center font-mono">
                          {formatDisplayDate(row.collectionDate)}
                        </td>
                        <td className="border border-gray-900 py-1 px-1.5 text-center font-mono font-bold text-gray-900">
                          {row.receiptNo}
                        </td>
                        <td className="border border-gray-900 py-1 px-1.5 text-center font-mono font-bold text-gray-900">
                          {row.loanAccount?.loanAccountNo || '-'}
                        </td>
                        <td className="border border-gray-900 py-1 px-2 font-medium">
                          {row.loanAccount?.member ? `${row.loanAccount.member.firstName} ${row.loanAccount.member.lastName}` : '-'}
                        </td>
                        <td className="border border-gray-900 py-1 px-1.5 text-center font-mono text-[10px]">
                          {row.resolutionNo || '-'}
                        </td>
                        <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-gray-900">
                          {fmtCurrency(row.principalCollected)}
                        </td>
                        <td className="border border-gray-900 py-1 px-1.5 text-right font-mono text-gray-900">
                          {fmtCurrency(row.interestCollected)}
                        </td>
                        <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-amber-900 bg-amber-50/50">
                          {fmtCurrency(waiverAmt)}
                        </td>
                        <td className="border border-gray-900 py-1 px-2 text-right font-mono font-extrabold text-emerald-800">
                          {fmtCurrency(row.totalAmountReceived)}
                        </td>
                        <td className="border border-gray-900 py-1 px-1.5 text-center text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${row.isOTS ? 'bg-purple-50 text-purple-800' : 'bg-blue-50 text-blue-800'}`}>
                            {row.isOTS ? 'OTS' : 'सूट'}
                          </span>
                        </td>
                        <td className="border border-gray-900 py-1 px-1.5 text-left text-[10px] text-gray-600">
                          {row.remarks || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              
              {/* Grand Total Footer */}
              {filteredRecords.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                    <td colSpan={6} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण बेरीज (Grand Total):
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-extrabold text-gray-950">
                      ₹ {fmtCurrency(totalPrincipalSum)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-gray-950">
                      ₹ {fmtCurrency(totalInterestSum)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-amber-950 bg-amber-100/60">
                      ₹ {fmtCurrency(totalWaivedSum)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/60">
                      ₹ {fmtCurrency(totalReceivedSum)}
                    </td>
                    <td colSpan={2} className="border border-gray-900"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

        </div>

        {/* Verification Signatures Section */}
        <div className="mt-14 pt-4 border-t border-dashed border-gray-400 grid grid-cols-3 text-center text-xs font-bold text-gray-900">
          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">लिपिक / वसुली अधिकारी</p>
            <span className="text-[10px] text-gray-500 font-normal">(Clerk / Recovery Officer)</span>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">लेखापाल / कर्ज अधिकारी</p>
            <span className="text-[10px] text-gray-500 font-normal">(Accountant / Loan Officer)</span>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">शाखा व्यवस्थापक / मानद सचिव</p>
            <span className="text-[10px] text-gray-500 font-normal">(Manager / Secretary)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
