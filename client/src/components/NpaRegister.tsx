import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  Printer,
  FileSpreadsheet,
  Search,
  RefreshCw,
  AlertOctagon,
  Calculator,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';

interface NpaRegisterDto {
  loanAccountID: number;
  accountNo: string;
  legacyAccountNumber?: string;
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
  oirAmount: number;
  balanceForProvisioning: number;
  securityType: string;
  collateralValue: number;
  securedAmount: number;
  unsecuredAmount: number;
  npaPercentage: number;
  provisionAmount: number;
  totalProvisionWithOir: number;
  concessionPeriodDays?: number;
  category: string;
  categoryMarathi: string;
}

interface NpaRegisterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const getLocalTodayStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getBusinessDateStr = (rawDate?: string | null): string => {
  if (rawDate && typeof rawDate === 'string') {
    const clean = rawDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  return getLocalTodayStr();
};

const fmtCurrency = (val: number | null | undefined) =>
  Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDisplayDate = (dStr: string | null | undefined) => {
  if (!dStr) return '-';
  try {
    const clean = dStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    return dStr;
  } catch {
    return dStr;
  }
};

export default function NpaRegister({ onNavigate }: NpaRegisterProps) {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);

  const [data, setData] = useState<NpaRegisterDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState<string>(() => getBusinessDateStr(user?.businessDate));
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('ONLY_NPA');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [recalculating, setRecalculating] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const initialBranchId = effectiveBranch === null ? 'all' : String(effectiveBranch);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.businessDate) {
      setAsOfDate(getBusinessDateStr(user.businessDate));
    }
  }, [user?.businessDate]);

  useEffect(() => {
    fetchSansthaDetails();
    fetchBranches();
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
      await axios.post('/api/npa/run', { asOfDate, triggeredBy: user?.username || 'User-Manual' });
      await fetchData(asOfDate, selectedBranchId);
    } catch (err) {
      console.error(err);
      alert('NPA मोजणी करताना त्रुटी आली.');
    } finally {
      setRecalculating(false);
    }
  };

  const activeConcessionDays = data[0]?.concessionPeriodDays || 180;
  const concessionLabel = activeConcessionDays === 90 ? '९० दिवस (३ महिने)' : `${activeConcessionDays} दिवस (६ महिने)`;

  const categoryOrder = useMemo(
    () => [
      {
        key: 'Sub-Standard',
        title: '१. सब-स्टँडर्ड कर्ज (Sub-Standard Assets)',
        desc: `सवलत कालावधी (${concessionLabel}) संपल्यानंतर १२ महिन्यांपर्यंत NPA`,
      },
      {
        key: 'Doubtful-1',
        title: '२. संशयित-१ कर्ज (Doubtful-1 Assets)',
        desc: 'सब-स्टँडर्ड नंतर १ ते ३ वर्षांपर्यंत NPA (१२ ते ३६ महिने)',
      },
      {
        key: 'Doubtful-2',
        title: '३. संशयित-२ कर्ज (Doubtful-2 Assets)',
        desc: '३ ते ४ वर्षांपर्यंत NPA (३६ ते ४८ महिने)',
      },
      {
        key: 'Doubtful-3',
        title: '४. संशयित-३ कर्ज (Doubtful-3 Assets)',
        desc: '४ वर्षांपेक्षा जास्त NPA (४८ महिन्यांपुढे)',
      },
      {
        key: 'Loss',
        title: '५. बुडीत / तोटा कर्ज (Loss Assets)',
        desc: '१००% मुद्दल तरतूद आवश्यक असणारी प्रमाणित खाती',
      },
      {
        key: 'Standard',
        title: '६. नियमित कर्ज (Standard Assets)',
        desc: 'नियमित चालू खाती (मुद्दलावर मानक तरतूद)',
      },
    ],
    [concessionLabel]
  );

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (categoryFilter === 'ONLY_NPA' && item.category === 'Standard') return false;
      if (categoryFilter === 'Standard' && item.category !== 'Standard') return false;
      if (categoryFilter === 'Sub-Standard' && item.category !== 'Sub-Standard') return false;
      if (categoryFilter === 'Doubtful' && !item.category.startsWith('Doubtful')) return false;
      if (categoryFilter === 'Loss' && item.category !== 'Loss') return false;

      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        return (
          (item.name || '').toLowerCase().includes(term) ||
          (item.accountNo || '').toLowerCase().includes(term) ||
          (item.legacyAccountNumber || '').toLowerCase().includes(term) ||
          (item.memberCode || '').toLowerCase().includes(term) ||
          (item.loanType || '').toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [data, categoryFilter, searchTerm]);

  const groupedData = useMemo(() => {
    const groups: { [key: string]: NpaRegisterDto[] } = {};
    categoryOrder.forEach((cat) => {
      groups[cat.key] = [];
    });
    filteredData.forEach((item) => {
      const catKey = item.category || 'Standard';
      if (!groups[catKey]) groups[catKey] = [];
      groups[catKey].push(item);
    });
    return groups;
  }, [filteredData, categoryOrder]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, i) => {
        acc.sanctioned += Number(i.sanctionedAmount || 0);
        acc.principal += Number(i.principalBalance || 0);
        acc.interest += Number(i.receivableInterest || 0);
        acc.outstanding += Number(i.outstandingBalance || 0);
        acc.overdue += Number(i.overdueAmount || 0);
        acc.secured += Number(i.securedAmount || 0);
        acc.unsecured += Number(i.unsecuredAmount || 0);
        acc.oir += Number(i.oirAmount || 0);
        acc.bddr += Number(i.provisionAmount || 0);
        acc.totalProv += Number(i.totalProvisionWithOir || 0);
        return acc;
      },
      {
        sanctioned: 0,
        principal: 0,
        interest: 0,
        outstanding: 0,
        overdue: 0,
        secured: 0,
        unsecured: 0,
        oir: 0,
        bddr: 0,
        totalProv: 0,
      }
    );
  }, [filteredData]);

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;

    const rows: any[] = [];
    rows.push([sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित']);
    rows.push([
      `NPA तरतूद माहिती (NPA Provision Register) - दिनांक ${formatDisplayDate(asOfDate)} अखेर (मुद्दल बाकीवर BDDR + येणे व्याजावर १००% OIR)`,
    ]);
    rows.push([]);

    rows.push([
      'अ.क्र',
      'सभासद नं',
      'खाते नं',
      'जुना क्र.',
      'सभासदाचे नाव',
      'कर्ज प्रकार',
      'मंजूर रक्कम',
      'उचल दि.',
      'मुद्दल बाकी (BDDR पाया)',
      'येणे व्याज',
      'एकूण येणे',
      'थकबाकी दि.',
      'NPA दि.',
      'थकीत महिने',
      'तारण प्रकार',
      'तारणी मुद्दल',
      'विनातारणी मुद्दल',
      'वर्गवारी',
      'BDDR %',
      'BDDR तरतूद (मुद्दलावर)',
      '१००% OIR (व्याज तरतूद)',
      'एकूण तरतूद (BDDR + OIR)',
    ]);

    let srNo = 1;
    categoryOrder.forEach((catInfo) => {
      const items = groupedData[catInfo.key] || [];
      if (items.length === 0) return;

      rows.push([`--- ${catInfo.title} (${catInfo.desc}) ---`]);
      items.forEach((item) => {
        rows.push([
          srNo++,
          item.memberCode,
          item.accountNo,
          item.legacyAccountNumber || '-',
          item.name,
          item.loanType,
          Number(item.sanctionedAmount.toFixed(2)),
          formatDisplayDate(item.disbursementDate),
          Number(item.principalBalance.toFixed(2)),
          Number(item.receivableInterest.toFixed(2)),
          Number(item.outstandingBalance.toFixed(2)),
          formatDisplayDate(item.overdueDate),
          formatDisplayDate(item.npaDate),
          item.overdueMonths,
          item.securityType,
          Number(item.securedAmount.toFixed(2)),
          Number(item.unsecuredAmount.toFixed(2)),
          item.categoryMarathi || item.category,
          `${item.npaPercentage}%`,
          Number(item.provisionAmount.toFixed(2)),
          Number(item.oirAmount.toFixed(2)),
          Number(item.totalProvisionWithOir.toFixed(2)),
        ]);
      });

      rows.push([
        '',
        '',
        '',
        '',
        `उप-एकूण (${catInfo.key})`,
        '',
        Number(items.reduce((s, i) => s + i.sanctionedAmount, 0).toFixed(2)),
        '',
        Number(items.reduce((s, i) => s + i.principalBalance, 0).toFixed(2)),
        Number(items.reduce((s, i) => s + i.receivableInterest, 0).toFixed(2)),
        Number(items.reduce((s, i) => s + i.outstandingBalance, 0).toFixed(2)),
        '',
        '',
        '',
        '',
        Number(items.reduce((s, i) => s + i.securedAmount, 0).toFixed(2)),
        Number(items.reduce((s, i) => s + i.unsecuredAmount, 0).toFixed(2)),
        '',
        '',
        Number(items.reduce((s, i) => s + i.provisionAmount, 0).toFixed(2)),
        Number(items.reduce((s, i) => s + i.oirAmount, 0).toFixed(2)),
        Number(items.reduce((s, i) => s + i.totalProvisionWithOir, 0).toFixed(2)),
      ]);
      rows.push([]);
    });

    rows.push([
      'एकूण',
      '',
      '',
      '',
      'सर्व खात्यांची एकूण (Grand Total)',
      '',
      Number(totals.sanctioned.toFixed(2)),
      '',
      Number(totals.principal.toFixed(2)),
      Number(totals.interest.toFixed(2)),
      Number(totals.outstanding.toFixed(2)),
      '',
      '',
      '',
      '',
      Number(totals.secured.toFixed(2)),
      Number(totals.unsecured.toFixed(2)),
      '',
      '',
      Number(totals.bddr.toFixed(2)),
      Number(totals.oir.toFixed(2)),
      Number(totals.totalProv.toFixed(2)),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NPA_Provision_Register');
    XLSX.writeFile(wb, `NPA_Provision_Register_${asOfDate}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-3 bg-slate-50/70 min-h-[calc(100vh-3.15rem)] font-sans text-slate-800 space-y-2.5">
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
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          }
        `}
      </style>

      {/* Compact ERP Header & Filter Control Card */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary no-print space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('npa-dashboard')}
                className="h-6 px-2 rounded-sm border border-slate-300 bg-white hover:bg-primary/10 hover:text-primary hover:border-primary text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft size={12} />
                <span>मागे</span>
              </button>
            )}
            <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <AlertOctagon size={14} className="stroke-[2.4]" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-extrabold text-primary tracking-tight flex items-center gap-1.5">
                <span>NPA तरतूद माहिती (NPA Provision Register)</span>
                <span className="hidden lg:inline-block px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                  सवलत: {concessionLabel}
                </span>
              </h1>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-bold text-slate-600 whitespace-nowrap">शाखा:</label>
              <select
                value={selectedBranchId}
                disabled={!isHOUser}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="h-6 border border-slate-300 rounded-sm px-1.5 text-[11px] font-bold bg-white text-slate-900 focus:outline-none focus:border-primary w-32 disabled:bg-slate-100 disabled:text-slate-600"
              >
                {isHOUser && <option value="all">सर्व शाखा (All)</option>}
                {(isHOUser || !lockedBranchId
                  ? branches
                  : branches.filter((b: any) => Number(b.branchID) === Number(lockedBranchId))
                ).map((b: any) => (
                  <option key={b.branchID} value={b.branchID.toString()}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[11px] font-bold text-slate-600 whitespace-nowrap">वर्गवारी:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-6 border border-slate-300 rounded-sm px-1.5 text-[11px] font-bold bg-white text-primary focus:outline-none focus:border-primary w-40 sm:w-44"
              >
                <option value="ONLY_NPA">फक्त NPA खाती (NPA Only)</option>
                <option value="ALL">सर्व खाती (All Accounts)</option>
                <option value="Sub-Standard">१. सब-स्टँडर्ड (Sub-Standard)</option>
                <option value="Doubtful">२. संशयित (Doubtful D1/D2/D3)</option>
                <option value="Loss">३. बुडीत / तोटा (Loss Assets)</option>
                <option value="Standard">४. नियमित (Standard Assets)</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[11px] font-bold text-slate-600 whitespace-nowrap">दिनांक:</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="h-6 border border-slate-300 rounded-sm px-1.5 text-[11px] font-mono font-bold bg-white text-slate-900 focus:outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={() => fetchData(asOfDate, selectedBranchId)}
              disabled={loading || recalculating}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-extrabold shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
              <span>पहा</span>
            </button>

            <button
              onClick={handleRecalculateNpa}
              disabled={loading || recalculating}
              className="h-6 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-2.5 rounded-sm text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="निवडलेल्या तारखेसाठी NPA वर्गीकरण व तरतूद नव्याने मोजा"
            >
              <Calculator size={11} />
              <span>{recalculating ? 'मोजणी चालू...' : 'NPA मोजणी'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={filteredData.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer ${
                filteredData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={filteredData.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer ${
                filteredData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Printer size={12} />
              <span>प्रिंट</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search + Live Summary Chips */}
        <div className="pt-1.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="relative w-64 max-w-full">
            <Search size={12} className="absolute left-2 top-1.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="नाव / खाते क्र. / जुना क्र. / सभासद क्र. शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-6 h-6 border border-slate-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-white text-slate-900"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="bg-slate-100 px-2 py-0.5 rounded-sm text-slate-800 border border-slate-300 font-semibold">
              खाती: <strong className="text-primary">{filteredData.length}</strong>
            </span>
            <span className="bg-slate-100 px-2 py-0.5 rounded-sm text-slate-800 border border-slate-300 font-semibold font-mono">
              मुद्दल बाकी: <strong className="text-slate-950">₹{fmtCurrency(totals.principal)}</strong>
            </span>
            <span className="bg-amber-50 px-2 py-0.5 rounded-sm text-amber-900 border border-amber-300 font-semibold font-mono">
              १००% OIR (व्याज तरतूद): <strong>₹{fmtCurrency(totals.oir)}</strong>
            </span>
            <span className="bg-primary/10 px-2 py-0.5 rounded-sm text-primary border border-primary/20 font-extrabold font-mono">
              BDDR मुद्दल तरतूद: ₹{fmtCurrency(totals.bddr)}
            </span>
            <span className="bg-rose-50 px-2 py-0.5 rounded-sm text-rose-900 border border-rose-300 font-extrabold font-mono">
              एकूण तरतूद (BDDR + OIR): ₹{fmtCurrency(totals.totalProv)}
            </span>
          </div>
        </div>
      </div>

      {/* Printable Official Register */}
      <div
        ref={reportRef}
        className="print-area bg-white mx-auto max-w-full p-4 md:p-5 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary flex flex-col justify-between"
      >
        <div>
          <div className="border border-slate-900 p-2.5 text-center">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-900 border-b border-slate-300 pb-1 mb-1.5">
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
                <span className="font-mono">
                  {sansthaDetail?.registrationDate ? formatDisplayDate(sansthaDetail.registrationDate) : '-'}
                </span>
              </div>
            </div>

            <h1 className="text-base sm:text-lg font-extrabold text-slate-950 tracking-tight leading-snug font-serif uppercase">
              {sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
            </h1>

            <p className="text-xs font-bold text-slate-800 mt-0.5">
              {sansthaDetail?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}
              {sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}
              {sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
            </p>
          </div>

          <div className="mt-2.5 mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-bold text-slate-600">
              धोरण: <strong className="text-slate-900">मुद्दल बाकीवर BDDR स्लॅब + येणे व्याजावर स्वतंत्र १००% OIR</strong>
            </div>

            <div className="mx-auto inline-block border border-slate-500 bg-slate-50 px-6 py-0.5 rounded-xs">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-950 tracking-wider uppercase font-serif text-center">
                NPA तरतूद माहिती (NPA Provision Register)
              </h2>
            </div>

            <div className="text-right text-xs font-bold text-slate-900">
              <span>दिनांक : </span>
              <span className="font-mono">{formatDisplayDate(asOfDate)} अखेर</span>
            </div>
          </div>

          <div className="overflow-x-auto mt-1.5 custom-scrollbar">
            <table className="w-full text-center border-collapse border border-slate-900 text-[10px] leading-tight whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 font-bold">
                  <th className="border border-slate-900 py-1 px-1">अ.क्र</th>
                  <th className="border border-slate-900 py-1 px-1">सभासद नं</th>
                  <th className="border border-slate-900 py-1 px-1">खाते नं</th>
                  <th className="border border-slate-900 py-1 px-1">जुना क्र.</th>
                  <th className="border border-slate-900 py-1 px-1.5 text-left min-w-[135px]">सभासदाचे नाव</th>
                  <th className="border border-slate-900 py-1 px-1 text-left">कर्ज प्रकार</th>
                  <th className="border border-slate-900 py-1 px-1 text-right">मंजूर रक्कम</th>
                  <th className="border border-slate-900 py-1 px-1">उचल दि.</th>
                  <th className="border border-slate-900 py-1 px-1 text-right bg-slate-200/70">मुद्दल बाकी</th>
                  <th className="border border-slate-900 py-1 px-1 text-right">येणे व्याज</th>
                  <th className="border border-slate-900 py-1 px-1.5 text-right bg-slate-200">एकूण येणे</th>
                  <th className="border border-slate-900 py-1 px-1">थकबाकी दि.</th>
                  <th className="border border-slate-900 py-1 px-1">NPA दि.</th>
                  <th className="border border-slate-900 py-1 px-1">महिने</th>
                  <th className="border border-slate-900 py-1 px-1 text-left">तारण प्रकार</th>
                  <th className="border border-slate-900 py-1 px-1 text-right">तारणी मुद्दल</th>
                  <th className="border border-slate-900 py-1 px-1 text-right">विनातारणी मुद्दल</th>
                  <th className="border border-slate-900 py-1 px-1">BDDR %</th>
                  <th className="border border-slate-900 py-1 px-1.5 text-right bg-primary/10 text-primary font-extrabold">
                    BDDR तरतूद
                  </th>
                  <th className="border border-slate-900 py-1 px-1.5 text-right bg-amber-50 text-amber-900 font-extrabold">
                    १००% OIR
                  </th>
                  <th className="border border-slate-900 py-1 px-1.5 text-right bg-rose-50 text-rose-950 font-extrabold">
                    एकूण तरतूद
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={21} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                      माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                      निवडलेल्या निकषांनुसार कोणतीही नोंद आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  categoryOrder.map((catInfo) => {
                    const items = groupedData[catInfo.key] || [];
                    if (items.length === 0) return null;

                    const subSanctioned = items.reduce((s, i) => s + i.sanctionedAmount, 0);
                    const subPrincipal = items.reduce((s, i) => s + i.principalBalance, 0);
                    const subInterest = items.reduce((s, i) => s + i.receivableInterest, 0);
                    const subOutstanding = items.reduce((s, i) => s + i.outstandingBalance, 0);
                    const subSecured = items.reduce((s, i) => s + i.securedAmount, 0);
                    const subUnsecured = items.reduce((s, i) => s + i.unsecuredAmount, 0);
                    const subBddr = items.reduce((s, i) => s + i.provisionAmount, 0);
                    const subOir = items.reduce((s, i) => s + i.oirAmount, 0);
                    const subTotalProv = items.reduce((s, i) => s + i.totalProvisionWithOir, 0);

                    return (
                      <React.Fragment key={catInfo.key}>
                        <tr className="bg-primary/5 font-bold border-t border-b border-slate-900">
                          <td colSpan={21} className="py-1 px-2 text-left text-primary font-extrabold">
                            › {catInfo.title} — <span className="font-semibold text-slate-700">{catInfo.desc}</span> ({items.length} खाती)
                          </td>
                        </tr>

                        {items.map((item, idx) => (
                          <tr key={item.loanAccountID || idx} className="hover:bg-primary/10 text-slate-900 h-6">
                            <td className="border border-slate-900 py-0.5 px-1 font-mono">{idx + 1}</td>
                            <td className="border border-slate-900 py-0.5 px-1 font-mono">{item.memberCode}</td>
                            <td className="border border-slate-900 py-0.5 px-1 font-mono font-bold text-primary">{item.accountNo}</td>
                            <td className="border border-slate-900 py-0.5 px-1 font-mono text-slate-600">
                              {item.legacyAccountNumber || '-'}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1.5 text-left font-semibold max-w-[180px] truncate" title={item.name}>
                              {item.name}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1 text-left text-slate-700 max-w-[115px] truncate" title={item.loanType}>
                              {item.loanType}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1 text-right font-mono">{fmtCurrency(item.sanctionedAmount)}</td>
                            <td className="border border-slate-900 py-0.5 px-1 font-mono">{formatDisplayDate(item.disbursementDate)}</td>
                            <td className="border border-slate-900 py-0.5 px-1 text-right font-mono font-bold bg-slate-50">
                              {fmtCurrency(item.principalBalance)}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1 text-right font-mono text-amber-800">
                              {fmtCurrency(item.receivableInterest)}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-bold bg-slate-100">
                              {fmtCurrency(item.outstandingBalance)}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1 font-mono">{formatDisplayDate(item.overdueDate)}</td>
                            <td className="border border-slate-900 py-0.5 px-1 font-mono text-rose-800 font-semibold">
                              {formatDisplayDate(item.npaDate)}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1 font-mono font-bold">{item.overdueMonths}</td>
                            <td className="border border-slate-900 py-0.5 px-1 text-left max-w-[100px] truncate" title={item.securityType}>
                              {item.securityType}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1 text-right font-mono">{fmtCurrency(item.securedAmount)}</td>
                            <td className="border border-slate-900 py-0.5 px-1 text-right font-mono text-rose-700">
                              {fmtCurrency(item.unsecuredAmount)}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1 font-mono font-bold text-primary">
                              {item.npaPercentage}%
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-bold text-primary bg-primary/5">
                              {fmtCurrency(item.provisionAmount)}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-bold text-amber-900 bg-amber-50/60">
                              {fmtCurrency(item.oirAmount)}
                            </td>
                            <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-extrabold text-rose-950 bg-rose-50/60">
                              {fmtCurrency(item.totalProvisionWithOir)}
                            </td>
                          </tr>
                        ))}

                        <tr className="bg-slate-100 font-bold border-t border-b border-slate-900">
                          <td colSpan={6} className="border border-slate-900 py-1 px-2 text-right italic">
                            उप-एकूण ({catInfo.key}):
                          </td>
                          <td className="border border-slate-900 py-1 px-1 text-right font-mono">{fmtCurrency(subSanctioned)}</td>
                          <td className="border border-slate-900"></td>
                          <td className="border border-slate-900 py-1 px-1 text-right font-mono">{fmtCurrency(subPrincipal)}</td>
                          <td className="border border-slate-900 py-1 px-1 text-right font-mono text-amber-800">{fmtCurrency(subInterest)}</td>
                          <td className="border border-slate-900 py-1 px-1.5 text-right font-mono bg-slate-200/70">{fmtCurrency(subOutstanding)}</td>
                          <td colSpan={4} className="border border-slate-900"></td>
                          <td className="border border-slate-900 py-1 px-1 text-right font-mono">{fmtCurrency(subSecured)}</td>
                          <td className="border border-slate-900 py-1 px-1 text-right font-mono text-rose-700">{fmtCurrency(subUnsecured)}</td>
                          <td className="border border-slate-900"></td>
                          <td className="border border-slate-900 py-1 px-1.5 text-right font-mono text-primary bg-primary/10">
                            {fmtCurrency(subBddr)}
                          </td>
                          <td className="border border-slate-900 py-1 px-1.5 text-right font-mono text-amber-900 bg-amber-50">
                            {fmtCurrency(subOir)}
                          </td>
                          <td className="border border-slate-900 py-1 px-1.5 text-right font-mono text-rose-950 bg-rose-50">
                            {fmtCurrency(subTotalProv)}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {filteredData.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-200 font-extrabold text-slate-950 border-t-2 border-slate-900 text-[10.5px]">
                    <td colSpan={6} className="border border-slate-900 py-1.5 px-2 text-right uppercase">
                      एकूण बेरीज (Grand Total — {filteredData.length} खाती):
                    </td>
                    <td className="border border-slate-900 py-1.5 px-1 text-right font-mono">₹{fmtCurrency(totals.sanctioned)}</td>
                    <td className="border border-slate-900"></td>
                    <td className="border border-slate-900 py-1.5 px-1 text-right font-mono">₹{fmtCurrency(totals.principal)}</td>
                    <td className="border border-slate-900 py-1.5 px-1 text-right font-mono text-amber-900">₹{fmtCurrency(totals.interest)}</td>
                    <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono bg-slate-300/60">₹{fmtCurrency(totals.outstanding)}</td>
                    <td colSpan={4} className="border border-slate-900"></td>
                    <td className="border border-slate-900 py-1.5 px-1 text-right font-mono">₹{fmtCurrency(totals.secured)}</td>
                    <td className="border border-slate-900 py-1.5 px-1 text-right font-mono text-rose-800">₹{fmtCurrency(totals.unsecured)}</td>
                    <td className="border border-slate-900"></td>
                    <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono text-primary bg-primary/15">
                      ₹{fmtCurrency(totals.bddr)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono text-amber-950 bg-amber-100">
                      ₹{fmtCurrency(totals.oir)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono text-rose-950 bg-rose-100">
                      ₹{fmtCurrency(totals.totalProv)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="mt-12 pt-4 border-t border-dashed border-slate-400 grid grid-cols-3 text-center text-xs font-bold text-slate-900">
          <div>
            <div className="h-9"></div>
            <p className="border-t border-slate-800 mx-4 pt-1">लिपिक / सहाय्यक</p>
            <span className="text-[10px] text-slate-500 font-normal">(Clerk / Assistant)</span>
          </div>
          <div>
            <div className="h-9"></div>
            <p className="border-t border-slate-800 mx-4 pt-1">वैधानिक लेखापरीक्षक / तपासनीस</p>
            <span className="text-[10px] text-slate-500 font-normal">(Statutory Auditor / Inspector)</span>
          </div>
          <div>
            <div className="h-9"></div>
            <p className="border-t border-slate-800 mx-4 pt-1">शाखा व्यवस्थापक / मानद सचिव</p>
            <span className="text-[10px] text-slate-500 font-normal">(Manager / Secretary)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
