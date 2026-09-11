import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface InterestPreviewResult {
  pigmyAccountId: number;
  accountNo: string;
  customerName?: string;
  memberName?: string;
  currentBalance: number;
  calculatedInterest: number;
}

const PigmyInterestPosting: React.FC = () => {
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 3, 1).toISOString().split('T')[0]); // April 1
  const [endDate, setEndDate] = useState(new Date(new Date().getFullYear(), 8, 30).toISOString().split('T')[0]); // Sept 30
  
  const [previews, setPreviews] = useState<InterestPreviewResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePreview = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.get('/api/PigmyInterest/CalculatePreview', {
        params: { startDate, endDate }
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
      const res = await axios.post('/api/PigmyInterest/PostInterest', {
        startDate,
        endDate,
        branchId: 1
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
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        
        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
              <span>📊 पिग्मी व्याज आकारणी (Pigmy Interest Posting - Min Monthly Balance)</span>
            </h2>
            <p className="text-[10px] text-blue-100 font-normal">पिग्मी खात्यांवर मासिक किमान शिलकीवर व्याज गणना, खातेदारांच्या खात्यावर व्याज जमा व व्हाउचर नोंद</p>
          </div>
        </div>

        <div className="p-3 space-y-3">

          {message && (
            <div className={`p-2.5 rounded-sm border text-xs font-bold ${message.includes('Error') || message.includes('Failed') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
              {message}
            </div>
          )}

          {/* Period Selection Card */}
          <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200">
            <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">
              १. व्याज आकारणी कालावधी निवडा (Interest Posting Period)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">सुरुवातीची तारीख (Start Date) *</label>
                <input type="date" className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">अखेरची तारीख (End Date) *</label>
                <input type="date" className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div>
                <button 
                  className="w-full bg-primary hover:bg-[#004a75] text-white px-3 py-1.5 rounded-sm shadow-xs transition-colors font-bold text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                  onClick={handlePreview}
                  disabled={loading}
                >
                  {loading ? 'कॅल्क्युलेट करत आहे...' : '🔍 व्याज कॅल्क्युलेट करा (Preview Interest)'}
                </button>
              </div>
            </div>
          </div>

          {/* Interest Calculations Preview Table */}
          {previews.length > 0 && (
            <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
              <div className="p-2.5 bg-gray-50 border-b border-gray-200 flex justify-between items-center text-primary">
                <h3 className="font-bold text-xs uppercase tracking-wider">कॅल्क्युलेटेड व्याज तपशील (Interest Preview List)</h3>
                <div className="text-right text-xs">
                  <span className="mr-4">एकूण खाती: <strong className="text-gray-900">{previews.length}</strong></span>
                  <span>एकूण व्याज: <strong className="text-emerald-700">₹ {totalInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 uppercase border-b border-gray-200 font-bold">
                    <tr>
                      <th className="p-2 border-r border-gray-200">खाते क्र (Account No)</th>
                      <th className="p-2 border-r border-gray-200">खातेदाराचे नाव (Customer Name)</th>
                      <th className="p-2 border-r border-gray-200 text-right">चालू शिल्लक (Balance ₹)</th>
                      <th className="p-2 text-right text-emerald-800">कॅल्क्युलेटेड व्याज (Interest ₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previews.map(p => (
                      <tr key={p.pigmyAccountId} className="border-b border-gray-200 hover:bg-blue-50/40 transition-colors">
                        <td className="p-2 border-r border-gray-200 font-mono font-bold text-blue-900">{p.accountNo}</td>
                        <td className="p-2 border-r border-gray-200 font-medium">{p.customerName || p.memberName}</td>
                        <td className="p-2 border-r border-gray-200 text-right font-mono font-semibold">₹ {p.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right font-mono font-extrabold text-emerald-700">₹ {p.calculatedInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-2.5 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-sm font-bold text-xs transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
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
  );
};

export default PigmyInterestPosting;
