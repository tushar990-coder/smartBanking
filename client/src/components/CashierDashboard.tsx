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
  Scale
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

const fmt = (n: number) => '₹ ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CashierDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function CashierDashboard({ onNavigate }: CashierDashboardProps) {
  const { user } = useAuth();
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
  const [newCashier, setNewCashier] = useState({
    cashierName: '',
    counterNumber: 'कॅश काउंटर १',
    cashLedgerId: 0,
    maxCashLimit: 500000,
    isHeadCashier: false,
    remarks: ''
  });

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
      setCashiers(cashiersRes.data || []);

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
      await loadData();
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
      await loadData();
    } catch (err) {
      console.error('Error creating cashier:', err);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 text-slate-800 p-3 sm:p-5 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">कॅश मॅनेजमेंट व कॅशिअर विंडो</h1>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                लाईव्ह रोख नियंत्रण
              </span>
            </div>
            <p className="text-xs text-slate-500">
              बँक तिजोरी, कॅश काउंटर वाटप, टेलर व्यवहार व दैनंदिन नोटा ताळेबंद (Cash Tally)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {branches.length > 1 && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs text-emerald-950 font-bold">
              <Building size={14} className="text-emerald-700" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="bg-transparent font-bold text-emerald-950 outline-none cursor-pointer"
              >
                {branches.map(b => (
                  <option key={b.BranchID} value={b.BranchID}>
                    {b.BranchName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
            <Clock size={14} className="mr-1.5 text-slate-500" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-semibold outline-none cursor-pointer text-slate-800"
            />
          </div>

          <button 
            onClick={loadData}
            title="रिफ्रेश करा"
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">रिफ्रेश</span>
          </button>

          <button 
            onClick={() => onNavigate && onNavigate('cash-allocation')}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all"
          >
            <ArrowRightLeft size={15} />
            <span>रोख हस्तांतरण (Handover)</span>
          </button>

          <button 
            onClick={() => onNavigate && onNavigate('cash-denomination')}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all"
          >
            <Calculator size={15} />
            <span>नोटांची मोजणी (Denomination)</span>
          </button>

          <button 
            onClick={() => onNavigate && onNavigate('settings', { category: 'schemes', sub: 'cash-scheme-sub' })}
            title="कॅश योजना व लेजर मॅपिंग सेटिंग्ज"
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">योजना सेटिंग</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        {/* Card 1: Total Cash In Hand with Tellers */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">टेलर्सकडील रोख रक्कम</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Coins size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 mb-1">
            {fmt(summary.netCashWithTellers || 0)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="text-emerald-700 font-bold">{summary.activeCounters || 0}</span> कार्यरत काउंटर्सकडे दिलेली रक्कम
          </div>
          <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500" />
        </div>

        {/* Card 2: Today's Receipts */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">आजची रोख जमा (Receipts)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-700 mb-1">
            {fmt(summary.todayCashReceipts || 0)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            बचत, कर्ज, पिग्मी व इतर जमा पावत्या
          </div>
          <div className="absolute top-0 right-0 h-1 w-full bg-blue-500" />
        </div>

        {/* Card 3: Today's Payments */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">आजचे रोख देणे (Payments)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-700 mb-1">
            {fmt(summary.todayCashPayments || 0)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            कर्ज वाटप, ठेव परतावा व खर्च व्हाउचर्स
          </div>
          <div className="absolute top-0 right-0 h-1 w-full bg-rose-500" />
        </div>

        {/* Card 4: Physical Denomination Counted */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">प्रत्यक्ष मोजलेली रोख (Tally)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Calculator size={18} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-700 mb-1">
            {fmt(summary.totalPhysicalCashCounted || 0)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            नोटांच्या मोजणीनुसार एकूण रक्कम
          </div>
          <div className="absolute top-0 right-0 h-1 w-full bg-purple-500" />
        </div>
      </div>

      {/* Cash Counters Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="text-emerald-600" size={20} />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              कॅश काउंटर्स व टेलर स्थिती (Cashier Counters & Live Status)
            </h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {cashiers.length} काउंटर्स
            </span>
          </div>

          <div className="flex items-center gap-2">
            {cashiers.length === 0 && (
              <button
                onClick={handleSeedDefaults}
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold px-3 py-1 rounded-lg transition-colors"
              >
                + डीफॉल्ट काउंटर्स जोडा
              </button>
            )}
            <button
              onClick={() => setShowAddCashierModal(true)}
              className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
            >
              <PlusCircle size={14} />
              <span>नवीन काउंटर नोंदवा</span>
            </button>
          </div>
        </div>

        {cashiers.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <Wallet className="mx-auto text-slate-400 mb-2" size={36} />
            <h3 className="text-sm font-bold text-slate-700">सध्या कोणताही कॅश काउंटर उपलब्ध नाही</h3>
            <p className="text-xs text-slate-500 mb-4">सॉफ्टवेअरमध्ये कॅशिअर किंवा टेलर काउंटर सुरू करण्यासाठी खालील बटण दाबा.</p>
            <button
              onClick={handleSeedDefaults}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition-all"
            >
              डीफॉल्ट कॅश काउंटर्स सेट करा
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cashiers.map((c) => {
              const hasDiff = Math.abs(c.Difference || 0) > 0.01;
              const isMatch = c.PhysicalTally > 0 && !hasDiff;

              return (
                <div 
                  key={c.Id} 
                  className={`rounded-xl border transition-all p-4 relative ${
                    c.IsHeadCashier 
                      ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Header info */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{c.CashierName}</span>
                        {c.IsHeadCashier && (
                          <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded border border-amber-300">
                            हेड कॅशिअर
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">{c.CounterNumber} • {c.BranchName}</p>
                      <p className="text-[10px] text-emerald-800 font-bold mt-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
                        खाते: {c.CashLedgerName || 'डिफॉल्ट रोख खाते'}
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      c.IsActive 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {c.IsActive ? 'चालू' : 'बंद'}
                    </span>
                  </div>

                  {/* Financial metrics */}
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs mb-3">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>सुरुवातीची शिल्लक (Opening):</span>
                      <span className="font-semibold text-slate-800">{fmt(c.OpeningBalance)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>आज प्राप्त रक्कम (Allocated In):</span>
                      <span className="font-semibold text-emerald-700">+{fmt(c.TodayAllocatedIn)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>परत केलेली रक्कम (Allocated Out):</span>
                      <span className="font-semibold text-rose-700">-{fmt(c.TodayAllocatedOut)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center font-bold text-slate-900">
                      <span>चालू शिल्लक (Book Balance):</span>
                      <span className="text-slate-900 text-sm">{fmt(c.CurrentBalance)}</span>
                    </div>
                  </div>

                  {/* Physical Tally status */}
                  <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-100/70 border border-slate-200 mb-3">
                    <div>
                      <span className="text-[11px] text-slate-500 block">नोटा मोजणी (Physical):</span>
                      <span className="font-bold text-slate-800">{fmt(c.PhysicalTally)}</span>
                    </div>

                    <div>
                      {c.PhysicalTally === 0 ? (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium">
                          मोजणी बाकी
                        </span>
                      ) : isMatch ? (
                        <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300">
                          <CheckCircle2 size={11} /> जुळले (Matched)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded border border-rose-300">
                          <AlertCircle size={11} /> तफावत: {fmt(c.Difference)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button 
                      onClick={() => onNavigate && onNavigate('cash-allocation', { toCashierId: c.Id })}
                      className="text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-1.5 rounded-lg text-center transition-colors"
                    >
                      रोख हस्तांतरण
                    </button>
                    <button 
                      onClick={() => onNavigate && onNavigate('cash-denomination', { cashierId: c.Id })}
                      className="text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 py-1.5 rounded-lg text-center transition-colors"
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

      {/* Recent Cash Allocation / Movement Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="text-emerald-600" size={18} />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              आजचे रोख हस्तांतरण व्यवहार (Today's Cash Movement Register)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            एकूण {recentAllocations.length} नोंदी
          </span>
        </div>

        {recentAllocations.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            आजच्या तारखेसाठी कोणतीही रोख हस्तांतरण नोंद आढळली नाही.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-bold">वेळ / तारीख</th>
                  <th className="py-2.5 px-3 font-bold">कडून (From)</th>
                  <th className="py-2.5 px-3 font-bold">कोणास (To)</th>
                  <th className="py-2.5 px-3 font-bold">प्रकार</th>
                  <th className="py-2.5 px-3 font-bold text-right">रक्कम (₹)</th>
                  <th className="py-2.5 px-3 font-bold">स्थिती</th>
                  <th className="py-2.5 px-3 font-bold">शेरा / तपशील</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAllocations.map((alloc) => (
                  <tr key={alloc.Id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 text-slate-600">
                      {new Date(alloc.AllocationDate).toLocaleDateString('mr-IN')}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800">
                      {alloc.FromCashierName}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800">
                      {alloc.ToCashierName}
                    </td>
                    <td className="py-2 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                        {alloc.AllocationType === 'HEAD_TO_TELLER' ? 'तिजोरीतून वाटप' : 
                         alloc.AllocationType === 'TELLER_TO_HEAD' ? 'तिजोरीत परतावा' : 'काउंटर हस्तांतरण'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-black text-right text-emerald-700">
                      {fmt(alloc.Amount)}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        alloc.Status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                        alloc.Status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {alloc.Status === 'ACCEPTED' ? 'स्वीकृत' : alloc.Status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 truncate max-w-xs">
                      {alloc.Remarks || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal to Add New Cashier Counter */}
      {showAddCashierModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <PlusCircle size={18} className="text-emerald-600" />
                नवीन कॅश काउंटर / कॅशिअर नोंदणी
              </h3>
              <button 
                onClick={() => setShowAddCashierModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCashier} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">कॅशिअरचे नाव *</label>
                <input 
                  type="text" 
                  required
                  placeholder="उदा. श्री. राहुल पाटील"
                  value={newCashier.cashierName}
                  onChange={(e) => setNewCashier({ ...newCashier, cashierName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">कमाल मर्यादा (₹)</label>
                  <input 
                    type="number" 
                    value={newCashier.maxCashLimit}
                    onChange={(e) => setNewCashier({ ...newCashier, maxCashLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
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

              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="headCashierCheck"
                  checked={newCashier.isHeadCashier}
                  onChange={(e) => setNewCashier({ ...newCashier, isHeadCashier: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddCashierModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
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
