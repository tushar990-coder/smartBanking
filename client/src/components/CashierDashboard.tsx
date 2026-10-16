import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  PlusCircle, 
  Calculator, 
  Coins, 
  ShieldCheck, 
  ArrowRightLeft, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Building, 
  Sparkles,
  Search,
  Filter,
  Receipt,
  FileSpreadsheet,
  Settings,
  Scale,
  Printer,
  Save,
  Check,
  RotateCcw,
  Calendar,
  Layers
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

const fmt = (n: number) => '₹ ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CashierDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
  initialTab?: 'dashboard' | 'allocation' | 'denomination' | 'register';
}

export default function CashierDashboard({ onNavigate, initialTab = 'dashboard' }: CashierDashboardProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'allocation' | 'denomination' | 'register'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(user?.branchID || 1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  
  const [summary, setSummary] = useState<any>({
    totalCashiers: 0,
    activeCounters: 0,
    headCashierName: 'मुख्य कॅशिअर',
    mainVaultLedgerName: 'मुख्य रोख खाते',
    totalAllocatedToTellers: 0,
    totalReturnedToHead: 0,
    netCashWithTellers: 0,
    todayCashReceipts: 0,
    todayCashPayments: 0,
    todayNetCashFlow: 0,
    totalPhysicalCashCounted: 0
  });

  const [cashiers, setCashiers] = useState<any[]>([]);
  const [recentAllocations, setRecentAllocations] = useState<any[]>([]);
  const [showAddCashierModal, setShowAddCashierModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Cashier Form
  const [newCashier, setNewCashier] = useState({
    cashierName: '',
    counterNumber: 'कॅश काउंटर १',
    cashLedgerId: 0,
    maxCashLimit: 500000,
    isHeadCashier: false,
    remarks: ''
  });

  // Allocation Form State (Tab 2)
  const [allocationType, setAllocationType] = useState<'HEAD_TO_TELLER' | 'TELLER_TO_HEAD' | 'TELLER_TO_TELLER'>('HEAD_TO_TELLER');
  const [allocationFormData, setAllocationFormData] = useState({
    fromCashierId: 0,
    toCashierId: 0,
    amount: '',
    remarks: ''
  });
  const [allocating, setAllocating] = useState(false);

  // Denomination Form State (Tab 3)
  const [denomCashierId, setDenomCashierId] = useState<number>(0);
  const [denomEntryType, setDenomEntryType] = useState<string>('CLOSING');
  const [denomCounts, setDenomCounts] = useState({
    count2000: 0,
    count500: 0,
    count200: 0,
    count100: 0,
    count50: 0,
    count20: 0,
    count10: 0,
    count5: 0,
    countCoins: 0
  });
  const [denomRemarks, setDenomRemarks] = useState('');
  const [savingDenom, setSavingDenom] = useState(false);

  // Sync with global auth branch changes
  useEffect(() => {
    if (user?.branchID) {
      setSelectedBranchId(user.branchID);
    }
  }, [user?.branchID]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Branches list
      const branchesRes = await api.get('/Branches');
      setBranches(branchesRes.data || []);

      // 2. Load Dashboard Summary for selected branch
      const sumRes = await api.get(`/CashManagement/DashboardSummary?branchId=${selectedBranchId}&date=${selectedDate}`);
      setSummary(sumRes.data || {});

      // 3. Load Cashiers List for selected branch
      const cashiersRes = await api.get(`/CashManagement/Cashiers?branchId=${selectedBranchId}`);
      const cashiersList = cashiersRes.data || [];
      setCashiers(cashiersList);

      // Default cashier IDs for allocation form
      const head = cashiersList.find((c: any) => c.isHeadCashier ?? c.IsHeadCashier);
      const regular = cashiersList.filter((c: any) => !(c.isHeadCashier ?? c.IsHeadCashier));
      if (head && (!allocationFormData.fromCashierId || allocationFormData.fromCashierId === 0)) {
        const headId = head.id ?? head.Id ?? 0;
        const regularId = regular.length > 0 ? (regular[0].id ?? regular[0].Id ?? 0) : 0;
        setAllocationFormData(prev => ({
          ...prev,
          fromCashierId: headId,
          toCashierId: regularId
        }));
      }
      if (!denomCashierId && cashiersList.length > 0) {
        setDenomCashierId(cashiersList[0].id ?? cashiersList[0].Id ?? 0);
      }

      // 4. Load Ledgers
      const ledgersRes = await api.get('/Ledgers');
      setLedgers(ledgersRes.data || []);

      // 5. Load Recent Allocations for selected branch
      const allocRes = await api.get(`/CashManagement/Allocations?branchId=${selectedBranchId}&fromDate=${selectedDate}&toDate=${selectedDate}`);
      setRecentAllocations(allocRes.data || []);
    } catch (err) {
      console.error('Error loading cash management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranchId, selectedDate]);

  const handleSeedDefaults = async () => {
    try {
      await api.post(`/CashManagement/SeedDefaults?branchId=${selectedBranchId}`);
      setSuccessMsg('डीफॉल्ट कॅश काउंटर्स यशस्वीरित्या तयार झाले!');
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error seeding defaults:', err);
    }
  };

  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCashier.cashierName.trim()) return;
    try {
      await api.post('/CashManagement/Cashiers', {
        ...newCashier,
        branchId: selectedBranchId
      });
      setShowAddCashierModal(false);
      setNewCashier({
        cashierName: '',
        counterNumber: 'कॅश काउंटर १',
        cashLedgerId: 0,
        maxCashLimit: 500000,
        isHeadCashier: false,
        remarks: ''
      });
      setSuccessMsg('नवीन कॅश काउंटर यशस्वीरित्या नोंदवला गेला!');
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error creating cashier:', err);
    }
  };

  // Allocation Submission
  const handleAllocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const amt = parseFloat(allocationFormData.amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('कृपया वैध रक्कम प्रविष्ट करा.');
      return;
    }
    if (allocationFormData.fromCashierId === allocationFormData.toCashierId) {
      setErrorMsg('रक्कम देणारा आणि घेणारा कॅशिअर एकच असू शकत नाही.');
      return;
    }

    try {
      setAllocating(true);
      await api.post('/CashManagement/Allocations', {
        branchId: selectedBranchId,
        fromCashierId: allocationFormData.fromCashierId,
        toCashierId: allocationFormData.toCashierId,
        amount: amt,
        allocationDate: selectedDate,
        allocationType: allocationType,
        status: 'ACCEPTED',
        remarks: allocationFormData.remarks || (allocationType === 'HEAD_TO_TELLER' ? 'तिजोरीतून वाटप' : 'तिजोरीत परतावा'),
        isReturn: allocationType === 'TELLER_TO_HEAD',
        createdBy: user?.username || 'System'
      });

      setSuccessMsg(`₹ ${amt.toLocaleString('en-IN')} ची रोख रक्कम यशस्वीरित्या हस्तांतरित झाली!`);
      setAllocationFormData(prev => ({ ...prev, amount: '', remarks: '' }));
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Error allocating cash:', err);
      setErrorMsg(err.response?.data?.message || 'रोख हस्तांतरण अयशस्वी झाले. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setAllocating(false);
    }
  };

  // Denominations Calculation
  const denominationsList = [
    { key: 'count2000', label: '₹ २०००', value: 2000 },
    { key: 'count500', label: '₹ ५००', value: 500 },
    { key: 'count200', label: '₹ २००', value: 200 },
    { key: 'count100', label: '₹ १००', value: 100 },
    { key: 'count50', label: '₹ ५०', value: 50 },
    { key: 'count20', label: '₹ २०', value: 20 },
    { key: 'count10', label: '₹ १०', value: 10 },
    { key: 'count5', label: '₹ ५', value: 5 },
    { key: 'countCoins', label: 'नाणी (Coins)', value: 1, isCoin: true }
  ];

  const totalPhysicalAmount = 
    (denomCounts.count2000 * 2000) +
    (denomCounts.count500 * 500) +
    (denomCounts.count200 * 200) +
    (denomCounts.count100 * 100) +
    (denomCounts.count50 * 50) +
    (denomCounts.count20 * 20) +
    (denomCounts.count10 * 10) +
    (denomCounts.count5 * 5) +
    (Number(denomCounts.countCoins) || 0);

  const totalNotesCount = 
    denomCounts.count2000 +
    denomCounts.count500 +
    denomCounts.count200 +
    denomCounts.count100 +
    denomCounts.count50 +
    denomCounts.count20 +
    denomCounts.count10 +
    denomCounts.count5;

  const currentDenomCashierObj = cashiers.find(c => c.Id === denomCashierId);
  const expectedAmount = currentDenomCashierObj ? (currentDenomCashierObj.CurrentBalance || 0) : 0;
  const difference = totalPhysicalAmount - expectedAmount;

  const handleDenomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (denomCashierId <= 0) {
      setErrorMsg('कृपया कॅशिअर निवडा.');
      return;
    }

    try {
      setSavingDenom(true);
      await api.post('/CashManagement/Denominations', {
        branchId: selectedBranchId,
        cashierId: denomCashierId,
        denominationDate: selectedDate,
        entryType: denomEntryType,
        ...denomCounts,
        expectedAmount: expectedAmount,
        remarks: denomRemarks,
        verifiedBy: user?.username || 'System'
      });

      setSuccessMsg('नोटांची मोजणी (Denominations) यशस्वीरित्या जतन झाली!');
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Error saving denominations:', err);
      setErrorMsg(err.response?.data?.message || 'नोटांची मोजणी जतन करताना त्रुटी आली.');
    } finally {
      setSavingDenom(false);
    }
  };

  const handleResetDenom = () => {
    setDenomCounts({
      count2000: 0,
      count500: 0,
      count200: 0,
      count100: 0,
      count50: 0,
      count20: 0,
      count10: 0,
      count5: 0,
      countCoins: 0
    });
    setDenomRemarks('');
  };

  const handleQuickAllocationSwitch = (toId: number) => {
    const head = cashiers.find(c => c.IsHeadCashier);
    setAllocationType('HEAD_TO_TELLER');
    setAllocationFormData({
      fromCashierId: head ? head.Id : 0,
      toCashierId: toId,
      amount: '',
      remarks: ''
    });
    setActiveTab('allocation');
  };

  const handleQuickDenomSwitch = (cId: number) => {
    setDenomCashierId(cId);
    setActiveTab('denomination');
  };

  return (
    <div className="p-3 max-w-full h-full flex flex-col font-sans overflow-y-auto text-slate-800">
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        
        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-4 py-3 text-white flex flex-col md:flex-row md:items-center md:justify-between shadow-xs gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Coins size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-wide">
                  कॅश मॅनेजमेंट व कॅशिअर विंडो (Cash Management & Cashier Window)
                </h1>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.2 rounded-full border border-white/30">
                  लाईव्ह रोख नियंत्रण
                </span>
              </div>
              <p className="text-[11px] text-white/80 font-normal mt-0.5">
                बँक तिजोरी, काउंटर रोख वाटप, टेलर व्यवहार व दैनंदिन नोटा ताळेबंद (Live Cash Control & Counter Governance)
              </p>
            </div>
          </div>

          {/* Action & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {branches.length > 1 && (
              <div className="flex items-center gap-1.5 bg-white/15 border border-white/25 rounded-sm px-2.5 py-1 text-white font-bold">
                <Building size={13} className="text-white/80" />
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  className="bg-transparent font-bold text-white outline-none cursor-pointer text-xs"
                >
                  {branches.map((b, idx) => {
                    const bId = b.branchID ?? b.BranchID ?? b.id ?? idx;
                    const bName = b.branchName ?? b.BranchName ?? `शाखा ${bId}`;
                    return (
                      <option key={`cd-branch-${bId}`} value={bId} className="text-slate-800 bg-white">
                        {bName}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="flex items-center bg-white/15 border border-white/25 rounded-sm px-2 py-1 text-white text-xs">
              <Clock size={13} className="mr-1.5 text-white/80" />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-bold text-white outline-none cursor-pointer"
              />
            </div>

            <button 
              onClick={loadData}
              title="रिफ्रेश करा"
              className="flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-sm text-xs font-semibold border border-white/25 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">रिफ्रेश</span>
            </button>

            <button 
              onClick={() => onNavigate && onNavigate('settings', { category: 'schemes', sub: 'cash-scheme-sub' })}
              title="कॅश योजना व लेजर मॅपिंग सेटिंग्ज"
              className="flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-sm text-xs font-semibold border border-white/25 transition-colors cursor-pointer"
            >
              <Settings size={13} />
              <span className="hidden sm:inline">योजना सेटिंग</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-sm border bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-bold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
          </div>
        )}

        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-sm border bg-rose-50 text-rose-800 border-rose-300 text-xs font-bold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={15} className="text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900 font-bold">✕</button>
          </div>
        )}

        {/* Standard Module Tab Strip */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2 gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-3.5 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'border-primary text-primary bg-white shadow-2xs rounded-t-sm'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Wallet size={14} />
            <span>१. कॅश डॅशबोर्ड व काउंटर्स (Overview & Counters)</span>
          </button>

          <button
            onClick={() => setActiveTab('allocation')}
            className={`py-2 px-3.5 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'allocation'
                ? 'border-primary text-primary bg-white shadow-2xs rounded-t-sm'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ArrowRightLeft size={14} />
            <span>२. रोख वाटप व हस्तांतरण (Cash Allocation)</span>
          </button>

          <button
            onClick={() => setActiveTab('denomination')}
            className={`py-2 px-3.5 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'denomination'
                ? 'border-primary text-primary bg-white shadow-2xs rounded-t-sm'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Calculator size={14} />
            <span>३. नोटांची मोजणी व ताळेबंद (Denomination Tally)</span>
          </button>

          <button
            onClick={() => setActiveTab('register')}
            className={`py-2 px-3.5 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'border-primary text-primary bg-white shadow-2xs rounded-t-sm'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>४. आजची रोख व्यवहार नोंदवही (Movement Register)</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: CASH DASHBOARD OVERVIEW & COUNTERS GRID                             */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div className="p-4 space-y-4">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Total Cash In Hand with Tellers */}
              <div className="bg-white p-3.5 rounded-sm border border-gray-200 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">टेलर्सकडील रोख रक्कम</span>
                  <div className="w-7 h-7 rounded-sm bg-primary/10 text-primary flex items-center justify-center">
                    <Coins size={16} />
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-black text-slate-900 mb-0.5">
                  {fmt(summary.netCashWithTellers || 0)}
                </div>
                <div className="flex items-center gap-1 text-[10.5px] text-gray-500">
                  <span className="text-primary font-bold">{summary.activeCounters || 0}</span> कार्यरत काउंटर्सकडे दिलेली रक्कम
                </div>
                <div className="absolute top-0 right-0 h-1 w-full bg-primary" />
              </div>

              {/* Card 2: Today's Receipts */}
              <div className="bg-white p-3.5 rounded-sm border border-gray-200 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">आजची रोख जमा (Receipts)</span>
                  <div className="w-7 h-7 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <ArrowDownLeft size={16} />
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-black text-emerald-800 mb-0.5">
                  {fmt(summary.todayCashReceipts || 0)}
                </div>
                <div className="flex items-center gap-1 text-[10.5px] text-gray-500">
                  बचत, कर्ज, पिग्मी व इतर जमा पावत्या
                </div>
                <div className="absolute top-0 right-0 h-1 w-full bg-emerald-600" />
              </div>

              {/* Card 3: Today's Payments */}
              <div className="bg-white p-3.5 rounded-sm border border-gray-200 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">आजचे रोख देणे (Payments)</span>
                  <div className="w-7 h-7 rounded-sm bg-rose-50 text-rose-700 flex items-center justify-center">
                    <ArrowUpRight size={16} />
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-black text-rose-800 mb-0.5">
                  {fmt(summary.todayCashPayments || 0)}
                </div>
                <div className="flex items-center gap-1 text-[10.5px] text-gray-500">
                  कर्ज वाटप, ठेव परतावा व खर्च व्हाउचर्स
                </div>
                <div className="absolute top-0 right-0 h-1 w-full bg-rose-600" />
              </div>

              {/* Card 4: Physical Denomination Counted */}
              <div className="bg-white p-3.5 rounded-sm border border-gray-200 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">प्रत्यक्ष मोजलेली रोख (Tally)</span>
                  <div className="w-7 h-7 rounded-sm bg-purple-50 text-purple-700 flex items-center justify-center">
                    <Calculator size={16} />
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-black text-purple-800 mb-0.5">
                  {fmt(summary.totalPhysicalCashCounted || 0)}
                </div>
                <div className="flex items-center gap-1 text-[10.5px] text-gray-500">
                  नोटांच्या मोजणीनुसार प्रत्यक्ष रक्कम
                </div>
                <div className="absolute top-0 right-0 h-1 w-full bg-purple-600" />
              </div>
            </div>

            {/* Cash Counters Grid */}
            <div className="bg-white rounded-sm border border-gray-200 shadow-2xs p-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-gray-200 mb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="text-primary" size={18} />
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    कॅश काउंटर्स व टेलर स्थिती (Cashier Counters & Live Status)
                  </h2>
                  <span className="text-[10.5px] bg-slate-100 text-slate-700 px-2 py-0.2 rounded-full font-bold">
                    {cashiers.length} काउंटर्स
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {cashiers.length === 0 && (
                    <button
                      onClick={handleSeedDefaults}
                      className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2.5 py-1 rounded-sm transition-colors cursor-pointer"
                    >
                      + डीफॉल्ट काउंटर्स जोडा
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddCashierModal(true)}
                    className="flex items-center gap-1 text-xs bg-primary hover:bg-primary/90 text-white font-bold px-3 py-1 rounded-sm shadow-2xs transition-colors cursor-pointer"
                  >
                    <PlusCircle size={13} />
                    <span>नवीन काउंटर नोंदवा</span>
                  </button>
                </div>
              </div>

              {cashiers.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-sm border border-dashed border-slate-300">
                  <Wallet className="mx-auto text-slate-400 mb-2" size={36} />
                  <h3 className="text-xs font-bold text-slate-700">सध्या कोणताही कॅश काउंटर उपलब्ध नाही</h3>
                  <p className="text-[11px] text-slate-500 mb-3">सॉफ्टवेअरमध्ये कॅशिअर किंवा टेलर काउंटर सुरू करण्यासाठी खालील बटण दाबा.</p>
                  <button
                    onClick={handleSeedDefaults}
                    className="bg-primary hover:bg-primary/90 text-white font-bold px-3.5 py-1.5 rounded-sm text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    डीफॉल्ट कॅश काउंटर्स सेट करा
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cashiers.map((c, idx) => {
                    const cId = c.id ?? c.Id ?? idx;
                    const cName = c.cashierName ?? c.CashierName;
                    const cCounter = c.counterNumber ?? c.CounterNumber;
                    const cBranch = c.branchName ?? c.BranchName;
                    const cLedger = c.cashLedgerName ?? c.CashLedgerName ?? 'डिफॉल्ट रोख खाते';
                    const isHead = c.isHeadCashier ?? c.IsHeadCashier;
                    const isActive = c.isActive ?? c.IsActive;
                    const opBal = c.openingBalance ?? c.OpeningBalance ?? 0;
                    const allocIn = c.todayAllocatedIn ?? c.TodayAllocatedIn ?? 0;
                    const allocOut = c.todayAllocatedOut ?? c.TodayAllocatedOut ?? 0;
                    const curBal = c.currentBalance ?? c.CurrentBalance ?? 0;
                    const physTally = c.physicalTally ?? c.PhysicalTally ?? 0;
                    const diff = c.difference ?? c.Difference ?? 0;
                    const hasDiff = Math.abs(diff) > 0.01;
                    const isMatch = physTally > 0 && !hasDiff;

                    return (
                      <div 
                        key={`cd-card-${cId}`} 
                        className={`rounded-sm border transition-all p-3 relative ${
                          isHead 
                            ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200' 
                            : 'bg-white border-gray-200 hover:border-gray-300 shadow-2xs'
                        }`}
                      >
                        {/* Header info */}
                        <div className="flex items-start justify-between gap-2 mb-2 pb-1.5 border-b border-gray-100">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">{cName}</span>
                              {isHead && (
                                <span className="text-[9.5px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded border border-amber-300">
                                  हेड कॅशिअर
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] text-gray-500 font-medium">{cCounter} • {cBranch}</p>
                            <p className="text-[10px] text-primary font-bold mt-0.5 bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20 inline-block">
                              खाते: {cLedger}
                            </p>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                            isActive 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}>
                            {isActive ? 'चालू' : 'बंद'}
                          </span>
                        </div>

                        {/* Financial metrics */}
                        <div className="space-y-1 bg-slate-50 p-2 rounded-sm border border-gray-200 text-[11px] mb-2.5">
                          <div className="flex justify-between items-center text-slate-600">
                            <span>सुरुवातीची शिल्लक (Opening):</span>
                            <span className="font-semibold text-slate-800 font-mono">{fmt(opBal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span>आज प्राप्त रक्कम (Allocated In):</span>
                            <span className="font-semibold text-emerald-700 font-mono">+{fmt(allocIn)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span>परत केलेली रक्कम (Allocated Out):</span>
                            <span className="font-semibold text-rose-700 font-mono">-{fmt(allocOut)}</span>
                          </div>
                          <div className="border-t border-gray-200 pt-1 flex justify-between items-center font-bold text-slate-900">
                            <span>चालू शिल्लक (Book Balance):</span>
                            <span className="text-slate-900 text-xs font-mono font-bold">{fmt(curBal)}</span>
                          </div>
                        </div>

                        {/* Physical Tally status */}
                        <div className="flex items-center justify-between text-[11px] p-1.5 rounded-sm bg-slate-100/80 border border-gray-200 mb-2.5">
                          <div>
                            <span className="text-[10px] text-slate-500 block">नोटा मोजणी (Physical):</span>
                            <span className="font-bold text-slate-800 font-mono">{fmt(physTally)}</span>
                          </div>

                          <div>
                            {physTally === 0 ? (
                              <span className="text-[9.5px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                मोजणी बाकी
                              </span>
                            ) : isMatch ? (
                              <span className="flex items-center gap-1 text-[9.5px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                                <CheckCircle2 size={11} /> जुळले
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9.5px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded border border-rose-300">
                                <AlertCircle size={11} /> तफावत: {fmt(diff)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button 
                            onClick={() => handleQuickAllocationSwitch(cId)}
                            className="text-[10.5px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 py-1 rounded-sm text-center transition-colors cursor-pointer"
                          >
                            रोख हस्तांतरण
                          </button>
                          <button 
                            onClick={() => handleQuickDenomSwitch(cId)}
                            className="text-[10.5px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 py-1 rounded-sm text-center transition-colors cursor-pointer"
                          >
                            नोटा ताळेबंद
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CASH ALLOCATION & HANDOVER WORKSPACE                               */}
        {/* ========================================================================= */}
        {activeTab === 'allocation' && (
          <div className="p-4 space-y-4">
            
            <div className="bg-white rounded-sm border border-gray-200 shadow-2xs p-4">
              <div className="pb-2.5 border-b border-gray-200 mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ArrowRightLeft size={16} className="text-primary" />
                    <span>रोख वाटप व हस्तांतरण पावती (Cash Handover Form)</span>
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    मुख्य तिजोरीतून टेलरला रोख देणे (Handover) किंवा दिवसाअखेर तिजोरीत शिल्लक जमा करणे (Return)
                  </p>
                </div>
              </div>

              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setAllocationType('HEAD_TO_TELLER');
                    const head = cashiers.find(c => c.IsHeadCashier);
                    const regular = cashiers.filter(c => !c.IsHeadCashier);
                    setAllocationFormData(prev => ({
                      ...prev,
                      fromCashierId: head ? head.Id : 0,
                      toCashierId: regular.length > 0 ? regular[0].Id : 0
                    }));
                  }}
                  className={`py-2 px-3 text-xs font-bold rounded-sm border text-center transition-all cursor-pointer ${
                    allocationType === 'HEAD_TO_TELLER'
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  १. तिजोरीतून टेलरला वाटप (Head to Teller)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAllocationType('TELLER_TO_HEAD');
                    const head = cashiers.find(c => c.IsHeadCashier);
                    const regular = cashiers.filter(c => !c.IsHeadCashier);
                    setAllocationFormData(prev => ({
                      ...prev,
                      fromCashierId: regular.length > 0 ? regular[0].Id : 0,
                      toCashierId: head ? head.Id : 0
                    }));
                  }}
                  className={`py-2 px-3 text-xs font-bold rounded-sm border text-center transition-all cursor-pointer ${
                    allocationType === 'TELLER_TO_HEAD'
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  २. टेलरकडून तिजोरीत परतावा (Teller to Head)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAllocationType('TELLER_TO_TELLER');
                    const regular = cashiers.filter(c => !c.IsHeadCashier);
                    setAllocationFormData(prev => ({
                      ...prev,
                      fromCashierId: regular.length > 0 ? regular[0].Id : 0,
                      toCashierId: regular.length > 1 ? regular[1].Id : 0
                    }));
                  }}
                  className={`py-2 px-3 text-xs font-bold rounded-sm border text-center transition-all cursor-pointer ${
                    allocationType === 'TELLER_TO_TELLER'
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  ३. काउंटर-ते-काउंटर (Teller to Teller)
                </button>
              </div>

              <form onSubmit={handleAllocationSubmit} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">कडून (देणारा कॅशिअर - Payer) *</label>
                    <select
                      value={allocationFormData.fromCashierId}
                      onChange={(e) => setAllocationFormData({ ...allocationFormData, fromCashierId: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm bg-white font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value={0}>-- कॅशिअर निवडा --</option>
                      {cashiers.map((c, idx) => {
                        const cId = c.id ?? c.Id ?? idx;
                        const cName = c.cashierName ?? c.CashierName;
                        const cCounter = c.counterNumber ?? c.CounterNumber;
                        const curBal = c.currentBalance ?? c.CurrentBalance ?? 0;
                        return (
                          <option key={`cd-from-c-${cId}`} value={cId}>
                            {cName} ({cCounter}) - शिल्लक: {fmt(curBal)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">कोणास (घेणारा कॅशिअर - Receiver) *</label>
                    <select
                      value={allocationFormData.toCashierId}
                      onChange={(e) => setAllocationFormData({ ...allocationFormData, toCashierId: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm bg-white font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value={0}>-- कॅशिअर निवडा --</option>
                      {cashiers.map((c, idx) => {
                        const cId = c.id ?? c.Id ?? idx;
                        const cName = c.cashierName ?? c.CashierName;
                        const cCounter = c.counterNumber ?? c.CounterNumber;
                        const curBal = c.currentBalance ?? c.CurrentBalance ?? 0;
                        return (
                          <option key={`cd-to-c-${cId}`} value={cId}>
                            {cName} ({cCounter}) - शिल्लक: {fmt(curBal)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">हस्तांतरण रक्कम (₹) *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="उदा. 50000"
                      value={allocationFormData.amount}
                      onChange={(e) => setAllocationFormData({ ...allocationFormData, amount: e.target.value })}
                      className="w-full sm:w-80 px-2.5 py-1.5 border border-gray-300 rounded-sm font-mono font-bold text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    
                    {/* Quick Amount Buttons */}
                    <div className="flex flex-wrap items-center gap-1">
                      {[10000, 25000, 50000, 100000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAllocationFormData({ ...allocationFormData, amount: val.toString() })}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm font-bold text-[10.5px] border border-gray-300 cursor-pointer"
                        >
                          +{val.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">शेरा / तपशील (Narration)</label>
                  <input
                    type="text"
                    placeholder="उदा. सकाळच्या व्यवहारांसाठी काउंटर ओपनिंग रोख वाटप"
                    value={allocationFormData.remarks}
                    onChange={(e) => setAllocationFormData({ ...allocationFormData, remarks: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setAllocationFormData({ fromCashierId: 0, toCashierId: 0, amount: '', remarks: '' })}
                    className="px-3.5 py-1.5 border border-gray-300 text-gray-700 font-bold rounded-sm hover:bg-gray-100 cursor-pointer"
                  >
                    रीसेट करा
                  </button>
                  <button
                    type="submit"
                    disabled={allocating}
                    className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-sm shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>{allocating ? 'हस्तांतरण होत आहे...' : 'रोख हस्तांतरण जतन करा (Post Allocation)'}</span>
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PHYSICAL CASH DENOMINATION TALLY COUNTER                            */}
        {/* ========================================================================= */}
        {activeTab === 'denomination' && (
          <div className="p-4 space-y-4">
            
            <div className="bg-white rounded-sm border border-gray-200 shadow-2xs p-4">
              <div className="pb-2.5 border-b border-gray-200 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Calculator size={16} className="text-primary" />
                    <span>प्रत्यक्ष नोटा मोजणी व ताळेबंद (Physical Cash Denomination Counter)</span>
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    काउंटरवरील प्रत्यक्ष मोजलेल्या नोटांची संख्या भरून पुस्तकी शिलकीशी ताळमेळ घाला
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm border border-gray-300 font-bold cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>प्रिंट स्लिप</span>
                  </button>
                </div>
              </div>

              {/* Cashier & Type Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-2.5 bg-slate-50 border border-gray-200 rounded-sm text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">कॅशिअर / काउंटर निवडा *</label>
                  <select
                    value={denomCashierId}
                    onChange={(e) => setDenomCashierId(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm bg-white font-bold outline-none focus:border-primary"
                  >
                    {cashiers.map((c, idx) => {
                      const cId = c.id ?? c.Id ?? idx;
                      const cName = c.cashierName ?? c.CashierName;
                      const cCounter = c.counterNumber ?? c.CounterNumber;
                      const curBal = c.currentBalance ?? c.CurrentBalance ?? 0;
                      return (
                        <option key={`cd-denom-c-${cId}`} value={cId}>
                          {cName} ({cCounter}) - पुस्तकी शिल्लक: {fmt(curBal)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">मोजणी प्रकार (Entry Type)</label>
                  <select
                    value={denomEntryType}
                    onChange={(e) => setDenomEntryType(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm bg-white font-semibold outline-none focus:border-primary"
                  >
                    <option value="CLOSING">दिवसअखेर मोजणी (Closing Balance Tally)</option>
                    <option value="OPENING">सकाळची सुरुवात मोजणी (Opening Handover)</option>
                    <option value="SPOT_CHECK">अचानक तपासणी (Spot Cash Verification)</option>
                  </select>
                </div>
              </div>

              {/* Denomination Input Table */}
              <form onSubmit={handleDenomSubmit} className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold border-b border-gray-300">
                        <th className="border border-gray-300 py-1.5 px-3 text-left w-[25%]">नोटा / नाणी प्रकार</th>
                        <th className="border border-gray-300 py-1.5 px-3 text-center w-[25%]">नोटांची संख्या (Pieces)</th>
                        <th className="border border-gray-300 py-1.5 px-3 text-right w-[50%]">एकूण रक्कम (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {denominationsList.map((d) => {
                        const countVal = (denomCounts as any)[d.key] || 0;
                        const subTotal = d.isCoin ? Number(countVal) || 0 : countVal * d.value;

                        return (
                          <tr key={d.key} className="hover:bg-slate-50">
                            <td className="border border-gray-300 py-1.5 px-3 font-bold text-slate-800">
                              {d.label}
                            </td>
                            <td className="border border-gray-300 py-1 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={countVal === 0 ? '' : countVal}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setDenomCounts({
                                    ...denomCounts,
                                    [d.key]: isNaN(val) || val < 0 ? 0 : val
                                  });
                                }}
                                className="w-24 text-center px-2 py-1 border border-gray-300 rounded-sm font-mono font-bold text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="border border-gray-300 py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                              ₹ {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-gray-400">
                        <td className="border border-gray-300 py-2 px-3 font-bold">
                          एकूण प्रत्यक्ष रोख (Total Physical)
                        </td>
                        <td className="border border-gray-300 py-2 px-3 text-center font-mono font-black">
                          {totalNotesCount} नोटा
                        </td>
                        <td className="border border-gray-300 py-2 px-3 text-right font-mono font-black text-sm text-primary">
                          ₹ {totalPhysicalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Tally Comparison Box */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-gray-300 rounded-sm text-xs">
                  <div>
                    <span className="text-[10.5px] text-gray-500 block uppercase font-semibold">पुस्तकी शिल्लक (Book Expected):</span>
                    <strong className="text-sm font-mono text-slate-800">
                      ₹ {expectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10.5px] text-gray-500 block uppercase font-semibold">प्रत्यक्ष मोजदाद (Physical Count):</span>
                    <strong className="text-sm font-mono text-primary">
                      ₹ {totalPhysicalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10.5px] text-gray-500 block uppercase font-semibold">ताळमेळ फरक (Difference):</span>
                    {Math.abs(difference) < 0.01 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-800 font-black text-sm font-mono">
                        <CheckCircle2 size={15} />
                        तंतोतंत जुळले (₹ ०.००)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-800 font-black text-sm font-mono">
                        <AlertCircle size={15} />
                        तफावत: {difference > 0 ? '+' : ''} ₹ {difference.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs">शेरा / नोट (Remarks)</label>
                  <input
                    type="text"
                    placeholder="उदा. दिवसअखेर तिजोरीत नोटा जमा करताना केलेली मोजणी"
                    value={denomRemarks}
                    onChange={(e) => setDenomRemarks(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm text-xs outline-none focus:border-primary"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleResetDenom}
                    className="px-3.5 py-1.5 border border-gray-300 text-gray-700 font-bold rounded-sm text-xs hover:bg-gray-100 cursor-pointer"
                  >
                    रीसेट करा
                  </button>
                  <button
                    type="submit"
                    disabled={savingDenom}
                    className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-sm text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>{savingDenom ? 'जतन होत आहे...' : 'नोटांची मोजणी सेव्ह करा (Save Denominations)'}</span>
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: RECENT CASH ALLOCATION & MOVEMENT REGISTER                         */}
        {/* ========================================================================= */}
        {activeTab === 'register' && (
          <div className="p-4 space-y-4">
            
            <div className="bg-white rounded-sm border border-gray-200 shadow-2xs p-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 mb-3">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="text-primary" size={17} />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    आजचे रोख हस्तांतरण व्यवहार (Today's Cash Movement Register)
                  </h3>
                </div>
                <span className="text-[11px] text-gray-500 font-medium">
                  एकूण {recentAllocations.length} नोंदी
                </span>
              </div>

              {recentAllocations.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-400">
                  आजच्या तारखेसाठी कोणतीही रोख हस्तांतरण नोंद आढळली नाही.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold border-b border-gray-300">
                        <th className="py-2 px-3 border border-gray-300">तारीख</th>
                        <th className="py-2 px-3 border border-gray-300">कडून (From)</th>
                        <th className="py-2 px-3 border border-gray-300">कोणास (To)</th>
                        <th className="py-2 px-3 border border-gray-300">प्रकार</th>
                        <th className="py-2 px-3 border border-gray-300 text-right">रक्कम (₹)</th>
                        <th className="py-2 px-3 border border-gray-300 text-center">स्थिती</th>
                        <th className="py-2 px-3 border border-gray-300">शेरा / तपशील</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {recentAllocations.map((alloc, idx) => {
                        const aId = alloc.id ?? alloc.Id ?? idx;
                        const aDate = alloc.allocationDate ?? alloc.AllocationDate;
                        const fromName = alloc.fromCashierName ?? alloc.FromCashierName ?? '-';
                        const toName = alloc.toCashierName ?? alloc.ToCashierName ?? '-';
                        const aType = alloc.allocationType ?? alloc.AllocationType;
                        const aAmt = alloc.amount ?? alloc.Amount ?? 0;
                        const aStatus = alloc.status ?? alloc.Status;
                        const aRemarks = alloc.remarks ?? alloc.Remarks;
                        return (
                          <tr key={`cd-alloc-${aId}`} className="hover:bg-slate-50 transition-colors">
                            <td className="py-1.5 px-3 border border-gray-300 text-slate-700 font-mono">
                              {aDate ? new Date(aDate).toLocaleDateString('mr-IN') : '-'}
                            </td>
                            <td className="py-1.5 px-3 border border-gray-300 font-semibold text-slate-900">
                              {fromName}
                            </td>
                            <td className="py-1.5 px-3 border border-gray-300 font-semibold text-slate-900">
                              {toName}
                            </td>
                            <td className="py-1.5 px-3 border border-gray-300">
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-bold border border-slate-300">
                                {aType === 'HEAD_TO_TELLER' ? 'तिजोरीतून वाटप' : 
                                 aType === 'TELLER_TO_HEAD' ? 'तिजोरीत परतावा' : 'काउंटर हस्तांतरण'}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 border border-gray-300 font-mono font-bold text-right text-emerald-800">
                              {fmt(aAmt)}
                            </td>
                            <td className="py-1.5 px-3 border border-gray-300 text-center">
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                aStatus === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                aStatus === 'REJECTED' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}>
                                {aStatus === 'ACCEPTED' ? 'स्वीकृत' : aStatus}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 border border-gray-300 text-slate-600 truncate max-w-xs text-[11px]">
                              {aRemarks || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Modal to Add New Cashier Counter */}
      {showAddCashierModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-sm max-w-md w-full shadow-2xl border border-gray-300 overflow-hidden">
            <div className="p-3.5 bg-primary text-white flex items-center justify-between">
              <h3 className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <PlusCircle size={16} />
                <span>नवीन कॅश काउंटर / कॅशिअर नोंदणी</span>
              </h3>
              <button 
                onClick={() => setShowAddCashierModal(false)}
                className="text-white/80 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCashier} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">कॅशिअरचे नाव *</label>
                <input 
                  type="text" 
                  required
                  placeholder="उदा. श्री. राहुल पाटील"
                  value={newCashier.cashierName}
                  onChange={(e) => setNewCashier({ ...newCashier, cashierName: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">काउंटर क्रमांक *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="उदा. काउंटर ३"
                    value={newCashier.counterNumber}
                    onChange={(e) => setNewCashier({ ...newCashier, counterNumber: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">कमाल मर्यादा (₹)</label>
                  <input 
                    type="number" 
                    value={newCashier.maxCashLimit}
                    onChange={(e) => setNewCashier({ ...newCashier, maxCashLimit: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">संलग्न रोख खाते (Counter Cash GL)</label>
                <SearchableSelect
                  value={newCashier.cashLedgerId}
                  options={[
                    { value: 0, label: '-- डिफॉल्ट मुख्य रोख खाते वापरा --' },
                    ...ledgers.map(l => ({
                      value: l.ledgerID,
                      label: `${l.ledgerName} ${l.ledgerNameEnglish ? `(${l.ledgerNameEnglish})` : ''}`
                    }))
                  ]}
                  onChange={(e) => setNewCashier({ ...newCashier, cashLedgerId: Number(e.target.value) })}
                  placeholder="-- रोख खाते निवडा --"
                />
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <input 
                  type="checkbox" 
                  id="headCashierCheck"
                  checked={newCashier.isHeadCashier}
                  onChange={(e) => setNewCashier({ ...newCashier, isHeadCashier: e.target.checked })}
                  className="w-3.5 h-3.5 text-primary rounded border-gray-300"
                />
                <label htmlFor="headCashierCheck" className="text-slate-700 font-semibold cursor-pointer">
                  हा मुख्य कॅशिअर (Head Cashier) आहे का?
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">शेरा / तपशील</label>
                <textarea 
                  rows={2}
                  placeholder="अतिरिक्त माहिती किंवा जबाबदारी"
                  value={newCashier.remarks}
                  onChange={(e) => setNewCashier({ ...newCashier, remarks: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 mt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCashierModal(false)}
                  className="px-3.5 py-1.5 rounded-sm border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-sm bg-primary hover:bg-primary/90 text-white font-bold shadow-xs cursor-pointer transition-colors"
                >
                  जतन करा
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
