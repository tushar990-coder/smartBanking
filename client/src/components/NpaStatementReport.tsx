import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface NpaStatementReportProps {
  onBack?: () => void;
}

const NpaStatementReport: React.FC<NpaStatementReportProps> = ({ onBack }) => {
  const API_URL = '/api/Npa';
  const [statement, setStatement] = useState<any>(null);
  const [breakup, setBreakup] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [auditRemarks, setAuditRemarks] = useState('');
  const [selectedLoanForLoss, setSelectedLoanForLoss] = useState<number | null>(null);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [udin, setUdin] = useState('260045A9292837C');
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

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
      let branchQuery = '';
      if (activeBranch && activeBranch !== 'all') {
        branchQuery = `&branchId=${activeBranch}`;
      }

      const [stmtRes, breakupRes, loansRes, sansthaRes] = await Promise.all([
        axios.get(`${API_URL}/statement?asOfDate=${date}${branchQuery}`),
        axios.get(`${API_URL}/breakup?asOfDate=${date}${branchQuery}`),
        axios.get(activeBranch && activeBranch !== 'all' ? `/api/LoanAccounts?branchId=${activeBranch}` : '/api/LoanAccounts'),
        axios.get('/api/SansthaDetails')
      ]);
      setStatement(stmtRes.data);
      setBreakup(breakupRes.data);
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

  const handlePrint = () => {
    window.print();
  };

  const handleCertifyLoss = async () => {
    if (!selectedLoanForLoss || !auditRemarks.trim()) {
      alert('कृपया कर्ज खाते निवडा आणि शेरा प्रविष्ट करा. (Please select a loan and enter remarks.)');
      return;
    }
    try {
      await axios.post(`${API_URL}/certify-loss`, {
        loanAccountID: selectedLoanForLoss,
        remarks: auditRemarks,
        asOfDate: selectedDate
      });
      alert('तोटा मालमत्ता यशस्वीरित्या प्रमाणित केली! (Certified Loss Asset successfully!)');
      setAuditRemarks('');
      setSelectedLoanForLoss(null);
      fetchData(selectedDate);
    } catch (err) {
      console.error(err);
      alert('प्रमाणित करताना त्रुटी आली. (Error certifying.)');
    }
  };

  if (loading && !statement) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isGrossNpaViolated = statement ? statement.grossNpaPercent > 10 : false;
  const isNetNpaViolated = statement ? statement.netNpaPercent > 5 : false;

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print space-y-1.5">
        
        {/* Row 1: Title + Inline Filters + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          
          {/* Left: Compact Title */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onBack && (
              <button onClick={onBack} className="text-gray-600 hover:text-gray-900 font-semibold text-xs flex items-center gap-1 mr-1">
                ← मागे
              </button>
            )}
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <span className="text-xs">📊</span>
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>एन.पी.ए. वर्गीकरण व प्रोव्हिजनिंग पत्रक</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(NPA Statement)</span>
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

            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">दिनांक:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* View Button */}
            <button
              onClick={() => fetchData(selectedDate, selectedBranchId)}
              disabled={loading}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? '...' : 'पहा'}</span>
            </button>
          </div>

          {/* Right: Export & Print Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handlePrint}
              className="h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              title="A4 प्रिंट काढा"
            >
              <span>प्रिंट (A4)</span>
            </button>
          </div>

        </div>

      </div>

      {/* Auditor Certification section: Hidden in Print */}
      <div className="bg-white p-4 rounded-sm shadow-xs border border-gray-200 space-y-2 print:hidden no-print">
        <h3 className="text-xs font-bold text-gray-800 border-b pb-1">लेखापरीक्षक तोटा मालमत्ता प्रमाणीकरण (Auditor Loss Asset Certification)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
          <div>
            <label className="text-[10px] font-bold text-gray-600 block mb-0.5">कर्ज खाते निवडा</label>
            <select
              value={selectedLoanForLoss || ''}
              onChange={(e) => setSelectedLoanForLoss(Number(e.target.value))}
              className="w-full h-6 border border-gray-300 rounded-sm px-1.5 text-xs focus:outline-none focus:border-primary"
            >
              <option value="">-- खाते निवडा --</option>
              {activeLoans.map((l: any) => (
                <option key={l.loanAccountID} value={l.loanAccountID}>
                  {l.loanAccountNo} - {l.member?.firstName} {l.member?.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-600 block mb-0.5">लेखापरीक्षक शेरा / कारण</label>
            <input
              type="text"
              value={auditRemarks}
              onChange={(e) => setAuditRemarks(e.target.value)}
              placeholder="तोटा ठरवण्याचे कारण द्या..."
              className="w-full h-6 border border-gray-300 rounded-sm px-1.5 text-xs focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleCertifyLoss}
            className="h-6 bg-red-600 hover:bg-red-700 text-white rounded-sm text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            🚫 तोटा ऍसेट घोषित करा (Certify Loss)
          </button>
        </div>
      </div>

      {/* Print Document Wrapper */}
      <div className="bg-white p-5 md:p-8 rounded-sm shadow-md border border-slate-300 print:border-none print:shadow-none print:p-0 relative text-gray-800 font-sans max-w-5xl mx-auto" style={{ boxSizing: 'border-box' }}>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
          }
        `}</style>
        
        {/* Official Bank Header Box (Exact Reference Format) */}
        <div className="border border-gray-900 p-3 relative text-center mb-3">
          
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
              <span className="font-mono">{sansthaDetail?.registrationDate ? new Date(sansthaDetail.registrationDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</span>
            </div>
          </div>

          {/* Central Sanstha Name */}
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight leading-snug font-serif uppercase">
            {sansthaDetail?.sansthaName || statement?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
          </h1>

          {/* Subtitle / Address */}
          <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1">
            {sansthaDetail?.address || statement?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
          </p>
        </div>

        {/* Title Banner Box */}
        <div className="mb-3 flex items-center justify-between">
          <div className="w-28 hidden sm:block"></div>
          <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs text-center">
            <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif">
              एन.पी.ए. (थकीत येणे) वर्गीकरण आणि प्रोव्हिजनिंग पत्रक
            </h2>
          </div>
          <div className="text-right text-xs font-bold text-gray-800">
            <span>दिनांक : </span>
            <span className="font-mono">{new Date(statement?.asOfDate).toLocaleDateString('en-GB')} अखेर</span>
          </div>
        </div>

        {/* Part 1: Main Statement Table */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold text-gray-800 border-l-4 border-gray-800 pl-2 uppercase">भाग १: मुख्य एन.पी.ए. पत्रक (Part 1: Main NPA Statement)</h3>
          <table className="w-full border-collapse border border-gray-400 text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-400 font-bold">
                <th className="border border-gray-400 p-2.5 text-center w-12">अनु. (Sr)</th>
                <th className="border border-gray-400 p-2.5 text-left">तपशील (Details)</th>
                <th className="border border-gray-400 p-2.5 text-right w-56">रक्कम (₹ लाखात) (Amount in ₹ Lakh)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-400 p-2.5 text-center font-semibold">१</td>
                <td className="border border-gray-400 p-2.5 font-medium">एकूण कर्ज वाटप बाकी (Gross Advances)</td>
                <td className="border border-gray-400 p-2.5 text-right font-black">₹ {statement?.grossAdvances}</td>
              </tr>
              <tr className={isGrossNpaViolated ? 'bg-red-50/50 print:bg-transparent font-medium' : ''}>
                <td className="border border-gray-400 p-2.5 text-center font-semibold">२</td>
                <td className="border border-gray-400 p-2.5 font-medium flex justify-between items-center">
                  <span>एकूण एन.पी.ए. खाते बाकी (Gross NPA)</span>
                  {isGrossNpaViolated && <span className="text-[10px] text-red-600 font-black no-print">(मर्यादा ओलांडली!)</span>}
                </td>
                <td className={`border border-gray-400 p-2.5 text-right font-black ${isGrossNpaViolated ? 'text-red-700' : ''}`}>₹ {statement?.grossNpa}</td>
              </tr>
              <tr className={isGrossNpaViolated ? 'bg-red-50/50 print:bg-transparent' : ''}>
                <td className="border border-gray-400 p-2.5 text-center font-semibold">३</td>
                <td className="border border-gray-400 p-2.5 font-medium">एकूण एन.पी.ए. प्रमाण % (Gross NPA %) <span className="text-[10px] text-gray-500">(२ ÷ १ × १००)</span></td>
                <td className={`border border-gray-400 p-2.5 text-right font-black ${isGrossNpaViolated ? 'text-red-700' : ''}`}>{statement?.grossNpaPercent}%</td>
              </tr>
              <tr className="bg-gray-50/50">
                <td className="border border-gray-400 p-2.5 text-center font-semibold">४</td>
                <td className="border border-gray-400 p-2.5 font-semibold" colSpan={2}>
                  वजावटी (Deductions):
                </td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-2.5 text-center"></td>
                <td className="border border-gray-400 p-2.5 pl-6 text-gray-600 font-medium">(अ) थकीत व्याज तरतूद (Overdue Interest Reserve)</td>
                <td className="border border-gray-400 p-2.5 text-right font-bold text-gray-700">₹ {statement?.overdueInterestReserve}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-2.5 text-center"></td>
                <td className="border border-gray-400 p-2.5 pl-6 text-gray-600 font-medium">(ब) एकरकमी परतफेड/वसुली ठेव योजना अनामत (Recovery Deposits)</td>
                <td className="border border-gray-400 p-2.5 text-right font-bold text-gray-700">₹ {statement?.recoveryDeposits}</td>
              </tr>
              <tr className="bg-gray-100/50">
                <td className="border border-gray-400 p-2.5 text-center"></td>
                <td className="border border-gray-400 p-2.5 pl-6 font-bold text-gray-800">एकूण वजावटी (Total Deductions) <span className="text-[10px] text-gray-500">(४अ + ४ब)</span></td>
                <td className="border border-gray-400 p-2.5 text-right font-bold text-gray-800">₹ {statement?.totalDeductions}</td>
              </tr>
              <tr>
                <td className="border border-gray-400 p-2.5 text-center font-semibold">५</td>
                <td className="border border-gray-400 p-2.5 font-medium">केलेली एकूण एन.पी.ए./बुडीत कर्ज तरतूद (Total NPA/BDDR Provision made)</td>
                <td className="border border-gray-400 p-2.5 text-right font-black">₹ {statement?.totalProvision}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-400 p-2.5 text-center font-semibold">६</td>
                <td className="border border-gray-400 p-2.5 font-bold">निव्वळ कर्ज बाकी (Net Advances) <span className="text-[10px] text-gray-500">(१ − ५)</span></td>
                <td className="border border-gray-400 p-2.5 text-right font-black">₹ {statement?.netAdvances}</td>
              </tr>
              <tr className={`bg-gray-50 ${isNetNpaViolated ? 'bg-red-50/50 print:bg-transparent font-medium' : ''}`}>
                <td className="border border-gray-400 p-2.5 text-center font-semibold">७</td>
                <td className="border border-gray-400 p-2.5 font-bold flex justify-between items-center">
                  <span>निव्वळ एन.पी.ए. (Net NPA) <span className="text-[10px] text-gray-500">(२ − ४ − ५)</span></span>
                  {isNetNpaViolated && <span className="text-[10px] text-red-600 font-black no-print">(मर्यादा ओलांडली!)</span>}
                </td>
                <td className={`border border-gray-400 p-2.5 text-right font-black ${isNetNpaViolated ? 'text-red-700' : ''}`}>₹ {statement?.netNpa}</td>
              </tr>
              <tr className={`bg-gray-100 ${isNetNpaViolated ? 'bg-red-50/50 print:bg-transparent' : ''}`}>
                <td className="border border-gray-400 p-2.5 text-center font-semibold">८</td>
                <td className="border border-gray-400 p-2.5 font-bold">निव्वळ एन.पी.ए. % (Net NPA %) <span className="text-[10px] text-gray-500">(७ ÷ ६ × १००)</span></td>
                <td className={`border border-gray-400 p-2.5 text-right font-black ${isNetNpaViolated ? 'text-red-700' : ''}`}>{statement?.netNpaPercent}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Part 2: Category Breakup */}
        <div className="mt-8 space-y-3 page-break-before">
          <h3 className="text-xs font-bold text-gray-800 border-l-4 border-gray-800 pl-2 uppercase">भाग २: कर्ज वर्गीकरण व तरतुदीची वर्गवारी (Part 2: Category Breakup)</h3>
          <table className="w-full border-collapse border border-gray-400 text-[10px]">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-400 font-bold text-center">
                <th className="border border-gray-400 p-2">अनु. (Sr)</th>
                <th className="border border-gray-400 p-2 text-left">वर्गीकरण श्रेणी (Category)</th>
                <th className="border border-gray-400 p-2">खाती (Accounts)</th>
                <th className="border border-gray-400 p-2">एकूण बाकी (Outstanding) (₹ Lakh)</th>
                <th className="border border-gray-400 p-2">तारण (Secured) (₹ Lakh)</th>
                <th className="border border-gray-400 p-2">विनातारण (Unsecured) (₹ Lakh)</th>
                <th className="border border-gray-400 p-2">आवश्यक तरतूद (Provision Req.) (₹ Lakh)</th>
                <th className="border border-gray-400 p-2">केलेली तरतूद (Provision Held) (₹ Lakh)</th>
              </tr>
            </thead>
            <tbody>
              {breakup.map((b, i) => (
                <tr key={i} className="text-center font-medium">
                  <td className="border border-gray-400 p-2">{i+1}</td>
                  <td className="border border-gray-400 p-2 text-left">{b.categoryMarathi}</td>
                  <td className="border border-gray-400 p-2">{b.accountCount}</td>
                  <td className="border border-gray-400 p-2 font-bold">₹ {b.grossOutstanding}</td>
                  <td className="border border-gray-400 p-2">₹ {b.securedOutstanding}</td>
                  <td className="border border-gray-400 p-2">₹ {b.unsecuredOutstanding}</td>
                  <td className="border border-gray-400 p-2 font-bold text-indigo-700">₹ {b.provisionRequired}</td>
                  <td className="border border-gray-400 p-2 text-green-700">₹ {b.provisionHeld}</td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-100 text-center">
                <td className="border border-gray-400 p-2" colSpan={2}>एकूण (Total)</td>
                <td className="border border-gray-400 p-2">{breakup.sum((b: any) => b.accountCount)}</td>
                <td className="border border-gray-400 p-2">₹ {breakup.sum((b: any) => b.grossOutstanding).toFixed(2)}</td>
                <td className="border border-gray-400 p-2">₹ {breakup.sum((b: any) => b.securedOutstanding).toFixed(2)}</td>
                <td className="border border-gray-400 p-2">₹ {breakup.sum((b: any) => b.unsecuredOutstanding).toFixed(2)}</td>
                <td className="border border-gray-400 p-2 text-indigo-800">₹ {breakup.sum((b: any) => b.provisionRequired).toFixed(2)}</td>
                <td className="border border-gray-400 p-2 text-green-800">₹ {breakup.sum((b: any) => b.provisionHeld).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Compliance Reminder deadline */}
        <div className="mt-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-[10px] text-blue-900 font-medium">
          ℹ️ **वैधानिक नियम स्मरणपत्र**: सहकार नियमांनुसार ३१ मार्च अखेरचे एन.पी.ए. ऑडिट झाल्यावर रजिस्टर ऑफिसला अहवाल सादर करण्याची अंतिम मुदत **३१ ऑगस्ट** आहे. कृपया मुदतीत अहवाल सादर करावा.
        </div>

        {/* Auditor Sign-off Area */}
        <div className="mt-12 pt-6 border-t border-gray-300">
          <div className="grid grid-cols-3 gap-6 text-center text-xs font-bold text-gray-700">
            <div className="space-y-16">
              <p>व्यवस्थापक / सर व्यवस्थापक<br/>(Manager / General Manager)</p>
              <div className="w-40 border-b border-gray-400 mx-auto"></div>
            </div>
            <div className="space-y-16">
              <p>अंतर्गत लेखापरीक्षक<br/>(Internal Auditor)</p>
              <div className="w-40 border-b border-gray-400 mx-auto"></div>
            </div>
            <div className="space-y-16">
              <p>वैधानिक लेखापरीक्षक<br/>(Statutory Auditor)</p>
              <div className="space-y-2">
                <div className="w-40 border-b border-gray-400 mx-auto"></div>
                <div className="text-[10px] text-gray-500 font-normal">UDIN: <input type="text" value={udin} onChange={(e) => setUdin(e.target.value)} className="w-24 text-[10px] bg-transparent border-none font-bold text-gray-700 focus:outline-none print:border-none no-print border-b" /> <span className="print-only font-bold text-gray-700">{udin}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NpaStatementReport;

// Polyfill array sum for cleaner templates
declare global {
  interface Array<T> {
    sum(selector: (item: T) => number): number;
  }
}

if (!Array.prototype.sum) {
  Array.prototype.sum = function<T>(this: T[], selector: (item: T) => number): number {
    return this.reduce((acc, item) => acc + selector(item), 0);
  };
}

