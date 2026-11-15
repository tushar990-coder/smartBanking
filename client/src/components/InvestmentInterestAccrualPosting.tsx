import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  Coins,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Search,
  BookOpen,
  Lock,
  Unlock,
  Calculator,
  Printer,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import VoucherPrint from './VoucherPrint';
import { useAuth } from '../context/AuthContext';
import { getLockedBranchId, isHeadOfficeUser, resolveWriteBranchId } from '../utils/branchAccess';

interface AccrualPreviewRow {
  investmentAccountID: number;
  branchID: number;
  branchName: string;
  investmentNo: string;
  institutionName: string;
  schemeID: number;
  schemeName: string;
  investmentDate: string;
  maturityDate: string;
  lastAccrualDate?: string | null;
  fromDate: string;
  toDate: string;
  elapsedDays: number;
  principalAmount: number;
  interestRate: number;
  calculationMethod: string;
  alreadyAccrued: boolean;
  calculatedInterest: number;
  hasValidMapping: boolean;
  mappingError?: string | null;
  isSelected: boolean;
}

const getLocalTodayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

const InvestmentInterestAccrualPosting: React.FC = () => {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const initialBranchId = isHOUser
    ? (globalBranchId && globalBranchId !== 'all' ? (parseInt(globalBranchId, 10) || 0) : 0)
    : resolveWriteBranchId(user, globalBranchId);

  const [branches, setBranches] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [accruals, setAccruals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'accrual' | 'receipt'>('accrual');
  const [receiptType, setReceiptType] = useState<'DepositInterest' | 'ShareDividend'>('DepositInterest');
  const [searchTerm, setSearchTerm] = useState('');
  const [allowDateOverride, setAllowDateOverride] = useState(false);
  const [printingVoucherId, setPrintingVoucherId] = useState<number | null>(null);
  const [previewRows, setPreviewRows] = useState<AccrualPreviewRow[]>([]);

  const API_URL = '/api';

  const getActiveBizDate = () => {
    if (user?.businessDate && user.businessDate.trim()) return user.businessDate.split('T')[0];
    return getLocalTodayStr();
  };

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<number>(initialBranchId);

  const [accrualForm, setAccrualForm] = useState({
    branchID: initialBranchId,
    accrualDate: getActiveBizDate(),
  });

  const [receiptForm, setReceiptForm] = useState({
    investmentAccountID: 0,
    receiptDate: getActiveBizDate(),
    grossAmount: 0,
    tdsAmount: 0,
    tdsLedgerID: 0,
    remarks: 'मुदत ठेव व्याज प्राप्ती',
    paymentMode: 'Bank',
    bankLedgerID: 0,
    referenceNo: '',
  });

  useEffect(() => {
    if (!isHOUser && user?.branchID) {
      setSelectedBranchFilter(user.branchID);
      setAccrualForm(prev => ({ ...prev, branchID: user.branchID! }));
    }
  }, [isHOUser, user?.branchID]);

  useEffect(() => {
    if (user?.businessDate && !allowDateOverride) {
      const bStr = getActiveBizDate();
      setAccrualForm(prev => ({ ...prev, accrualDate: bStr }));
      setReceiptForm(prev => ({ ...prev, receiptDate: bStr }));
    }
  }, [user?.businessDate, allowDateOverride]);

  useEffect(() => {
    fetchBranches();
    fetchLedgers();
  }, []);

  useEffect(() => {
    fetchAllData(selectedBranchFilter);
  }, [selectedBranchFilter]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/Branches`);
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const fetchLedgers = async () => {
    try {
      const res = await axios.get(`${API_URL}/Ledgers`);
      setLedgers(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const fetchAllData = async (branchFilter: number) => {
    setLoading(true);
    try {
      const branchQuery = branchFilter > 0 ? `?branchId=${branchFilter}` : '';
      const activeAccQuery = branchFilter > 0 ? `?status=Active&branchId=${branchFilter}` : '?status=Active';
      const [accRes, accrualRes, rcptRes, dashRes] = await Promise.all([
        axios.get(`${API_URL}/InvestmentAccounts${activeAccQuery}`),
        axios.get(`${API_URL}/InvestmentAccounts/Accruals${branchQuery}`),
        axios.get(`${API_URL}/InvestmentAccounts/Receipts${branchQuery}`),
        axios.get(`${API_URL}/InvestmentAccounts/Dashboard${branchQuery}`)
      ]);
      setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
      setAccruals(Array.isArray(accrualRes.data) ? accrualRes.data : []);
      setReceipts(Array.isArray(rcptRes.data) ? rcptRes.data : []);
      setDashboardStats(dashRes.data || null);
    } catch {
      setError('गुंतवणूक माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const ledgerOptions = useMemo(() => [
    { value: 0, label: '-- डायनॅमिक TDS जी.एल. लेजर निवडा --' },
    ...ledgers.map((l: any) => {
      const id = Number(l.ledgerID || l.LedgerID || 0);
      const code = l.ledgerCode || l.LedgerCode || id;
      const name = l.ledgerName || l.LedgerName || '';
      const grp = l.accountGroup?.groupName || (typeof l.accountGroup === 'string' ? l.accountGroup : '');
      return {
        value: id,
        label: `${code} - ${name}${grp ? ` (${grp})` : ''}`
      };
    })
  ], [ledgers]);

  const selectedReceiptAccount = useMemo(
    () => accounts.find((a: any) => Number(a.investmentAccountID) === Number(receiptForm.investmentAccountID)),
    [accounts, receiptForm.investmentAccountID]
  );

  // Accounts filtered cleanly by investmentType / durationMonths returned by backend
  const selectableAccounts = useMemo(() => {
    return accounts.filter((a: any) => {
      const isShare =
        String(a.investmentType || '').toLowerCase() === 'share' ||
        Number(a.durationMonths) === 0;
      return receiptType === 'ShareDividend' ? isShare : !isShare;
    });
  }, [accounts, receiptType]);

  const handleCalculatePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoadingPreview(true);
    setPreviewRows([]);

    try {
      const effectiveBranch = isHOUser ? accrualForm.branchID : (user?.branchID || 1);
      const res = await axios.post(`${API_URL}/InvestmentAccounts/CalculateAccrualPreview`, {
        branchID: effectiveBranch,
        accrualDate: accrualForm.accrualDate,
        allBranches: isHOUser && effectiveBranch === 0
      });
      const rows: AccrualPreviewRow[] = Array.isArray(res.data) ? res.data : [];
      setPreviewRows(rows);
      if (rows.length === 0) {
        setError('निवडलेल्या शाखेत / तारखेपर्यंत व्याज तरतुदीसाठी कोणतेही सक्रिय मुदत ठेव खाते सापडले नाही.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'व्याज गणना प्रिव्ह्यू आणताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoadingPreview(false);
    }
  };

  const togglePreviewSelect = (id: number) => {
    setPreviewRows(prev =>
      prev.map(r => (r.investmentAccountID === id ? { ...r, isSelected: !r.isSelected } : r))
    );
  };

  const toggleSelectAllPreview = (checked: boolean) => {
    setPreviewRows(prev =>
      prev.map(r => ({
        ...r,
        isSelected: checked && !r.alreadyAccrued && r.hasValidMapping && r.calculatedInterest > 0
      }))
    );
  };

  const updatePreviewAmount = (id: number, amount: number) => {
    setPreviewRows(prev =>
      prev.map(r =>
        r.investmentAccountID === id
          ? {
              ...r,
              calculatedInterest: amount,
              isSelected: !r.alreadyAccrued && r.hasValidMapping && amount > 0
            }
          : r
      )
    );
  };

  const handlePostSelectedAccruals = async () => {
    const selected = previewRows.filter(
      r => r.isSelected && !r.alreadyAccrued && r.hasValidMapping && Number(r.calculatedInterest) > 0
    );
    if (selected.length === 0) {
      setError('कृपया पोस्ट करण्यासाठी किमान एक वैध आणि शून्यपेक्षा जास्त रकमेचे खाते निवडा.');
      return;
    }

    const totalSelAmt = selected.reduce((sum, r) => sum + Number(r.calculatedInterest || 0), 0);
    if (!window.confirm(`निवडलेल्या ${selected.length} गुंतवणूक खात्यांसाठी एकूण ₹${formatCurrency(totalSelAmt)} व्याज तरतूद व्हाउचर तयार करायचे का?`)) {
      return;
    }

    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const effectiveBranch = isHOUser ? accrualForm.branchID : (user?.branchID || 1);
      const response = await axios.post(`${API_URL}/InvestmentAccounts/PostSelectedAccrual`, {
        branchID: effectiveBranch,
        accrualDate: accrualForm.accrualDate,
        allBranches: isHOUser && effectiveBranch === 0,
        selectedItems: selected.map(s => ({
          investmentAccountID: s.investmentAccountID,
          interestAmount: Number(s.calculatedInterest),
          elapsedDays: s.elapsedDays,
          fromDate: s.fromDate
        }))
      });
      setSuccess(
        `${response.data.message} (एकूण प्रक्रिया खाती: ${response.data.accountsProcessed}, एकूण संचित व्याज: ₹${formatCurrency(response.data.totalInterest)})`
      );
      setPreviewRows([]);
      await fetchAllData(selectedBranchFilter);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'व्याज तरतूद पोस्ट करताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleReceiptAccountChange = (accId: number) => {
    const found = accounts.find((a: any) => Number(a.investmentAccountID) === accId);
    const defaultTdsLedger = Number(found?.tdsLedgerID || 0);
    const hintedGross =
      receiptType === 'DepositInterest' && found && Number(found.interestReceivable) > 0
        ? Number(found.interestReceivable)
        : 0;

    setReceiptForm(prev => ({
      ...prev,
      investmentAccountID: accId,
      grossAmount: hintedGross,
      tdsAmount: 0,
      tdsLedgerID: defaultTdsLedger > 0 ? defaultTdsLedger : prev.tdsLedgerID
    }));
  };

  const netReceiptAmount = Math.max(
    0,
    Math.round(((Number(receiptForm.grossAmount) || 0) - (Number(receiptForm.tdsAmount) || 0)) * 100) / 100
  );

  const handleReceiptPosting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!receiptForm.investmentAccountID || Number(receiptForm.investmentAccountID) === 0) {
      setError('कृपया गुंतवणूक खाते निवडा.');
      return;
    }
    if ((Number(receiptForm.grossAmount) || 0) <= 0) {
      setError('कृपया मिळालेली एकूण व्याज / लाभांश रक्कम प्रविष्ट करा.');
      return;
    }
    if ((Number(receiptForm.tdsAmount) || 0) < 0) {
      setError('TDS कपात रक्कम ऋण (Negative) असू शकत नाही.');
      return;
    }
    if ((Number(receiptForm.tdsAmount) || 0) > (Number(receiptForm.grossAmount) || 0)) {
      setError('TDS कपात रक्कम एकूण रकमेपेक्षा जास्त असू शकत नाही.');
      return;
    }
    if ((Number(receiptForm.tdsAmount) || 0) > 0 && (!receiptForm.tdsLedgerID || Number(receiptForm.tdsLedgerID) <= 0)) {
      setError('TDS कपात रक्कम नोंदवण्यासाठी कृपया डायनॅमिक TDS जी.एल. लेजर निवडा.');
      return;
    }
    if (netReceiptAmount > 0 && receiptForm.paymentMode === 'Bank' && (!receiptForm.bankLedgerID || Number(receiptForm.bankLedgerID) <= 0)) {
      setError('बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`${API_URL}/InvestmentAccounts/InterestReceipt`, {
        investmentAccountID: Number(receiptForm.investmentAccountID),
        receiptDate: receiptForm.receiptDate,
        receiptType,
        grossAmount: Number(receiptForm.grossAmount),
        tdsAmount: Number(receiptForm.tdsAmount || 0),
        tdsLedgerID: Number(receiptForm.tdsAmount || 0) > 0 ? Number(receiptForm.tdsLedgerID) : null,
        receivedAmount: netReceiptAmount,
        paymentMode: receiptForm.paymentMode || 'Bank',
        bankLedgerID: receiptForm.paymentMode === 'Bank' && netReceiptAmount > 0 ? Number(receiptForm.bankLedgerID) : null,
        referenceNo: receiptForm.referenceNo?.trim() || null,
        remarks: receiptForm.remarks?.trim() || (receiptType === 'ShareDividend' ? 'शेअर्स वार्षिक लाभांश प्राप्ती' : 'मुदत ठेव व्याज प्राप्ती')
      });
      setSuccess(response.data.message || 'उत्पन्न प्राप्ती यशस्वीरीत्या नोंदवली!');
      setReceiptForm({
        investmentAccountID: 0,
        receiptDate: allowDateOverride ? receiptForm.receiptDate : getActiveBizDate(),
        grossAmount: 0,
        tdsAmount: 0,
        tdsLedgerID: 0,
        remarks: receiptType === 'ShareDividend' ? 'शेअर्स वार्षिक लाभांश प्राप्ती' : 'मुदत ठेव व्याज प्राप्ती',
        paymentMode: 'Bank',
        bankLedgerID: 0,
        referenceNo: '',
      });
      await fetchAllData(selectedBranchFilter);
    } catch (err: any) {
      setError(
        typeof err.response?.data === 'string'
          ? err.response.data
          : err.response?.data?.message || 'प्राप्ती नोंदवताना त्रुटी आली.'
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredAccruals = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return accruals;
    return accruals.filter((a: any) =>
      String(a.investmentNo || '').toLowerCase().includes(q) ||
      String(a.institutionName || '').toLowerCase().includes(q) ||
      String(a.schemeName || '').toLowerCase().includes(q) ||
      String(a.branchName || '').toLowerCase().includes(q) ||
      String(a.voucherNo || '').toLowerCase().includes(q)
    );
  }, [accruals, searchTerm]);

  const filteredReceipts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r: any) =>
      String(r.investmentNo || '').toLowerCase().includes(q) ||
      String(r.institutionName || '').toLowerCase().includes(q) ||
      String(r.schemeName || '').toLowerCase().includes(q) ||
      String(r.branchName || '').toLowerCase().includes(q) ||
      String(r.voucherNo || '').toLowerCase().includes(q) ||
      String(r.remarks || '').toLowerCase().includes(q) ||
      String(r.referenceNo || '').toLowerCase().includes(q)
    );
  }, [receipts, searchTerm]);

  const handleExportAccrualsExcel = () => {
    if (filteredAccruals.length === 0) {
      setError('एक्सपोर्ट करण्यासाठी व्याज तरतूद डेटा उपलब्ध नाही.');
      return;
    }
    const rows = filteredAccruals.map((a, idx) => ({
      'अ.क्र.': idx + 1,
      'शाखा': a.branchName || '-',
      'खाते क्रमांक': a.investmentNo,
      'बँक / संस्था': a.institutionName || '-',
      'योजना': a.schemeName || '-',
      'कालावधी पासून': a.fromDate ? a.fromDate.split('T')[0] : '-',
      'तरतूद तारीख': a.accrualDate?.split('T')[0],
      'दिवस': a.calculationDays || '-',
      'संचित व्याज रक्कम ₹': a.interestAmount,
      'व्हाउचर क्रमांक': a.voucherNo || (a.voucherID ? `V-${a.voucherID}` : '-'),
      'स्थिती': a.voucherStatus || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InterestAccruals');
    XLSX.writeFile(wb, `Interest_Accruals_${getLocalTodayStr()}.xlsx`);
  };

  const handleExportReceiptsExcel = () => {
    if (filteredReceipts.length === 0) {
      setError('एक्सपोर्ट करण्यासाठी प्राप्ती पावती डेटा उपलब्ध नाही.');
      return;
    }
    const rows = filteredReceipts.map((r, idx) => ({
      'अ.क्र.': idx + 1,
      'शाखा': r.branchName || '-',
      'खाते क्रमांक': r.investmentNo,
      'बँक / संस्था': r.institutionName || '-',
      'प्रकार': r.receiptType === 'ShareDividend' ? 'शेअर्स लाभांश' : 'मुदत ठेव व्याज',
      'प्राप्ती तारीख': r.receiptDate?.split('T')[0],
      'एकूण रक्कम (Gross) ₹': r.grossAmount ?? r.receivedAmount,
      'TDS कपात ₹': r.tdsAmount || 0,
      'निव्वळ जमा (Net) ₹': r.receivedAmount,
      'पद्धत': r.paymentMode || 'Bank',
      'संदर्भ / UTR': r.referenceNo || '-',
      'शेरा': r.remarks || '-',
      'व्हाउचर क्रमांक': r.voucherNo || (r.voucherID ? `V-${r.voucherID}` : '-'),
      'स्थिती': r.voucherStatus || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InterestReceipts');
    XLSX.writeFile(wb, `Interest_Receipts_${getLocalTodayStr()}.xlsx`);
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (n: number) =>
    Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderStatusBadge = (status?: string) => {
    if (status === 'Approved') {
      return <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">Approved</span>;
    }
    if (status === 'Pending') {
      return <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px]">Pending</span>;
    }
    return <span className="text-gray-400 text-[10px]">{status || '-'}</span>;
  };

  if (printingVoucherId) {
    return <VoucherPrint voucherId={printingVoucherId} onBack={() => setPrintingVoucherId(null)} />;
  }

  const totalAccrualsAmt = dashboardStats?.totalAccruedInterest ?? accruals.reduce((acc, a) => acc + (a.interestAmount || 0), 0);
  const totalReceiptsAmt = dashboardStats?.totalReceivedInterest ?? receipts.reduce((acc, r) => acc + (r.grossAmount ?? r.receivedAmount ?? 0), 0);
  const totalReceivableAmt = dashboardStats?.interestReceivable ?? Math.max(0, totalAccrualsAmt - totalReceiptsAmt);

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass =
    'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  const selectedPreviewList = previewRows.filter(
    r => r.isSelected && !r.alreadyAccrued && r.hasValidMapping && Number(r.calculatedInterest) > 0
  );
  const selectedPreviewSum = selectedPreviewList.reduce((s, r) => s + Number(r.calculatedInterest || 0), 0);

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <TrendingUp size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>गुंतवणूक व्याज तरतूद व प्राप्ती</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">
                (Interest Accrual &amp; Dividend Receipt Posting)
              </span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              बँकांमधील मुदत ठेवींचे संचित व्याज तरतूद प्रिव्ह्यू/पोस्टिंग आणि शेअर्स लाभांश / व्याज पावती (TDS सह) नोंदणी
            </p>
          </div>
        </div>

        {/* Action Tabs + Date Override Lock */}
        <div className="flex flex-wrap items-center gap-2">
          {isHOUser && (
            <button
              type="button"
              onClick={() => setAllowDateOverride(prev => !prev)}
              className={`px-2.5 py-1 rounded-sm border text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                allowDateOverride
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="HO युझरसाठी मागील तारखेचे लॉक उघडा/बंद करा"
            >
              {allowDateOverride ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              <span>{allowDateOverride ? 'तारीख अनलॉक' : 'CBS तारीख लॉक'}</span>
            </button>
          )}

          <div className="flex items-center bg-slate-100 p-0.5 border border-slate-200 rounded-sm gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('accrual')}
              className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'accrual' ? 'bg-primary text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>१. मुदत ठेव व्याज तरतूद (Accrual)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('receipt')}
              className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'receipt' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>२. व्याज व लाभांश प्राप्ती (Receipt)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण संचित व्याज (स्थलांतरित सह)</div>
            <div className="text-sm font-black text-gray-900">₹{formatCurrency(totalAccrualsAmt)}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण प्राप्त उत्पन्न (Gross)</div>
            <div className="text-sm font-black text-emerald-800">₹{formatCurrency(totalReceiptsAmt)}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">शिल्लक येणे व्याज (Receivable)</div>
            <div className="text-sm font-black text-amber-800">₹{formatCurrency(totalReceivableAmt)}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">नोंदी (तरतूद / पावत्या)</div>
            <div className="text-sm font-black text-indigo-900">
              {accruals.length} / {receipts.length}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button type="button" onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ACCRUAL PREVIEW & POSTING                                          */}
      {/* ========================================================================= */}
      {activeTab === 'accrual' && (
        <div className="space-y-3">
          <div className="bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border border-gray-200 space-y-3">
            <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
              <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-bold text-primary">मुदत ठेव संचित व्याज तरतूद (Preview &amp; Accrual Posting)</h2>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">Actual/365 व चक्रवाढ प्रिव्ह्यूसह</span>
              </div>

              <p className="text-[11px] text-gray-600">
                शेअर्स खाती वगळून सक्रिय मुदत ठेवींचे मागील तरतुदीपासून निवडलेल्या तारखेपर्यंतचे वास्तविक व्याज मोजले जाते. प्रिव्ह्यू तपासूनच{' '}
                <strong>'येणे व्याज खाते (Accrued Asset Dr)'</strong> ते <strong>'गुंतवणूक व्याज उत्पन्न खाते (Income Cr)'</strong> व्हाउचर पोस्ट करा.
              </p>

              <form onSubmit={handleCalculatePreview} className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className={labelClass}>लागू शाखा (Branch)</label>
                    <select
                      value={accrualForm.branchID}
                      disabled={!isHOUser}
                      onChange={e => {
                        const bid = parseInt(e.target.value, 10);
                        setAccrualForm(prev => ({ ...prev, branchID: bid }));
                        setSelectedBranchFilter(bid);
                        setPreviewRows([]);
                      }}
                      className={`${inputClass} ${!isHOUser ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : ''}`}
                    >
                      {isHOUser && <option value={0}>🌟 सर्व शाखा एकत्रित (All Branches - Consolidated)</option>}
                      {(lockedBranchId ? branches.filter((b: any) => b.branchID === lockedBranchId) : branches).map((b: any) => (
                        <option key={b.branchID} value={b.branchID}>
                          {b.branchName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>तरतूद तारीख (Accrual Date) *</label>
                    <input
                      type="date"
                      value={accrualForm.accrualDate}
                      readOnly={!isHOUser || !allowDateOverride}
                      onChange={e => {
                        setAccrualForm(prev => ({ ...prev, accrualDate: e.target.value }));
                        setPreviewRows([]);
                      }}
                      required
                      className={`${inputClass} ${!isHOUser || !allowDateOverride ? 'bg-slate-100 text-slate-600' : ''}`}
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={loadingPreview}
                      className="w-full h-[28px] bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>{loadingPreview ? 'गणना चालू आहे...' : '१. व्याज गणना तपासा (Preview)'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Preview Table */}
            {previewRows.length > 0 && (
              <div className="border border-primary/30 rounded-sm bg-slate-50/60 p-3 space-y-2.5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="text-xs font-bold text-primary">
                    📊 तरतूद प्रिव्ह्यू यादी ({selectedPreviewList.length} / {previewRows.length} निवडलेली) — निवडलेले एकूण व्याज:{' '}
                    <span className="font-mono text-emerald-700">₹{formatCurrency(selectedPreviewSum)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePostSelectedAccruals}
                    disabled={saving || selectedPreviewList.length === 0}
                    className="px-4 h-[28px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{saving ? 'पोस्ट होत आहे...' : '२. निवडलेल्या खात्यांचे तरतूद व्हाउचर पोस्ट करा'}</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-sm bg-white">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-slate-100 text-gray-700 font-bold border-b border-gray-300">
                      <tr>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-center w-8">
                          <input
                            type="checkbox"
                            checked={
                              previewRows.some(r => !r.alreadyAccrued && r.hasValidMapping && r.calculatedInterest > 0) &&
                              previewRows
                                .filter(r => !r.alreadyAccrued && r.hasValidMapping && r.calculatedInterest > 0)
                                .every(r => r.isSelected)
                            }
                            onChange={e => toggleSelectAllPreview(e.target.checked)}
                          />
                        </th>
                        <th className="px-2.5 py-1.5 border-r border-gray-200">खाते क्र.</th>
                        <th className="px-2.5 py-1.5 border-r border-gray-200">शाखा / संस्था</th>
                        <th className="px-2.5 py-1.5 border-r border-gray-200 text-center">कालावधी (दिवस)</th>
                        <th className="px-2.5 py-1.5 border-r border-gray-200 text-right">मुद्दल ₹</th>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-center">दर / पद्धत</th>
                        <th className="px-2.5 py-1.5 border-r border-gray-200 text-right w-32">तरतूद व्याज ₹</th>
                        <th className="px-2.5 py-1.5 text-center">स्थिती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewRows.map(row => {
                        const disabled = row.alreadyAccrued || !row.hasValidMapping;
                        return (
                          <tr key={row.investmentAccountID} className={disabled ? 'bg-slate-50 text-gray-400' : 'hover:bg-primary/5'}>
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                              <input
                                type="checkbox"
                                checked={row.isSelected}
                                disabled={disabled}
                                onChange={() => togglePreviewSelect(row.investmentAccountID)}
                              />
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 font-mono font-bold text-primary">
                              {row.investmentNo}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200">
                              <div className="font-semibold text-gray-800">{row.institutionName}</div>
                              <div className="text-[10px] text-gray-500">
                                {row.branchName} • {row.schemeName}
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-center font-mono">
                              <div>{formatDate(row.fromDate)} - {formatDate(row.toDate)}</div>
                              <div className="text-[10px] text-gray-500">{row.elapsedDays} दिवस</div>
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-semibold">
                              ₹{formatCurrency(row.principalAmount)}
                            </td>
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                              <span className="font-mono font-bold">{row.interestRate}%</span>
                              <div className="text-[10px] text-gray-500">{row.calculationMethod}</div>
                            </td>
                            <td className="px-2 py-1 border-r border-gray-200 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={disabled}
                                value={row.calculatedInterest || ''}
                                onChange={e => updatePreviewAmount(row.investmentAccountID, parseFloat(e.target.value) || 0)}
                                className="w-full text-right font-mono font-bold text-emerald-800 border border-gray-300 rounded-xs px-1.5 py-0.5 bg-white disabled:bg-slate-100"
                              />
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              {row.alreadyAccrued ? (
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">आधीच पूर्ण</span>
                              ) : !row.hasValidMapping ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold" title={row.mappingError || ''}>
                                  GL मॅपिंग अपूर्ण
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">तयार</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Accruals History Table */}
            <div className="space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h3 className="text-xs font-bold text-gray-800">📋 नोंदवलेली व्याज तरतूद यादी ({filteredAccruals.length})</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1.5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="खाते / बँक / व्हाउचर शोधा..."
                      className="pl-7 pr-2 h-[26px] text-[11px] border border-gray-300 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleExportAccrualsExcel}
                    disabled={filteredAccruals.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-sm text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet size={13} />
                    <span>एक्सेल एक्सपोर्ट</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-9">#</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-left">शाखा</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-left">खाते क्रमांक</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-left">बँक / योजना</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-center">कालावधी (दिवस)</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-center">तरतूद तारीख</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-right">संचित व्याज ₹</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-center">व्हाउचर</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-6 text-center text-gray-500 font-bold">डेटा लोड होत आहे...</td>
                      </tr>
                    ) : filteredAccruals.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-6 text-center text-gray-400 font-bold">कोणतीही व्याज तरतूद उपलब्ध नाही.</td>
                      </tr>
                    ) : (
                      filteredAccruals.map((a: any, idx: number) => (
                        <tr key={a.accrualID || idx} className="hover:bg-primary/5 transition-colors">
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-500">{idx + 1}</td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-gray-700 font-medium">{a.branchName || '-'}</td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 font-mono font-bold text-primary">{a.investmentNo}</td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200">
                            <div className="font-semibold text-gray-800">{a.institutionName || '-'}</div>
                            <div className="text-[10px] text-gray-500">{a.schemeName || ''}</div>
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center font-mono text-gray-600">
                            {a.fromDate ? `${formatDate(a.fromDate)} (${a.calculationDays || 0} दि.)` : '-'}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center text-gray-700">{formatDate(a.accrualDate)}</td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                            ₹{formatCurrency(a.interestAmount)}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center">
                            {a.voucherID ? (
                              <button
                                type="button"
                                onClick={() => setPrintingVoucherId(a.voucherID)}
                                className="inline-flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary font-mono font-bold px-2 py-0.5 rounded border border-primary/20 cursor-pointer"
                                title="व्हाउचर प्रिंट / पहा"
                              >
                                <Printer className="w-3 h-3" />
                                <span>{a.voucherNo || `V-${a.voucherID}`}</span>
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">{renderStatusBadge(a.voucherStatus)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTEREST & DIVIDEND RECEIPT POSTING                                */}
      {/* ========================================================================= */}
      {activeTab === 'receipt' && (
        <div className="space-y-3">
          <div className="bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border border-gray-200 space-y-3">
            {/* Category Selector Pill + Branch Scope Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs text-gray-700">प्राप्ती वर्गवारी:</span>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptType('DepositInterest');
                    setReceiptForm(prev => ({
                      ...prev,
                      investmentAccountID: 0,
                      grossAmount: 0,
                      tdsAmount: 0,
                      tdsLedgerID: 0,
                      remarks: 'मुदत ठेव व्याज प्राप्ती'
                    }));
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-sm border transition-all cursor-pointer ${
                    receiptType === 'DepositInterest'
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-50'
                  }`}
                >
                  🏛️ मुदत ठेव व्याज पावती (Term Deposit Interest)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReceiptType('ShareDividend');
                    setReceiptForm(prev => ({
                      ...prev,
                      investmentAccountID: 0,
                      grossAmount: 0,
                      tdsAmount: 0,
                      tdsLedgerID: 0,
                      remarks: 'शेअर्स वार्षिक लाभांश प्राप्ती'
                    }));
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-sm border transition-all cursor-pointer ${
                    receiptType === 'ShareDividend'
                      ? 'bg-indigo-800 text-white border-indigo-800 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-50'
                  }`}
                >
                  📊 शेअर्स लाभांश पावती (Shares Dividend Receipt)
                </button>
              </div>

              {isHOUser && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-gray-600">शाखा फिल्टर:</span>
                  <select
                    value={selectedBranchFilter}
                    onChange={e => setSelectedBranchFilter(parseInt(e.target.value, 10))}
                    className="h-[26px] text-[11px] border border-gray-300 rounded-sm px-2 bg-white font-semibold"
                  >
                    <option value={0}>सर्व शाखा (All)</option>
                    {branches.map((b: any) => (
                      <option key={b.branchID} value={b.branchID}>
                        {b.branchName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <form onSubmit={handleReceiptPosting} className="bg-emerald-50/40 p-3.5 rounded-sm border border-emerald-200 border-t-2 border-emerald-600 space-y-2.5">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-700" />
                  <h2 className="text-xs font-bold text-emerald-900">
                    {receiptType === 'ShareDividend'
                      ? 'शेअर्स लाभांश पावती नोंद (Share Dividend Entry)'
                      : 'मुदत ठेव व्याज पावती नोंद (Deposit Interest Entry)'}
                  </h2>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300">
                  बँक / कॅश जमा + TDS व्हाउचर
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelClass}>
                    गुंतवणूक खाते निवडा ({selectableAccounts.length}) <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    name="investmentAccountID"
                    value={receiptForm.investmentAccountID}
                    onChange={e => handleReceiptAccountChange(Number(e.target.value))}
                    options={[
                      { value: 0, label: `-- ${receiptType === 'ShareDividend' ? 'शेअर्स खाते निवडा' : 'मुदत ठेव खाते निवडा'} --` },
                      ...selectableAccounts.map((a: any) => ({
                        value: a.investmentAccountID,
                        label: `${a.investmentNo} | ${a.institutionName} | ${a.schemeName} | भांडवल: ₹${formatCurrency(a.principalAmount)}`
                      }))
                    ]}
                    placeholder="-- खाते शोधा --"
                  />
                </div>

                <div>
                  <label className={labelClass}>प्राप्ती तारीख *</label>
                  <input
                    type="date"
                    value={receiptForm.receiptDate}
                    readOnly={!isHOUser || !allowDateOverride}
                    onChange={e => setReceiptForm(prev => ({ ...prev, receiptDate: e.target.value }))}
                    required
                    className={`${inputClass} ${!isHOUser || !allowDateOverride ? 'bg-slate-100 text-slate-600' : ''}`}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    एकूण व्याज / लाभांश (Gross ₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={receiptForm.grossAmount || ''}
                    onChange={e => setReceiptForm(prev => ({ ...prev, grossAmount: parseFloat(e.target.value) || 0 }))}
                    onFocus={e => e.target.select()}
                    required
                    placeholder="उदा. 35000"
                    className={`${inputClass} font-mono font-bold text-emerald-800`}
                  />
                </div>
              </div>

              {/* Selected Account Financial Summary Strip */}
              {selectedReceiptAccount && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 bg-white border border-primary/20 rounded-sm text-[11px]">
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold">शाखा व संस्था</div>
                    <div className="font-bold text-gray-800 truncate">{selectedReceiptAccount.institutionName}</div>
                    <div className="text-[10px] text-gray-500 truncate">{selectedReceiptAccount.branchName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold">मुद्दल / दर्शनी मूल्य</div>
                    <div className="font-mono font-bold text-gray-900">₹{formatCurrency(selectedReceiptAccount.principalAmount)}</div>
                    <div className="text-[10px] text-gray-500">
                      {receiptType === 'ShareDividend' ? 'शेअर्स भागभांडवल' : `व्याजदर: ${selectedReceiptAccount.interestRate}%`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold">एकूण संचित तरतूद</div>
                    <div className="font-mono font-bold text-primary">₹{formatCurrency(selectedReceiptAccount.accruedInterest)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold">आतापर्यंत प्राप्त</div>
                    <div className="font-mono font-bold text-emerald-700">₹{formatCurrency(selectedReceiptAccount.receivedInterest)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold">शिल्लक येणे व्याज (Receivable)</div>
                    <div className="font-mono font-black text-amber-700">₹{formatCurrency(selectedReceiptAccount.interestReceivable)}</div>
                  </div>
                </div>
              )}

              {receiptType === 'ShareDividend' && selectableAccounts.length === 0 && (
                <div className="p-2 bg-amber-50 border border-amber-300 rounded-sm text-[11px] text-amber-900 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>निवडलेल्या शाखेत कोणतेही सक्रिय 'Share' प्रकारचे गुंतवणूक खाते उपलब्ध नाही.</span>
                </div>
              )}

              {/* TDS Section */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-start p-2.5 rounded-sm border ${
                  (receiptForm.tdsAmount || 0) > 0 ? 'bg-rose-50/70 border-rose-300' : 'bg-white/80 border-emerald-200'
                }`}
              >
                <div>
                  <label className={labelClass}>TDS कपात रक्कम (₹ u/s 194A)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={receiptForm.tdsAmount || ''}
                    onChange={e => setReceiptForm(prev => ({ ...prev, tdsAmount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className={`${inputClass} font-mono font-bold text-rose-700`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    TDS जी.एल. लेजर निवडा {(receiptForm.tdsAmount || 0) > 0 && <span className="text-red-600">*</span>}
                  </label>
                  <SearchableSelect
                    name="tdsLedgerID"
                    value={receiptForm.tdsLedgerID}
                    onChange={e => setReceiptForm(prev => ({ ...prev, tdsLedgerID: Number(e.target.value) }))}
                    options={ledgerOptions}
                    placeholder="-- TDS Receivable / Tax जी.एल. लेजर निवडा --"
                  />
                </div>

                <div>
                  <label className={labelClass}>निव्वळ बँक / रोख जमा (Net ₹)</label>
                  <div className="h-[28px] px-2.5 flex items-center justify-end bg-emerald-100/70 border border-emerald-300 rounded-sm font-mono font-black text-emerald-900 text-xs">
                    ₹{formatCurrency(netReceiptAmount)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-start bg-white/80 p-2.5 rounded-sm border border-emerald-200">
                <div>
                  <label className={labelClass}>जमा पद्धत (Receipt Mode) *</label>
                  <select
                    value={receiptForm.paymentMode}
                    onChange={e => {
                      const mode = e.target.value;
                      setReceiptForm(prev => ({
                        ...prev,
                        paymentMode: mode,
                        ...(mode !== 'Bank' ? { bankLedgerID: 0, referenceNo: '' } : {})
                      }));
                    }}
                    className={`${inputClass} font-bold text-blue-950 border-blue-300`}
                  >
                    <option value="Bank">🏦 बँक खाते (Bank Account)</option>
                    <option value="Cash">💵 रोख (Cash)</option>
                  </select>
                </div>

                {receiptForm.paymentMode === 'Bank' ? (
                  <>
                    <div className="sm:col-span-2">
                      <BankLedgerSelect
                        value={receiptForm.bankLedgerID}
                        onChange={id => setReceiptForm(prev => ({ ...prev, bankLedgerID: id }))}
                        showCountBadge
                      />
                    </div>
                    <div>
                      <label className={labelClass}>UTR / धनादेश / संदर्भ क्र. (UTR / Ref No.)</label>
                      <input
                        type="text"
                        value={receiptForm.referenceNo}
                        onChange={e => setReceiptForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                        placeholder="उदा. UTR / NEFT / CHQ क्र."
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-3 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-sm text-[11px] font-bold text-emerald-900 mt-4">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>प्राप्त व्याज / लाभांश रक्कम शाखेच्या मुख्य रोख खात्यात (Branch Cash GL Account) जमा (Debit) केली जाईल.</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className={labelClass}>शेरा / ठराव संदर्भ</label>
                  <input
                    type="text"
                    value={receiptForm.remarks}
                    onChange={e => setReceiptForm(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="उदा. DCC बँक वार्षिक लाभांश ठराव क्र. ५"
                    className={inputClass}
                  />
                </div>

                <div className="flex items-end justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-[28px] px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>{saving ? 'नोंद होत आहे...' : '💵 उत्पन्न पावती नोंदवा'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Receipts History Table */}
            <div className="space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h3 className="text-xs font-bold text-gray-800">📋 नोंदवलेल्या उत्पन्न पावत्या यादी ({filteredReceipts.length})</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1.5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="खाते / बँक / शेरा / UTR शोधा..."
                      className="pl-7 pr-2 h-[26px] text-[11px] border border-gray-300 rounded-sm focus:ring-1 focus:ring-primary focus:outline-none bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleExportReceiptsExcel}
                    disabled={filteredReceipts.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-sm text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet size={13} />
                    <span>एक्सेल एक्सपोर्ट</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-9">#</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-left">शाखा</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-left">खाते क्र. / संस्था</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">प्रकार</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">तारीख</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-right">एकूण ₹</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">TDS ₹</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-right">निव्वळ जमा ₹</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-left">शेरा / संदर्भ</th>
                      <th className="px-2.5 py-1.5 border-r border-gray-200 text-center">व्हाउचर</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-6 text-center text-gray-400 font-bold">कोणतीही प्राप्ती पावती उपलब्ध नाही.</td>
                      </tr>
                    ) : (
                      filteredReceipts.map((r: any, idx: number) => (
                        <tr key={r.receiptID || idx} className="hover:bg-primary/5 transition-colors">
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-500">{idx + 1}</td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-gray-700 font-medium">{r.branchName || '-'}</td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200">
                            <div className="font-mono font-bold text-primary">{r.investmentNo}</div>
                            <div className="text-[10px] text-gray-500">{r.institutionName || ''}</div>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                            {r.receiptType === 'ShareDividend' ? (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">लाभांश</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold">व्याज</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-700">{formatDate(r.receiptDate)}</td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-semibold text-gray-800">
                            ₹{formatCurrency(r.grossAmount ?? r.receivedAmount)}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono text-rose-700">
                            {Number(r.tdsAmount || 0) > 0 ? `₹${formatCurrency(r.tdsAmount)}` : '-'}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                            ₹{formatCurrency(r.receivedAmount)}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-gray-700">
                            <div>{r.remarks || '-'}</div>
                            {(r.paymentMode || r.referenceNo) && (
                              <div className="text-[10px] text-gray-500 font-mono">
                                {r.paymentMode || 'Bank'}{r.referenceNo ? ` • ${r.referenceNo}` : ''}
                              </div>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center">
                            {r.voucherID ? (
                              <button
                                type="button"
                                onClick={() => setPrintingVoucherId(r.voucherID)}
                                className="inline-flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary font-mono font-bold px-2 py-0.5 rounded border border-primary/20 cursor-pointer"
                                title="व्हाउचर प्रिंट / पहा"
                              >
                                <Printer className="w-3 h-3" />
                                <span>{r.voucherNo || `V-${r.voucherID}`}</span>
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">{renderStatusBadge(r.voucherStatus)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestmentInterestAccrualPosting;
