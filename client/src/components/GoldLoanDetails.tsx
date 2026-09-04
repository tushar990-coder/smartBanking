import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';

interface GoldLoanDetail {
  goldLoanDetailID: number;
  loanAccountID: number;
  ornamentName: string;
  quantity: number;
  grossWeight: number;
  netWeight: number;
  purity: number;
  goldRatePerGram: number;
  estimatedValue: number;
  imagePath: string | null;
}

export default function GoldLoanDetails() {
  const [loanAccounts, setLoanAccounts] = useState<any[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [goldDetails, setGoldDetails] = useState<GoldLoanDetail[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    goldLoanDetailID: 0,
    ornamentName: '',
    quantity: '1',
    grossWeight: '',
    netWeight: '',
    purity: '22',
    goldRatePerGram: '',
    estimatedValue: ''
  });

  const API_GOLD = '/api/GoldLoanDetails';
  const API_LOANS = '/api/LoanAccounts';

  useEffect(() => {
    fetchLoans();
  }, []);

  useEffect(() => {
    if (selectedLoanId) {
      fetchGoldDetails();
    } else {
      setGoldDetails([]);
    }
  }, [selectedLoanId]);

  const fetchLoans = async () => {
    try {
      const res = await fetch(API_LOANS);
      if (res.ok) {
        const data = await res.json();
        // Only show Active gold loans or all active loans
        setLoanAccounts(data.filter((l: any) => l.status === 'Active'));
      }
    } catch (error) {
      console.error('Error fetching loans', error);
    }
  };

  const fetchGoldDetails = async () => {
    if (!selectedLoanId) return;
    try {
      const res = await fetch(`${API_GOLD}/ByLoanAccount/${selectedLoanId}`);
      if (res.ok) {
        setGoldDetails(await res.json());
      }
    } catch (error) {
      console.error('Error fetching gold details', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Auto calculate estimated value
      if (name === 'netWeight' || name === 'goldRatePerGram') {
        const wt = parseFloat(name === 'netWeight' ? value : prev.netWeight) || 0;
        const rt = parseFloat(name === 'goldRatePerGram' ? value : prev.goldRatePerGram) || 0;
        newData.estimatedValue = (wt * rt).toFixed(2);
      }
      
      return newData;
    });
  };

  const handleNew = () => {
    setFormData({
      goldLoanDetailID: 0,
      ornamentName: '',
      quantity: '1',
      grossWeight: '',
      netWeight: '',
      purity: '22',
      goldRatePerGram: '',
      estimatedValue: ''
    });
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) {
      alert("कृपया कर्ज खाते निवडा!");
      return;
    }

    try {
      const payload = {
        goldLoanDetailID: formData.goldLoanDetailID,
        loanAccountID: parseInt(selectedLoanId),
        ornamentName: formData.ornamentName,
        quantity: parseInt(formData.quantity || '1'),
        grossWeight: parseFloat(formData.grossWeight || '0'),
        netWeight: parseFloat(formData.netWeight || '0'),
        purity: parseFloat(formData.purity || '22'),
        goldRatePerGram: parseFloat(formData.goldRatePerGram || '0'),
        estimatedValue: parseFloat(formData.estimatedValue || '0')
      };

      const url = isEditing ? `${API_GOLD}/${formData.goldLoanDetailID}` : API_GOLD;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fetchGoldDetails();
        handleNew();
      }
    } catch (error) {
      console.error("Error saving gold details", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("तुम्हाला हा दागिना नक्की डिलीट करायचा आहे का?")) {
      try {
        await fetch(`${API_GOLD}/${id}`, { method: 'DELETE' });
        fetchGoldDetails();
      } catch (error) {
        console.error("Error deleting", error);
      }
    }
  };

  const loanOptions = loanAccounts.map(l => ({
    value: l.loanAccountID.toString(),
    label: `${l.loanAccountNo} - ${l.member?.firstName} ${l.member?.lastName}`
  }));

  const inputClass = "w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs";
  const labelClass = "block text-xs font-semibold text-gray-700 mb-0.5";

  const totalEstimatedValue = goldDetails.reduce((sum, item) => sum + item.estimatedValue, 0);
  const totalNetWeight = goldDetails.reduce((sum, item) => sum + item.netWeight, 0);

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Standard ERP Header Banner */}
      <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div>
          <h1 className="text-sm font-bold tracking-wide">सुवर्ण कर्ज तारण (Gold Loan Details)</h1>
          <p className="text-[10px] text-blue-100 font-normal">दागिने वजन, शुद्धता (Karat), प्रति ग्रॅम दर व तारण मूल्य नोंदणी</p>
        </div>
      </div>

      {/* Loan Selection */}
      <div className="bg-white p-1.5 rounded-sm shadow-sm border border-gray-200 mb-3 flex items-end space-x-4">
        <div className="flex-1 max-w-md">
          <label className={labelClass}>कर्ज खाते निवडा (Select Loan Account)</label>
          <SearchableSelect 
            name="selectedLoanId" 
            value={selectedLoanId} 
            onChange={(e: any) => setSelectedLoanId(e.target.value)} 
            options={loanOptions} 
          />
        </div>
      </div>

      {selectedLoanId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Form */}
          <div className="md:col-span-1 bg-white p-1.5 rounded-sm shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-primary mb-1 border-b pb-0.5">दागिन्याची माहिती भरा</h2>
            <form onSubmit={handleSubmit} className="space-y-1.5">
              <div>
                <label className={labelClass}>दागिन्याचे नाव (Ornament)</label>
                <input type="text" name="ornamentName" value={formData.ornamentName} onChange={handleChange} className={inputClass} placeholder="उदा. अंगठी, मंगळसूत्र" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>नग (Qty)</label>
                  <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>शुद्धता (Karat)</label>
                  <input type="number" step="0.01" name="purity" value={formData.purity} onChange={handleChange} className={inputClass} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Gross Wt (ग्रॅम)</label>
                  <input type="number" step="0.001" name="grossWeight" value={formData.grossWeight} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Net Wt (निव्वळ ग्रॅम)</label>
                  <input type="number" step="0.001" name="netWeight" value={formData.netWeight} onChange={handleChange} className={inputClass} required />
                </div>
              </div>
              <div>
                <label className={labelClass}>प्रति ग्रॅम दर (Rate/gm)</label>
                <input type="number" step="0.01" name="goldRatePerGram" value={formData.goldRatePerGram} onChange={handleChange} className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}>एकूण किंमत (Value)</label>
                <input type="number" step="0.01" name="estimatedValue" value={formData.estimatedValue} onChange={handleChange} className={`${inputClass} bg-gray-100 font-bold`} readOnly />
              </div>

              <div className="flex space-x-2 pt-1 border-t border-gray-100 mt-1.5">
                <button type="button" onClick={handleNew} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-1 rounded-sm font-medium text-xs shadow-sm">नवीन</button>
                <button type="submit" className="flex-1 bg-primary hover:bg-[#004a75] text-white py-1 rounded-sm font-medium text-xs shadow-sm">
                  {isEditing ? 'बदला' : 'सेव्ह करा'}
                </button>
              </div>
            </form>
          </div>

          {/* Grid */}
          <div className="md:col-span-2 bg-white p-1.5 rounded-sm shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-800 mb-1 border-b pb-0.5">तारण ठेवलेले दागिने</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-1.5 border">नाव</th>
                    <th className="p-1.5 border">नग</th>
                    <th className="p-1.5 border">Gross Wt</th>
                    <th className="p-1.5 border">Net Wt</th>
                    <th className="p-1.5 border">Karat</th>
                    <th className="p-1.5 border">Rate</th>
                    <th className="p-1.5 border font-bold">Value</th>
                    <th className="p-1.5 border text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-gray-800">
                  {goldDetails.map(g => (
                    <tr key={g.goldLoanDetailID} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-1.5 border font-medium text-gray-900">{g.ornamentName}</td>
                      <td className="p-1.5 border">{g.quantity}</td>
                      <td className="p-1.5 border">{g.grossWeight.toFixed(3)}</td>
                      <td className="p-1.5 border">{g.netWeight.toFixed(3)}</td>
                      <td className="p-1.5 border">{g.purity}</td>
                      <td className="p-1.5 border">₹{g.goldRatePerGram.toFixed(2)}</td>
                      <td className="p-1.5 border font-bold text-green-700">₹{g.estimatedValue.toFixed(2)}</td>
                      <td className="p-1.5 border text-center">
                        <button onClick={() => handleDelete(g.goldLoanDetailID)} className="text-red-600 hover:text-red-900 mx-1" title="Delete">X</button>
                      </td>
                    </tr>
                  ))}
                  {goldDetails.length === 0 && (
                    <tr><td colSpan={8} className="border px-2 py-4 text-gray-500">कोणतेही दागिने नाहीत.</td></tr>
                  )}
                </tbody>
                {goldDetails.length > 0 && (
                  <tfoot className="bg-gray-100 font-bold border-t border-gray-300 text-xs">
                    <tr>
                      <td colSpan={3} className="p-1.5 border text-right">एकूण (Total):</td>
                      <td className="p-1.5 border text-blue-700">{totalNetWeight.toFixed(3)}g</td>
                      <td colSpan={2} className="p-1.5 border"></td>
                      <td className="p-1.5 border text-green-800">₹{totalEstimatedValue.toFixed(2)}</td>
                      <td className="p-1.5 border"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
