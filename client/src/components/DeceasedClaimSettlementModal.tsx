import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  X, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  User, 
  DollarSign, 
  Building2, 
  Printer, 
  ShieldAlert 
} from 'lucide-react';

interface DeceasedClaimInfo {
  memberID: number;
  memberName: string;
  memberCode: string;
  cifNo: string;
  status: string;
  nomineeName: string;
  nomineeRelation: string;
  nomineeAddress: string;
  savingsBalance: number;
  fdBalance: number;
  rdBalance: number;
  pigmyBalance: number;
  shareAmount: number;
  shareCount: number;
  totalGrossAssets: number;
  loanLiability: number;
  totalGuarantorLiability: number;
  hasGuarantorLiability: boolean;
  netPayable: number;
  netRecoverable: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memberId: number;
  onSettled?: () => void;
}

export default function DeceasedClaimSettlementModal({ isOpen, onClose, memberId, onSettled }: Props) {
  const [claimInfo, setClaimInfo] = useState<DeceasedClaimInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settledResult, setSettledResult] = useState<any>(null);

  const [formData, setFormData] = useState({
    deathDate: new Date().toISOString().split('T')[0],
    deathCertificateNo: '',
    nomineeName: '',
    nomineeRelation: 'Spouse',
    nomineeAadhaarNo: '',
    nomineeMobileNo: '',
    nomineeBankAccount: '',
    resolutionNo: '',
    resolutionDate: new Date().toISOString().split('T')[0],
    remarks: 'मयत सभासद वारसदार क्लेम सेटलमेंट'
  });

  useEffect(() => {
    if (isOpen && memberId > 0) {
      fetchClaimInfo();
      setSettledResult(null);
    }
  }, [isOpen, memberId]);

  const fetchClaimInfo = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/Members/${memberId}/DeceasedClaimInfo`);
      setClaimInfo(res.data);
      if (res.data) {
        setFormData(prev => ({
          ...prev,
          nomineeName: res.data.nomineeName !== '-' ? res.data.nomineeName : '',
          nomineeRelation: res.data.nomineeRelation !== '-' ? res.data.nomineeRelation : 'Spouse'
        }));
      }
    } catch (err) {
      console.error(err);
      alert('मयत सभासद माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nomineeName.trim()) {
      alert('कृपया वारसदाराचे नाव प्रविष्ट करा.');
      return;
    }

    if (!formData.deathCertificateNo.trim()) {
      alert('कृपया मृत्यू दाखला क्रमांक प्रविष्ट करा.');
      return;
    }

    const confirmMsg = `तुम्ही ${claimInfo?.memberName} (CIF: ${claimInfo?.cifNo}) यांचा क्लेम सेटल करू इच्छिता का?\n\nएकूण देय रक्कम: ₹${claimInfo?.netPayable.toLocaleString('en-IN')}\n\nवारसदार: ${formData.nomineeName}\n\nयानंतर सर्व संबंधित खाती बंद केली जातील आणि सभासद 'Mayat' म्हणून नोंदवला जाईल.`;
    if (!window.confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      const payload = {
        branchId: 1,
        ...formData
      };

      const res = await axios.post(`/api/Members/${memberId}/DeceasedClaimSettlement`, payload);
      setSettledResult(res.data);
      if (onSettled) onSettled();
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.response?.data || 'क्लेम सेटलमेंट करताना त्रुटी आली.';
      alert(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">मयत खातेदार क्लेम सेटलमेंट (Deceased Claim Settlement)</h2>
              <p className="text-[10px] text-gray-300">महाराष्ट्र सहकारी संस्था अधिनियम १९६० नियम व पोटनियम तरतुदीनुसार</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-sm cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 text-xs space-y-4">
          
          {loading ? (
            <div className="text-center py-12 text-gray-500 font-semibold">
              माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
            </div>
          ) : settledResult ? (
            /* Settlement Success View */
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-base font-bold text-gray-900">क्लेम सेटलमेंट यशस्वीरित्या पूर्ण झाले!</h3>
              <p className="text-gray-600 max-w-md mx-auto text-xs">
                {claimInfo?.memberName} यांच्या वारसदारास देय रक्कम ₹{settledResult.netPayableAmount?.toLocaleString('en-IN')} चा क्लेम सेटल झाला असून सिस्टम व्हाउचर तयार करण्यात आले आहे.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded p-3 max-w-md mx-auto text-left space-y-1 text-xs font-mono">
                <div>क्लेम आयडी: <strong className="text-primary">{settledResult.claimID}</strong></div>
                <div>पेमेंट व्हाउचर आयडी: <strong>{settledResult.voucherID || '-'}</strong></div>
                <div>वारसदाराचे नाव: <strong>{formData.nomineeName}</strong> ({formData.nomineeRelation})</div>
                <div>मृत्यू दाखला क्र.: <strong>{formData.deathCertificateNo}</strong></div>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={() => window.print()}
                  className="bg-slate-800 text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-slate-900"
                >
                  <Printer size={13} />
                  <span>पावती प्रिंट करा</span>
                </button>
                <button
                  onClick={onClose}
                  className="bg-gray-200 text-gray-800 px-4 py-1.5 rounded text-xs font-semibold hover:bg-gray-300 cursor-pointer"
                >
                  बंद करा
                </button>
              </div>
            </div>
          ) : claimInfo ? (
            /* Main Form */
            <form onSubmit={handleSettle} className="space-y-4">
              
              {/* Member & Asset Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                
                {/* Member Info Card */}
                <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5">
                  <h4 className="font-bold text-gray-900 border-b border-gray-200 pb-1 flex items-center justify-between">
                    <span>सभासद माहिती</span>
                    <span className="text-primary font-mono">{claimInfo.memberCode || claimInfo.cifNo}</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div>नाव: <strong>{claimInfo.memberName}</strong></div>
                    <div>सध्याची स्थिती: <span className="bg-purple-100 text-purple-800 font-bold px-1 rounded">{claimInfo.status}</span></div>
                    <div>नोंदणीकृत वारसदार: <strong>{claimInfo.nomineeName}</strong></div>
                    <div>नाते: <strong>{claimInfo.nomineeRelation}</strong></div>
                    <div className="col-span-2 text-gray-500">पत्ता: {claimInfo.nomineeAddress}</div>
                  </div>
                </div>

                {/* Financial Summary Card */}
                <div className="bg-emerald-50/70 p-3 rounded border border-emerald-200 space-y-1">
                  <h4 className="font-bold text-emerald-950 border-b border-emerald-200 pb-1 flex items-center justify-between">
                    <span>आर्थिक ताळेबंद (Financial Balances)</span>
                    <span className="text-emerald-800 font-bold">एकूण मालमत्ता</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono">
                    <div className="text-gray-600">बचत शिल्लक:</div>
                    <div className="text-right font-bold">₹{claimInfo.savingsBalance.toLocaleString('en-IN')}</div>
                    <div className="text-gray-600">मुदत ठेव (FD):</div>
                    <div className="text-right font-bold">₹{claimInfo.fdBalance.toLocaleString('en-IN')}</div>
                    <div className="text-gray-600">आरडी ठेव (RD):</div>
                    <div className="text-right font-bold">₹{claimInfo.rdBalance.toLocaleString('en-IN')}</div>
                    <div className="text-gray-600">पिग्मी ठेव:</div>
                    <div className="text-right font-bold">₹{claimInfo.pigmyBalance.toLocaleString('en-IN')}</div>
                    <div className="text-gray-600">भागभांडवल (Shares):</div>
                    <div className="text-right font-bold">₹{claimInfo.shareAmount.toLocaleString('en-IN')} ({claimInfo.shareCount} शेअर्स)</div>
                    <div className="text-red-600 font-bold border-t border-emerald-200 pt-0.5">कर्ज येणे बाकी:</div>
                    <div className="text-right font-bold text-red-600 border-t border-emerald-200 pt-0.5">- ₹{claimInfo.loanLiability.toLocaleString('en-IN')}</div>
                  </div>
                  
                  <div className="mt-2 pt-1 border-t-2 border-emerald-400 flex items-center justify-between font-bold text-xs">
                    <span className="text-emerald-950">वारसदारास निव्वळ देय (Net Payable):</span>
                    <span className="text-base text-emerald-800 font-mono">₹{claimInfo.netPayable.toLocaleString('en-IN')}</span>
                  </div>
                </div>

              </div>

              {/* Guarantor Warning if any */}
              {claimInfo.hasGuarantorLiability && (
                <div className="bg-amber-50 border border-amber-300 p-2.5 rounded text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>सूचना:</strong> हा सभासद इतर चालू कर्जांसाठी जामीनदार आहे (एकूण जामीनकी दायित्व: ₹{claimInfo.totalGuarantorLiability.toLocaleString('en-IN')}). क्लेम सेटलमेंट करण्यापूर्वी संस्थेने संबंधित कर्जाचा आढावा घेणे आवश्यक आहे.
                  </div>
                </div>
              )}

              {/* Statutory Settlement Details Form */}
              <div className="bg-white p-3.5 rounded border border-gray-300 space-y-3">
                <h4 className="font-bold text-gray-900 border-b border-gray-200 pb-1 text-xs">
                  वैधानिक क्लेम व वारसदार तपशील (Statutory Nominee & Claim Details)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">मृत्यू दिनांक *</label>
                    <input
                      type="date"
                      name="deathDate"
                      value={formData.deathDate}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">मृत्यू दाखला क्र. (Death Cert No) *</label>
                    <input
                      type="text"
                      name="deathCertificateNo"
                      placeholder="उदा. MC/2026/12345"
                      value={formData.deathCertificateNo}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">वारसदाराचे नाव (Claimant Name) *</label>
                    <input
                      type="text"
                      name="nomineeName"
                      placeholder="वारसदाराचे पूर्ण नाव"
                      value={formData.nomineeName}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary font-bold text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">वारसदाराचे नाते</label>
                    <select
                      name="nomineeRelation"
                      value={formData.nomineeRelation}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                    >
                      <option value="Spouse">पती/पत्नी (Spouse)</option>
                      <option value="Son">मुलगा (Son)</option>
                      <option value="Daughter">मुलगी (Daughter)</option>
                      <option value="Father">वडील (Father)</option>
                      <option value="Mother">आई (Mother)</option>
                      <option value="Brother">भाऊ (Brother)</option>
                      <option value="Legal Heir">कायदेशीर वारसदार (Legal Heir)</option>
                      <option value="Other">इतर (Other)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">वारसदार आधार नंबर</label>
                    <input
                      type="text"
                      maxLength={12}
                      name="nomineeAadhaarNo"
                      placeholder="१२ अंकी आधार"
                      value={formData.nomineeAadhaarNo}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">वारसदार मोबाईल नं.</label>
                    <input
                      type="text"
                      maxLength={10}
                      name="nomineeMobileNo"
                      placeholder="१० अंकी मोबाईल"
                      value={formData.nomineeMobileNo}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">वारसदाराचा बँक खाते क्र. व बँक नाव</label>
                    <input
                      type="text"
                      name="nomineeBankAccount"
                      placeholder="उदा. SBI A/c 123456789 (IFSC)"
                      value={formData.nomineeBankAccount}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">संचालक मंडळ ठराव क्र. (Resolution No)</label>
                    <input
                      type="text"
                      name="resolutionNo"
                      placeholder="उदा. ठराव क्र. १२"
                      value={formData.resolutionNo}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">ठराव दिनांक</label>
                    <input
                      type="date"
                      name="resolutionDate"
                      value={formData.resolutionDate}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">शेरा / टिप्पणी (Remarks)</label>
                  <textarea
                    rows={2}
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="bg-gray-200 text-gray-800 px-4 py-1.5 rounded text-xs font-semibold hover:bg-gray-300 cursor-pointer disabled:opacity-50"
                >
                  रद्द करा
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary hover:bg-[#004a75] text-white px-5 py-1.5 rounded text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ShieldAlert size={14} />
                  <span>{submitting ? 'क्लेम प्रक्रिया सुरू आहे...' : '⚖️ क्लेम सेटल करा आणि व्हाउचर तयार करा'}</span>
                </button>
              </div>

            </form>
          ) : null}

        </div>

      </div>
    </div>
  );
}
