import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BankLedgerSelect from './common/BankLedgerSelect';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';
import { formatLocalYmd, getBusinessDateStr, parseYmdAsLocalDate } from '../utils/businessDateUtils';
import { 
  Calculator, 
  Settings, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Percent, 
  DollarSign, 
  Building2, 
  UserCheck, 
  CreditCard, 
  ArrowRight,
  Plus,
  Trash2,
  FileText,
  Search
} from 'lucide-react';

interface Agent {
  pigmyAgentID: number;
  agentName: string;
  agentCode?: string;
  branchID?: number;
  mobileNo?: string;
}

interface Branch {
  branchID: number;
  branchName: string;
  branchCode: string;
}

interface Setting {
  settingId: number;
  agentId?: number;
  agent?: { agentName: string; agentCode?: string };
  productType?: string;
  commissionType: string;
  commissionValue: number;
  calculationFrequency: string;
  deductPrematureWithdrawals?: boolean;
  prematureLockInDays?: number;
  isActive: boolean;
}

interface PendingCommission {
  commissionId: number;
  agentId: number;
  agent?: { agentName: string; agentCode?: string };
  productType?: string;
  calculationFrequency: string;
  periodStartDate: string;
  periodEndDate: string;
  totalCollectionAmount: number;
  calculatedCommission: number;
  status: string;
}

interface PaidHistoryRow {
  commissionId: number;
  agentId: number;
  agentName: string;
  agentCode: string;
  productType?: string;
  calculationFrequency: string;
  periodStartDate: string;
  periodEndDate: string;
  totalCollectionAmount: number;
  calculatedCommission: number;
  status: string;
  voucherId?: number;
  voucherNo?: string;
  calculatedOn: string;
}

interface SavingAccount {
  savingAccountID: number;
  accountNo: string;
  customerID?: number;
  customerName?: string;
  currentBalance?: number;
  totalBalance?: number;
}

export default function AgentCommissionMaster() {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const [activeTab, setActiveTab] = useState<'payouts' | 'settings' | 'history'>('payouts');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [pending, setPending] = useState<PendingCommission[]>([]);
  const [historyList, setHistoryList] = useState<PaidHistoryRow[]>([]);
  const [savingAccounts, setSavingAccounts] = useState<SavingAccount[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const initialBranchId = typeof effectiveBranch === 'number' && effectiveBranch > 0
    ? effectiveBranch
    : (isHOUser ? 0 : (user?.branchID || 1));

  const todayStr = getBusinessDateStr(user?.businessDate);
  const activeBizDate = parseYmdAsLocalDate(todayStr);
  const firstDayOfMonth = formatLocalYmd(new Date(activeBizDate.getFullYear(), activeBizDate.getMonth(), 1));

  const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId);
  const [selectedAgentId, setSelectedAgentId] = useState<number | 'ALL'>('ALL');
  const [selectedProductType, setSelectedProductType] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>(firstDayOfMonth);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [calcFreq, setCalcFreq] = useState<string>('DAILY');

  // New Setting Form State
  const [formAgentId, setFormAgentId] = useState<number | ''>('');
  const [formProductType, setFormProductType] = useState<string>('PIGMY');
  const [formCommissionType, setFormCommissionType] = useState<string>('PERCENTAGE');
  const [formCommissionValue, setFormCommissionValue] = useState<number>(2.5);
  const [formFrequency, setFormFrequency] = useState<string>('DAILY');
  const [formDeductPremature, setFormDeductPremature] = useState<boolean>(false);
  const [formPrematureLockInDays, setFormPrematureLockInDays] = useState<number>(180);

  // Payment Modal State
  const [selectedPayCommission, setSelectedPayCommission] = useState<PendingCommission | null>(null);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK' | 'AGENT_SB'>('CASH');
  const [bankLedgerId, setBankLedgerId] = useState<number>(0);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [selectedAgentSbAccountId, setSelectedAgentSbAccountId] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);

  useEffect(() => {
    if (user?.businessDate) {
      const bStr = getBusinessDateStr(user.businessDate);
      const bDate = parseYmdAsLocalDate(bStr);
      setFromDate(formatLocalYmd(new Date(bDate.getFullYear(), bDate.getMonth(), 1)));
      setToDate(bStr);
      setPaymentDate(bStr);
    }
  }, [user?.businessDate]);
  const [payProcessing, setPayProcessing] = useState(false);

  // Print Advice State
  const [printCommission, setPrintCommission] = useState<PaidHistoryRow | null>(null);

  useEffect(() => {
    fetchSansthaDetail();
    fetchBranches();
    fetchAgents();
    fetchSavingAccounts();
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchSettings();
    } else if (activeTab === 'payouts') {
      fetchPending();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, selectedBranchId, selectedAgentId, fromDate, toDate]);

  const fetchSansthaDetail = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSansthaDetail(res.data[0]);
      } else if (res.data && !Array.isArray(res.data)) {
        setSansthaDetail(res.data);
      }
    } catch (err) {
      console.error('Error fetching sanstha detail', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await axios.get('/api/PigmyAgents');
      setAgents(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSavingAccounts = async () => {
    try {
      const res = await axios.get('/api/SavingAccounts');
      setSavingAccounts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/AgentCommission/Settings');
      setSettings(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPending = async () => {
    try {
      let url = `/api/AgentCommission/Pending?`;
      if (selectedBranchId > 0) url += `branchId=${selectedBranchId}&`;
      if (selectedAgentId !== 'ALL') url += `agentId=${selectedAgentId}&`;
      if (selectedProductType !== 'ALL') url += `productType=${selectedProductType}&`;

      const res = await axios.get(url);
      setPending(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      let url = `/api/AgentCommission/History?fromDate=${fromDate}&toDate=${toDate}&`;
      if (selectedBranchId > 0) url += `branchId=${selectedBranchId}&`;
      if (selectedAgentId !== 'ALL') url += `agentId=${selectedAgentId}&`;
      if (selectedProductType !== 'ALL') url += `productType=${selectedProductType}&`;

      const res = await axios.get(url);
      setHistoryList(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/AgentCommission/Settings', {
        agentId: formAgentId !== '' ? Number(formAgentId) : null,
        productType: formProductType,
        commissionType: formCommissionType,
        commissionValue: formCommissionValue,
        calculationFrequency: formFrequency,
        deductPrematureWithdrawals: formProductType === 'PIGMY' ? formDeductPremature : false,
        prematureLockInDays: formProductType === 'PIGMY' ? Number(formPrematureLockInDays || 180) : 180
      });

      setMessage({ text: 'एजंट कमिशन दर यशस्वीरीत्या सेव्ह झाला!', type: 'success' });
      fetchSettings();
      setFormAgentId('');
      setFormCommissionValue(2.5);
      setFormDeductPremature(false);
      setFormPrematureLockInDays(180);
    } catch (err: any) {
      setMessage({ text: 'सेटिंग सेव्ह करताना त्रुटी आली: ' + (err.response?.data || err.message), type: 'error' });
    }
  };

  const handleDeleteSetting = async (settingId: number) => {
    if (!window.confirm('तुम्हाला ही कमिशन सेटिंग हटवायची आहे का?')) return;
    try {
      await axios.delete(`/api/AgentCommission/Settings/${settingId}`);
      setMessage({ text: 'सेटिंग हटवली आहे.', type: 'success' });
      fetchSettings();
    } catch (err: any) {
      setMessage({ text: 'हटवताना त्रुटी आली: ' + (err.response?.data || err.message), type: 'error' });
    }
  };

  const handleTriggerCalculation = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post('/api/AgentCommission/Calculate', {
        fromDate: fromDate,
        toDate: toDate,
        frequency: calcFreq,
        agentId: selectedAgentId !== 'ALL' ? Number(selectedAgentId) : null,
        productType: selectedProductType
      });

      setMessage({ text: res.data.message || 'कमिशन गणना पूर्ण झाली!', type: 'success' });
      fetchPending();
    } catch (err: any) {
      setMessage({ text: 'गणना करताना त्रुटी: ' + (err.response?.data || err.message), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!selectedPayCommission) return;

    if (paymentMode === 'AGENT_SB' && !selectedAgentSbAccountId) {
      alert('कृपया एजंटचे बचत खाते निवडा.');
      return;
    }

    if (paymentMode === 'BANK' && (!bankLedgerId || bankLedgerId <= 0)) {
      alert('कृपया बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडा.');
      return;
    }

    setPayProcessing(true);
    try {
      const res = await axios.post('/api/AgentCommission/Pay', {
        commissionId: selectedPayCommission.commissionId,
        branchId: selectedBranchId > 0 ? selectedBranchId : 1,
        paymentDate: paymentDate,
        paymentMode: paymentMode,
        bankLedgerId: paymentMode === 'BANK' ? bankLedgerId : null,
        referenceNo: paymentMode === 'BANK' && referenceNo.trim() ? referenceNo.trim() : null,
        agentSavingAccountId: selectedAgentSbAccountId !== '' ? Number(selectedAgentSbAccountId) : null
      });

      setMessage({ 
        text: `कमिशन वाटप यशस्वी! व्हाउचर क्र.: ${res.data.voucherNo}`, 
        type: 'success' 
      });

      setSelectedPayCommission(null);
      setBankLedgerId(0);
      setReferenceNo('');
      fetchPending();
      if (activeTab === 'history') fetchHistory();
    } catch (err: any) {
      alert('कमिशन पेमेंट त्रुटी: ' + (err.response?.data || err.message));
    } finally {
      setPayProcessing(false);
    }
  };

  const totalPendingAmount = pending.reduce((sum, p) => sum + (p.calculatedCommission || 0), 0);
  const totalPaidAmount = historyList.reduce((sum, h) => sum + (h.calculatedCommission || 0), 0);

  const labelClass = "block text-[11px] font-bold text-[#1E3A5F] mb-1";
  const inputClass = "w-full text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B44814]/20 focus:border-[#B44814] bg-white text-slate-900 font-semibold shadow-2xs";

  return (
    <div
      className="p-3 sm:p-4 w-full min-h-full font-sans text-xs"
      style={{
        background:
          'linear-gradient(135deg, #FDF2EE 0%, #FFFBF7 45%, #FEF3E2 100%)',
      }}
    >
      <div className="max-w-[1640px] mx-auto space-y-3">
      {/* Outer Aurora Container */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_28px_rgba(124,36,24,0.09)] border border-amber-200/75 overflow-hidden flex flex-col">
        
        {/* Aurora Sapphire Header Banner */}
        <div
          className="px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2"
          style={{
            background:
              'linear-gradient(125deg, #5A1A14 0%, #7C2418 46%, #B44814 82%, #B44814 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shadow-xs shrink-0">
              <Calculator className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight flex items-center gap-2">
                <span>पिग्मी एजंट कमिशन व्यवस्थापन</span>
                <span className="text-[11px] font-semibold text-amber-200 hidden sm:inline">(Pigmy Agent Commission Center)</span>
              </h2>
              <p className="text-[11px] text-amber-100/90 font-medium">एजंटनिहाय दर निश्चिती, दैनंदिन/मासिक कमिशन गणना, व्हाउचर नोंदणी व वाटप इतिहास</p>
            </div>
          </div>

          {message && (
            <div className={`px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-xs ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
              <span>{message.text}</span>
            </div>
          )}
        </div>

        <div className="p-3.5 space-y-3.5">

          {/* Aurora Segmented Tabs Navigation */}
          <div className="inline-flex flex-wrap items-center p-1 bg-[#FDF2EE] rounded-xl border border-amber-200/80 gap-1 print:hidden">
            <button
              type="button"
              onClick={() => setActiveTab('payouts')}
              className={`px-3 py-1.5 text-[11.5px] font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'payouts' ? 'bg-gradient-to-r from-[#B44814] to-[#B44814] text-white shadow-xs' : 'text-[#1E3A5F] hover:bg-white/80'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>१. कमिशन पेआउट (Payouts)</span>
              {pending.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9.5px] bg-amber-400 text-slate-900 font-extrabold ml-0.5">
                  {pending.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 text-[11.5px] font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'settings' ? 'bg-gradient-to-r from-[#B44814] to-[#B44814] text-white shadow-xs' : 'text-[#1E3A5F] hover:bg-white/80'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>२. कमिशन दर (Rates)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-[11.5px] font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'history' ? 'bg-gradient-to-r from-[#B44814] to-[#B44814] text-white shadow-xs' : 'text-[#1E3A5F] hover:bg-white/80'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>३. वाटप इतिहास (History)</span>
            </button>
          </div>

      {/* ==================== TAB 1: CALCULATION & PAYOUTS ==================== */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          
          {/* Controls & Filter Bar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs grid grid-cols-1 md:grid-cols-7 gap-3 print:hidden">
            <div>
              <label className={labelClass}>शाखा (Branch)</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                disabled={!isHOUser}
                className={inputClass}
              >
                {isHOUser && <option value={0}>सर्व शाखा (All Branches)</option>}
                {(isHOUser ? branches : branches.filter(b => b.branchID === lockedBranchId)).map(b => (
                  <option key={b.branchID} value={b.branchID}>{b.branchName} ({b.branchCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>पिग्मी एजंट (Agent)</label>
              <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className={inputClass}>
                <option value="ALL">सर्व एजंट (All Agents)</option>
                {agents
                  .filter(a => selectedBranchId === 0 || a.branchID === selectedBranchId)
                  .map(a => (
                    <option key={a.pigmyAgentID} value={a.pigmyAgentID}>{a.agentName}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>प्रॉडक्ट (Product)</label>
              <select value={selectedProductType} onChange={(e) => setSelectedProductType(e.target.value)} className={inputClass}>
                <option value="ALL">सर्व प्रॉडक्ट्स (All)</option>
                <option value="PIGMY">🪙 दैनिक ठेव (Pigmy)</option>
                <option value="LOAN">🏛️ कर्ज EMI (Loan)</option>
                <option value="RD">💵 आरडी (RD)</option>
                <option value="SAVING">💼 बचत ठेव (Saving)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>पासून दिनांक (From Date)</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>पर्यंत दिनांक (To Date)</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>वारंवारता (Frequency)</label>
              <select value={calcFreq} onChange={(e) => setCalcFreq(e.target.value)} className={inputClass}>
                <option value="DAILY">रोज (Daily)</option>
                <option value="MONTHLY">मासिक (Monthly)</option>
                <option value="CUSTOM">कालावधी (Custom Range)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleTriggerCalculation}
                disabled={loading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-2xs transition duration-200 text-xs flex items-center justify-center gap-1.5"
              >
                <Calculator className="w-4 h-4" />
                <span>{loading ? 'गणना होत आहे...' : 'कमिशन गणना करा'}</span>
              </button>
            </div>
          </div>

          {/* Pending Payouts Sheet Table */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-xs text-primary flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>प्रलंबित एजंट कमिशन वाटप सूची (Pending Payout Sheet)</span>
              </h3>
              <span className="text-xs font-extrabold text-[#9A3412] bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 font-mono">
                एकूण प्रलंबित कमिशन: ₹ {totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="overflow-x-auto border border-amber-200/80 rounded-xl">
              <table className="w-full text-left border-collapse text-[11px] leading-tight">
                <thead>
                  <tr className="bg-[#5A1A14] text-white font-bold whitespace-nowrap">
                    <th className="py-1.5 px-2.5 border-r border-white/15 whitespace-nowrap">एजंट नाव व कोड</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 whitespace-nowrap">प्रॉडक्ट</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 text-center whitespace-nowrap">कालावधी</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 text-center whitespace-nowrap">वारंवारता</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 text-right whitespace-nowrap">एकूण संकलन (₹)</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 text-right whitespace-nowrap">कमिशन (₹)</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 text-center whitespace-nowrap">स्थिती</th>
                    <th className="py-1.5 px-2.5 text-center whitespace-nowrap">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/70">
                  {pending.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                        कोणतेही कमिशन पेमेंट प्रलंबित नाही (No Pending Commission Payouts).
                      </td>
                    </tr>
                  ) : (
                    pending.map((p, idx) => (
                      <tr key={p.commissionId} className={`hover:bg-amber-50/50 transition ${idx % 2 === 1 ? 'bg-slate-50/45' : 'bg-white'}`}>
                        <td className="py-1 px-2.5 font-bold text-slate-900 whitespace-nowrap align-middle">
                          {p.agent?.agentName || `Agent ID: ${p.agentId}`}
                          {p.agent?.agentCode && <span className="ml-1 text-[10px] text-slate-500 font-mono">({p.agent.agentCode})</span>}
                        </td>
                        <td className="py-1 px-2.5 whitespace-nowrap align-middle">
                          <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                            p.productType === 'LOAN' ? 'bg-amber-100 text-[#7C2418] border border-amber-200' :
                            p.productType === 'RD' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            p.productType === 'SAVING' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {p.productType === 'LOAN' ? '🏛️ कर्ज' :
                             p.productType === 'RD' ? '💵 आरडी' :
                             p.productType === 'SAVING' ? '💼 बचत' :
                             '🪙 पिग्मी'}
                          </span>
                        </td>
                        <td className="py-1 px-2.5 text-center font-mono whitespace-nowrap align-middle">
                          {new Date(p.periodStartDate).toLocaleDateString('en-GB')} - {new Date(p.periodEndDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-1 px-2.5 text-center font-bold text-slate-600 whitespace-nowrap align-middle">
                          {p.calculationFrequency}
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap align-middle">
                          ₹ {(p.totalCollectionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-extrabold text-[#9A3412] bg-amber-50/50 whitespace-nowrap align-middle">
                          ₹ {(p.calculatedCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-2.5 text-center whitespace-nowrap align-middle">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-1 px-2.5 text-center whitespace-nowrap align-middle">
                          <button
                            onClick={() => {
                              setSelectedPayCommission(p);
                              setPaymentMode('CASH');
                              setBankLedgerId(0);
                              setReferenceNo('');
                              setSelectedAgentSbAccountId('');
                            }}
                            className="bg-gradient-to-r from-[#B44814] to-[#B44814] hover:opacity-95 text-white px-2.5 py-1 rounded-lg text-[10.5px] font-bold shadow-2xs transition inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>पेमेंट करा</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==================== TAB 2: COMMISSION SETTINGS ==================== */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Create Setting Form */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-primary border-b pb-2 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>कमिशन दर निश्चित करा (Add Rate Setting)</span>
            </h3>

            <form onSubmit={handleSaveSetting} className="space-y-3">
              <div>
                <label className={labelClass}>पिग्मी एजंट निवडा (Select Agent)</label>
                <select value={formAgentId} onChange={(e) => setFormAgentId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
                  <option value="">ग्लोबल (सर्व एजंट्ससाठी Default)</option>
                  {agents.map(a => (
                    <option key={a.pigmyAgentID} value={a.pigmyAgentID}>{a.agentName} ({a.agentCode || `#${a.pigmyAgentID}`})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>प्रॉडक्ट / उत्पादन निवडा (Product Type)</label>
                <select value={formProductType} onChange={(e) => setFormProductType(e.target.value)} className={inputClass}>
                  <option value="PIGMY">🪙 दैनिक ठेव (Pigmy Deposit)</option>
                  <option value="LOAN">🏛️ कर्ज वसुली (Loan EMI Collection)</option>
                  <option value="RD">💵 आवर्ती ठेव (RD Installment)</option>
                  <option value="SAVING">💼 बचत ठेव (Saving Deposit)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>कमिशन प्रकार (Commission Type)</label>
                <select value={formCommissionType} onChange={(e) => setFormCommissionType(e.target.value)} className={inputClass}>
                  <option value="PERCENTAGE">टक्केवारी (% Percentage on Collection)</option>
                  <option value="FIXED">ठराविक रक्कम (Fixed Amount ₹)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>कमिशन दर मूल्य (Commission Value)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formCommissionValue}
                  onChange={(e) => setFormCommissionValue(Number(e.target.value))}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>कमिशन गणना वारंवारता (Frequency)</label>
                <select value={formFrequency} onChange={(e) => setFormFrequency(e.target.value)} className={inputClass}>
                  <option value="DAILY">रोज (Daily Remittance)</option>
                  <option value="MONTHLY">मासिक (Monthly Settlement)</option>
                </select>
              </div>

              {formProductType === 'PIGMY' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formDeductPremature}
                      onChange={(e) => setFormDeductPremature(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-amber-600 rounded border-gray-300"
                    />
                    <span className="text-[11px] font-bold text-amber-950 leading-tight">
                      लॉक-इन कालावधीतील मुदतपूर्व पिग्मी विड्रॉल/क्लोजर संकलनातून वजा करा (Deduct Premature Withdrawals)
                    </span>
                  </label>
                  {formDeductPremature && (
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                        लॉक-इन दिवस (Premature Lock-In Days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1095}
                        value={formPrematureLockInDays}
                        onChange={(e) => setFormPrematureLockInDays(Math.max(1, Number(e.target.value) || 180))}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-primary hover:bg-[#7C2418] text-white font-extrabold rounded-xl shadow-2xs transition duration-200 text-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>सेटिंग सेव्ह करा (Save Rate)</span>
              </button>
            </form>
          </div>

          {/* Active Settings List Table */}
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-primary border-b pb-2 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-[#B44814]" />
              <span>सक्रिय एजंट कमिशन दर सूची (Active Commission Rates)</span>
            </h3>

            <div className="overflow-x-auto border border-gray-200 rounded-2xl">
              <table className="w-full text-left border-collapse leading-tight">
                <thead>
                  <tr className="border-b border-amber-400/30 text-amber-50 text-[11px] font-extrabold uppercase tracking-wider bg-[#5A1A14]">
                    <th className="py-1.5.5 px-2 whitespace-nowrap">लागू एजंट (Agent)</th>
                    <th className="py-1.5.5 px-2 whitespace-nowrap">प्रॉडक्ट (Product)</th>
                    <th className="py-1.5.5 px-2 text-center whitespace-nowrap">प्रकार (Type)</th>
                    <th className="py-1.5.5 px-2 text-right whitespace-nowrap">दर मूल्य (Commission Rate)</th>
                    <th className="py-1.5.5 px-2 text-center whitespace-nowrap">वारंवारता (Frequency)</th>
                    <th className="py-1.5.5 px-2 text-center whitespace-nowrap">कृती (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-xs">
                  {settings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500 font-bold">
                        कोणतीही सक्रिय कमिशन सेटिंग आढळली नाही.
                      </td>
                    </tr>
                  ) : (
                    settings.map((s) => (
                      <tr key={s.settingId} className="hover:bg-amber-50/40 transition">
                        <td className="py-1.5 px-2 font-bold text-gray-900 align-middle">
                          {s.agent ? `${s.agent.agentName} (${s.agent.agentCode || `#${s.agentId}`})` : 'सर्व एजंट्स (Default)'}
                        </td>
                        <td className="py-1.5 px-2 align-middle">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.productType === 'LOAN' ? 'bg-amber-100 text-[#7C2418] border border-amber-200' :
                            s.productType === 'RD' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            s.productType === 'SAVING' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {s.productType === 'LOAN' ? '🏛️ कर्ज (Loan)' :
                             s.productType === 'RD' ? '💵 आरडी (RD)' :
                             s.productType === 'SAVING' ? '💼 बचत (Saving)' :
                             '🪙 पिग्मी (Pigmy)'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center align-middle">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.commissionType === 'PERCENTAGE' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {s.commissionType === 'PERCENTAGE' ? 'टक्केवारी' : 'ठराविक'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-gray-800 align-middle">
                          {s.commissionType === 'PERCENTAGE' ? `${s.commissionValue}%` : `₹ ${s.commissionValue.toLocaleString('en-IN')}`}
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-gray-600 align-middle">
                          <div>{s.calculationFrequency}</div>
                          {(s.productType === 'PIGMY' || !s.productType) && s.deductPrematureWithdrawals && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold">
                              लॉक-इन वजावट: ≤{s.prematureLockInDays || 180} दि.
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => handleDeleteSetting(s.settingId)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="सेटिंग हटवा"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==================== TAB 3: PAID COMMISSION HISTORY ==================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          
          {/* History Filters */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs grid grid-cols-1 md:grid-cols-5 gap-3 print:hidden">
            <div>
              <label className={labelClass}>शाखा (Branch)</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                disabled={!isHOUser}
                className={inputClass}
              >
                {isHOUser && <option value={0}>सर्व शाखा (All Branches)</option>}
                {(isHOUser ? branches : branches.filter(b => b.branchID === lockedBranchId)).map(b => (
                  <option key={b.branchID} value={b.branchID}>{b.branchName} ({b.branchCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>पिग्मी एजंट (Agent)</label>
              <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className={inputClass}>
                <option value="ALL">सर्व एजंट (All Agents)</option>
                {agents
                  .filter(a => selectedBranchId === 0 || a.branchID === selectedBranchId)
                  .map(a => (
                    <option key={a.pigmyAgentID} value={a.pigmyAgentID}>{a.agentName}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>पासून दिनांक (From Date)</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>पर्यंत दिनांक (To Date)</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} />
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchHistory}
                className="w-full py-2 bg-primary hover:bg-[#7C2418] text-white font-extrabold rounded-xl shadow-2xs transition duration-200 text-xs flex items-center justify-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>शोधा (Apply Filter)</span>
              </button>
            </div>
          </div>

          {/* History List Table */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-xs text-primary flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                <span>अदा केलेले कमिशन व्हाउचर इतिहास (Paid Commission History)</span>
              </h3>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 font-mono">
                एकूण अदा कमिशन: ₹ {totalPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="overflow-x-auto border border-amber-200/80 rounded-xl">
              <table className="w-full text-left border-collapse text-[11px] leading-tight">
                <thead>
                  <tr className="bg-[#5A1A14] text-white font-bold whitespace-nowrap">
                    <th className="py-1.5 px-2.5 border-r border-white/15 whitespace-nowrap">व्हाउचर क्र.</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 whitespace-nowrap">एजंट नाव</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 whitespace-nowrap">प्रॉडक्ट</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 text-center whitespace-nowrap">कालावधी</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 text-right whitespace-nowrap">एकूण संकलन (₹)</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 text-right whitespace-nowrap">अदा कमिशन (₹)</th>
                    <th className="py-1.5 px-2.5 border-r border-white/15 text-center whitespace-nowrap">स्थिती</th>
                    <th className="py-1.5 px-2.5 text-center whitespace-nowrap">पावती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/70">
                  {historyList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                        निवडलेल्या कालावधीत कोणतेही अदा केलेले कमिशन आढळले नाही.
                      </td>
                    </tr>
                  ) : (
                    historyList.map((h, idx) => (
                      <tr key={h.commissionId} className={`hover:bg-amber-50/50 transition ${idx % 2 === 1 ? 'bg-slate-50/45' : 'bg-white'}`}>
                        <td className="py-1 px-2.5 font-mono font-bold text-[#9A3412] whitespace-nowrap align-middle">{h.voucherNo || '-'}</td>
                        <td className="py-1 px-2.5 font-bold text-slate-900 whitespace-nowrap align-middle">
                          {h.agentName} {h.agentCode && <span className="text-[10px] text-slate-500 font-mono">({h.agentCode})</span>}
                        </td>
                        <td className="py-1 px-2.5 whitespace-nowrap align-middle">
                          <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                            h.productType === 'LOAN' ? 'bg-amber-100 text-[#7C2418] border border-amber-200' :
                            h.productType === 'RD' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            h.productType === 'SAVING' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {h.productType === 'LOAN' ? '🏛️ कर्ज' :
                             h.productType === 'RD' ? '💵 आरडी' :
                             h.productType === 'SAVING' ? '💼 बचत' :
                             '🪙 पिग्मी'}
                          </span>
                        </td>
                        <td className="py-1 px-2.5 text-center font-mono whitespace-nowrap align-middle">
                          {new Date(h.periodStartDate).toLocaleDateString('en-GB')} - {new Date(h.periodEndDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap align-middle">
                          ₹ {(h.totalCollectionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-extrabold text-emerald-700 bg-emerald-50/50 whitespace-nowrap align-middle">
                          ₹ {(h.calculatedCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-2.5 text-center whitespace-nowrap align-middle">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {h.status}
                          </span>
                        </td>
                        <td className="py-1 px-2.5 text-center whitespace-nowrap align-middle">
                          <button
                            onClick={() => setPrintCommission(h)}
                            className="p-1 text-[#B44814] hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            title="पावती प्रिंट करा"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==================== PAYMENT EXECUTION MODAL ==================== */}
      {selectedPayCommission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-xl border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-sm text-primary flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>एजंट कमिशन वाटप व्हाउचर (Pay Commission)</span>
              </h3>
              <button onClick={() => setSelectedPayCommission(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">एजंटचे नाव:</span>
                <span className="font-bold text-gray-900">{selectedPayCommission.agent?.agentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">कलेक्शन कालावधी:</span>
                <span className="font-mono font-bold text-gray-800">
                  {new Date(selectedPayCommission.periodStartDate).toLocaleDateString('en-GB')} ते {new Date(selectedPayCommission.periodEndDate).toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">एकूण संकलित ठेव:</span>
                <span className="font-mono font-bold text-gray-800">
                  ₹ {(selectedPayCommission.totalCollectionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="font-bold text-gray-700">देय कमिशन रक्कम:</span>
                <span className="font-mono font-extrabold text-emerald-700 text-base">
                  ₹ {(selectedPayCommission.calculatedCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className={labelClass}>पेमेंट माध्यम निवडा (Payment Mode)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    className={`py-2 px-2 rounded-xl font-bold border text-center transition ${
                      paymentMode === 'CASH' ? 'bg-primary text-white border-primary shadow-2xs' : 'bg-gray-50 text-gray-700 border-gray-300'
                    }`}
                  >
                    💵 रोख (Cash)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('AGENT_SB')}
                    className={`py-2 px-2 rounded-xl font-bold border text-center transition ${
                      paymentMode === 'AGENT_SB' ? 'bg-primary text-white border-primary shadow-2xs' : 'bg-gray-50 text-gray-700 border-gray-300'
                    }`}
                  >
                    💳 एजंट SB खाते
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('BANK')}
                    className={`py-2 px-2 rounded-xl font-bold border text-center transition ${
                      paymentMode === 'BANK' ? 'bg-primary text-white border-primary shadow-2xs' : 'bg-gray-50 text-gray-700 border-gray-300'
                    }`}
                  >
                    🏦 बँक ट्रान्सफर
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>पेमेंट / व्हाउचर तारीख (Payment Date)</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              {paymentMode === 'AGENT_SB' && (
                <div>
                  <label className={labelClass}>एजंटचे बचत खाते निवडा (Agent Savings Account)</label>
                  <select
                    value={selectedAgentSbAccountId}
                    onChange={(e) => setSelectedAgentSbAccountId(e.target.value ? Number(e.target.value) : '')}
                    className={inputClass}
                  >
                    <option value="">-- बचत खाते निवडा --</option>
                    {savingAccounts.map(a => (
                      <option key={a.savingAccountID} value={a.savingAccountID}>
                        {a.accountNo} - {a.customerName || 'एजंट बचत खाते'} (शिल्लक: ₹{a.currentBalance ?? a.totalBalance ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {paymentMode === 'BANK' && (
                <div className="space-y-2.5 p-3 bg-amber-50/50 border border-amber-200 rounded-xl">
                  <BankLedgerSelect
                    value={bankLedgerId}
                    onChange={setBankLedgerId}
                    showCountBadge
                  />
                  <div>
                    <label className={labelClass}>UTR / चेक संदर्भ क्र. (UTR / Cheque Ref No - ऐच्छिक)</label>
                    <input
                      type="text"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder="उदा. UTR12345678 / Chq No."
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPayCommission(null)}
                className="w-1/2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={payProcessing}
                className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition shadow-2xs"
              >
                {payProcessing ? 'प्रक्रिया होत आहे...' : 'पेमेंट नक्की करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PRINTABLE ADVICE MODAL ==================== */}
      {printCommission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-gray-200 print:shadow-none print:border-0 print:p-0">
            
            <div className="flex justify-between items-center border-b pb-3 print:hidden">
              <h3 className="font-extrabold text-sm text-primary flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />
                <span>एजंट कमिशन वाटप व्हाउचर पावती (Commission Advice)</span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-primary text-white rounded-xl text-xs font-bold shadow-2xs"
                >
                  प्रिंट (Print)
                </button>
                <button onClick={() => setPrintCommission(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="border-2 border-black p-5 space-y-4 rounded-xl text-black">
              <div className="text-center border-b border-black pb-3">
                <h2 className="text-lg font-extrabold uppercase">{sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}</h2>
                <p className="text-xs font-semibold">{sansthaDetail?.address || 'मुख्य कार्यालय'}</p>
                <h3 className="text-sm font-bold text-primary mt-1 uppercase underline">पिग्मी एजंट कमिशन देयक / व्हाउचर पावती</h3>
              </div>

              <div className="grid grid-cols-2 text-xs space-y-1">
                <div><strong>व्हाउचर क्रमांक:</strong> {printCommission.voucherNo || '-'}</div>
                <div className="text-right"><strong>दिनांक:</strong> {new Date(printCommission.calculatedOn).toLocaleDateString('en-GB')}</div>
                <div><strong>एजंटचे नाव:</strong> {printCommission.agentName}</div>
                <div className="text-right"><strong>एजंट कोड:</strong> {printCommission.agentCode || '-'}</div>
                <div className="col-span-2 border-t pt-1 mt-1">
                  <strong>संकलन कालावधी:</strong> {new Date(printCommission.periodStartDate).toLocaleDateString('en-GB')} ते {new Date(printCommission.periodEndDate).toLocaleDateString('en-GB')} ({printCommission.calculationFrequency})
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-[11px] leading-tight">
                <thead>
                  <tr className="border-b border-black bg-[#5A1A14] font-bold text-amber-50">
                    <th className="border-r border-black px-2 py-1.5 text-left whitespace-nowrap">तपशील (Particulars)</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">रक्कम (₹ Amount)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black">
                    <td className="border-r border-black px-2 py-1 align-middle">कालावधीतील एकूण संकलित पिग्मी ठेव (Total Remittance)</td>
                    <td className="px-2 py-1 text-right font-mono font-bold align-middle">₹ {printCommission.totalCollectionAmount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-black px-2 py-1 font-bold align-middle">अदा करण्यात आलेले कमिशन (Net Commission Paid)</td>
                    <td className="px-2 py-1 text-right font-mono font-extrabold text-sm align-middle">₹ {printCommission.calculatedCommission.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="pt-8 flex justify-between text-xs font-bold text-gray-800">
                <div className="text-center">
                  <p className="border-t border-black px-4 pt-1">एजंटची स्वाक्षरी</p>
                </div>
                <div className="text-center">
                  <p className="border-t border-black px-4 pt-1">कॅशियर / व्यवस्थापक</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
      </div>
    </div>
  );
}
