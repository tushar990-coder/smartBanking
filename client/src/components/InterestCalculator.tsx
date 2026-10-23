import React, { useState, useEffect } from 'react';
import { Calculator, Calendar, Percent, IndianRupee, Plus, X, Trash2, Printer, RotateCcw } from 'lucide-react';

export default function InterestCalculator() {
  const [activeTab, setActiveTab] = useState<'reducing' | 'flat' | 'standard'>('reducing');

  // --- Standard Calculator State ---
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<string | null>(null);
  const [calcWaiting, setCalcWaiting] = useState(false);
  const [calcMemory, setCalcMemory] = useState<number>(0);

  const handleCalcNumber = (num: string) => {
    if (calcWaiting) {
      setCalcDisplay(num);
      setCalcWaiting(false);
    } else {
      setCalcDisplay(calcDisplay === '0' ? num : calcDisplay + num);
    }
  };

  const handleCalcOp = (op: string) => {
    const current = parseFloat(calcDisplay);
    if (calcOp && !calcWaiting) {
      const result = calculate(calcPrev!, current, calcOp);
      setCalcDisplay(String(result));
      setCalcPrev(result);
    } else {
      setCalcPrev(current);
    }
    setCalcOp(op);
    setCalcWaiting(true);
  };

  const calculate = (a: number, b: number, op: string) => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const handleCalcEqual = () => {
    if (calcOp && calcPrev !== null) {
      const current = parseFloat(calcDisplay);
      const result = calculate(calcPrev, current, calcOp);
      setCalcDisplay(String(result));
      setCalcPrev(null);
      setCalcOp(null);
      setCalcWaiting(true);
    }
  };

  const handleCalcSpecial = (type: string) => {
    const current = parseFloat(calcDisplay);
    switch (type) {
      case 'C':
        setCalcDisplay('0');
        setCalcPrev(null);
        setCalcOp(null);
        break;
      case 'CE':
        setCalcDisplay('0');
        break;
      case 'backspace':
        setCalcDisplay(calcDisplay.length > 1 ? calcDisplay.slice(0, -1) : '0');
        break;
      case '+/-':
        setCalcDisplay(String(current * -1));
        break;
      case '.':
        if (!calcDisplay.includes('.')) setCalcDisplay(calcDisplay + '.');
        break;
      case '1/x':
        setCalcDisplay(String(1 / current));
        break;
      case 'x²':
        setCalcDisplay(String(current * current));
        break;
      case '√x':
        setCalcDisplay(String(Math.sqrt(current)));
        break;
      case '%':
        if (calcPrev !== null && calcOp) {
          // In standard calc, % is percentage of the previous value
          setCalcDisplay(String((calcPrev * current) / 100));
        } else {
          setCalcDisplay('0');
        }
        break;
    }
  };

  // --- Reducing Interest (Product Method) State ---
  interface ReducingRow {
    id: string;
    srNo: number;
    fromDate: string;
    toDate: string;
    days: number;
    principal: number;
    rate: number;
    product: number;
    interest: number;
    recovery: number;
    interestPaid: number;
  }

  const [rows, setRows] = useState<ReducingRow[]>([]);
  const [rFromDate, setRFromDate] = useState('2026-04-01');
  const [rToDate, setRToDate] = useState('2026-04-01');
  const [countBothDays, setCountBothDays] = useState(false);
  const [rDays, setRDays] = useState<number>(0);
  const [rPrincipal, setRPrincipal] = useState<number | ''>(50000);
  const [rRate, setRRate] = useState<number | ''>(6);
  const [rProduct, setRProduct] = useState<number>(0);
  const [rInterest, setRInterest] = useState<number>(0);
  const [rRecovery, setRRecovery] = useState<number | ''>(0);
  const [rInterestPaid, setRInterestPaid] = useState<number | ''>(0);
  const [marathiDigits, setMarathiDigits] = useState(true);

  // Helper to convert English digits to Marathi digits if enabled
  const toMarathi = (val: any) => {
    if (val === null || val === undefined || val === '') return marathiDigits ? '०' : '0';
    if (!marathiDigits) return String(val);
    const marathiMap: Record<string, string> = {
      '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
      '5': '५', '6': '६', '7': '७', '8': '८', '9': '९'
    };
    return String(val).replace(/[0-9]/g, d => marathiMap[d] || d);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      return toMarathi(formatted);
    }
    return dateStr;
  };

  // Auto-calculate days between fromDate and toDate
  const calcDayDiff = (fDate: string, tDate: string, both: boolean): number => {
    if (!fDate || !tDate) return 0;
    const [y1, m1, d1] = fDate.split('-').map(Number);
    const [y2, m2, d2] = tDate.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    const diff = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 0;
    return both ? diff + 1 : diff;
  };

  useEffect(() => {
    const d = calcDayDiff(rFromDate, rToDate, countBothDays);
    setRDays(d);
  }, [rFromDate, rToDate, countBothDays]);

  // Auto-calculate Product (कच्चे) and Interest (व्याज)
  useEffect(() => {
    const p = Number(rPrincipal) || 0;
    const d = Number(rDays) || 0;
    const r = Number(rRate) || 0;
    
    const prod = p * d;
    setRProduct(prod);
    const intr = (prod * r) / 36500;
    setRInterest(Math.round(intr));
  }, [rPrincipal, rDays, rRate]);

  // Add current slice to table and prepare next row automatically
  const handleAddRow = () => {
    const p = Number(rPrincipal);
    const r = Number(rRate);
    if (!p || p <= 0) {
      alert('कृपया वैध मुद्दल प्रविष्ट करा.');
      return;
    }
    if (!r || r <= 0) {
      alert('कृपया वैध व्याज दर प्रविष्ट करा.');
      return;
    }
    if (rDays < 0) {
      alert('वसूल तारीख कर्ज तारखेपेक्षा पुढे असावी.');
      return;
    }

    const newRow: ReducingRow = {
      id: Date.now().toString() + Math.random().toString().slice(2, 6),
      srNo: rows.length + 1,
      fromDate: rFromDate,
      toDate: rToDate,
      days: rDays,
      principal: p,
      rate: r,
      product: rProduct,
      interest: rInterest,
      recovery: Number(rRecovery) || 0,
      interestPaid: Number(rInterestPaid) || 0
    };

    setRows(prev => [...prev, newRow]);

    // Next slice auto setup:
    // 1. Next start date = previous toDate + 1 day
    const nextStart = new Date(rToDate);
    nextStart.setDate(nextStart.getDate() + 1);
    const y = nextStart.getFullYear();
    const m = String(nextStart.getMonth() + 1).padStart(2, '0');
    const d = String(nextStart.getDate()).padStart(2, '0');
    const nextStartStr = `${y}-${m}-${d}`;
    setRFromDate(nextStartStr);

    // 2. Next principal = current principal - recovery received
    const recoveryAmt = Number(rRecovery) || 0;
    const nextPrincipal = Math.max(0, p - recoveryAmt);
    setRPrincipal(nextPrincipal);

    // 3. Reset recovery and interest paid
    setRRecovery(0);
    setRInterestPaid(0);
  };

  const handleResetInputs = () => {
    setRPrincipal(50000);
    setRRate(6);
    setRRecovery(0);
    setRInterestPaid(0);
  };

  const handleRemoveLastRow = () => {
    if (rows.length === 0) return;
    setRows(prev => {
      const next = [...prev];
      const removed = next.pop();
      if (removed) {
        setRFromDate(removed.fromDate);
        setRToDate(removed.toDate);
        setRPrincipal(removed.principal);
        setRRate(removed.rate);
        setRRecovery(removed.recovery);
        setRInterestPaid(removed.interestPaid);
      }
      return next;
    });
  };

  const handleClearAll = () => {
    if (rows.length > 0 && !window.confirm('सर्व नोंदी साफ करायच्या आहेत का?')) {
      return;
    }
    setRows([]);
    setRFromDate('2026-04-01');
    setRToDate('2026-04-01');
    setRPrincipal(50000);
    setRRate(6);
    setRRecovery(0);
    setRInterestPaid(0);
  };

  const handleLoadSampleData = () => {
    const sampleRows: ReducingRow[] = [
      {
        id: 'sample-1',
        srNo: 1,
        fromDate: '2025-02-28',
        toDate: '2026-03-28',
        days: 393,
        principal: 50000,
        rate: 9,
        product: 19650000,
        interest: 4845,
        recovery: 0,
        interestPaid: 0
      },
      {
        id: 'sample-2',
        srNo: 2,
        fromDate: '2026-03-29',
        toDate: '2026-04-01',
        days: 3,
        principal: 50000,
        rate: 6,
        product: 150000,
        interest: 25,
        recovery: 0,
        interestPaid: 0
      }
    ];
    setRows(sampleRows);
    setRFromDate('2026-04-01');
    setRToDate('2026-04-01');
    setRPrincipal(50000);
    setRRate(6);
    setRRecovery(0);
    setRInterestPaid(0);
  };

  const totalInterest = rows.reduce((sum, r) => sum + r.interest, 0);
  const totalInterestPaid = rows.reduce((sum, r) => sum + r.interestPaid, 0);
  const balanceInterest = totalInterest - totalInterestPaid;

  // --- Flat Interest State ---
  const [fPrincipal, setFPrincipal] = useState<number | ''>('');
  const [fRate, setFRate] = useState<number | ''>('');
  const [fDuration, setFDuration] = useState<number | ''>('');
  const [fDurationType, setFDurationType] = useState<'months' | 'years' | 'days'>('months');
  const [fInterest, setFInterest] = useState<number>(0);
  const [fTotal, setFTotal] = useState<number>(0);

  useEffect(() => {
    const p = Number(fPrincipal) || 0;
    const r = Number(fRate) || 0;
    const t = Number(fDuration) || 0;
    
    let calcInterest = 0;
    if (fDurationType === 'months') {
        calcInterest = (p * r * t) / 1200;
    } else if (fDurationType === 'years') {
        calcInterest = (p * r * t) / 100;
    } else if (fDurationType === 'days') {
        calcInterest = (p * r * t) / 36500;
    }
    
    setFInterest(calcInterest);
    setFTotal(p + calcInterest);
  }, [fPrincipal, fRate, fDuration, fDurationType]);

  const inputClass = "w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-[11px] h-[24px]";
  const labelClass = "block text-[11px] font-semibold text-gray-700 mb-0.5";

  return (
    <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
      <div className="mb-2 flex justify-between items-end border-b-2 border-primary pb-1">
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Calculator className="text-primary" size={18} /> व्याज कॅल्क्युलेटर (Interest Calculator)
        </h1>
      </div>

      <div className="bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button 
            className={`flex-1 py-1.5 px-4 text-[11px] font-bold text-center border-r transition-colors ${activeTab === 'reducing' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={() => setActiveTab('reducing')}
          >
            घटते व्याज (Reducing / Product Method)
          </button>
          <button 
            className={`flex-1 py-1.5 px-4 text-[11px] font-bold text-center border-r transition-colors ${activeTab === 'flat' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={() => setActiveTab('flat')}
          >
            सपाट व्याज (Flat Interest)
          </button>
          <button 
            className={`flex-1 py-1.5 px-4 text-[11px] font-bold text-center transition-colors ${activeTab === 'standard' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={() => setActiveTab('standard')}
          >
            साधा कॅल्क्युलेटर (Standard)
          </button>
        </div>

        <div className="p-2 md:p-3">
          {activeTab === 'reducing' && (
            <div className="space-y-3 text-slate-800">
              
              {/* 🌟 1. Top Date Bar (CBS Theme Card) */}
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-2">
                    <label className="whitespace-nowrap text-xs text-slate-700 font-bold">कर्ज घेतल्याची तारीख :</label>
                    <input 
                      type="date" 
                      value={rFromDate} 
                      onChange={(e) => setRFromDate(e.target.value)} 
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium h-[28px]" 
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="whitespace-nowrap text-xs text-slate-700 font-bold">वसूल तारीख :</label>
                    <input 
                      type="date" 
                      value={rToDate} 
                      onChange={(e) => setRToDate(e.target.value)} 
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium h-[28px]" 
                    />
                  </div>

                  <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={countBothDays} 
                      onChange={(e) => setCountBothDays(e.target.checked)} 
                      className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer accent-primary"
                    />
                    <span className="text-xs text-slate-700">दोन्ही दिवस मोजणे</span>
                  </label>

                  <div className="flex items-center gap-2 ml-auto">
                    <span className="font-bold text-slate-700 text-xs">झालेले दिवस :</span>
                    <div className="bg-primary/10 border border-primary/30 text-primary font-black text-sm px-4 py-0.5 rounded shadow-2xs min-w-[65px] text-center">
                      {toMarathi(rDays)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 🌟 2. Middle Input Strip (CBS Theme Form Card) */}
              <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-4">
                  {/* Left inputs */}
                  <div className="flex-1 min-w-[300px] space-y-2.5">
                    {/* Row 1: मुद्दल, व्याज दर, कच्चे, व्याज */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-center text-xs">
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700 min-w-[60px] text-right whitespace-nowrap">मुद्दल :</label>
                        <input 
                          type="number" 
                          value={rPrincipal} 
                          onChange={(e) => setRPrincipal(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                          className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold h-[28px]"
                          placeholder="५००००"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700 min-w-[65px] text-right whitespace-nowrap">व्याज दर :</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={rRate} 
                          onChange={(e) => setRRate(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                          className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold h-[28px]"
                          placeholder="६"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700 min-w-[50px] text-right whitespace-nowrap">कच्चे :</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={toMarathi(rProduct)} 
                          className="w-full border border-slate-200 rounded px-2.5 py-1 text-xs bg-slate-50 font-bold text-slate-800 cursor-default h-[28px]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700 min-w-[50px] text-right whitespace-nowrap">व्याज :</label>
                        <div className="w-full bg-rose-50 border border-rose-200 text-rose-700 font-black text-xs px-2 py-1 rounded text-center h-[28px] flex items-center justify-center">
                          {toMarathi(rInterest)}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: आलेला वसूल, जमा व्याज */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-center text-xs">
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700 min-w-[60px] text-right whitespace-nowrap">आलेला वसूल :</label>
                        <input 
                          type="number" 
                          value={rRecovery} 
                          onChange={(e) => setRRecovery(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                          className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold h-[28px]"
                          placeholder="०"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700 min-w-[65px] text-right whitespace-nowrap">जमा व्याज :</label>
                        <input 
                          type="number" 
                          value={rInterestPaid} 
                          onChange={(e) => setRInterestPaid(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                          className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold h-[28px]"
                          placeholder="०"
                        />
                      </div>

                      <div className="col-span-2 hidden lg:block"></div>
                    </div>
                  </div>

                  {/* CBS Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-center">
                    <button
                      type="button"
                      onClick={handleAddRow}
                      title="तक्त्यात ओळ जोडा (Add Row)"
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>ओळ जोडा (Add)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetInputs}
                      title="इनपुट्स रीसेट करा (Reset Inputs)"
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>रीसेट</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 🌟 3. 10-Column Multi-Row Table (CBS Grid) */}
              <div className="overflow-x-auto border border-slate-200 rounded-sm bg-white shadow-2xs">
                <table className="w-full text-xs text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold divide-x divide-slate-200 text-center">
                      <th className="p-2 w-12 text-[11px]">अ.नं</th>
                      <th className="p-2 text-[11px]">कर्ज दिनांक</th>
                      <th className="p-2 text-[11px]">वसूल दिनांक</th>
                      <th className="p-2 w-16 text-[11px]">दिवस</th>
                      <th className="p-2 text-[11px]">मुद्दल</th>
                      <th className="p-2 w-16 text-[11px]">व्याज दर</th>
                      <th className="p-2 text-[11px]">कच्चे (Product)</th>
                      <th className="p-2 bg-primary/10 text-primary text-[11px]">व्याज</th>
                      <th className="p-2 text-[11px]">आलेला वसूल</th>
                      <th className="p-2 text-[11px]">जमा व्याज</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-900">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                          कोणतीही नोंद नाही. वरील तपशील भरून <strong>'ओळ जोडा'</strong> बटणावर क्लिक करा किंवा खालील <strong>'डेमो डेटा'</strong> बटण दाबा.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-primary/5 transition-colors divide-x divide-slate-200 text-center text-xs">
                          <td className={`p-2 font-bold ${idx === 0 ? 'bg-primary text-white' : 'text-slate-700 bg-slate-50'}`}>
                            {toMarathi(row.srNo)}
                          </td>
                          <td className="p-2 font-medium">{formatDateDisplay(row.fromDate)}</td>
                          <td className="p-2 font-medium">{formatDateDisplay(row.toDate)}</td>
                          <td className="p-2 font-bold">{toMarathi(row.days)}</td>
                          <td className="p-2 font-bold text-right pr-3">{toMarathi(row.principal)}</td>
                          <td className="p-2 font-medium">{toMarathi(row.rate)}%</td>
                          <td className="p-2 font-mono text-slate-700 text-right pr-3">{toMarathi(row.product)}</td>
                          <td className="p-2 bg-emerald-50 text-emerald-900 font-black text-right pr-3">
                            {toMarathi(row.interest)}
                          </td>
                          <td className="p-2 text-right pr-3">{toMarathi(row.recovery)}</td>
                          <td className="p-2 text-right pr-3">{toMarathi(row.interestPaid)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 🌟 4. Bottom Action & KPI Summary Bar (CBS Theme) */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRemoveLastRow}
                    disabled={rows.length === 0}
                    className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded text-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Last Row</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSampleData}
                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold rounded text-xs cursor-pointer transition-colors flex items-center gap-1"
                    title="स्क्रीनशॉटमधील सॅम्पल नोंदी लोड करा"
                  >
                    <span>डेमो डेटा (Sample)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={rows.length === 0}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded text-xs cursor-pointer transition-colors"
                  >
                    सर्व साफ करा
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded">
                    <span className="text-emerald-900 font-bold">एकूण व्याज :</span>
                    <span className="text-emerald-700 font-black text-sm">{toMarathi(totalInterest)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1 rounded">
                    <span className="text-slate-700 font-bold">जमा व्याज :</span>
                    <span className="text-slate-800 font-black text-sm">{toMarathi(totalInterestPaid)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1 rounded">
                    <span className="text-rose-900 font-bold">शिल्लक व्याज :</span>
                    <span className="text-rose-600 font-black text-sm">{toMarathi(balanceInterest)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMarathiDigits(!marathiDigits)}
                    className="px-2.5 py-1 border border-slate-300 rounded bg-white text-slate-700 text-xs hover:bg-slate-100 font-semibold cursor-pointer shadow-2xs"
                  >
                    {marathiDigits ? 'मराठी अंक ✓' : 'English Digits'}
                  </button>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'flat' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Inputs */}
                <div className="space-y-2 border border-gray-200 p-2 rounded-sm shadow-sm bg-white">
                  <h3 className="text-[11px] font-bold text-primary mb-2 border-b pb-0.5">रक्कम व मुदत</h3>
                  <div className="flex items-center gap-2">
                    <label className="w-1/3 text-[11px] font-bold text-gray-700 text-right">मुद्दल :</label>
                    <input type="number" value={fPrincipal} onChange={(e) => setFPrincipal(e.target.value === '' ? '' : parseFloat(e.target.value))} className={inputClass} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-1/3 text-[11px] font-bold text-gray-700 text-right">व्याज दर (%) :</label>
                    <input type="number" value={fRate} onChange={(e) => setFRate(e.target.value === '' ? '' : parseFloat(e.target.value))} className={inputClass} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-1/3 text-[11px] font-bold text-gray-700 text-right">मुदत :</label>
                    <div className="w-2/3 flex gap-1">
                      <input type="number" value={fDuration} onChange={(e) => setFDuration(e.target.value === '' ? '' : parseInt(e.target.value))} className="flex-1 border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 h-[24px] text-[11px]" />
                      <select value={fDurationType} onChange={(e) => setFDurationType(e.target.value as any)} className="flex-1 border border-gray-300 px-1 py-0.5 rounded-sm bg-white focus:outline-none focus:border-blue-500 h-[24px] text-[11px]">
                        <option value="months">महिने</option>
                        <option value="years">वर्ष</option>
                        <option value="days">दिवस</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Outputs */}
                <div className="space-y-2 border border-gray-200 p-2 rounded-sm shadow-sm bg-white flex flex-col justify-center">
                  <h3 className="text-[11px] font-bold text-primary mb-2 border-b pb-0.5 w-full">एकूण गणना</h3>
                  <div className="flex justify-between items-center bg-white border-l-4 border-emerald-500 text-gray-900 p-1.5 rounded shadow-sm text-[11px]">
                    <span className="font-semibold text-gray-600">एकूण व्याज :</span>
                    <span className="font-extrabold px-1 text-xs text-red-600">₹{fInterest.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white border-l-4 border-indigo-500 text-gray-900 p-1.5 rounded shadow-sm text-[11px] mt-2">
                    <span className="font-semibold text-gray-600">एकूण परतफेड (मुद्दल + व्याज) :</span>
                    <span className="font-extrabold px-1 text-sm text-green-700">₹{fTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'standard' && (
            <div className="flex justify-center py-4">
              <div className="w-[320px] bg-[#202020] p-1 shadow-2xl rounded-sm font-sans select-none">
                
                {/* Header */}
                <div className="flex items-center text-white px-2 py-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">☰</span>
                    <span className="text-lg font-semibold tracking-wide">Standard</span>
                  </div>
                </div>

                {/* Display */}
                <div className="px-3 pt-6 pb-2 text-right">
                  <div className="text-gray-400 text-sm h-6">
                    {calcOp && calcPrev !== null ? `${calcPrev} ${calcOp}` : ''}
                  </div>
                  <div className="text-white text-5xl font-semibold tracking-tighter truncate overflow-hidden">
                    {calcDisplay}
                  </div>
                </div>

                {/* Memory Row */}
                <div className="flex justify-between px-3 py-2 text-gray-400 text-xs font-semibold mb-2">
                  <button className="hover:bg-[#323232] px-2 py-1 rounded" onClick={() => setCalcMemory(0)}>MC</button>
                  <button className="hover:bg-[#323232] px-2 py-1 rounded" onClick={() => handleCalcNumber(String(calcMemory))}>MR</button>
                  <button className="hover:bg-[#323232] px-2 py-1 rounded" onClick={() => setCalcMemory(calcMemory + parseFloat(calcDisplay))}>M+</button>
                  <button className="hover:bg-[#323232] px-2 py-1 rounded" onClick={() => setCalcMemory(calcMemory - parseFloat(calcDisplay))}>M-</button>
                  <button className="hover:bg-[#323232] px-2 py-1 rounded" onClick={() => setCalcMemory(parseFloat(calcDisplay))}>MS</button>
                  <button className="hover:bg-[#323232] px-2 py-1 rounded">M▾</button>
                </div>

                {/* Buttons Grid */}
                <div className="grid grid-cols-4 gap-[2px] p-[2px]">
                  {/* Row 1 */}
                  <button onClick={() => handleCalcSpecial('%')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-sm py-3 rounded-sm transition-colors">%</button>
                  <button onClick={() => handleCalcSpecial('CE')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-sm py-3 rounded-sm transition-colors">CE</button>
                  <button onClick={() => handleCalcSpecial('C')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-sm py-3 rounded-sm transition-colors">C</button>
                  <button onClick={() => handleCalcSpecial('backspace')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-sm py-3 rounded-sm transition-colors flex justify-center items-center">⌫</button>
                  
                  {/* Row 2 */}
                  <button onClick={() => handleCalcSpecial('1/x')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-sm py-3 rounded-sm transition-colors flex justify-center items-center"><span className="italic">1/x</span></button>
                  <button onClick={() => handleCalcSpecial('x²')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-sm py-3 rounded-sm transition-colors flex justify-center items-center"><span className="italic">x²</span></button>
                  <button onClick={() => handleCalcSpecial('√x')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-sm py-3 rounded-sm transition-colors flex justify-center items-center"><span className="italic">²√x</span></button>
                  <button onClick={() => handleCalcOp('÷')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-xl pb-1 rounded-sm transition-colors">÷</button>
                  
                  {/* Row 3 */}
                  <button onClick={() => handleCalcNumber('7')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">7</button>
                  <button onClick={() => handleCalcNumber('8')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">8</button>
                  <button onClick={() => handleCalcNumber('9')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">9</button>
                  <button onClick={() => handleCalcOp('×')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-xl pb-1 rounded-sm transition-colors">×</button>
                  
                  {/* Row 4 */}
                  <button onClick={() => handleCalcNumber('4')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">4</button>
                  <button onClick={() => handleCalcNumber('5')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">5</button>
                  <button onClick={() => handleCalcNumber('6')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">6</button>
                  <button onClick={() => handleCalcOp('-')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-xl pb-1 rounded-sm transition-colors">−</button>
                  
                  {/* Row 5 */}
                  <button onClick={() => handleCalcNumber('1')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">1</button>
                  <button onClick={() => handleCalcNumber('2')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">2</button>
                  <button onClick={() => handleCalcNumber('3')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">3</button>
                  <button onClick={() => handleCalcOp('+')} className="bg-[#323232] hover:bg-[#3b3b3b] text-white text-xl pb-1 rounded-sm transition-colors">+</button>
                  
                  {/* Row 6 */}
                  <button onClick={() => handleCalcSpecial('+/-')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white text-lg py-3 rounded-sm transition-colors flex justify-center items-center"><sup>+</sup>/<sub>-</sub></button>
                  <button onClick={() => handleCalcNumber('0')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">0</button>
                  <button onClick={() => handleCalcSpecial('.')} className="bg-[#3b3b3b] hover:bg-[#323232] text-white font-semibold text-lg py-3 rounded-sm transition-colors">.</button>
                  <button onClick={() => handleCalcEqual()} className="bg-[#d4a8f9] hover:bg-[#c391eb] text-black text-2xl pb-1 rounded-sm transition-colors">=</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
