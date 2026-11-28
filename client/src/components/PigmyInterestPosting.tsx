import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, resolveWriteBranchId } from '../utils/branchAccess';
import { formatLocalYmd, getBusinessDateStr, parseYmdAsLocalDate } from '../utils/businessDateUtils';

interface InterestPreviewResult {
  pigmyAccountId: number;
  accountNo: string;
  customerName?: string;
  memberName?: string;
  schemeName?: string;
  appliedInterestRate?: number;
  calculationMethod?: string;
  currentBalance: number;
  calculatedInterest: number;
}

const PigmyInterestPosting: React.FC = () => {
  const { user, globalBranchId } = useAuth();
  const activeBizStr = getBusinessDateStr(user?.businessDate);
  const activeBizDate = parseYmdAsLocalDate(activeBizStr);
  const [startDate, setStartDate] = useState(formatLocalYmd(new Date(activeBizDate.getFullYear(), 3, 1))); // April 1
  const [endDate, setEndDate] = useState(formatLocalYmd(new Date(activeBizDate.getFullYear(), 8, 30))); // Sept 30
  const [postingDate, setPostingDate] = useState(activeBizStr);

  useEffect(() => {
    if (user?.businessDate) {
      const bStr = getBusinessDateStr(user.businessDate);
      const bDate = parseYmdAsLocalDate(bStr);
      setStartDate(formatLocalYmd(new Date(bDate.getFullYear(), 3, 1)));
      setEndDate(formatLocalYmd(new Date(bDate.getFullYear(), 8, 30)));
      setPostingDate(bStr);
    }
  }, [user?.businessDate]);
  
  const [previews, setPreviews] = useState<InterestPreviewResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePreview = async () => {
    setLoading(true);
    setMessage('');
    try {
      const effBranch = getEffectiveBranchId(user, globalBranchId);
      const res = await api.get('/api/PigmyInterest/CalculatePreview', {
        params: {
          startDate,
          endDate,
          ...(typeof effBranch === 'number' && effBranch > 0 ? { branchId: effBranch } : {})
        }
      });
      setPreviews(res.data || []);
      if (!res.data || res.data.length === 0) {
        setMessage('या कालावधीत कोणतेही सक्रिय खात्यावर व्याज शिल्लक नाही.');
        toast('कोणतेही सक्रिय खाते किंवा व्याज सापडले नाही.', { icon: 'ℹ️' });
      } else {
        toast.success(`एकूण ${res.data.length} खात्यांचे व्याज गणले गेले.`);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data || 'व्याज गणना करताना त्रुटी आली.';
      setMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePostInterest = async () => {
    if (!window.confirm(`तुम्हाला खात्री आहे का? तुम्ही ${previews.length} खात्यांसाठी एकूण व्याज खात्यात जमा करत आहात?`)) return;
    
    setLoading(true);
    try {
      const res = await api.post('/api/PigmyInterest/PostInterest', {
        startDate,
        endDate,
        postingDate,
        branchId: resolveWriteBranchId(user)
      });
      const successMsg = res.data?.message || 'व्याज खात्यात यशस्वीरीत्या जमा झाले.';
      setMessage(successMsg + (res.data?.voucherNo ? ` (व्हाउचर क्र.: ${res.data.voucherNo})` : ''));
      toast.success(successMsg);
      setPreviews([]);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data || 'व्याज जमा करताना त्रुटी आली.';
      setMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const totalInterest = previews.reduce((sum, p) => sum + p.calculatedInterest, 0);

  return (
    <div
      className="p-3 sm:p-4 w-full min-h-full font-sans text-xs"
      style={{
        background:
          'linear-gradient(135deg, #FDF2EE 0%, #FFFBF7 45%, #FEF3E2 100%)',
      }}
    >
      <div className="max-w-[1520px] mx-auto space-y-3">
        {/* Outer Aurora Card Container */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_28px_rgba(124,36,24,0.09)] border border-amber-200/75 overflow-hidden flex flex-col">
          {/* Aurora Sapphire Header Banner */}
          <div
            className="px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2"
            style={{
              background:
                'linear-gradient(125deg, #5A1A14 0%, #7C2418 46%, #B44814 82%, #B44814 100%)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-base shadow-xs shrink-0">
                📊
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight flex items-center gap-2">
                  <span>पिग्मी व्याज आकारणी</span>
                  <span className="text-[11px] font-semibold text-amber-200 hidden sm:inline">(Pigmy Interest Posting — Min Monthly Balance)</span>
                </h2>
                <p className="text-[11px] text-amber-100/90 font-medium">
                  पिग्मी खात्यांवर मासिक किमान शिलकीवर व्याज गणना, खातेदारांच्या खात्यावर व्याज जमा व व्हाउचर नोंद
                </p>
              </div>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 space-y-3.5">
            {message && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-bold ${
                  message.includes('Error') || message.includes('Failed') || message.includes('त्रुटी')
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {message}
              </div>
            )}

            {/* Period Selection Card */}
            <div className="bg-[#FFFBF7] p-3.5 rounded-xl border border-amber-200/75 shadow-2xs">
              <div className="text-[11px] font-extrabold text-[#5A1A14] uppercase tracking-wider mb-2.5 pb-1.5 border-b border-amber-100">
                १. व्याज आकारणी कालावधी व तारीख निवडा (Interest Posting Period &amp; Date)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-[#1E3A5F] mb-1">सुरुवातीची तारीख (Start Date) *</label>
                  <input
                    type="date"
                    className="w-full border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B44814]/25 focus:border-[#B44814] bg-white font-semibold text-slate-800"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#1E3A5F] mb-1">अखेरची तारीख (End Date) *</label>
                  <input
                    type="date"
                    className="w-full border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B44814]/25 focus:border-[#B44814] bg-white font-semibold text-slate-800"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPostingDate(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#1E3A5F] mb-1">जमा / व्हाउचर तारीख (Posting Date) *</label>
                  <input
                    type="date"
                    className="w-full border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B44814]/25 focus:border-[#B44814] bg-white font-mono font-bold text-slate-800"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    className="w-full text-white px-3.5 py-2 rounded-lg shadow-sm transition-all font-bold text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 hover:opacity-95"
                    style={{ background: 'linear-gradient(135deg, #B44814 0%, #B44814 100%)' }}
                    onClick={handlePreview}
                    disabled={loading}
                  >
                    {loading ? 'कॅल्क्युलेट करत आहे...' : '🔍 व्याज कॅल्क्युलेट करा (Preview)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Interest Calculations Preview Table */}
            {previews.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200/80 overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#FDF2EE] to-[#FEF3E2] border-b border-amber-200/75 flex flex-wrap justify-between items-center gap-2">
                  <h3 className="font-extrabold text-xs text-[#5A1A14] uppercase tracking-wider">
                    कॅल्क्युलेटेड व्याज तपशील (Interest Preview List)
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-amber-200 text-[#7C2418] font-bold">
                      खाती: <strong className="font-mono">{previews.length}</strong>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                      एकूण व्याज: <strong className="font-mono">₹ {totalInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-[#5A1A14] text-white whitespace-nowrap font-bold">
                      <tr>
                        <th className="py-1.5 px-2.5 border-r border-white/15">खाते क्र.</th>
                        <th className="py-1.5 px-2.5 border-r border-white/15">खातेदाराचे नाव</th>
                        <th className="py-1.5 px-2.5 border-r border-white/15">योजना</th>
                        <th className="py-1.5 px-2.5 border-r border-white/15 text-center">व्याजदर (%)</th>
                        <th className="py-1.5 px-2.5 border-r border-white/15 text-right">चालू शिल्लक (₹)</th>
                        <th className="py-1.5 px-2.5 text-right">कॅल्क्युलेटेड व्याज (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100/70">
                      {previews.map((p, idx) => (
                        <tr
                          key={p.pigmyAccountId}
                          className={`hover:bg-amber-50/60 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}
                        >
                          <td className="py-1.5 px-2.5 border-r border-amber-100/70 font-mono font-bold text-[#9A3412] whitespace-nowrap">
                            {p.accountNo}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-amber-100/70 font-semibold text-slate-900 whitespace-nowrap">
                            {p.customerName || p.memberName}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-amber-100/70 text-slate-600 whitespace-nowrap">
                            {p.schemeName || '-'}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-amber-100/70 text-center font-mono font-bold text-[#9A3412] whitespace-nowrap">
                            {p.appliedInterestRate != null ? `${p.appliedInterestRate}%` : '-'}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-amber-100/70 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                            ₹ {p.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                            ₹ {p.calculatedInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-3.5 py-2.5 bg-[#FFFBF7] border-t border-amber-100 flex justify-end">
                  <button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    onClick={handlePostInterest}
                    disabled={loading}
                  >
                    <span>✅ व्याज खात्यात जमा करा व पावती तयार करा (Post Interest)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PigmyInterestPosting;
