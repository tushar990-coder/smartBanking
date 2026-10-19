import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from './SearchableSelect';

interface RdAccount {
  rdAccountID: number;
  accountNo: string;
  memberCode: string;
  memberName: string;
  schemeName: string;
  installmentAmount: number;
  totalPaidInstallments: number;
  totalDepositedAmount: number;
  durationMonths: number;
  interestRate: number;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  openingDate: string;
  branchID?: number;
}

interface FdScheme {
  fdSchemeID: number;
  schemeName: string;
  interestRate: number;
  durationMonths: number;
  branchID?: number | null;
  branch?: { branchID: number; branchName: string } | null;
}

interface RdWithdrawalMaturityProps {
  voucherId?: number;
  isPassingMode?: boolean;
  onNavigate?: (tab: string, subTab?: string) => void;
}

export default function RdWithdrawalMaturity({ voucherId: propVoucherId, isPassingMode: propIsPassingMode, onNavigate }: RdWithdrawalMaturityProps = {}) {
  const queryParams = new URLSearchParams(window.location.search);
  const voucherId = propVoucherId || (queryParams.get('voucherId') ? parseInt(queryParams.get('voucherId')!, 10) : undefined);
  const isPassingMode = propIsPassingMode ?? (queryParams.get('passingMode') === 'true');

  const [passingVoucherData, setPassingVoucherData] = useState<any>(null);
  const [passingLoading, setPassingLoading] = useState<boolean>(false);
  const [passingActionLoading, setPassingActionLoading] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [accounts, setAccounts] = useState<RdAccount[]>([]);
  const [selectedAccId, setSelectedAccId] = useState('');
  const [selectedAcc, setSelectedAcc] = useState<RdAccount | null>(null);
  const [accruedInterest, setAccruedInterest] = useState(0);

  const [fdSchemes, setFdSchemes] = useState<FdScheme[]>([]);
  const [targetFdSchemeId, setTargetFdSchemeId] = useState('');

  const { user } = useAuth();
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];

  // Form inputs
  const [closureDate, setClosureDate] = useState(activeBusinessDate);

  // Sync CBS Business Date if changed
  useEffect(() => {
    if (user?.businessDate) {
      setClosureDate(user.businessDate.split('T')[0]);
    }
  }, [user?.businessDate]);

  const [previewData, setPreviewData] = useState<{ recalcInt: number, clawback: number, netPayout: number } | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'matured' | 'premature' | 'renew'>('matured');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadPassingClosure = async (vId: number) => {
    setPassingLoading(true);
    try {
      const res = await axios.get(`/api/RdAccounts/closure-by-voucher/${vId}`);
      const { rdAccount, closureDetails, voucher } = res.data;
      setPassingVoucherData(voucher);

      if (rdAccount) {
        setSelectedAccId(rdAccount.rdAccountID.toString());
        setSelectedAcc({
          rdAccountID: rdAccount.rdAccountID,
          accountNo: rdAccount.accountNo,
          memberCode: rdAccount.cifNo || '',
          memberName: rdAccount.customerName || '',
          schemeName: rdAccount.schemeName || '',
          installmentAmount: rdAccount.installmentAmount,
          totalPaidInstallments: rdAccount.totalPaidInstallments,
          totalDepositedAmount: rdAccount.totalDepositedAmount,
          durationMonths: rdAccount.durationMonths,
          interestRate: 0,
          maturityDate: rdAccount.maturityDate,
          maturityAmount: rdAccount.maturityAmount,
          status: rdAccount.status,
          openingDate: rdAccount.openingDate,
        });

        const intDiff = (closureDetails?.totalPayoutAmount || voucher?.totalAmount || 0) - rdAccount.totalDepositedAmount;
        setAccruedInterest(Math.max(0, intDiff));

        if (closureDetails?.closureType === 'PrematureClose') {
          setActiveSubTab('premature');
          setPreviewData({
            recalcInt: Math.max(0, intDiff),
            clawback: 0,
            netPayout: closureDetails?.totalPayoutAmount || voucher?.totalAmount || rdAccount.totalDepositedAmount,
          });
        } else {
          setActiveSubTab('matured');
        }

        if (closureDetails?.closureDate) {
          setClosureDate(closureDetails.closureDate.split('T')[0]);
        }
      }
    } catch (err: any) {
      console.error('Error loading RD closure voucher:', err);
      alert('आरडी क्लोजर व्हाउचर लोड करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingLoading(false);
    }
  };

  const handlePassVoucher = async () => {
    if (!voucherId) return;
    if (!window.confirm('आपण खात्रीपूर्वक हे आरडी क्लोजर व्हाउचर मंजूर व पास करू इच्छिता?')) return;
    setPassingActionLoading(true);
    try {
      await axios.post('/api/VoucherPosting/Post', [voucherId]);
      alert('व्हाउचर यशस्वीरीत्या मंजूर व पास करण्यात आले!');
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      alert('व्हाउचर पास करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  const handleRejectVoucher = async () => {
    if (!voucherId) return;
    if (!rejectReason.trim()) {
      alert('कृपया नामंजूर / रद्द करण्याचे कारण नमूद करा.');
      return;
    }
    setPassingActionLoading(true);
    try {
      await axios.delete(`/api/VoucherPosting/${voucherId}?reason=${encodeURIComponent(rejectReason)}`);
      alert('व्हाउचर यशस्वीरित्या नामंजूर / रद्द करण्यात आले!');
      setRejectModalOpen(false);
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      alert('व्हाउचर रद्द करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      let cifStr = params.get('cifNo') || params.get('cif');
      let customerIdStr = params.get('customerId') || params.get('customerID');
      let memberIdStr = params.get('memberId') || params.get('memberID');
      let rdAccountIdStr = params.get('rdAccountId') || params.get('accountId') || params.get('id');

      // Also read universal sessionStorage transfer bridge
      if (!cifStr && !customerIdStr && !memberIdStr && !rdAccountIdStr) {
        try {
          const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
          if (rawBridge) {
            sessionStorage.removeItem('cbs_active_customer_transfer');
            const bridgeData = JSON.parse(rawBridge);
            if (bridgeData) {
              cifStr = bridgeData.cifNo || bridgeData.cif;
              customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
              memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : null;
              rdAccountIdStr = bridgeData.rdAccountId ? String(bridgeData.rdAccountId) : null;
            }
          }
        } catch (e) {
          console.error('Failed to read sessionStorage transfer:', e);
        }
      }

      const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
      const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
      const targetAccId = rdAccountIdStr ? parseInt(rdAccountIdStr, 10) : 0;
      let fastTrackDone = false;

      // ⚡ FAST-TRACK 1: Direct targeted account ID lookup (~15-20ms)
      if (targetAccId > 0) {
        try {
          const singleRes = await axios.get(`/api/RdAccounts/${targetAccId}`);
          const accDetails = singleRes.data?.AccountDetails || singleRes.data?.accountDetails || singleRes.data;
          if (accDetails && accDetails.rdAccountID) {
            setAccounts([accDetails]);
            setSelectedAccId(accDetails.rdAccountID.toString());
            handleAccountChange(accDetails.rdAccountID.toString());
            fastTrackDone = true;
          }
        } catch (err) {
          console.warn('Fast-track targeted RD account lookup failed, falling back', err);
        }
      }
      // ⚡ FAST-TRACK 2: Direct targeted customer / member ID lookup (~20-30ms)
      else if (cId > 0 || mId > 0) {
        try {
          const queryParam = cId > 0 ? `customerId=${cId}` : `memberId=${mId}`;
          const custRes = await axios.get(`/api/RdAccounts?${queryParam}`);
          const active = (custRes.data || []).filter((a: any) => a.status === 'Active' || a.status === 'Matured');
          if (active.length > 0) {
            setAccounts(active);
            setSelectedAccId(active[0].rdAccountID.toString());
            handleAccountChange(active[0].rdAccountID.toString());
            fastTrackDone = true;
          }
        } catch (err) {
          console.warn('Fast-track customer RD lookup failed, falling back', err);
        }
      }

      // If fast-track did not trigger, fetch full list
      if (!fastTrackDone) {
        const res = await axios.get('/api/RdAccounts');
        const active = (res.data || []).filter((a: any) => a.status === 'Active' || a.status === 'Matured');
        setAccounts(active);

        if (cId > 0 || mId > 0 || cifStr) {
          const matchedAcc = active.find((a: any) => 
            (cId > 0 && a.customerID === cId) || 
            (mId > 0 && a.memberID === mId) ||
            (cifStr && a.cifNo && a.cifNo.trim().toUpperCase() === cifStr.trim().toUpperCase())
          );
          if (matchedAcc) {
            setSelectedAccId(matchedAcc.rdAccountID.toString());
            handleAccountChange(matchedAcc.rdAccountID.toString());
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFdSchemes = async () => {
    try {
      const res = await axios.get('/api/FdSchemes');
      setFdSchemes(res.data.filter((s: any) => s.isActive));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchFdSchemes();
    if (voucherId) {
      loadPassingClosure(voucherId);
    }
  }, [voucherId]);

  const handleAccountChange = async (e: any) => {
    const val = e?.target?.value ?? e;
    setSelectedAccId(val);
    setPreviewData(null);
    if (val) {
      try {
        const res = await axios.get(`/api/RdAccounts/${val}`);
        const accDetails = res.data.accountDetails;
        
        // Sum accrued interest from history
        const accruals = res.data.history
          .filter((t: any) => t.transactionType === 'Accrual')
          .reduce((sum: number, t: any) => sum + t.interestAmount, 0);

        setSelectedAcc(accDetails);
        setAccruedInterest(accruals + accDetails.legacyAccruedInt);
        
        // Set tab default based on actual status
        if (accDetails.status === 'Matured') {
          setActiveSubTab('matured');
        } else {
          setActiveSubTab('premature');
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setSelectedAcc(null);
      setAccruedInterest(0);
    }
  };

  // Premature closure preview logic matching API calculations
  const calculatePrematurePreview = () => {
    if (!selectedAcc) return;
    
    const opening = new Date(selectedAcc.openingDate);
    const closing = new Date(closureDate);
    
    let actualMonths = (closing.getFullYear() - opening.getFullYear()) * 12 + closing.getMonth() - opening.getMonth();
    if (actualMonths <= 0) actualMonths = 1;

    // Penalty interest rate reduction: 1% penalty
    const prematureRate = Math.max(0, selectedAcc.interestRate - 1.0);
    
    // Revised compound maturity estimation
    const p = selectedAcc.installmentAmount;
    const r = prematureRate;
    const n = actualMonths;

    let recalcMaturity = 0;
    for (let k = 1; k <= n; k++) {
      const monthsInBank = n - k + 1;
      const factor = Math.pow(1.0 + (r / 400.0), monthsInBank / 3.0);
      recalcMaturity += p * factor;
    }
    recalcMaturity = Math.round(recalcMaturity);

    const recalcInt = Math.max(0, recalcMaturity - (p * n));
    
    let clawback = 0;
    let netPayout = selectedAcc.totalDepositedAmount + recalcInt;

    if (accruedInterest > recalcInt) {
      clawback = accruedInterest - recalcInt;
      netPayout = selectedAcc.totalDepositedAmount - clawback;
    }

    setPreviewData({
      recalcInt,
      clawback,
      netPayout,
    });
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPassingMode) return;
    if (!selectedAcc) return;
    setLoading(true);
    setMessage('');
    try {
      if (activeSubTab === 'matured') {
        const res = await axios.post(`/api/RdAccounts/${selectedAcc.rdAccountID}/MaturedClose?closureDate=${closureDate}`);
        setMessage(res.data);
      } else if (activeSubTab === 'premature') {
        const res = await axios.post(`/api/RdAccounts/${selectedAcc.rdAccountID}/PrematureClose?closureDate=${closureDate}`);
        setMessage('मुदतपूर्व खाते यशस्वीरित्या बंद करण्यात आले!');
      } else if (activeSubTab === 'renew') {
        if (!targetFdSchemeId) {
          setMessage('कृपया नूतनीकरणासाठी टार्गेट मुदत ठेव योजना निवडा.');
          setLoading(false);
          return;
        }
        const res = await axios.post(`/api/RdAccounts/${selectedAcc.rdAccountID}/Renew?targetSchemeId=${targetFdSchemeId}&closureDate=${closureDate}`);
        setMessage(`नूतनीकरण यशस्वी! नवीन एफडी खाते क्रमांक: ${res.data.fdAccountNo}`);
      }

      // Reset
      setSelectedAccId('');
      setSelectedAcc(null);
      setPreviewData(null);
      fetchAccounts();
    } catch (err: any) {
      setMessage(err.response?.data || 'खाते बंद करताना काही तांत्रिक त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const labelClass = "block text-xs font-bold text-gray-700 mb-1";
  const inputClass = "w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary bg-white text-gray-900";

  return (
    <div className="p-3 space-y-4">
      {/* Passing Mode Banner */}
      {isPassingMode && (
        <div className="bg-amber-500 text-white p-3 rounded-sm shadow flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-sm">व्हाउचर तपासणी व पासिंग मोड (Checker Inspection Mode)</p>
              <p className="text-xs text-amber-100">
                व्हाउचर क्र: <span className="font-mono font-bold text-white">{passingVoucherData?.voucherNo || voucherId}</span> | 
                रक्कम: <span className="font-bold text-white">₹{passingVoucherData?.totalAmount?.toLocaleString('en-IN') || selectedAcc?.totalDepositedAmount}</span> | 
                स्थिती: <span className="font-bold text-white">{passingVoucherData?.status || 'तपासणीसाठी प्रलंबित'}</span>
                {passingVoucherData?.narration && ` | तपशील: ${passingVoucherData.narration}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting')}
              className="px-3 py-1 bg-white text-amber-800 text-xs font-bold rounded shadow hover:bg-amber-50"
            >
              ↩️ पासिंग यादीवर परत जा
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-2 rounded-sm shadow-sm border border-gray-200">
        <div>
          <h1 className="text-base font-bold text-primary">
            आरडी मुदतपूर्ती पेमेंट आणि खाते बंद (Payout & Closure)
            {isPassingMode && <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">(फक्त वाचन मोड)</span>}
          </h1>
        </div>
      </div>

      {message && (
        <div className={`text-xs p-2 rounded-sm border ${
          message.includes('यशस्वी') || message.includes('completed')
            ? 'bg-green-100 border-green-300 text-green-700' 
            : 'bg-red-100 border-red-300 text-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Main Layout */}
      <fieldset disabled={isPassingMode} className="contents">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Account Details Panel */}
          <div className="lg:col-span-1 bg-white p-3 rounded-sm shadow-sm border border-gray-200 space-y-3 h-fit">
            <h2 className="text-xs font-bold text-primary border-b pb-1">
              खाते निवडा (Select Account)
            </h2>
            <div>
              <SearchableSelect
                options={accounts.map((a) => ({
                  value: a.rdAccountID,
                  label: `${a.accountNo} - ${a.memberName}`,
                }))}
                value={selectedAccId}
                onChange={handleAccountChange}
                placeholder="नाव किंवा खाते क्रमांकाने शोधा..."
                disabled={isPassingMode}
              />
            </div>

            {selectedAcc && (
              <div className="border-t border-gray-200 pt-3 space-y-2.5 text-xs text-gray-700">
                <div className="flex justify-between">
                  <span>खातेदार नाव:</span>
                  <span className="font-bold text-gray-900">{selectedAcc.memberName}</span>
                </div>
                <div className="flex justify-between">
                  <span>मासिक हप्ता:</span>
                  <span className="font-semibold text-gray-800">₹ {selectedAcc.installmentAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>भरलेले एकूण हप्ते:</span>
                  <span>{selectedAcc.totalPaidInstallments} / {selectedAcc.durationMonths} महिने</span>
                </div>
                <div className="flex justify-between">
                  <span>एकूण जमा मुद्दल:</span>
                  <span className="font-bold text-blue-700">₹ {selectedAcc.totalDepositedAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>जमा व्याज (Accrued):</span>
                  <span className="font-bold text-emerald-600">₹ {accruedInterest}</span>
                </div>
                <div className="flex justify-between">
                  <span>सध्याची खाते स्थिती:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    selectedAcc.status === 'Matured' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-green-100 text-green-700 border border-green-200'
                  }`}>
                    {selectedAcc.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Panel Column */}
          <div className="lg:col-span-2 space-y-4">
            {selectedAcc ? (
              <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200 space-y-3">
                {/* Internal Tab Headers */}
                <div className="flex border-b border-gray-200 pb-2 mb-3">
                  <button
                    type="button"
                    disabled={isPassingMode}
                    onClick={() => { setActiveSubTab('matured'); setPreviewData(null); }}
                    className={`flex-1 pb-1.5 text-xs font-bold text-center border-b-2 transition duration-200 ${
                      activeSubTab === 'matured' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    मुदतपूर्ती बंद (Matured)
                  </button>
                  <button
                    type="button"
                    disabled={isPassingMode}
                    onClick={() => { setActiveSubTab('premature'); setPreviewData(null); }}
                    className={`flex-1 pb-1.5 text-xs font-bold text-center border-b-2 transition duration-200 ${
                      activeSubTab === 'premature' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    मुदतपूर्व बंद (Premature)
                  </button>
                  <button
                    type="button"
                    disabled={isPassingMode}
                    onClick={() => { setActiveSubTab('renew'); setPreviewData(null); }}
                    className={`flex-1 pb-1.5 text-xs font-bold text-center border-b-2 transition duration-200 ${
                      activeSubTab === 'renew' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    नूतनीकरण (Renewal)
                  </button>
                </div>

                {/* Form Content depending on active tab */}
                <form onSubmit={handleCloseSubmit} className="space-y-4">
                  {activeSubTab === 'matured' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-700">
                        <strong>चेतावणी:</strong> हे खाते मुदत पूर्ण झालेले (Matured) असल्यावरच या पर्यायाचा वापर करावा.
                      </div>
                      <div>
                        <label className={labelClass}>मुदतपूर्ती पावती तारीख (Maturity Payout Date) <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          value={closureDate}
                          onChange={(e) => setClosureDate(e.target.value)}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div className="bg-gray-50 p-4 rounded-sm border border-gray-250 flex justify-between items-center">
                        <span className="font-semibold text-gray-700 text-xs">एकूण देय पेमेंट (Net Payout):</span>
                        <span className="text-base font-black text-emerald-600">
                          ₹ {(selectedAcc.totalDepositedAmount + accruedInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}

                  {activeSubTab === 'premature' && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>बंद केल्याची तारीख (Closure Date) <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          value={closureDate}
                          onChange={(e) => { setClosureDate(e.target.value); setPreviewData(null); }}
                          className={inputClass}
                          required
                        />
                      </div>
                      {!isPassingMode && (
                        <button
                          type="button"
                          onClick={calculatePrematurePreview}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded-sm text-xs border border-gray-300 transition duration-200"
                        >
                          दंडात्मक व्याज गणना करा (Preview Recalc)
                        </button>
                      )}

                      {previewData && (
                        <div className="bg-gray-50 p-3 rounded-sm border border-gray-200 space-y-2 text-xs text-gray-750">
                          <div className="flex justify-between">
                            <span>पुनर्रचित व्याज (Revised Interest at -1% Penalty):</span>
                            <span className="text-gray-900 font-semibold">₹ {previewData.recalcInt}</span>
                          </div>
                          {previewData.clawback > 0 && (
                            <div className="flex justify-between text-red-655 font-bold">
                              <span>जास्तीचे व्याज तरतूद वजावट (Clawback):</span>
                              <span>- ₹ {previewData.clawback}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-gray-350 text-gray-800">
                            <span className="font-bold">अंतिम देय रक्कम (Net Paid Amount):</span>
                            <span className="text-sm font-black text-emerald-600">₹ {previewData.netPayout}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeSubTab === 'renew' && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>नूतनीकरण तारीख (Renewal Date) <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          value={closureDate}
                          onChange={(e) => setClosureDate(e.target.value)}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>नूतनीकरण योजना निवडा (Select Target FD Scheme)</label>
                        <select
                          value={targetFdSchemeId}
                          onChange={(e) => setTargetFdSchemeId(e.target.value)}
                          className={inputClass}
                          required
                        >
                          <option value="">--- योजना निवडा ---</option>
                          {fdSchemes
                            .filter(s => !selectedAcc?.branchID || !s.branchID || s.branchID === selectedAcc.branchID)
                            .map((s) => (
                            <option key={s.fdSchemeID} value={s.fdSchemeID}>
                              {s.branchID ? `🏢 [${s.branch?.branchName || 'विशिष्ट शाखा'}] ` : '🌐 [सर्व शाखा] '}
                              {s.schemeName} ({s.interestRate}% - {s.durationMonths} महिने)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-sm border border-gray-200 flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-700">नूतनीकरण वर्ग होणारी रक्कम:</span>
                        <span className="text-sm font-bold text-blue-700">
                          ₹ {(selectedAcc.totalDepositedAmount + accruedInterest).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}

                  {!isPassingMode && (
                    <div className="flex justify-end pt-3 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-1.5 bg-primary hover:bg-[#004a75] text-white font-semibold rounded-sm text-xs shadow-sm transition duration-200"
                      >
                        {loading ? 'प्रक्रिया चालू आहे...' : 'खाते बंद व्यवहार सबमिट करा'}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-sm p-8 text-center text-gray-500 font-medium text-xs">
                खाते बंद / मॅच्युरिटी व्यवहार करण्यासाठी डाव्या बाजूकडील पॅनेलमधून सक्रीय खाते निवडा.
              </div>
            )}
          </div>
        </div>
      </fieldset>

      {/* Passing Mode Actions Bar */}
      {isPassingMode && (
        <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200 flex justify-between items-center">
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded text-xs border border-gray-300 transition"
          >
            ↩️ पासिंग यादीवर परत जा (Back to Queue)
          </button>
          <div className="flex space-x-3">
            <button
              type="button"
              disabled={passingActionLoading}
              onClick={() => setRejectModalOpen(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs shadow transition disabled:opacity-50"
            >
              ❌ नामंजूर / रद्द करा (Reject Voucher)
            </button>
            <button
              type="button"
              disabled={passingActionLoading}
              onClick={handlePassVoucher}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow transition disabled:opacity-50"
            >
              {passingActionLoading ? 'पास करत आहे...' : '✅ मंजूर व पास करा (Approve & Pass)'}
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-md w-full p-4 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-red-600">व्हाउचर नामंजूर / रद्द करा</h3>
            <p className="text-xs text-gray-600">
              कृपया हे व्हाउचर का नामंजूर किंवा रद्द करत आहात याचे स्पष्ट कारण लिहा (उदा. चुकीचे खाते, दंडात्मक व्याज त्रुटी इ.):
            </p>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-1 focus:ring-red-500"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="नामंजूरीचे कारण नमूद करा..."
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold hover:bg-gray-50"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                disabled={passingActionLoading || !rejectReason.trim()}
                onClick={handleRejectVoucher}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition disabled:opacity-50"
              >
                {passingActionLoading ? 'प्रक्रिया सुरू...' : 'पुष्टी करा व रद्द करा'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

