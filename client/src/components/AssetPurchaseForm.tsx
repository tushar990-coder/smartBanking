import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Category {
  categoryID: number;
  categoryName: string;
  categoryCode: string;
}

interface Ledger {
  ledgerID: number;
  ledgerName: string;
}

const AssetPurchaseForm: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = '/api';

  const [formData, setFormData] = useState({
    purchase: {
      institutionID: 1,
      branchID: 1,
      financialYearID: 1,
      supplierName: '',
      invoiceNo: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      taxableAmount: 0,
      gstAmount: 0,
      totalAmount: 0,
      paymentMode: 'Bank',
      bankLedgerID: 0,
    },
    categoryID: 0,
    quantity: 1,
    assetCodePrefix: '',
    assetName: '',
    postVoucher: true,
    debitLedgerID: 0,
    creditLedgerID: 0,
  });

  useEffect(() => {
    fetchCategories();
    fetchBranches();
    fetchLedgers();
  }, []);

  const fetchBranches = async () => {
    try { setBranches((await axios.get(`${API_URL}/Branches`)).data); } catch {}
  };

  const fetchCategories = async () => {
    try { setCategories((await axios.get(`${API_URL}/AssetCategories`)).data); } catch {}
  };

  const fetchLedgers = async () => {
    try { setLedgers((await axios.get(`${API_URL}/Ledgers`)).data); } catch {}
  };

  const handlePurchaseChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updatedPurchase = {
        ...prev.purchase,
        [name]: name === 'branchID' || name === 'bankLedgerID' ? parseInt(value) : name === 'taxableAmount' || name === 'gstAmount' ? parseFloat(value) : value,
      };

      // Auto calculate total amount
      if (name === 'taxableAmount' || name === 'gstAmount') {
        updatedPurchase.totalAmount = (updatedPurchase.taxableAmount || 0) + (updatedPurchase.gstAmount || 0);
      }

      return {
        ...prev,
        purchase: updatedPurchase,
      };
    });
  };

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'categoryID' || name === 'quantity' || name === 'debitLedgerID' || name === 'creditLedgerID' ? parseInt(value) : value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Pre-fill asset details and prefix when category changes
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catId = parseInt(e.target.value);
    const cat = categories.find((c) => c.categoryID === catId);
    
    setFormData((prev) => ({
      ...prev,
      categoryID: catId,
      assetCodePrefix: cat ? cat.categoryCode : '',
      assetName: cat ? cat.categoryName : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validations
    if (!formData.categoryID || formData.categoryID === 0) {
      setError('कृपया मालमत्ता वर्ग निवडा. (Please select category.)');
      return;
    }
    if (formData.quantity <= 0) {
      setError('कृपया प्रमाण १ किंवा अधिक टाका. (Quantity must be greater than 0.)');
      return;
    }
    if (formData.postVoucher) {
      if (!formData.debitLedgerID) {
        setError('कृपया मालमत्ता खर्च खाते (Debit Ledger) निवडा.');
        return;
      }
      if (formData.purchase.paymentMode === 'Bank' && !formData.purchase.bankLedgerID) {
        setError('कृपया बँक खाते (Bank Ledger) निवडा.');
        return;
      }
      if (formData.purchase.paymentMode === 'Credit' && !formData.creditLedgerID) {
        setError('कृपया उधार देय खाते (Supplier/Credit Ledger) निवडा.');
        return;
      }
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/AssetPurchases`, {
        ...formData,
        purchase: {
          ...formData.purchase,
          bankLedgerID: formData.purchase.paymentMode === 'Bank' ? formData.purchase.bankLedgerID : null,
        },
      });
      setSuccess('मालमत्ता खरेदी यशस्वीरित्या जतन झाली आणि मालमत्ता तयार झाल्या! (Asset purchase recorded and assets created successfully!)');
      // Reset form
      setFormData({
        purchase: {
          institutionID: 1,
          branchID: 1,
          financialYearID: 1,
          supplierName: '',
          invoiceNo: '',
          invoiceDate: new Date().toISOString().split('T')[0],
          taxableAmount: 0,
          gstAmount: 0,
          totalAmount: 0,
          paymentMode: 'Bank',
          bankLedgerID: 0,
        },
        categoryID: 0,
        quantity: 1,
        assetCodePrefix: '',
        assetName: '',
        postVoucher: true,
        debitLedgerID: 0,
        creditLedgerID: 0,
      });
    } catch (err: any) {
      setError(err.response?.data || 'जतन करताना त्रुटी आली. (Error recording purchase.)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 max-w-4xl mx-auto">
      <div className="bg-white rounded shadow-sm border border-gray-200">
        <div className="bg-primary text-white px-4 py-2 rounded-t flex items-center justify-between">
          <h2 className="text-sm font-bold">🛒 नवीन मालमत्ता खरेदी नोंद (New Asset Purchase Entry)</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-sm text-xs font-semibold">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-sm text-xs font-semibold">{success}</div>}

          {/* Section 1: Invoice Details */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b pb-1">१. खरेदी बिल तपशील (Invoice Details)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शाखा (Branch)</label>
                <select name="branchID" value={formData.purchase.branchID} onChange={handlePurchaseChange}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  {branches.map((b: any) => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">विक्रेत्याचे नाव (Supplier Name) *</label>
                <input type="text" name="supplierName" value={formData.purchase.supplierName} onChange={handlePurchaseChange} required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="उदा. Shivam Electronics Pvt. Ltd." />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">बिल दिनांक (Invoice Date) *</label>
                <input type="date" name="invoiceDate" value={formData.purchase.invoiceDate} onChange={handlePurchaseChange} required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">बिल नंबर (Invoice No) *</label>
                <input type="text" name="invoiceNo" value={formData.purchase.invoiceNo} onChange={handlePurchaseChange} required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="उदा. INV/2026/0045" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">करपात्र रक्कम (Taxable Amt ₹) *</label>
                <input type="number" name="taxableAmount" value={formData.purchase.taxableAmount || ''} onChange={handlePurchaseChange} required min="0" step="0.01"
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">GST रक्कम (GST Amt ₹)</label>
                <input type="number" name="gstAmount" value={formData.purchase.gstAmount || ''} onChange={handlePurchaseChange} min="0" step="0.01"
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">एकूण रक्कम (Total Amount ₹)</label>
                <input type="number" value={formData.purchase.totalAmount.toFixed(2)} readOnly
                  className="w-full border border-gray-200 bg-gray-100 rounded-sm px-2 py-1 text-xs font-bold text-gray-600 cursor-not-allowed" />
              </div>
            </div>
          </div>

          {/* Section 2: Asset Creation */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b pb-1">२. मालमत्ता निर्मिती (Asset Generation Settings)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">मालमत्ता वर्ग (Asset Category) *</label>
                <select value={formData.categoryID} onChange={handleCategoryChange} required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value={0}>-- वर्ग निवडा --</option>
                  {categories.map((c) => <option key={c.categoryID} value={c.categoryID}>{c.categoryName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">मालमत्ता नाव (Asset Name) *</label>
                <input type="text" name="assetName" value={formData.assetName} onChange={handleGeneralChange} required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="उदा. Dell Laptop" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">कोड प्रीफिक्स (Code Prefix) *</label>
                <input type="text" name="assetCodePrefix" value={formData.assetCodePrefix} onChange={handleGeneralChange} required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="उदा. DELL-HQ" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">नगांचे प्रमाण (Quantity) *</label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleGeneralChange} required min="1"
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 text-blue-800 p-2 rounded-sm text-[11px] font-medium">
              💡 हे खरेदी जतन केल्यास सिस्टीम मध्ये एकूण <strong>{formData.quantity}</strong> मालमत्ता तयार होतील 
              ज्यांचे कोड <strong>{formData.assetCodePrefix || 'PREFIX'}-001</strong> पासून 
              ते <strong>{formData.assetCodePrefix || 'PREFIX'}-{(formData.quantity).toString().padStart(3, '0')}</strong> पर्यंत असतील 
              आणि प्रत्येकाची मूळ किंमत ₹<strong>{(formData.purchase.taxableAmount / (formData.quantity || 1)).toFixed(2)}</strong> असेल.
            </div>
          </div>

          {/* Section 3: Voucher Entry Options */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b pb-1">३. हिशोब नोंदणी (Accounting Voucher Setup)</h3>
            
            <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-3">
              <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer text-xs">
                <input type="checkbox" name="postVoucher" checked={formData.postVoucher} onChange={handleCheckboxChange} className="rounded" />
                हिशोब वही मध्ये पेमेंट/जर्नल व्हाउचर पोस्ट करा (Post Accounting Voucher)
              </label>

              {formData.postVoucher && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">पेमेंट पद्धत (Payment Mode) *</label>
                    <select name="paymentMode" value={formData.purchase.paymentMode} onChange={handlePurchaseChange}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="Bank">बँक खाते (Bank Payment)</option>
                      <option value="Cash">रोख रक्कम (Cash Payment)</option>
                      <option value="Credit">उधार खरेदी (Credit / Supplier)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">नावे खाते (Debit Asset Ledger) *</label>
                    <select name="debitLedgerID" value={formData.debitLedgerID} onChange={handleGeneralChange} required
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value={0}>-- मालमत्ता लेजर निवडा --</option>
                      {ledgers.map((l) => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                    </select>
                  </div>
                  {formData.purchase.paymentMode === 'Bank' && (
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">जमा बँक खाते (Credit Bank Ledger) *</label>
                      <select name="bankLedgerID" value={formData.purchase.bankLedgerID} onChange={handlePurchaseChange} required
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value={0}>-- बँक खाते निवडा --</option>
                        {ledgers.map((l) => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                      </select>
                    </div>
                  )}
                  {formData.purchase.paymentMode === 'Credit' && (
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">जमा उधार खाते (Credit Supplier Ledger) *</label>
                      <select name="creditLedgerID" value={formData.creditLedgerID} onChange={handleGeneralChange} required
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value={0}>-- सप्लायर खाते निवडा --</option>
                        {ledgers.map((l) => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-sm text-xs font-semibold shadow-sm"
            >
              {loading ? 'जतन होत आहे...' : '💾 खरेदी नोंदवा (Record Asset Purchase)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssetPurchaseForm;
