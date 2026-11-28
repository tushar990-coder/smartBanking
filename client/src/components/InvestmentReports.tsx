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
  FileSpreadsheet,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CbsReportLayout, { CbsPaperSize, CbsSignatureTier } from './common/CbsReportLayout';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';

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
  reversedPostingInterest?: number;
  clawbackAmount?: number;
  reversalMode?: string | null;
  bookValue: number;
  status: string;
}

interface InvestmentRenewedRow {
  renewalID: number;
  renewalDate: string;
  renewalType: string;
  branchID: number;
  branchName: string;
  investmentInstitutionID: number;
  institutionName: string;
  oldInvestmentAccountID: number;
  oldInvestmentNo: string;
  oldDepositReceiptNo?: string;
  oldLegacyInvestmentNo?: string;
  oldSchemeID: number;
  oldSchemeName: string;
  oldInvestmentDate: string;
  oldMaturityDate: string;
  oldPrincipalAmount: number;
  oldInterestRate: number;
  reinvestedInterest: number;
  principalRefunded: number;
  netInterestReceived: number;
  totalCashOrBankReceived: number;
  tdsAmount: number;
  grossRenewalInterest: number;
  receiptModeLabel: string;
  newInvestmentAccountID: number;
  newInvestmentNo: string;
  newDepositReceiptNo?: string;
  newLegacyInvestmentNo?: string;
  newSchemeID: number;
  newSchemeName: string;
  newInvestmentDate: string;
  newPrincipalAmount: number;
  newInterestRate: number;
  newMaturityDate: string;
  newExpectedMaturityAmount: number;
  newBookValue: number;
  newStatus: string;
  voucherID?: number;
  voucherNo?: string;
  passingStatus?: string;
}

const InvestmentReports: React.FC = () => {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | ''>('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paperSize, setPaperSize] = useState<CbsPaperSize>('a4-landscape');
  const [signatureTier, setSignatureTier] = useState<CbsSignatureTier>('3-tier');

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const initialBranchId = typeof effectiveBranch === 'number' && effectiveBranch > 0 ? effectiveBranch : (isHOUser ? 0 : (user?.branchID || 1));
  const [selectedBranch, setSelectedBranch] = useState<number>(initialBranchId);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const getLocalTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const initialBizStr = user?.businessDate ? user.businessDate.split('T')[0] : getLocalTodayStr();
  const [renewedData, setRenewedData] = useState<InvestmentRenewedRow[]>([]);
  const [renewalAllDates, setRenewalAllDates] = useState<boolean>(true);
  const [fromDate, setFromDate] = useState<string>(() => `${initialBizStr.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState<string>(() => initialBizStr);
  const [renewalTypeFilter, setRenewalTypeFilter] = useState<string>('ALL');
  const [renewalPassingFilter, setRenewalPassingFilter] = useState<string>('ALL');
  const [renewalColumnMode, setRenewalColumnMode] = useState<'compact' | 'full'>('compact');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const parseActiveReport = (): 'summary' | 'list' | 'maturityDue' | 'accrued' | 'auditSchedule' | 'renewed' => {
    const params = new URLSearchParams(window.location.search);
    const fullTab = params.get('tab') || '';
    let rep = params.get('reportType');
    if (!rep && fullTab.includes('reportType=')) {
      rep = fullTab.split('reportType=')[1] || '';
    }
    const cleanRep = (rep || '').split('&')[0].trim();
    if (
      cleanRep === 'list' ||
      cleanRep === 'maturityDue' ||
      cleanRep === 'accrued' ||
      cleanRep === 'auditSchedule' ||
      cleanRep === 'renewed'
    ) {
      return cleanRep;
    }
    return 'summary';
  };

  const [activeReport, setActiveReport] = useState<
    'summary' | 'list' | 'maturityDue' | 'accrued' | 'auditSchedule' | 'renewed'
  >(parseActiveReport);

  const handleReportTypeChange = (nextRep: 'summary' | 'list' | 'maturityDue' | 'accrued' | 'auditSchedule' | 'renewed') => {
    setActiveReport(nextRep);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('reportType', nextRep);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

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
    if (activeReport === 'renewed') {
      fetchRenewedInvestments();
    } else {
      fetchAccounts();
      fetchDashboard();
    }
  }, [activeReport, selectedBranch, statusFilter, typeFilter, selectedSchemeId, renewalAllDates, fromDate, toDate, renewalTypeFilter, renewalPassingFilter]);

  const fetchRenewedInvestments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/Reports/investment-renewed`, {
        params: {
          branchID: selectedBranch > 0 ? selectedBranch : undefined,
          schemeID: selectedSchemeId ? Number(selectedSchemeId) : undefined,
          fromDate: renewalAllDates ? undefined : (fromDate || undefined),
          toDate: renewalAllDates ? undefined : (toDate || undefined),
          renewalType: renewalTypeFilter !== 'ALL' ? renewalTypeFilter : undefined,
          passingStatus: renewalPassingFilter !== 'ALL' ? renewalPassingFilter : undefined
        }
      });
      setRenewedData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching renewed investments report', err);
      setRenewedData([]);
    } finally {
      setLoading(false);
    }
  };

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

  const filteredRenewedData = renewedData.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (row.institutionName && row.institutionName.toLowerCase().includes(term)) ||
      (row.oldDepositReceiptNo && row.oldDepositReceiptNo.toLowerCase().includes(term)) ||
      (row.oldLegacyInvestmentNo && row.oldLegacyInvestmentNo.toLowerCase().includes(term)) ||
      (row.oldInvestmentNo && row.oldInvestmentNo.toLowerCase().includes(term)) ||
      (row.newDepositReceiptNo && row.newDepositReceiptNo.toLowerCase().includes(term)) ||
      (row.newLegacyInvestmentNo && row.newLegacyInvestmentNo.toLowerCase().includes(term)) ||
      (row.newInvestmentNo && row.newInvestmentNo.toLowerCase().includes(term)) ||
      (row.voucherNo && row.voucherNo.toLowerCase().includes(term)) ||
      (row.oldSchemeName && row.oldSchemeName.toLowerCase().includes(term)) ||
      (row.newSchemeName && row.newSchemeName.toLowerCase().includes(term))
    );
  });

  const totalRenewedOldPrincipal = filteredRenewedData.reduce((s, r) => s + (r.oldPrincipalAmount || 0), 0);
  const totalRenewedReinvestedInt = filteredRenewedData.reduce((s, r) => s + (r.reinvestedInterest || 0), 0);
  const totalRenewedNetReceived = filteredRenewedData.reduce((s, r) => s + (r.totalCashOrBankReceived || 0), 0);
  const totalRenewedTds = filteredRenewedData.reduce((s, r) => s + (r.tdsAmount || 0), 0);
  const totalRenewedNewPrincipal = filteredRenewedData.reduce((s, r) => s + (r.newPrincipalAmount || 0), 0);
  const totalRenewedExpectedMaturity = filteredRenewedData.reduce((s, r) => s + (r.newExpectedMaturityAmount || 0), 0);

  const handleExportExcel = () => {
    if (activeReport === 'renewed') {
      if (filteredRenewedData.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
      const rows = filteredRenewedData.map((r, idx) => ({
        'अनु.': idx + 1,
        'नूतनीकरण दिनांक': formatDate(r.renewalDate),
        'व्हाउचर क्र.': r.voucherNo || '-',
        'गुंतवणूक बँक / संस्था': r.institutionName,
        'जुनी पावती क्र.': r.oldDepositReceiptNo || r.oldLegacyInvestmentNo || '-',
        'जुना CBS खाते क्र.': r.oldInvestmentNo,
        'जुनी योजना': r.oldSchemeName,
        'जुनी मुदत तारीख': formatDate(r.oldMaturityDate),
        'जुनी मुद्दल (₹)': r.oldPrincipalAmount || 0,
        'नूतनीकरण प्रकार': r.renewalType === 'PrincipalOnly' ? 'फक्त मुद्दल' : 'मुद्दल + व्याज',
        'ठेवीत जमा व्याज (₹)': r.reinvestedInterest || 0,
        'प्राप्त व्याज / परतावा (₹)': r.totalCashOrBankReceived || 0,
        'TDS कपात (₹)': r.tdsAmount || 0,
        'जमा पद्धत': r.receiptModeLabel || '-',
        'नवीन पावती क्र.': r.newDepositReceiptNo || r.newLegacyInvestmentNo || '-',
        'नवीन CBS खाते क्र.': r.newInvestmentNo,
        'नवीन योजना': r.newSchemeName,
        'नवीन व्याजदर (%)': r.newInterestRate,
        'नवीन मुद्दल (₹)': r.newPrincipalAmount || 0,
        'नवीन मुदतपूर्ती तारीख': formatDate(r.newMaturityDate),
        'अपेक्षित मुदतपूर्ती रक्कम (₹)': r.newExpectedMaturityAmount || 0,
        'पासिंग स्थिती': r.passingStatus === 'Pending' ? 'प्रलंबित' : 'मंजूर'
      }));
      rows.push({
        'अनु.': '' as any,
        'नूतनीकरण दिनांक': '',
        'व्हाउचर क्र.': '',
        'गुंतवणूक बँक / संस्था': `एकूण नूतनीकृत गुंतवणुका: ${filteredRenewedData.length}`,
        'जुनी पावती क्र.': '',
        'जुना CBS खाते क्र.': '',
        'जुनी योजना': '',
        'जुनी मुदत तारीख': 'एकूण (TOTAL):',
        'जुनी मुद्दल (₹)': totalRenewedOldPrincipal,
        'नूतनीकरण प्रकार': '',
        'ठेवीत जमा व्याज (₹)': totalRenewedReinvestedInt,
        'प्राप्त व्याज / परतावा (₹)': totalRenewedNetReceived,
        'TDS कपात (₹)': totalRenewedTds,
        'जमा पद्धत': '',
        'नवीन पावती क्र.': '',
        'नवीन CBS खाते क्र.': '',
        'नवीन योजना': '',
        'नवीन व्याजदर (%)': '' as any,
        'नवीन मुद्दल (₹)': totalRenewedNewPrincipal,
        'नवीन मुदतपूर्ती तारीख': '',
        'अपेक्षित मुदतपूर्ती रक्कम (₹)': totalRenewedExpectedMaturity,
        'पासिंग स्थिती': ''
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'RenewedInvestments');
      XLSX.writeFile(wb, `Investment_Renewed_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

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
        'प्राप्त व्याज ₹': a.receivedInterest || 0,
        'येणे व्याज ₹': a.status === 'Active' ? (a.interestReceivable || 0) : 0,
        'रिव्हर्स पोस्टिंग व्याज ₹': a.reversedPostingInterest || 0,
        'व्याज कपात (Clawback) ₹': a.clawbackAmount || 0,
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
      case 'renewed':
        return {
          title: 'गुंतवणूक नूतनीकरण अहवाल (Renewed Investments)',
          subtitle: 'Renewed Institutional Investments Register (Old Receipt -> New Receipt)'
        };
      case 'summary':
      default:
        return {
          title: 'गुंतवणूक पोर्टफोलिओ व पुस्तकी मूल्य सारांश',
          subtitle: 'Investment Portfolio & Book Value Summary'
        };
    }
  })();

  const summaryBanner =
    activeReport === 'renewed' ? (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
        <div className="border-r border-slate-300 pr-2 flex items-center justify-between gap-1">
          <div>
            <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">नूतनीकृत गुंतवणुका</span>
            <strong className="text-primary font-mono text-[11.5px]">{filteredRenewedData.length} पावत्या</strong>
          </div>
          <span className="text-[9.5px] text-slate-600 font-mono">
            जमा:{filteredRenewedData.filter((r) => r.renewalType !== 'PrincipalOnly').length} | मुद्दल:{filteredRenewedData.filter((r) => r.renewalType === 'PrincipalOnly').length}
          </span>
        </div>
        <div className="border-r border-slate-300 pr-2">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">जुनी मुद्दल एकूण</span>
          <strong className="text-slate-900 font-mono text-[11.5px]">₹{formatCurrency(totalRenewedOldPrincipal)}</strong>
        </div>
        <div className="border-r border-slate-300 pr-2">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">जमा व्याज / प्राप्त / TDS</span>
          <strong className="text-amber-800 font-mono text-[11px]">
            ₹{formatCurrency(totalRenewedReinvestedInt)} / <span className="text-[#9A3412]">₹{formatCurrency(totalRenewedNetReceived)}</span> / <span className="text-rose-700">₹{formatCurrency(totalRenewedTds)}</span>
          </strong>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">नवीन मुद्दल / मुदतपूर्ती</span>
          <strong className="text-emerald-800 font-mono text-[11.5px]">
            ₹{formatCurrency(totalRenewedNewPrincipal)} / <span className="text-[#5A1A14]">₹{formatCurrency(totalRenewedExpectedMaturity)}</span>
          </strong>
        </div>
      </div>
    ) : (
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
          <strong className="text-[#5A1A14] font-mono text-xs">
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
        onChange={(e: any) => handleReportTypeChange(e.target.value)}
        className="h-6 border border-gray-300 rounded px-1.5 text-[11px] font-bold bg-white text-primary focus:outline-none focus:border-primary"
      >
        <option value="summary">१. पोर्टफोलिओ सारांश</option>
        <option value="list">२. गुंतवणूक नोंदवही</option>
        <option value="maturityDue">३. मुदतपूर्ती देय पत्रक</option>
        <option value="accrued">४. संचित व येणे व्याज</option>
        <option value="auditSchedule">५. ऑडिट नमुना तक्ता</option>
        <option value="renewed">६. गुंतवणूक नूतनीकरण अहवाल</option>
      </select>

      {/* Branch */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600">शाखा:</label>
        <select
          value={selectedBranch}
          disabled={!isHOUser}
          onChange={(e) => setSelectedBranch(parseInt(e.target.value))}
          className="h-6 border border-gray-300 rounded px-1 text-[10.5px] bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-600"
        >
          {isHOUser && <option value={0}>सर्व शाखा (All)</option>}
          {(isHOUser || !lockedBranchId ? branches : branches.filter((b: any) => Number(b.branchID) === Number(lockedBranchId))).map((b: any) => (
            <option key={b.branchID} value={b.branchID}>
              {b.branchName}
            </option>
          ))}
        </select>
      </div>

      {/* Type (non-renewed tabs) */}
      {activeReport !== 'renewed' && (
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-6 border border-gray-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
        >
          <option value="">सर्व प्रकार (ठेव/शेअर)</option>
          <option value="Deposit">ठेव गुंतवणूक (Deposit)</option>
          <option value="Share">शेअर गुंतवणूक (Share)</option>
        </select>
      )}

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

      {/* Dedicated Renewed Filters */}
      {activeReport === 'renewed' && (
        <>
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
            <label
              className={`flex items-center gap-1 pr-1.5 mr-0.5 border-r border-slate-300 text-[10.5px] font-bold cursor-pointer select-none ${
                renewalAllDates ? 'text-primary' : 'text-slate-600'
              }`}
              title="आजवर नूतनीकरण झालेल्या सर्व गुंतवणुका दाखवा"
            >
              <input
                type="checkbox"
                checked={renewalAllDates}
                onChange={(e) => setRenewalAllDates(e.target.checked)}
                className="w-3 h-3 accent-primary cursor-pointer rounded-xs"
              />
              <span>सर्व तारखा</span>
            </label>
            <Calendar className="w-3 h-3 text-slate-500" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={renewalAllDates}
              className={`h-5 text-[10.5px] font-mono border-none bg-transparent focus:ring-0 p-0 font-bold w-24 ${
                renewalAllDates ? 'text-slate-400 cursor-not-allowed opacity-50' : 'text-slate-800'
              }`}
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={renewalAllDates}
              className={`h-5 text-[10.5px] font-mono border-none bg-transparent focus:ring-0 p-0 font-bold w-24 ${
                renewalAllDates ? 'text-slate-400 cursor-not-allowed opacity-50' : 'text-slate-800'
              }`}
            />
          </div>

          <select
            value={renewalTypeFilter}
            onChange={(e) => setRenewalTypeFilter(e.target.value)}
            className="h-6 border border-gray-300 rounded px-1 text-[10.5px] bg-white text-slate-800 font-semibold"
          >
            <option value="ALL">सर्व प्रकार</option>
            <option value="PrincipalAndInterest">मुद्दल + व्याज</option>
            <option value="PrincipalOnly">फक्त मुद्दल</option>
          </select>

          <select
            value={renewalPassingFilter}
            onChange={(e) => setRenewalPassingFilter(e.target.value)}
            className="h-6 border border-gray-300 rounded px-1 text-[10.5px] bg-white text-slate-800 font-semibold"
          >
            <option value="ALL">सर्व पासिंग</option>
            <option value="Approved">मंजूर</option>
            <option value="Pending">प्रलंबित</option>
          </select>

          <div
            className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300"
            title="सुटसुटीत (१६ रकाने - A4 प्रिंटसाठी) किंवा संपूर्ण (२२ स्वतंत्र रकाने)"
          >
            <button
              type="button"
              onClick={() => setRenewalColumnMode('compact')}
              className={`px-1.5 py-0.5 rounded-xs font-bold text-[10px] cursor-pointer transition-colors ${
                renewalColumnMode === 'compact'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              सुटसुटीत (१६)
            </button>
            <button
              type="button"
              onClick={() => setRenewalColumnMode('full')}
              className={`px-1.5 py-0.5 rounded-xs font-bold text-[10px] cursor-pointer transition-colors ${
                renewalColumnMode === 'full'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              संपूर्ण (२२ रकाने)
            </button>
          </div>

          <div className="relative w-36 sm:w-44">
            <Search className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="बँक / पावती / क्र. शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-5 pr-1.5 py-0.5 h-6 border border-slate-300 rounded text-[10.5px] focus:outline-none focus:border-primary bg-white"
            />
          </div>
        </>
      )}

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
          if (activeReport === 'renewed') {
            fetchRenewedInvestments();
          } else {
            fetchAccounts();
            fetchDashboard();
          }
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
      periodText={
        activeReport === 'renewed'
          ? renewalAllDates
            ? 'संपूर्ण कालावधी (नूतनीकृत गुंतवणुका)'
            : `कालावधी: ${formatDate(fromDate)} ते ${formatDate(toDate)}`
          : `दिनांक: ${new Date().toLocaleDateString('en-GB')}`
      }
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
      hasData={activeReport === 'renewed' ? filteredRenewedData.length > 0 : (filteredAccounts.length > 0 || activeReport === 'summary')}
      preparedBy="Admin"
    >
      {/* 1. Summary Report Tab */}
      {activeReport === 'summary' && (
        <div className="space-y-4">
          {dashboard && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-[#FDF2EE] to-[#FCE3BE]/80 border border-amber-200 rounded-sm p-3 shadow-2xs">
                <p className="text-[10px] text-[#9A3412] font-bold uppercase">एकूण सक्रिय गुंतवणूक (Active Investments)</p>
                <p className="text-xl font-black text-[#5A1A14] mt-1">{dashboard.totalActiveAccounts} <span className="text-xs font-normal">खाती</span></p>
                <p className="text-xs font-bold text-[#7C2418] mt-0.5">₹{formatCurrency(dashboard.totalInvestment)}</p>
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
                        a.investmentType === 'Share' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-[#7C2418]'
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
                              <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-bold text-[#5A1A14] cbs-num-cell">
                                ₹{formatCurrency(a.bookValue)}
                              </td>
                              <td className="border border-slate-900 py-1 px-1 text-center">
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  a.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-[#7C2418]'
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
                    <td className="border border-slate-900 py-1.5 px-2 text-center font-mono font-bold text-primary">
                      {a.investmentNo}
                      {a.status !== 'Active' && (
                        <div className="text-[9px] font-sans font-bold text-slate-600">{a.status}</div>
                      )}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-3 font-semibold">{a.institutionName}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold cbs-num-cell">₹{formatCurrency(a.principalAmount)}</td>
                    <td className="border border-slate-900 py-1.5 px-1 text-center font-mono text-emerald-800 font-bold">{a.interestRate > 0 ? `${a.interestRate}%` : 'लाभांश'}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-emerald-800 cbs-num-cell">₹{formatCurrency(a.accruedInterest)}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-[#7C2418] cbs-num-cell">₹{formatCurrency(a.receivedInterest)}</td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-amber-800 cbs-num-cell">
                      <div>₹{formatCurrency(a.status === 'Active' ? a.interestReceivable : 0)}</div>
                      {(a.reversedPostingInterest || 0) > 0 && (
                        <div className="text-[9px] font-sans font-bold text-rose-700">
                          रिव्हर्सल: ₹{formatCurrency(a.reversedPostingInterest || 0)}
                        </div>
                      )}
                      {(a.clawbackAmount || 0) > 0 && (
                        <div className="text-[9px] font-sans font-bold text-orange-700">
                          कपात: ₹{formatCurrency(a.clawbackAmount || 0)}
                        </div>
                      )}
                    </td>
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
                  <td className="border border-slate-900 py-2 px-2 text-right font-mono text-[#5A1A14] cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + a.receivedInterest, 0))}</td>
                  <td className="border border-slate-900 py-2 px-2 text-right font-mono text-amber-900 cbs-num-cell">₹{formatCurrency(filteredAccounts.reduce((s, a) => s + (a.status === 'Active' ? a.interestReceivable : 0), 0))}</td>
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
            <div className="bg-amber-100/90 px-3 py-1.5 border-b border-slate-900 font-bold text-xs text-[#4A1410]">
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
                    <tr key={a.investmentAccountID} className="hover:bg-amber-50/50 border-b border-slate-300">
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
                  <tr className="bg-amber-100 font-bold text-xs border-t-2 border-slate-900 text-[#4A1410]">
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

      {/* 6. Renewed Investments Report Tab (६. गुंतवणूक नूतनीकरण अहवाल — Strict Single-Line Multi-Column Grid) */}
      {activeReport === 'renewed' && (() => {
        const isFull = renewalColumnMode === 'full';
        return (
          <div className="overflow-x-auto">
            <table className="cbs-table w-full border-collapse border border-slate-900 text-[10.5px]">
              <thead>
                <tr className="text-center font-extrabold text-[10px] border-b border-slate-900">
                  <th colSpan={isFull ? 4 : 3} className="border border-slate-900 py-1 px-1.5 bg-slate-100 text-slate-900">
                    मूळ व संस्था माहिती
                  </th>
                  <th colSpan={isFull ? 5 : 3} className="border border-slate-900 py-1 px-1.5 bg-amber-50 text-amber-950 border-l-2 border-l-slate-900">
                    जुनी गुंतवणूक पावती (Old Investment)
                  </th>
                  <th colSpan={isFull ? 5 : 4} className="border border-slate-900 py-1 px-1.5 bg-orange-50 text-[#4A1410] border-l-2 border-l-slate-900">
                    व्याज व TDS समायोजन (Interest &amp; TDS)
                  </th>
                  <th colSpan={isFull ? 6 : 4} className="border border-slate-900 py-1 px-1.5 bg-emerald-50 text-emerald-950 border-l-2 border-l-slate-900">
                    नवीन नूतनीकृत गुंतवणूक (New Investment)
                  </th>
                  <th colSpan={2} className="border border-slate-900 py-1 px-1.5 bg-slate-100 text-slate-900 border-l-2 border-l-slate-900">
                    अखेर व पासिंग
                  </th>
                </tr>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold text-[10px] whitespace-nowrap">
                  <th className="border border-slate-900 py-1 px-1">#</th>
                  <th className="border border-slate-900 py-1 px-1.5">नूतनीकरण दि.</th>
                  {isFull && <th className="border border-slate-900 py-1 px-1.5">व्हाउचर क्र.</th>}
                  <th className="border border-slate-900 py-1 px-2 text-left">गुंतवणूक बँक / संस्था</th>

                  <th className="border border-slate-900 py-1 px-1.5 bg-amber-50/60 border-l-2 border-l-slate-900">जुनी पावती क्र.</th>
                  {isFull && <th className="border border-slate-900 py-1 px-1.5 bg-amber-50/60">जुना CBS खाते क्र.</th>}
                  {isFull && <th className="border border-slate-900 py-1 px-1.5 bg-amber-50/60 text-left">जुनी योजना</th>}
                  <th className="border border-slate-900 py-1 px-1.5 bg-amber-50/60">जुनी मुदत दि.</th>
                  <th className="border border-slate-900 py-1 px-1.5 bg-amber-50/60 text-right">जुनी मुद्दल (₹)</th>

                  <th className="border border-slate-900 py-1 px-1.5 bg-orange-50/50 border-l-2 border-l-slate-900">नूतनीकरण प्रकार</th>
                  <th className="border border-slate-900 py-1 px-1.5 bg-orange-50/50 text-right">जमा व्याज (₹)</th>
                  <th className="border border-slate-900 py-1 px-1.5 bg-orange-50/50 text-right">प्राप्त व्याज/परतावा (₹)</th>
                  <th className="border border-slate-900 py-1 px-1.5 bg-orange-50/50 text-right">TDS (₹)</th>
                  {isFull && <th className="border border-slate-900 py-1 px-1.5 bg-orange-50/50">जमा पद्धत</th>}

                  <th className="border border-slate-900 py-1 px-1.5 bg-emerald-50/50 border-l-2 border-l-slate-900">नवीन पावती क्र.</th>
                  {isFull && <th className="border border-slate-900 py-1 px-1.5 bg-emerald-50/50">नवीन CBS खाते क्र.</th>}
                  {isFull && <th className="border border-slate-900 py-1 px-1.5 bg-emerald-50/50 text-left">नवीन योजना</th>}
                  <th className="border border-slate-900 py-1 px-1.5 bg-emerald-50/50">दर %</th>
                  <th className="border border-slate-900 py-1 px-1.5 bg-emerald-50/50 text-right">नवीन मुद्दल (₹)</th>
                  <th className="border border-slate-900 py-1 px-1.5 bg-emerald-50/50">नवीन मुदत दि.</th>

                  <th className="border border-slate-900 py-1 px-1.5 text-right border-l-2 border-l-slate-900">अपेक्षित मुदतपूर्ती (₹)</th>
                  <th className="border border-slate-900 py-1 px-1">पासिंग</th>
                </tr>
              </thead>
              <tbody>
                {filteredRenewedData.map((row, idx) => {
                  const oldRec = row.oldDepositReceiptNo || row.oldLegacyInvestmentNo || row.oldInvestmentNo;
                  const newRec = row.newDepositReceiptNo || row.newLegacyInvestmentNo || row.newInvestmentNo;
                  const isPrincipalOnly = row.renewalType === 'PrincipalOnly';
                  return (
                    <tr
                      key={`inv-ren-${row.renewalID}-${idx}`}
                      className="h-6 hover:bg-slate-50 text-slate-900 text-[10.5px] leading-tight whitespace-nowrap"
                    >
                      <td className="border border-slate-900 py-0.5 px-1 text-center font-mono text-slate-700">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono font-semibold">
                        {formatDate(row.renewalDate)}
                      </td>
                      {isFull && (
                        <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono text-[10px] text-slate-700 max-w-[140px] truncate" title={row.voucherNo}>
                          {row.voucherNo || '-'}
                        </td>
                      )}
                      <td
                        className="border border-slate-900 py-0.5 px-2 font-semibold text-slate-950 max-w-[180px] truncate"
                        title={`${row.institutionName} | ${row.newSchemeName}`}
                      >
                        {row.institutionName}
                      </td>

                      <td
                        className="border border-slate-900 py-0.5 px-1.5 text-center font-mono font-bold text-amber-900 border-l-2 border-l-slate-900"
                        title={`जुना CBS क्र.: ${row.oldInvestmentNo} | जुनी योजना: ${row.oldSchemeName} (${row.oldInterestRate}%)`}
                      >
                        {oldRec}
                      </td>
                      {isFull && (
                        <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono text-[10px] text-slate-700">
                          {row.oldInvestmentNo}
                        </td>
                      )}
                      {isFull && (
                        <td className="border border-slate-900 py-0.5 px-1.5 text-left text-slate-700 max-w-[125px] truncate" title={row.oldSchemeName}>
                          {row.oldSchemeName}
                        </td>
                      )}
                      <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono text-slate-700">
                        {formatDate(row.oldMaturityDate)}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(row.oldPrincipalAmount)}
                      </td>

                      <td className="border border-slate-900 py-0.5 px-1.5 text-center border-l-2 border-l-slate-900">
                        <span
                          className={`inline-block px-1 py-0.2 rounded text-[9.5px] font-bold border ${
                            isPrincipalOnly
                              ? 'bg-amber-50 text-[#7C2418] border-amber-300'
                              : 'bg-orange-50 text-[#7C2418] border-amber-300'
                          }`}
                        >
                          {isPrincipalOnly ? 'फक्त मुद्दल' : 'मुद्दल+व्याज'}
                        </span>
                      </td>
                      <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-semibold text-amber-900">
                        {row.reinvestedInterest > 0 ? formatCurrency(row.reinvestedInterest) : '-'}
                      </td>
                      <td
                        className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-semibold text-[#7C2418]"
                        title={row.totalCashOrBankReceived > 0 ? `जमा पद्धत: ${row.receiptModeLabel}` : undefined}
                      >
                        {row.totalCashOrBankReceived > 0 ? formatCurrency(row.totalCashOrBankReceived) : '-'}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-semibold text-rose-800">
                        {row.tdsAmount > 0 ? formatCurrency(row.tdsAmount) : '-'}
                      </td>
                      {isFull && (
                        <td className="border border-slate-900 py-0.5 px-1.5 text-center text-[10px] text-slate-700">
                          {row.receiptModeLabel || '-'}
                        </td>
                      )}

                      <td
                        className="border border-slate-900 py-0.5 px-1.5 text-center font-mono font-bold text-emerald-900 border-l-2 border-l-slate-900"
                        title={`नवीन CBS क्र.: ${row.newInvestmentNo} | योजना: ${row.newSchemeName}`}
                      >
                        {newRec}
                      </td>
                      {isFull && (
                        <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono text-[10px] text-slate-800">
                          {row.newInvestmentNo}
                        </td>
                      )}
                      {isFull && (
                        <td className="border border-slate-900 py-0.5 px-1.5 text-left text-slate-800 max-w-[125px] truncate" title={row.newSchemeName}>
                          {row.newSchemeName}
                        </td>
                      )}
                      <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono text-[10px] text-slate-800">
                        {row.newInterestRate}%
                      </td>
                      <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-bold text-emerald-800">
                        {formatCurrency(row.newPrincipalAmount)}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-1.5 text-center font-mono text-slate-800">
                        {formatDate(row.newMaturityDate)}
                      </td>

                      <td className="border border-slate-900 py-0.5 px-1.5 text-right font-mono font-bold text-[#5A1A14] border-l-2 border-l-slate-900">
                        {formatCurrency(row.newExpectedMaturityAmount)}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-1 text-center">
                        <span
                          className={`inline-block px-1 py-0.2 rounded text-[9px] font-bold border ${
                            row.passingStatus === 'Pending'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}
                          title={row.voucherNo ? `व्हाउचर क्र.: ${row.voucherNo}` : undefined}
                        >
                          {row.passingStatus === 'Pending' ? 'प्रलंबित' : 'मंजूर'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredRenewedData.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-[10.5px] whitespace-nowrap">
                    <td colSpan={isFull ? 8 : 5} className="border border-slate-900 py-1 px-2 text-right uppercase">
                      एकूण नूतनीकृत गुंतवणूक बेरीज ({filteredRenewedData.length} पावत्या):
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-black text-slate-950 bg-amber-100/50">
                      ₹{formatCurrency(totalRenewedOldPrincipal)}
                    </td>
                    <td className="border border-slate-900 py-1 px-1 border-l-2 border-l-slate-900"></td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-black text-amber-950 bg-orange-100/40">
                      ₹{formatCurrency(totalRenewedReinvestedInt)}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-black text-[#4A1410] bg-orange-100/40">
                      ₹{formatCurrency(totalRenewedNetReceived)}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-black text-rose-950 bg-rose-100/40">
                      ₹{formatCurrency(totalRenewedTds)}
                    </td>
                    {isFull && <td className="border border-slate-900 py-1 px-1"></td>}
                    <td colSpan={isFull ? 4 : 2} className="border border-slate-900 py-1 px-1 border-l-2 border-l-slate-900"></td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                      ₹{formatCurrency(totalRenewedNewPrincipal)}
                    </td>
                    <td className="border border-slate-900 py-1 px-1"></td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-black text-[#4A1410] bg-amber-100/50 border-l-2 border-l-slate-900">
                      ₹{formatCurrency(totalRenewedExpectedMaturity)}
                    </td>
                    <td className="border border-slate-900 py-1 px-1"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        );
      })()}
    </CbsReportLayout>
  );
};

export default InvestmentReports;
