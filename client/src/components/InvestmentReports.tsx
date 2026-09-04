import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Printer,
  RefreshCw,
  Building,
  PieChart,
  Landmark,
  ShieldCheck,
  Clock,
  Briefcase,
  TrendingUp,
  Calendar,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface InvestmentAccount {
  investmentAccountID: number;
  branchID: number;
  investmentNo: string;
  depositReceiptNo?: string;
  certificateNo?: string;
  institutionName?: string;
  schemeName?: string;
  investmentType?: string; // 'Deposit' or 'Share'
  principalAmount: number;
  interestRate: number;
  investmentDate: string;
  maturityDate: string;
  expectedMaturityAmount: number;
  accruedInterest: number;
  receivedInterest: number;
  interestReceivable: number;
  bookValue: number;
  status: string;
}

const InvestmentReports: React.FC = () => {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 0;
  const [selectedBranch, setSelectedBranch] = useState<number>(initialBranchId);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [activeReport, setActiveReport] = useState<
    'summary' | 'list' | 'maturityDue' | 'accrued' | 'auditSchedule'
  >(() => {
    const params = new URLSearchParams(window.location.search);
    const rep = params.get('reportType');
    if (rep === 'list' || rep === 'maturityDue' || rep === 'accrued' || rep === 'auditSchedule') {
      return rep;
    }
    return 'summary';
  });

  const API_URL = '/api';

  useEffect(() => {
    fetchBranches();
    fetchSansthaDetail();
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchDashboard();
  }, [selectedBranch, statusFilter, typeFilter]);

  const fetchSansthaDetail = async () => {
    try {
      const res = await axios.get(`${API_URL}/SansthaDetails`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSansthaDetail(res.data[0]);
      } else if (res.data && !Array.isArray(res.data)) {
        setSansthaDetail(res.data);
      }
    } catch (err) {
      console.error('Error fetching sanstha details', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/Branches`);
      setBranches(res.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/InvestmentAccounts`;
      const params = new URLSearchParams();
      if (selectedBranch > 0) params.append('branchId', selectedBranch.toString());
      if (statusFilter) params.append('status', statusFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url);
      setAccounts(res.data || []);
    } catch (err) {
      console.error('Error fetching accounts', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      let url = `${API_URL}/InvestmentAccounts/Dashboard`;
      if (selectedBranch > 0) url += `?branchId=${selectedBranch}`;
      const res = await axios.get(url);
      setDashboard(res.data);
    } catch (err) {
      console.error('Error fetching dashboard', err);
    }
  };

  const getBranchName = () => {
    if (selectedBranch === 0) return 'सर्व शाखा (All Branches)';
    const b = branches.find((item: any) => item.branchID === selectedBranch);
    return b ? b.branchName : 'मुख्य शाखा';
  };

  const formatCurrency = (n: number) =>
    n?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const filteredAccounts = accounts.filter((a) => {
    if (!typeFilter) return true;
    return (a.investmentType || 'Deposit') === typeFilter;
  });

  const maturityDueAccounts = accounts.filter((a) => {
    if (a.status !== 'Active') return false;
    const matDate = new Date(a.maturityDate);
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    return matDate <= threeMonthsLater;
  });

  const shareAccounts = filteredAccounts.filter((a) => a.investmentType === 'Share');
  const depositAccounts = filteredAccounts.filter((a) => (a.investmentType || 'Deposit') !== 'Share');

  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    
    let rows: any[] = [];
    let sheetName = 'InvestmentReport';

    if (activeReport === 'auditSchedule') {
      sheetName = 'AuditSchedule';
      rows = filteredAccounts.map((a, idx) => ({
        'अ.क्र.': idx + 1,
        'विभाग': a.investmentType === 'Share' ? 'भाग अ: शेअर्स गुंतवणूक' : 'भाग ब: मुदत ठेवी',
        'संस्था / बँक': a.institutionName,
        'खाते / पावती क्र.': a.depositReceiptNo || a.investmentNo,
        'गुंतवणूक तारीख': a.investmentDate?.split('T')[0],
        'व्याजदर / लाभांश': a.investmentType === 'Share' ? 'लाभांश' : `${a.interestRate}%`,
        'मुदतपूर्ती तारीख': a.investmentType === 'Share' ? 'कायमस्वरूपी' : a.maturityDate?.split('T')[0],
        'मुद्दल रक्कम ₹': a.principalAmount,
        'संचित येणे व्याज ₹': a.accruedInterest || 0,
        'पुस्तकी मूल्य ₹': a.bookValue
      }));
    } else if (activeReport === 'maturityDue') {
      sheetName = 'MaturityDue';
      rows = maturityDueAccounts.map((a, idx) => ({
        'अ.क्र.': idx + 1,
        'खाते क्रमांक': a.investmentNo,
        'पावती क्रमांक': a.depositReceiptNo || '-',
        'संस्था / बँक': a.institutionName,
        'मुद्दल रक्कम ₹': a.principalAmount,
        'व्याजदर %': a.interestRate,
        'मुदतपूर्ती तारीख': a.maturityDate?.split('T')[0],
        'अपेक्षित मुदतपूर्ती रक्कम ₹': a.expectedMaturityAmount
      }));
    } else {
      sheetName = 'Investments';
      rows = filteredAccounts.map((a, idx) => ({
        'अ.क्र.': idx + 1,
        'खाते क्रमांक': a.investmentNo,
        'पावती क्रमांक': a.depositReceiptNo || '-',
        'संस्था / बँक': a.institutionName,
        'योजना': a.schemeName,
        'प्रकार': a.investmentType === 'Share' ? 'शेअर्स भांडवल' : 'मुदत ठेव',
        'गुंतवणूक तारीख': a.investmentDate?.split('T')[0],
        'मुद्दल रक्कम ₹': a.principalAmount,
        'व्याजदर': a.investmentType === 'Share' ? 'लाभांश' : `${a.interestRate}%`,
        'मुदतपूर्ती तारीख': a.investmentType === 'Share' ? 'कायमस्वरूपी' : a.maturityDate?.split('T')[0],
        'संचित व्याज ₹': a.accruedInterest || 0,
        'पुस्तकी मूल्य ₹': a.bookValue,
        'स्थिती': a.status
      }));
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Investment_Report_${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print space-y-1.5">
        
        {/* Row 1: Title + Inline Filters + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          
          {/* Left: Compact Title */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Building size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>गुंतवणूक अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Investment Reports)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Report Type */}
            <div className="w-44 sm:w-52">
              <select
                value={activeReport}
                onChange={(e: any) => setActiveReport(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full text-primary"
              >
                <option value="summary">१. पोर्टफोलिओ सारांश</option>
                <option value="list">२. गुंतवणूक नोंदवही</option>
                <option value="maturityDue">३. मुदतपूर्ती देय पत्रक</option>
                <option value="accrued">४. संचित व येणे व्याज</option>
                <option value="auditSchedule">५. ऑडिट नमुना तक्ता</option>
              </select>
            </div>

            {/* Branch */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
              <select
                value={selectedBranch}
                disabled={hasGlobalBranch}
                onChange={(e) => setSelectedBranch(parseInt(e.target.value))}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
              >
                <option value={0}>सर्व शाखा (All)</option>
                {branches.map((b: any) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div className="flex items-center gap-1">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-32"
              >
                <option value="">सर्व प्रकार (ठेव व शेअर्स)</option>
                <option value="Deposit">ठेव गुंतवणूक (Deposit)</option>
                <option value="Share">शेअर गुंतवणूक (Share)</option>
              </select>
            </div>

            {/* View Button */}
            <button
              onClick={() => {
                fetchAccounts();
                fetchDashboard();
              }}
              disabled={loading}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>पहा</span>
            </button>
          </div>

          {/* Right: Export & Print Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={filteredAccounts.length === 0}
              className="h-6 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल (.xlsx)</span>
            </button>

            <button
              onClick={() => window.print()}
              className="h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              title="A4 प्रिंट काढा"
            >
              <Printer size={12} />
              <span>प्रिंट (A4)</span>
            </button>
          </div>

        </div>

      </div>

      {/* Printable Report Document Card */}
      <div className="bg-white p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between print:shadow-none print:border-none print:p-0 max-w-5xl mx-auto">
        <div>
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
                <span className="font-mono">{sansthaDetail?.registrationDate ? formatDate(sansthaDetail.registrationDate) : '-'}</span>
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

          {/* Title Banner Box */}
          <div className="mb-3 flex items-center justify-between">
            <div className="w-28 hidden sm:block"></div>
            <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs text-center">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif">
                {activeReport === 'summary' && 'गुंतवणूक पोर्टफोलिओ व पुस्तकी मूल्य सारांश'}
                {activeReport === 'list' && 'गुंतवणूक नोंदवही (Investment Register)'}
                {activeReport === 'maturityDue' && 'गुंतवणूक मुदतपूर्ती देय पत्रक'}
                {activeReport === 'accrued' && 'गुंतवणूक संचित व्याज व येणे व्याज अहवाल'}
                {activeReport === 'auditSchedule' && 'वैधानिक लेखापरीक्षण तक्ता - गुंतवणूक अहवाल'}
              </h2>
            </div>
            <div className="text-right text-xs font-bold text-gray-800">
              <span>दिनांक : </span>
              <span className="font-mono">{new Date().toLocaleDateString('en-GB')}</span>
            </div>
          </div>

          {/* 1. Summary Report Tab */}
          {activeReport === 'summary' && (
            <div className="space-y-4">
              {dashboard && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/80 border border-blue-200 rounded-sm p-3 shadow-2xs">
                    <p className="text-[10px] text-blue-700 font-bold uppercase">एकूण सक्रिय गुंतवणूक (Active Investments)</p>
                    <p className="text-xl font-black text-blue-900 mt-1">{dashboard.totalActiveAccounts} <span className="text-xs font-normal">खाती</span></p>
                    <p className="text-xs font-bold text-blue-800 mt-0.5">₹{formatCurrency(dashboard.totalInvestment)}</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100/80 border border-green-200 rounded-sm p-3 shadow-2xs">
                    <p className="text-[10px] text-green-700 font-bold uppercase">एकूण पुस्तकी मूल्य (Total Book Value)</p>
                    <p className="text-xl font-black text-green-900 mt-1">₹{formatCurrency(dashboard.totalBookValue)}</p>
                    <p className="text-[11px] font-bold text-green-800 mt-0.5">एकूण संचित व्याज: ₹{formatCurrency(dashboard.totalAccruedInterest)}</p>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/80 border border-amber-200 rounded-sm p-3 shadow-2xs">
                    <p className="text-[10px] text-amber-700 font-bold uppercase">येणे बाकी व्याज (Interest Receivable)</p>
                    <p className="text-xl font-black text-amber-900 mt-1">₹{formatCurrency(dashboard.interestReceivable)}</p>
                    <p className="text-[11px] font-bold text-amber-800 mt-0.5">प्राप्त झालेले व्याज: ₹{formatCurrency(dashboard.totalReceivedInterest)}</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100/80 border border-purple-200 rounded-sm p-3 shadow-2xs">
                    <p className="text-[10px] text-purple-700 font-bold uppercase">मुदतपूर्ती देय (Next 3 Months)</p>
                    <p className="text-xl font-black text-purple-900 mt-1">{dashboard.maturityDueCount} <span className="text-xs font-normal">खाती</span></p>
                    <p className="text-xs font-bold text-purple-800 mt-0.5">₹{formatCurrency(dashboard.maturityDueAmount)}</p>
                  </div>
                </div>
              )}

              {/* Summary Breakdown Table */}
              <div className="mt-4 border border-gray-200 rounded-sm overflow-hidden">
                <div className="bg-gray-100 px-3 py-2 border-b border-gray-200 font-bold text-xs text-gray-800 flex justify-between items-center">
                  <span>📊 संस्था व प्रकारानुसार गुंतवणूक वर्गवारी (Category Breakdown)</span>
                  <span className="text-[10px] font-normal text-gray-500">एकूण खाती: {filteredAccounts.length}</span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 font-bold text-[10px] uppercase border-b border-gray-200">
                      <th className="py-2 px-3">अ.क्र.</th>
                      <th className="py-2 px-3">संस्था / बँक</th>
                      <th className="py-2 px-3">प्रकार (Type)</th>
                      <th className="py-2 px-3 text-center">खाती संख्या</th>
                      <th className="py-2 px-3 text-right">मूळ मुद्दल रक्कम ₹</th>
                      <th className="py-2 px-3 text-right">संचित व्याज ₹</th>
                      <th className="py-2 px-3 text-right">पुस्तकी मूल्य (Book Value) ₹</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {filteredAccounts.map((a, idx) => (
                      <tr key={a.investmentAccountID} className="hover:bg-gray-50">
                        <td className="py-1.5 px-3">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-bold text-gray-900">{a.institutionName || 'बँक / संस्था'}</td>
                        <td className="py-1.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            a.investmentType === 'Share' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {a.investmentType === 'Share' ? 'शेअर्स (Share)' : 'ठेव (Deposit)'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-center font-mono font-bold">1</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold">₹{formatCurrency(a.principalAmount)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-green-700">₹{formatCurrency(a.accruedInterest)}</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-primary">₹{formatCurrency(a.bookValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-xs border-t-2 border-gray-300">
                      <td colSpan={3} className="py-2 px-3 text-right">एकूण बेरीज (Total):</td>
                      <td className="py-2 px-3 text-center">{filteredAccounts.length}</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-900">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.principalAmount, 0))}</td>
                      <td className="py-2 px-3 text-right font-mono text-green-800">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.accruedInterest, 0))}</td>
                      <td className="py-2 px-3 text-right font-mono text-primary">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.bookValue, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 2. Register List Tab */}
          {activeReport === 'list' && (
            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 font-bold text-[10px] uppercase border-b border-gray-300">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">खाते / पावती क्र.</th>
                    <th className="py-2 px-2">बँक / संस्था</th>
                    <th className="py-2 px-2">योजना</th>
                    <th className="py-2 px-2">गुंतवणूक तारीख</th>
                    <th className="py-2 px-2 text-right">मुद्दल ₹</th>
                    <th className="py-2 px-2 text-center">व्याजदर</th>
                    <th className="py-2 px-2">मुदतपूर्ती तारीख</th>
                    <th className="py-2 px-2 text-right">अपेक्षित रक्कम ₹</th>
                    <th className="py-2 px-2 text-right">पुस्तकी मूल्य ₹</th>
                    <th className="py-2 px-2 text-center">स्थिती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-gray-400 font-bold">डेटा लोड होत आहे...</td>
                    </tr>
                  ) : filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-gray-400 font-bold">कोणताही डेटा सापडला नाही.</td>
                    </tr>
                  ) : (
                    filteredAccounts.map((a, idx) => (
                      <tr key={a.investmentAccountID} className="hover:bg-blue-50/50">
                        <td className="py-1.5 px-2 font-bold">{idx + 1}</td>
                        <td className="py-1.5 px-2 font-mono font-bold text-primary">
                          {a.investmentNo}
                          {a.certificateNo && <div className="text-[9px] text-gray-500 font-normal">पावती: {a.certificateNo}</div>}
                        </td>
                        <td className="py-1.5 px-2 font-semibold">{a.institutionName}</td>
                        <td className="py-1.5 px-2">{a.schemeName}</td>
                        <td className="py-1.5 px-2 font-mono">{formatDate(a.investmentDate)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">₹{formatCurrency(a.principalAmount)}</td>
                        <td className="py-1.5 px-2 text-center font-mono font-bold text-green-700">{a.interestRate > 0 ? `${a.interestRate}%` : 'लाभांश'}</td>
                        <td className="py-1.5 px-2 font-mono">{formatDate(a.maturityDate)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">₹{formatCurrency(a.expectedMaturityAmount)}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-blue-900">₹{formatCurrency(a.bookValue)}</td>
                        <td className="py-1.5 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            a.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredAccounts.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-xs border-t-2 border-gray-300">
                      <td colSpan={5} className="py-2 px-2 text-right">एकूण बेरीज:</td>
                      <td className="py-2 px-2 text-right font-mono">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.principalAmount, 0))}</td>
                      <td colSpan={2}></td>
                      <td className="py-2 px-2 text-right font-mono">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.expectedMaturityAmount, 0))}</td>
                      <td className="py-2 px-2 text-right font-mono text-primary">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.bookValue, 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* 3. Maturity Due Report Tab */}
          {activeReport === 'maturityDue' && (
            <div className="space-y-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-sm text-amber-900 text-xs font-bold flex items-center justify-between">
                <span>⏰ पुढील ३ महिन्यात मुदतपूर्ती होणाऱ्या गुंतवणूक खाती ({maturityDueAccounts.length})</span>
                <span>एकूण मुदतपूर्ती रक्कम: ₹{formatCurrency(maturityDueAccounts.reduce((s, a) => s + a.expectedMaturityAmount, 0))}</span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-sm">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 text-gray-800 font-bold text-[10px] uppercase border-b border-gray-300">
                      <th className="py-2 px-2.5">#</th>
                      <th className="py-2 px-2.5">खाते क्र. / पावती</th>
                      <th className="py-2 px-2.5">संस्था / बँक</th>
                      <th className="py-2 px-2.5 text-right">मुद्दल ₹</th>
                      <th className="py-2 px-2.5 text-center">व्याजदर</th>
                      <th className="py-2 px-2.5">मुदतपूर्ती तारीख</th>
                      <th className="py-2 px-2.5 text-right">अपेक्षित मुदतपूर्ती रक्कम ₹</th>
                      <th className="py-2 px-2.5 text-center">उरलेले दिवस</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {maturityDueAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400 font-bold">पुढील ३ महिन्यात कोणतीही मुदतपूर्ती नाही.</td>
                      </tr>
                    ) : (
                      maturityDueAccounts.map((a, idx) => {
                        const daysLeft = Math.ceil((new Date(a.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return (
                          <tr key={a.investmentAccountID} className="hover:bg-amber-50/50">
                            <td className="py-2 px-2.5 font-bold">{idx + 1}</td>
                            <td className="py-2 px-2.5 font-mono font-bold text-primary">{a.investmentNo}</td>
                            <td className="py-2 px-2.5 font-semibold">{a.institutionName}</td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold">₹{formatCurrency(a.principalAmount)}</td>
                            <td className="py-2 px-2.5 text-center font-mono text-green-700 font-bold">{a.interestRate}%</td>
                            <td className="py-2 px-2.5 font-mono font-bold text-amber-800">{formatDate(a.maturityDate)}</td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-primary">₹{formatCurrency(a.expectedMaturityAmount)}</td>
                            <td className="py-2 px-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                daysLeft <= 0 ? 'bg-red-100 text-red-800' : daysLeft <= 30 ? 'bg-amber-100 text-amber-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {daysLeft <= 0 ? 'मुदत संपली!' : `${daysLeft} दिवस`}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Accrued Interest Report Tab */}
          {activeReport === 'accrued' && (
            <div className="space-y-3">
              <div className="p-2.5 bg-green-50 border border-green-200 rounded-sm text-green-900 text-xs font-bold flex items-center justify-between">
                <span>💰 गुंतवणूक संचित व्याज व येणे बाकी व्याज तपशील (Accrued & Receivable Interest)</span>
                <span>एकूण संचित व्याज: ₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.accruedInterest, 0))}</span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-sm">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 text-gray-800 font-bold text-[10px] uppercase border-b border-gray-300">
                      <th className="py-2 px-2.5">#</th>
                      <th className="py-2 px-2.5">खाते क्र.</th>
                      <th className="py-2 px-2.5">संस्था / बँक</th>
                      <th className="py-2 px-2.5 text-right">मुद्दल रक्कम ₹</th>
                      <th className="py-2 px-2.5 text-center">व्याजदर</th>
                      <th className="py-2 px-2.5 text-right">संचित व्याज (Accrued) ₹</th>
                      <th className="py-2 px-2.5 text-right">प्राप्त व्याज ₹</th>
                      <th className="py-2 px-2.5 text-right">येणे बाकी व्याज (Receivable) ₹</th>
                      <th className="py-2 px-2.5 text-right">एकूण पुस्तकी मूल्य ₹</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {filteredAccounts.map((a, idx) => (
                      <tr key={a.investmentAccountID} className="hover:bg-green-50/50">
                        <td className="py-1.5 px-2.5 font-bold">{idx + 1}</td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-primary">{a.investmentNo}</td>
                        <td className="py-1.5 px-2.5 font-semibold">{a.institutionName}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold">₹{formatCurrency(a.principalAmount)}</td>
                        <td className="py-1.5 px-2.5 text-center font-mono text-green-700 font-bold">{a.interestRate > 0 ? `${a.interestRate}%` : 'लाभांश'}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-green-700">₹{formatCurrency(a.accruedInterest)}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-blue-700">₹{formatCurrency(a.receivedInterest)}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-amber-700">₹{formatCurrency(a.interestReceivable)}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-primary">₹{formatCurrency(a.bookValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-xs border-t-2 border-gray-300">
                      <td colSpan={3} className="py-2 px-2.5 text-right">एकूण बेरीज:</td>
                      <td className="py-2 px-2.5 text-right font-mono">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.principalAmount, 0))}</td>
                      <td></td>
                      <td className="py-2 px-2.5 text-right font-mono text-green-800">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.accruedInterest, 0))}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-blue-800">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.receivedInterest, 0))}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-amber-800">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.interestReceivable, 0))}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-primary">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.bookValue, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 5. Statutory Audit Schedule Tab (ऑडिट नमुना शेड्यूल) */}
          {activeReport === 'auditSchedule' && (
            <div className="space-y-4">
              <div className="p-2 bg-purple-50 border border-purple-200 rounded-sm text-purple-900 text-xs font-bold flex justify-between items-center">
                <span>🏛️ वैधानिक लेखापरीक्षण विवरणपत्र - गुंतवणूक शेड्यूल (Statutory Audit Schedule Statement of Investments)</span>
                <span className="text-[10px] bg-purple-200 text-purple-900 px-2 py-0.5 rounded font-mono">ऑडिट नमुना शेड्यूल</span>
              </div>

              {/* Section A: Share Investments */}
              <div className="border border-purple-200 rounded-sm overflow-hidden">
                <div className="bg-purple-100/70 px-3 py-1.5 border-b border-purple-200 font-bold text-xs text-purple-900">
                  भाग अ: सहकारी व इतर संस्थांमधील शेअर्स गुंतवणूक (Shares in Co-operative & Other Institutions)
                </div>
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 font-bold text-[10px] uppercase border-b border-gray-300 text-gray-700">
                      <th className="py-1.5 px-2">अ.क्र.</th>
                      <th className="py-1.5 px-2">संस्थेचे नाव</th>
                      <th className="py-1.5 px-2">शेअर दाखला / खाते क्र.</th>
                      <th className="py-1.5 px-2">खरेदी तारीख</th>
                      <th className="py-1.5 px-2 text-right">शेअर्स दर्शनी मूल्य (Face Value) ₹</th>
                      <th className="py-1.5 px-2 text-right">मिळालेला लाभांश (Dividend) ₹</th>
                      <th className="py-1.5 px-2 text-right">एकूण पुस्तकी मूल्य ₹</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shareAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-gray-400 font-bold">शेअर्स मधील कोणतीही गुंतवणूक उपलब्ध नाही.</td>
                      </tr>
                    ) : (
                      shareAccounts.map((a, idx) => (
                        <tr key={a.investmentAccountID} className="hover:bg-purple-50/50">
                          <td className="py-1.5 px-2 font-bold">{idx + 1}</td>
                          <td className="py-1.5 px-2 font-semibold">{a.institutionName}</td>
                          <td className="py-1.5 px-2 font-mono">{a.investmentNo}</td>
                          <td className="py-1.5 px-2 font-mono">{formatDate(a.investmentDate)}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold">₹{formatCurrency(a.principalAmount)}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-purple-700 font-bold">₹{formatCurrency(a.receivedInterest)}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-primary">₹{formatCurrency(a.bookValue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {shareAccounts.length > 0 && (
                    <tfoot>
                      <tr className="bg-purple-50 font-bold text-xs border-t-2 border-purple-200 text-purple-900">
                        <td colSpan={4} className="py-1.5 px-2 text-right">एकूण शेअर्स बेरीज (Total Shares):</td>
                        <td className="py-1.5 px-2 text-right font-mono">₹{formatCurrency(shareAccounts.reduce((s, a) => s + a.principalAmount, 0))}</td>
                        <td className="py-1.5 px-2 text-right font-mono">₹{formatCurrency(shareAccounts.reduce((s, a) => s + a.receivedInterest, 0))}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-primary">₹{formatCurrency(shareAccounts.reduce((s, a) => s + a.bookValue, 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Section B: Term / Fixed Deposit Investments */}
              <div className="border border-blue-200 rounded-sm overflow-hidden">
                <div className="bg-blue-100/70 px-3 py-1.5 border-b border-blue-200 font-bold text-xs text-blue-900">
                  भाग ब: बँकांमधील ठेवी गुंतवणूक (Term & Fixed Deposits with Banks)
                </div>
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 font-bold text-[10px] uppercase border-b border-gray-300 text-gray-700">
                      <th className="py-1.5 px-2">अ.क्र.</th>
                      <th className="py-1.5 px-2">बँकेचे नाव</th>
                      <th className="py-1.5 px-2">एफडी पावती / खाते क्र.</th>
                      <th className="py-1.5 px-2">ठेव तारीख</th>
                      <th className="py-1.5 px-2 text-center">व्याजदर</th>
                      <th className="py-1.5 px-2">मुदतपूर्ती तारीख</th>
                      <th className="py-1.5 px-2 text-right">ठेव मुद्दल रक्कम ₹</th>
                      <th className="py-1.5 px-2 text-right">संचित येणे व्याज ₹</th>
                      <th className="py-1.5 px-2 text-right">पुस्तकी मूल्य ₹</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {depositAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-4 text-center text-gray-400 font-bold">ठेवींमधील कोणतीही गुंतवणूक उपलब्ध नाही.</td>
                      </tr>
                    ) : (
                      depositAccounts.map((a, idx) => (
                        <tr key={a.investmentAccountID} className="hover:bg-blue-50/50">
                          <td className="py-1.5 px-2 font-bold">{idx + 1}</td>
                          <td className="py-1.5 px-2 font-semibold">{a.institutionName}</td>
                          <td className="py-1.5 px-2 font-mono">{a.investmentNo}</td>
                          <td className="py-1.5 px-2 font-mono">{formatDate(a.investmentDate)}</td>
                          <td className="py-1.5 px-2 text-center font-mono text-green-700 font-bold">{a.interestRate}%</td>
                          <td className="py-1.5 px-2 font-mono">{formatDate(a.maturityDate)}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold">₹{formatCurrency(a.principalAmount)}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-green-700">₹{formatCurrency(a.accruedInterest)}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-primary">₹{formatCurrency(a.bookValue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {depositAccounts.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50 font-bold text-xs border-t-2 border-blue-200 text-blue-900">
                        <td colSpan={6} className="py-1.5 px-2 text-right">एकूण ठेवी बेरीज (Total Deposits):</td>
                        <td className="py-1.5 px-2 text-right font-mono">₹{formatCurrency(depositAccounts.reduce((s, a) => s + a.principalAmount, 0))}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-green-800">₹{formatCurrency(depositAccounts.reduce((s, a) => s + a.accruedInterest, 0))}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-primary">₹{formatCurrency(depositAccounts.reduce((s, a) => s + a.bookValue, 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Total Summary Certificate Statement */}
              <div className="p-3 bg-gray-50 border border-gray-300 rounded-sm space-y-1 text-xs">
                <div className="flex justify-between font-black text-gray-900">
                  <span>सर्व प्रकारच्या गुंतवणुकीची एकत्रित एकूण शिल्लक (Grand Total Investments & Book Value):</span>
                  <span className="text-primary font-mono">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.bookValue, 0))}</span>
                </div>
                <p className="text-[10px] text-gray-600 font-medium pt-1">
                  प्रमाणित करण्यात येते की, वरील सर्व शेअर्स व ठेवी मधील गुंतवणुकीच्या पावत्या व प्रमाणपत्रे संस्थेच्या सुरक्षित ताब्यात असून पुस्तकी मूल्याशी जुळतात.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Official Signatory Footer Block for Printing */}
        <div className="pt-8 mt-6 border-t border-gray-300 grid grid-cols-3 gap-4 text-center font-bold text-xs text-gray-800 print:block">
          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-400 pt-1">लिपीक / कॅशियर</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-400 pt-1">मुख्य कार्यकारी अधिकारी / मॅनेजर</p>
          </div>
          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-400 pt-1">वैधानिक लेखापरीक्षक (Statutory Auditor)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestmentReports;
