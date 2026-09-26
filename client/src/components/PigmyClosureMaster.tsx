import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  ExclamationTriangleIcon, 
  ShieldExclamationIcon, 
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  ClockIcon,
  BanknotesIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface ActiveLoan {
  loanAccountId: number;
  loanAccountNo: string;
  loanType: string;
  principalBalance: number;
  overdueInterest: number;
  totalOutstanding: number;
}

interface ClosurePreview {
  pigmyAccountId: number;
  accountNo: string;
  customerName?: string;
  memberName?: string;
  cifNo?: string;
  openingDate: string;
  maturityDate: string;
  cycleStartDate: string;
  currentCycleNumber: number;
  tenureDaysInCycle: number;
  tenureMonthsInCycle: number;
  totalDepositedAmount: number;
  totalWithdrawnAmount: number;
  isPremature: boolean;
  prematurePenaltyRate: number;
  prematurePenaltyAmount: number;
  prematureInterestRate: number;
  prematureInterestAmount: number;
  netPayable: number;
  policyNote: string;
  hasActiveLoanLien: boolean;
  totalLoanLiability: number;
  activeLoans: ActiveLoan[];
}

interface WithdrawalPreview {
  pigmyAccountId: number;
  accountNo: string;
  memberName: string;
  cifNo: string;
  currentBalance: number;
  requestedAmount: number;
  currentCycleNumber: number;
  cycleStartDate: string;
  elapsedDays: number;
  elapsedMonths: number;
  appliedPenaltyRate: number;
  appliedPenaltyAmount: number;
  appliedInterestRate: number;
  appliedInterestAmount: number;
  netPaidAmount: number;
  remainingBalance: number;
  policyNote: string;
  nextCycleStartDate: string;
  fixedMaturityDate: string;
  hasActiveLoanLien: boolean;
  totalLoanLiability: number;
  activeLoans: ActiveLoan[];
}

interface WithdrawalHistoryItem {
  withdrawalID: number;
  withdrawalDate: string;
  cycleNumber: number;
  cycleStartSnapshot: string;
  elapsedDays: number;
  elapsedMonths: number;
  requestedAmount: number;
  penaltyRate: number;
  penaltyAmount: number;
  interestRate: number;
  interestAmount: number;
  netPaidAmount: number;
  remainingBalance: number;
  voucherNo?: string;
  narration?: string;
  slabDescription?: string;
}

const PigmyClosureMaster: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'withdrawal' | 'closure'>('withdrawal');
  const [accountNo, setAccountNo] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  
  // Previews
  const [closurePreview, setClosurePreview] = useState<ClosurePreview | null>(null);
  const [withdrawalPreview, setWithdrawalPreview] = useState<WithdrawalPreview | null>(null);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistoryItem[]>([]);
  
  // Form States
  const [narration, setNarration] = useState('');
  const [managerOverride, setManagerOverride] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchWithdrawalsHistory = async (accNo: string) => {
    try {
      const res = await axios.get(`/api/PigmyClosure/WithdrawalsHistory/${encodeURIComponent(accNo.trim())}`);
      setWithdrawalHistory(res.data || []);
    } catch {
      setWithdrawalHistory([]);
    }
  };

  const handleSearch = async () => {
    if (!accountNo.trim()) return;
    setLoading(true);
    setMessage('');
    setClosurePreview(null);
    setWithdrawalPreview(null);
    setWithdrawalHistory([]);
    setManagerOverride(false);
    
    try {
      if (activeTab === 'closure') {
        const res = await axios.get(`/api/PigmyClosure/Preview/${encodeURIComponent(accountNo.trim())}`);
        setClosurePreview(res.data);
        toast.success('पिग्मी खाते माहिती उपलब्ध झाली.');
      } else {
        // In withdrawal tab, fetch closure preview as basic account snapshot + withdrawal history
        const [cRes, hRes] = await Promise.all([
          axios.get(`/api/PigmyClosure/Preview/${encodeURIComponent(accountNo.trim())}`),
          axios.get(`/api/PigmyClosure/WithdrawalsHistory/${encodeURIComponent(accountNo.trim())}`)
        ]);
        setClosurePreview(cRes.data);
        setWithdrawalHistory(hRes.data || []);
        toast.success('पिग्मी खाते माहिती व सायकल इतिहास लोड झाला.');
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.response?.data || 'खाते शोधताना त्रुटी आली किंवा खाते सापडले नाही.';
      setMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewWithdrawal = async (amountToTest?: number) => {
    const amt = amountToTest ?? parseFloat(withdrawalAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('कृपया वैध विड्रॉल रक्कम टाका.');
      return;
    }
    if (closurePreview && amt > closurePreview.totalDepositedAmount) {
      toast.error(`खात्यात फक्त ₹${closurePreview.totalDepositedAmount.toLocaleString('en-IN')} जमा आहेत.`);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`/api/PigmyClosure/PreviewWithdrawal/${encodeURIComponent(accountNo.trim())}?amount=${amt}`);
      setWithdrawalPreview(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'विड्रॉल तपासताना त्रुटी आली.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteWithdrawal = async () => {
    if (!withdrawalPreview) return;

    if (withdrawalPreview.hasActiveLoanLien && !managerOverride) {
      toast.error('सक्रिय कर्ज बाकी असताना विड्रॉल करता येणार नाही. व्यवस्थापक संमती आवश्यक आहे.');
      return;
    }

    const confirmMsg = `खाते '${withdrawalPreview.accountNo}' मधून ₹${withdrawalPreview.requestedAmount.toLocaleString('en-IN')} विड्रॉल करून उर्वरित शिल्लक ₹${withdrawalPreview.remainingBalance.toLocaleString('en-IN')} साठी नवीन सायकल #${withdrawalPreview.currentCycleNumber + 1} (Day 1) सुरू करायची का?`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await axios.post('/api/PigmyClosure/Withdraw', {
        accountNo: withdrawalPreview.accountNo,
        amount: withdrawalPreview.requestedAmount,
        branchId: 1,
        narration,
        managerOverrideConfirmed: managerOverride
      });

      const successMsg = (res.data?.message || 'विड्रॉल यशस्वी!') + (res.data?.voucherNo ? ` (व्हाउचर क्र.: ${res.data.voucherNo})` : '');
      setMessage(successMsg);
      toast.success(successMsg);

      // Refresh account details and history
      handleSearch();
      setWithdrawalPreview(null);
      setWithdrawalAmount('');
      setNarration('');
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data || 'विड्रॉल करताना त्रुटी आली.';
      setMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!closurePreview) return;

    if (closurePreview.hasActiveLoanLien && !managerOverride) {
      toast.error('सक्रिय कर्ज बाकी असताना खाते बंद करता येणार नाही. व्यवस्थापक संमती आवश्यक आहे.');
      return;
    }

    const confirmMsg = closurePreview.isPremature
      ? `हे मुदतपूर्व बंद (Premature) आहे. ₹${closurePreview.prematurePenaltyAmount.toLocaleString('en-IN')} कपात करून सभासदास निव्वळ ₹${closurePreview.netPayable.toLocaleString('en-IN')} अदा करण्यात येतील. पुढे जायचे का?`
      : `तुम्हाला खात्री आहे का? तुम्ही खाते '${closurePreview.accountNo}' बंद करून सभासदास ₹${closurePreview.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} अदा करत आहात?`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await axios.post('/api/PigmyClosure/Close', {
        accountNo: closurePreview.accountNo,
        branchId: 1,
        narration,
        managerOverrideConfirmed: managerOverride
      });
      const successMsg = (res.data?.message || 'खाते यशस्वीरीत्या बंद झाले.') + (res.data?.voucherNo ? ` (व्हाउचर क्र.: ${res.data.voucherNo})` : '');
      setMessage(successMsg);
      toast.success(successMsg);
      setClosurePreview(null);
      setAccountNo('');
      setNarration('');
      setManagerOverride(false);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data || 'खाते बंद करताना सर्व्हर त्रुटी आली.';
      setMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        
        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex flex-wrap items-center justify-between shadow-xs gap-2">
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
              <span>पिग्मी विड्रॉल व खाते बंद व्यवस्थापन (Pigmy Withdrawal & Closure)</span>
            </h2>
            <p className="text-[10px] text-blue-100 font-normal">
              अंशतः विड्रॉल (Day 1 Reset), सायकल ट्रॅकिंग, मुदतपूर्ती (Option B Fixed Expiry) व खाते बंद परतावा
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded border border-white/20">
            <button
              type="button"
              onClick={() => {
                setActiveTab('withdrawal');
                setWithdrawalPreview(null);
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'withdrawal' ? 'bg-white text-primary shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              <BanknotesIcon className="w-4 h-4" />
              <span>१. अंशतः विड्रॉल (Day 1 Reset)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('closure');
                setWithdrawalPreview(null);
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'closure' ? 'bg-white text-rose-700 shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              <XCircleIcon className="w-4 h-4" />
              <span>२. पूर्ण खाते बंद (Closure)</span>
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">

          {message && (
            <div className={`p-2.5 rounded-sm border text-xs font-bold ${
              message.includes('Error') || message.includes('त्रुटी') || message.includes('Failed') || message.includes('already') || message.includes('थकीत') 
                ? 'bg-red-50 text-red-800 border-red-200' 
                : 'bg-green-50 text-green-800 border-green-200'
            }`}>
              {message}
            </div>
          )}

          {/* Search Account Card */}
          <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200">
            <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200 flex items-center justify-between">
              <span>१. खाते शोध (Search Pigmy Account)</span>
              <span className="text-[10px] text-primary font-bold">
                {activeTab === 'withdrawal' ? 'मोड: अंशतः विड्रॉल (Partial Withdrawal)' : 'मोड: पूर्ण खाते बंद (Full Closure)'}
              </span>
            </div>

            <div className="flex gap-2.5 items-end">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">पिग्मी खाते नंबर (Account Number) *</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-blue-900" 
                  placeholder="उदा. PG-1234 किंवा 1001"
                  value={accountNo} 
                  onChange={(e) => setAccountNo(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button 
                className="bg-primary hover:bg-[#004a75] text-white px-4 py-1.5 rounded-sm font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                onClick={handleSearch}
                disabled={loading || !accountNo.trim()}
              >
                <span>{loading ? 'शोधत आहे...' : '🔍 खाते शोधा (Search)'}</span>
              </button>
            </div>
          </div>

          {/* Account Snapshot Card */}
          {closurePreview && (
            <div className="bg-white rounded-sm border border-gray-200 overflow-hidden space-y-3 p-3">
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-200 flex justify-between items-center">
                <span>२. खाते तपशील व चालू सायकल माहिती (Account Snapshot & Current Cycle)</span>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold">
                    सायकल #{closurePreview.currentCycleNumber}
                  </span>
                  {closurePreview.isPremature ? (
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                      ⚠️ मुदतपूर्व • {closurePreview.tenureMonthsInCycle} महिने भरले
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                      ✓ मुदत पूर्ण (Matured)
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-gray-50 p-2.5 rounded border border-gray-200">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">खातेदाराचे नाव (Customer Name)</p>
                  <p className="font-bold text-xs text-gray-900">{closurePreview.customerName || closurePreview.memberName}</p>
                  {closurePreview.cifNo && <p className="text-[10px] text-gray-500 font-mono">CIF: {closurePreview.cifNo}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">खाते क्र. (Account No)</p>
                  <p className="font-mono font-bold text-xs text-blue-900">{closurePreview.accountNo}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">चालू जमा शिल्लक (Balance)</p>
                  <p className="font-mono font-black text-sm text-emerald-700">
                    ₹ {closurePreview.totalDepositedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">चालू सायकल सुरुवात (Day 1)</p>
                  <p className="font-medium text-xs text-gray-800 font-mono">
                    {new Date(closurePreview.cycleStartDate).toLocaleDateString('en-GB')} ({closurePreview.tenureDaysInCycle} दिवस)
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">मूळ मुदत तारीख (Fixed Expiry)</p>
                  <p className="font-medium text-xs text-gray-800 font-mono">
                    {new Date(closurePreview.maturityDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>

              {/* Active Loan Alert */}
              {closurePreview.hasActiveLoanLien && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded space-y-2">
                  <div className="flex items-center gap-1.5 text-red-900 font-bold text-xs">
                    <ShieldExclamationIcon className="w-4 h-4 text-red-600 shrink-0" />
                    <span>⚠️ सक्रिय कर्ज वसुली सुरक्षा (Active Loan Lien Alert): एकूण थकीत ₹ {closurePreview.totalLoanLiability.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="pt-1 flex items-center gap-2 bg-red-100/50 p-2 rounded border border-red-200">
                    <input
                      type="checkbox"
                      id="managerOverrideCheck"
                      checked={managerOverride}
                      onChange={(e) => setManagerOverride(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                    />
                    <label htmlFor="managerOverrideCheck" className="text-xs font-bold text-red-900 cursor-pointer">
                      व्यवस्थापक विशेष परवानगी (Manager Override): कर्ज बाकी असतानाही प्रक्रिया करण्यास संमती देतो.
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 1: PARTIAL WITHDRAWAL SECTION */}
              {activeTab === 'withdrawal' && (
                <div className="space-y-3 pt-1">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-blue-950 flex items-center gap-1">
                        <BanknotesIcon className="w-4 h-4 text-primary" />
                        <span>३. अंशतः विड्रॉल रक्कम प्रविष्ट करा (Enter Partial Withdrawal Amount)</span>
                      </h4>
                      <span className="text-[10px] text-blue-800 font-medium">
                        चालू सायकल स्लॅब: <span className="font-bold text-primary">{closurePreview.policyNote}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                          काढायची रक्कम (Withdrawal Amount ₹) *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="100"
                            min="100"
                            max={closurePreview.totalDepositedAmount}
                            placeholder={`कमाल ₹ ${closurePreview.totalDepositedAmount}`}
                            value={withdrawalAmount}
                            onChange={(e) => setWithdrawalAmount(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePreviewWithdrawal()}
                            className="w-full border border-gray-300 rounded px-2.5 py-1 text-xs font-mono font-bold text-primary focus:ring-1 focus:ring-primary bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handlePreviewWithdrawal()}
                            disabled={loading || !withdrawalAmount}
                            className="px-3 py-1 bg-primary hover:bg-[#004a75] text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            हिशोब तपासा
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-gray-600 bg-white p-2 rounded border border-blue-200">
                        <span className="block text-[10px] text-gray-500 font-bold uppercase">शिल्लक राहणारी रक्कम</span>
                        <span className="font-mono font-bold text-gray-900">
                          ₹ {Math.max(0, closurePreview.totalDepositedAmount - (parseFloat(withdrawalAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* WITHDRAWAL PREVIEW BREAKDOWN */}
                    {withdrawalPreview && (
                      <div className="mt-3 pt-2.5 border-t border-blue-200 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div className="bg-white p-2 rounded border border-gray-200">
                            <span className="text-[10px] text-gray-500 block uppercase font-bold">१. मागितलेली मुद्दल</span>
                            <span className="font-mono font-bold text-gray-900 text-sm">
                              ₹ {withdrawalPreview.requestedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded border border-gray-200">
                            <span className="text-[10px] text-gray-500 block uppercase font-bold">
                              २. दंड / व्याज आकारणी ({withdrawalPreview.appliedPenaltyRate > 0 ? `${withdrawalPreview.appliedPenaltyRate}% दंड` : `${withdrawalPreview.appliedInterestRate}% व्याज`})
                            </span>
                            <span className={`font-mono font-bold text-sm ${
                              withdrawalPreview.appliedPenaltyAmount > 0 ? 'text-rose-600' : 'text-emerald-700'
                            }`}>
                              {withdrawalPreview.appliedPenaltyAmount > 0 ? `- ₹ ${withdrawalPreview.appliedPenaltyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `+ ₹ ${withdrawalPreview.appliedInterestAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                            </span>
                            <span className="text-[9px] text-gray-500 block">{withdrawalPreview.policyNote}</span>
                          </div>

                          <div className="bg-emerald-50 p-2 rounded border border-emerald-300">
                            <span className="text-[10px] text-emerald-800 block uppercase font-bold">३. ग्राहकास रोख देय परतावा</span>
                            <span className="font-mono font-black text-emerald-800 text-base">
                              ₹ {withdrawalPreview.netPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* 🌟 THE DAY 1 RESET HIGHLIGHT BOX */}
                        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-950 font-medium space-y-1">
                          <div className="font-bold flex items-center gap-1 text-amber-900">
                            <ArrowPathIcon className="w-4 h-4 text-amber-700" />
                            <span>🔄 सायकल रीसेट नियम (Day 1 Reset Rule Applicable):</span>
                          </div>
                          <p>
                            विड्रॉलनंतर खात्यात मागे उरणाऱ्या <strong>₹ {withdrawalPreview.remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> रकमेसाठी आजच्या तारखेपासून (<span className="font-mono font-bold">{new Date().toLocaleDateString('en-GB')}</span>) नवीन <strong>सायकल #{withdrawalPreview.currentCycleNumber + 1} (Day 1)</strong> सुरू होईल.
                          </p>
                          <p className="text-[10px] text-amber-800">
                            • मूळ मुदत तारीख: <strong className="font-mono">{new Date(withdrawalPreview.fixedMaturityDate).toLocaleDateString('en-GB')}</strong> कायम राहील (पर्याय ब - Fixed Expiry).<br />
                            • पुढील विड्रॉल किंवा अंतिम मुदतपूर्तीवेळी या नवीन Day 1 तारखेपासूनचे महिने मोजून त्यावेळचा स्लॅब लावला जाईल.
                          </p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-0.5">विड्रॉल शेरा (Narration - Optional)</label>
                          <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white" 
                            placeholder="विड्रॉलचे कारण किंवा टिप्पणी..."
                            value={narration} 
                            onChange={(e) => setNarration(e.target.value)} 
                          />
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleExecuteWithdrawal}
                            disabled={loading || (withdrawalPreview.hasActiveLoanLien && !managerOverride)}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 transition"
                          >
                            <BanknotesIcon className="w-4 h-4" />
                            <span>💸 विड्रॉल पूर्ण करा आणि नवीन सायकल सुरू करा (Process & Reset Day 1)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PAST WITHDRAWALS HISTORY TABLE */}
                  {withdrawalHistory.length > 0 && (
                    <div className="border border-gray-200 rounded overflow-hidden">
                      <div className="bg-slate-100 px-3 py-1.5 font-bold text-[11px] text-gray-700 border-b border-gray-200 flex items-center justify-between">
                        <span>📜 या खात्याचा पूर्वीचा विड्रॉल इतिहास (Past Withdrawals & Cycles)</span>
                        <span className="text-[10px] font-mono text-gray-500">{withdrawalHistory.length} विड्रॉल्स</span>
                      </div>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-gray-600 text-[10px] font-bold border-b">
                          <tr>
                            <th className="p-1.5 text-center">सायकल #</th>
                            <th className="p-1.5">तारीख</th>
                            <th className="p-1.5 text-right">काढलेली रक्कम</th>
                            <th className="p-1.5 text-right">दंड / कपात</th>
                            <th className="p-1.5 text-right">अदा रक्कम</th>
                            <th className="p-1.5 text-right">उर्वरित शिल्लक</th>
                            <th className="p-1.5">व्हाउचर क्र.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-[11px]">
                          {withdrawalHistory.map((item) => (
                            <tr key={item.withdrawalID} className="hover:bg-slate-50 font-mono">
                              <td className="p-1.5 text-center font-bold text-indigo-700">सायकल #{item.cycleNumber}</td>
                              <td className="p-1.5">{new Date(item.withdrawalDate).toLocaleDateString('en-GB')}</td>
                              <td className="p-1.5 text-right font-bold text-gray-800">₹ {item.requestedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-1.5 text-right text-rose-600">₹ {item.penaltyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-1.5 text-right font-bold text-emerald-700">₹ {item.netPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-1.5 text-right font-bold text-blue-900">₹ {item.remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="p-1.5 text-gray-500 font-sans text-[10px]">{item.voucherNo || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: FULL CLOSURE SECTION */}
              {activeTab === 'closure' && (
                <div className="space-y-3 pt-1">
                  <div className="p-3 bg-red-50/50 border border-red-200 rounded space-y-2">
                    <h4 className="font-bold text-xs text-red-950">३. पूर्ण खाते बंद परतावा हिशोब (Full Closure Financial Settlement)</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-white p-2 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 uppercase block font-medium">१. अंतिम जमा ठेव (Deposit)</span>
                        <span className="text-sm font-bold font-mono text-gray-800">
                          ₹ {closurePreview.totalDepositedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-gray-500 block">चालू सायकल: {closurePreview.tenureMonthsInCycle} महिने भरले</span>
                      </div>

                      <div className="bg-white p-2 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 uppercase block font-medium">
                          २. स्लॅब परतावा ({closurePreview.prematurePenaltyRate > 0 ? `${closurePreview.prematurePenaltyRate}% दंड` : `${closurePreview.prematureInterestRate}% व्याज`})
                        </span>
                        <span className={`text-sm font-bold font-mono ${closurePreview.prematurePenaltyAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {closurePreview.prematurePenaltyAmount > 0 ? `- ₹ ${closurePreview.prematurePenaltyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `+ ₹ ${closurePreview.prematureInterestAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                        </span>
                        <span className="text-[9px] text-gray-500 block">{closurePreview.policyNote}</span>
                      </div>

                      <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 uppercase block font-bold">
                          ३. अंतिम देय परतावा रक्कम (Net Payable)
                        </span>
                        <span className="text-base font-extrabold font-mono text-emerald-700">
                          ₹ {closurePreview.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">कारण / शेरा (Closure Narration - Optional)</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" 
                      placeholder="खाते बंद करण्याचे कारण किंवा विशेष शेरा..."
                      value={narration} 
                      onChange={(e) => setNarration(e.target.value)} 
                    />
                  </div>

                  <div className="pt-2 border-t border-gray-200 flex justify-end">
                    <button 
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2 rounded-sm font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
                      onClick={handleClose}
                      disabled={loading || (closurePreview.hasActiveLoanLien && !managerOverride)}
                    >
                      <XCircleIcon className="w-4 h-4" />
                      <span>खाते कायमस्वरूपी बंद करा आणि ₹ {closurePreview.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} अदा करा</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PigmyClosureMaster;
