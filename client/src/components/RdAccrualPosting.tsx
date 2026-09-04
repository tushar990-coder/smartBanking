import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Branch {
  branchID: number;
  branchName: string;
}

export default function RdAccrualPosting() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const globalBranchStr = localStorage.getItem('globalBranchId');
    const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
    const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 1;
    const [branchID, setBranchID] = useState<number>(initialBranchId);
  const [accrualDate, setAccrualDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [logDetails, setLogDetails] = useState('');

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleRunProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setLogDetails('');

    try {
      const res = await axios.post(`/api/RdAccounts/AccrueInterest?branchId=${branchID}&accrualDate=${accrualDate}`);
      setMessage('व्याज तरतूद (Accrual Run) यशस्वीरित्या पूर्ण झाली!');
      setLogDetails(res.data);
    } catch (err: any) {
      setMessage(err.response?.data || 'व्याज तरतूद करताना त्रुटी आली. कृपया शिल्लक तपासणी करा.');
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
            त्रैमासिक व्याज तरतूद प्रोसेस (RD Interest Accrual Posting)
          </h1>
        </div>
      </div>

      {message && (
        <div className={`text-xs p-2 rounded-sm border ${
          message.includes('यशस्वी') 
            ? 'bg-green-100 border-green-300 text-green-700' 
            : 'bg-red-100 border-red-300 text-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Control Panel */}
      <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200">
        <form onSubmit={handleRunProvision} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>शाखा निवडा (Select Branch)</label>
              <select 
                value={branchID} 
                onChange={(e) => setBranchID(parseInt(e.target.value))} 
                className={inputClass}
              >
                {branches.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>तरतूद तारीख (Accrual Effective Date)</label>
              <input
                type="date"
                value={accrualDate}
                onChange={(e) => setAccrualDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm space-y-2 text-xs text-blue-700">
            <strong>महत्वाचे नियम:</strong>
            <ul className="list-disc list-inside space-y-1 mt-1 opacity-90">
              <li>व्याज तरतूद धावल्यामुळे (Provision Run) आरडी खात्यांवर त्रैमासिक चक्रवाढ व्याज मोजले जाते.</li>
              <li>या प्रोसेसमुळे `Dr व्याज खर्च` आणि `Cr व्याज देणे` अशा दोन दुहेरी नोंदी मुख्य रोजकीर्द (Vouchers) मध्ये स्वयंचलित जोडल्या जातील.</li>
            </ul>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-1.5 bg-primary hover:bg-[#004a75] text-white font-semibold rounded-sm transition duration-200 text-xs shadow-sm"
            >
              {loading ? 'व्याज तरतूद प्रक्रिया चालू आहे...' : 'व्याज तरतूद रन करा (Process Provision)'}
            </button>
          </div>
        </form>
      </div>

      {logDetails && (
        <div className="bg-gray-50 p-3 rounded-sm border border-gray-200 shadow-inner">
          <h3 className="text-xs font-bold text-gray-800 mb-2">सिस्टीम लॉग निकाल (System Execution Log):</h3>
          <pre className="text-xs text-emerald-700 font-mono overflow-x-auto whitespace-pre-wrap">
            {logDetails}
          </pre>
        </div>
      )}
    </div>
  );
}
