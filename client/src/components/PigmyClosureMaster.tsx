import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';

interface ClosurePreview {
  pigmyAccountId: number;
  accountNo: string;
  customerName?: string;
  memberName?: string;
  openingDate: string;
  maturityDate: string;
  totalDepositedAmount: number;
  netPayable: number;
  isPremature: boolean;
}

const PigmyClosureMaster: React.FC = () => {
  const [accountNo, setAccountNo] = useState('');
  const [preview, setPreview] = useState<ClosurePreview | null>(null);
  const [narration, setNarration] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!accountNo.trim()) return;
    setLoading(true);
    setMessage('');
    setPreview(null);
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
    if (!window.confirm(`तुम्हाला खात्री आहे का? तुम्ही खाते '${preview.accountNo}' बंद करून सभासदास ₹${preview.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} अदा करत आहात?`)) return;

    setLoading(true);
    try {
      const res = await axios.post('/api/PigmyClosure/Close', {
        accountNo: preview.accountNo,
        branchId: 1,
        narration
      });
      const successMsg = (res.data?.message || 'खाते यशस्वीरीत्या बंद झाले.') + (res.data?.voucherNo ? ` (व्हाउचर क्र.: ${res.data.voucherNo})` : '');
      setMessage(successMsg);
      toast.success(successMsg);
      setPreview(null);
      setAccountNo('');
      setNarration('');
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
            <p className="text-[10px] text-blue-100 font-normal">पिग्मी मुदतपूर्ती किंवा मुदतपूर्व खाते बंद करणे, परतावा गणना आणि विड्रॉअल पावती जनरेशन</p>
          </div>
        </div>

        <div className="p-3 space-y-3">

          {message && (
            <div className={`p-2.5 rounded-sm border text-xs font-bold ${message.includes('Error') || message.includes('त्रुटी') || message.includes('Failed') || message.includes('already') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
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
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-200">
                २. खाते तपशील व देय रक्कम (Account Details & Payment Summary)
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-2.5 rounded border border-gray-200">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">खातेदाराचे नाव (Customer Name)</p>
                  <p className="font-bold text-xs text-gray-900">{preview.customerName || preview.memberName}</p>
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

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h4 className="font-bold text-xs text-amber-900">खाते परतावा सारांश (Closure Payment Summary)</h4>
                  {preview.isPremature && (
                    <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-sm font-extrabold mt-1 inline-block">
                      ⚠️ मुदतपूर्व बंद (Premature Closure)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-700 font-medium">एकूण जमा (Total Deposited): <strong className="font-mono">₹ {preview.totalDepositedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>
                  <p className="text-base font-extrabold text-red-700 mt-0.5">देय परतावा रक्कम (Net Payable): <span className="font-mono">₹ {preview.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">कारण / शेरा (Closure Narration - Optional)</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" 
                  placeholder="खाते बंद करण्याचे कारण..."
                  value={narration} 
                  onChange={(e) => setNarration(e.target.value)} 
                />
              </div>

              <div className="pt-2 border-t border-gray-200 flex justify-end">
                <button 
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-sm font-bold text-xs transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  onClick={handleClose}
                  disabled={loading}
                >
                  <span>❌ खाते बंद करा आणि ₹ {preview.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} अदा करा (Close Account)</span>
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
