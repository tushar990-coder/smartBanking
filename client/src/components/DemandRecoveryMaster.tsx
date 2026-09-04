import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';

export default function DemandRecoveryMaster() {
  const [demandNotices, setDemandNotices] = useState<any[]>([]);
  const [recoveries, setRecoveries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    demandNoticeId: '',
    recoveryDate: new Date().toISOString().split('T')[0],
    totalReceivedAmount: 0,
    remarks: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDemandNotices();
    fetchRecoveries();
  }, []);

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

  const fetchRecoveries = async () => {
    try {
      const response = await fetch('/api/DemandRecoveries');
      if (response.ok) {
        const data = await response.json();
        setRecoveries(data);
      }
    } catch (error) {
      console.error("Error fetching demand recoveries", error);
    }
  };

  const handleDemandNoticeSelect = (e: any) => {
    const val = typeof e === 'object' && e?.target ? e.target.value : e;
    const noticeId = val ? parseInt(String(val)) : '';
    setFormData(prev => {
      const selectedDemand = demandNotices.find(d => d.demandNoticeId === noticeId);
      return {
        ...prev,
        demandNoticeId: noticeId ? noticeId.toString() : '',
        totalReceivedAmount: selectedDemand ? selectedDemand.totalDemandAmount : 0
      };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'totalReceivedAmount' ? parseFloat(value || '0') : value
    }));
  };

  const processRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.demandNoticeId) {
      alert("कृपया प्रलंबित डिमान्ड निवडा (Please select a demand notice)");
      return;
    }

    if (formData.totalReceivedAmount <= 0) {
      alert("कृपया योग्य रक्कम टाका (Please enter a valid amount)");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        demandNoticeId: parseInt(formData.demandNoticeId)
      };

      const response = await fetch('/api/DemandRecoveries/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        alert("वसूल यशस्वीरित्या नोंदवली (Recovery processed successfully)");
        setFormData({
          demandNoticeId: '',
          recoveryDate: new Date().toISOString().split('T')[0],
          totalReceivedAmount: 0,
          remarks: ''
        });
        fetchDemandNotices();
        fetchRecoveries();
      } else {
        const errText = await response.text();
        alert("त्रुटी (Error): " + errText);
      }
    } catch (error) {
      console.error("Error processing recovery", error);
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

  const pendingDemands = demandNotices.filter(d => d.status !== 'Received' && d.status !== 'Paid');
  
  // KPI Metrics
  const totalDemandAmt = demandNotices.reduce((acc, curr) => acc + (curr.totalDemandAmount || 0), 0);
  const pendingDemandAmt = pendingDemands.reduce((acc, curr) => acc + (curr.totalDemandAmount || 0), 0);
  const totalRecoveredAmt = recoveries.reduce((acc, curr) => acc + (curr.totalReceivedAmount || 0), 0);

  // Filter recoveries for history table
  const filteredRecoveries = recoveries.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const noticeNo = (r.demandNotice?.noticeNumber || '').toLowerCase();
    const empName = (r.demandNotice?.employer?.name || '').toLowerCase();
    const remarks = (r.remarks || '').toLowerCase();
    const dateStr = new Date(r.recoveryDate).toLocaleDateString('en-IN').toLowerCase();
    return noticeNo.includes(q) || empName.includes(q) || remarks.includes(q) || dateStr.includes(q);
  });

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-gray-900";

  return (
    <div className="p-2 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans">
      {/* Top Title Bar */}
      <div className="text-xs font-bold text-primary border-b border-gray-400 pb-1 mb-2 flex justify-between items-center">
        <span>डिमान्ड वसुली (Demand Recovery)</span>
        <span className="text-[10px] text-gray-500 font-normal">एकूण प्रलंबित: {pendingDemands.length} डिमान्ड्स</span>
      </div>
      
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-500 font-medium">एकूण डिमान्ड रक्कम</div>
            <div className="text-sm font-bold text-gray-800">₹{totalDemandAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <span className="text-lg opacity-60">📄</span>
        </div>
        <div className="bg-white p-2 rounded-sm border border-amber-200 bg-amber-50/40 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-amber-700 font-medium">प्रलंबित वसुली रक्कम</div>
            <div className="text-sm font-bold text-amber-800">₹{pendingDemandAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <span className="text-lg text-amber-600">⏳</span>
        </div>
        <div className="bg-white p-2 rounded-sm border border-emerald-200 bg-emerald-50/40 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] text-emerald-700 font-medium">एकूण वसूल झालेली रक्कम</div>
            <div className="text-sm font-bold text-emerald-800">₹{totalRecoveredAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <span className="text-lg text-emerald-600">💰</span>
        </div>
      </div>

      {/* Form Card: Process Recovery */}
      <div className="bg-white p-2.5 rounded-sm shadow-sm border border-gray-200 mb-3">
        <div className="text-[11px] font-bold text-primary border-b border-gray-200 pb-1 mb-2">
          १. वसुली नोंदवा (Process Recovery)
        </div>
        
        <form onSubmit={processRecovery} className="space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <label className={labelClass}>प्रलंबित डिमान्ड निवडा (Pending Demand) <span className="text-red-500">*</span></label>
              <SearchableSelect
                options={pendingDemands.map(dn => ({
                  value: dn.demandNoticeId.toString(),
                  label: `${dn.noticeNumber} - ${dn.employer?.name || 'Sanstha'} (${getMonthName(dn.month)} ${dn.year}) - ₹${dn.totalDemandAmount}`
                }))}
                value={formData.demandNoticeId}
                onChange={handleDemandNoticeSelect}
                placeholder="-- डिमान्ड किंवा संस्था शोधा --"
              />
            </div>
            
            <div>
              <label className={labelClass}>वसूल तारीख (Recovery Date) <span className="text-red-500">*</span></label>
              <input 
                type="date" 
                name="recoveryDate" 
                value={formData.recoveryDate} 
                onChange={handleChange} 
                required 
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>मिळालेली एकूण रक्कम (Received Amount) <span className="text-red-500">*</span></label>
              <input 
                type="number" 
                name="totalReceivedAmount" 
                value={formData.totalReceivedAmount} 
                onChange={handleChange} 
                required 
                step="0.01"
                className={`${inputClass} font-bold text-emerald-700`} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-3">
              <label className={labelClass}>शेरा (Remarks / Payment Details)</label>
              <input 
                type="text"
                name="remarks" 
                value={formData.remarks} 
                onChange={handleChange} 
                placeholder="उदा. चेक नंबर / UTR क्र. / बँक तपशील"
                className={inputClass}
              />
            </div>

            <div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary hover:bg-[#004a75] text-white px-4 py-1.5 rounded-sm font-bold shadow-sm transition-colors text-xs disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <span>{loading ? 'प्रक्रिया चालू आहे...' : '✓ वसूल जमा करा (Submit Recovery)'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Table Card: Recovery History */}
      <div className="bg-white p-2.5 rounded-sm shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center border-b border-gray-200 pb-1.5 mb-2">
          <div className="text-[11px] font-bold text-primary">
            २. वसूल इतिहास (Recovery History)
          </div>
          <input 
            type="text" 
            placeholder="शोध (Search Notice No / Employer / Date)..." 
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
                <th className="px-2 py-1.5 border-r border-blue-400 text-left">वसूल तारीख</th>
                <th className="px-2 py-1.5 border-r border-blue-400 text-left">डिमान्ड नोटीस क्र.</th>
                <th className="px-2 py-1.5 border-r border-blue-400 text-left">संस्था / मालक नाव</th>
                <th className="px-2 py-1.5 border-r border-blue-400 text-right">जमा रक्कम (₹)</th>
                <th className="px-2 py-1.5 text-left">शेरा (Remarks)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredRecoveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500 text-xs">
                    अद्याप कोणतीही वसुली नोंदवलेली नाही किंवा शोधानुसार डेटा आढळला नाही.
                  </td>
                </tr>
              ) : (
                filteredRecoveries.map((r, idx) => (
                  <tr key={r.demandRecoveryId || idx} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-2 py-1 border-r border-gray-200 text-center text-gray-500">{idx + 1}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left font-medium text-gray-800">
                      {new Date(r.recoveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left font-semibold text-primary">
                      {r.demandNotice?.noticeNumber || '-'}
                    </td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left text-gray-700">
                      {r.demandNotice?.employer?.name || '-'}
                    </td>
                    <td className="px-2 py-1 border-r border-gray-200 text-right font-bold text-emerald-700">
                      ₹{r.totalReceivedAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="px-2 py-1 text-left text-gray-600 truncate max-w-xs">
                      {r.remarks || '-'}
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
