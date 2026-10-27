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
import CbsReportLayout, { CbsPaperSize, CbsSignatureTier } from './common/CbsReportLayout';

interface InvestmentAccount {
  investmentAccountID: number;
  branchID: number;
  investmentNo: string;
  depositReceiptNo?: string;
  certificateNo?: string;
  institutionName?: string;
  schemeID?: number;
  schemeId?: number;
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
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | ''>('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paperSize, setPaperSize] = useState<CbsPaperSize>('a4-landscape');
  const [signatureTier, setSignatureTier] = useState<CbsSignatureTier>('3-tier');

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 0;
  const [selectedBranch, setSelectedBranch] = useState<number>(initialBranchId);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const parseActiveReport = (): 'summary' | 'list' | 'maturityDue' | 'accrued' | 'auditSchedule' => {
    const params = new URLSearchParams(window.location.search);
    const fullTab = params.get('tab') || '';
    let rep = params.get('reportType');
    if (!rep && fullTab.includes('reportType=')) {
      rep = fullTab.split('reportType=')[1] || '';
    }
    const cleanRep = (rep || '').split('&')[0].trim();
    if (cleanRep === 'list' || cleanRep === 'maturityDue' || cleanRep === 'accrued' || cleanRep === 'auditSchedule') {
      return cleanRep;
    }
    return 'summary';
  };

  const [activeReport, setActiveReport] = useState<
    'summary' | 'list' | 'maturityDue' | 'accrued' | 'auditSchedule'
  >(parseActiveReport);

  const API_URL = '/api';

  useEffect(() => {
    fetchBranches();
    fetchSansthaDetail();
    fetchSchemes();

    const handlePopState = () => {
      setActiveReport(parseActiveReport());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchDashboard();
  }, [selectedBranch, statusFilter, typeFilter]);

  const fetchSchemes = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentSchemes`);
      setSchemes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching investment schemes', err);
    }
  };

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
    if (typeFilter && (a.investmentType || 'Deposit') !== typeFilter) return false;
    if (selectedSchemeId) {
      const aSid = a.schemeID || (a as any).schemeId;
      const matchedScheme = schemes.find(s => (s.schemeID || s.SchemeID) === Number(selectedSchemeId));
      if (aSid && aSid !== Number(selectedSchemeId)) return false;
      if (!aSid && matchedScheme && a.schemeName && a.schemeName.trim() !== matchedScheme.schemeName?.trim()) return false;
    }
    return true;
  });

  const groupedByScheme = React.useMemo(() => {
    const groups: { [key: string]: InvestmentAccount[] } = {};
    filteredAccounts.forEach((acc) => {
      const key = acc.schemeName?.trim() || 'इतर / अनिर्दिष्ट योजना';
      if (!groups[key]) groups[key] = [];
      groups[key].push(acc);
    });
    return groups;
  }, [filteredAccounts]);

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
      const sorted = [...filteredAccounts].sort((a, b) => (a.schemeName || '').localeCompare(b.schemeName || ''));
      rows = sorted.map((a, idx) => ({
        'अ.क्र.': idx + 1,
        'योजना': a.schemeName,
        'खाते क्रमांक': a.investmentNo,
        'पावती क्रमांक': a.depositReceiptNo || '-',
        'संस्था / बँक': a.institutionName,
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

  const { title: reportTitle, subtitle: reportSubtitle } = (() => {
    switch (activeReport) {
      case 'list':
        return {
          title: 'गुंतवणूक नोंदवही',
          subtitle: 'Investment Register (Scheme-wise)'
        };
      case 'maturityDue':
        return {
          title: 'गुंतवणूक मुदतपूर्ती देय पत्रक',
          subtitle: 'Investment Maturity Due Statement'
        };
      case 'accrued':
        return {
          title: 'गुंतवणूक संचित व येणे व्याज अहवाल',
          subtitle: 'Accrued & Receivable Interest Statement'
        };
      case 'auditSchedule':
        return {
          title: 'वैधानिक लेखापरीक्षण विवरणपत्र - गुंतवणूक शेड्यूल',
          subtitle: 'Statutory Audit Schedule - Statement of Investments'
        };
      case 'summary':
      default:
        return {
          title: 'गुंतवणूक पोर्टफोलिओ व पुस्तकी मूल्य सारांश',
          subtitle: 'Investment Portfolio & Book Value Summary'
        };
    }
  })();

  const summaryBanner = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण गुंतवणूक खाती</span>
        <strong className="text-primary font-mono text-[11.5px]">
          {filteredAccounts.length} खाती <span className="text-slate-500 font-normal">({depositAccounts.length} ठेवी / {shareAccounts.length} शेअर्स)</span>
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण मुद्दल रक्कम</span>
        <strong className="text-slate-900 font-mono text-[11.5px]">
          ₹{formatCurrency(filteredAccounts.reduce((s, a) => s + (a.principalAmount || 0), 0))}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">संचित येणे व्याज</span>
        <strong className="text-emerald-700 font-mono text-[11.5px]">
          ₹{formatCurrency(filteredAccounts.reduce((s, a) => s + (a.accruedInterest || 0), 0))}
        </strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण पुस्तकी मूल्य (Book Value)</span>
        <strong className="text-blue-900 font-mono text-xs">
          ₹{formatCurrency(filteredAccounts.reduce((s, a) => s + (a.bookValue || 0), 0))}
        </strong>
      </div>
    </div>
  );

  const extraToolbarControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* Report Type Selector */}
      <select
        value={activeReport}
        onChange={(e: any) => setActiveReport(e.target.value)}
        className="h-6 border border-gray-300 rounded px-1.5 text-[11px] font-bold bg-white text-primary focus:outline-none focus:border-primary"
      >
        <option value="summary">१. पोर्टफोलिओ सारांश</option>
        <option value="list">२. गुंतवणूक नोंदवही</option>
        <option value="maturityDue">३. मुदतपूर्ती देय पत्रक</option>
        <option value="accrued">४. संचित व येणे व्याज</option>
        <option value="auditSchedule">५. ऑडिट नमुना तक्ता</option>
      </select>

      {/* Branch */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600">शाखा:</label>
        <select
          value={selectedBranch}
          disabled={hasGlobalBranch}
          onChange={(e) => setSelectedBranch(parseInt(e.target.value))}
          className="h-6 border border-gray-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
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
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="h-6 border border-gray-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
      >
        <option value="">सर्व प्रकार (ठेव/शेअर)</option>
        <option value="Deposit">ठेव गुंतवणूक (Deposit)</option>
        <option value="Share">शेअर गुंतवणूक (Share)</option>
      </select>

      {/* Scheme */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600">योजना:</label>
        <select
          value={selectedSchemeId}
          onChange={(e) => setSelectedSchemeId(e.target.value ? Number(e.target.value) : '')}
          className="h-6 border border-gray-300 rounded px-1 text-[10.5px] bg-white text-slate-800 max-w-[140px]"
        >
          <option value="">सर्व योजना (All Schemes)</option>
          {schemes.map((s: any) => (
            <option key={s.schemeID || s.SchemeID} value={s.schemeID || s.SchemeID}>
              {s.schemeName || s.SchemeName}
            </option>
          ))}
        </select>
      </div>

      {/* Signature Tier */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600">स्वाक्षरी:</label>
        <select
          value={signatureTier}
          onChange={(e) => setSignatureTier(e.target.value as CbsSignatureTier)}
          className="h-6 border border-gray-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
        >
          <option value="3-tier">३-स्तरीय स्वाक्षरी</option>
          <option value="4-tier">४-स्तरीय स्वाक्षरी</option>
        </select>
      </div>

      {/* Refresh / View */}
      <button
        onClick={() => {
          fetchAccounts();
          fetchDashboard();
        }}
        disabled={loading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2 rounded text-[10.5px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        <span>पहा</span>
      </button>
    </div>
  );

  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      titleStyle="classic-badge"
      reportTitle={reportTitle}
      reportSubtitle={reportSubtitle}
      periodText={`दिनांक: ${new Date().toLocaleDateString('en-GB')}`}
      branchName={getBranchName()}
      sansthaInfo={sansthaDetail}
      summaryBanner={summaryBanner}
      signatureTier={signatureTier}
      signatureTitles={
        signatureTier === '4-tier'
          ? [
              { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
              { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
              { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' },
              { title: 'चेअरमन / वैधानिक लेखापरीक्षक', subtitle: '(Chairman / Statutory Auditor)' }
            ]
          : [
              { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
              { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' },
              { title: 'चेअरमन / वैधानिक लेखापरीक्षक', subtitle: '(Chairman / Statutory Auditor)' }
            ]
      }
      onExportExcel={handleExportExcel}
      extraToolbarControls={extraToolbarControls}
      isLoading={loading}
      hasData={filteredAccounts.length > 0 || activeReport === 'summary'}
      preparedBy="Admin"
    >
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
          <div className="mt-4 border border-slate-900 rounded-xs overflow-hidden">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-900 font-bold text-xs text-slate-900 flex justify-between items-center">
              <span>📊 संस्था व प्रकारानुसार गुंतवणूक वर्गवारी (Category Breakdown)</span>
              <span className="text-[10px] font-normal text-slate-600 font-mono">एकूण खाती: {filteredAccounts.length}</span>
            </div>
            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                  <th className="border border-slate-900 py-1.5 px-2 text-center w-[5%]">अ.क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-left w-[35%]">संस्था / बँक</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-center w-[15%]">प्रकार (Type)</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-center w-[10%]">खाती संख्या</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-right w-[15%]">मूळ मुद्दल रक्कम ₹</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-right w-[10%]">संचित व्याज ₹</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-right w-[15%]">पुस्तकी मूल्य ₹</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((a, idx) => (
                  <tr key={a.investmentAccountID} className="hover:bg-slate-50 border-b border-slate-300">
                    <td className="border border-slate-900 py-1 px-2 text-center font-bold">{idx + 1}</td>
                    <td className="border border-slate-900 py-1 px-3 font-bold text-slate-900">{a.institutionName || 'बँक / संस्था'}</td>
                    <td className="border border-slate-900 py-1 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        a.investmentType === 'Share' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {a.investmentType === 'Share' ? 'शेअर्स (Share)' : 'ठेव (Deposit)'}
                      </span>
                    </td>
                    <td className="border border-slate-900 py-1 px-3 text-center font-mono font-bold">1</td>
                    <td className="border border-slate-900 py-1 px-3 text-right font-mono font-bold cbs-num-cell">₹{formatCurrency(a.principalAmount)}</td>
                    <td className="border border-slate-900 py-1 px-3 text-right font-mono text-emerald-800 cbs-num-cell">₹{formatCurrency(a.accruedInterest)}</td>
                    <td className="border border-slate-900 py-1 px-3 text-right font-mono font-bold text-primary cbs-num-cell">₹{formatCurrency(a.bookValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 font-extrabold text-xs border-t-2 border-slate-900 text-slate-950">
                  <td colSpan={3} className="border border-slate-900 py-2 px-3 text-right">एकूण बेरीज (Total):</td>
                  <td className="border border-slate-900 py-2 px-3 text-center font-mono font-bold">{filteredAccounts.length}</td>
                  <td className="border border-slate-900 py-2 px-3 text-right font-mono font-black cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.principalAmount, 0))}</td>
                  <td className="border border-slate-900 py-2 px-3 text-right font-mono font-bold text-emerald-900 cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.accruedInterest, 0))}</td>
                  <td className="border border-slate-900 py-2 px-3 text-right font-mono font-black text-primary cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.bookValue, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. Register List Tab (गुंतवणूक नोंदवही - CBS Standard Format) */}
      {activeReport === 'list' && (
        <div className="overflow-x-auto">
          <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">खाते / पावती क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">बँक / संस्था</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-left">योजना</th>
                <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center">गुंतवणूक दि.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-right">मुद्दल रक्कम (₹)</th>
                <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">व्याजदर</th>
                <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center">मुदतपूर्ती दि.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-right">अपेक्षित रक्कम (₹)</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-right">पुस्तकी मूल्य (₹)</th>
                <th className="border border-slate-900 py-1.5 px-1 w-[5%] text-center">स्थिती</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 font-bold border border-slate-900">
                    डेटा लोड होत आहे...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 font-bold border border-slate-900">
                    कोणताही डेटा सापडला नाही.
                  </td>
                </tr>
              ) : (
                (() => {
                  let globalIdx = 0;
                  return Object.entries(groupedByScheme).map(([schemeName, schemeAccs]) => {
                    const schemePrincipal = schemeAccs.reduce((s, a) => s + (a.principalAmount || 0), 0);
                    const schemeExpected = schemeAccs.reduce((s, a) => s + (a.expectedMaturityAmount || 0), 0);
                    const schemeBookValue = schemeAccs.reduce((s, a) => s + (a.bookValue || 0), 0);

                    return (
                      <React.Fragment key={schemeName}>
                        {/* Scheme Group Header Row */}
                        <tr className="bg-slate-100 font-bold border-t-2 border-b border-slate-900 text-slate-900">
                          <td colSpan={11} className="border border-slate-900 py-1.5 px-2 bg-slate-100">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-primary flex items-center gap-1">
                                  <span>📁 योजना:</span>
                                  <span className="font-serif font-black underline underline-offset-2 text-slate-900">{schemeName}</span>
                                </span>
                                <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.2 rounded-full border border-slate-400 font-mono">
                                  {schemeAccs.length} खाती
                                </span>
                              </div>
                              <div className="text-[10.5px] font-bold text-slate-800">
                                <span>एकूण मुद्दल: </span>
                                <span className="font-mono text-slate-950 font-black">₹{formatCurrency(schemePrincipal)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Accounts Under This Scheme */}
                        {schemeAccs.map((a) => {
                          globalIdx++;
                          return (
                            <tr key={a.investmentAccountID} className="hover:bg-slate-50 border-b border-slate-300">
                              <td className="border border-slate-900 py-1 px-1 text-center font-bold text-slate-700">{globalIdx}</td>
                              <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-primary">
                                {a.investmentNo}
                                {a.certificateNo && <div className="text-[9px] text-gray-500 font-normal">पावती: {a.certificateNo}</div>}
                              </td>
                              <td className="border border-slate-900 py-1 px-1.5 font-semibold text-slate-900">{a.institutionName}</td>
                              <td className="border border-slate-900 py-1 px-1.5 text-slate-800 font-medium">{a.schemeName}</td>
                              <td className="border border-slate-900 py-1 px-1 text-center font-mono">{formatDate(a.investmentDate)}</td>
                              <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-bold text-slate-900 cbs-num-cell">
                                ₹{formatCurrency(a.principalAmount)}
                              </td>
                              <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold text-emerald-800">
                                {a.interestRate > 0 ? `${a.interestRate}%` : 'लाभांश'}
                              </td>
                              <td className="border border-slate-900 py-1 px-1 text-center font-mono">{formatDate(a.maturityDate)}</td>
                              <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-bold text-slate-900 cbs-num-cell">
                                ₹{formatCurrency(a.expectedMaturityAmount)}
                              </td>
                              <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-bold text-blue-900 cbs-num-cell">
                                ₹{formatCurrency(a.bookValue)}
                              </td>
                              <td className="border border-slate-900 py-1 px-1 text-center">
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  a.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {a.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Scheme Subtotal Row */}
                        <tr className="bg-slate-50 font-bold text-[10.5px] border-t border-b-2 border-slate-900 text-slate-900">
                          <td colSpan={5} className="border border-slate-900 py-1.5 px-2 text-right font-serif font-bold">
                            उप-एकूण ({schemeName}):
                          </td>
                          <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono font-bold cbs-num-cell">
                            ₹{formatCurrency(schemePrincipal)}
                          </td>
                          <td colSpan={2} className="border border-slate-900"></td>
                          <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono font-bold cbs-num-cell">
                            ₹{formatCurrency(schemeExpected)}
                          </td>
                          <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono font-bold text-primary cbs-num-cell">
                            ₹{formatCurrency(schemeBookValue)}
                          </td>
                          <td className="border border-slate-900"></td>
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </tbody>
            {filteredAccounts.length > 0 && (
              <tfoot>
                <tr className="bg-slate-200 font-extrabold border-t-2 border-slate-900 text-slate-950 text-xs">
                  <td colSpan={5} className="border border-slate-900 py-2 px-2 text-right uppercase tracking-wider font-extrabold font-serif">
                    एकूण सर्व योजनांची बेरीज (Grand Total):
                  </td>
                  <td className="border border-slate-900 py-2 px-1.5 text-right font-mono font-black cbs-num-cell">
                    ₹{formatCurrency(filteredAccounts.reduce((s, a) => s + (a.principalAmount || 0), 0))}
                  </td>
                  <td colSpan={2} className="border border-slate-900"></td>
                  <td className="border border-slate-900 py-2 px-1.5 text-right font-mono font-black cbs-num-cell">
                    ₹{formatCurrency(filteredAccounts.reduce((s, a) => s + (a.expectedMaturityAmount || 0), 0))}
                  </td>
                  <td className="border border-slate-900 py-2 px-1.5 text-right font-mono font-black text-primary cbs-num-cell">
                    ₹{formatCurrency(filteredAccounts.reduce((s, a) => s + (a.bookValue || 0), 0))}
                  </td>
                  <td className="border border-slate-900"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* 3. Maturity Due Report Tab */}
      {activeReport === 'maturityDue' && (
        <div className="space-y-3">
          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xs text-amber-900 text-xs font-bold flex items-center justify-between">
            <span>⏰ पुढील ३ महिन्यात मुदतपूर्ती होणाऱ्या गुंतवणूक खाती ({maturityDueAccounts.length})</span>
            <span>एकूण मुदतपूर्ती रक्कम: ₹{formatCurrency(maturityDueAccounts.reduce((s, a) => s + a.expectedMaturityAmount, 0))}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border border-slate-900 text-center font-bold">
                  <th className="border border-slate-900 py-1.5 px-2 w-[5%] text-center">#</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-center">खाते क्र. / पावती</th>
                  <th className="border border-slate-900 py-1.5 px-3 w-[25%] text-left">संस्था / बँक</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-right">मुद्दल ₹</th>
                  <th className="border border-slate-900 py-1.5 px-1 text-center w-[8%]">व्याजदर</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">मुदतपूर्ती तारीख</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">अपेक्षित मुदतपूर्ती रक्कम ₹</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[8%] text-center">उरलेले दिवस</th>
                </tr>
              </thead>
              <tbody>
                {maturityDueAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-bold border border-slate-900">
                      पुढील ३ महिन्यात कोणतीही मुदतपूर्ती नाही.
                    </td>
                  </tr>
                ) : (
                  maturityDueAccounts.map((a, idx) => {
                    const daysLeft = Math.ceil((new Date(a.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={a.investmentAccountID} className="hover:bg-amber-50/50 border-b border-slate-300">
                        <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                        <td className="border border-slate-900 py-1.5 px-2 text-center font-mono font-bold text-primary">{a.investmentNo}</td>
                        <td className="border border-slate-900 py-1.5 px-3 font-semibold">{a.institutionName}</td>
                        <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold cbs-num-cell">₹{formatCurrency(a.principalAmount)}</td>
                        <td className="border border-slate-900 py-1.5 px-1 text-center font-mono text-emerald-800 font-bold">{a.interestRate}%</td>
                        <td className="border border-slate-900 py-1.5 px-2 text-center font-mono font-bold text-amber-900">{formatDate(a.maturityDate)}</td>
                        <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-primary cbs-num-cell">₹{formatCurrency(a.expectedMaturityAmount)}</td>
                        <td className="border border-slate-900 py-1.5 px-2 text-center">
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
          <div className="p-2.5 bg-green-50 border border-green-300 rounded-xs text-green-900 text-xs font-bold flex items-center justify-between">
            <span>💰 गुंतवणूक संचित व्याज व येणे बाकी व्याज तपशील (Accrued & Receivable Interest)</span>
            <span>एकूण संचित व्याज: ₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.accruedInterest, 0))}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border border-slate-900 text-center font-bold">
                  <th className="border border-slate-900 py-1.5 px-2 w-[4%] text-center">#</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">खाते क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-3 w-[22%] text-left">संस्था / बँक</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">मुद्दल रक्कम ₹</th>
                  <th className="border border-slate-900 py-1.5 px-1 w-[7%] text-center">व्याजदर</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right">संचित व्याज ₹</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-right">प्राप्त व्याज ₹</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right">येणे व्याज ₹</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right">पुस्तकी मूल्य ₹</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((a, idx) => (
                  <tr key={a.investmentAccountID} className="hover:bg-green-50/50 border-b border-slate-300">
                    <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-center font-mono font-bold text-primary">{a.investmentNo}</td>
                    <td className="border border-slate-900 py-1.5 px-3 font-semibold">{a.institutionName}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold cbs-num-cell">₹{formatCurrency(a.principalAmount)}</td>
                    <td className="border border-slate-900 py-1.5 px-1 text-center font-mono text-emerald-800 font-bold">{a.interestRate > 0 ? `${a.interestRate}%` : 'लाभांश'}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-emerald-800 cbs-num-cell">₹{formatCurrency(a.accruedInterest)}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-blue-800 cbs-num-cell">₹{formatCurrency(a.receivedInterest)}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-amber-800 cbs-num-cell">₹{formatCurrency(a.interestReceivable)}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-primary cbs-num-cell">₹{formatCurrency(a.bookValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 font-extrabold text-xs border-t-2 border-slate-900 text-slate-950">
                  <td colSpan={3} className="border border-slate-900 py-2 px-2.5 text-right">एकूण बेरीज:</td>
                  <td className="border border-slate-900 py-2 px-2 text-right font-mono cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.principalAmount, 0))}</td>
                  <td className="border border-slate-900"></td>
                  <td className="border border-slate-900 py-2 px-2 text-right font-mono text-emerald-900 cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.accruedInterest, 0))}</td>
                  <td className="border border-slate-900 py-2 px-2 text-right font-mono text-blue-900 cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.receivedInterest, 0))}</td>
                  <td className="border border-slate-900 py-2 px-2 text-right font-mono text-amber-900 cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.interestReceivable, 0))}</td>
                  <td className="border border-slate-900 py-2 px-2 text-right font-mono text-primary cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.bookValue, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 5. Statutory Audit Schedule Tab (ऑडिट नमुना शेड्यूल) */}
      {activeReport === 'auditSchedule' && (
        <div className="space-y-4">
          <div className="p-2 bg-purple-50 border border-purple-300 rounded-xs text-purple-900 text-xs font-bold flex justify-between items-center">
            <span>🏛️ वैधानिक लेखापरीक्षण विवरणपत्र - गुंतवणूक शेड्यूल (Statutory Audit Schedule Statement of Investments)</span>
            <span className="text-[10px] bg-purple-200 text-purple-900 px-2 py-0.5 rounded font-mono font-bold">ऑडिट नमुना शेड्यूल</span>
          </div>

          {/* Section A: Share Investments */}
          <div className="border border-slate-900 rounded-xs overflow-hidden">
            <div className="bg-purple-100/90 px-3 py-1.5 border-b border-slate-900 font-bold text-xs text-purple-950">
              भाग अ: सहकारी व इतर संस्थांमधील शेअर्स गुंतवणूक (Shares in Co-operative & Other Institutions)
            </div>
            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 font-bold text-slate-900 border-b border-slate-900 text-center">
                  <th className="border border-slate-900 py-1.5 px-2 w-[5%]">अ.क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-left w-[35%]">संस्थेचे नाव</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center w-[15%]">शेअर दाखला / खाते क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center w-[12%]">खरेदी तारीख</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-right w-[11%]">दर्शनी मूल्य (₹)</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-right w-[11%]">लाभांश (₹)</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-right w-[11%]">पुस्तकी मूल्य (₹)</th>
                </tr>
              </thead>
              <tbody>
                {shareAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500 font-bold border border-slate-900">
                      शेअर्स मधील कोणतीही गुंतवणूक उपलब्ध नाही.
                    </td>
                  </tr>
                ) : (
                  shareAccounts.map((a, idx) => (
                    <tr key={a.investmentAccountID} className="hover:bg-purple-50/50 border-b border-slate-300">
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-900 py-1.5 px-3 font-semibold">{a.institutionName}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-mono">{a.investmentNo}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-mono">{formatDate(a.investmentDate)}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold cbs-num-cell">₹{formatCurrency(a.principalAmount)}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-purple-800 font-bold cbs-num-cell">₹{formatCurrency(a.receivedInterest)}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-primary cbs-num-cell">₹{formatCurrency(a.bookValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {shareAccounts.length > 0 && (
                <tfoot>
                  <tr className="bg-purple-100 font-bold text-xs border-t-2 border-slate-900 text-purple-950">
                    <td colSpan={4} className="border border-slate-900 py-1.5 px-2 text-right">एकूण शेअर्स बेरीज (Total Shares):</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono cbs-num-cell">₹{formatCurrency(shareAccounts.reduce((s, a) => s + a.principalAmount, 0))}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono cbs-num-cell">₹{formatCurrency(shareAccounts.reduce((s, a) => s + a.receivedInterest, 0))}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-primary cbs-num-cell">₹{formatCurrency(shareAccounts.reduce((s, a) => s + a.bookValue, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Section B: Term / Fixed Deposit Investments */}
          <div className="border border-slate-900 rounded-xs overflow-hidden">
            <div className="bg-blue-100/90 px-3 py-1.5 border-b border-slate-900 font-bold text-xs text-blue-950">
              भाग ब: बँकांमधील ठेवी गुंतवणूक (Term & Fixed Deposits with Banks)
            </div>
            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 font-bold text-slate-900 border-b border-slate-900 text-center">
                  <th className="border border-slate-900 py-1.5 px-2 w-[4%]">अ.क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-left w-[26%]">बँकेचे नाव</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center w-[14%]">पावती / खाते क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center w-[10%]">ठेव तारीख</th>
                  <th className="border border-slate-900 py-1.5 px-1 text-center w-[6%]">व्याजदर</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center w-[10%]">मुदतपूर्ती तारीख</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-right w-[10%]">ठेव मुद्दल ₹</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-right w-[10%]">संचित व्याज ₹</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-right w-[10%]">पुस्तकी मूल्य ₹</th>
                </tr>
              </thead>
              <tbody>
                {depositAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-slate-500 font-bold border border-slate-900">
                      ठेवींमधील कोणतीही गुंतवणूक उपलब्ध नाही.
                    </td>
                  </tr>
                ) : (
                  depositAccounts.map((a, idx) => (
                    <tr key={a.investmentAccountID} className="hover:bg-blue-50/50 border-b border-slate-300">
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-900 py-1.5 px-3 font-semibold">{a.institutionName}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-mono">{a.investmentNo}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-mono">{formatDate(a.investmentDate)}</td>
                      <td className="border border-slate-900 py-1.5 px-1 text-center font-mono text-emerald-800 font-bold">{a.interestRate}%</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-mono">{formatDate(a.maturityDate)}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold cbs-num-cell">₹{formatCurrency(a.principalAmount)}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-emerald-800 font-bold cbs-num-cell">₹{formatCurrency(a.accruedInterest)}</td>
                      <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-primary cbs-num-cell">₹{formatCurrency(a.bookValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {depositAccounts.length > 0 && (
                <tfoot>
                  <tr className="bg-blue-100 font-bold text-xs border-t-2 border-slate-900 text-blue-950">
                    <td colSpan={6} className="border border-slate-900 py-1.5 px-2 text-right">एकूण ठेवी बेरीज (Total Deposits):</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono cbs-num-cell">₹{formatCurrency(depositAccounts.reduce((s, a) => s + a.principalAmount, 0))}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-emerald-900 cbs-num-cell">₹{formatCurrency(depositAccounts.reduce((s, a) => s + a.accruedInterest, 0))}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-primary cbs-num-cell">₹{formatCurrency(depositAccounts.reduce((s, a) => s + a.bookValue, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Total Summary Certificate Statement */}
          <div className="p-3 bg-slate-50 border border-slate-900 rounded-xs space-y-1 text-xs">
            <div className="flex justify-between font-black text-slate-950">
              <span>सर्व प्रकारच्या गुंतवणुकीची एकत्रित एकूण शिल्लक (Grand Total Investments & Book Value):</span>
              <span className="text-primary font-mono text-sm">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.bookValue, 0))}</span>
            </div>
            <p className="text-[10.5px] text-slate-700 font-medium pt-1">
              प्रमाणित करण्यात येते की, वरील सर्व शेअर्स व ठेवी मधील गुंतवणुकीच्या पावत्या व प्रमाणपत्रे संस्थेच्या सुरक्षित ताब्यात असून पुस्तकी मूल्याशी जुळतात.
            </p>
          </div>
        </div>
      )}
    </CbsReportLayout>
  );
};

export default InvestmentReports;
