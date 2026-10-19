import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, CheckCircle2, AlertCircle, Clock, 
  ArrowRight, ShieldCheck, RefreshCw, X, Lock, Unlock, 
  Edit3, ChevronDown, ChevronUp, FileText, Check, AlertTriangle
} from 'lucide-react';

interface EodStatus {
  businessDate: string;
  isDayClosed: boolean;
  lastClosedDate: string | null;
  isFirstTimeEod: boolean;
  unpostedVouchers: number;
  transferTally: {
    debit: number;
    credit: number;
    isMatched: boolean;
  };
  cashTally: {
    branchID?: number;
    branchName?: string;
    primaryCashLedger?: {
      ledgerID: number;
      ledgerName: string;
      ledgerCode?: string;
    } | null;
    opening: number;
    todayReceipts?: number;
    todayPayments?: number;
    closing: number;
    isPositive: boolean;
  };
}

interface EodLog {
  logID: number;
  businessDate: string;
  stepNumber: number;
  stepName: string;
  status: string;
  recordsProcessed: number;
  errorMessage: string | null;
  startTime: string;
}

interface Branch {
  branchID: number;
  branchName: string;
  branchCode: string;
}

interface DayEndDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const DayEndDashboard: React.FC<DayEndDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
  const [status, setStatus] = useState<EodStatus | null>(null);
  const [logs, setLogs] = useState<EodLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Next Working Date for EOD
  const [nextBusinessDate, setNextBusinessDate] = useState<string>('');

  // Date Change / Go-Live Modal
  const [dateModalOpen, setDateModalOpen] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>('');
  const [customDateReason, setCustomDateReason] = useState<string>('संस्था प्रत्यक्ष कामकाजासाठी गो-लाईव्ह सुरू केली.');
  const [dateProcessing, setDateProcessing] = useState<boolean>(false);

  // Unlock Day Modal
  const [unlockModalOpen, setUnlockModalOpen] = useState<boolean>(false);
  const [unlockReason, setUnlockReason] = useState<string>('');
  const [unlockProcessing, setUnlockProcessing] = useState<boolean>(false);

  // Toggle for Audit Logs table
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const isAdminOrHo = useMemo(() => {
    const role = user?.role || user?.roleName || '';
    return role === 'Admin' || role === 'SuperAdmin' || role === 'HeadOffice' || role === 'HO_Manager' || role === 'Manager';
  }, [user]);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchEodData(selectedBranchId);
    }
  }, [selectedBranchId]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data);
      if (res.data.length > 0) {
        setSelectedBranchId(res.data[0].branchID);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getDayOfWeekName = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const marathiDays = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    return marathiDays[d.getDay()] || '';
  };

  const calculateDefaultNextDate = (baseDateStr: string) => {
    const d = new Date(baseDateStr);
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const calculateNextMonday = (baseDateStr: string) => {
    const d = new Date(baseDateStr);
    const day = d.getDay(); // 0 is Sun, 5 is Fri, 6 is Sat
    let daysToAdd = 1;
    if (day === 5) daysToAdd = 3; // Fri -> Mon
    else if (day === 6) daysToAdd = 2; // Sat -> Mon
    else if (day === 0) daysToAdd = 1; // Sun -> Mon
    else daysToAdd = (8 - day);
    d.setDate(d.getDate() + daysToAdd);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const fetchEodData = async (branchId: number) => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, logsRes] = await Promise.all([
        axios.get(`/api/EodOperations/status/${branchId}`),
        axios.get(`/api/EodOperations/logs/${branchId}`)
      ]);
      setStatus(statusRes.data);
      setLogs(logsRes.data);

      if (statusRes.data?.businessDate) {
        let activeDate = statusRes.data.businessDate;
        if (statusRes.data.isFirstTimeEod && user?.businessDate) {
          activeDate = user.businessDate;
        }

        setNextBusinessDate(calculateDefaultNextDate(activeDate));
        const curDate = new Date(activeDate);
        const yyyy = curDate.getFullYear();
        const mm = String(curDate.getMonth() + 1).padStart(2, '0');
        const dd = String(curDate.getDate()).padStart(2, '0');
        setCustomDate(`${yyyy}-${mm}-${dd}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'EOD माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // Run EOD Action
  const handleRunEod = async () => {
    if (!status) return;

    if (status.unpostedVouchers > 0) {
      setError(`दिवस बंद करता येत नाही: ${status.unpostedVouchers} प्रलंबित व्हाउचर्स आहेत. कृपया आधी ते मंजूर (Pass) किंवा रद्द करा.`);
      return;
    }

    if (!status.transferTally.isMatched) {
      setError(`दिवस बंद करता येत नाही: ट्रान्सफर डेबिट व क्रेडिट जुळत नाही.`);
      return;
    }

    if (!status.cashTally.isPositive) {
      setError(`दिवस बंद करता येत नाही: अखेरची रोख शिल्लक वजा (Negative) आहे.`);
      return;
    }

    const curDateFormatted = new Date(status.businessDate).toLocaleDateString('en-GB');
    const nextDateFormatted = nextBusinessDate ? new Date(nextBusinessDate).toLocaleDateString('en-GB') : '';

    if (!window.confirm(`तुम्हाला खात्री आहे का की तुम्ही तारीख ${curDateFormatted} चा दिवस बंद करून पुढील तारीख ${nextDateFormatted} सुरू करू इच्छिता?`)) {
      return;
    }

    setProcessing(true);
    setMessage('');
    setError('');

    try {
      const res = await axios.post(`/api/EodOperations/close-day/${selectedBranchId}`, {
        nextBusinessDate: nextBusinessDate ? new Date(nextBusinessDate).toISOString() : null
      });
      setMessage(res.data.message || `दिवस यशस्वीरीत्या बंद केला! पुढील बिझनेस डेट: ${nextDateFormatted}`);
      fetchEodData(selectedBranchId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'EOD प्रक्रियेदरम्यान त्रुटी आली. कृपया प्रलंबित व्यवहार तपासा.');
    } finally {
      setProcessing(false);
    }
  };

  // Change Date / Go-Live Action
  const handleSaveCustomDate = async () => {
    if (!customDate) {
      setError('कृपया तारीख निवडा.');
      return;
    }

    const targetDateFormatted = new Date(customDate).toLocaleDateString('en-GB');
    if (!window.confirm(`तुम्हाला खात्री आहे का की तुम्ही शाखेची बिझनेस डेट थेट ${targetDateFormatted} अशी निश्चित करू इच्छिता?`)) {
      return;
    }

    setDateProcessing(true);
    setMessage('');
    setError('');

    try {
      const res = await axios.post(`/api/EodOperations/initialize-golive-date/${selectedBranchId}`, {
        goLiveDate: new Date(customDate).toISOString(),
        reason: customDateReason.trim() || 'संस्थेची बिझनेस डेट निश्चित केली.'
      });
      setMessage(res.data.message || `बिझनेस डेट यशस्वीरीत्या ${targetDateFormatted} निश्चित झाली!`);
      setDateModalOpen(false);
      fetchEodData(selectedBranchId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'तारीख निश्चित करताना त्रुटी आली.');
    } finally {
      setDateProcessing(false);
    }
  };

  // Unlock Day Action
  const handleConfirmUnlock = async () => {
    if (!unlockReason || unlockReason.trim().length < 5) {
      setError('दिवस पुन्हा उघडण्यासाठी किमान ५ अक्षरांचे सबळ कारण नमूद करा.');
      return;
    }

    setUnlockProcessing(true);
    setMessage('');
    setError('');

    try {
      const res = await axios.post(`/api/EodOperations/unlock-day/${selectedBranchId}`, {
        reason: unlockReason
      });
      setMessage(res.data.message || 'मागील दिवस यशस्वीरीत्या अनलॉक करण्यात आला आहे.');
      setUnlockModalOpen(false);
      setUnlockReason('');
      fetchEodData(selectedBranchId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'दिवस अनलॉक करताना त्रुटी आली.');
    } finally {
      setUnlockProcessing(false);
    }
  };

  const handleGoToVoucherPosting = () => {
    if (onNavigate) {
      onNavigate('voucher-posting');
    } else {
      window.location.href = '/?tab=voucher-posting';
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt || 0);
  };

  const canRunEod = status && !status.isDayClosed && status.unpostedVouchers === 0 && status.transferTally.isMatched && status.cashTally.isPositive;

  return (
    <div className="p-2 sm:p-4 max-w-6xl mx-auto bg-slate-50 min-h-screen font-sans pb-10">
      {/* Top Header */}
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <span>🏛️</span>
            <span>बिझनेस डेट व दिवस अखेर (Day End Control)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            शाखेची चालू तारीख, आजचा व्यवहार मेळ आणि दिवसअखेर नियंत्रण
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-700">शाखा:</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(parseInt(e.target.value))}
              className="border border-slate-300 px-2 py-1 rounded text-xs font-bold bg-white text-slate-800 focus:outline-none focus:border-primary cursor-pointer shadow-2xs"
            >
              {branches.map(b => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchEodData(selectedBranchId)}
            disabled={loading}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition cursor-pointer text-xs flex items-center gap-1 font-bold"
            title="माहिती रीफ्रेश करा"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">रीफ्रेश</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="mb-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-md text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-700 hover:text-emerald-950 text-xs font-bold cursor-pointer">✕</button>
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-md text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-700 hover:text-rose-950 text-xs font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* 3 Main Action Cards */}
      {status ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* ========================================================
              CARD 1: ACTIVE BUSINESS DATE & STATUS
              ======================================================== */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  चालू बिझनेस डेट
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border flex items-center gap-1 ${
                  status.isFirstTimeEod
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : status.isDayClosed 
                      ? 'bg-amber-100 text-amber-900 border-amber-300' 
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}>
                  {status.isFirstTimeEod ? (
                    <>
                      <AlertTriangle className="w-3 h-3 text-amber-700" />
                      <span>पहिली दिवसअखेर (Fresh System)</span>
                    </>
                  ) : status.isDayClosed ? (
                    <>
                      <Lock className="w-3 h-3 text-amber-700" />
                      <span>दिवस बंद (Closed)</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 text-emerald-700" />
                      <span>दिवस चालू (Open)</span>
                    </>
                  )}
                </span>
              </div>

              {/* Last Closed Date Indicator */}
              <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200/80 mb-2.5">
                <span className="text-slate-500 font-medium">शेवटचा बंद दिवस:</span>
                <span className="font-mono font-bold text-slate-800">
                  {status.isFirstTimeEod || !status.lastClosedDate 
                    ? 'झालेली नाही (प्रथमच वापर)' 
                    : new Date(status.lastClosedDate).toLocaleDateString('en-GB')}
                </span>
              </div>

              {/* Big Date Display */}
              <div className="space-y-0.5 mb-3">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {new Date(status.isFirstTimeEod && user?.businessDate ? user.businessDate : status.businessDate).toLocaleDateString('en-GB')}
                </div>
                <div className="text-xs font-bold text-slate-500">
                  वार: <span className="text-primary font-black">{getDayOfWeekName(status.isFirstTimeEod && user?.businessDate ? user.businessDate : status.businessDate)}</span>
                </div>
              </div>

              {/* Inline Date Selection if No Day End has Ever Occurred */}
              {status.isFirstTimeEod ? (
                <div className="bg-amber-50/90 border border-amber-300 rounded p-2.5 mb-2 space-y-1.5">
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>पहिली बिझनेस डेट निवडा / निश्चित करा:</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-snug">
                    अद्याप कोणताही दिवस बंद झालेला नाही. कामकाजाची पहिली तारीख निवडून थेट सुरू करा:
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="border border-amber-300 bg-white px-2 py-1 rounded text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-600 shadow-2xs w-full max-w-[150px]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomDate}
                      disabled={dateProcessing}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs transition cursor-pointer flex items-center gap-1 disabled:opacity-50 shadow-2xs shrink-0"
                    >
                      {dateProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>तारीख लागू करा</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200/60">
                  शाखेचे सर्व दैनंदिन जमा/नावे व्यवहार, पावती व व्हाउचर्स याच तारखेमध्ये पोस्ट केले जात आहेत.
                </p>
              )}
            </div>

            {/* Admin Date Change Button */}
            {isAdminOrHo && (
              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setCustomDate(new Date(status.businessDate).toISOString().split('T')[0]);
                    setDateModalOpen(true);
                  }}
                  className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold rounded text-xs border border-indigo-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-700" />
                  <span>तारीख बदला / गो-लाईव्ह तारीख सेट करा</span>
                </button>
              </div>
            )}
          </div>

          {/* ========================================================
              CARD 2: TODAY'S HEALTH & TRANSACTION SUMMARY
              ======================================================== */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  आजचा व्यवहार मेळ (Today's Summary)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {status.cashTally.primaryCashLedger?.ledgerName || 'कॅश लेजर'}
                </span>
              </div>

              {/* Check Item 1: Pending Vouchers */}
              <div className="space-y-3 text-xs">
                <div className={`p-2.5 rounded border flex items-center justify-between ${
                  status.unpostedVouchers === 0 
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      {status.unpostedVouchers === 0 ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>प्रलंबित व्हाउचर्स:</span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                      {status.unpostedVouchers === 0 
                        ? 'सर्व व्हाउचर्स पास झालेले आहेत.' 
                        : `${status.unpostedVouchers} व्हाउचर मंजूर करणे बाकी आहे.`}
                    </div>
                  </div>

                  {status.unpostedVouchers > 0 ? (
                    <button
                      type="button"
                      onClick={handleGoToVoucherPosting}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10.5px] rounded shadow-2xs transition cursor-pointer"
                    >
                      पास करा ➔
                    </button>
                  ) : (
                    <span className="font-black text-emerald-700 text-xs">० प्रलंबित</span>
                  )}
                </div>

                {/* Cash Breakdown (Receipts / Payments / Closing) */}
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] text-slate-600">
                    <span>आजची एकूण जमा (+):</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {formatCurrency(status.cashTally.todayReceipts || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-600">
                    <span>आजचा एकूण खर्च (-):</span>
                    <span className="font-mono font-bold text-rose-700">
                      {formatCurrency(status.cashTally.todayPayments || 0)}
                    </span>
                  </div>
                  <div className="border-t border-slate-200/80 pt-1.5 flex justify-between items-center font-bold text-xs">
                    <span className="text-slate-800">अखेर रोख शिल्लक:</span>
                    <span className={`font-mono text-sm ${status.cashTally.isPositive ? 'text-slate-900 font-black' : 'text-rose-600 font-black'}`}>
                      {formatCurrency(status.cashTally.closing)}
                    </span>
                  </div>
                </div>

                {/* Tally Indicator */}
                <div className="flex justify-between items-center px-1 text-[11px]">
                  <span className="text-slate-500 font-medium">डेबिट-क्रेडिट ताळमेळ:</span>
                  <span className={`font-bold flex items-center gap-1 ${status.transferTally.isMatched ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {status.transferTally.isMatched ? '🟢 संतुलित (Balanced)' : '🔴 तफावत (Mismatch)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 mt-2 text-right">
              सुरक्षित दुहेरी नोंदी (Double Entry Validated)
            </div>
          </div>

          {/* ========================================================
              CARD 3: CLOSE DAY ACTION (EOD)
              ======================================================== */}
          <div className="bg-white rounded-lg border-2 border-red-200/80 shadow-xs p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-1">
                  <span>⚡</span>
                  <span>दिवस अखेर (End of Day)</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  {status.isDayClosed ? 'बंद केलेला' : '१-क्लिक प्रक्रिया'}
                </span>
              </div>

              {/* Next Business Date Input & Shortcuts */}
              <div className="space-y-2 mb-4">
                <label className="block text-xs font-bold text-slate-800">
                  पुढील कामकाजाची तारीख (Next Working Day):
                </label>
                <input
                  type="date"
                  value={nextBusinessDate}
                  disabled={status.isDayClosed}
                  onChange={(e) => setNextBusinessDate(e.target.value)}
                  className="w-full border border-slate-300 p-2 rounded text-xs font-mono font-bold focus:outline-none focus:border-red-600 bg-white shadow-2xs"
                />

                {/* Quick Date Selection Chips */}
                {!status.isDayClosed && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-500">झटपट:</span>
                    <button
                      type="button"
                      onClick={() => setNextBusinessDate(calculateDefaultNextDate(status.businessDate))}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-300 cursor-pointer"
                    >
                      उद्या (+१)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNextBusinessDate(calculateNextMonday(status.businessDate))}
                      className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-bold rounded border border-blue-200 cursor-pointer"
                    >
                      सोमवार (Monday)
                    </button>
                  </div>
                )}

                <p className="text-[10.5px] text-slate-500 leading-relaxed pt-1">
                  दिवस बंद होताच चालू तारीख गोठवली जाईल आणि सिस्टीम निवडलेल्या पुढील तारखेसाठी आपोआप उघडेल.
                </p>
              </div>
            </div>

            {/* Run EOD Big Button */}
            <div>
              {status.isDayClosed ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded text-center text-xs font-bold">
                  🔒 आजचा दिवस आधीच बंद केलेला आहे.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRunEod}
                  disabled={processing || !canRunEod}
                  className={`w-full py-2.5 px-4 rounded text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                    canRunEod 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  {processing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>दिवस बंद करत आहे...</span>
                    </>
                  ) : (
                    <>
                      <span>{status.isFirstTimeEod ? '⚡ पहिली दिवसअखेर पूर्ण करा (First Day End)' : '⚡ आजचा दिवस बंद करा (Close Day)'}</span>
                    </>
                  )}
                </button>
              )}

              {!canRunEod && !status.isDayClosed && (
                <p className="text-[10px] text-rose-600 font-bold text-center mt-1.5">
                  दिवस बंद करण्यासाठी सर्व व्हाउचर्स मंजूर असणे आवश्यक आहे.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
          माहिती लोड होत आहे...
        </div>
      )}

      {/* ========================================================
          BOTTOM SECTION: RECENT STATUS & ADMIN UNLOCK
          ======================================================== */}
      {status && (
        <div className="mt-4 bg-white rounded-lg border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-2 gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-800">
                मागील दिवस स्थिती व ॲडमिन अनलॉक (History & Reopen)
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {isAdminOrHo && (
                <button
                  type="button"
                  onClick={() => setUnlockModalOpen(true)}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5 text-amber-700" />
                  <span>मागील दिवस पुन्हा उघडा (Unlock Previous Day)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>{showLogs ? 'लॉग्ज लपवा' : '📜 ऑडिट लॉग्ज पाहा'}</span>
                {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap gap-4">
            <div>
              शाखेचे नाव: <strong className="text-slate-800">{status.cashTally.branchName || 'मुख्य शाखा'}</strong>
            </div>
            <div>
              शेवटचा बंद दिवस: <strong className="font-mono text-slate-800">{status.lastClosedDate ? new Date(status.lastClosedDate).toLocaleDateString('en-GB') : 'झालेली नाही (पहिली वेळ)'}</strong>
            </div>
            <div>
              शेवटचा दिवसअखेर वेळ: <span className="font-mono text-slate-700 font-bold">{logs.length > 0 ? new Date(logs[0].startTime).toLocaleTimeString() : 'आज झालेला नाही'}</span>
            </div>
            <div>
              नियम: <span className="text-slate-500">दिवसअखेरनंतर बंद तारखेमध्ये परस्पर बदल करण्यास कोअर बँकिंग सुरक्षा प्रतिबंध आहे.</span>
            </div>
          </div>

          {/* Collapsible Logs Table */}
          {showLogs && (
            <div className="pt-2 overflow-x-auto border-t border-slate-100 animate-in fade-in duration-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[11px]">
                  <tr>
                    <th className="py-1.5 px-2 text-left">तारीख</th>
                    <th className="py-1.5 px-2 text-left">टप्पा</th>
                    <th className="py-1.5 px-2 text-center">स्थिती</th>
                    <th className="py-1.5 px-2 text-left">तपशील</th>
                    <th className="py-1.5 px-2 text-right">वेळ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-slate-400">
                        कोणतेही लॉग्ज उपलब्ध नाहीत.
                      </td>
                    </tr>
                  ) : (
                    logs.slice(0, 15).map((l) => (
                      <tr key={l.logID} className="hover:bg-slate-50">
                        <td className="py-1 px-2 font-mono">{new Date(l.businessDate).toLocaleDateString('en-GB')}</td>
                        <td className="py-1 px-2 font-medium text-slate-800">{l.stepName}</td>
                        <td className="py-1 px-2 text-center">
                          <span className={`px-2 py-0.2 rounded text-[10px] font-black ${l.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-slate-500 text-[11px]">{l.errorMessage || `${l.recordsProcessed} नोंदी`}</td>
                        <td className="py-1 px-2 text-right font-mono text-slate-400 text-[10.5px]">{new Date(l.startTime).toLocaleTimeString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: CHANGE BUSINESS DATE / GO-LIVE (Admin)
          ======================================================== */}
      {dateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-indigo-500 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-200" />
                <h3 className="font-bold text-xs">
                  तारीख बदला / गो-लाईव्ह तारीख निश्चित करा
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDateModalOpen(false)}
                className="text-indigo-200 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded text-indigo-950 text-[11px]">
                ℹ️ <strong>गो-लाईव्ह सुलभता:</strong> संस्था नवीन संगणकीकृत सुरू करताना किंवा तारीख अडकलेली असल्यास थेट आजची तारीख निवडून १ सेकंदात गो-लाईव्ह करता येते. मागील २०० दिवसांचे खोटे Day-End करण्याची गरज नाही.
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  नवीन बिझनेस डेट निवडा (Select Date):
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full border border-slate-300 p-2 rounded text-xs font-mono font-bold focus:outline-none focus:border-indigo-600 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  तारीख बदलण्याचे कारण / शेरा:
                </label>
                <input
                  type="text"
                  value={customDateReason}
                  onChange={(e) => setCustomDateReason(e.target.value)}
                  placeholder="उदा. संस्था प्रत्यक्ष कामकाजासाठी गो-लाईव्ह केली."
                  className="w-full border border-slate-300 p-2 rounded text-xs focus:outline-none focus:border-indigo-600 bg-white"
                />
              </div>
            </div>

            <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDateModalOpen(false)}
                disabled={dateProcessing}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded text-xs border border-slate-300 cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleSaveCustomDate}
                disabled={dateProcessing}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs border border-indigo-700 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {dateProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>लागू करत आहे...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>तारीख लागू करा</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: UNLOCK DAY (Admin)
          ======================================================== */}
      {unlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-amber-500 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
            <div className="bg-gradient-to-r from-amber-700 to-amber-900 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-amber-200" />
                <h3 className="font-bold text-xs">
                  मागील बिझनेस डेट पुन्हा उघडा (Unlock Closed Day)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUnlockModalOpen(false)}
                className="text-amber-200 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-2 rounded text-amber-900 text-[11px]">
                ⚠️ <strong>ॲडमिन सूचना:</strong> दिवस पुन्हा उघडल्यास बंद झालेल्या तारखेमध्ये नवीन व्यवहार किंवा दुरुस्ती करता येईल. ही कृती ऑडिट ट्रेलमध्ये नोंदवली जाईल.
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  दिवस अनलॉक करण्याचे कारण (किमान ५ अक्षरे):
                </label>
                <textarea
                  rows={2}
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="उदा. मॅनेजर मंजुरीनुसार १ प्रलंबित पावती दुरुस्तीसाठी दिवस अनलॉक केला."
                  className="w-full border border-slate-300 p-2 rounded text-xs focus:outline-none focus:border-amber-600 bg-white"
                />
              </div>
            </div>

            <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnlockModalOpen(false)}
                disabled={unlockProcessing}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded text-xs border border-slate-300 cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlock}
                disabled={unlockProcessing}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs border border-amber-700 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {unlockProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>अनलॉक करत आहे...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>मागील दिवस अनलॉक करा</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayEndDashboard;
