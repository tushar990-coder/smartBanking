import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  commissionType: string;
  commissionValue: number;
  calculationFrequency: string;
  isActive: boolean;
}

interface PendingCommission {
  commissionId: number;
  agentId: number;
  agent?: { agentName: string; agentCode?: string };
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
  memberID: number;
  member?: { memberName: string };
  totalBalance: number;
}

export default function AgentCommissionMaster() {
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
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 0;

  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId);
  const [selectedAgentId, setSelectedAgentId] = useState<number | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState<string>(firstDayOfMonth);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [calcFreq, setCalcFreq] = useState<string>('DAILY');

  // New Setting Form State
  const [formAgentId, setFormAgentId] = useState<number | ''>('');
  const [formCommissionType, setFormCommissionType] = useState<string>('PERCENTAGE');
  const [formCommissionValue, setFormCommissionValue] = useState<number>(2.5);
  const [formFrequency, setFormFrequency] = useState<string>('DAILY');

  // Payment Modal State
  const [selectedPayCommission, setSelectedPayCommission] = useState<PendingCommission | null>(null);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK' | 'AGENT_SB'>('CASH');
  const [selectedAgentSbAccountId, setSelectedAgentSbAccountId] = useState<number | ''>('');
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
        commissionType: formCommissionType,
        commissionValue: formCommissionValue,
        calculationFrequency: formFrequency
      });

      setMessage({ text: 'एजंट कमिशन दर यशस्वीरीत्या सेव्ह झाला!', type: 'success' });
      fetchSettings();
      setFormAgentId('');
      setFormCommissionValue(2.5);
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
        agentId: selectedAgentId !== 'ALL' ? Number(selectedAgentId) : null
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

    setPayProcessing(true);
    try {
      const res = await axios.post('/api/AgentCommission/Pay', {
        commissionId: selectedPayCommission.commissionId,
        branchId: selectedBranchId > 0 ? selectedBranchId : 1,
        paymentMode: paymentMode,
        agentSavingAccountId: selectedAgentSbAccountId !== '' ? Number(selectedAgentSbAccountId) : null
      });

      setMessage({ 
        text: `कमिशन वाटप यशस्वी! व्हाउचर क्र.: ${res.data.voucherNo}`, 
        type: 'success' 
      });

      setSelectedPayCommission(null);
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

  const labelClass = "block text-xs font-bold text-gray-700 mb-1";
  const inputClass = "w-full text-xs border border-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary bg-white text-gray-900 font-semibold shadow-2xs";

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        
        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-200" />
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                <span>पिग्मी एजंट कमिशन व्यवस्थापन (Pigmy Agent Commission Center)</span>
              </h2>
              <p className="text-[10px] text-blue-100 font-normal">एजंटनिहाय दर निश्चिती, दैनंदिन/मासिक कमिशन गणना, व्हाउचर नोंदणी व वाटप इतिहास</p>
            </div>
          </div>

          {message && (
            <div className={`px-2.5 py-0.5 rounded-sm font-bold text-xs flex items-center gap-1 ${
              message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
              <span>{message.text}</span>
            </div>
          )}
        </div>

        <div className="p-3 space-y-3">

          {/* Tabs Navigation */}
          <div className="inline-flex items-center p-0.5 bg-gray-100/90 rounded-sm border border-gray-300 gap-0.5 print:hidden">
            <button
              type="button"
              onClick={() => setActiveTab('payouts')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'payouts' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <Calculator className="w-3 h-3" />
              <span>१. कमिशन पेआउट (Payouts)</span>
              {pending.length > 0 && (
                <span className="px-1 py-0.1 rounded-full text-[9px] bg-amber-400 text-slate-900 font-bold ml-0.5">
                  {pending.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'settings' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <Settings className="w-3 h-3" />
              <span>२. कमिशन दर (Rates)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'history' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <History className="w-3 h-3" />
              <span>३. वाटप इतिहास (History)</span>
            </button>
          </div>

      {/* ==================== TAB 1: CALCULATION & PAYOUTS ==================== */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          
          {/* Controls & Filter Bar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs grid grid-cols-1 md:grid-cols-6 gap-3 print:hidden">
            <div>
              <label className={labelClass}>शाखा (Branch)</label>
              <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(Number(e.target.value))} className={inputClass}>
                <option value={0}>सर्व शाखा (All Branches)</option>
                {branches.map(b => (
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
              <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200 font-mono">
                एकूण प्रलंबित कमिशन: ₹ {totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-700 text-[11px] font-extrabold uppercase tracking-wider bg-gray-100/80">
                    <th className="py-2.5 px-3">एजंट नाव व कोड (Agent)</th>
                    <th className="py-2.5 px-3 text-center">कालावधी (Collection Period)</th>
                    <th className="py-2.5 px-3 text-center">वारंवारता</th>
                    <th className="py-2.5 px-3 text-right">एकूण संकलित पिग्मी (Total Collection ₹)</th>
                    <th className="py-2.5 px-3 text-right">गणित केलेले कमिशन (Commission ₹)</th>
                    <th className="py-2.5 px-3 text-center">स्थिती (Status)</th>
                    <th className="py-2.5 px-3 text-center">कृती (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {pending.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-500 font-bold">
                        कोणतेही कमिशन पेमेंट प्रलंबित नाही (No Pending Commission Payouts).
                      </td>
                    </tr>
                  ) : (
                    pending.map((p) => (
                      <tr key={p.commissionId} className="hover:bg-blue-50/40 transition">
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          {p.agent?.agentName || `Agent ID: ${p.agentId}`}
                          {p.agent?.agentCode && <span className="text-[10px] text-gray-500 block font-mono">({p.agent.agentCode})</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {new Date(p.periodStartDate).toLocaleDateString('en-GB')} ते {new Date(p.periodEndDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-gray-600">
                          {p.calculationFrequency}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-800">
                          ₹ {(p.totalCollectionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-blue-700 bg-blue-50/50 text-sm">
                          ₹ {(p.calculatedCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setSelectedPayCommission(p)}
                            className="bg-primary hover:bg-[#004a75] text-white px-3 py-1 rounded-xl text-xs font-extrabold shadow-2xs transition flex items-center justify-center gap-1 mx-auto"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>पेमेंट करा व व्हाउचर बनवा</span>
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
                <label className={labelClass}>कमिशन प्रकार (Commission Type)</label>
                <select value={formCommissionType} onChange={(e) => setFormCommissionType(e.target.value)} className={inputClass}>
                  <option value="PERCENTAGE">टक्केवारी (% Percentage on Remittance)</option>
                  <option value="FIXED">ठराविक रक्कम (Fixed Slab Amount ₹)</option>
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

              <button
                type="submit"
                className="w-full py-2 bg-primary hover:bg-[#004a75] text-white font-extrabold rounded-xl shadow-2xs transition duration-200 text-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>सेटिंग सेव्ह करा (Save Rate)</span>
              </button>
            </form>
          </div>

          {/* Active Settings List Table */}
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-primary border-b pb-2 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-blue-600" />
              <span>सक्रिय एजंट कमिशन दर सूची (Active Commission Rates)</span>
            </h3>

            <div className="overflow-x-auto border border-gray-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-700 text-[11px] font-extrabold uppercase tracking-wider bg-gray-100/80">
                    <th className="py-2.5 px-3">लागू एजंट (Agent)</th>
                    <th className="py-2.5 px-3 text-center">प्रकार (Type)</th>
                    <th className="py-2.5 px-3 text-right">दर मूल्य (Commission Rate)</th>
                    <th className="py-2.5 px-3 text-center">वारंवारता (Frequency)</th>
                    <th className="py-2.5 px-3 text-center">कृती (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {settings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 font-bold">
                        कोणतीही सक्रिय कमिशन सेटिंग आढळली नाही.
                      </td>
                    </tr>
                  ) : (
                    settings.map((s) => (
                      <tr key={s.settingId} className="hover:bg-blue-50/40 transition">
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          {s.agent ? `${s.agent.agentName} (${s.agent.agentCode || ''})` : 'ग्लोबल (सर्व एजंट्ससाठी Default)'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-gray-700">
                          {s.commissionType === 'PERCENTAGE' ? 'टक्केवारी (%)' : 'ठराविक रक्कम (₹)'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700 text-sm">
                          {s.commissionValue} {s.commissionType === 'PERCENTAGE' ? '%' : '₹'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-gray-600">
                          {s.calculationFrequency === 'DAILY' ? 'रोज (Daily)' : 'मासिक (Monthly)'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDeleteSetting(s.settingId)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="हटवा"
                          >
                            <Trash2 className="w-4 h-4" />
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
              <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(Number(e.target.value))} className={inputClass}>
                <option value={0}>सर्व शाखा (All Branches)</option>
                {branches.map(b => (
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
                className="w-full py-2 bg-primary hover:bg-[#004a75] text-white font-extrabold rounded-xl shadow-2xs transition duration-200 text-xs flex items-center justify-center gap-1.5"
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

            <div className="overflow-x-auto border border-gray-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-700 text-[11px] font-extrabold uppercase tracking-wider bg-gray-100/80">
                    <th className="py-2.5 px-3">व्हाउचर क्र. (Voucher No)</th>
                    <th className="py-2.5 px-3">एजंट नाव (Agent Name)</th>
                    <th className="py-2.5 px-3 text-center">कालावधी (Period)</th>
                    <th className="py-2.5 px-3 text-right">एकूण पिग्मी जमा (Total Collection ₹)</th>
                    <th className="py-2.5 px-3 text-right">अदा कमिशन (Paid Commission ₹)</th>
                    <th className="py-2.5 px-3 text-center">स्थिती (Status)</th>
                    <th className="py-2.5 px-3 text-center">पावती (Print)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {historyList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-500 font-bold">
                        निवडलेल्या कालावधीत कोणतेही अदा केलेले कमिशन आढळले नाही.
                      </td>
                    </tr>
                  ) : (
                    historyList.map((h) => (
                      <tr key={h.commissionId} className="hover:bg-blue-50/40 transition">
                        <td className="py-2.5 px-3 font-mono font-extrabold text-gray-900">{h.voucherNo || '-'}</td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          {h.agentName} {h.agentCode && <span className="text-[10px] text-gray-500 font-mono">({h.agentCode})</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {new Date(h.periodStartDate).toLocaleDateString('en-GB')} ते {new Date(h.periodEndDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-800">
                          ₹ {(h.totalCollectionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700 bg-emerald-50/50 text-sm">
                          ₹ {(h.calculatedCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {h.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setPrintCommission(h)}
                            className="p-1.5 text-primary hover:bg-blue-50 rounded-lg transition"
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

            <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200 space-y-1.5 text-xs">
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
                        {a.accountNo} - {a.member?.memberName} (शिल्लक: ₹{a.totalBalance})
                      </option>
                    ))}
                  </select>
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

              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="border-b border-black bg-gray-100 font-bold">
                    <th className="border-r border-black p-2 text-left">तपशील (Particulars)</th>
                    <th className="p-2 text-right">रक्कम (₹ Amount)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black">
                    <td className="border-r border-black p-2">कालावधीतील एकूण संकलित पिग्मी ठेव (Total Remittance)</td>
                    <td className="p-2 text-right font-mono font-bold">₹ {printCommission.totalCollectionAmount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-black p-2 font-bold">अदा करण्यात आलेले कमिशन (Net Commission Paid)</td>
                    <td className="p-2 text-right font-mono font-extrabold text-sm">₹ {printCommission.calculatedCommission.toFixed(2)}</td>
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
  );
}
