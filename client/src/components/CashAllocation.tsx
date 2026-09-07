import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { 
  ArrowRightLeft, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Coins, 
  Wallet, 
  User, 
  Printer, 
  ShieldCheck, 
  FileText,
  Search,
  Filter,
  Building
} from 'lucide-react';

const fmt = (n: number) => '₹ ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CashAllocationProps {
  onNavigate?: (tab: string, params?: any) => void;
  initialToCashierId?: number;
}

export default function CashAllocation({ onNavigate, initialToCashierId }: CashAllocationProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(user?.branchID || 1);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  
  const [allocationType, setAllocationType] = useState<'HEAD_TO_TELLER' | 'TELLER_TO_HEAD' | 'TELLER_TO_TELLER' | 'INTER_BRANCH_TRANSFER'>('HEAD_TO_TELLER');
  
  const [formData, setFormData] = useState({
    fromCashierId: 0,
    toCashierId: initialToCashierId || 0,
    amount: '',
    allocationDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync with global auth branch
  useEffect(() => {
    if (user?.branchID) {
      setSelectedBranchId(user.branchID);
    }
  }, [user?.branchID]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load branches
      const branchesRes = await api.get('/Branches');
      setBranches(branchesRes.data || []);

      // 2. Load cashiers for branch
      const cashiersRes = await api.get(`/CashManagement/Cashiers?branchId=${selectedBranchId}`);
      const cashiersList = cashiersRes.data || [];
      setCashiers(cashiersList);

      const head = cashiersList.find((c: any) => c.IsHeadCashier);
      const regular = cashiersList.filter((c: any) => !c.IsHeadCashier);

      if (allocationType === 'HEAD_TO_TELLER') {
        setFormData(prev => ({
          ...prev,
          fromCashierId: head ? head.Id : 0,
          toCashierId: prev.toCashierId || (regular.length > 0 ? regular[0].Id : 0)
        }));
      } else if (allocationType === 'TELLER_TO_HEAD') {
        setFormData(prev => ({
          ...prev,
          fromCashierId: prev.fromCashierId || (regular.length > 0 ? regular[0].Id : 0),
          toCashierId: head ? head.Id : 0
        }));
      }

      // 3. Load allocations for branch
      const allocRes = await api.get(`/CashManagement/Allocations?branchId=${selectedBranchId}&fromDate=${filterDate}&toDate=${filterDate}`);
      setAllocations(allocRes.data || []);
    } catch (err) {
      console.error('Error loading allocations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranchId, filterDate]);

  const handleTypeChange = (type: 'HEAD_TO_TELLER' | 'TELLER_TO_HEAD' | 'TELLER_TO_TELLER' | 'INTER_BRANCH_TRANSFER') => {
    setAllocationType(type);
    const head = cashiers.find((c: any) => c.IsHeadCashier);
    const regular = cashiers.filter((c: any) => !c.IsHeadCashier);

    if (type === 'HEAD_TO_TELLER') {
      setFormData(prev => ({
        ...prev,
        fromCashierId: head ? head.Id : 0,
        toCashierId: regular.length > 0 ? regular[0].Id : 0
      }));
    } else if (type === 'TELLER_TO_HEAD') {
      setFormData(prev => ({
        ...prev,
        fromCashierId: regular.length > 0 ? regular[0].Id : 0,
        toCashierId: head ? head.Id : 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        fromCashierId: regular.length > 0 ? regular[0].Id : 0,
        toCashierId: regular.length > 1 ? regular[1].Id : 0
      }));
    }
  };

  const handleQuickAmount = (val: number) => {
    setFormData(prev => ({ ...prev, amount: val.toString() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('कृपया वैध रक्कम प्रविष्ट करा.');
      return;
    }

    if (formData.fromCashierId === formData.toCashierId) {
      setErrorMsg('रक्कम देणारा आणि घेणारा कॅशिअर एकच असू शकत नाही.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/CashManagement/Allocations', {
        branchId: selectedBranchId,
        fromCashierId: formData.fromCashierId,
        toCashierId: formData.toCashierId,
        amount: amt,
        allocationDate: formData.allocationDate,
        allocationType: allocationType,
        status: 'ACCEPTED',
        remarks: formData.remarks || (allocationType === 'HEAD_TO_TELLER' ? 'तिजोरीतून वाटप' : 'तिजोरीत परतावा'),
        isReturn: allocationType === 'TELLER_TO_HEAD',
        createdBy: user?.username || 'System'
      });

      setSuccessMsg(`₹ ${amt.toLocaleString('en-IN')} ची रोख रक्कम यशस्वीरित्या हस्तांतरित झाली!`);
      setFormData(prev => ({ ...prev, amount: '', remarks: '' }));
      await loadData();
    } catch (err: any) {
      console.error('Error allocating cash:', err);
      setErrorMsg(err.response?.data?.message || 'रोख हस्तांतरण अयशस्वी झाले. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setLoading(false);
    }
  };

  const fromCashierObj = cashiers.find(c => c.Id === formData.fromCashierId);
  const toCashierObj = cashiers.find(c => c.Id === formData.toCashierId);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 text-slate-800 p-3 sm:p-5 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate && onNavigate('cashier-dashboard')}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="मागे जा"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
            <ArrowRightLeft size={22} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800">रोख वाटप व हस्तांतरण (Cash Allocation)</h1>
            <p className="text-xs text-slate-500">
              मुख्य तिजोरी ते काउंटर रोख वाटप (Handover) आणि दिवसाच्या शेवटी तिजोरीत परतावा (Vault Return)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

          <button 
            onClick={loadData}
            title="रिफ्रेश करा"
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>रिफ्रेश</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Transfer Form + Live Register */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Handover Form (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
            <Coins className="text-emerald-600" size={18} />
            नवीन रोख हस्तांतरण नोंद
          </h2>

          {/* Allocation Type Switcher */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleTypeChange('HEAD_TO_TELLER')}
              className={`py-2 rounded-lg transition-all text-center ${
                allocationType === 'HEAD_TO_TELLER' 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              तिजोरीतून वाटप
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('TELLER_TO_HEAD')}
              className={`py-2 rounded-lg transition-all text-center ${
                allocationType === 'TELLER_TO_HEAD' 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              तिजोरीत परतावा
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('TELLER_TO_TELLER')}
              className={`py-2 rounded-lg transition-all text-center ${
                allocationType === 'TELLER_TO_TELLER' 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              काउंटर ते काउंटर
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">तारीख *</label>
              <input 
                type="date"
                required
                value={formData.allocationDate}
                onChange={(e) => setFormData({ ...formData, allocationDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* From & To Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">कडून (From Cashier) *</label>
                <select
                  required
                  value={formData.fromCashierId}
                  onChange={(e) => setFormData({ ...formData, fromCashierId: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white"
                >
                  <option value={0}>निवडा...</option>
                  {cashiers.map(c => (
                    <option key={c.Id} value={c.Id}>
                      {c.CashierName} ({c.CounterNumber})
                    </option>
                  ))}
                </select>
                {fromCashierObj && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    शिल्लक: <strong className="text-slate-700">{fmt(fromCashierObj.CurrentBalance)}</strong>
                  </span>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">कोणास (To Cashier) *</label>
                <select
                  required
                  value={formData.toCashierId}
                  onChange={(e) => setFormData({ ...formData, toCashierId: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white"
                >
                  <option value={0}>निवडा...</option>
                  {cashiers.map(c => (
                    <option key={c.Id} value={c.Id}>
                      {c.CashierName} ({c.CounterNumber})
                    </option>
                  ))}
                </select>
                {toCashierObj && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    शिल्लक: <strong className="text-slate-700">{fmt(toCashierObj.CurrentBalance)}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">हस्तांतरित रक्कम (Amount ₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                <input 
                  type="number"
                  required
                  step="any"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div>
              <span className="text-[11px] text-slate-500 font-semibold block mb-1.5">जलद रक्कम निवडा:</span>
              <div className="flex flex-wrap gap-1.5">
                {[10000, 25000, 50000, 100000, 200000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickAmount(amt)}
                    className="text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 px-2.5 py-1 rounded-md transition-all"
                  >
                    + ₹{(amt / 1000)}k
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">शेरा / तपशील (Remarks)</label>
              <input 
                type="text"
                placeholder="उदा. सकाळची सुरुवातीची शिल्लक / दिवस अखेर परतावा"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              <span>रोख रक्कम हस्तांतरित करा</span>
            </button>
          </form>
        </div>

        {/* Right Column: Allocation Register (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <FileText className="text-emerald-600" size={18} />
              रोख हस्तांतरण नोंदवही (Allocation Register)
            </h2>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                <Calendar size={13} className="mr-1 text-slate-500" />
                <input 
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-transparent font-semibold outline-none cursor-pointer text-slate-800 text-[11px]"
                />
              </div>
            </div>
          </div>

          {allocations.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Coins className="mx-auto mb-2 text-slate-300" size={32} />
              या तारखेसाठी कोणतीही हस्तांतरण नोंद उपलब्ध नाही.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-3 font-bold">कडून (From)</th>
                    <th className="py-2.5 px-3 font-bold">कोणास (To)</th>
                    <th className="py-2.5 px-3 font-bold">प्रकार</th>
                    <th className="py-2.5 px-3 font-bold text-right">रक्कम</th>
                    <th className="py-2.5 px-3 font-bold">शेरा</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allocations.map((a) => (
                    <tr key={a.Id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {a.FromCashierName}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {a.ToCashierName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {a.AllocationType === 'HEAD_TO_TELLER' ? 'तिजोरीतून वाटप' : 
                           a.AllocationType === 'TELLER_TO_HEAD' ? 'तिजोरीत परतावा' : 'काउंटर हस्तांतरण'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-black text-right text-emerald-700">
                        {fmt(a.Amount)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-xs">
                        {a.Remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
