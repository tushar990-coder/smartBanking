import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Printer, 
  Search, 
  Key, 
  DollarSign, 
  ShieldAlert, 
  Save, 
  UserCheck, 
  ArrowRight, 
  List, 
  Plus,
  ArrowLeft,
  XCircle,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface AllotmentOption {
  allotmentID: number;
  lockerAccountNo: string;
  lockerNo: string;
  cabinetNo: string;
  keyNo: string;
  memberName: string;
  memberNo: string;
  securityDepositAmount: number;
  annualRent: number;
  expiryDate: string;
  linkedSavingAccountID?: number;
  linkedSavingAccountNo?: string;
  isOverdue: boolean;
  status: string;
}

interface SurrenderRecord {
  surrenderID: number;
  branchID: number;
  allotmentID: number;
  lockerAccountNo: string;
  lockerNo: string;
  memberName: string;
  surrenderDate: string;
  keyReceived: boolean;
  keysCondition: string;
  depositAmount: number;
  unpaidRentDeduction: number;
  damagePenaltyDeduction: number;
  netRefundAmount: number;
  refundPaymentMode: string;
  voucherNo?: string;
  remarks?: string;
  createdAt: string;
}

export interface LockerSurrenderMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
  voucherId?: string | number | null;
  isPassingMode?: boolean;
}

const LockerSurrenderMaster: React.FC<LockerSurrenderMasterProps> = ({ onNavigate, voucherId, isPassingMode }) => {
  const queryParams = new URLSearchParams(window.location.search);
  const effectiveVoucherId = voucherId || queryParams.get('voucherId');
  const isPassing = isPassingMode || queryParams.get('passingMode') === 'true';

  const [passingVoucherData, setPassingVoucherData] = useState<any | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'surrender' | 'history'>('surrender');
  const [surrenders, setSurrenders] = useState<SurrenderRecord[]>([]);
  const { user } = useAuth();
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];

  const [allotments, setAllotments] = useState<AllotmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    allotmentID: '',
    surrenderDate: activeBusinessDate,
    keyReceived: true,
    keysCondition: 'Good',
    depositAmount: 0,
    unpaidRentDeduction: 0,
    damagePenaltyDeduction: 0,
    netRefundAmount: 0,
    refundPaymentMode: 'Cash',
    remarks: ''
  });

  // Sync CBS Business Date if changed
  useEffect(() => {
    if (user?.businessDate) {
      setFormData(prev => ({
        ...prev,
        surrenderDate: user.businessDate.split('T')[0]
      }));
    }
  }, [user?.businessDate]);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchSurrenders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/LockerSurrender');
      if (res.ok) {
        const data = await res.json();
        setSurrenders(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveAllotments = async () => {
    try {
      const res = await fetch('/api/LockerAllotments?status=Active');
      if (res.ok) {
        const data = await res.json();
        setAllotments(data);

        // Fast-track targeted allotment preselection
        const params = new URLSearchParams(window.location.search);
        let customerIdStr = params.get('customerId') || params.get('customerID');
        let memberIdStr = params.get('memberId') || params.get('memberID');
        let allotmentIdStr = params.get('allotmentId') || params.get('id');

        if (!customerIdStr && !memberIdStr && !allotmentIdStr) {
          try {
            const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
            if (rawBridge) {
              sessionStorage.removeItem('cbs_active_customer_transfer');
              const bridgeData = JSON.parse(rawBridge);
              if (bridgeData) {
                customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
                memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : null;
                allotmentIdStr = bridgeData.allotmentId ? String(bridgeData.allotmentId) : null;
              }
            }
          } catch (e) {}
        }

        const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
        const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
        const aId = allotmentIdStr ? parseInt(allotmentIdStr, 10) : 0;

        if (aId > 0 || cId > 0 || mId > 0) {
          const matched = data.find((item: any) => 
            (aId > 0 && item.allotmentID === aId) ||
            (cId > 0 && item.customerID === cId) ||
            (mId > 0 && item.memberID === mId)
          );
          if (matched) {
            setFormData(prev => ({ ...prev, allotmentID: matched.allotmentID.toString() }));
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSurrenders();
    fetchActiveAllotments();
  }, []);

  useEffect(() => {
    if (isPassing && effectiveVoucherId) {
      loadPassingSurrender(effectiveVoucherId);
    }
  }, [isPassing, effectiveVoucherId]);

  const loadPassingSurrender = async (vId: string | number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/LockerSurrender/by-voucher/${vId}`);
      if (res.ok) {
        const data = await res.json();
        setPassingVoucherData(data);
        setActiveTab('surrender');
        setFormData({
          allotmentID: data.allotmentID ? String(data.allotmentID) : '',
          surrenderDate: data.surrenderDate ? data.surrenderDate.split('T')[0] : activeBusinessDate,
          keyReceived: data.keyReceived ?? true,
          keysCondition: data.keysCondition || 'Good',
          depositAmount: data.depositAmount || (data.voucher?.totalAmount || 0),
          unpaidRentDeduction: data.unpaidRentDeduction || 0,
          damagePenaltyDeduction: data.damagePenaltyDeduction || 0,
          netRefundAmount: data.netRefundAmount || (data.voucher?.totalAmount || 0),
          refundPaymentMode: data.refundPaymentMode || (data.voucher?.voucherType === 'Journal' ? 'SavingCredit' : 'Cash'),
          remarks: data.remarks || data.voucher?.narration || 'लॉकर समर्पण व डिपॉझिट परतावा'
        });
      }
    } catch (err) {
      console.error('Failed to load passing surrender', err);
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
        alert('लॉकर समर्पण व्हाउचर यशस्वीरित्या पास (मंजूर) करण्यात आले!');
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

  const handleRejectVoucher = async () => {
    if (!effectiveVoucherId) return;
    if (!rejectReason.trim()) {
      alert('कृपया नामंजूर करण्याचे कारण लिहा.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/VoucherPosting/${effectiveVoucherId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim(), userId: 1, username: 'Checker' })
      });
      if (res.ok) {
        alert('व्हाउचर यशस्वीरित्या नामंजूर / रद्द करण्यात आले.');
        setRejectModalOpen(false);
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert('नामंजूर अयशस्वी: ' + (err.message || 'सर्व्हर त्रुटी'));
      }
    } catch (e) {
      alert('सर्व्हर त्रुटी.');
    } finally {
      setActionLoading(false);
    }
  };

  // When Allotment is selected, auto calculate deposit and unpaid rent if any
  useEffect(() => {
    if (!isPassing && formData.allotmentID) {
      const selected = allotments.find(a => a.allotmentID.toString() === formData.allotmentID.toString());
      if (selected) {
        const deposit = selected.securityDepositAmount || 0;
        let unpaid = 0;
        if (selected.isOverdue) {
          unpaid = selected.annualRent || 0;
        }

        const net = Math.max(0, deposit - unpaid - formData.damagePenaltyDeduction);
        setFormData(prev => ({
          ...prev,
          depositAmount: deposit,
          unpaidRentDeduction: unpaid,
          netRefundAmount: net,
          refundPaymentMode: selected.linkedSavingAccountID ? 'SavingCredit' : 'Cash'
        }));
      }
    }
  }, [formData.allotmentID, allotments, isPassing]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string; value: string | number; type?: string } }
  ) => {
    if (isPassing) return;
    const target = e.target as any;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    
    setFormData(prev => {
      const updated = { ...prev, [target.name]: value };
      if (target.name === 'unpaidRentDeduction' || target.name === 'damagePenaltyDeduction' || target.name === 'depositAmount') {
        const dep = parseFloat(updated.depositAmount as any) || 0;
        const unp = parseFloat(updated.unpaidRentDeduction as any) || 0;
        const dmg = parseFloat(updated.damagePenaltyDeduction as any) || 0;
        updated.netRefundAmount = Math.max(0, dep - unp - dmg);
      }
      return updated;
    });
  };

  const handleReset = () => {
    if (isPassing) return;
    setFormData({
      allotmentID: '',
      surrenderDate: activeBusinessDate,
      keyReceived: true,
      keysCondition: 'Good',
      depositAmount: 0,
      unpaidRentDeduction: 0,
      damagePenaltyDeduction: 0,
      netRefundAmount: 0,
      refundPaymentMode: 'Cash',
      remarks: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPassing) return;
    if (!formData.allotmentID) {
      showMsg('कृपया लॉकर खाते निवडा.', 'error');
      return;
    }
    if (!window.confirm('तुम्हाला हे लॉकर खाते नक्की बंद (Surrender) करायचे आहे का?')) return;

    const payload = {
      allotmentID: parseInt(formData.allotmentID),
      surrenderDate: formData.surrenderDate,
      keyReceived: formData.keyReceived,
      keysCondition: formData.keysCondition,
      depositAmount: Number(formData.depositAmount),
      unpaidRentDeduction: Number(formData.unpaidRentDeduction),
      damagePenaltyDeduction: Number(formData.damagePenaltyDeduction),
      netRefundAmount: Number(formData.netRefundAmount),
      refundPaymentMode: formData.refundPaymentMode,
      remarks: formData.remarks
    };

    try {
      const res = await fetch('/api/LockerSurrender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        showMsg(data.message || 'लॉकर यशस्वीरीत्या समर्पित करण्यात आला!');
        handleReset();
        fetchActiveAllotments();
        fetchSurrenders();
        setActiveTab('history');
      } else {
        const data = await res.json();
        showMsg(data.message || 'त्रुटी आली.', 'error');
      }
    } catch (err) {
      console.error(err);
      showMsg('सर्व्हर एरर आली.', 'error');
    }
  };

  const safeAllotments = Array.isArray(allotments) ? allotments : [];
  const safeSurrenders = Array.isArray(surrenders) ? surrenders : [];

  const allotmentDropdownOptions = isPassing && passingVoucherData ? [
    { 
      value: passingVoucherData.allotmentID ? String(passingVoucherData.allotmentID) : '', 
      label: `${passingVoucherData.lockerAccountNo || 'LKR-ACC'} | लॉकर: ${passingVoucherData.cabinetNo || ''}-${passingVoucherData.lockerNo || ''} | ${passingVoucherData.memberName || 'खातेदार'} (डिपॉझिट ₹${passingVoucherData.depositAmount})` 
    }
  ] : [
    { value: '', label: '-- सक्रिय लॉकर खाते निवडा --' },
    ...safeAllotments.map(a => ({
      value: a.allotmentID.toString(),
      label: `${a.lockerAccountNo} | लॉकर: ${a.cabinetNo}-${a.lockerNo} (चावी: ${a.keyNo}) | ${a.memberName} (डिपॉझिट ₹${a.securityDepositAmount})`
    }))
  ];

  const selectedAllotment = isPassing && passingVoucherData ? {
    memberName: passingVoucherData.memberName || 'खातेदार',
    cabinetNo: passingVoucherData.cabinetNo || '-',
    lockerNo: passingVoucherData.lockerNo || '-',
    securityDepositAmount: passingVoucherData.depositAmount || 0,
    expiryDate: passingVoucherData.surrenderDate || new Date().toISOString(),
    isOverdue: false
  } : safeAllotments.find(a => a.allotmentID.toString() === formData.allotmentID.toString());

  const filteredSurrenders = safeSurrenders.filter(s => {
    const term = searchTerm.toLowerCase();
    return !term ||
      (s.lockerAccountNo && s.lockerAccountNo.toLowerCase().includes(term)) ||
      (s.lockerNo && s.lockerNo.toLowerCase().includes(term)) ||
      (s.memberName && s.memberName.toLowerCase().includes(term));
  });

  const inputClass = `w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 ${isPassing ? 'bg-slate-100 cursor-not-allowed font-medium' : 'bg-white'}`;
  const labelClass = "block text-[11px] font-bold text-slate-700 mb-0.5";

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 pb-24">
      {/* 🛡️ Passing Mode Amber Alert Banner */}
      {isPassing && (
        <div className="p-3 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white rounded-lg shadow-md border border-amber-400 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-md">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded">
                  तपासणी व मंजुरी मोड (Voucher Passing View)
                </span>
                <span className="text-xs font-bold text-amber-100">
                  व्हाउचर क्र.: {passingVoucherData?.voucher?.voucherNo || effectiveVoucherId}
                </span>
              </div>
              <p className="text-[11.5px] text-amber-100 mt-0.5 font-medium">
                लॉकर समर्पण व अनामत परतावा नोंदीची संपूर्ण माहिती. हा फॉर्म केवळ वाचनासाठी (Read-Only) लॉक आहे.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('voucher-posting') : window.location.href = '/?tab=voucher-posting'}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-all border border-white/30"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>यादीवर परत जा</span>
            </button>
            <button
              type="button"
              onClick={() => setRejectModalOpen(true)}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs transition-all disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>नामंजूर करा</span>
            </button>
            <button
              type="button"
              onClick={handleDirectPass}
              disabled={actionLoading}
              className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{actionLoading ? 'पास होत आहे...' : 'मंजूर व पास करा (Approve & Pass)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg shadow-xs border border-slate-200 gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
            <LogOut size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">लॉकर समर्पण व अनामत परतावा (Locker Surrender)</h1>
            <p className="text-xs text-slate-500">लॉकर खाते बंद करणे, चावी तपासणी, थकीत वजावट व अनामत रक्कम परतावा व्हाऊचर</p>
          </div>
        </div>

        {/* Tab Switcher */}
        {!isPassing && (
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('surrender')}
              className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                activeTab === 'surrender' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus size={14} /> लॉकर समर्पण फॉर्म
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                activeTab === 'history' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List size={14} /> समर्पण इतिहास ({surrenders.length})
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-2.5 rounded-md text-xs font-semibold flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tab 1: Surrender Form */}
      {activeTab === 'surrender' && (
        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isPassing} className="contents space-y-4">
              
              {/* Step 1: Select Active Allotment */}
              <div className="bg-rose-50/40 p-3 rounded-lg border border-rose-200">
                <h2 className="text-xs font-bold text-rose-950 mb-2 flex items-center gap-1.5">
                  <LogOut size={15} className="text-rose-700" /> १. समर्पित करावयाचे लॉकर खाते निवडा
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className={labelClass}>सक्रिय लॉकर खाते *</label>
                    <SearchableSelect
                      name="allotmentID"
                      value={formData.allotmentID}
                      onChange={handleChange}
                      options={allotmentDropdownOptions}
                      placeholder="-- लॉकर खाते किंवा लॉकर क्रमांक शोधा --"
                      disabled={isPassing}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>समर्पण दिनांक (Surrender Date) *</label>
                    <input
                      type="date"
                      name="surrenderDate"
                      value={formData.surrenderDate}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      disabled={isPassing}
                    />
                  </div>
                </div>
              </div>

              {/* Selected Info Card */}
              {selectedAllotment && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">सभासद</span>
                    <p className="font-bold text-slate-800">{selectedAllotment.memberName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">कपाट व लॉकर</span>
                    <p className="font-bold text-slate-800">{selectedAllotment.cabinetNo} - {selectedAllotment.lockerNo}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">जमा अनामत रक्कम</span>
                    <p className="font-bold text-blue-700">₹{selectedAllotment.securityDepositAmount?.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">मुदत स्थिती</span>
                    <p className={`font-bold ${selectedAllotment.isOverdue ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {new Date(selectedAllotment.expiryDate).toLocaleDateString('en-GB')} {selectedAllotment.isOverdue ? '(थकबाकी)' : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Key Handover & Verification */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h2 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Key size={15} className="text-amber-600" /> २. चावी हस्तांतरण व तपासणी (Key Handover)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center space-x-2 pt-4">
                    <label className={`flex items-center space-x-2 text-xs font-bold text-slate-800 ${isPassing ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        name="keyReceived"
                        checked={formData.keyReceived}
                        onChange={handleChange}
                        disabled={isPassing}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>खातेदाराकडून मूळ चावी परत मिळाली</span>
                    </label>
                  </div>

                  <div>
                    <label className={labelClass}>चावीची स्थिती (Keys Condition)</label>
                    <select
                      name="keysCondition"
                      value={formData.keysCondition}
                      onChange={handleChange}
                      disabled={isPassing}
                      className={inputClass}
                    >
                      <option value="Good">उत्कृष्ट / मूळ चावी (Good / Original Key)</option>
                      <option value="KeyDamaged">चावी खराब झालेली (Damaged Key)</option>
                      <option value="LostKeyBreakOpen">चावी हरवली / लॉकर तोडला (Lost Key Break-Open)</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>परतावा पद्धत (Refund Mode) *</label>
                    <select
                      name="refundPaymentMode"
                      value={formData.refundPaymentMode}
                      onChange={handleChange}
                      disabled={isPassing}
                      className={inputClass}
                    >
                      <option value="Cash">रोख परतावा (Cash Refund)</option>
                      <option value="SavingCredit">बचत खात्यात जमा (Saving Credit)</option>
                      <option value="BankTransfer">बँक ट्रान्सफर (Bank Transfer)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 3: Refund & Deductions Calculation */}
              <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200">
                <h2 className="text-xs font-bold text-emerald-950 mb-2 flex items-center gap-1.5">
                  <DollarSign size={15} className="text-emerald-700" /> ३. परतावा हिशोब व कपात (Deposit Refund Calculation)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>मूळ अनामत रक्कम (Deposit ₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="depositAmount"
                      value={formData.depositAmount}
                      onChange={handleChange}
                      disabled={isPassing}
                      className={`${inputClass} font-bold text-blue-700`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>थकीत भाडे वजावट (Unpaid Rent ₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="unpaidRentDeduction"
                      value={formData.unpaidRentDeduction}
                      onChange={handleChange}
                      disabled={isPassing}
                      className={`${inputClass} font-bold text-rose-700`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>नुकसान / दंड वजावट (Penalty ₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="damagePenaltyDeduction"
                      value={formData.damagePenaltyDeduction}
                      onChange={handleChange}
                      disabled={isPassing}
                      className={`${inputClass} font-bold text-rose-700`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>निव्वळ परतावा रक्कम (Net Refund ₹)</label>
                    <div className="text-sm font-black text-emerald-800 bg-white p-1.5 rounded-md border border-emerald-300">
                      ₹{Number(formData.netRefundAmount || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>शेरा (Remarks)</label>
                <input
                  type="text"
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  disabled={isPassing}
                  placeholder="लॉकर सोडण्याचे कारण व शेरा"
                  className={inputClass}
                />
              </div>

            </fieldset>

            {/* Bottom Controls */}
            {isPassing ? (
              <div className="pt-3 border-t-2 border-amber-300 bg-amber-50/70 p-3 rounded-b-md flex flex-wrap justify-between items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate ? onNavigate('voucher-posting') : window.location.href = '/?tab=voucher-posting'}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>व्हाउचर पासिंग यादीवर परत जा</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(true)}
                    disabled={actionLoading}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>नामंजूर / रद्द करा (Reject)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectPass}
                    disabled={actionLoading}
                    className="px-5 py-1.5 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>{actionLoading ? 'पास होत आहे...' : 'मंजूर व पास करा (Approve & Pass)'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={14} /> लॉकर समर्पित करा व डिपॉझिट परतावा व्हाऊचर बनवा
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Tab 2: Surrender History */}
      {!isPassing && activeTab === 'history' && (
        <div className="space-y-3">
          <div className="bg-white p-2.5 rounded-lg shadow-xs border border-slate-200 flex justify-between items-center">
            <div className="relative w-72">
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="खाते क्र. / लॉकर क्र. / सभासद शोधा..."
                className="w-full text-xs pl-7 pr-2.5 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <span className="text-xs text-slate-500">
              एकूण समर्पित लॉकर्स: <strong className="text-slate-800">{filteredSurrenders.length}</strong>
            </span>
          </div>

          <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2 px-3">समर्पण दिनांक</th>
                    <th className="py-2 px-3">खाते क्रमांक</th>
                    <th className="py-2 px-3">लॉकर क्र.</th>
                    <th className="py-2 px-3">सभासद नाव</th>
                    <th className="py-2 px-3 text-right">मूळ डिपॉझिट</th>
                    <th className="py-2 px-3 text-right">थकीत वजावट</th>
                    <th className="py-2 px-3 text-right">परतावा रक्कम</th>
                    <th className="py-2 px-3">पेमेंट मोड</th>
                    <th className="py-2 px-3">व्हाऊचर क्रमांक</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSurrenders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400">
                        कोणतेही समर्पण रेकॉर्ड सापडले नाही.
                      </td>
                    </tr>
                  ) : (
                    filteredSurrenders.map((s) => (
                      <tr key={s.surrenderID} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-semibold">{new Date(s.surrenderDate).toLocaleDateString('en-GB')}</td>
                        <td className="py-2 px-3 font-mono font-bold text-rose-800">{s.lockerAccountNo}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{s.lockerNo}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{s.memberName}</td>
                        <td className="py-2 px-3 text-right font-bold text-blue-700">₹{s.depositAmount?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-rose-700">₹{(s.unpaidRentDeduction + s.damagePenaltyDeduction)?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-black text-emerald-800 text-sm">₹{s.netRefundAmount?.toFixed(2)}</td>
                        <td className="py-2 px-3 font-semibold text-slate-600">{s.refundPaymentMode}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-purple-700">{s.voucherNo || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🛑 Rejection Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden border border-rose-300 border-t-4 border-t-rose-600 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-50 px-4 py-3 border-b border-rose-100 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <div>
                <h3 className="text-sm font-bold text-rose-900">व्हाउचर नामंजूर / रद्द करा (Reject Voucher)</h3>
                <p className="text-[11px] text-rose-700">व्हाउचर क्र: <span className="font-mono font-bold">{passingVoucherData?.voucher?.voucherNo || effectiveVoucherId}</span></p>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <label className="block text-xs font-semibold text-gray-700">
                नामंजूर करण्याचे कारण लिहा (Reason for Rejection): <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="उदा. चावी तपासणी अपूर्ण / डिपॉझिट रक्कम जुळत नाही / कागदपत्रे अपूर्ण..."
                rows={3}
                className="w-full text-xs border border-gray-300 rounded p-2 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectReason('');
                }}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded transition-colors cursor-pointer"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                onClick={handleRejectVoucher}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'प्रक्रिया सुरू आहे...' : 'नामंजूर निश्चित करा (Confirm Reject)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LockerSurrenderMaster;
