import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { 
  Calculator, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Coins, 
  Printer, 
  FileText, 
  Save,
  Check,
  ShieldCheck,
  Building
} from 'lucide-react';

const fmt = (n: number) => '₹ ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CashDenominationProps {
  onNavigate?: (tab: string, params?: any) => void;
  initialCashierId?: number;
}

export default function CashDenominationEntry({ onNavigate, initialCashierId }: CashDenominationProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(user?.branchID || 1);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState<number>(initialCashierId || 0);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState<string>('CLOSING');

  const [counts, setCounts] = useState({
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

  const [remarks, setRemarks] = useState('');
  const [expectedAmount, setExpectedAmount] = useState<number>(0);
  const [recentDenominations, setRecentDenominations] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync with global auth branch changes
  useEffect(() => {
    if (user?.branchID) {
      setSelectedBranchId(user.branchID);
    }
  }, [user?.branchID]);

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

  // Calculate live total physical cash
  const totalPhysicalAmount = 
    (counts.count2000 * 2000) +
    (counts.count500 * 500) +
    (counts.count200 * 200) +
    (counts.count100 * 100) +
    (counts.count50 * 50) +
    (counts.count20 * 20) +
    (counts.count10 * 10) +
    (counts.count5 * 5) +
    (Number(counts.countCoins) || 0);

  const totalNotesCount = 
    counts.count2000 +
    counts.count500 +
    counts.count200 +
    counts.count100 +
    counts.count50 +
    counts.count20 +
    counts.count10 +
    counts.count5;

  const difference = totalPhysicalAmount - expectedAmount;

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load branches
      const branchesRes = await api.get('/Branches');
      setBranches(branchesRes.data || []);

      // 2. Load cashiers for branch
      const cashiersRes = await api.get(`/CashManagement/Cashiers?branchId=${selectedBranchId}`);
      const list = cashiersRes.data || [];
      setCashiers(list);

      let curCashierId = selectedCashierId;
      if ((!curCashierId || !list.some((c: any) => c.Id === curCashierId)) && list.length > 0) {
        curCashierId = list[0].Id;
        setSelectedCashierId(curCashierId);
      }

      // Find selected cashier's expected current balance
      const currentObj = list.find((c: any) => c.Id === curCashierId);
      if (currentObj) {
        setExpectedAmount(currentObj.CurrentBalance || 0);
      }

      // Load history
      if (curCashierId > 0) {
        const denomRes = await api.get(`/CashManagement/Denominations?branchId=${selectedBranchId}&cashierId=${curCashierId}&date=${selectedDate}`);
        setRecentDenominations(denomRes.data || []);
      }
    } catch (err) {
      console.error('Error loading denomination data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranchId, selectedCashierId, selectedDate]);

  const handleCashierChange = (id: number) => {
    setSelectedCashierId(id);
    const cashierObj = cashiers.find(c => c.Id === id);
    if (cashierObj) {
      setExpectedAmount(cashierObj.CurrentBalance || 0);
    }
  };

  const handleCountChange = (key: string, val: string) => {
    const num = parseInt(val, 10);
    setCounts(prev => ({
      ...prev,
      [key]: isNaN(num) || num < 0 ? 0 : num
    }));
  };

  const handleReset = () => {
    setCounts({
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
    setRemarks('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (selectedCashierId <= 0) {
      setErrorMsg('कृपया कॅशिअर निवडा.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/CashManagement/Denominations', {
        branchId: selectedBranchId,
        cashierId: selectedCashierId,
        denominationDate: selectedDate,
        entryType: entryType,
        ...counts,
        expectedAmount: expectedAmount,
        remarks: remarks,
        verifiedBy: user?.username || 'System'
      });

      setSuccessMsg('नोटांची मोजणी (Denominations) यशस्वीरित्या जतन झाली!');
      await loadData();
    } catch (err: any) {
      console.error('Error saving denominations:', err);
      setErrorMsg(err.response?.data?.message || 'नोटांची मोजणी जतन करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedCashierObj = cashiers.find(c => c.Id === selectedCashierId);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 text-slate-800 p-3 sm:p-5 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-5 print:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate && onNavigate('cashier-dashboard')}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="मागे जा"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
            <Calculator size={22} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800">नोटांची मोजणी व कॅश ताळेबंद (Cash Denomination)</h1>
            <p className="text-xs text-slate-500">
              प्रत्यक्ष रोख नोटांची मोजणी (Physical Cash Count) आणि सिस्टम शिल्लक पडताळणी
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
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 transition-colors"
          >
            <Printer size={14} />
            <span>प्रिंट पावती</span>
          </button>

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
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn print:hidden">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn print:hidden">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Denomination Calculator Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Coins className="text-indigo-600" size={18} />
              नोटांचे मूल्यवर्ग (Denominations Counter)
            </h2>

            {/* Cashier & Date Selectors */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCashierId}
                onChange={(e) => handleCashierChange(Number(e.target.value))}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white outline-none focus:border-indigo-600"
              >
                {cashiers.map(c => (
                  <option key={c.Id} value={c.Id}>
                    {c.CashierName} ({c.CounterNumber})
                  </option>
                ))}
              </select>

              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Denomination Input Table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 text-left font-bold">नोटा / नाणी (Denomination)</th>
                    <th className="py-2 px-3 text-center font-bold">नगांची संख्या (Count)</th>
                    <th className="py-2 px-3 text-right font-bold">एकूण रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {denominationsList.map((item) => {
                    const countVal = (counts as any)[item.key];
                    const lineTotal = item.isCoin ? (Number(countVal) || 0) : (countVal * item.value);

                    return (
                      <tr key={item.key} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 font-bold text-slate-700">
                          {item.label}
                        </td>
                        <td className="py-2 px-3 text-center w-36">
                          <input 
                            type="number"
                            min="0"
                            placeholder="0"
                            value={countVal === 0 ? '' : countVal}
                            onChange={(e) => handleCountChange(item.key, e.target.value)}
                            className="w-24 text-center py-1 px-2 border border-slate-300 rounded-md font-bold text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          {fmt(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-black border-t-2 border-slate-300 text-slate-900">
                    <td className="py-2.5 px-3">
                      एकूण नोटा: <span className="text-indigo-700">{totalNotesCount}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center uppercase tracking-wider text-[11px] text-slate-600">
                      प्रत्यक्ष रोख (Physical Cash)
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm text-indigo-700 font-black">
                      {fmt(totalPhysicalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Remarks */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">शेरा / पडताळणी टिप्पणी</label>
              <input 
                type="text"
                placeholder="उदा. सायंकाळची दिवस अखेर मोजणी (Day End Tally)"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                रिसेट करा
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
              >
                <Save size={15} />
                <span>मोजणी नोंद जतन करा</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Tally Comparison & Print Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Comparison Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
              <ShieldCheck className="text-indigo-600" size={18} />
              रोख ताळेबंद पडताळणी (Cash Tally Summary)
            </h2>

            <div className="space-y-3 text-xs mb-4">
              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-600 font-semibold">कॅशिअर / काउंटर:</span>
                <span className="font-bold text-slate-900">{selectedCashierObj?.CashierName || 'N/A'}</span>
              </div>

              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-600 font-semibold">सिस्टम शिल्लक (Book Balance):</span>
                <span className="font-bold text-slate-900">{fmt(expectedAmount)}</span>
              </div>

              <div className="flex justify-between items-center p-2.5 bg-indigo-50/70 rounded-lg border border-indigo-100">
                <span className="text-indigo-900 font-semibold">प्रत्यक्ष मोजलेली रोख (Physical):</span>
                <span className="font-black text-indigo-950 text-sm">{fmt(totalPhysicalAmount)}</span>
              </div>

              {/* Difference Highlight */}
              <div className={`p-3 rounded-xl border text-center transition-all ${
                Math.abs(difference) < 0.01 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : difference < 0 
                  ? 'bg-rose-50 border-rose-300 text-rose-800' 
                  : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-0.5">
                  ताळेबंद स्थिती (Status)
                </div>
                <div className="text-base font-black">
                  {Math.abs(difference) < 0.01 ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={18} /> रक्कम पूर्णपणे जुळली (Tally OK)
                    </span>
                  ) : difference < 0 ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <AlertCircle size={18} /> कमी रक्कम (Short): {fmt(Math.abs(difference))}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <AlertCircle size={18} /> जास्त रक्कम (Excess): {fmt(difference)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Printable Slip Preview */}
            <div className="p-3 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-[11px] text-slate-600">
              <div className="text-center font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">
                दैनिक रोख मोजणी पावती (Cash Denomination Slip)
              </div>
              <div className="grid grid-cols-2 gap-1 mb-2">
                <div>तारीख: {new Date(selectedDate).toLocaleDateString('mr-IN')}</div>
                <div>काउंटर: {selectedCashierObj?.CounterNumber}</div>
              </div>
              <div className="text-right font-bold text-slate-900">
                एकूण रक्कम: {fmt(totalPhysicalAmount)}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
                <span>कॅशिअर सही</span>
                <span>तपासनीस / मॅनेजर सही</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
