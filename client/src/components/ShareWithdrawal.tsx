import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';

interface Member extends MemberOption {}

interface ShareAccount {
  shareAccountId: number;
  accountNo: string;
  totalShareAmount: number;
  totalShareCount: number;
  certificates: any[];
  transactions: any[];
}

const ShareWithdrawal: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [shareAccount, setShareAccount] = useState<ShareAccount | null>(null);
  
  const [formData, setFormData] = useState({
    numberOfShares: '',
    narration: 'Share Withdrawal'
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Transfer' | 'Bank'>('Cash');
  const [memberSavingAccounts, setMemberSavingAccounts] = useState<any[]>([]);
  const [selectedSavingAccountId, setSelectedSavingAccountId] = useState<number | ''>('');
  const [chequeNo, setChequeNo] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/Members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
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
          memberId: parseInt(selectedMemberId),
          numberOfShares: qty,
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
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">काढायच्या शेअर्सची संख्या (Quantity) *</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="number" 
                        name="numberOfShares"
                        min="1"
                        max={shareAccount?.totalShareCount || 9999}
                        placeholder="उदा. 5"
                        className="w-24 border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors text-xs bg-white font-bold text-gray-800"
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
                          className="w-full border border-indigo-300 px-2 py-1 rounded-sm text-xs bg-white font-bold text-indigo-950"
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
                        className="w-full border border-amber-300 px-2 py-1 rounded-sm text-xs bg-white font-bold"
                        placeholder="उदा. CHQ123456 / UTR987654"
                        value={chequeNo}
                        onChange={(e) => setChequeNo(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">तपशील (Narration)</label>
                    <input 
                      type="text" 
                      name="narration"
                      className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-xs bg-white"
                      value={formData.narration}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <button 
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-sm font-bold shadow-xs transition-colors text-xs disabled:opacity-50 uppercase tracking-wide cursor-pointer flex items-center justify-center gap-1.5"
                    disabled={loading || !formData.numberOfShares || parseInt(formData.numberOfShares) <= 0 || (shareAccount ? parseInt(formData.numberOfShares) > shareAccount.totalShareCount : false)}
                  >
                    <span>📤</span>
                    <span>{loading ? 'Processing...' : 'शेअर्स काढा आणि पेमेंट व्हाउचर बनवा (Withdraw & Create Voucher)'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareWithdrawal;
