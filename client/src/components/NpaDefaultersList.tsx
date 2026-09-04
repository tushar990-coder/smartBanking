import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface NpaDefaultersListProps {
  onBack?: () => void;
}

const NpaDefaultersList: React.FC<NpaDefaultersListProps> = ({ onBack }) => {
  const API_URL = '/api/Npa';
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [largeBorrowers, setLargeBorrowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async (date: string) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/defaulters?asOfDate=${date}`);
      setDefaulters(res.data.defaulters || []);
      setLargeBorrowers(res.data.largeStandardBorrowers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

  if (loading && defaulters.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 justify-between items-center">
        <div>
          <button onClick={onBack} className="text-gray-600 hover:text-gray-900 font-semibold text-xs flex items-center gap-1.5 mb-2 focus:outline-none">
            ← मागे (Back)
          </button>
          <h1 className="text-xl font-bold text-gray-800">संचालक मंडळ सभा विशेष अहवाल (Board Meeting Special Lists)</h1>
          <p className="text-xs text-gray-500 mt-1">परिपत्रकानुसार मासिक सभेसाठी पहिले २० थकबाकीदार आणि मोठे कर्जदार अहवाल</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-500">तारीख निवडा (Date):</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 20 Defaulters */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-xs font-bold text-red-600 border-b pb-2 uppercase mb-4">पहिले २० थकबाकीदार (Top 20 Defaulters)</h3>
          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-[11px] font-medium text-gray-600">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-left">
                  <th className="p-3 w-10">अनु.</th>
                  <th className="p-3">खाते क्र. (Acc No)</th>
                  <th className="p-3">नाव (Borrower)</th>
                  <th className="p-3">श्रेणी (Category)</th>
                  <th className="p-3 text-right">रक्कम (₹ Lakh)</th>
                  <th className="p-3 text-center">दिवस (Days)</th>
                </tr>
              </thead>
              <tbody>
                {defaulters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-gray-400 font-bold">थकबाकीदार आढळले नाहीत.</td>
                  </tr>
                ) : (
                  defaulters.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 text-center">{i+1}</td>
                      <td className="p-3 font-bold text-gray-800">{r.loanAccountNo}</td>
                      <td className="p-3">{r.borrowerName}</td>
                      <td className="p-3 font-semibold text-red-700">{r.categoryMarathi}</td>
                      <td className="p-3 text-right font-black text-gray-700">₹ {r.outstandingBalance}</td>
                      <td className="p-3 text-center font-bold text-gray-800 bg-red-50">{r.overdueDays}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 20 Large Standard Borrowers */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-xs font-bold text-green-700 border-b pb-2 uppercase mb-4">पहिले २० मोठे नियमित कर्जदार (Top 20 Large Standard Borrowers)</h3>
          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-[11px] font-medium text-gray-600">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-left">
                  <th className="p-3 w-10">अनु.</th>
                  <th className="p-3">खाते क्र. (Acc No)</th>
                  <th className="p-3">नाव (Borrower)</th>
                  <th className="p-3">श्रेणी (Category)</th>
                  <th className="p-3 text-right">रक्कम (₹ Lakh)</th>
                </tr>
              </thead>
              <tbody>
                {largeBorrowers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-400 font-bold">मोठे कर्जदार आढळले नाहीत.</td>
                  </tr>
                ) : (
                  largeBorrowers.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 text-center">{i+1}</td>
                      <td className="p-3 font-bold text-gray-800">{r.loanAccountNo}</td>
                      <td className="p-3">{r.borrowerName}</td>
                      <td className="p-3 font-semibold text-green-700">{r.categoryMarathi}</td>
                      <td className="p-3 text-right font-black text-gray-700">₹ {r.outstandingBalance}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NpaDefaultersList;
