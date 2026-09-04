import React, { useState, useEffect, useMemo, useRef } from 'react';
import SearchableSelect from './SearchableSelect';

interface AccountGroup {
  groupID?: number;
  groupName?: string;
}

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  ledgerNameEnglish?: string;
  accountType?: string;
  accountGroup?: AccountGroup;
}

interface VoucherMapping {
  mappingID: number;
  transactionType: string;
  debitLedgerID: number | null;
  debitLedger?: Ledger;
  creditLedgerID: number | null;
  creditLedger?: Ledger;
}

const TRANSACTION_TYPES = [
  "Share Capital",
  "Dividend Payable",
  "Dividend Expense",
  "Share Entrance Fee",
  "Share Transfer Fee",
  "Nominal Member Fee",
  "Monthly Subscription (Bhisi)",
  "Loan Disbursement",
  "Loan Recovery - Principal",
  "Loan Recovery - Interest",
  "Penalty / Fine",
  "Bank Interest Received",
  "Expenses"
];

export default function VoucherMappingMaster() {
  const [mappings, setMappings] = useState<VoucherMapping[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const transactionTypeSelectRef = useRef<HTMLSelectElement>(null);

  const [formData, setFormData] = useState({
    transactionType: TRANSACTION_TYPES[0],
    debitLedgerID: 0,
    creditLedgerID: 0
  });

  const API_URL = '/api/VoucherMappings';
  const LEDGER_API = '/api/Ledgers';

  useEffect(() => {
    fetchMappings();
    fetchLedgers();
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setMappings(data);
      }
    } catch (err) {
      console.error('Failed to fetch voucher mappings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await fetch(LEDGER_API);
      if (response.ok) {
        const data = await response.json();
        setLedgers(data);
      }
    } catch (err) {
      console.error('Failed to fetch ledgers:', err);
    }
  };

  const ledgerOptions = useMemo(() => {
    return [
      { value: 0, label: '-- डिफॉल्ट नाही (डायनॅमिक / पर्यायी) --' },
      ...ledgers.map(l => {
        const groupInfo = l.accountGroup?.groupName ? ` [${l.accountGroup.groupName}]` : (l.accountType ? ` [${l.accountType}]` : '');
        const eng = l.ledgerNameEnglish ? ` (${l.ledgerNameEnglish})` : '';
        return {
          value: l.ledgerID,
          label: `${l.ledgerID} - ${l.ledgerName}${eng}${groupInfo}`
        };
      })
    ];
  }, [ledgers]);

  // Check if selected transaction type already has a mapping
  const existingMappingForSelectedType = useMemo(() => {
    return mappings.find(m => m.transactionType === formData.transactionType);
  }, [mappings, formData.transactionType]);

  const handleEdit = (mapping: VoucherMapping) => {
    setIsEditing(true);
    setEditingId(mapping.mappingID);
    setFormData({
      transactionType: mapping.transactionType,
      debitLedgerID: mapping.debitLedgerID || 0,
      creditLedgerID: mapping.creditLedgerID || 0
    });
    setMessage({ text: `✏️ संपादन मोड: '${mapping.transactionType}' मॅपिंग लोड केले आहे.`, type: 'info' });
    
    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (transactionTypeSelectRef.current) {
        transactionTypeSelectRef.current.focus();
      }
    }, 120);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      transactionType: TRANSACTION_TYPES[0],
      debitLedgerID: 0,
      creditLedgerID: 0
    });
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validation: at least one ledger must be chosen
    if (!formData.debitLedgerID && !formData.creditLedgerID) {
      setMessage({ text: '⚠️ कृपया नावे (Debit) किंवा जमा (Credit) पैकी किमान एक खाते तरी निवडा.', type: 'error' });
      return;
    }

    // Duplicate check on create
    if (!isEditing && existingMappingForSelectedType) {
      setMessage({
        text: `⚠️ '${formData.transactionType}' साठी आधीच मॅपिंग अस्तित्वात आहे! कृपया ते संपादित करा.`,
        type: 'error'
      });
      return;
    }

    const payload = {
      mappingID: isEditing && editingId ? editingId : 0,
      transactionType: formData.transactionType,
      debitLedgerID: formData.debitLedgerID > 0 ? formData.debitLedgerID : null,
      creditLedgerID: formData.creditLedgerID > 0 ? formData.creditLedgerID : null
    };

    try {
      setLoading(true);
      const url = isEditing && editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = isEditing && editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchMappings();
        setMessage({
          text: isEditing
            ? `✅ '${formData.transactionType}' मॅपिंग यशस्वीरित्या अद्ययावत (Updated) झाले!`
            : `✅ '${formData.transactionType}' मॅपिंग यशस्वीरित्या सेव्ह (Saved) झाले!`,
          type: 'success'
        });
        handleCancelEdit();
      } else {
        const errText = await response.text();
        setMessage({ text: `त्रुटी आली: ${errText || 'मॅपिंग सेव्ह करता आले नाही.'}`, type: 'error' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ text: 'नेटवर्क किंवा सर्व्हर त्रुटी आली.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (mapping: VoucherMapping) => {
    if (!window.confirm(`तुम्हाला खात्री आहे का की '${mapping.transactionType}' चे मॅपिंग डिलीट करायचे आहे?`)) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/${mapping.mappingID}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchMappings();
        if (editingId === mapping.mappingID) handleCancelEdit();
        setMessage({ text: `🗑️ '${mapping.transactionType}' चे मॅपिंग यशस्वीरित्या हटवले.`, type: 'success' });
      } else {
        setMessage({ text: 'मॅपिंग हटवताना त्रुटी आली.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'नेटवर्क त्रुटी आली.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSyncFromScheme = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/VoucherMappings/AutoConfigure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        await fetchMappings();
        setMessage({ 
          text: `⚡ ${data.message || 'भाग भांडवल योजना व इतर लेजर्सनुसार सर्व व्हाउचर मॅपिंग्ज यशस्वीरित्या अपडेट करण्यात आली.'}`, 
          type: 'success' 
        });
      } else {
        setMessage({ text: 'मॅपिंग सिंक करताना सर्व्हर त्रुटी आली.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'नेटवर्क त्रुटी आली.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-8 text-xs">
      {/* Top Banner Header */}
      <div className="bg-primary text-white p-3 rounded-sm shadow-xs mb-3 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-sm font-bold flex items-center gap-2">
            <span>⚙️</span> व्हाउचर मॅपिंग सेटिंग्ज (Voucher Mapping Master)
          </h1>
          <p className="text-[11px] text-blue-100 mt-0.5 font-normal">
            ऑटोमॅटिक व्यवहारांसाठी डिफॉल्ट नावे (Debit) आणि जमा (Credit) खाती सेट करा. (उदा. शेअर भांडवल, लाभांश, कर्ज वसुली)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoSyncFromScheme}
            disabled={loading}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-sm text-[11px] shadow-xs flex items-center gap-1.5 transition cursor-pointer border border-amber-600"
            title="भाग भांडवल योजना मास्टरमध्ये सेट केलेले लेजर्स व्हाउचर मॅपिंगशी थेट सिंक करा"
          >
            <span>⚡</span>
            <span>योजना मास्टरनुसार सिंक करा (Auto-Sync)</span>
          </button>
          <span className="bg-white/20 px-2.5 py-1.5 rounded-sm text-[11px] font-bold border border-white/30 backdrop-blur-xs">
            एकूण मॅपिंग्ज: {mappings.length}
          </span>
        </div>
      </div>

      {/* Notification Message */}
      {message && (
        <div
          className={`p-2.5 rounded-sm mb-3 border font-semibold flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : message.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-gray-500 hover:text-gray-800 text-xs px-1 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Form Card */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3 rounded-sm shadow-xs border mb-3 transition-all duration-300 ${
          isEditing ? 'border-primary ring-2 ring-primary/20 shadow-md bg-blue-50/10' : 'border-gray-200'
        }`}
      >
        <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-3">
          <div className="font-bold text-gray-800 flex items-center gap-1.5 text-xs">
            <span>{isEditing ? '✏️' : '➕'}</span>
            <span>{isEditing ? `मॅपिंग संपादन (Editing: ${formData.transactionType})` : 'नवीन लेजर मॅपिंग जोडा (Add Voucher Mapping)'}</span>
            {isEditing && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse ml-2">
                संपादन चालू (Editing)
              </span>
            )}
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-2 py-0.5 rounded cursor-pointer transition"
            >
              ✕ संपादन रद्द करा (Cancel)
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Transaction Type */}
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                व्यवहार प्रकार (Transaction Type) *
              </label>
              <select
                ref={transactionTypeSelectRef}
                name="transactionType"
                value={formData.transactionType}
                onChange={(e) => setFormData(prev => ({ ...prev, transactionType: e.target.value }))}
                disabled={isEditing}
                required
                className={`w-full border rounded px-2.5 py-1.5 font-bold focus:outline-none focus:ring-1 focus:ring-primary ${
                  isEditing ? 'border-primary bg-amber-50/40' : 'border-gray-300 bg-white text-gray-900'
                }`}
              >
                {TRANSACTION_TYPES.map(t => (
                  <option key={t} value={t}>
                    {t} {mappings.some(m => m.transactionType === t) ? '✓ (मॅप केलेले)' : ''}
                  </option>
                ))}
              </select>

              {!isEditing && existingMappingForSelectedType && (
                <div className="mt-1 flex items-center justify-between text-[10px] bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1 rounded">
                  <span>या प्रकारासाठी मॅपिंग आधीच उपलब्ध आहे.</span>
                  <button
                    type="button"
                    onClick={() => handleEdit(existingMappingForSelectedType)}
                    className="font-bold underline text-primary cursor-pointer hover:text-blue-900 ml-2"
                  >
                    संपादित करा
                  </button>
                </div>
              )}
            </div>

            {/* Debit Ledger (Dr) */}
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                १. नावे खाते (Debit Ledger - Dr)
              </label>
              <SearchableSelect
                name="debitLedgerID"
                value={formData.debitLedgerID}
                onChange={(e) => {
                  const val = typeof e.target.value === 'number' ? e.target.value : parseInt(String(e.target.value), 10) || 0;
                  setFormData(prev => ({ ...prev, debitLedgerID: val }));
                }}
                options={ledgerOptions}
                placeholder="-- नावे खाते शोधा व निवडा --"
              />
              <p className="text-[10px] text-gray-500 mt-0.5">उदा. रोख/बँक किंवा संबंधित खर्च/मालमत्ता खाते.</p>
            </div>

            {/* Credit Ledger (Cr) */}
            <div>
              <label className="block text-[11px] font-bold text-blue-800 mb-1">
                २. जमा खाते (Credit Ledger - Cr)
              </label>
              <SearchableSelect
                name="creditLedgerID"
                value={formData.creditLedgerID}
                onChange={(e) => {
                  const val = typeof e.target.value === 'number' ? e.target.value : parseInt(String(e.target.value), 10) || 0;
                  setFormData(prev => ({ ...prev, creditLedgerID: val }));
                }}
                options={ledgerOptions}
                placeholder="-- जमा खाते शोधा व निवडा --"
              />
              <p className="text-[10px] text-gray-500 mt-0.5">उदा. भाग भांडवल, उत्पन्न किंवा देयता खाते.</p>
            </div>
          </div>

          <div className="flex justify-end items-center gap-2 pt-2 border-t border-gray-200">
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-1.5 rounded-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold transition text-xs cursor-pointer"
              >
                रद्द करा (Cancel)
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-1.5 rounded-sm font-bold text-white shadow-xs transition text-xs flex items-center gap-1.5 cursor-pointer ${
                isEditing
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-primary hover:bg-[#004a75]'
              }`}
            >
              <span>{isEditing ? '💾' : '➕'}</span>
              <span>{loading ? 'प्रक्रिया सुरू आहे...' : isEditing ? 'अद्ययावत करा (Update Mapping)' : 'मॅपिंग सेव्ह करा (Save Mapping)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Mappings Table */}
      <div className="bg-white rounded-sm shadow-xs overflow-hidden border border-gray-200">
        <div className="bg-gray-100 p-2.5 border-b border-gray-200 font-bold text-gray-800 flex justify-between items-center text-xs">
          <span className="flex items-center gap-1.5">
            <span>📋</span> अस्तित्वातील व्हाउचर मॅपिंग्ज (Configured Voucher Mappings)
          </span>
          <span className="text-[10px] text-gray-500 font-normal">
            (ऑटो-व्हॉउचर जनरेशनसाठी ही खाती वापरली जातात)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 text-gray-700 font-bold">
              <tr>
                <th className="px-3 py-2 text-left border-r border-gray-200 w-12">क्र.</th>
                <th className="px-3 py-2 text-left border-r border-gray-200">व्यवहाराचा प्रकार (Transaction Type)</th>
                <th className="px-3 py-2 text-left border-r border-gray-200">नावे खाते (Debit Ledger - Dr)</th>
                <th className="px-3 py-2 text-left border-r border-gray-200">जमा खाते (Credit Ledger - Cr)</th>
                <th className="px-3 py-2 text-center w-28">कृती (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-medium italic">
                    कोणतेही व्हाउचर मॅपिंग सेट केलेले नाही. वरील फॉर्म वापरून नवीन मॅपिंग तयार करा.
                  </td>
                </tr>
              ) : (
                mappings.map((m, idx) => (
                  <tr key={m.mappingID} className={`hover:bg-blue-50/40 transition-colors ${editingId === m.mappingID ? 'bg-amber-50/60 font-semibold' : ''}`}>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-500 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2 border-r border-gray-200 font-bold text-gray-900">
                      {m.transactionType}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200">
                      {m.debitLedger ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-medium">
                          <span className="font-bold text-[10px] bg-emerald-200 text-emerald-900 px-1 rounded">Dr</span>
                          <span>{m.debitLedger.ledgerID} - {m.debitLedger.ledgerName}</span>
                          {m.debitLedger.accountGroup?.groupName && (
                            <span className="text-[10px] text-emerald-700">[{m.debitLedger.accountGroup.groupName}]</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          डायनॅमिक (Dynamic / Mode-based)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200">
                      {m.creditLedger ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-medium">
                          <span className="font-bold text-[10px] bg-blue-200 text-blue-900 px-1 rounded">Cr</span>
                          <span>{m.creditLedger.ledgerID} - {m.creditLedger.ledgerName}</span>
                          {m.creditLedger.accountGroup?.groupName && (
                            <span className="text-[10px] text-blue-700">[{m.creditLedger.accountGroup.groupName}]</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          डायनॅमिक (Dynamic / Mode-based)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEdit(m)}
                          className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-primary border border-blue-300 rounded font-bold transition text-[10px] cursor-pointer"
                          title="मॅपिंग संपादित करा"
                        >
                          संपादित (Edit)
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded font-bold transition text-[10px] cursor-pointer"
                          title="मॅपिंग हटवा"
                        >
                          बाद (Delete)
                        </button>
                      </div>
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
