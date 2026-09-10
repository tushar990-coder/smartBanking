import React, { useState, useEffect, useMemo } from 'react';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
import { 
  ArrowRight, RefreshCw, CheckCircle, AlertCircle, Award, FileText, UserCheck, 
  ShieldCheck, Printer, List, Trash2, X, Search, Users, CheckCircle2, RotateCcw, 
  CheckSquare, Plus, Layers, BookOpen, CreditCard
} from 'lucide-react';

interface Member extends MemberOption {}

interface ShareAccount {
  shareAccountId: number;
  accountNo: string;
  totalShareAmount: number;
  totalShareCount: number;
}

interface SavingAccount {
  savingAccountID?: number;
  savingAccountId?: number;
  accountNo: string;
  currentBalance?: number;
  status?: string;
  memberID?: number;
  memberId?: number;
}

interface TransferHistoryItem {
  transactionId: number;
  transactionDate: string;
  transactionType: string;
  numberOfShares: number;
  amount: number;
  narration: string;
  voucherNo?: string;
  memberId: number;
  memberName: string;
  memberCode: string;
}

export default function ShareTransferMaster() {
  const [members, setMembers] = useState<Member[]>([]);
  const [history, setHistory] = useState<TransferHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Transfer Form State
  const [fromMemberId, setFromMemberId] = useState<string>('');
  const [toMemberId, setToMemberId] = useState<string>('');
  const [numberOfShares, setNumberOfShares] = useState<string>('');
  const [resolutionNo, setResolutionNo] = useState<string>('');
  const [resolutionDate, setResolutionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transferFee, setTransferFee] = useState<string>('0');
  const [feePaymentMode, setFeePaymentMode] = useState<'None' | 'Cash' | 'Saving'>('None');
  const [savingAccountId, setSavingAccountId] = useState<string>('');
  const [narration, setNarration] = useState<string>('सभासद शेअर हस्तांतरण (Share Transfer)');

  // Member Accounts State
  const [fromShareAccount, setFromShareAccount] = useState<ShareAccount | null>(null);
  const [toShareAccount, setToShareAccount] = useState<ShareAccount | null>(null);
  const [fromSavingAccounts, setFromSavingAccounts] = useState<SavingAccount[]>([]);
  const [transferSuccessData, setTransferSuccessData] = useState<any | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const [resMembers, resHistory] = await Promise.all([
        fetch('/api/Members', { headers: authHeaders }),
        fetch('/api/ShareAccounts/TransferHistory', { headers: authHeaders })
      ]);

      if (resMembers.ok) setMembers(await resMembers.json());
      if (resHistory.ok) setHistory(await resHistory.json());
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load FromMember Share Account
  useEffect(() => {
    if (fromMemberId) {
      loadFromMemberDetails(fromMemberId);
    } else {
      setFromShareAccount(null);
      setFromSavingAccounts([]);
    }
  }, [fromMemberId]);

  // Load ToMember Share Account
  useEffect(() => {
    if (toMemberId) {
      loadToMemberDetails(toMemberId);
    } else {
      setToShareAccount(null);
    }
  }, [toMemberId]);

  const loadFromMemberDetails = async (memberId: string) => {
    try {
      const fromMem = members.find((m: any) => 
        m.memberID?.toString() === memberId.toString() ||
        m.customerID?.toString() === memberId.toString()
      );
      const cId = fromMem?.customerID;
      const resolvedMemberId = fromMem?.memberID ? fromMem.memberID.toString() : memberId;
      const authHeaders = getAuthHeaders();

      const shareUrl = cId
        ? `/api/ShareAccounts/Member/${resolvedMemberId}?customerId=${cId}`
        : `/api/ShareAccounts/Member/${resolvedMemberId}`;

      const savingUrl = cId
        ? `/api/SavingAccounts?customerId=${cId}&memberId=${resolvedMemberId}`
        : `/api/SavingAccounts?memberId=${resolvedMemberId}`;

      const [resShare, resSaving] = await Promise.all([
        fetch(shareUrl, { headers: authHeaders }),
        fetch(savingUrl, { headers: authHeaders })
      ]);

      if (resShare.ok) {
        setFromShareAccount(await resShare.json());
      } else {
        setFromShareAccount(null);
      }

      if (resSaving.ok) {
        const allSaving = await resSaving.json();
        const memberSaving = allSaving.filter((s: any) => {
          const mId = s.memberID !== undefined ? s.memberID : s.memberId;
          const custId = s.customerID !== undefined ? s.customerID : s.customerId;
          const resMemId = s.resolvedMemberID;
          const stat = (s.status || '').toLowerCase();
          const isOwner = (cId && custId === cId) || (mId === parseInt(resolvedMemberId)) || (resMemId && resMemId === parseInt(resolvedMemberId));
          return isOwner && (stat === 'active' || stat === 'चालू' || stat === '');
        });
        setFromSavingAccounts(memberSaving);
        if (memberSaving.length > 0) {
          const firstId = memberSaving[0].savingAccountID !== undefined ? memberSaving[0].savingAccountID : memberSaving[0].savingAccountId;
          setSavingAccountId(firstId ? firstId.toString() : '');
        } else {
          setSavingAccountId('');
        }
      }
    } catch (err) {
      console.error('Error loading FromMember details:', err);
    }
  };

  const loadToMemberDetails = async (memberId: string) => {
    try {
      const toMem = members.find((m: any) => 
        m.memberID?.toString() === memberId.toString() ||
        m.customerID?.toString() === memberId.toString()
      );
      const cId = toMem?.customerID;
      const resolvedMemberId = toMem?.memberID ? toMem.memberID.toString() : memberId;
      const authHeaders = getAuthHeaders();

      const shareUrl = cId
        ? `/api/ShareAccounts/Member/${resolvedMemberId}?customerId=${cId}`
        : `/api/ShareAccounts/Member/${resolvedMemberId}`;

      const resShare = await fetch(shareUrl, { headers: authHeaders });
      if (resShare.ok) {
        setToShareAccount(await resShare.json());
      } else {
        setToShareAccount(null);
      }
    } catch (err) {
      console.error('Error loading ToMember details:', err);
    }
  };

  const resetForm = () => {
    setFromMemberId('');
    setToMemberId('');
    setNumberOfShares('');
    setResolutionNo('');
    setResolutionDate(new Date().toISOString().split('T')[0]);
    setTransferFee('0');
    setFeePaymentMode('None');
    setSavingAccountId('');
    setNarration('सभासद शेअर हस्तांतरण (Share Transfer)');
    setFromShareAccount(null);
    setToShareAccount(null);
    setFromSavingAccounts([]);
    setTransferSuccessData(null);
    setMessage(null);
  };

  const sharesCount = parseInt(numberOfShares) || 0;
  const transferAmount = sharesCount * 100;
  const feeAmt = parseFloat(transferFee) || 0;

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setTransferSuccessData(null);

    if (!fromMemberId || !toMemberId) {
      setMessage({ text: '⚠️ कृपया देणारा आणि घेणारा दोन्ही सभासद निवडा.', type: 'error' });
      return;
    }

    if (fromMemberId === toMemberId) {
      setMessage({ text: '⚠️ देणारा आणि घेणारा सभासद एकच असू शकत नाही.', type: 'error' });
      return;
    }

    if (sharesCount <= 0) {
      setMessage({ text: '⚠️ हस्तांतरित करावयाच्या शेअर्सची संख्या किमान १ असावी.', type: 'error' });
      return;
    }

    if (fromShareAccount && sharesCount > fromShareAccount.totalShareCount) {
      setMessage({ text: `⚠️ देणाऱ्या सभासदाकडे जास्तीत जास्त ${fromShareAccount.totalShareCount} शेअर्स उपलब्ध आहेत.`, type: 'error' });
      return;
    }

    const fromMemberObj = members.find(m => m.memberID.toString() === fromMemberId);
    const toMemberObj = members.find(m => m.memberID.toString() === toMemberId);

    const confirmMsg = `तुम्ही नक्की ${fromMemberObj?.firstName} ${fromMemberObj?.lastName} यांचे ${sharesCount} शेअर्स (₹${transferAmount}) ${toMemberObj?.firstName} ${toMemberObj?.lastName} यांच्या नावे हस्तांतरित करू इच्छिता?`;
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const payload = {
        fromMemberId: parseInt(fromMemberId),
        toMemberId: parseInt(toMemberId),
        numberOfShares: sharesCount,
        branchId: 1,
        resolutionNo: resolutionNo.trim() || null,
        resolutionDate: resolutionDate ? new Date(resolutionDate) : null,
        transferFee: feeAmt,
        feePaymentMode: feePaymentMode,
        savingAccountId: feePaymentMode === 'Saving' && savingAccountId ? parseInt(savingAccountId) : null,
        narration: narration.trim()
      };

      const authHeaders = getAuthHeaders();
      const response = await fetch('/api/ShareAccounts/Transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setTransferSuccessData(data);
        setMessage({ text: `✅ शेअर्स हस्तांतरण यशस्वी! व्हाउचर क्र: ${data.voucherNo}, नवीन प्रमाणपत्र क्र: ${data.certificateNo}`, type: 'success' });
        
        // Reset form fields
        setNumberOfShares('');
        setResolutionNo('');
        setTransferFee('0');
        setFeePaymentMode('None');
        
        // Refresh details
        loadFromMemberDetails(fromMemberId);
        loadToMemberDetails(toMemberId);
        
        // Refresh history
        const resHist = await fetch('/api/ShareAccounts/TransferHistory', { headers: authHeaders });
        if (resHist.ok) setHistory(await resHist.json());
      } else {
        setMessage({ text: `हस्तांतरण अयशस्वी: ${data.message || data}`, type: 'error' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ text: 'हस्तांतरण दरम्यान सर्व्हर किंवा नेटवर्क त्रुटी आली.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTransfer = async (item: TransferHistoryItem) => {
    const confirmMsg = `तुम्हाला खात्री आहे का की हे शेअर हस्तांतरण (${item.numberOfShares} शेअर्स - ₹${item.amount.toFixed(2)}) रद्द / रिव्हर्स करायचे आहे?\n\nयामुळे शेअर्स मूळ सभासदाच्या खात्यावर परत जमा होतील व व्हाउचर रद्द केले जाईल.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const authHeaders = getAuthHeaders();
      const res = await fetch(`/api/ShareAccounts/CancelTransfer/${item.transactionId}`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: `✅ ${data.message || 'हस्तांतरण यशस्वीरित्या रद्द करण्यात आले!'}`, type: 'success' });
        // Refresh history
        const resHist = await fetch('/api/ShareAccounts/TransferHistory', { headers: authHeaders });
        if (resHist.ok) setHistory(await resHist.json());

        // Refresh selected members if any
        if (fromMemberId) loadFromMemberDetails(fromMemberId);
        if (toMemberId) loadToMemberDetails(toMemberId);
      } else {
        setMessage({ text: `⚠️ रद्दीकरण अयशस्वी: ${data.message || data}`, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'रद्द करताना सर्व्हर त्रुटी आली.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = useMemo(() => {
    if (!modalSearchTerm.trim()) return history;
    const term = modalSearchTerm.toLowerCase().trim();
    return history.filter(item => 
      (item.memberName || '').toLowerCase().includes(term) ||
      (item.memberCode || '').toLowerCase().includes(term) ||
      (item.voucherNo || '').toLowerCase().includes(term) ||
      (item.narration || '').toLowerCase().includes(term) ||
      (item.transactionType || '').toLowerCase().includes(term)
    );
  }, [history, modalSearchTerm]);

  // KPI Calculations
  const totalTransfersCount = history.length;
  const totalSharesTransferred = history.reduce((sum, h) => sum + (h.numberOfShares || 0), 0);
  const totalAmountTransferred = history.reduce((sum, h) => sum + (h.amount || 0), 0);
  const totalMembersCount = members.length;

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans pb-8">
      
      {/* 🌟 1. TOP SLEEK CBS HEADER BANNER */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Award size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>सभासद शेअर हस्तांतरण मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Member Share Transfer Master)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              एका सभासदाकडून दुसऱ्या सभासदाकडे शेअर्स हस्तांतरित करा, संचालक ठराव नोंदवा व नवीन प्रमाणपत्र जारी करा
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन नोंद (Reset)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          <button
            type="button"
            onClick={() => setIsListModalOpen(true)}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व शेअर हस्तांतरण व्यवहार यादी पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 हस्तांतरण यादी ({history.length})</span>
          </button>

          <button
            onClick={fetchInitialData}
            disabled={loading}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="डेटा रिफ्रेश करा"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>
        </div>
      </div>

      {/* 📊 2. SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण हस्तांतरण</div>
            <div className="text-sm font-black text-gray-900">{totalTransfersCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">हस्तांतरित शेअर्स</div>
            <div className="text-sm font-black text-emerald-800">{totalSharesTransferred}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">हस्तांतरित मूल्य (₹)</div>
            <div className="text-sm font-black text-indigo-950 font-mono">₹{totalAmountTransferred.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण सभासद</div>
            <div className="text-sm font-black text-amber-800">{totalMembersCount}</div>
          </div>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-2.5 rounded-sm mb-3 border font-semibold flex items-center justify-between text-xs transition-all shadow-2xs ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : message.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : 'bg-blue-50 text-blue-900 border-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-gray-500 hover:text-gray-800 text-xs px-1 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Success Details Card (If Transfer just succeeded) */}
      {transferSuccessData && (
        <div className="bg-emerald-50/80 border border-emerald-300 p-3 rounded-sm shadow-xs mb-3 space-y-2 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-emerald-200 pb-1.5">
            <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>हस्तांतरण पावती व प्रमाणपत्र तपशील (Transfer Summary & Issued Certificate)</span>
            </h3>
            <span className="text-[10px] bg-emerald-200 text-emerald-950 font-bold px-2 py-0.5 rounded font-mono">
              ✓ हस्तांतरण पूर्ण (Completed)
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-white p-2 rounded-sm border border-emerald-200 shadow-2xs">
              <p className="text-[10px] text-gray-500 font-bold">जर्नल व्हाउचर क्र. (JV No)</p>
              <p className="font-bold text-primary font-mono text-xs">{transferSuccessData.voucherNo}</p>
            </div>
            <div className="bg-white p-2 rounded-sm border border-emerald-200 shadow-2xs">
              <p className="text-[10px] text-gray-500 font-bold">नवीन प्रमाणपत्र क्र. (New Cert No)</p>
              <p className="font-bold text-amber-800 font-mono text-xs">{transferSuccessData.certificateNo}</p>
            </div>
            <div className="bg-white p-2 rounded-sm border border-emerald-200 shadow-2xs">
              <p className="text-[10px] text-gray-500 font-bold">शेअर क्रमांक श्रेणी (Serial Range)</p>
              <p className="font-bold text-gray-900 font-mono text-xs">
                {transferSuccessData.fromShareNo} ते {transferSuccessData.toShareNo} ({transferSuccessData.numberOfShares} शेअर्स)
              </p>
            </div>
            <div className="bg-white p-2 rounded-sm border border-emerald-200 shadow-2xs">
              <p className="text-[10px] text-gray-500 font-bold">एकूण हस्तांतरित मूल्य (Total Value)</p>
              <p className="font-black text-emerald-700 font-mono text-xs">₹{transferSuccessData.totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* 📝 3. MAIN TRANSFER FORM */}
      <form onSubmit={handleTransferSubmit} className="space-y-3">
        
        {/* SECTION 1: Dual Member Selection Cards (Transferor & Transferee) */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. शेअर्स देणारा व घेणारा सभासद निवड (Transferor & Transferee)</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* Card A: Transferor (देणारा सभासद) */}
            <div className="bg-slate-50 p-3 rounded-sm border border-rose-200 space-y-2">
              <div className="flex justify-between items-center border-b border-rose-200/60 pb-1">
                <h3 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                  <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold">A</span>
                  <span>देणारा सभासद (Transferor - Member A) <span className="text-rose-600">*</span></span>
                </h3>
                <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">(शेअर्स वजा होणार)</span>
              </div>

              <div>
                <label className={labelClass}>सभासद शोधा व निवडा:</label>
                <MemberSearchSelect
                  members={members}
                  value={fromMemberId ? Number(fromMemberId) : ''}
                  onChange={(val) => setFromMemberId(val ? String(val) : '')}
                  placeholder="-- शेअर्स देणारा सभासद निवडा --"
                />
              </div>

              {fromShareAccount ? (
                <div className="bg-white border border-slate-200 p-2 rounded-sm space-y-1.5 shadow-2xs">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-600 font-semibold">शेअर खाते क्र.:</span>
                    <span className="font-bold text-primary font-mono">{fromShareAccount.accountNo}</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-sm border border-gray-200">
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold">उपलब्ध शेअर्स</p>
                      <p className="text-xs font-black text-gray-900 font-mono">{fromShareAccount.totalShareCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 font-bold">उपलब्ध मूल्य (₹)</p>
                      <p className="text-xs font-black text-primary font-mono">₹{fromShareAccount.totalShareAmount.toFixed(2)}</p>
                    </div>
                  </div>

                  {sharesCount > 0 && (
                    <div className="text-[10px] text-gray-600 flex justify-between pt-1 border-t border-gray-100 font-medium">
                      <span>हस्तांतरणानंतर उर्वरित:</span>
                      <span className="font-bold text-rose-700 font-mono">
                        {fromShareAccount.totalShareCount - sharesCount} शेअर्स (₹{((fromShareAccount.totalShareCount - sharesCount) * 100).toFixed(2)})
                      </span>
                    </div>
                  )}
                </div>
              ) : fromMemberId ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-sm text-center text-amber-800 font-semibold text-xs">
                  ⚠️ या सभासदाचे शेअर खाते किंवा शेअर्स उपलब्ध नाहीत.
                </div>
              ) : (
                <div className="p-3 bg-white border border-dashed border-gray-300 rounded-sm text-center text-gray-400 font-medium text-xs">
                  कृपया वरील ड्रॉपडाऊनमधून शेअर्स देणारा सभासद निवडा.
                </div>
              )}
            </div>

            {/* Card B: Transferee (घेणारा सभासद) */}
            <div className="bg-slate-50 p-3 rounded-sm border border-emerald-200 space-y-2">
              <div className="flex justify-between items-center border-b border-emerald-200/60 pb-1">
                <h3 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                  <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold">B</span>
                  <span>घेणारा सभासद (Transferee - Member B) <span className="text-rose-600">*</span></span>
                </h3>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">(शेअर्स जमा होणार)</span>
              </div>

              <div>
                <label className={labelClass}>सभासद शोधा व निवडा:</label>
                <MemberSearchSelect
                  members={members.filter(m => m.memberID.toString() !== fromMemberId)}
                  value={toMemberId ? Number(toMemberId) : ''}
                  onChange={(val) => setToMemberId(val ? String(val) : '')}
                  placeholder="-- शेअर्स घेणारा सभासद निवडा --"
                />
              </div>

              {toMemberId ? (
                <div className="bg-white border border-slate-200 p-2 rounded-sm space-y-1.5 shadow-2xs">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-600 font-semibold">शेअर खाते क्र.:</span>
                    <span className="font-bold text-primary font-mono">
                      {toShareAccount ? toShareAccount.accountNo : 'नवीन खाते तयार होईल (Auto-create)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-sm border border-gray-200">
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold">चालू शेअर्स</p>
                      <p className="text-xs font-black text-gray-900 font-mono">{toShareAccount?.totalShareCount || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 font-bold">चालू मूल्य (₹)</p>
                      <p className="text-xs font-black text-primary font-mono">₹{(toShareAccount?.totalShareAmount || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {sharesCount > 0 && (
                    <div className="text-[10px] text-emerald-800 flex justify-between pt-1 border-t border-gray-100 font-semibold">
                      <span>हस्तांतरणानंतर नवीन एकूण:</span>
                      <span className="font-bold text-emerald-950 font-mono">
                        {(toShareAccount?.totalShareCount || 0) + sharesCount} शेअर्स (₹{(((toShareAccount?.totalShareCount || 0) + sharesCount) * 100).toFixed(2)})
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-white border border-dashed border-gray-300 rounded-sm text-center text-gray-400 font-medium text-xs">
                  कृपया वरील ड्रॉपडाऊनमधून शेअर्स घेणारा सभासद निवडा.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* SECTION 2: Transfer Parameters, Resolution & Fee Card */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. हस्तांतरण तपशील, ठराव व फी (Transfer Details & Resolution)</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Number of Shares */}
            <div>
              <label className={labelClass}>
                हस्तांतरित शेअर्स संख्या (Qty) <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  min="1"
                  max={fromShareAccount?.totalShareCount || 99999}
                  value={numberOfShares}
                  onChange={(e) => setNumberOfShares(e.target.value)}
                  placeholder="उदा. 10"
                  className={`${inputClass} font-bold text-gray-900`}
                  required
                />
                <span className="bg-slate-100 px-2 py-1 rounded-sm border border-slate-300 font-bold text-[10px] text-gray-600 whitespace-nowrap h-[28px] flex items-center">
                  x ₹100
                </span>
              </div>
            </div>

            {/* Total Face Value Amount */}
            <div>
              <label className={labelClass}>
                एकूण हस्तांतरित रक्कम (Amount ₹)
              </label>
              <div className="px-2.5 py-1 bg-blue-50/70 border border-blue-200 rounded-sm font-mono font-black text-primary text-xs flex items-center h-[28px] shadow-2xs">
                ₹{transferAmount.toFixed(2)}
              </div>
            </div>

            {/* Board Resolution No */}
            <div>
              <label className={labelClass}>
                संचालक मंडळ ठराव क्र. (Resolution No)
              </label>
              <input
                type="text"
                value={resolutionNo}
                onChange={(e) => setResolutionNo(e.target.value)}
                placeholder="उदा. RES-2026/45"
                className={inputClass}
              />
            </div>

            {/* Resolution Date */}
            <div>
              <label className={labelClass}>
                ठराव दिनांक (Resolution Date)
              </label>
              <input
                type="date"
                value={resolutionDate}
                onChange={(e) => setResolutionDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Transfer Fee & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-gray-100">
            <div>
              <label className={labelClass}>
                हस्तांतरण फी रक्कम (Transfer Fee ₹)
              </label>
              <input
                type="number"
                min="0"
                value={transferFee}
                onChange={(e) => setTransferFee(e.target.value)}
                placeholder="0"
                className={`${inputClass} font-bold`}
              />
            </div>

            <div>
              <label className={labelClass}>
                फी पेमेंट प्रकार (Fee Payment Mode)
              </label>
              <select
                value={feePaymentMode}
                onChange={(e) => setFeePaymentMode(e.target.value as any)}
                className={inputClass}
              >
                <option value="None">काही नाही (No Fee / Waived)</option>
                <option value="Cash">💵 रोख (Cash)</option>
                <option value="Saving">🔄 बचत खात्यातून कपात (Saving Transfer)</option>
              </select>
            </div>

            {feePaymentMode === 'Saving' && (
              <div>
                <label className={labelClass}>
                  फी कपातीसाठी बचत खाते (Saving A/c)
                </label>
                {fromSavingAccounts.length > 0 ? (
                  <select
                    value={savingAccountId}
                    onChange={(e) => setSavingAccountId(e.target.value)}
                    className={`${inputClass} font-bold text-primary`}
                  >
                    {fromSavingAccounts.map(acc => {
                      const accId = acc.savingAccountID !== undefined ? acc.savingAccountID : acc.savingAccountId;
                      const bal = typeof acc.currentBalance === 'number' ? acc.currentBalance : 0;
                      return (
                        <option key={accId} value={accId}>
                          {acc.accountNo} (शिल्लक: ₹{bal.toFixed(2)})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1.5 rounded border border-rose-200">
                    देणाऱ्या सभासदाचे सक्रिय बचत खाते नाही!
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>तपशील (Narration)</label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          {/* Form Action Footer */}
          <div className="pt-2 flex justify-between items-center gap-2 border-t border-gray-200 flex-wrap">
            <div className="text-[10px] text-gray-500 font-medium">
              * हस्तांतरण पूर्ण झाल्यावर जर्नल व्हाउचर (JV) आणि नवीन शेअर प्रमाणपत्र आपोआप तयार होईल.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>नवीन फॉर्म (Reset)</span>
              </button>

              <button
                type="submit"
                disabled={saving || !fromMemberId || !toMemberId || sharesCount <= 0 || (fromShareAccount ? sharesCount > fromShareAccount.totalShareCount : true)}
                className="px-6 py-2 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{saving ? 'प्रक्रिया सुरू आहे...' : 'शेअर्स हस्तांतरित करा व व्हाउचर बनवा'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* 📜 4. RECENT TRANSFER HISTORY TABLE */}
      <div className="bg-white rounded-sm shadow-xs overflow-hidden border border-gray-200 border-t-2 border-primary mt-3">
        <div className="bg-slate-50 px-3.5 py-2 border-b border-gray-200 font-bold text-gray-900 flex justify-between items-center text-xs">
          <span className="flex items-center gap-1.5 text-primary">
            <FileText className="w-4 h-4 text-primary" />
            <span>अलीकडील शेअर हस्तांतरण इतिहास (Recent Share Transfer History)</span>
          </span>
          <span className="text-[10px] text-gray-500 font-medium">
            (एकूण नोंदी: {history.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-[11px]">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="px-2.5 py-1.5 text-center border-r border-gray-200 w-10">क्र.</th>
                <th className="px-2.5 py-1.5 text-left border-r border-gray-200 w-24">दिनांक</th>
                <th className="px-2.5 py-1.5 text-left border-r border-gray-200 w-28">प्रकार</th>
                <th className="px-2.5 py-1.5 text-left border-r border-gray-200">सभासद नाव व क्र.</th>
                <th className="px-2.5 py-1.5 text-right border-r border-gray-200 w-24">शेअर्स संख्या</th>
                <th className="px-2.5 py-1.5 text-right border-r border-gray-200 w-24">रक्कम (₹)</th>
                <th className="px-2.5 py-1.5 text-left border-r border-gray-200 w-24">व्हाउचर क्र.</th>
                <th className="px-2.5 py-1.5 text-left border-r border-gray-200">तपशील (Narration)</th>
                <th className="px-2.5 py-1.5 text-center w-24">कृती (Action)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400 font-medium italic">
                    कोणतेही शेअर हस्तांतरण व्यवहार उपलब्ध नाहीत.
                  </td>
                </tr>
              ) : (
                history.map((item, idx) => (
                  <tr key={item.transactionId} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-2.5 py-1.5 border-r border-gray-200 text-center text-gray-500 font-mono">{idx + 1}</td>
                    <td className="px-2.5 py-1.5 border-r border-gray-200 font-mono text-gray-800">
                      {new Date(item.transactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-gray-200">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.transactionType === 'Transfer-Out'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {item.transactionType === 'Transfer-Out' ? '📤 हस्तांतरित (Out)' : '📥 प्राप्त (In)'}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-gray-200 font-bold text-gray-900">
                      {item.memberCode ? <span className="font-mono text-primary mr-1">[{item.memberCode}]</span> : ''}
                      <span>{item.memberName}</span>
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-gray-900">
                      {item.numberOfShares}
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-black text-primary">
                      ₹{item.amount.toFixed(2)}
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-gray-200 font-mono text-blue-700 font-semibold">
                      {item.voucherNo || '-'}
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-gray-200 text-gray-600 text-[11px] truncate max-w-xs" title={item.narration}>
                      {item.narration}
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleCancelTransfer(item)}
                        disabled={loading}
                        className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-sm font-semibold transition text-[10px] cursor-pointer"
                        title="हस्तांतरण रद्द करा (Reverse Transfer)"
                      >
                        रद्द करा
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 👥 5. VIEW LIST POPUP MODAL */}
      {isListModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-sm shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col border border-gray-300 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 rounded-t-sm flex justify-between items-center border-b border-primary/40">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-300" />
                <h2 className="text-xs sm:text-sm font-bold tracking-wide">
                  सभासद शेअर हस्तांतरण यादी (Member Share Transfer List)
                </h2>
                <span className="bg-white/20 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ml-1">
                  एकूण: {history.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm cursor-pointer transition"
                title="बंद करा (Close)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search & Filter Bar */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="सभासद नाव, कोड किंवा व्हाउचर क्र. शोधा..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-[11px] border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-[28px]"
                />
                {modalSearchTerm && (
                  <button
                    onClick={() => setModalSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                <span>दाखवलेल्या नोंदी: <strong className="text-slate-900">{filteredHistory.length}</strong> / {history.length}</span>
              </div>
            </div>

            {/* Modal Table Body */}
            <div className="overflow-y-auto overflow-x-auto flex-1 p-2">
              <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-300 shadow-2xs">
                  <tr>
                    <th className="px-2.5 py-1.5 text-center border-r border-gray-200 w-10">क्र.</th>
                    <th className="px-2.5 py-1.5 text-left border-r border-gray-200 w-24">दिनांक</th>
                    <th className="px-2.5 py-1.5 text-left border-r border-gray-200 w-28">प्रकार</th>
                    <th className="px-2.5 py-1.5 text-left border-r border-gray-200">सभासद नाव व क्र.</th>
                    <th className="px-2.5 py-1.5 text-right border-r border-gray-200 w-24">शेअर्स संख्या</th>
                    <th className="px-2.5 py-1.5 text-right border-r border-gray-200 w-24">रक्कम (₹)</th>
                    <th className="px-2.5 py-1.5 text-left border-r border-gray-200 w-24">व्हाउचर क्र.</th>
                    <th className="px-2.5 py-1.5 text-left border-r border-gray-200">ठराव / तपशील</th>
                    <th className="px-2.5 py-1.5 text-center w-28">कृती (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400 font-medium italic">
                        {modalSearchTerm ? 'शोधलेल्या निकषांनुसार कोणतीही नोंद आढळली नाही.' : 'कोणतेही शेअर हस्तांतरण व्यवहार उपलब्ध नाहीत.'}
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item, idx) => (
                      <tr key={item.transactionId} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-center text-gray-500 font-mono">{idx + 1}</td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 font-mono text-gray-800">
                          {new Date(item.transactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-block ${
                            item.transactionType === 'Transfer-Out'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {item.transactionType === 'Transfer-Out' ? '📤 हस्तांतरित (Out)' : '📥 प्राप्त (In)'}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 font-bold text-gray-900">
                          {item.memberCode ? <span className="font-mono text-primary mr-1">[{item.memberCode}]</span> : ''}
                          <span>{item.memberName}</span>
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-gray-900">
                          {item.numberOfShares}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-black text-primary">
                          ₹{item.amount.toFixed(2)}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 font-mono text-blue-700 font-semibold">
                          {item.voucherNo || '-'}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-gray-600 text-[11px] max-w-xs truncate" title={item.narration}>
                          {item.narration}
                        </td>
                        <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleCancelTransfer(item)}
                            disabled={loading}
                            className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-sm font-semibold transition text-[10px] flex items-center gap-1 mx-auto cursor-pointer"
                            title="हस्तांतरण रद्द / डिलीट करा"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>रद्द करा</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs">
              <div className="text-slate-700 font-semibold">
                एकूण रक्कम: <span className="text-primary font-black font-mono">₹{filteredHistory.reduce((sum, h) => sum + h.amount, 0).toFixed(2)}</span>
                {' | '}
                एकूण शेअर्स: <span className="text-gray-950 font-bold font-mono">{filteredHistory.reduce((sum, h) => sum + h.numberOfShares, 0)}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="px-4 py-1 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-sm text-xs cursor-pointer transition shadow-2xs"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
