import React, { useState, useEffect } from 'react';
import { Wallet, Search, PlusCircle, Save, Trash2, RefreshCw, BookOpen, Layers, ArrowUpRight, ArrowDownLeft, AlertCircle } from 'lucide-react';
import CustomerSearchSelect from './common/CustomerSearchSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountType: string;
}

interface Customer {
  customerID: number;
  cifNo: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNo?: string;
  aadhaarNo?: string;
}

interface CustomerOpeningBalance {
  customerOpeningBalanceID: number;
  customerID: number;
  ledgerID: number;
  amount: number;
  balanceType: string;
  customer?: Customer;
  ledger?: Ledger;
}

export default function CustomerOpeningBalanceForm() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [balances, setBalances] = useState<CustomerOpeningBalance[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [formData, setFormData] = useState({
    ledgerID: '',
    amount: '',
    balanceType: 'Dr'
  });
  
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLedgers();
    fetchCustomers();
    fetchBalances();
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await fetch('/api/Ledgers');
      if (response.ok) {
        const data = await response.json();
        const personalLedgers = data.filter((l: Ledger) => l.accountType === 'Personal Account' || l.accountType === 'Sundry Debtors' || l.accountType === 'Sundry Creditors');
        setLedgers(personalLedgers.length > 0 ? personalLedgers : data);
      }
    } catch (error) {
      console.error("Error fetching ledgers", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/Customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Error fetching customers", error);
    }
  };

  const fetchBalances = async () => {
    try {
      const response = await fetch('/api/CustomerOpeningBalances');
      if (response.ok) {
        const data = await response.json();
        setBalances(data);
      }
    } catch (error) {
      console.error("Error fetching balances", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ledgerID) {
      alert("कृपया लेजर खाते निवडा.");
      return;
    }
    if (!selectedCustomerId) {
      alert("कृपया खातेदार निवडा.");
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert("कृपया योग्य रक्कम भरा.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerID: Number(selectedCustomerId),
        ledgerID: Number(formData.ledgerID),
        amount: parseFloat(formData.amount),
        balanceType: formData.balanceType
      };

      const response = await fetch('/api/CustomerOpeningBalances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("खातेदार आरंभी शिल्लक यशस्वीरित्या सेव्ह केली!");
        setFormData({ ledgerID: '', amount: '', balanceType: 'Dr' });
        setSelectedCustomerId('');
        fetchBalances();
      } else {
        const err = await response.json();
        alert("त्रुटी: " + (err.message || "सेव्ह करता आले नाही."));
      }
    } catch (error) {
      console.error("Error submitting", error);
      alert("सर्व्हर त्रुटी.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे का की ही नोंद डिलीट करायची आहे?")) return;
    try {
      const response = await fetch(`/api/CustomerOpeningBalances/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchBalances();
      }
    } catch (error) {
      console.error("Error deleting", error);
    }
  };

  const filteredBalances = balances.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = `${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.toLowerCase();
    const cif = (b.customer?.cifNo || '').toLowerCase();
    const ledger = (b.ledger?.ledgerName || '').toLowerCase();
    return name.includes(q) || cif.includes(q) || ledger.includes(q);
  });

  const totalDebit = balances.filter(b => b.balanceType === 'Dr').reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const totalCredit = balances.filter(b => b.balanceType === 'Cr').reduce((sum, b) => sum + Number(b.amount || 0), 0);

  return (
    <div className="p-4 bg-gray-50 min-h-screen text-xs">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 text-white p-2 rounded-md">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800">खातेदार आरंभी शिल्लक (Customer Opening Balance)</h1>
            <p className="text-[11px] text-gray-500">खातेदारांच्या वैयक्तिक लेजर खात्यांची आरंभी शिल्लक (नावे / जमा) नोंदणी</p>
          </div>
        </div>

        <div className="flex gap-3 text-xs font-bold">
          <div className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded">
            एकूण नावे (Dr): ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded">
            एकूण जमा (Cr): ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Entry Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3 pb-2 border-b">नवीन आरंभी शिल्लक नोंदवा</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">लेजर खाते (Ledger) *</label>
              <select
                value={formData.ledgerID}
                onChange={e => setFormData(prev => ({ ...prev, ledgerID: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- लेजर निवडा --</option>
                {ledgers.map(l => (
                  <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">खातेदार (Customer / CIF) *</label>
              <CustomerSearchSelect
                customers={customers}
                value={selectedCustomerId}
                onChange={id => setSelectedCustomerId(id)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">रक्कम (Amount) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">प्रकार (Dr / Cr) *</label>
                <select
                  value={formData.balanceType}
                  onChange={e => setFormData(prev => ({ ...prev, balanceType: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white font-bold"
                >
                  <option value="Dr">नावे (Dr - देणे बाकी)</option>
                  <option value="Cr">जमा (Cr - घेणे बाकी)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 transition shadow mt-2"
            >
              {isSubmitting ? "जतन होत आहे..." : "शिल्लक सेव्ह करा (Save Balance)"}
            </button>
          </form>
        </div>

        {/* List Table */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-gray-800">नोंदवलेली खातेदार आरंभी शिल्लक यादी ({balances.length})</h2>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="नाव, CIF किंवा लेजरने शोधा..."
                className="w-full pl-8 pr-2 py-1 border border-gray-300 rounded text-xs"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-700 border-b">
                  <th className="p-2">CIF कोड</th>
                  <th className="p-2">खातेदाराचे नाव</th>
                  <th className="p-2">लेजर खाते</th>
                  <th className="p-2 text-right">रक्कम (₹)</th>
                  <th className="p-2 text-center">प्रकार</th>
                  <th className="p-2 text-center">कृती</th>
                </tr>
              </thead>
              <tbody>
                {filteredBalances.map(b => (
                  <tr key={b.customerOpeningBalanceID} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-bold text-blue-900">{b.customer?.cifNo}</td>
                    <td className="p-2 font-semibold text-gray-800">{b.customer?.firstName} {b.customer?.lastName}</td>
                    <td className="p-2 text-gray-600">{b.ledger?.ledgerName}</td>
                    <td className="p-2 text-right font-bold">
                      ₹{Number(b.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.balanceType === 'Dr' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {b.balanceType}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleDelete(b.customerOpeningBalanceID)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="डिलीट करा"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredBalances.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-400">
                      कोणतीही नोंद सापडली नाही.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
