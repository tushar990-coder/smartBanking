import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Calendar, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  Sparkles, 
  Printer, 
  CreditCard, 
  Wallet, 
  AlertTriangle, 
  X, 
  Save,
  ArrowLeft,
  XCircle
} from 'lucide-react';

interface PendingRenewal {
  allotmentID: number;
  branchID: number;
  lockerAccountNo: string;
  lockerID: number;
  lockerNo: string;
  cabinetNo: string;
  keyNo: string;
  typeName: string;
  memberID: number;
  memberNo: string;
  memberName: string;
  memberPhone: string;
  expiryDate: string;
  isOverdue: boolean;
  overdueDays: number;
  overdueMonths: number;
  baseRent: number;
  lateFee: number;
  gstAmount: number;
  totalPayable: number;
  linkedSavingAccountID?: number;
  linkedSavingAccountNo?: string;
  isAutoDebitEnabled: boolean;
  savingsBalance: number;
}

export interface LockerRentRenewalProps {
  onNavigate?: (tab: string, params?: any) => void;
  voucherId?: string | number | null;
  isPassingMode?: boolean;
}

const LockerRentRenewal: React.FC<LockerRentRenewalProps> = ({ onNavigate, voucherId, isPassingMode }) => {
  const queryParams = new URLSearchParams(window.location.search);
  const effectiveVoucherId = voucherId || queryParams.get('voucherId');
  const isPassing = isPassingMode || queryParams.get('passingMode') === 'true';

  const [passingVoucherData, setPassingVoucherData] = useState<any | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [renewals, setRenewals] = useState<PendingRenewal[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'All' | 'Overdue' | 'AutoDebit'>('All');

  // Single Pay Modal
  const [selectedAllotment, setSelectedAllotment] = useState<PendingRenewal | null>(null);
  const [payData, setPayData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash', // Cash, SavingDebit, Transfer
    rentAmount: 0,
    penaltyAmount: 0,
    gstAmount: 0,
    totalAmount: 0,
    remarks: ''
  });

  useEffect(() => {
    if (isPassing && effectiveVoucherId) {
      loadPassingRenewal(effectiveVoucherId);
    }
  }, [isPassing, effectiveVoucherId]);

  const loadPassingRenewal = async (vId: string | number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/LockerRent/by-voucher/${vId}`);
      if (res.ok) {
        const data = await res.json();
        setPassingVoucherData(data);
        if (data.allotment) {
          const a = data.allotment;
          const rp = data.rentPosting;
          setSelectedAllotment({
            allotmentID: a.allotmentID,
            branchID: a.branchID || 1,
            lockerAccountNo: a.lockerAccountNo,
            lockerID: a.lockerID,
            lockerNo: a.lockerNo,
            cabinetNo: a.cabinetNo,
            keyNo: a.keyNo,
            typeName: a.typeName,
            memberID: a.memberID || 0,
            memberNo: a.memberNo || '',
            memberName: a.memberName || '',
            memberPhone: a.memberPhone || '',
            expiryDate: a.expiryDate || '',
            isOverdue: false,
            overdueDays: 0,
            overdueMonths: 0,
            baseRent: rp ? rp.rentAmount : (a.annualRent || 0),
            lateFee: rp ? rp.penaltyAmount : 0,
            gstAmount: rp ? rp.gstAmount : 0,
            totalPayable: rp ? rp.totalAmount : (data.voucher?.totalAmount || 0),
            isAutoDebitEnabled: false,
            savingsBalance: 0
          });
          setPayData({
            paymentDate: rp?.paymentDate ? rp.paymentDate.split('T')[0] : (data.voucher?.voucherDate ? data.voucher.voucherDate.split('T')[0] : new Date().toISOString().split('T')[0]),
            paymentMode: rp?.paymentMode || 'Cash',
            rentAmount: rp ? rp.rentAmount : (data.voucher?.totalAmount || 0),
            penaltyAmount: rp ? rp.penaltyAmount : 0,
            gstAmount: rp ? rp.gstAmount : 0,
            totalAmount: rp ? rp.totalAmount : (data.voucher?.totalAmount || 0),
            remarks: rp?.remarks || data.voucher?.narration || 'वार्षिक लॉकर भाडे नूतनीकरण'
          });
        }
      }
    } catch (err) {
      console.error('Failed to load passing renewal', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectPass = async () => {
    if (!effectiveVoucherId) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/VoucherPosting/Post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([Number(effectiveVoucherId)])
      });
      if (res.ok) {
        alert('लॉकर भाडे नूतनीकरण व्हाउचर यशस्वीरित्या पास (मंजूर) करण्यात आले!');
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert('पासिंग अयशस्वी: ' + (err.message || 'सर्व्हर त्रुटी'));
      }
    } catch (e) {
      alert('सर्व्हर त्रुटी.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!effectiveVoucherId || !rejectReason.trim()) {
      alert('कृपया नामंजूर करण्याचे कारण प्रविष्ट करा.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/VoucherPosting/${effectiveVoucherId}?reason=${encodeURIComponent(rejectReason)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('लॉकर भाडे नूतनीकरण व्हाउचर नामंजूर / रद्द करण्यात आले!');
        setRejectModalOpen(false);
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert('रद्द करणे अयशस्वी: ' + (err.message || 'सर्व्हर त्रुटी'));
      }
    } catch (e) {
      alert('सर्व्हर त्रुटी.');
    } finally {
      setActionLoading(false);
    }
  };

  // Batch Auto-Debit Result Modal
  const [batchResult, setBatchResult] = useState<{
    successCount: number;
    failedCount: number;
    details: Array<{ lockerAccountNo: string; memberName: string; status: string; amount?: number; reason?: string }>;
  } | null>(null);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchRenewals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/LockerRent/PendingRenewals');
      if (res.ok) {
        const data = await res.json();
        setRenewals(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
  }, []);

  const openPayModal = (item: PendingRenewal) => {
    setSelectedAllotment(item);
    setPayData({
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: item.linkedSavingAccountID && item.savingsBalance >= item.totalPayable ? 'SavingDebit' : 'Cash',
      rentAmount: item.baseRent,
      penaltyAmount: item.lateFee,
      gstAmount: item.gstAmount,
      totalAmount: item.totalPayable,
      remarks: 'वार्षिक लॉकर भाडे नूतनीकरण'
    });
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAllotment) return;

    const payload = {
      allotmentID: selectedAllotment.allotmentID,
      paymentDate: payData.paymentDate,
      paymentMode: payData.paymentMode,
      rentAmount: Number(payData.rentAmount),
      penaltyAmount: Number(payData.penaltyAmount),
      gstAmount: Number(payData.gstAmount),
      totalAmount: Number(payData.totalAmount),
      remarks: payData.remarks
    };

    try {
      const res = await fetch('/api/LockerRent/Collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        showMsg(data.message || 'भाडे यशस्वीरीत्या जमा झाले!');
        setSelectedAllotment(null);
        fetchRenewals();
      } else {
        const data = await res.json();
        showMsg(data.message || 'त्रुटी आली.', 'error');
      }
    } catch (err) {
      console.error(err);
      showMsg('सर्व्हर एरर आली.', 'error');
    }
  };

  const handleRunBatchAutoDebit = async () => {
    if (!window.confirm('तुम्हाला सर्व लिंक्ड बचत खात्यांमधून वार्षिक भाडे ऑटो-कट (Auto-Debit) करायचे आहे का?')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/LockerRent/AutoDebitBatch', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBatchResult(data);
        showMsg(data.message || 'ऑटो-डेबिट प्रक्रिया पूर्ण झाली!');
        fetchRenewals();
      } else {
        showMsg('ऑटो-डेबिट प्रक्रियेत अडचण आली.', 'error');
      }
    } catch (err) {
      console.error(err);
      showMsg('सर्व्हर एरर आली.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Safe arrays
  const safeRenewals = Array.isArray(renewals) ? renewals : [];

  // Filter renewals
  const filteredRenewals = safeRenewals.filter(r => {
    const matchesFilter = filterMode === 'All' || 
      (filterMode === 'Overdue' && r.isOverdue) ||
      (filterMode === 'AutoDebit' && r.isAutoDebitEnabled);

    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      (r.lockerAccountNo && r.lockerAccountNo.toLowerCase().includes(term)) ||
      (r.lockerNo && r.lockerNo.toLowerCase().includes(term)) ||
      (r.memberName && r.memberName.toLowerCase().includes(term));

    return matchesFilter && matchesSearch;
  });

  const totalPayableSum = filteredRenewals.reduce((sum, r) => sum + (r.totalPayable || 0), 0);
  const overdueCount = safeRenewals.filter(r => r.isOverdue).length;
  const autoDebitEligibleCount = safeRenewals.filter(r => r.isAutoDebitEnabled && r.isOverdue).length;

  const inputClass = "w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white";
  const labelClass = "block text-[11px] font-bold text-slate-700 mb-0.5";

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg shadow-xs border border-slate-200 gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
            <DollarSign size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">वार्षिक लॉकर भाडे नूतनीकरण व वसुली (Locker Rent Renewal)</h1>
            <p className="text-xs text-slate-500">देय व थकीत भाडे आकारणी, विलंब शुल्क हिशोब आणि बचत खात्यातून ऑटो-डेबिट बॅच</p>
          </div>
        </div>

        <button
          onClick={handleRunBatchAutoDebit}
          disabled={loading || autoDebitEligibleCount === 0}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-md shadow-xs flex items-center gap-1.5 transition-all ${
            autoDebitEligibleCount > 0 
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
          }`}
        >
          <Sparkles size={14} className={autoDebitEligibleCount > 0 ? 'text-amber-300' : ''} />
          एकत्रित ऑटो-डेबिट चालवा ({autoDebitEligibleCount} खाती)
        </button>
      </div>

      {message && (
        <div className={`p-2.5 rounded-md text-xs font-semibold flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* ⚠️ Amber Checker Alert Banner */}
      {isPassing && (
        <div className="p-3 bg-amber-500/10 border-2 border-amber-500/80 rounded-lg flex items-center justify-between text-amber-900 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-amber-950">
                व्हाउचर तपासणी व मंजुरी मोड (Voucher Passing / Checker Mode)
              </div>
              <div className="text-[10px] text-amber-800">
                व्हाउचर क्र: <span className="font-mono font-bold text-amber-950">{passingVoucherData?.voucher?.voucherNo || effectiveVoucherId}</span> | 
                रक्कम: <span className="font-mono font-bold text-amber-950">₹{passingVoucherData?.voucher?.totalAmount ?? payData.totalAmount}</span> | 
                तारीख: <span className="font-mono font-bold text-amber-950">{passingVoucherData?.voucher?.voucherDate ? new Date(passingVoucherData.voucher.voucherDate).toLocaleDateString('en-GB') : '-'}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900 border border-amber-300">
              कडक वाचन मोड (Read-Only Lockdown)
            </span>
          </div>
        </div>
      )}

      {/* Passing Form View */}
      {isPassing ? (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 max-w-2xl mx-auto overflow-hidden">
          <div className="p-3.5 bg-slate-900 text-white flex justify-between items-center">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <DollarSign size={16} className="text-emerald-400" /> लॉकर भाडे नूतनीकरण व्हाउचर तपासणी (Locker Rent Renewal Voucher)
            </h3>
            <span className="text-xs bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded">
              Checker Mode
            </span>
          </div>

          <div className="p-4 space-y-4">
            {selectedAllotment ? (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">खाते क्रमांक</span>
                  <p className="font-mono font-bold text-slate-800">{selectedAllotment.lockerAccountNo}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">लॉकर व कपाट</span>
                  <p className="font-bold text-slate-800">लॉकर: {selectedAllotment.lockerNo} | कपाट: {selectedAllotment.cabinetNo}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">सभासद नाव</span>
                  <p className="font-bold text-slate-800">{selectedAllotment.memberName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">मोबाईल क्र.</span>
                  <p className="font-mono font-bold text-slate-800">{selectedAllotment.memberPhone || '-'}</p>
                </div>
              </div>
            ) : null}

            <fieldset disabled={isPassing} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelClass}>जमा दिनांक (Payment Date)</label>
                  <input
                    type="date"
                    value={payData.paymentDate}
                    readOnly
                    className={`${inputClass} bg-slate-100 cursor-not-allowed`}
                  />
                </div>
                <div>
                  <label className={labelClass}>पेमेंट पद्धत (Payment Mode)</label>
                  <input
                    type="text"
                    value={payData.paymentMode}
                    readOnly
                    className={`${inputClass} bg-slate-100 cursor-not-allowed`}
                  />
                </div>
              </div>

              {/* Breakdown */}
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700">वार्षिक भाडे (Annual Rent):</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">₹{Number(payData.rentAmount).toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-rose-700">विलंब शुल्क / दंड (Late Fee):</span>
                  <span className="font-mono font-bold text-rose-700 text-sm">₹{Number(payData.penaltyAmount).toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center border-t border-emerald-200 pt-2">
                  <span className="font-black text-slate-900 text-sm">एकूण स्वीकारलेली रक्कम (Total Amount):</span>
                  <span className="font-mono font-black text-emerald-800 text-base">₹{Number(payData.totalAmount).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className={labelClass}>तपशील / शेरा (Remarks)</label>
                <input
                  type="text"
                  value={payData.remarks}
                  readOnly
                  className={`${inputClass} bg-slate-100 cursor-not-allowed`}
                />
              </div>
            </fieldset>

            {/* 3 Checker Action Buttons */}
            <div className="mt-4 p-3 bg-slate-900 rounded-lg shadow-xl border border-amber-500/30 flex items-center justify-between z-40">
              <button
                type="button"
                onClick={() => onNavigate ? onNavigate('voucher-posting') : window.location.href = '/?tab=voucher-posting'}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-600 flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>↩️ पासिंग यादीवर परत जा</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setRejectReason(''); setRejectModalOpen(true); }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>❌ नामंजूर / रद्द करा</span>
                </button>
                <button
                  type="button"
                  onClick={handleDirectPass}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{actionLoading ? 'पास होत आहे...' : '✅ मंजूर व पास करा (Authorize)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white p-3 rounded-lg shadow-xs border border-slate-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">एकूण नूतनीकरण देय खाती</p>
          <p className="text-xl font-black text-slate-800">{renewals.length}</p>
        </div>

        <div className="bg-rose-50 p-3 rounded-lg shadow-xs border border-rose-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">थकीत भाडे खाती (Overdue)</p>
          <p className="text-xl font-black text-rose-800">{overdueCount}</p>
        </div>

        <div className="bg-emerald-50 p-3 rounded-lg shadow-xs border border-emerald-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">एकूण येणे भाडे रक्कम</p>
          <p className="text-xl font-black text-emerald-800">
            ₹{totalPayableSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-2.5 rounded-lg shadow-xs border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="खाते क्र. / लॉकर क्र. / सभासद शोधा..."
              className="w-full text-xs pl-7 pr-2.5 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setFilterMode('All')}
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                filterMode === 'All' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              सर्व ({renewals.length})
            </button>
            <button
              onClick={() => setFilterMode('Overdue')}
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                filterMode === 'Overdue' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              थकीत ({overdueCount})
            </button>
            <button
              onClick={() => setFilterMode('AutoDebit')}
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                filterMode === 'AutoDebit' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              ऑटो-डेबिट ({renewals.filter(r => r.isAutoDebitEnabled).length})
            </button>
          </div>
        </div>
      </div>

      {/* Renewals Table */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                <th className="py-2 px-3">खाते क्रमांक</th>
                <th className="py-2 px-3">लॉकर क्र.</th>
                <th className="py-2 px-3">सभासद नाव</th>
                <th className="py-2 px-3">मुदत समाप्ती</th>
                <th className="py-2 px-3 text-right">वार्षिक भाडे</th>
                <th className="py-2 px-3 text-right">विलंब शुल्क</th>
                <th className="py-2 px-3 text-right">एकूण देय</th>
                <th className="py-2 px-3">ऑटो-डेबिट बचत खाते</th>
                <th className="py-2 px-3 text-center">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRenewals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    कोणतीही देय किंवा थकीत भाडे खाती आढळली नाहीत.
                  </td>
                </tr>
              ) : (
                filteredRenewals.map((r) => (
                  <tr key={r.allotmentID} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-emerald-800">{r.lockerAccountNo}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{r.cabinetNo} - {r.lockerNo}</td>
                    <td className="py-2 px-3">
                      <span className="font-bold text-slate-800 block">{r.memberName}</span>
                      <span className="text-[10px] text-slate-500">{r.memberPhone || '-'}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`font-bold ${r.isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                        {new Date(r.expiryDate).toLocaleDateString('en-GB')}
                      </span>
                      {r.isOverdue && (
                        <span className="text-[9px] bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-bold block w-fit">
                          {r.overdueMonths} महिने थकीत
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-700">₹{r.baseRent?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-rose-700">₹{r.lateFee?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-black text-emerald-700 text-sm">₹{r.totalPayable?.toFixed(2)}</td>
                    <td className="py-2 px-3">
                      {r.isAutoDebitEnabled && r.linkedSavingAccountNo ? (
                        <div className="text-[11px]">
                          <span className="text-purple-700 font-bold flex items-center gap-0.5">
                            <Sparkles size={11} /> {r.linkedSavingAccountNo}
                          </span>
                          <span className="text-[10px] text-slate-500">शिल्लक: ₹{r.savingsBalance?.toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px]">रोख / मॅन्युअल</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => openPayModal(r)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-2xs text-xs flex items-center gap-1 mx-auto"
                      >
                        <DollarSign size={13} /> भाडे भरा
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Rent Modal */}
      {selectedAllotment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-3.5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <DollarSign size={16} className="text-emerald-400" /> लॉकर भाडे स्वीकृती पावती
              </h3>
              <button onClick={() => setSelectedAllotment(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="p-4 space-y-3">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">खाते व लॉकर</span>
                  <p className="font-bold text-slate-800">{selectedAllotment.lockerAccountNo} ({selectedAllotment.lockerNo})</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">सभासद नाव</span>
                  <p className="font-bold text-slate-800">{selectedAllotment.memberName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelClass}>जमा दिनांक (Payment Date) *</label>
                  <input
                    type="date"
                    value={payData.paymentDate}
                    onChange={(e) => setPayData({ ...payData, paymentDate: e.target.value })}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>पेमेंट पद्धत (Payment Mode) *</label>
                  <select
                    value={payData.paymentMode}
                    onChange={(e) => setPayData({ ...payData, paymentMode: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Cash">रोख (Cash)</option>
                    {selectedAllotment.linkedSavingAccountID && (
                      <option value="SavingDebit">
                        बचत खात्यातून कपात (A/c: {selectedAllotment.linkedSavingAccountNo})
                      </option>
                    )}
                    <option value="Transfer">बँक ट्रान्सफर / इतर (Transfer)</option>
                  </select>
                </div>
              </div>

              {/* Breakdown */}
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700">वार्षिक भाडे (Annual Rent):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={payData.rentAmount}
                    onChange={(e) => {
                      const rent = parseFloat(e.target.value) || 0;
                      setPayData({
                        ...payData,
                        rentAmount: rent,
                        totalAmount: rent + payData.penaltyAmount + payData.gstAmount
                      });
                    }}
                    className="w-28 text-right text-xs p-1 rounded border font-bold"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-rose-700">विलंब शुल्क / दंड (Late Fee):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={payData.penaltyAmount}
                    onChange={(e) => {
                      const pen = parseFloat(e.target.value) || 0;
                      setPayData({
                        ...payData,
                        penaltyAmount: pen,
                        totalAmount: payData.rentAmount + pen + payData.gstAmount
                      });
                    }}
                    className="w-28 text-right text-xs p-1 rounded border font-bold text-rose-700"
                  />
                </div>

                <div className="flex justify-between items-center border-t border-emerald-200 pt-2">
                  <span className="font-black text-slate-900 text-sm">एकूण स्वीकारायची रक्कम:</span>
                  <span className="font-black text-emerald-800 text-base">₹{payData.totalAmount?.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className={labelClass}>शेरा (Remarks)</label>
                <input
                  type="text"
                  value={payData.remarks}
                  onChange={(e) => setPayData({ ...payData, remarks: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAllotment(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs flex items-center gap-1"
                >
                  <Save size={13} /> भाडे जमा करा व व्हाऊचर बनवा
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Auto-Debit Result Modal */}
      {batchResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-3.5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Sparkles size={16} className="text-purple-400" /> ऑटो-डेबिट प्रक्रिया अहवाल (Batch Result)
              </h3>
              <button onClick={() => setBatchResult(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">यशस्वी कपात</span>
                  <p className="text-lg font-black text-emerald-800">{batchResult.successCount}</p>
                </div>
                <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">अयशस्वी</span>
                  <p className="text-lg font-black text-rose-800">{batchResult.failedCount}</p>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-md">
                {batchResult.details.map((d, idx) => (
                  <div key={idx} className="p-2 flex justify-between items-center text-[11px]">
                    <div>
                      <span className="font-bold text-slate-800">{d.lockerAccountNo}</span>
                      <span className="text-slate-500 block">{d.memberName}</span>
                    </div>
                    <div>
                      {d.status === 'Success' ? (
                        <span className="text-emerald-700 font-bold">✓ ₹{d.amount?.toFixed(2)} कपात</span>
                      ) : (
                        <span className="text-rose-700 font-semibold">{d.reason}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setBatchResult(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-md"
              >
                समजले
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    )}

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              व्हाउचर नामंजूर / रद्द करा (Reject Voucher)
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              व्हाउचर क्र: <span className="font-mono font-bold text-slate-900">{passingVoucherData?.voucher?.voucherNo || effectiveVoucherId}</span>
            </p>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                नामंजूर करण्याचे कारण प्रविष्ट करा (Reason) <span className="text-rose-500">*</span>:
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="उदा. चुकीचे भाडे नूतनीकरण / चुकीची रक्कम..."
                className="w-full h-24 p-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded cursor-pointer"
              >
                रद्द करा (Back)
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'प्रक्रिया सुरू आहे...' : 'नामंजूर करा (Reject)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LockerRentRenewal;
