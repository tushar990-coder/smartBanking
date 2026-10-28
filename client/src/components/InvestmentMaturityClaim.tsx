import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Landmark,
  Coins,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Search,
  Building,
  Percent,
  Calendar,
  FileSpreadsheet,
  Layers,
  X,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';

const InvestmentMaturityClaim: React.FC = () => {
  const { user } = useAuth();
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const isHOUser = user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'HeadOffice' || user?.role === 'HO_Manager';
  const [allowDateOverride, setAllowDateOverride] = useState(false);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeMode, setActiveMode] = useState<'maturity' | 'premature' | 'renewal'>('maturity');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const API_URL = '/api';

  const [maturityForm, setMaturityForm] = useState({
    maturityDate: activeBusinessDate,
    principalReceived: 0,
    interestReceived: 0,
    paymentMode: 'Bank',
    bankLedgerID: 0,
    referenceNo: '',
  });

  const [prematureForm, setPrematureForm] = useState({
    withdrawalDate: activeBusinessDate,
    principalPaid: 0,
    revisedInterestRate: 0,
    interestPaid: 0,
    penaltyAmount: 0,
    paymentMode: 'Bank',
    bankLedgerID: 0,
    referenceNo: '',
  });

  const [renewalForm, setRenewalForm] = useState({
    renewalDate: activeBusinessDate,
    renewalType: 'PrincipalOnly',
    renewalAmount: 0,
    newSchemeID: 0,
    newInterestRate: 0,
  });

  // Sync CBS Business Date if changed
  useEffect(() => {
    if (user?.businessDate) {
      const bDate = user.businessDate.split('T')[0];
      setPrematureForm(prev => ({ ...prev, withdrawalDate: bDate }));
    }
  }, [user?.businessDate]);

  useEffect(() => {
    fetchAccounts();
    fetchSchemes();
    fetchBranches();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/InvestmentAccounts?status=Active`);
      const allAccs = res.data || [];
      // Only Term Deposits can be matured or renewed (Exclude Shares)
      const depositAccs = allAccs.filter((a: any) => a.investmentType !== 'Share' && a.durationMonths !== 0);
      setAccounts(depositAccs);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  const fetchSchemes = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentSchemes`);
      const list = (res.data || []).filter((s: any) => s.investmentType !== 'Share');
      setSchemes(list);
    } catch {}
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/Branches`);
      setBranches(res.data || []);
    } catch {}
  };

  const selectedAccount = accounts.find(a => a.investmentAccountID === Number(selectedAccountId));

  const handleSelectAccount = (accountId: number) => {
    setSelectedAccountId(accountId);
    const acc = accounts.find(a => a.investmentAccountID === accountId);
    if (acc) {
      const principal = acc.principalAmount || 0;
      const expectedTotal = acc.expectedMaturityAmount || principal;
      const interest = Math.max(0, expectedTotal - principal);

      setMaturityForm(prev => ({
        maturityDate: acc.maturityDate ? acc.maturityDate.split('T')[0] : activeBusinessDate,
        principalReceived: principal,
        interestReceived: Math.round(interest * 100) / 100,
        paymentMode: prev.paymentMode || 'Bank',
        bankLedgerID: prev.paymentMode === 'Bank' ? prev.bankLedgerID : 0,
        referenceNo: '',
      }));

      setPrematureForm(prev => ({
        withdrawalDate: activeBusinessDate,
        principalPaid: principal,
        revisedInterestRate: Math.max(0, (acc.interestRate || 0) - 1.0), // default 1% penalty reduction
        interestPaid: 0,
        penaltyAmount: 0,
        paymentMode: prev.paymentMode || 'Bank',
        bankLedgerID: prev.paymentMode === 'Bank' ? prev.bankLedgerID : 0,
        referenceNo: '',
      }));

      setRenewalForm({
        renewalDate: acc.maturityDate ? acc.maturityDate.split('T')[0] : activeBusinessDate,
        renewalType: 'PrincipalOnly',
        renewalAmount: principal,
        newSchemeID: acc.schemeID || (schemes[0]?.schemeID || 0),
        newInterestRate: acc.interestRate || 0,
      });
    }
  };

  const handleMaturity = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedAccount) {
      setError('कृपया मुदत ठेव खाते निवडा.');
      return;
    }
    if (maturityForm.paymentMode === 'Bank' && (!maturityForm.bankLedgerID || Number(maturityForm.bankLedgerID) <= 0)) {
      setError('बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`${API_URL}/InvestmentAccounts/Maturity`, {
        investmentAccountID: selectedAccount.investmentAccountID,
        maturityDate: maturityForm.maturityDate,
        principalReceived: maturityForm.principalReceived,
        interestReceived: maturityForm.interestReceived,
        paymentMode: maturityForm.paymentMode || 'Bank',
        bankLedgerID: maturityForm.paymentMode === 'Bank' ? Number(maturityForm.bankLedgerID) : null,
        referenceNo: maturityForm.referenceNo?.trim() || null,
      });
      setSuccess(`${response.data.message || 'मुदत ठेव खात्याची मुदतपूर्ती यशस्वीरीत्या झाली!'}`);
      setSelectedAccountId(0);
      fetchAccounts();
    } catch (err: any) {
      setError(
        typeof err.response?.data === 'string'
          ? err.response.data
          : err.response?.data?.message || 'मुदतपूर्ती करताना त्रुटी आली.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePremature = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedAccount) {
      setError('कृपया मुदत ठेव खाते निवडा.');
      return;
    }
    if (prematureForm.paymentMode === 'Bank' && (!prematureForm.bankLedgerID || Number(prematureForm.bankLedgerID) <= 0)) {
      setError('बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`${API_URL}/InvestmentAccounts/PrematureWithdraw`, {
        investmentAccountID: selectedAccount.investmentAccountID,
        withdrawalDate: prematureForm.withdrawalDate,
        principalPaid: prematureForm.principalPaid,
        revisedInterestRate: prematureForm.revisedInterestRate,
        interestPaid: prematureForm.interestPaid,
        penaltyAmount: prematureForm.penaltyAmount,
        netPayout: (prematureForm.principalPaid || 0) + (prematureForm.interestPaid || 0) - (prematureForm.penaltyAmount || 0),
        paymentMode: prematureForm.paymentMode || 'Bank',
        bankLedgerID: prematureForm.paymentMode === 'Bank' ? Number(prematureForm.bankLedgerID) : null,
        referenceNo: prematureForm.referenceNo?.trim() || null,
      });
      setSuccess(`${response.data.message || 'मुदत ठेव मुदतपूर्व यशस्वीरीत्या काढली!'}`);
      setSelectedAccountId(0);
      fetchAccounts();
    } catch (err: any) {
      setError(
        typeof err.response?.data === 'string'
          ? err.response.data
          : err.response?.data?.message || 'मुदतपूर्व काढताना त्रुटी आली.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedAccount) {
      setError('कृपया मुदत ठेव खाते निवडा.');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`${API_URL}/InvestmentAccounts/Renew`, {
        oldInvestmentAccountID: selectedAccount.investmentAccountID,
        ...renewalForm,
      });
      setSuccess(`${response.data.message || 'मुदत ठेवीचे नूतनीकरण यशस्वीरीत्या झाले!'} ${response.data.newAccountNo ? `(नवीन खाते: ${response.data.newAccountNo})` : ''}`);
      setSelectedAccountId(0);
      fetchAccounts();
    } catch (err: any) {
      setError(typeof err.response?.data === 'string' ? err.response.data : 'नूतनीकरण करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleRenewalTypeChange = (type: string) => {
    if (!selectedAccount) return;
    const principal = selectedAccount.principalAmount || 0;
    const interest = Math.max(0, (selectedAccount.expectedMaturityAmount || 0) - principal);
    const newAmt = type === 'PrincipalAndInterest' ? (principal + interest) : principal;

    setRenewalForm(prev => ({
      ...prev,
      renewalType: type,
      renewalAmount: newAmt
    }));
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (n: number) => n?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  // KPI calculations
  const totalPrincipal = accounts.reduce((acc, a) => acc + (a.principalAmount || 0), 0);
  const totalMaturityExpected = accounts.reduce((acc, a) => acc + (a.expectedMaturityAmount || a.principalAmount || 0), 0);
  
  // Accounts due in 90 days
  const now = new Date();
  const ninetyDaysLater = new Date();
  ninetyDaysLater.setDate(now.getDate() + 90);
  const dueSoonCount = accounts.filter(a => {
    if (!a.maturityDate) return false;
    const mDate = new Date(a.maturityDate);
    return mDate >= now && mDate <= ninetyDaysLater;
  }).length;

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Coins size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>गुंतवणूक मुदतपूर्ती, मोडणी व नूतनीकरण</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Investment Maturity, Premature & Renewal)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              बँकांमधील मुदत ठेवींची नियमित मुदतपूर्ती जमा, मुदतपूर्व मोडणी आणि मुदत ठेव नूतनीकरण प्रक्रिया
            </p>
          </div>
        </div>

        {/* Action Mode Toggle Pills */}
        <div className="flex items-center bg-slate-100 p-0.5 border border-slate-200 rounded-sm gap-1">
          <button
            type="button"
            onClick={() => setActiveMode('maturity')}
            className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1 ${
              activeMode === 'maturity'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>१. नियमित मुदतपूर्ती</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('premature')}
            className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1 ${
              activeMode === 'premature'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>२. मुदतपूर्व मोडणी</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('renewal')}
            className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1 ${
              activeMode === 'renewal'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>३. ठेव नूतनीकरण</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण सक्रिय मुदत ठेवी</div>
            <div className="text-sm font-black text-gray-900">{accounts.length} खाती</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण गुंतवलेली मुद्दल</div>
            <div className="text-sm font-black text-indigo-900">₹{formatCurrency(totalPrincipal)}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">अपेक्षित मुदतपूर्ती रक्कम</div>
            <div className="text-sm font-black text-emerald-900">₹{formatCurrency(totalMaturityExpected)}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">पुढील ९० दिवसात मुदतपूर्ण</div>
            <div className="text-sm font-black text-amber-800">{dueSoonCount} खाती</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* MAIN UNIFIED CONTAINER */}
      <div className="bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border border-gray-200 space-y-3">
        
        {/* Section 1: Account Selection */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Search className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. मुदत ठेव खाते निवडा (Select Term Deposit Account)</h2>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">फक्त सक्रिय मुदत ठेवी</span>
          </div>

          <div>
            <label className={labelClass}>
              मुदत ठेव खाते / पावती क्रमांक <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              name="investmentAccountID"
              value={selectedAccountId}
              onChange={(e) => handleSelectAccount(Number(e.target.value))}
              options={[
                { value: 0, label: '-- मुदत ठेव खाते निवडा --' },
                ...accounts.map((a: any) => {
                  const oldPart = a.oldInvestmentNo ? ` [जुना क्र: ${a.oldInvestmentNo}]` : '';
                  return {
                    value: a.investmentAccountID,
                    label: `${a.investmentNo}${oldPart} | पावती क्र: ${a.depositReceiptNo || '-'} | ${a.institutionName} | ₹${formatCurrency(a.principalAmount)} (${a.interestRate}%) | मुदतपूर्ती: ${formatDate(a.maturityDate)}`
                  };
                })
              ]}
              placeholder="-- खाते, जुना क्र. किंवा पावती क्र. ने शोधा --"
            />
          </div>

          {/* Selected Account Info Card */}
          {selectedAccount && (
            <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 mt-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                <span className="font-bold text-gray-800 text-xs flex flex-wrap items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-primary" />
                  <span>खाते तपशील: <span className="font-mono text-primary">{selectedAccount.investmentNo}</span></span>
                  {selectedAccount.oldInvestmentNo && (
                    <span className="bg-purple-100 text-purple-950 border border-purple-300 px-1.5 py-0.2 rounded text-[10.5px] font-mono font-bold">
                      🏷️ जुना गुंतवणूक क्र.: {selectedAccount.oldInvestmentNo}
                    </span>
                  )}
                </span>
                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded border border-primary/20">
                  पावती क्र: {selectedAccount.depositReceiptNo || '-'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 text-[10px] block">बँक / संस्था:</span>
                  <span className="font-bold text-gray-900">{selectedAccount.institutionName}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">योजना:</span>
                  <span className="font-medium text-gray-800">{selectedAccount.schemeName}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">गुंतवलेली मुद्दल:</span>
                  <span className="font-bold text-emerald-700 font-mono">₹{formatCurrency(selectedAccount.principalAmount)}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">व्याजदर (% p.a.):</span>
                  <span className="font-bold text-emerald-800 font-mono">{selectedAccount.interestRate}%</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">ठेव तारीख:</span>
                  <span className="font-medium text-gray-700 font-mono">{formatDate(selectedAccount.investmentDate)}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">मुदतपूर्ती तारीख:</span>
                  <span className="font-bold text-orange-700 font-mono">{formatDate(selectedAccount.maturityDate)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: PROCESS FORMS (Based on activeMode) */}
        {selectedAccount ? (
          <div>
            {/* MODE 1: MATURITY PAYOUT */}
            {activeMode === 'maturity' && (
              <form onSubmit={handleMaturity} className="bg-emerald-50/40 p-3.5 rounded-sm border border-emerald-200 border-t-2 border-emerald-600 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                    <h3 className="text-xs font-bold text-emerald-900">२. नियमित मुदतपूर्ती प्रक्रिया (Regular Maturity Claim)</h3>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300">
                    मुदतपूर्ती पावती जमा
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between !mb-0.5">
                      <label className={labelClass}>मुदतपूर्ती तारीख *</label>
                      {!allowDateOverride && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          <Lock size={9} /> लॉक
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={maturityForm.maturityDate || activeBusinessDate}
                      onChange={(e) => setMaturityForm(prev => ({ ...prev, maturityDate: e.target.value }))}
                      required
                      disabled={!allowDateOverride}
                      readOnly={!allowDateOverride}
                      className={`${inputClass} ${!allowDateOverride ? 'bg-slate-100 cursor-not-allowed select-none text-slate-800 font-bold' : 'bg-white border-amber-400 font-bold'}`}
                    />
                    {isHOUser && (
                      <label className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer font-normal mt-0.5 select-none">
                        <input
                          type="checkbox"
                          checked={allowDateOverride}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAllowDateOverride(checked);
                            if (!checked) {
                              setMaturityForm(p => ({ ...p, maturityDate: activeBusinessDate }));
                              setPrematureForm(p => ({ ...p, withdrawalDate: activeBusinessDate }));
                              setRenewalForm(p => ({ ...p, renewalDate: activeBusinessDate }));
                            }
                          }}
                          className="w-3 h-3 text-primary rounded"
                        />
                        <span className="flex items-center gap-0.5">
                          {allowDateOverride ? <Unlock size={10} className="text-amber-600" /> : <Lock size={10} className="text-gray-400" />}
                          तारीख बदला (Override)
                        </span>
                      </label>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>परत मिळालेले मुद्दल ₹ *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={maturityForm.principalReceived || ''}
                      onChange={(e) => setMaturityForm(prev => ({ ...prev, principalReceived: parseFloat(e.target.value) || 0 }))}
                      required
                      className={`${inputClass} font-mono font-bold text-emerald-800`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>मिळालेले एकूण व्याज ₹ *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={maturityForm.interestReceived || ''}
                      onChange={(e) => setMaturityForm(prev => ({ ...prev, interestReceived: parseFloat(e.target.value) || 0 }))}
                      required
                      className={`${inputClass} font-mono font-bold text-emerald-800`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>एकूण प्राप्त रक्कम ₹ (Net Payout)</label>
                    <div className="px-2 py-1 bg-white border border-emerald-300 rounded-sm h-[28px] flex items-center font-mono font-bold text-emerald-950 text-xs">
                      ₹{formatCurrency((maturityForm.principalReceived || 0) + (maturityForm.interestReceived || 0))}
                    </div>
                  </div>
                </div>

                {/* Maturity Receipt Mode & Bank GL Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-start bg-white/80 p-2.5 rounded-sm border border-emerald-200">
                  <div>
                    <label className={labelClass}>जमा पद्धत (Receipt Mode) *</label>
                    <select
                      value={maturityForm.paymentMode}
                      onChange={(e) => {
                        const mode = e.target.value;
                        setMaturityForm(prev => ({
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

                  {maturityForm.paymentMode === 'Bank' ? (
                    <>
                      <div className="sm:col-span-2">
                        <BankLedgerSelect
                          value={maturityForm.bankLedgerID}
                          onChange={(id) => setMaturityForm(prev => ({ ...prev, bankLedgerID: id }))}
                          showCountBadge
                        />
                      </div>
                      <div>
                        <label className={labelClass}>UTR / धनादेश / संदर्भ क्र. (UTR / Ref No.)</label>
                        <input
                          type="text"
                          value={maturityForm.referenceNo}
                          onChange={(e) => setMaturityForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                          placeholder="उदा. UTR / NEFT / CHQ क्र."
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-3 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-sm text-[11px] font-bold text-emerald-900 mt-4">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>मुदतपूर्ती रक्कम शाखेच्या मुख्य रोख खात्यात (Branch Cash GL Account) जमा (Debit) केली जाईल.</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-emerald-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{saving ? 'मुदतपूर्ती होत आहे...' : 'मुदतपूर्ती पूर्ण करा (Process Maturity)'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* MODE 2: PREMATURE WITHDRAWAL */}
            {activeMode === 'premature' && (
              <form onSubmit={handlePremature} className="bg-amber-50/40 p-3.5 rounded-sm border border-amber-200 border-t-2 border-amber-600 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <h3 className="text-xs font-bold text-amber-900">२. मुदतपूर्व मोडणी प्रक्रिया (Premature Encashment)</h3>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-300">
                    मुदतपूर्व दंड व कपात
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between !mb-0.5">
                      <label className={labelClass}>मोडणी / काढणे तारीख *</label>
                      {!allowDateOverride && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          <Lock size={9} /> लॉक
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={prematureForm.withdrawalDate || activeBusinessDate}
                      onChange={(e) => setPrematureForm(prev => ({ ...prev, withdrawalDate: e.target.value }))}
                      required
                      disabled={!allowDateOverride}
                      readOnly={!allowDateOverride}
                      className={`${inputClass} ${!allowDateOverride ? 'bg-slate-100 cursor-not-allowed select-none text-slate-800 font-bold' : 'bg-white border-amber-400 font-bold'}`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>परत मुद्दल रक्कम ₹ *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prematureForm.principalPaid || ''}
                      onChange={(e) => setPrematureForm(prev => ({ ...prev, principalPaid: parseFloat(e.target.value) || 0 }))}
                      required
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>सुधारित व्याजदर (% p.a.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prematureForm.revisedInterestRate || ''}
                      onChange={(e) => setPrematureForm(prev => ({ ...prev, revisedInterestRate: parseFloat(e.target.value) || 0 }))}
                      className={`${inputClass} font-mono font-bold text-amber-800`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>प्राप्त झालेले व्याज ₹</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prematureForm.interestPaid || ''}
                      onChange={(e) => setPrematureForm(prev => ({ ...prev, interestPaid: parseFloat(e.target.value) || 0 }))}
                      className={`${inputClass} font-mono font-bold text-emerald-700`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>दंड / कपात रक्कम ₹</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prematureForm.penaltyAmount || ''}
                      onChange={(e) => setPrematureForm(prev => ({ ...prev, penaltyAmount: parseFloat(e.target.value) || 0 }))}
                      className={`${inputClass} font-mono font-bold text-rose-700`}
                    />
                  </div>
                </div>

                {/* Premature Receipt Mode & Bank GL Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-start bg-white/80 p-2.5 rounded-sm border border-amber-200">
                  <div>
                    <label className={labelClass}>जमा पद्धत (Receipt Mode) *</label>
                    <select
                      value={prematureForm.paymentMode}
                      onChange={(e) => {
                        const mode = e.target.value;
                        setPrematureForm(prev => ({
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

                  {prematureForm.paymentMode === 'Bank' ? (
                    <>
                      <div className="sm:col-span-2">
                        <BankLedgerSelect
                          value={prematureForm.bankLedgerID}
                          onChange={(id) => setPrematureForm(prev => ({ ...prev, bankLedgerID: id }))}
                          showCountBadge
                        />
                      </div>
                      <div>
                        <label className={labelClass}>UTR / धनादेश / संदर्भ क्र. (UTR / Ref No.)</label>
                        <input
                          type="text"
                          value={prematureForm.referenceNo}
                          onChange={(e) => setPrematureForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                          placeholder="उदा. UTR / NEFT / CHQ क्र."
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-3 flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-sm text-[11px] font-bold text-amber-900 mt-4">
                      <CheckCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>मुदतपूर्व निव्वळ रक्कम शाखेच्या मुख्य रोख खात्यात (Branch Cash GL Account) जमा (Debit) केली जाईल.</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-amber-200">
                  <div className="text-xs">
                    <span className="text-gray-600 font-medium">निव्वळ हाती मिळणारी रक्कम (Net Payout):</span>
                    <span className="font-bold text-amber-900 font-mono text-sm ml-2">
                      ₹{formatCurrency((prematureForm.principalPaid || 0) + (prematureForm.interestPaid || 0) - (prematureForm.penaltyAmount || 0))}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>{saving ? 'मोडणी होत आहे...' : 'मुदतपूर्व मोडणी करा (Premature Withdrawal)'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* MODE 3: RENEWAL */}
            {activeMode === 'renewal' && (
              <form onSubmit={handleRenewal} className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 border-t-2 border-primary space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-primary">२. मुदत ठेव नूतनीकरण प्रक्रिया (Term Deposit Renewal)</h3>
                  </div>
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded border border-primary/20">
                    नवीन मुदत पावती तयार होईल
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between !mb-0.5">
                      <label className={labelClass}>नूतनीकरण तारीख *</label>
                      {!allowDateOverride && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          <Lock size={9} /> लॉक
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={renewalForm.renewalDate || activeBusinessDate}
                      onChange={(e) => setRenewalForm(prev => ({ ...prev, renewalDate: e.target.value }))}
                      required
                      disabled={!allowDateOverride}
                      readOnly={!allowDateOverride}
                      className={`${inputClass} ${!allowDateOverride ? 'bg-slate-100 cursor-not-allowed select-none text-slate-800 font-bold' : 'bg-white border-amber-400 font-bold'}`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>नूतनीकरण प्रकार *</label>
                    <select
                      value={renewalForm.renewalType}
                      onChange={(e) => handleRenewalTypeChange(e.target.value)}
                      className={inputClass}
                    >
                      <option value="PrincipalOnly">फक्त मुद्दल रक्कम</option>
                      <option value="PrincipalAndInterest">मुद्दल + मिळणारे व्याज</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>नवीन ठेव रक्कम ₹ *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={renewalForm.renewalAmount || ''}
                      onChange={(e) => setRenewalForm(prev => ({ ...prev, renewalAmount: parseFloat(e.target.value) || 0 }))}
                      required
                      className={`${inputClass} font-mono font-bold text-emerald-800`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>नवीन योजना *</label>
                    <select
                      value={renewalForm.newSchemeID}
                      onChange={(e) => {
                        const sid = parseInt(e.target.value, 10);
                        const sc = schemes.find(s => s.schemeID === sid);
                        setRenewalForm(prev => ({
                          ...prev,
                          newSchemeID: sid,
                          newInterestRate: sc ? sc.interestRate : prev.newInterestRate
                        }));
                      }}
                      className={inputClass}
                    >
                      {schemes.map((s: any) => (
                        <option key={s.schemeID} value={s.schemeID}>
                          {s.schemeName} ({s.interestRate}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>नवीन व्याजदर (% p.a.) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={renewalForm.newInterestRate || ''}
                      onChange={(e) => setRenewalForm(prev => ({ ...prev, newInterestRate: parseFloat(e.target.value) || 0 }))}
                      required
                      className={`${inputClass} font-mono font-bold text-primary`}
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-primary/20">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{saving ? 'नूतनीकरण होत आहे...' : 'ठेव नूतनीकरण करा (Renew Deposit)'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-gray-300 rounded-sm text-gray-400">
            <Landmark className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-bold text-gray-600">कृपया वरील ड्रॉपडाउनमधून मुदत ठेव खाते निवडा.</p>
            <p className="text-[10px] text-gray-400 mt-0.5">निवडलेल्या खात्याची माहिती आणि क्लेम पर्याय येथे आपोआप उघडतील.</p>
          </div>
        )}

      </div>

    </div>
  );
};

export default InvestmentMaturityClaim;
