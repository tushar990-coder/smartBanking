import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  ExclamationTriangleIcon, 
  ShieldExclamationIcon, 
  CheckCircleIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';

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
  tenureDays: number;
  totalDepositedAmount: number;
  isPremature: boolean;
  prematurePenaltyRate: number;
  prematurePenaltyAmount: number;
  netPayable: number;
  hasActiveLoanLien: boolean;
  totalLoanLiability: number;
  activeLoans: ActiveLoan[];
}

const PigmyClosureMaster: React.FC = () => {
  const [accountNo, setAccountNo] = useState('');
  const [preview, setPreview] = useState<ClosurePreview | null>(null);
  const [narration, setNarration] = useState('');
  const [managerOverride, setManagerOverride] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!accountNo.trim()) return;
    setLoading(true);
    setMessage('');
    setPreview(null);
    setManagerOverride(false);
    try {
      const res = await axios.get(`/api/PigmyClosure/Preview/${encodeURIComponent(accountNo.trim())}`);
      setPreview(res.data);
      toast.success('पिग्मी खाते माहिती उपलब्ध झाली.');
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.response?.data || 'खाते शोधताना त्रुटी आली किंवा खाते सापडले नाही.';
      setMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!preview) return;

    if (preview.hasActiveLoanLien && !managerOverride) {
      toast.error('सक्रिय कर्ज बाकी असताना खाते बंद करता येणार नाही. व्यवस्थापक संमती आवश्यक आहे.');
      return;
    }

    const confirmMsg = preview.isPremature
      ? `हे मुदतपूर्व बंद (Premature) आहे. ₹${preview.prematurePenaltyAmount.toLocaleString('en-IN')} कपात करून सभासदास निव्वळ ₹${preview.netPayable.toLocaleString('en-IN')} अदा करण्यात येतील. पुढे जायचे का?`
      : `तुम्हाला खात्री आहे का? तुम्ही खाते '${preview.accountNo}' बंद करून सभासदास ₹${preview.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} अदा करत आहात?`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await axios.post('/api/PigmyClosure/Close', {
        accountNo: preview.accountNo,
        branchId: 1,
        narration,
        managerOverrideConfirmed: managerOverride
      });
      const successMsg = (res.data?.message || 'खाते यशस्वीरीत्या बंद झाले.') + (res.data?.voucherNo ? ` (व्हाउचर क्र.: ${res.data.voucherNo})` : '');
      setMessage(successMsg);
      toast.success(successMsg);
      setPreview(null);
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
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
              <span>❌ पिग्मी खाते बंद करणे (Pigmy Account Closure)</span>
            </h2>
            <p className="text-[10px] text-blue-100 font-normal">पिग्मी मुदतपूर्ती किंवा मुदतपूर्व खाते बंद करणे, तारण/कर्ज पडताळणी, दंड गणना आणि परतावा व्हाउचर</p>
          </div>
        </div>

        <div className="p-3 space-y-3">

          {message && (
            <div className={`p-2.5 rounded-sm border text-xs font-bold ${message.includes('Error') || message.includes('त्रुटी') || message.includes('Failed') || message.includes('already') || message.includes('थकीत') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
              {message}
            </div>
          )}

          {/* Search Account Card */}
          <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200">
            <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">
              १. खाते शोध (Search Pigmy Account)
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

          {/* Account Details & Closure Preview */}
          {preview && (
            <div className="bg-white rounded-sm border border-gray-200 overflow-hidden space-y-3 p-3">
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-200 flex justify-between items-center">
                <span>२. खाते तपशील व देय परतावा (Account Details & Closure Summary)</span>
                {preview.isPremature ? (
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                    ⚠️ मुदतपूर्व बंद (Premature) • {preview.tenureDays} दिवस
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                    ✓ मुदत पूर्ण (Matured)
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-2.5 rounded border border-gray-200">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">खातेदाराचे नाव (Customer Name)</p>
                  <p className="font-bold text-xs text-gray-900">{preview.customerName || preview.memberName}</p>
                  {preview.cifNo && <p className="text-[10px] text-gray-500 font-mono">CIF: {preview.cifNo}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">खाते क्र. (Account No)</p>
                  <p className="font-mono font-bold text-xs text-blue-900">{preview.accountNo}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">उघडल्याची तारीख (Opening Date)</p>
                  <p className="font-medium text-xs text-gray-800">{new Date(preview.openingDate).toLocaleDateString('en-GB')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">परिपक्वता तारीख (Maturity Date)</p>
                  <p className="font-medium text-xs text-gray-800">{new Date(preview.maturityDate).toLocaleDateString('en-GB')}</p>
                </div>
              </div>

              {/* ACTIVE LOAN / LIEN PROTECTION ALERT */}
              {preview.hasActiveLoanLien && (
                <div className="p-3 bg-red-50 border border-red-300 rounded space-y-2">
                  <div className="flex items-center gap-2 text-red-900 font-bold text-xs">
                    <ShieldExclamationIcon className="w-5 h-5 text-red-600 shrink-0" />
                    <span>⚠️ कर्ज वसुली सुरक्षा इशारा (Active Loan Lien Protection Alert)</span>
                  </div>
                  <p className="text-[11px] text-red-800">
                    या खातेदाराकडे एकूण <strong>₹ {preview.totalLoanLiability.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> ची कर्ज बाकी/थकबाकी आहे. संस्थेच्या हितासाठी पिग्मी ठेव परतावा देण्यापूर्वी खालील कर्ज खाते तपासा:
                  </p>
                  <div className="overflow-x-auto border border-red-200 rounded bg-white">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-red-100/70 text-red-900 text-[10px] font-bold uppercase">
                        <tr>
                          <th className="p-1.5">कर्ज खाते क्र.</th>
                          <th className="p-1.5">कर्ज प्रकार</th>
                          <th className="p-1.5 text-right">मुद्दल शिल्लक (Principal)</th>
                          <th className="p-1.5 text-right">व्याज बाकी (Interest)</th>
                          <th className="p-1.5 text-right">एकूण थकीत (Total ₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {preview.activeLoans.map((loan) => (
                          <tr key={loan.loanAccountId} className="font-mono text-red-900">
                            <td className="p-1.5 font-bold">{loan.loanAccountNo}</td>
                            <td className="p-1.5 font-sans">{loan.loanType}</td>
                            <td className="p-1.5 text-right">₹ {loan.principalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="p-1.5 text-right">₹ {loan.overdueInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="p-1.5 text-right font-bold text-red-700">₹ {loan.totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Manager Override Checkbox */}
                  <div className="pt-1 flex items-center gap-2 bg-red-100/50 p-2 rounded border border-red-200">
                    <input
                      type="checkbox"
                      id="managerOverrideCheck"
                      checked={managerOverride}
                      onChange={(e) => setManagerOverride(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                    />
                    <label htmlFor="managerOverrideCheck" className="text-xs font-bold text-red-900 cursor-pointer">
                      व्यवस्थापक विशेष परवानगी (Manager Override): कर्ज बाकी असल्याची जाणीव असूनही हे पिग्मी खाते बंद करण्यास संमती देतो.
                    </label>
                  </div>
                </div>
              )}

              {/* FINANCIAL SETTLEMENT BREAKDOWN CARD */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded space-y-2">
                <h4 className="font-bold text-xs text-blue-900">परतावा आर्थिक हिशोब (Financial Settlement Breakdown)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-[10px] text-gray-500 uppercase block font-medium">१. एकूण जमा ठेव (Total Deposit)</span>
                    <span className="text-sm font-bold font-mono text-gray-800">
                      ₹ {preview.totalDepositedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded border border-blue-100">
                    <span className="text-[10px] text-gray-500 uppercase block font-medium">
                      २. मुदतपूर्व दंड कपात ({preview.prematurePenaltyRate}%)
                    </span>
                    <span className="text-sm font-bold font-mono text-red-600">
                      - ₹ {preview.prematurePenaltyAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {preview.isPremature && (
                      <span className="text-[9px] text-gray-500 block">
                        {preview.tenureDays < 90 ? '३ महिन्यांपेक्षा कमी कालावधी (२% कपात)' : preview.tenureDays < 180 ? '६ महिन्यांपेक्षा कमी (१% कपात)' : 'मुदतपूर्व (०.५% कपात)'}
                      </span>
                    )}
                  </div>

                  <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 uppercase block font-bold">
                      ३. अंतिम देय परतावा रक्कम (Net Payable)
                    </span>
                    <span className="text-base font-extrabold font-mono text-emerald-700">
                      ₹ {preview.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

              <div className="pt-2 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  {preview.hasActiveLoanLien && !managerOverride && (
                    <span className="text-red-600 font-bold text-[11px] flex items-center gap-1">
                      <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
                      सक्रिय कर्ज असल्यामुळे बंद करणे थांबवले आहे.
                    </span>
                  )}
                </div>

                <button 
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2 rounded-sm font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5 self-end"
                  onClick={handleClose}
                  disabled={loading || (preview.hasActiveLoanLien && !managerOverride)}
                >
                  <span>❌ खाते बंद करा आणि ₹ {preview.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} अदा करा</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PigmyClosureMaster;
