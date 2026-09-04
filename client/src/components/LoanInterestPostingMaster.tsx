import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calculator, Calendar, CheckCircle2, ShieldAlert, Zap, Search } from 'lucide-react';

interface Branch {
  branchID: number;
  branchName: string;
}

interface LoanRate {
  loanRateID: number;
  loanType: string;
  shortName?: string;
  interestRate: number;
}

interface InterestPostingItem {
  loanAccountID: number;
  loanAccountNo: string;
  memberName: string;
  loanSchemeName: string;
  currentPrincipal: number;
  currentInterest: number;
  interestRate: number;
  lastDate: string;
  daysAccrued: number;
  calculatedInterest: number;
  newPrincipal: number;
  newInterest: number;
}

const LoanInterestPostingMaster: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
  const [branchID, setBranchID] = useState<number>(1);
  const [loanRateID, setLoanRateID] = useState<number | null>(null);
  const [postingDate, setPostingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [capitalizeToPrincipal, setCapitalizeToPrincipal] = useState<boolean>(false);
  
  const [previewItems, setPreviewItems] = useState<InterestPostingItem[]>([]);
  const [totalCalculatedInterest, setTotalCalculatedInterest] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [postingLoading, setPostingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchBranches();
    fetchLoanRates();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data);
      if (res.data.length > 0) setBranchID(res.data[0].branchID);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchLoanRates = async () => {
    try {
      const res = await axios.get('/api/LoanRates');
      setLoanRates(res.data);
    } catch (err) {
      console.error('Error fetching loan rates', err);
    }
  };

  const handlePreview = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = {
        branchID,
        loanRateID: loanRateID || undefined,
        postingDate,
        capitalizeToPrincipal
      };
      const res = await axios.post('/api/LoanAccounts/PreviewInterestPosting', payload);
      setPreviewItems(res.data.items || []);
      setTotalCalculatedInterest(res.data.totalCalculatedInterest || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || 'व्याज अंदाजपत्रक तयार करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handlePostBatch = async () => {
    if (previewItems.length === 0) {
      setError('आकारणी पोस्ट करण्यापूर्वी व्याजाची गणती (Preview) करा.');
      return;
    }

    const modeText = capitalizeToPrincipal ? 'मुद्दलामध्ये प्लस (Capitalize to Principal)' : 'येणे व्याजामध्ये (Separate Interest Balance)';
    if (!window.confirm(`तुम्हाला खरोखर ${previewItems.length} कर्ज खात्यांवर एकत्रीत ₹${totalCalculatedInterest.toLocaleString('en-IN')} व्याज आकारणी पोस्ट करायची आहे का?\n\nपद्धत: ${modeText}`)) {
      return;
    }

    setError('');
    setSuccess('');
    setPostingLoading(true);
    try {
      const payload = {
        branchID,
        loanRateID: loanRateID || undefined,
        postingDate,
        capitalizeToPrincipal
      };
      const res = await axios.post('/api/LoanAccounts/PostInterestBatch', payload);
      const vNoMsg = res.data.voucherNo ? ` (व्हाऊचर क्र: ${res.data.voucherNo})` : '';
      setSuccess((res.data.message || 'व्याज आकारणी यशस्वीरित्या पोस्ट झाली!') + vNoMsg);
      setPreviewItems([]);
      setTotalCalculatedInterest(0);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || 'व्याज आकारणी पोस्ट करताना त्रुटी आली.');
    } finally {
      setPostingLoading(false);
    }
  };

  const filteredItems = previewItems.filter((i) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return i.loanAccountNo.toLowerCase().includes(term) || i.memberName.toLowerCase().includes(term) || i.loanSchemeName.toLowerCase().includes(term);
  });

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Standard ERP Header Banner */}
      <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-200" />
          <div>
            <h1 className="text-sm font-bold tracking-wide">कर्ज व्याज आकारणी (Batch Loan Interest Posting Master)</h1>
            <p className="text-[10px] text-blue-100 font-normal">दरमहा / ३१ मार्च अखेर सर्व सक्रिय कर्ज खात्यांवर एकत्रित व्याज आकारणी व ऑटो-व्हाऊचर पोस्टिंग</p>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-100 border border-red-300 text-red-700 text-xs p-2.5 rounded">{error}</div>}
      {success && <div className="bg-green-100 border border-green-300 text-green-700 text-xs p-2.5 rounded font-bold">{success}</div>}

      {/* Control Panel Card */}
      <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-xs font-bold text-primary border-b pb-1">१. आकारणीचे निकष (Posting Criteria)</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">शाखा निवडा (Branch)</label>
            <select
              value={branchID}
              onChange={(e) => setBranchID(parseInt(e.target.value))}
              className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-primary"
            >
              {branches.map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">कर्ज योजना (Loan Scheme / Type)</label>
            <select
              value={loanRateID || ''}
              onChange={(e) => setLoanRateID(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-primary"
            >
              <option value="">-- सर्व कर्ज योजना (All Schemes) --</option>
              {loanRates.map((r) => (
                <option key={r.loanRateID} value={r.loanRateID}>
                  {r.shortName || r.loanType} ({r.interestRate}%)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">आकारणी अखेर तारीख (Posting Date)</label>
            <input
              type="date"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-primary font-bold text-gray-800"
            />
          </div>
        </div>

        {/* Calculation Method Mode Radio Section */}
        <div className="bg-blue-50/70 p-3 rounded border border-blue-200 space-y-2">
          <label className="block text-xs font-bold text-blue-900">
            २. व्याज आकारणीची पद्धत निवडा (Select Calculation & Posting Mode):
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-colors ${!capitalizeToPrincipal ? 'bg-white border-blue-600 shadow-2xs' : 'bg-gray-50 border-gray-200'}`}>
              <input
                type="radio"
                name="postingMode"
                checked={!capitalizeToPrincipal}
                onChange={() => setCapitalizeToPrincipal(false)}
                className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-gray-800">१. व्याजाचे स्वतंत्र खाते ठेवा (Separate Interest Balance)</div>
                <div className="text-[10px] text-gray-500">
                  आकारलेले व्याज 'येणे व्याज' (Interest Balance) मध्ये जमा होईल. मुद्दल (Principal) जशी आहे तशीच राहील.
                </div>
              </div>
            </label>

            <label className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-colors ${capitalizeToPrincipal ? 'bg-amber-50 border-amber-600 shadow-2xs' : 'bg-gray-50 border-gray-200'}`}>
              <input
                type="radio"
                name="postingMode"
                checked={capitalizeToPrincipal}
                onChange={() => setCapitalizeToPrincipal(true)}
                className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-amber-900">२. व्याज मुद्दलामध्ये प्लस करा (Capitalize Interest to Principal)</div>
                <div className="text-[10px] text-amber-700 font-medium">
                  आकारलेले व्याज थेट मुद्दलात (Principal Balance) जोडले जाईल. पुढील महिन्याचे व्याज या नवीन वाढलेल्या मुद्दलावर आकारले जाईल.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            {loading ? 'कॅल्क्युलेशन होत आहे...' : '१. व्याजाची गणती करा (Preview Interest)'}
          </button>

          {previewItems.length > 0 && (
            <button
              type="button"
              onClick={handlePostBatch}
              disabled={postingLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              {postingLoading ? 'पोस्ट होत आहे...' : '२. व्याज आकारणी पोस्ट करा (Post Interest Batch)'}
            </button>
          )}
        </div>
      </div>

      {/* Preview Table Card */}
      {previewItems.length > 0 && (
        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2">
            <div>
              <h2 className="text-xs font-bold text-primary">
                ३. व्याज आकारणी अंदाजपत्रक (Interest Preview) - एकूण {previewItems.length} खाती
              </h2>
              <p className="text-[10px] text-gray-500">
                पद्धत: <strong className="text-gray-800">{capitalizeToPrincipal ? 'मुद्दलामध्ये प्लस (Capitalize)' : 'येणे व्याजामध्ये जमा'}</strong> | एकूण आकारलेले व्याज: <strong className="text-emerald-700">₹{totalCalculatedInterest.toLocaleString('en-IN')}</strong>
              </p>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="शोधा (खाते क्र / नाव)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold">
                  <th className="p-2 border-r">अ.क्र.</th>
                  <th className="p-2 border-r">खाते क्रमांक</th>
                  <th className="p-2 border-r">सभासदाचे नाव</th>
                  <th className="p-2 border-r">कर्ज प्रकार</th>
                  <th className="p-2 border-r text-right">चालू मुद्दल</th>
                  <th className="p-2 border-r text-right">चालू येणे व्याज</th>
                  <th className="p-2 border-r text-center">व्याजदर (%)</th>
                  <th className="p-2 border-r text-center">मागील तारीख</th>
                  <th className="p-2 border-r text-center">दिवस</th>
                  <th className="p-2 border-r text-right bg-emerald-50 text-emerald-800">आकारणी व्याज</th>
                  <th className="p-2 text-right bg-blue-50 text-blue-900">
                    {capitalizeToPrincipal ? 'नवीन मुद्दल' : 'नवीन येणे व्याज'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <tr key={item.loanAccountID} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-2 border-r text-gray-500">{idx + 1}</td>
                    <td className="p-2 border-r font-mono font-bold text-primary">{item.loanAccountNo}</td>
                    <td className="p-2 border-r font-semibold text-gray-800">{item.memberName}</td>
                    <td className="p-2 border-r text-gray-600">{item.loanSchemeName}</td>
                    <td className="p-2 border-r text-right font-medium">₹{item.currentPrincipal.toLocaleString('en-IN')}</td>
                    <td className="p-2 border-r text-right font-medium">₹{item.currentInterest.toLocaleString('en-IN')}</td>
                    <td className="p-2 border-r text-center font-medium">{item.interestRate}%</td>
                    <td className="p-2 border-r text-center text-gray-600 font-mono text-[11px]">
                      {item.lastDate ? new Date(item.lastDate).toLocaleDateString('en-GB') : '-'}
                    </td>
                    <td className="p-2 border-r text-center text-gray-600 font-bold">{item.daysAccrued}</td>
                    <td className="p-2 border-r text-right font-bold text-emerald-700 bg-emerald-50/50">
                      ₹{item.calculatedInterest.toLocaleString('en-IN')}
                    </td>
                    <td className="p-2 text-right font-bold text-blue-900 bg-blue-50/50">
                      ₹{(capitalizeToPrincipal ? item.newPrincipal : item.newInterest).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanInterestPostingMaster;
