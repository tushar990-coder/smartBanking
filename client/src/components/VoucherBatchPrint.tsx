import React, { useState, useEffect } from 'react';
import { VoucherPrintTemplate } from './VoucherPrint';

export default function VoucherBatchPrint() {
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherType, setVoucherType] = useState('All');
  
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [sanstha, setSanstha] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    // Fetch Sanstha once
    const fetchSanstha = async () => {
      try {
        const res = await fetch('/api/SansthaDetails');
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) setSanstha(data[0]);
        }
      } catch (err) {
        console.error('Failed to load sanstha details', err);
      }
    };
    fetchSanstha();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/Vouchers/batch?startDate=${startDate}&endDate=${endDate}&type=${voucherType}`);
      if (res.ok) {
        const data = await res.json();
        setVouchers(data);
      } else {
        alert('Failed to fetch vouchers');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend');
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-1 max-w-6xl mx-auto bg-gray-50 min-h-screen font-sans print:p-0 print:bg-white">
      <style>
        {`
          @media print {
            @page { size: portrait; margin: 10mm; }
            body { background-color: white; font-family: sans-serif; font-size: 11pt; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .print-container > div:nth-child(even) { page-break-after: always; }
          }
          @media screen {
            .print-container { display: flex; flex-direction: column; gap: 20px; }
          }
        `}
      </style>

      {/* Filter Section (Hidden on Print) */}
      <div className="flex justify-between items-end mb-2 print:hidden no-print border-b-2 border-primary pb-1">
        <h1 className="text-lg font-bold text-gray-800">व्हाउचर प्रिंटिंग (Voucher Batch Print)</h1>
      </div>

      <div className="bg-white p-2 rounded-sm shadow-sm mb-3 border border-gray-200 no-print">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">प्रारंभ तारीख (Start Date)</label>
            <input 
              type="date" 
              className="w-full border border-gray-300 rounded-sm px-2 py-0.5 focus:outline-none focus:border-primary text-xs"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">अंतिम तारीख (End Date)</label>
            <input 
              type="date" 
              className="w-full border border-gray-300 rounded-sm px-2 py-0.5 focus:outline-none focus:border-primary text-xs"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="w-48">
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">व्हाउचर प्रकार (Voucher Type)</label>
            <select 
              className="w-full border border-gray-300 rounded-sm px-2 py-0.5 focus:outline-none focus:border-primary text-xs"
              value={voucherType}
              onChange={(e) => setVoucherType(e.target.value)}
            >
              <option value="All">सर्व (All)</option>
              <option value="Receipt">जमा पावती (Receipt)</option>
              <option value="Payment">नावे पावती (Payment)</option>
              <option value="Contra">कॉन्ट्रा (Contra)</option>
              <option value="Journal">जर्नल (Journal)</option>
            </select>
          </div>
          <div className="flex-1 flex gap-2">
            <button 
              onClick={fetchVouchers}
              className="bg-primary hover:bg-[#004a75] text-white px-3 py-1 rounded-sm shadow-sm font-medium disabled:opacity-50 text-xs transition-colors"
              disabled={loading}
            >
              {loading ? 'लोड होत आहे...' : 'शोधा (Search)'}
            </button>
            
            {vouchers.length > 0 && (
              <button 
                onClick={handlePrint}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-sm shadow-sm font-medium text-xs transition-colors"
              >
                प्रिंट करा (Print All)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="no-print mb-2">
        {fetched && vouchers.length === 0 && (
          <div className="text-center text-gray-500 py-4 bg-white rounded-sm shadow-sm border border-gray-200 text-xs">
            कोणतेही व्हाउचर सापडले नाही. (No vouchers found for selected filters)
          </div>
        )}
        {fetched && vouchers.length > 0 && (
          <div className="text-gray-700 font-semibold px-2 text-xs">
            एकूण {vouchers.length} पावत्या सापडल्या. (Found {vouchers.length} vouchers)
          </div>
        )}
      </div>

      {/* Print Templates Container */}
      <div className="print-container">
        {vouchers.map((voucher, idx) => (
          <VoucherPrintTemplate key={voucher.voucherID || idx} voucher={voucher} sanstha={sanstha} />
        ))}
      </div>

    </div>
  );
}
