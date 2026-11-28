import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Printer, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';

interface NpaStatementReportProps {
  onBack?: () => void;
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

const resolveLoanBorrowerName = (l: any): string => {
  const cust = l?.customer || l?.member?.customer;
  if (cust) {
    const full = `${cust.firstName || ''} ${cust.middleName || ''} ${cust.lastName || ''}`.replace(/\s+/g, ' ').trim();
    if (full) return full;
  }
  return l?.borrowerName || l?.memberName || '';
};

const fmtLakh = (val: any): string =>
  Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const NpaStatementReport: React.FC<NpaStatementReportProps> = ({ onBack }) => {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const API_URL = '/api/Npa';

  const [statement, setStatement] = useState<any>(null);
  const [breakup, setBreakup] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => getBusinessDateStr(user?.businessDate));
  const [loading, setLoading] = useState(true);
  const [auditRemarks, setAuditRemarks] = useState('');
  const [selectedLoanForLoss, setSelectedLoanForLoss] = useState<number | null>(null);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [udin, setUdin] = useState<string>('');
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const initialBranchId = effectiveBranch === null ? 'all' : String(effectiveBranch);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  useEffect(() => {
    if (user?.businessDate) {
      setSelectedDate(getBusinessDateStr(user.businessDate));
    }
  }, [user?.businessDate]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async (date: string, bId?: string) => {
    try {
      setLoading(true);
      const activeBranch = bId !== undefined ? bId : selectedBranchId;
      const branchQuery = activeBranch && activeBranch !== 'all' ? `&branchId=${activeBranch}` : '';

      const [stmtRes, breakupRes, loansRes, sansthaRes] = await Promise.all([
        axios.get(`${API_URL}/statement?asOfDate=${date}${branchQuery}`),
        axios.get(`${API_URL}/breakup?asOfDate=${date}${branchQuery}`),
        axios.get(activeBranch && activeBranch !== 'all' ? `/api/LoanAccounts?branchId=${activeBranch}` : '/api/LoanAccounts'),
        axios.get('/api/SansthaDetails'),
      ]);
      setStatement(stmtRes.data);
      setBreakup(breakupRes.data || []);
      setActiveLoans((loansRes.data || []).filter((l: any) => l.status === 'Active'));
      if (sansthaRes.data && Array.isArray(sansthaRes.data) && sansthaRes.data.length > 0) {
        setSansthaDetail(sansthaRes.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchData(selectedDate, selectedBranchId);
  }, [selectedDate, selectedBranchId]);

  const getBranchName = () => {
    if (!selectedBranchId || selectedBranchId === 'all') return 'सर्व शाखा (All Branches)';
    const b = branches.find((item: any) => item.branchID.toString() === selectedBranchId.toString());
    return b ? b.branchName : 'मुख्य शाखा';
  };

  const handleCertifyLoss = async () => {
    if (!selectedLoanForLoss || !auditRemarks.trim()) {
      alert('कृपया कर्ज खाते निवडा आणि शेरा प्रविष्ट करा.');
      return;
    }
    try {
      await axios.post(`${API_URL}/certify-loss`, {
        loanAccountID: selectedLoanForLoss,
        remarks: auditRemarks,
        asOfDate: selectedDate,
      });
      alert('तोटा मालमत्ता यशस्वीरित्या प्रमाणित केली! (Certified Loss Asset successfully!)');
      setAuditRemarks('');
      setSelectedLoanForLoss(null);
      fetchData(selectedDate, selectedBranchId);
    } catch (err) {
      console.error(err);
      alert('प्रमाणित करताना त्रुटी आली.');
    }
  };

  if (loading && !statement) {
    return (
      <div className="flex items-center justify-center p-10 bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isGrossNpaViolated = statement ? statement.grossNpaPercent > 10 : false;
  const isNetNpaViolated = statement ? statement.netNpaPercent > 5 : false;

  const sumBy = (fn: (b: any) => number) => breakup.reduce((acc, item) => acc + Number(fn(item) || 0), 0);

  return (
    <div className="p-2 sm:p-3 bg-slate-50/70 min-h-[calc(100vh-3.15rem)] font-sans text-slate-800 space-y-2.5">
      {/* Compact ERP Header & Filter Bar */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="h-6 px-2 rounded-sm border border-slate-300 bg-white hover:bg-primary/10 hover:text-primary hover:border-primary text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft size={12} />
              <span>मागे</span>
            </button>
          )}
          <h1 className="text-xs sm:text-sm font-extrabold text-primary tracking-tight">
            एन.पी.ए. वर्गीकरण व प्रोव्हिजनिंग पत्रक (Statutory NPA Statement)
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-bold text-slate-600">शाखा:</label>
            <select
              value={selectedBranchId}
              disabled={!isHOUser}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-6 border border-slate-300 rounded-sm px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary w-32 disabled:bg-slate-100"
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
            <label className="text-[11px] font-bold text-slate-600">दिनांक:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-6 border border-slate-300 rounded-sm px-1.5 text-[11px] font-mono font-bold bg-white focus:outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={() => fetchData(selectedDate, selectedBranchId)}
            disabled={loading}
            className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-extrabold cursor-pointer disabled:opacity-50"
          >
            {loading ? '...' : 'पहा'}
          </button>

          <button
            onClick={() => window.print()}
            className="h-6 bg-slate-800 hover:bg-slate-900 text-white px-2.5 rounded-sm text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Printer size={12} />
            <span>प्रिंट (A4)</span>
          </button>
        </div>
      </div>

      {/* Compact Auditor Loss Asset Certification Strip (Hidden on Print) */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-slate-300 print:hidden no-print">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary mr-2 pb-1">
            <ShieldAlert size={14} className="text-rose-600" />
            <span>लेखापरीक्षक तोटा मालमत्ता प्रमाणीकरण (Loss Asset Certification):</span>
          </div>

          <div className="flex-1 min-w-[220px]">
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">कर्ज खाते निवडा</label>
            <select
              value={selectedLoanForLoss || ''}
              onChange={(e) => setSelectedLoanForLoss(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-7 border border-slate-300 rounded-sm px-2 text-xs bg-white focus:outline-none focus:border-primary"
            >
              <option value="">-- कर्ज खाते निवडा --</option>
              {activeLoans.map((l: any) => {
                const bName = resolveLoanBorrowerName(l);
                return (
                  <option key={l.loanAccountID} value={l.loanAccountID}>
                    {l.loanAccountNo} {bName ? `- ${bName}` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">लेखापरीक्षक शेरा / कारण</label>
            <input
              type="text"
              value={auditRemarks}
              onChange={(e) => setAuditRemarks(e.target.value)}
              placeholder="तोटा ठरवण्याचे कारण लिहा..."
              className="w-full h-7 border border-slate-300 rounded-sm px-2 text-xs bg-white focus:outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={handleCertifyLoss}
            className="h-7 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-sm text-xs font-bold cursor-pointer shrink-0"
          >
            🚫 तोटा मालमत्ता घोषित करा
          </button>
        </div>
      </div>

      {/* Print Document */}
      <div className="bg-white p-5 md:p-7 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary print:border-none print:shadow-none print:p-0 text-slate-900 max-w-5xl mx-auto">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
          }
        `}</style>

        <div className="border border-slate-900 p-3 text-center mb-3">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2">
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
                {sansthaDetail?.registrationDate
                  ? new Date(sansthaDetail.registrationDate).toLocaleDateString('en-GB')
                  : '-'}
              </span>
            </div>
          </div>

          <h1 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight font-serif uppercase">
            {sansthaDetail?.sansthaName || statement?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
          </h1>

          <p className="text-xs font-bold text-slate-800 mt-1">
            {sansthaDetail?.address || statement?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}
            {sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}
            {sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
          </p>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <div className="w-28 hidden sm:block"></div>
          <div className="mx-auto inline-block border border-slate-500 bg-slate-50 px-6 py-1 rounded-xs text-center">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-950 tracking-wider uppercase font-serif">
              एन.पी.ए. (थकीत येणे) वर्गीकरण आणि प्रोव्हिजनिंग पत्रक
            </h2>
          </div>
          <div className="text-right text-xs font-bold text-slate-900">
            <span>दिनांक : </span>
            <span className="font-mono">
              {statement?.asOfDate ? new Date(statement.asOfDate).toLocaleDateString('en-GB') : selectedDate} अखेर
            </span>
          </div>
        </div>

        {/* Part 1 */}
        <div className="mt-4 space-y-2">
          <h3 className="text-xs font-extrabold text-primary border-l-4 border-l-primary pl-2 uppercase">
            भाग १: मुख्य एन.पी.ए. पत्रक (Part 1: Main NPA Statement)
          </h3>
          <table className="w-full border-collapse border border-slate-500 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-500 font-bold">
                <th className="border border-slate-500 py-1.5 px-2 text-center w-12">अनु.</th>
                <th className="border border-slate-500 py-1.5 px-2.5 text-left">तपशील (Details)</th>
                <th className="border border-slate-500 py-1.5 px-2.5 text-right w-52">रक्कम (₹ लाखात)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-500 py-1.5 px-2 text-center font-semibold">१</td>
                <td className="border border-slate-500 py-1.5 px-2.5 font-medium">
                  एकूण कर्ज वाटप बाकी — मुद्दल + येणे व्याज (Gross Advances)
                </td>
                <td className="border border-slate-500 py-1.5 px-2.5 text-right font-mono font-black">
                  ₹ {fmtLakh(statement?.grossAdvances)}
                </td>
              </tr>
              <tr className={isGrossNpaViolated ? 'bg-rose-50/50 print:bg-transparent' : ''}>
                <td className="border border-slate-500 py-1.5 px-2 text-center font-semibold">२</td>
                <td className="border border-slate-500 py-1.5 px-2.5 font-medium align-middle">
                  <div className="flex justify-between items-center gap-2">
                    <span>एकूण एन.पी.ए. खाते बाकी (Gross NPA — मुद्दल: ₹{fmtLakh(statement?.npaPrincipal)} लाख)</span>
                    {isGrossNpaViolated && (
                      <span className="text-[10px] text-rose-600 font-black no-print whitespace-nowrap">(१०% मर्यादा ओलांडली!)</span>
                    )}
                  </div>
                </td>
                <td className={`border border-slate-500 py-1.5 px-2.5 text-right font-mono font-black ${isGrossNpaViolated ? 'text-rose-700' : ''}`}>
                  ₹ {fmtLakh(statement?.grossNpa)}
                </td>
              </tr>
              <tr className={isGrossNpaViolated ? 'bg-rose-50/50 print:bg-transparent' : ''}>
                <td className="border border-slate-500 py-1.5 px-2 text-center font-semibold">३</td>
                <td className="border border-slate-500 py-1.5 px-2.5 font-medium">
                  एकूण एन.पी.ए. प्रमाण % (Gross NPA %) <span className="text-[10px] text-slate-500">(२ ÷ १ × १००)</span>
                </td>
                <td className={`border border-slate-500 py-1.5 px-2.5 text-right font-mono font-black ${isGrossNpaViolated ? 'text-rose-700' : ''}`}>
                  {statement?.grossNpaPercent ?? 0}%
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-500 py-1.5 px-2 text-center font-semibold">४</td>
                <td className="border border-slate-500 py-1.5 px-2.5 font-bold" colSpan={2}>
                  वजावटी (Statutory Deductions):
                </td>
              </tr>
              <tr>
                <td className="border border-slate-500 py-1.5 px-2"></td>
                <td className="border border-slate-500 py-1.5 px-2.5 pl-6 text-slate-700 font-medium">
                  (अ) १००% थकीत व्याज तरतूद — OIR (NPA खात्यांवरील संपूर्ण येणे व्याज)
                </td>
                <td className="border border-slate-500 py-1.5 px-2.5 text-right font-mono font-bold text-amber-800">
                  ₹ {fmtLakh(statement?.overdueInterestReserve)}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-500 py-1.5 px-2"></td>
                <td className="border border-slate-500 py-1.5 px-2.5 pl-6 text-slate-700 font-medium">
                  (ब) एकरकमी परतफेड / वसुली ठेव योजना अनामत (Recovery Deposits)
                </td>
                <td className="border border-slate-500 py-1.5 px-2.5 text-right font-mono font-bold text-slate-700">
                  ₹ {fmtLakh(statement?.recoveryDeposits)}
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-500 py-1.5 px-2"></td>
                <td className="border border-slate-500 py-1.5 px-2.5 pl-6 font-bold text-slate-900">
                  एकूण वजावटी (Total Deductions) <span className="text-[10px] text-slate-500">(४अ + ४ब)</span>
                </td>
                <td className="border border-slate-500 py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                  ₹ {fmtLakh(statement?.totalDeductions)}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-500 py-1.5 px-2 text-center font-semibold">५</td>
                <td className="border border-slate-500 py-1.5 px-2.5 font-medium">
                  <div>आवश्यक बुडीत व संशयित कर्ज तरतूद — मुद्दल बाकीवर (Required NPA BDDR Provision)</div>
                  <div className="text-[10px] text-slate-500">
                    प्रत्यक्ष केलेली BDDR तरतूद (Held): ₹{fmtLakh(statement?.provisionHeld)} लाख | नियमित कर्ज मानक तरतूद: ₹
                    {fmtLakh(statement?.standardProvisionRequired)} लाख
                    {Number(statement?.provisionShortfall || 0) > 0 && (
                      <span className="text-rose-700 font-bold ml-1">
                        | अतिरिक्त आवश्यक तरतूद (Shortfall): ₹{fmtLakh(statement?.provisionShortfall)} लाख
                      </span>
                    )}
                  </div>
                </td>
                <td className="border border-slate-500 py-1.5 px-2.5 text-right font-mono font-black text-primary">
                  ₹ {fmtLakh(statement?.totalProvision)}
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-500 py-1.5 px-2 text-center font-semibold">६</td>
                <td className="border border-slate-500 py-1.5 px-2.5 font-bold">
                  निव्वळ कर्ज बाकी (Net Advances) <span className="text-[10px] text-slate-500">(१ − ४ − ५)</span>
                </td>
                <td className="border border-slate-500 py-1.5 px-2.5 text-right font-mono font-black">
                  ₹ {fmtLakh(statement?.netAdvances)}
                </td>
              </tr>
              <tr className={isNetNpaViolated ? 'bg-rose-50/50 print:bg-transparent' : 'bg-slate-50'}>
                <td className="border border-slate-500 py-1.5 px-2 text-center font-semibold">७</td>
                <td className="border border-slate-500 py-1.5 px-2.5 font-bold align-middle">
                  <div className="flex justify-between items-center gap-2">
                    <span>
                      निव्वळ एन.पी.ए. (Net NPA) <span className="text-[10px] text-slate-500">(२ − ४ − ५)</span>
                    </span>
                    {isNetNpaViolated && (
                      <span className="text-[10px] text-rose-600 font-black no-print whitespace-nowrap">(५% मर्यादा ओलांडली!)</span>
                    )}
                  </div>
                </td>
                <td className={`border border-slate-500 py-1.5 px-2.5 text-right font-mono font-black ${isNetNpaViolated ? 'text-rose-700' : ''}`}>
                  ₹ {fmtLakh(statement?.netNpa)}
                </td>
              </tr>
              <tr className={isNetNpaViolated ? 'bg-rose-50/50 print:bg-transparent' : 'bg-slate-100'}>
                <td className="border border-slate-500 py-1.5 px-2 text-center font-semibold">८</td>
                <td className="border border-slate-500 py-1.5 px-2.5 font-bold">
                  निव्वळ एन.पी.ए. % (Net NPA %) <span className="text-[10px] text-slate-500">(७ ÷ ६ × १००)</span>
                </td>
                <td className={`border border-slate-500 py-1.5 px-2.5 text-right font-mono font-black ${isNetNpaViolated ? 'text-rose-700' : ''}`}>
                  {statement?.netNpaPercent ?? 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Part 2 */}
        <div className="mt-6 space-y-2 page-break-before">
          <h3 className="text-xs font-extrabold text-primary border-l-4 border-l-primary pl-2 uppercase">
            भाग २: कर्ज वर्गीकरण व तरतुदीची वर्गवारी — रक्कम ₹ लाखात (Part 2: Category Breakup)
          </h3>
          <table className="w-full border-collapse border border-slate-500 text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-500 font-bold text-center">
                <th className="border border-slate-500 py-1.5 px-1.5">अनु.</th>
                <th className="border border-slate-500 py-1.5 px-2 text-left">वर्गीकरण श्रेणी</th>
                <th className="border border-slate-500 py-1.5 px-1.5">खाती</th>
                <th className="border border-slate-500 py-1.5 px-1.5 text-right">एकूण येणे</th>
                <th className="border border-slate-500 py-1.5 px-1.5 text-right">मुद्दल बाकी</th>
                <th className="border border-slate-500 py-1.5 px-1.5 text-right">१००% OIR (व्याज)</th>
                <th className="border border-slate-500 py-1.5 px-1.5 text-right">तारणी मुद्दल</th>
                <th className="border border-slate-500 py-1.5 px-1.5 text-right">विनातारणी मुद्दल</th>
                <th className="border border-slate-500 py-1.5 px-1.5 text-right">आवश्यक BDDR</th>
                <th className="border border-slate-500 py-1.5 px-1.5 text-right">केलेली तरतूद</th>
              </tr>
            </thead>
            <tbody>
              {breakup.map((b, i) => (
                <tr key={i} className="text-center font-medium">
                  <td className="border border-slate-500 py-1 px-1.5">{i + 1}</td>
                  <td className="border border-slate-500 py-1 px-2 text-left font-semibold">{b.categoryMarathi}</td>
                  <td className="border border-slate-500 py-1 px-1.5 font-mono">{b.accountCount}</td>
                  <td className="border border-slate-500 py-1 px-1.5 text-right font-mono font-bold">₹ {fmtLakh(b.grossOutstanding)}</td>
                  <td className="border border-slate-500 py-1 px-1.5 text-right font-mono">₹ {fmtLakh(b.principalOutstanding)}</td>
                  <td className="border border-slate-500 py-1 px-1.5 text-right font-mono text-amber-800">
                    ₹ {fmtLakh(b.overdueInterestReserve)}
                  </td>
                  <td className="border border-slate-500 py-1 px-1.5 text-right font-mono">₹ {fmtLakh(b.securedOutstanding)}</td>
                  <td className="border border-slate-500 py-1 px-1.5 text-right font-mono">₹ {fmtLakh(b.unsecuredOutstanding)}</td>
                  <td className="border border-slate-500 py-1 px-1.5 text-right font-mono font-bold text-primary">
                    ₹ {fmtLakh(b.provisionRequired)}
                  </td>
                  <td className="border border-slate-500 py-1 px-1.5 text-right font-mono text-emerald-700">
                    ₹ {fmtLakh(b.provisionHeld)}
                  </td>
                </tr>
              ))}
              <tr className="font-extrabold bg-slate-100 text-center">
                <td className="border border-slate-500 py-1.5 px-2" colSpan={2}>
                  एकूण (Total)
                </td>
                <td className="border border-slate-500 py-1.5 px-1.5 font-mono">{sumBy((b) => b.accountCount)}</td>
                <td className="border border-slate-500 py-1.5 px-1.5 text-right font-mono">₹ {fmtLakh(sumBy((b) => b.grossOutstanding))}</td>
                <td className="border border-slate-500 py-1.5 px-1.5 text-right font-mono">₹ {fmtLakh(sumBy((b) => b.principalOutstanding))}</td>
                <td className="border border-slate-500 py-1.5 px-1.5 text-right font-mono text-amber-900">
                  ₹ {fmtLakh(sumBy((b) => b.overdueInterestReserve))}
                </td>
                <td className="border border-slate-500 py-1.5 px-1.5 text-right font-mono">₹ {fmtLakh(sumBy((b) => b.securedOutstanding))}</td>
                <td className="border border-slate-500 py-1.5 px-1.5 text-right font-mono">₹ {fmtLakh(sumBy((b) => b.unsecuredOutstanding))}</td>
                <td className="border border-slate-500 py-1.5 px-1.5 text-right font-mono text-primary">
                  ₹ {fmtLakh(sumBy((b) => b.provisionRequired))}
                </td>
                <td className="border border-slate-500 py-1.5 px-1.5 text-right font-mono text-emerald-800">
                  ₹ {fmtLakh(sumBy((b) => b.provisionHeld))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-5 p-2.5 bg-primary/5 rounded-sm border border-primary/20 text-[10.5px] text-slate-800 font-medium">
          ℹ️ <strong>वैधानिक नियम स्मरणपत्र:</strong> सहकार नियमांनुसार ३१ मार्च अखेरचे एन.पी.ए. ऑडिट पूर्ण झाल्यावर निबंधक कार्यालयास अहवाल सादर करण्याची अंतिम मुदत <strong>३१ ऑगस्ट</strong> आहे.
        </div>

        <div className="mt-12 pt-5 border-t border-slate-300">
          <div className="grid grid-cols-3 gap-6 text-center text-xs font-bold text-slate-800">
            <div className="space-y-12">
              <p>
                व्यवस्थापक / सर व्यवस्थापक
                <br />
                (Manager / General Manager)
              </p>
              <div className="w-40 border-b border-slate-400 mx-auto"></div>
            </div>
            <div className="space-y-12">
              <p>
                अंतर्गत लेखापरीक्षक
                <br />
                (Internal Auditor)
              </p>
              <div className="w-40 border-b border-slate-400 mx-auto"></div>
            </div>
            <div className="space-y-12">
              <p>
                वैधानिक लेखापरीक्षक
                <br />
                (Statutory Auditor)
              </p>
              <div className="space-y-1.5">
                <div className="w-40 border-b border-slate-400 mx-auto"></div>
                <div className="text-[10px] text-slate-600 font-normal">
                  UDIN:{' '}
                  <input
                    type="text"
                    value={udin}
                    onChange={(e) => setUdin(e.target.value)}
                    placeholder="UDIN प्रविष्ट करा..."
                    className="w-32 text-[10px] bg-transparent border-b border-slate-300 font-bold text-slate-800 focus:outline-none focus:border-primary no-print"
                  />
                  <span className="hidden print:inline font-bold text-slate-800">{udin || '____________________'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NpaStatementReport;
