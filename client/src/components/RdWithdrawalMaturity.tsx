import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
}

interface FdScheme {
  fdSchemeID: number;
  schemeName: string;
  interestRate: number;
  durationMonths: number;
}

export default function RdWithdrawalMaturity() {
  const [accounts, setAccounts] = useState<RdAccount[]>([]);
  const [selectedAccId, setSelectedAccId] = useState('');
  const [selectedAcc, setSelectedAcc] = useState<RdAccount | null>(null);
  const [accruedInterest, setAccruedInterest] = useState(0);

  const [fdSchemes, setFdSchemes] = useState<FdScheme[]>([]);
  const [targetFdSchemeId, setTargetFdSchemeId] = useState('');

  // Form inputs
  const [closureDate, setClosureDate] = useState(new Date().toISOString().split('T')[0]);
  const [previewData, setPreviewData] = useState<{ recalcInt: number, clawback: number, netPayout: number } | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'matured' | 'premature' | 'renew'>('matured');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await axios.get('/api/RdAccounts');
      // Filter only active or matured accounts
      const active = res.data.filter((a: any) => a.status === 'Active' || a.status === 'Matured');
      setAccounts(active);

      const params = new URLSearchParams(window.location.search);
      const memberIdStr = params.get('memberId');
      if (memberIdStr && active.length > 0) {
        const mId = parseInt(memberIdStr, 10);
        const matchedAcc = active.find((a: any) => a.memberID === mId);
        if (matchedAcc) {
          setSelectedAccId(matchedAcc.rdAccountID.toString());
          handleAccountChange(matchedAcc.rdAccountID.toString()); // Also trigger calculation
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
  }, []);

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
    if (!selectedAcc) return;
    setLoading(true);
    setMessage('');
    try {
      if (activeSubTab === 'matured') {
        const res = await axios.post(`/api/RdAccounts/${selectedAcc.rdAccountID}/MaturedClose`);
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
        const res = await axios.post(`/api/RdAccounts/${selectedAcc.rdAccountID}/Renew?targetSchemeId=${targetFdSchemeId}`);
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
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-2 rounded-sm shadow-sm border border-gray-200">
        <div>
          <h1 className="text-base font-bold text-primary">
            आरडी मुदतपूर्ती पेमेंट आणि खाते बंद (Payout & Closure)
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
                      <label className={labelClass}>बंद केल्याची तारीख (Closure Date)</label>
                      <input
                        type="date"
                        value={closureDate}
                        onChange={(e) => { setClosureDate(e.target.value); setPreviewData(null); }}
                        className={inputClass}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={calculatePrematurePreview}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded-sm text-xs border border-gray-300 transition duration-200"
                    >
                      दंडात्मक व्याज गणना करा (Preview Recalc)
                    </button>

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
                      <label className={labelClass}>नूतनीकरण योजना निवडा (Select Target FD Scheme)</label>
                      <select
                        value={targetFdSchemeId}
                        onChange={(e) => setTargetFdSchemeId(e.target.value)}
                        className={inputClass}
                        required
                      >
                        <option value="">--- योजना निवडा ---</option>
                        {fdSchemes.map((s) => (
                          <option key={s.fdSchemeID} value={s.fdSchemeID}>
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

                <div className="flex justify-end pt-3 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-1.5 bg-primary hover:bg-[#004a75] text-white font-semibold rounded-sm text-xs shadow-sm transition duration-200"
                  >
                    {loading ? 'प्रक्रिया चालू आहे...' : 'खाते बंद व्यवहार सबमिट करा'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-sm p-8 text-center text-gray-500 font-medium text-xs">
              खाते बंद / मॅच्युरिटी व्यवहार करण्यासाठी डाव्या बाजूकडील पॅनेलमधून सक्रीय खाते निवडा.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
