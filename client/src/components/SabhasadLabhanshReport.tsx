import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  Gift, 
  Building2,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DividendRow {
  memberID: number;
  memberNo: string;
  memberName: string;
  balance: number;
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

export default function SabhasadLabhanshReport() {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  const ledgerOptions = useMemo(() => [
    { value: '', label: '-- सर्व खाती / लेजर निवडा --' },
    ...ledgers.map(l => {
      const legacyPart = l.legacyLedgerId ? ` [जुना क्र: ${l.legacyLedgerId}]` : '';
      const engPart = l.ledgerNameEnglish ? ` (${l.ledgerNameEnglish})` : '';
      const groupPart = l.accountGroup?.groupName ? ` - ${l.accountGroup.groupName}` : '';
      return {
        value: l.ledgerID.toString(),
        label: `${l.ledgerID} - ${l.ledgerName}${engPart}${legacyPart}${groupPart}`
      };
    })
  ], [ledgers]);

  const [branches, setBranches] = useState<any[]>([]);
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  useEffect(() => {
    fetchInitData();
    fetchBranches();
    fetchSansthaDetails();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

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

  const fetchInitData = async () => {
    try {
      const [resFy, resLedgers] = await Promise.all([
        axios.get('/api/FinancialYears'),
        axios.get('/api/Ledgers')
      ]);

      if (resFy.data) {
        const active = resFy.data.find((y: any) => y.isActive);
        if (active && active.endDate) {
          setAsOfDate(active.endDate.split('T')[0]);
        }
      }

      if (resLedgers.data) {
        setLedgers(resLedgers.data);
        const dividendLedger = resLedgers.data.find((l: any) => 
          (l.ledgerName.includes('देणे') && (l.ledgerName.includes('लाभांश') || l.ledgerName.includes('डिव्हीडंड'))) ||
          l.ledgerName.includes('डिव्हीडंड') || l.ledgerName.includes('लाभांश')
        );
        if (dividendLedger) {
          setSelectedLedgerId(dividendLedger.ledgerID.toString());
        }
      }
    } catch (error) {
      console.error('Failed to initialize dividend report data', error);
    }
  };

  const fetchReport = async (bId?: string) => {
    if (!selectedLedgerId) {
      alert('कृपया खाते (Ledger) निवडा.');
      return;
    }
    setLoading(true);
    try {
      const branchToUse = bId !== undefined ? bId : selectedBranchId;
      let url = `/api/Reports/member-ledger-balances?ledgerId=${selectedLedgerId}`;
      if (asOfDate) url += `&asOfDate=${asOfDate}`;
      if (branchToUse && branchToUse !== 'all') {
        url += `&branchId=${branchToUse}`;
      }

      const res = await axios.get(url);
      setReportData(res.data);
    } catch (error) {
      console.error('Error fetching dividend report', error);
      alert('लाभांश यादी लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const getBranchName = () => {
    if (!selectedBranchId || selectedBranchId === 'all') return 'सर्व शाखा (All Branches)';
    const b = branches.find((item: any) => item.branchID.toString() === selectedBranchId.toString());
    return b ? b.branchName : 'मुख्य शाखा';
  };

  const handlePrint = () => {
    window.print();
  };

  const rows: DividendRow[] = reportData?.rows || [];

  const filteredRows = rows.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (r.memberNo && r.memberNo.toLowerCase().includes(term)) ||
      (r.memberName && r.memberName.toLowerCase().includes(term))
    );
  });

  const totalBalanceSum = filteredRows.reduce((sum, r) => sum + (r.balance || 0), 0);

  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('एक्सपोर्ट करण्यासाठी माहिती नाही.');
      return;
    }

    const excelData: any[] = [];
    let sr = 1;

    filteredRows.forEach((row) => {
      excelData.push({
        'अ.क्र.': sr++,
        'सभासद नं.': row.memberNo,
        'सभासदाचे नाव': row.memberName,
        'लाभांश शिल्लक (₹)': row.balance
      });
    });

    excelData.push({
      'अ.क्र.': '' as any,
      'सभासद नं.': '',
      'सभासदाचे नाव': 'एकूण (Grand Total):',
      'लाभांश शिल्लक (₹)': totalBalanceSum
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'सभासद लाभांश यादी');
    XLSX.writeFile(workbook, `Sabhasad_Labhansh_Yadi_${asOfDate}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 8mm 8mm 8mm;
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
              <Gift size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>सभासद लाभांश यादी</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Dividend List Report)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Branch */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
              <select
                value={selectedBranchId}
                disabled={hasGlobalBranch}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBranchId(val);
                  if (selectedLedgerId) fetchReport(val);
                }}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
              >
                <option value="all">सर्व शाखा (All)</option>
                {branches.map((b: any) => (
                  <option key={b.branchID} value={b.branchID.toString()}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Ledger Select */}
            <div className="w-52 sm:w-64">
              <SearchableSelect
                name="selectedLedgerId"
                options={ledgerOptions}
                value={selectedLedgerId}
                onChange={(e: any) => setSelectedLedgerId(e.target.value)}
                placeholder="-- खाते (Ledger) निवडा --"
              />
            </div>

            {/* As of Date */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">दिनांक:</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* Search View Button */}
            <button
              onClick={() => fetchReport()}
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
              disabled={filteredRows.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredRows.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={filteredRows.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredRows.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              placeholder="नाव किंवा सभासद क्र. शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              एकूण सभासद: <strong className="text-primary font-bold">{filteredRows.length}</strong>
            </span>
            <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
              एकूण लाभांश: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalBalanceSum)}</strong>
            </span>
          </div>
        </div>

      </div>

      {/* Main Printable A4 Document Frame */}
      <div 
        ref={reportRef} 
        className="print-area bg-white mx-auto max-w-4xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between"
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
                <span>शाखा: </span>
                <span className="text-primary font-bold">{getBranchName()}</span>
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
                सभासद लाभांश यादी (Dividend List)
              </h2>
            </div>

            {/* Date Tag on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>दिनांक : </span>
              <span className="font-mono">{formatDisplayDate(asOfDate)} पर्यंत</span>
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse border border-gray-900 text-xs">
              <thead>
                <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                  <th className="border border-gray-900 py-1.5 px-1 w-[8%] text-center">अ.क्र.</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[22%] text-center">सभासद क्र.</th>
                  <th className="border border-gray-900 py-1.5 px-3 w-[46%] text-left">सभासदाचे नाव</th>
                  <th className="border border-gray-900 py-1.5 px-3 w-[24%] text-right font-extrabold">लाभांश रक्कम</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      कोणतीही लाभांश नोंद आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, idx) => (
                    <tr key={r.memberID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                      <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">
                        {idx + 1}
                      </td>
                      <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-gray-900">
                        {r.memberNo}
                      </td>
                      <td className="border border-gray-900 py-1 px-3 font-medium">
                        {r.memberName}
                      </td>
                      <td className="border border-gray-900 py-1 px-3 text-right font-mono font-bold text-emerald-800">
                        {fmtCurrency(r.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                    <td colSpan={3} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण लाभांश बेरीज (Grand Total):
                    </td>
                    <td className="border border-gray-900 py-1.5 px-3 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                      ₹ {fmtCurrency(totalBalanceSum)}
                    </td>
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
            <p className="border-t border-gray-800 mx-4 pt-1">लिपिक / सहाय्यक</p>
            <span className="text-[10px] text-gray-500 font-normal">(Clerk / Assistant)</span>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">लेखापाल / तपासनीस</p>
            <span className="text-[10px] text-gray-500 font-normal">(Accountant / Inspector)</span>
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
