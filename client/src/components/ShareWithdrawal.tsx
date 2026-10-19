import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';

interface Member extends MemberOption {}

interface ShareAccount {
  shareAccountId: number;
  accountNo: string;
  totalShareAmount: number;
  totalShareCount: number;
  certificates: any[];
  transactions: any[];
}

export interface ShareWithdrawalProps {
  onNavigate?: (tab: string, params?: any) => void;
  voucherId?: string | number | null;
  isPassingMode?: boolean;
}

const ShareWithdrawal: React.FC<ShareWithdrawalProps> = ({ onNavigate, voucherId, isPassingMode }) => {
  const queryParams = new URLSearchParams(window.location.search);
  const effectiveVoucherId = voucherId || queryParams.get('voucherId');
  const isPassing = isPassingMode || queryParams.get('passingMode') === 'true';

  const [passingVoucherData, setPassingVoucherData] = useState<any | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [shareAccount, setShareAccount] = useState<ShareAccount | null>(null);
  
  const { user } = useAuth();
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    numberOfShares: '',
    narration: 'Share Withdrawal'
  });
  const [withdrawalDate, setWithdrawalDate] = useState<string>(activeBusinessDate);

  useEffect(() => {
    if (user?.businessDate) {
      setWithdrawalDate(user.businessDate.split('T')[0]);
    }
  }, [user?.businessDate]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Transfer' | 'Bank'>('Cash');
  const [memberSavingAccounts, setMemberSavingAccounts] = useState<any[]>([]);
  const [selectedSavingAccountId, setSelectedSavingAccountId] = useState<number | ''>('');
  const [chequeNo, setChequeNo] = useState('');

  useEffect(() => {
    if (isPassing && effectiveVoucherId) {
      loadPassingWithdrawal(effectiveVoucherId);
    }
  }, [isPassing, effectiveVoucherId]);

  const loadPassingWithdrawal = async (vId: string | number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ShareAccounts/by-voucher/${vId}`);
      if (res.ok) {
        const data = await res.json();
        setPassingVoucherData(data);
        if (data.member?.memberID) {
          setSelectedMemberId(data.member.memberID.toString());
          loadShareAccount(data.member.memberID.toString());
        }
        if (data.numberOfShares) {
          setFormData({
            numberOfShares: data.numberOfShares.toString(),
            narration: data.voucher?.narration || 'Share Withdrawal'
          });
        }
        if (data.voucher?.voucherDate) {
          setWithdrawalDate(data.voucher.voucherDate.split('T')[0]);
        }
        if (data.paymentMode) {
          if (data.paymentMode === 'Transfer') setPaymentMode('Transfer');
          else if (data.paymentMode === 'Bank') setPaymentMode('Bank');
          else setPaymentMode('Cash');
        }
      }
    } catch (err) {
      console.error('Failed to load passing voucher', err);
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
        alert('शेअर परतावा व्हाउचर यशस्वीरित्या पास (मंजूर) करण्यात आले!');
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
        alert('शेअर परतावा व्हाउचर नामंजूर / रद्द करण्यात आले!');
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

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      // Check URL params and sessionStorage bridge
      const params = new URLSearchParams(window.location.search);
      let cifStr = params.get('cifNo') || params.get('cif');
      let customerIdStr = params.get('customerId') || params.get('customerID');
      let memberIdStr = params.get('memberId') || params.get('memberID');

      if (!cifStr && !customerIdStr && !memberIdStr) {
        try {
          const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
          if (rawBridge) {
            sessionStorage.removeItem('cbs_active_customer_transfer');
            const bridgeData = JSON.parse(rawBridge);
            if (bridgeData) {
              cifStr = bridgeData.cifNo || bridgeData.cif;
              customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
              memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : null;
            }
          }
        } catch (e) {
          console.error('Failed to read sessionStorage transfer:', e);
        }
      }

      const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
      const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
      const fastTargetId = mId > 0 ? mId : cId;

      // ⚡ FAST-TRACK: Targeted member resolution (~20-30ms)
      if (fastTargetId > 0) {
        const targetStr = fastTargetId.toString();
        setSelectedMemberId(targetStr);
        loadShareAccount(targetStr);
      }

      const res = await fetch('/api/Members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data);

        if (!fastTargetId) {
          const getMemberCustId = (m: any) => Number(m.customerID ?? m.customerId ?? m.CustomerID ?? 0);
          const getMemberId = (m: any) => Number(m.memberID ?? m.memberId ?? m.MemberID ?? 0);
          const getMemberCif = (m: any) => String(m.cifNo ?? m.CIFNo ?? m.cif ?? '').trim().toUpperCase();
          const cleanCif = cifStr ? cifStr.trim().toUpperCase() : '';

          let matched: any = undefined;
          if (cleanCif) {
            matched = data.find((m: any) => getMemberCif(m) === cleanCif);
          }

          if (matched) {
            const targetMemId = getMemberId(matched).toString();
            setSelectedMemberId(targetMemId);
            loadShareAccount(targetMemId);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch members', error);
    }
  };

  const fetchMemberSavingAccounts = async (memberId: string) => {
    try {
      const targetMember = members.find((m: any) => m.memberID?.toString() === memberId.toString());
      const targetCustId = targetMember?.customerID;
      const url = targetCustId 
        ? `/api/SavingAccounts?customerId=${targetCustId}&memberId=${memberId}`
        : `/api/SavingAccounts?memberId=${memberId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const memberAccs = data.filter((a: any) => {
          const mId = a.memberID !== undefined ? a.memberID : a.memberId;
          const cId = a.customerID !== undefined ? a.customerID : a.customerId;
          const resMemId = a.resolvedMemberID;
          const stat = (a.status || '').toLowerCase();
          const isOwner = (targetCustId && cId === targetCustId) || (mId === parseInt(memberId)) || (resMemId && resMemId === parseInt(memberId));
          return isOwner && (stat === 'active' || stat === 'चालू' || stat === '');
        });
        setMemberSavingAccounts(memberAccs);
        if (memberAccs.length > 0) {
          const firstId = memberAccs[0].savingAccountID !== undefined ? memberAccs[0].savingAccountID : memberAccs[0].savingAccountId;
          setSelectedSavingAccountId(firstId ? firstId : '');
        } else {
          setSelectedSavingAccountId('');
        }
      }
    } catch (err) {
      console.error('Failed to fetch saving accounts', err);
    }
  };

  const loadShareAccount = async (memberId: string) => {
    setLoading(true);
    setShareAccount(null);
    setMessage('');
    fetchMemberSavingAccounts(memberId);
    try {
      const res = await fetch(`/api/ShareAccounts/Member/${memberId}`);
      if (res.ok) {
        const data = await res.json();
        setShareAccount(data);
      } else if (res.status === 404) {
        setShareAccount(null);
      } else {
        setMessage('Failed to load share account.');
      }
    } catch (err) {
      setMessage('Network error.');
    }
    setLoading(false);
  };

  const handleMemberChange = (e: React.ChangeEvent<HTMLSelectElement> | { target: { name?: string, value: string | number } }) => {
    const val = String(e.target.value ?? '');
    setSelectedMemberId(val);
    if (val !== '') {
      loadShareAccount(val);
    } else {
      setShareAccount(null);
      setMemberSavingAccounts([]);
      setSelectedSavingAccountId('');
      setMessage('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) {
      setMessage('⚠️ कृपया वरील ड्रॉपडाऊनमधून प्रथम सभासद निवडा. (Please select a member first).');
      return;
    }
    
    const qty = parseInt(formData.numberOfShares);
    if (!qty || qty <= 0) {
      setMessage('⚠️ किमान १ शेअर काढणे आवश्यक आहे.');
      return;
    }

    if (paymentMode === 'Transfer' && !selectedSavingAccountId) {
      setMessage('⚠️ कृपया परतावा जमा करण्यासाठी सभासदाचे बचत खाते निवडा. (Please select a saving account).');
      return;
    }

    if (shareAccount && qty > shareAccount.totalShareCount) {
        setMessage(`तुम्ही जास्तीत जास्त ${shareAccount.totalShareCount} शेअर्स काढू शकता.`);
        return;
    }

    const amount = qty * 100;
    if (!window.confirm(`तुम्ही नक्की ${qty} शेअर्स (₹${amount}) ${paymentMode} द्वारे काढून घेऊ इच्छिता? (Are you sure?)`)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/ShareAccounts/Withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: parseInt(selectedMemberId),
          memberId: parseInt(selectedMemberId),
          numberOfShares: qty,
          withdrawalDate: withdrawalDate,
          narration: formData.narration,
          paymentMode: paymentMode,
          savingAccountId: paymentMode === 'Transfer' ? selectedSavingAccountId : null,
          chequeNo: paymentMode === 'Bank' ? chequeNo : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`शेअर्स यशस्वीरित्या काढण्यात आले! (Voucher: ${data.voucherNo})`);
        setFormData({ numberOfShares: '', narration: 'Share Withdrawal' });
        setChequeNo('');
        loadShareAccount(selectedMemberId);
      } else {
        setMessage(data.message || data || 'Withdrawal failed.');
      }
    } catch (err) {
      setMessage('Error during withdrawal.');
    }
    setLoading(false);
  };

  const memberOptions = members.map(m => ({ 
      value: m.memberID.toString(), 
      label: `${m.cifNo ? m.cifNo + ' - ' : ''}${m.firstName} ${m.lastName}`
  }));

  return (
    <div className="p-2 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans relative overflow-y-auto">
      {/* Page Header */}
      <div className="flex justify-between items-center border-b border-gray-300 pb-1.5 mb-2">
        <div className="text-xs font-bold text-primary flex items-center gap-1.5">
          <span>📤</span> शेअर परतावा / काढून घेणे (Share Withdrawal & Refund)
        </div>
        <div className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-sm border border-blue-200">
          शेअर मॉड्युल (Share Capital Module)
        </div>
      </div>

      {/* ⚠️ Amber Checker Alert Banner */}
      {isPassing && (
        <div className="mb-2 p-2.5 bg-amber-500/10 border-2 border-amber-500/80 rounded flex items-center justify-between text-amber-900 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-amber-950">
                व्हाउचर तपासणी व मंजुरी मोड (Voucher Passing / Checker Mode)
              </div>
              <div className="text-[10px] text-amber-800">
                व्हाउचर क्र: <span className="font-mono font-bold text-amber-950">{passingVoucherData?.voucher?.voucherNo || effectiveVoucherId}</span> | 
                रक्कम: <span className="font-mono font-bold text-amber-950">₹{passingVoucherData?.voucher?.totalAmount ?? ((parseInt(formData.numberOfShares) || 0) * 100)}</span> | 
                तारीख: <span className="font-mono font-bold text-amber-950">{passingVoucherData?.voucher?.voucherDate ? new Date(passingVoucherData.voucher.voucherDate).toLocaleDateString('en-GB') : '-'}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900 border border-amber-300">
              कडक वाचन मोड (Read-Only Lockdown)
            </span>
          </div>
        </div>
      )}

      {message && (
        <div className={`mb-2 p-2 rounded-sm font-bold text-xs border flex items-center gap-2 ${message.includes('failed') || message.includes('Error') || message.includes('आवश्यक') || message.includes('शकता') || message.includes('⚠️') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
          <span>{message.includes('failed') || message.includes('Error') || message.includes('आवश्यक') || message.includes('शकता') || message.includes('⚠️') ? '⚠️' : '✅'}</span>
          <span>{message}</span>
        </div>
      )}

      {/* Member Selector Card */}
      <div className="bg-white p-3 rounded-sm shadow-xs mb-3 border border-gray-200">
        <label className="block text-xs font-bold text-gray-700 mb-1">सभासद निवडा (Select Member) *</label>
        <MemberSearchSelect 
          members={members} 
          value={selectedMemberId ? Number(selectedMemberId) : ''} 
          onChange={(val) => handleMemberChange({ target: { value: val ? String(val) : '' } })} 
          placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा --"
          isDisabled={isPassing}
        />
      </div>

      {/* Main Content Area - Always Visible */}
      <div className="flex-1 flex flex-col min-h-[250px]">
        {loading ? (
          <div className="bg-white p-4 rounded-sm shadow-xs border border-gray-200 text-center text-gray-500 font-bold text-xs">
            लोड करत आहे (Loading)...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
            {/* Member's Current Share Info & Recent Transactions */}
            <div className="bg-white p-3 rounded-sm shadow-xs border border-gray-200 flex flex-col justify-between">
              <h3 className="text-xs font-bold text-primary border-b border-gray-200 pb-1 mb-2 flex items-center gap-1.5">
                <span>📊</span> चालू शेअर माहिती (Current Share Holding)
              </h3>
              
              {shareAccount ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-gray-700 mb-1 font-bold text-xs">
                      खाते क्र. (Account No): <span className="text-primary font-extrabold text-sm">{shareAccount.accountNo}</span>
                    </p>
                    <div className="flex justify-between items-center bg-blue-50/80 border border-blue-200 p-3 rounded-sm mt-2 shadow-xs">
                      <div>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wide">उपलब्ध शेअर्स (Available Shares)</p>
                        <p className="text-xl font-black text-primary">{shareAccount.totalShareCount}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wide">उपलब्ध रक्कम (Available Value)</p>
                        <p className="text-xl font-black text-primary">₹{shareAccount.totalShareAmount.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <h4 className="font-bold mb-1.5 text-xs text-gray-800 border-b border-gray-100 pb-1 flex items-center gap-1">
                        <span>📜</span> अलीकडील व्यवहार (Recent Transactions)
                      </h4>
                      <ul className="space-y-1">
                        {shareAccount.transactions && shareAccount.transactions.length > 0 ? (
                          shareAccount.transactions.slice(-3).reverse().map((t: any, i: number) => (
                            <li key={i} className="text-xs border border-gray-200 bg-gray-50/60 p-1.5 rounded-sm flex justify-between items-center font-medium">
                              <span>{new Date(t.transactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {t.transactionType}</span>
                              <span className={`font-bold ${t.transactionType === 'Withdrawal' ? 'text-red-600' : 'text-emerald-600'}`}>
                                {t.transactionType === 'Withdrawal' ? '-' : '+'}₹{t.amount.toFixed(2)} ({t.numberOfShares} sh)
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-gray-400 font-bold italic py-1 text-center">कोणतेही व्यवहार उपलब्ध नाहीत.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : selectedMemberId ? (
                <div className="text-center py-8 flex-1 flex flex-col justify-center items-center bg-amber-50/40 rounded border border-dashed border-amber-200 p-3">
                  <p className="text-amber-900 font-bold text-xs">या सभासदाचे शेअर खाते नाही (No Share Account).</p>
                  <p className="text-[10px] text-amber-700 mt-1">त्यांच्या नावावर कोणतेही शेअर्स उपलब्ध नाहीत.</p>
                </div>
              ) : (
                <div className="text-center py-8 flex-1 flex flex-col justify-center items-center bg-blue-50/40 rounded border border-dashed border-blue-200 p-3">
                  <span className="text-2xl mb-1">👈</span>
                  <p className="text-blue-900 font-bold text-xs">कृपया वरील ड्रॉपडाऊनमधून सभासद निवडा.</p>
                  <p className="text-[10px] text-blue-600 mt-0.5">(Select a member from above to view share holding)</p>
                </div>
              )}
            </div>

            {/* Withdrawal Form */}
            <div className="bg-white p-3 rounded-sm shadow-xs border border-gray-200 flex flex-col justify-between">
              <h3 className="text-xs font-bold text-red-700 border-b border-gray-200 pb-1 mb-2 flex items-center gap-1.5">
                <span>📤</span> शेअर्स काढून घेणे / परतावा (Withdraw Shares)
              </h3>
              
              <form onSubmit={handleWithdraw} className="space-y-3 flex-1 flex flex-col justify-between">
                <fieldset disabled={isPassing} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">काढायच्या शेअर्सची संख्या (Quantity) *</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="number" 
                        name="numberOfShares"
                        min="1"
                        max={shareAccount?.totalShareCount || 9999}
                        placeholder="उदा. 5"
                        className="w-24 border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors text-xs bg-white font-bold text-gray-800 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        value={formData.numberOfShares}
                        onChange={handleChange}
                        required
                      />
                      <div className="bg-gray-100 px-2 py-1 rounded-sm border border-gray-200 text-gray-700 font-bold text-[10px]">
                        x ₹100 / share
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">परत मिळणारी रक्कम (Amount to Refund)</label>
                    <div className="text-sm font-black text-red-800 bg-red-50/90 px-2 py-1 rounded-sm border border-red-200 h-[30px] flex items-center">
                      ₹{((parseInt(formData.numberOfShares) || 0) * 100).toFixed(2)}
                    </div>
                  </div>

                  {/* Payment Mode Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">पेमेंट प्रकार (Payment Mode) *</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('Cash')}
                        className={`flex-1 py-1 px-2 rounded text-xs font-bold border cursor-pointer transition-all ${paymentMode === 'Cash' ? 'bg-primary text-white border-primary shadow-xs' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                      >
                        💵 रोख (Cash)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode('Transfer')}
                        className={`flex-1 py-1 px-2 rounded text-xs font-bold border cursor-pointer transition-all ${paymentMode === 'Transfer' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                      >
                        🔄 बचत खात्यात (Transfer)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode('Bank')}
                        className={`flex-1 py-1 px-2 rounded text-xs font-bold border cursor-pointer transition-all ${paymentMode === 'Bank' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                      >
                        🏦 बँक / चेक (Bank)
                      </button>
                    </div>
                  </div>

                  {/* Cash Ledger Reflection Banner */}
                  {paymentMode === 'Cash' && (
                    <CashLedgerReflectBadge transactionType="Withdrawal" />
                  )}

                  {/* Conditional Saving Account Dropdown for Transfer */}
                  {paymentMode === 'Transfer' && (
                    <div className="p-2 bg-indigo-50/70 border border-indigo-200 rounded-sm space-y-1">
                      <label className="block text-[10px] font-bold text-indigo-900">परतावा जमा करण्याचे बचत खाते (Saving A/c to Credit) *</label>
                      {memberSavingAccounts.length > 0 ? (
                        <select
                          value={selectedSavingAccountId}
                          onChange={(e) => setSelectedSavingAccountId(e.target.value === '' ? '' : parseInt(e.target.value))}
                          className="w-full border border-indigo-300 px-2 py-1 rounded-sm text-xs bg-white font-bold text-indigo-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          {memberSavingAccounts.map((acc: any) => (
                            <option key={acc.savingAccountID} value={acc.savingAccountID}>
                              {acc.accountNo} | चालू शिल्लक: ₹{acc.currentBalance.toFixed(2)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs text-red-600 font-bold bg-white p-1.5 rounded border border-red-200">
                          ⚠️ या सभासदाचे कोणतेही सक्रिय बचत खाते उपलब्ध नाही!
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conditional Cheque / Ref No Input for Bank */}
                  {paymentMode === 'Bank' && (
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 mb-0.5">चेक / संदर्भ क्र. (Cheque / Ref No)</label>
                      <input 
                        type="text" 
                        className="w-full border border-amber-300 px-2 py-1 rounded-sm text-xs bg-white font-bold disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="उदा. CHQ123456 / UTR987654"
                        value={chequeNo}
                        onChange={(e) => setChequeNo(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-0.5">परतावा तारीख (Withdrawal Date) *</label>
                      <input 
                        type="date" 
                        className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-xs bg-white font-mono"
                        value={withdrawalDate}
                        onChange={(e) => setWithdrawalDate(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-0.5">तपशील (Narration)</label>
                      <input 
                        type="text" 
                        name="narration"
                        className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-xs bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                        value={formData.narration}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                </fieldset>

                <div className="border-t border-gray-200 pt-3">
                  {!isPassing ? (
                    <button 
                      type="submit"
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-sm font-bold shadow-xs transition-colors text-xs disabled:opacity-50 uppercase tracking-wide cursor-pointer flex items-center justify-center gap-1.5"
                      disabled={loading || !formData.numberOfShares || parseInt(formData.numberOfShares) <= 0 || (shareAccount ? parseInt(formData.numberOfShares) > shareAccount.totalShareCount : false)}
                    >
                      <span>📤</span>
                      <span>{loading ? 'Processing...' : 'शेअर्स काढा आणि पेमेंट व्हाउचर बनवा (Withdraw & Create Voucher)'}</span>
                    </button>
                  ) : (
                    <div className="p-3 bg-slate-900 rounded-lg shadow-xl border border-amber-500/30 flex items-center justify-between z-40">
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
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

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
                placeholder="उदा. चुकीचा शेअर परतावा / शिल्लक शेअर्स त्रुटी..."
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

export default ShareWithdrawal;
