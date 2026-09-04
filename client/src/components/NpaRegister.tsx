import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  AlertOctagon, 
  Layers, 
  Calculator,
  Building2,
  Calendar
} from 'lucide-react';

interface NpaRegisterDto {
  loanAccountID: number;
  accountNo: string;
  memberCode: string;
  name: string;
  loanType: string;
  sanctionedAmount: number;
  disbursementDate: string | null;
  principalBalance: number;
  outstandingBalance: number;
  overdueDate: string | null;
  overdueAmount: number;
  overdueInstallments: number;
  installmentAmount: number;
  overdueMonths: number;
  npaDate: string | null;
  receivableInterest: number;
  balanceForProvisioning: number;
  securityType: string;
  collateralValue: number;
  securedAmount: number;
  unsecuredAmount: number;
  npaPercentage: number;
  provisionAmount: number;
  category: string;
  categoryMarathi: string;
}

const CATEGORY_ORDER = [
  { key: 'Sub-Standard', title: '१. सब-स्टँडर्ड कर्ज (Sub-Standard Assets)', desc: 'थकबाकी कालावधी ३ महिने ते १२ महिने' },
  { key: 'Doubtful-1', title: '२. संशयित १ कर्ज (Doubtful-1 Assets)', desc: 'थकबाकी कालावधी १ वर्षापर्यंत' },
  { key: 'Doubtful-2', title: '३. संशयित २ कर्ज (Doubtful-2 Assets)', desc: 'थकबाकी कालावधी १ ते ३ वर्षे' },
  { key: 'Doubtful-3', title: '४. संशयित ३ कर्ज (Doubtful-3 Assets)', desc: 'थकबाकी कालावधी ३ वर्षांपेक्षा जास्त' },
  { key: 'Loss', title: '५. बुडीत कर्ज (Loss Assets)', desc: '१००% प्रोव्हिजन आवश्यक असणारी खाती' },
  { key: 'Standard', title: '६. नियममित कर्ज (Standard Assets)', desc: 'नियममित चालू खाती (०.२५% / ०.४०% तरतूद)' },
];

const fmtCurrency = (val: number | null | undefined) => {
  return Math.round(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatDisplayDate = (dStr: string | null | undefined) => {
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

export default function NpaRegister() {
  const [data, setData] = useState<NpaRegisterDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('ONLY_NPA');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [recalculating, setRecalculating] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSansthaDetails();
    fetchBranches();
    fetchData(asOfDate, initialBranchId);
  }, []);

  useEffect(() => {
    fetchData(asOfDate, selectedBranchId);
  }, [asOfDate, selectedBranchId]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error(err);
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

  const fetchData = async (targetDate?: string, bId?: string) => {
    setLoading(true);
    try {
      const dateToUse = targetDate || asOfDate;
      const branchToUse = bId !== undefined ? bId : selectedBranchId;
      let url = `/api/npa/register?asOfDate=${dateToUse}`;
      if (branchToUse && branchToUse !== 'all') {
        url += `&branchId=${branchToUse}`;
      }
      const res = await axios.get(url);
      setData(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getBranchName = () => {
    if (!selectedBranchId || selectedBranchId === 'all') return 'सर्व शाखा (All Branches)';
    const b = branches.find((item: any) => item.branchID.toString() === selectedBranchId.toString());
    return b ? b.branchName : 'मुख्य शाखा';
  };

  const handleRecalculateNpa = async () => {
    setRecalculating(true);
    try {
      await axios.post('/api/npa/run', { asOfDate, triggeredBy: 'User-Manual' });
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('NPA मोजणी करताना त्रुटी आली.');
    } finally {
      setRecalculating(false);
    }
  };

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Category filter
      if (categoryFilter === 'ONLY_NPA' && item.category === 'Standard') return false;
      if (categoryFilter === 'Standard' && item.category !== 'Standard') return false;
      if (categoryFilter === 'Sub-Standard' && item.category !== 'Sub-Standard') return false;
      if (categoryFilter === 'Doubtful' && !item.category.startsWith('Doubtful')) return false;
      if (categoryFilter === 'Loss' && item.category !== 'Loss') return false;

      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesName = (item.name || '').toLowerCase().includes(term);
        const matchesAccount = (item.accountNo || '').toLowerCase().includes(term);
        const matchesMemberCode = (item.memberCode || '').toLowerCase().includes(term);
        const matchesLoanType = (item.loanType || '').toLowerCase().includes(term);
        return matchesName || matchesAccount || matchesMemberCode || matchesLoanType;
      }

      return true;
    });
  }, [data, categoryFilter, searchTerm]);

  // Grouped by Category
  const groupedData = useMemo(() => {
    const groups: { [key: string]: NpaRegisterDto[] } = {};
    CATEGORY_ORDER.forEach((cat) => {
      groups[cat.key] = [];
    });

    filteredData.forEach((item) => {
      const catKey = item.category || 'Standard';
      if (!groups[catKey]) groups[catKey] = [];
      groups[catKey].push(item);
    });

    return groups;
  }, [filteredData]);

  // Overall Totals
  const totalSanctioned = useMemo(() => Math.round(filteredData.reduce((sum, i) => sum + i.sanctionedAmount, 0)), [filteredData]);
  const totalPrincipal = useMemo(() => Math.round(filteredData.reduce((sum, i) => sum + i.principalBalance, 0)), [filteredData]);
  const totalInterest = useMemo(() => Math.round(filteredData.reduce((sum, i) => sum + i.receivableInterest, 0)), [filteredData]);
  const totalOutstanding = useMemo(() => Math.round(filteredData.reduce((sum, i) => sum + i.outstandingBalance, 0)), [filteredData]);
  const totalOverdue = useMemo(() => Math.round(filteredData.reduce((sum, i) => sum + i.overdueAmount, 0)), [filteredData]);
  const totalSecured = useMemo(() => Math.round(filteredData.reduce((sum, i) => sum + i.securedAmount, 0)), [filteredData]);
  const totalUnsecured = useMemo(() => Math.round(filteredData.reduce((sum, i) => sum + i.unsecuredAmount, 0)), [filteredData]);
  const totalProvision = useMemo(() => Math.round(filteredData.reduce((sum, i) => sum + i.provisionAmount, 0)), [filteredData]);

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;

    const rows: any[] = [];
    rows.push([sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित']);
    rows.push([`NPA तरतूद माहिती (NPA Provision Register) - दिनांक ${formatDisplayDate(asOfDate)} अखेर`]);
    rows.push([]);

    rows.push([
      'अ.क्र',
      'सभासद नं',
      'खाते नं',
      'सभासदाचे नाव',
      'कर्ज प्रकार',
      'मंजूर रक्कम',
      'उचल दिनांक',
      'मुद्दल बाकी',
      'येणे व्याज',
      'एकूण येणे',
      'थकबाकी दिनांक',
      'थकबाकी रक्कम',
      'थकीत महिने',
      'तारण प्रकार',
      'तारणी बाकी',
      'विनातारणी बाकी',
      'वर्गवारी',
      'तरतूद %',
      'आवश्यक तरतूद'
    ]);

    let srNo = 1;
    CATEGORY_ORDER.forEach((catInfo) => {
      const items = groupedData[catInfo.key] || [];
      if (items.length === 0) return;

      rows.push([`--- ${catInfo.title} ---`]);
      items.forEach((item) => {
        rows.push([
          srNo++,
          item.memberCode,
          item.accountNo,
          item.name,
          item.loanType,
          Math.round(item.sanctionedAmount),
          formatDisplayDate(item.disbursementDate),
          Math.round(item.principalBalance),
          Math.round(item.receivableInterest),
          Math.round(item.outstandingBalance),
          formatDisplayDate(item.overdueDate),
          Math.round(item.overdueAmount),
          item.overdueMonths,
          item.securityType,
          Math.round(item.securedAmount),
          Math.round(item.unsecuredAmount),
          item.categoryMarathi || item.category,
          `${item.npaPercentage}%`,
          Math.round(item.provisionAmount)
        ]);
      });

      // Subtotal Row
      const subSanctioned = Math.round(items.reduce((s, i) => s + i.sanctionedAmount, 0));
      const subPrincipal = Math.round(items.reduce((s, i) => s + i.principalBalance, 0));
      const subInterest = Math.round(items.reduce((s, i) => s + i.receivableInterest, 0));
      const subOutstanding = Math.round(items.reduce((s, i) => s + i.outstandingBalance, 0));
      const subOverdue = Math.round(items.reduce((s, i) => s + i.overdueAmount, 0));
      const subSecured = Math.round(items.reduce((s, i) => s + i.securedAmount, 0));
      const subUnsecured = Math.round(items.reduce((s, i) => s + i.unsecuredAmount, 0));
      const subProvision = Math.round(items.reduce((s, i) => s + i.provisionAmount, 0));

      rows.push([
        '',
        '',
        '',
        `पोट-एकूण (${catInfo.key})`,
        '',
        subSanctioned,
        '',
        subPrincipal,
        subInterest,
        subOutstanding,
        '',
        subOverdue,
        '',
        '',
        subSecured,
        subUnsecured,
        '',
        '',
        subProvision
      ]);
      rows.push([]);
    });

    rows.push([
      'एकूण',
      '',
      '',
      'सर्व खात्यांची एकूण (Grand Total)',
      '',
      totalSanctioned,
      '',
      totalPrincipal,
      totalInterest,
      totalOutstanding,
      '',
      totalOverdue,
      '',
      '',
      totalSecured,
      totalUnsecured,
      '',
      '',
      totalProvision
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NPA_Provision_Register');
    XLSX.writeFile(wb, `NPA_Provision_Register_${asOfDate}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A3 landscape;
              margin: 5mm 5mm 6mm 5mm;
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
              <AlertOctagon size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>NPA तरतूद माहिती</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(NPA Provision Register)</span>
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
                onChange={(e) => setSelectedBranchId(e.target.value)}
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

            {/* Category Filter */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">वर्गवारी:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-36 sm:w-44 font-semibold text-primary"
              >
                <option value="ONLY_NPA">फक्त NPA खाती (NPA Only)</option>
                <option value="ALL">सर्व खाती (All Accounts)</option>
                <option value="Sub-Standard">१. सब-स्टँडर्ड (Sub-Standard)</option>
                <option value="Doubtful">२. संशयित (Doubtful D1/D2/D3)</option>
                <option value="Loss">३. बुडीत (Loss Assets)</option>
                <option value="Standard">४. नियममित (Standard Assets)</option>
              </select>
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
              onClick={() => fetchData()}
              disabled={loading || recalculating}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
              <span>पहा</span>
            </button>

            {/* Recalculate NPA Run Button */}
            <button
              onClick={handleRecalculateNpa}
              disabled={loading || recalculating}
              className="h-6 bg-purple-700 hover:bg-purple-800 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="या तारखेसाठी सिस्टीम NPA मोजणी नव्याने रन करा"
            >
              <Calculator size={11} />
              <span>{recalculating ? 'मोजणी चालू...' : 'NPA मोजणी'}</span>
            </button>
          </div>

          {/* Right: Export & Print Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={filteredData.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={filteredData.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="A3/A4 प्रिंट काढा"
            >
              <Printer size={12} />
              <span>प्रिंट</span>
            </button>
          </div>

        </div>

        {/* Row 2: In-Table Search + Summary Metrics Strip */}
        <div className="pt-1.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="relative w-64 max-w-full">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="नाव / खाते क्र. / सभासद क्र. शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              एकूण खाती: <strong className="text-primary font-bold">{filteredData.length}</strong>
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              मुद्दल बाकी: <strong className="text-primary font-bold">₹ {fmtCurrency(totalPrincipal)}</strong>
            </span>
            <span className="bg-amber-50 px-2 py-0.5 rounded text-amber-800 border border-amber-200">
              येणे व्याज: <strong className="text-amber-800 font-bold">₹ {fmtCurrency(totalInterest)}</strong>
            </span>
            <span className="bg-red-50 px-2 py-0.5 rounded text-red-800 border border-red-200">
              एकूण येणे: <strong className="text-red-700 font-bold">₹ {fmtCurrency(totalOutstanding)}</strong>
            </span>
            <span className="bg-purple-100 px-2 py-0.5 rounded text-purple-950 border border-purple-300 font-black">
              आवश्यक तरतूद: ₹ {fmtCurrency(totalProvision)}
            </span>
          </div>
        </div>

      </div>

      {/* Main Printable Document Frame */}
      <div 
        ref={reportRef} 
        className="print-area bg-white mx-auto max-w-full p-4 md:p-6 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between"
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
                NPA तरतूद माहिती (NPA Provision Register)
              </h2>
            </div>

            {/* Date Tag on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>दिनांक : </span>
              <span className="font-mono">{formatDisplayDate(asOfDate)} अखेर</span>
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-center border-collapse border border-gray-900 text-[10.5px]">
              <thead>
                <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                  <th className="border border-gray-900 py-1.5 px-1 font-semibold">अ.क्र</th>
                  <th className="border border-gray-900 py-1.5 px-1 font-semibold">सभासद नं</th>
                  <th className="border border-gray-900 py-1.5 px-1 font-semibold">खाते नं</th>
                  <th className="border border-gray-900 py-1.5 px-2 font-semibold text-left min-w-[140px]">सभासदाचे नाव</th>
                  <th className="border border-gray-900 py-1.5 px-1 font-semibold text-left">कर्ज प्रकार</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 font-semibold text-right">मंजूर रक्कम</th>
                  <th className="border border-gray-900 py-1.5 px-1 font-semibold">उचल दिनांक</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 font-semibold text-right">मुद्दल बाकी</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 font-semibold text-right">येणे व्याज</th>
                  <th className="border border-gray-900 py-1.5 px-2 font-semibold text-right bg-slate-200">एकूण येणे</th>
                  <th className="border border-gray-900 py-1.5 px-1 font-semibold">थकबाकी दि.</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 font-semibold text-right text-red-800">थकबाकी</th>
                  <th className="border border-gray-900 py-1.5 px-1 font-semibold">थकीत महिने</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 font-semibold text-left">तारण प्रकार</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 font-semibold text-right">तारणी बाकी</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 font-semibold text-right">विनातारणी बाकी</th>
                  <th className="border border-gray-900 py-1.5 px-1 font-semibold">तरतूद %</th>
                  <th className="border border-gray-900 py-1.5 px-2 font-semibold text-right bg-purple-100 text-purple-950 font-black">आवश्यक तरतूद</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={18} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      निवडलेल्या निकषांनुसार कोणतीही नोंद आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  CATEGORY_ORDER.map((catInfo) => {
                    const items = groupedData[catInfo.key] || [];
                    if (items.length === 0) return null;

                    const subSanctioned = items.reduce((s, i) => s + i.sanctionedAmount, 0);
                    const subPrincipal = items.reduce((s, i) => s + i.principalBalance, 0);
                    const subInterest = items.reduce((s, i) => s + i.receivableInterest, 0);
                    const subOutstanding = items.reduce((s, i) => s + i.outstandingBalance, 0);
                    const subOverdue = items.reduce((s, i) => s + i.overdueAmount, 0);
                    const subSecured = items.reduce((s, i) => s + i.securedAmount, 0);
                    const subUnsecured = items.reduce((s, i) => s + i.unsecuredAmount, 0);
                    const subProvision = items.reduce((s, i) => s + i.provisionAmount, 0);

                    return (
                      <React.Fragment key={catInfo.key}>
                        <tr className="bg-gray-100 font-bold border-t border-b border-gray-900">
                          <td colSpan={18} className="py-1 px-2 text-left text-primary font-bold">
                            › {catInfo.title} ({items.length} खाती)
                          </td>
                        </tr>

                        {items.map((item, idx) => (
                          <tr key={item.loanAccountID || idx} className="hover:bg-slate-50 text-gray-900 text-[10.5px]">
                            <td className="border border-gray-900 py-1 px-1 font-mono">{idx + 1}</td>
                            <td className="border border-gray-900 py-1 px-1 font-mono">{item.memberCode}</td>
                            <td className="border border-gray-900 py-1 px-1 font-mono font-bold text-gray-900">{item.accountNo}</td>
                            <td className="border border-gray-900 py-1 px-2 text-left font-medium">{item.name}</td>
                            <td className="border border-gray-900 py-1 px-1 text-left text-gray-700">{item.loanType}</td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">{fmtCurrency(item.sanctionedAmount)}</td>
                            <td className="border border-gray-900 py-1 px-1 font-mono">{formatDisplayDate(item.disbursementDate)}</td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold text-gray-900">{fmtCurrency(item.principalBalance)}</td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono text-amber-800">{fmtCurrency(item.receivableInterest)}</td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold bg-slate-50">{fmtCurrency(item.outstandingBalance)}</td>
                            <td className="border border-gray-900 py-1 px-1 font-mono">{formatDisplayDate(item.overdueDate)}</td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono text-red-700 font-bold">{fmtCurrency(item.overdueAmount)}</td>
                            <td className="border border-gray-900 py-1 px-1 font-mono font-bold">{item.overdueMonths}</td>
                            <td className="border border-gray-900 py-1 px-1.5 text-left text-[10px]">{item.securityType}</td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">{fmtCurrency(item.securedAmount)}</td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono text-red-700">{fmtCurrency(item.unsecuredAmount)}</td>
                            <td className="border border-gray-900 py-1 px-1 font-mono font-bold text-purple-800">{item.npaPercentage}%</td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-extrabold text-purple-950 bg-purple-50/60">{fmtCurrency(item.provisionAmount)}</td>
                          </tr>
                        ))}

                        {/* Subtotal Row */}
                        <tr className="bg-gray-50/80 font-bold border-t border-b border-gray-800 text-[10.5px]">
                          <td colSpan={5} className="border border-gray-900 py-1 px-2 text-right italic">
                            उप-एकूण ({catInfo.key}):
                          </td>
                          <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold">{fmtCurrency(subSanctioned)}</td>
                          <td className="border border-gray-900"></td>
                          <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold">{fmtCurrency(subPrincipal)}</td>
                          <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold text-amber-800">{fmtCurrency(subInterest)}</td>
                          <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold bg-slate-100">{fmtCurrency(subOutstanding)}</td>
                          <td className="border border-gray-900"></td>
                          <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold text-red-700">{fmtCurrency(subOverdue)}</td>
                          <td className="border border-gray-900"></td>
                          <td className="border border-gray-900"></td>
                          <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold">{fmtCurrency(subSecured)}</td>
                          <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold text-red-700">{fmtCurrency(subUnsecured)}</td>
                          <td className="border border-gray-900"></td>
                          <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-purple-950 bg-purple-100/60">{fmtCurrency(subProvision)}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              
              {/* Grand Total Footer */}
              {filteredData.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-[11px]">
                    <td colSpan={5} className="border border-gray-900 py-1.5 px-2 text-right uppercase tracking-wider">
                      एकूण बेरीज (Grand Total):
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold">
                      ₹ {fmtCurrency(totalSanctioned)}
                    </td>
                    <td className="border border-gray-900"></td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold">
                      ₹ {fmtCurrency(totalPrincipal)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-amber-900">
                      ₹ {fmtCurrency(totalInterest)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-gray-950 bg-slate-200">
                      ₹ {fmtCurrency(totalOutstanding)}
                    </td>
                    <td className="border border-gray-900"></td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-red-800">
                      ₹ {fmtCurrency(totalOverdue)}
                    </td>
                    <td className="border border-gray-900"></td>
                    <td className="border border-gray-900"></td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold">
                      ₹ {fmtCurrency(totalSecured)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-red-800">
                      ₹ {fmtCurrency(totalUnsecured)}
                    </td>
                    <td className="border border-gray-900"></td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-purple-950 bg-purple-200">
                      ₹ {fmtCurrency(totalProvision)}
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
            <p className="border-t border-gray-800 mx-4 pt-1">वैधानिक लेखापरीक्षक / तपासनीस</p>
            <span className="text-[10px] text-gray-500 font-normal">(Statutory Auditor / Inspector)</span>
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
