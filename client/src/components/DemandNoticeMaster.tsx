import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';

export default function DemandNoticeMaster() {
  const [employers, setEmployers] = useState<any[]>([]);
  const [demandNotices, setDemandNotices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    employerId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployers();
    fetchDemandNotices();
  }, []);

  const fetchEmployers = async () => {
    try {
      const response = await fetch('/api/Employers');
      if (response.ok) {
        const data = await response.json();
        setEmployers(data);
      }
    } catch (error) {
      console.error("Error fetching employers", error);
    }
  };

  const fetchDemandNotices = async () => {
    try {
      const response = await fetch('/api/DemandNotices');
      if (response.ok) {
        const data = await response.json();
        setDemandNotices(data);
      }
    } catch (error) {
      console.error("Error fetching demand notices", error);
    }
  };

  const handleEmployerSelect = (e: any) => {
    const val = typeof e === 'object' && e?.target ? e.target.value : e;
    setFormData(prev => ({
      ...prev,
      employerId: String(val || '')
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'year' || name === 'month' ? parseInt(value || '0') : value
    }));
  };

  const generateDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employerId) {
      alert("कृपया संस्था/मालक निवडा (Please select employer)");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        employerId: parseInt(formData.employerId)
      };

      const response = await fetch('/api/DemandNotices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        alert("डिमान्ड नोटीस यशस्वीरित्या तयार झाली (Demand generated successfully)");
        setFormData({
          employerId: '',
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        });
        fetchDemandNotices();
      } else {
        const errText = await response.text();
        alert("त्रुटी (Error): " + errText);
      }
    } catch (error) {
      console.error("Error generating demand", error);
      alert("नेटवर्क त्रुटी (Network error)");
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (monthNumber: number) => {
    if (!monthNumber) return '';
    const date = new Date();
    date.setMonth(monthNumber - 1);
    return date.toLocaleString('mr-IN', { month: 'short' });
  };

  // KPI Metrics
  const totalCount = demandNotices.length;
  const totalAmount = demandNotices.reduce((acc, curr) => acc + (curr.totalDemandAmount || 0), 0);
  
  const pendingNotices = demandNotices.filter(d => d.status !== 'Paid' && d.status !== 'Received');
  const pendingAmount = pendingNotices.reduce((acc, curr) => acc + (curr.totalDemandAmount || 0), 0);
  
  const paidNotices = demandNotices.filter(d => d.status === 'Paid' || d.status === 'Received');
  const paidAmount = paidNotices.reduce((acc, curr) => acc + (curr.totalDemandAmount || 0), 0);

  // Filter demand notices for history table
  const filteredNotices = demandNotices.filter(dn => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const noticeNo = (dn.noticeNumber || '').toLowerCase();
    const empName = (dn.employer?.name || '').toLowerCase();
    const monthYear = `${getMonthName(dn.month)} ${dn.year}`.toLowerCase();
    const statusStr = (dn.status || '').toLowerCase();
    return noticeNo.includes(q) || empName.includes(q) || monthYear.includes(q) || statusStr.includes(q);
  });

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-gray-900";

  return (
    <div className="p-2 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans">
      {/* Top Title Bar */}
      <div className="text-xs font-bold text-primary border-b border-gray-400 pb-1 mb-2 flex justify-between items-center">
        <span>मासिक डिमान्ड (Monthly Demand Notice)</span>
        <span className="text-[10px] text-gray-500 font-normal">एकूण नोटीस: {totalCount}</span>
      </div>
      
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-500 font-medium">एकूण तयार डिमान्ड ({totalCount})</div>
            <div className="text-sm font-bold text-gray-800">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <span className="text-lg opacity-60">📄</span>
        </div>
        <div className="bg-white p-2 rounded-sm border border-amber-200 bg-amber-50/40 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-amber-700 font-medium">प्रलंबित डिमान्ड ({pendingNotices.length})</div>
            <div className="text-sm font-bold text-amber-800">₹{pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <span className="text-lg text-amber-600">⏳</span>
        </div>
        <div className="bg-white p-2 rounded-sm border border-emerald-200 bg-emerald-50/40 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-emerald-700 font-medium">वसूल झालेल्या डिमान्ड ({paidNotices.length})</div>
            <div className="text-sm font-bold text-emerald-800">₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <span className="text-lg text-emerald-600">🎯</span>
        </div>
      </div>

      {/* Form Card: Generate New Demand */}
      <div className="bg-white p-2.5 rounded-sm shadow-sm border border-gray-200 mb-3">
        <div className="text-[11px] font-bold text-primary border-b border-gray-200 pb-1 mb-2">
          १. नवीन डिमान्ड तयार करा (Generate New Demand)
        </div>
        
        <form onSubmit={generateDemand} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className={labelClass}>संस्था / मालक निवडा (Employer) <span className="text-red-500">*</span></label>
            <SearchableSelect
              options={employers.map(emp => ({
                value: emp.id.toString(),
                label: emp.name
              }))}
              value={formData.employerId}
              onChange={handleEmployerSelect}
              placeholder="-- संस्था किंवा मालक शोधा --"
            />
          </div>
          
          <div>
            <label className={labelClass}>महिना (Month) <span className="text-red-500">*</span></label>
            <select 
              name="month" 
              value={formData.month} 
              onChange={handleChange} 
              className={inputClass}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i+1} value={i+1}>{getMonthName(i+1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>वर्ष (Year) <span className="text-red-500">*</span></label>
            <input 
              type="number" 
              name="year" 
              value={formData.year} 
              onChange={handleChange} 
              required 
              className={inputClass}
            />
          </div>

          <div className="md:col-span-4 flex justify-end mt-1">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-primary hover:bg-[#004a75] text-white px-5 py-1.5 rounded-sm font-bold shadow-sm transition-colors text-xs disabled:opacity-50 flex items-center gap-1"
            >
              <span>{loading ? 'प्रक्रिया चालू आहे...' : '⚡ डिमान्ड तयार करा (Generate Demand)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Table Card: Generated Demands */}
      <div className="bg-white p-2.5 rounded-sm shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center border-b border-gray-200 pb-1.5 mb-2">
          <div className="text-[11px] font-bold text-primary">
            २. मागील डिमान्ड इतिहास (Generated Demands)
          </div>
          <input 
            type="text" 
            placeholder="शोध (Search Notice No / Employer / Month)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 border border-gray-300 rounded-sm px-2 py-0.5 text-[11px] focus:outline-none focus:border-primary"
          />
        </div>
        
        <div className="overflow-auto flex-1 border border-gray-200 rounded-sm">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-primary text-white font-medium">
                <th className="px-2 py-1.5 border-r border-blue-400 text-center w-12">अ.क्र.</th>
                <th className="px-2 py-1.5 border-r border-blue-400 text-left">डिमान्ड नोटीस क्र.</th>
                <th className="px-2 py-1.5 border-r border-blue-400 text-left">संस्था / मालक नाव</th>
                <th className="px-2 py-1.5 border-r border-blue-400 text-center">महिना / वर्ष</th>
                <th className="px-2 py-1.5 border-r border-blue-400 text-right">एकूण डिमान्ड रक्कम (₹)</th>
                <th className="px-2 py-1.5 text-center">स्थिती (Status)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredNotices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500 text-xs">
                    अद्याप कोणतीही डिमान्ड तयार केलेली नाही किंवा शोधानुसार डेटा आढळला नाही.
                  </td>
                </tr>
              ) : (
                filteredNotices.map((dn, idx) => (
                  <tr key={dn.demandNoticeId || idx} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-2 py-1 border-r border-gray-200 text-center text-gray-500">{idx + 1}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left font-semibold text-primary">
                      {dn.noticeNumber}
                    </td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left text-gray-800 font-medium">
                      {dn.employer?.name || '-'}
                    </td>
                    <td className="px-2 py-1 border-r border-gray-200 text-center text-gray-700">
                      {getMonthName(dn.month)} {dn.year}
                    </td>
                    <td className="px-2 py-1 border-r border-gray-200 text-right font-bold text-gray-900">
                      ₹{dn.totalDemandAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <span className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm ${
                        dn.status === 'Paid' || dn.status === 'Received' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {dn.status === 'Paid' || dn.status === 'Received' ? '✓ वसूल झाली (Paid)' : '⏳ प्रलंबित (Pending)'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

