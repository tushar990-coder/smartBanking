import React, { useState, useEffect } from 'react';
import { Calculator, Calendar, Percent, IndianRupee } from 'lucide-react';

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
  const [rFromDate, setRFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [rToDate, setRToDate] = useState(new Date().toISOString().split('T')[0]);
  const [rDays, setRDays] = useState<number | ''>(0);
  const [rPrincipal, setRPrincipal] = useState<number | ''>('');
  const [rRate, setRRate] = useState<number | ''>('');
  const [rProduct, setRProduct] = useState<number>(0);
  const [rInterest, setRInterest] = useState<number>(0);

  // Auto-calculate days when dates change
  useEffect(() => {
    if (rFromDate && rToDate) {
      const start = new Date(rFromDate);
      const end = new Date(rToDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Only set if positive, otherwise 0
      setRDays(diffDays > 0 ? diffDays : 0);
    }
  }, [rFromDate, rToDate]);

  // Auto-calculate Product and Interest
  useEffect(() => {
    const p = Number(rPrincipal) || 0;
    const d = Number(rDays) || 0;
    const r = Number(rRate) || 0;
    
    const prod = p * d;
    setRProduct(prod);
    setRInterest((prod * r) / 36500);
  }, [rPrincipal, rDays, rRate]);

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
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>कर्ज घेतलेली तारीख :</label>
                  <input type="date" value={rFromDate} onChange={(e) => setRFromDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>वसूल तारीख :</label>
                  <input type="date" value={rToDate} onChange={(e) => setRToDate(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-full md:w-1/2 flex items-center gap-4 bg-blue-50 p-1.5 rounded-sm border border-blue-100">
                  <label className="text-[11px] font-bold text-primary whitespace-nowrap">झालेले दिवस :</label>
                  <input 
                    type="number" 
                    value={rDays} 
                    onChange={(e) => setRDays(e.target.value === '' ? '' : parseInt(e.target.value))} 
                    className="w-full border border-primary px-2 py-0.5 rounded-sm font-bold text-primary text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-[24px] text-[11px]" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Inputs */}
                <div className="space-y-2 border border-gray-200 p-2 rounded-sm shadow-sm bg-white">
                  <h3 className="text-[11px] font-bold text-primary mb-2 border-b pb-0.5">रक्कम व दर</h3>
                  <div className="flex items-center gap-2">
                    <label className="w-1/3 text-[11px] font-bold text-gray-700 text-right">मुद्दल :</label>
                    <input type="number" value={rPrincipal} onChange={(e) => setRPrincipal(e.target.value === '' ? '' : parseFloat(e.target.value))} className={inputClass} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-1/3 text-[11px] font-bold text-gray-700 text-right">व्याज दर :</label>
                    <input type="number" value={rRate} onChange={(e) => setRRate(e.target.value === '' ? '' : parseFloat(e.target.value))} className={inputClass} />
                  </div>
                </div>

                {/* Outputs */}
                <div className="space-y-2 border border-gray-200 p-2 rounded-sm shadow-sm bg-white">
                  <h3 className="text-[11px] font-bold text-primary mb-2 border-b pb-0.5">उत्पन्न</h3>
                  <div className="flex items-center gap-2">
                    <label className="w-1/3 text-[11px] font-bold text-gray-700 text-right">कच्चे :</label>
                    <input type="text" readOnly value={rProduct.toLocaleString('en-IN')} className={`${inputClass} bg-gray-50 font-bold text-gray-800`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-1/3 text-[11px] font-bold text-gray-700 text-right">व्याज :</label>
                    <input type="text" readOnly value={rInterest.toFixed(4)} className={`${inputClass} bg-gray-50 font-bold text-red-600`} />
                  </div>
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
