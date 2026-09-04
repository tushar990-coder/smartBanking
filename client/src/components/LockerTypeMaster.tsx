import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Shield, 
  Box, 
  DollarSign, 
  Layers,
  RefreshCw,
  PlusCircle,
  List
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountGroup?: { groupName: string };
}

interface LockerType {
  lockerTypeID: number;
  branchID: number;
  typeCode: string;
  typeName: string;
  dimensions: string;
  annualRent: number;
  securityDeposit: number;
  lateFeePerMonth: number;
  gstRate: number;
  depositLiabilityLedgerID?: number | null;
  depositLiabilityLedgerName?: string;
  rentIncomeLedgerID?: number | null;
  rentIncomeLedgerName?: string;
  lateFeeIncomeLedgerID?: number | null;
  lateFeeIncomeLedgerName?: string;
  gstLiabilityLedgerID?: number | null;
  gstLiabilityLedgerName?: string;
  isActive: boolean;
  totalLockersCount?: number;
  availableLockersCount?: number;
}

const LockerTypeMaster: React.FC = () => {
  const [types, setTypes] = useState<LockerType[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const typeNameInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    lockerTypeID: 0,
    branchID: 1,
    typeCode: '',
    typeName: '',
    dimensions: '',
    annualRent: '',
    securityDeposit: '',
    lateFeePerMonth: '',
    gstRate: '0',
    depositLiabilityLedgerID: '',
    rentIncomeLedgerID: '',
    lateFeeIncomeLedgerID: '',
    gstLiabilityLedgerID: '',
    isActive: true
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4500);
  };

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/LockerTypes');
      if (Array.isArray(res.data)) {
        setTypes(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching locker types:', err);
      showMsg(err.response?.data?.message || 'लॉकर प्रकार लोड करताना त्रुटी आली.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgers = async () => {
    try {
      const res = await axios.get('/api/Ledgers');
      if (Array.isArray(res.data)) {
        const sorted = [...res.data].sort((a: Ledger, b: Ledger) => (a.ledgerName || '').localeCompare(b.ledgerName || ''));
        setLedgers(sorted);
      }
    } catch (err) {
      console.error('Error fetching ledgers:', err);
    }
  };

  useEffect(() => {
    fetchTypes();
    fetchLedgers();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string; value: string | number; type?: string } }
  ) => {
    const target = e.target as any;
    const name = target.name;
    if (!name) return;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleReset = () => {
    setFormData({
      lockerTypeID: 0,
      branchID: 1,
      typeCode: '',
      typeName: '',
      dimensions: '',
      annualRent: '',
      securityDeposit: '',
      lateFeePerMonth: '',
      gstRate: '0',
      depositLiabilityLedgerID: '',
      rentIncomeLedgerID: '',
      lateFeeIncomeLedgerID: '',
      gstLiabilityLedgerID: '',
      isActive: true
    });
    setIsEditing(false);
  };

  const handleEdit = (t: LockerType) => {
    setFormData({
      lockerTypeID: t.lockerTypeID,
      branchID: t.branchID || 1,
      typeCode: t.typeCode || '',
      typeName: t.typeName || '',
      dimensions: t.dimensions || '',
      annualRent: t.annualRent !== undefined && t.annualRent !== null ? t.annualRent.toString() : '',
      securityDeposit: t.securityDeposit !== undefined && t.securityDeposit !== null ? t.securityDeposit.toString() : '',
      lateFeePerMonth: t.lateFeePerMonth !== undefined && t.lateFeePerMonth !== null ? t.lateFeePerMonth.toString() : '',
      gstRate: t.gstRate !== undefined && t.gstRate !== null ? t.gstRate.toString() : '0',
      depositLiabilityLedgerID: t.depositLiabilityLedgerID ? t.depositLiabilityLedgerID.toString() : '',
      rentIncomeLedgerID: t.rentIncomeLedgerID ? t.rentIncomeLedgerID.toString() : '',
      lateFeeIncomeLedgerID: t.lateFeeIncomeLedgerID ? t.lateFeeIncomeLedgerID.toString() : '',
      gstLiabilityLedgerID: t.gstLiabilityLedgerID ? t.gstLiabilityLedgerID.toString() : '',
      isActive: t.isActive !== false
    });
    setIsEditing(true);
    
    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (typeNameInputRef.current) {
        typeNameInputRef.current.focus();
        typeNameInputRef.current.select();
      }
    }, 120);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.typeName.trim()) {
      showMsg('कृपया प्रकाराचे नाव टाका.', 'error');
      return;
    }

    const payload = {
      lockerTypeID: formData.lockerTypeID,
      branchID: Number(formData.branchID) || 1,
      typeCode: (formData.typeCode || 'SML').trim(),
      typeName: formData.typeName.trim(),
      dimensions: (formData.dimensions || '').trim(),
      annualRent: parseFloat(String(formData.annualRent)) || 0,
      securityDeposit: parseFloat(String(formData.securityDeposit)) || 0,
      lateFeePerMonth: parseFloat(String(formData.lateFeePerMonth)) || 0,
      gstRate: parseFloat(String(formData.gstRate)) || 0,
      depositLiabilityLedgerID: formData.depositLiabilityLedgerID ? parseInt(String(formData.depositLiabilityLedgerID), 10) : null,
      rentIncomeLedgerID: formData.rentIncomeLedgerID ? parseInt(String(formData.rentIncomeLedgerID), 10) : null,
      lateFeeIncomeLedgerID: formData.lateFeeIncomeLedgerID ? parseInt(String(formData.lateFeeIncomeLedgerID), 10) : null,
      gstLiabilityLedgerID: formData.gstLiabilityLedgerID ? parseInt(String(formData.gstLiabilityLedgerID), 10) : null,
      isActive: formData.isActive
    };

    try {
      if (isEditing) {
        const res = await axios.put(`/api/LockerTypes/${formData.lockerTypeID}`, payload);
        showMsg(res.data?.message || 'लॉकर प्रकार यशस्वीरीत्या अपडेट केला!');
      } else {
        const res = await axios.post('/api/LockerTypes', payload);
        showMsg(res.data?.message || 'नवीन लॉकर प्रकार यशस्वीरीत्या जोडला!');
      }
      handleReset();
      fetchTypes();
    } catch (err: any) {
      console.error(err);
      showMsg(err.response?.data?.message || 'लॉकर प्रकार जतन करताना त्रुटी आली.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('तुम्हाला हा लॉकर प्रकार नक्की डिलीट करायचा आहे का?')) return;

    try {
      const res = await axios.delete(`/api/LockerTypes/${id}`);
      showMsg(res.data?.message || 'लॉकर प्रकार डिलीट केला!');
      if (isEditing && formData.lockerTypeID === id) {
        handleReset();
      }
      fetchTypes();
    } catch (err: any) {
      console.error(err);
      showMsg(err.response?.data?.message || 'डिलीट करता आले नाही.', 'error');
    }
  };

  const ledgerOptions = [
    { value: '', label: '-- खाते निवडा --' },
    ...(ledgers || []).map(l => ({
      value: l.ledgerID.toString(),
      label: `${l.ledgerID} - ${l.ledgerName}${l.accountGroup?.groupName ? ` (${l.accountGroup.groupName})` : ''}`
    }))
  ];

  const labelClass = 'block text-xs font-bold text-gray-700 mb-1';
  const inputClass = 'w-full text-xs border border-gray-300 rounded-sm px-2.5 py-1.5 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150';

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Top ERP Header Banner */}
      <div className="bg-primary px-3.5 py-2.5 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-white/10 rounded border border-white/20">
            <Layers className="w-5 h-5 text-blue-100" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">लॉकर प्रकार व दर मास्टर (Locker Type Master)</h1>
            <p className="text-[10px] text-blue-100 font-normal">
              लॉकरचे प्रकार, परिमाणे, वार्षिक भाडे, अनामत रक्कम व लेजर खाती (GL Mappings) निश्चित करा
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchTypes}
            disabled={loading}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-md border border-white/30 flex items-center gap-1 text-[11px] cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>
          <span className="text-[11px] bg-white/10 text-white px-2.5 py-1.5 rounded font-bold border border-white/20">
            एकूण प्रकार: {types.length}
          </span>
        </div>
      </div>

      {message && (
        <div className={`p-2.5 rounded-md text-xs font-bold flex items-center space-x-2 shadow-xs border ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-red-50 text-red-900 border-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Form Card */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-4 rounded-md shadow-2xs border transition-all duration-300 ${
          isEditing ? 'border-primary ring-2 ring-primary/20 shadow-md bg-blue-50/10' : 'border-gray-300'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              {isEditing ? <Edit2 size={14} className="text-blue-600" /> : <PlusCircle size={14} className="text-emerald-600" />}
              <span>{isEditing ? `लॉकर प्रकार दुरुस्त करा: "${formData.typeName}" (Edit Mode)` : '१. नवीन लॉकर प्रकार फॉर्म (Add Locker Type)'}</span>
            </h2>
            {isEditing && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 font-bold cursor-pointer"
              >
                <X size={14} /> संपादन रद्द करा (Cancel Edit)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <div>
              <label className={labelClass}>प्रकार कोड (Type Code) *</label>
              <input
                type="text"
                name="typeCode"
                value={formData.typeCode}
                onChange={handleChange}
                placeholder="उदा. SML, MED, LRG"
                required
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>प्रकाराचे नाव (Type Name) *</label>
              <input
                ref={typeNameInputRef}
                type="text"
                name="typeName"
                value={formData.typeName}
                onChange={handleChange}
                placeholder="उदा. लहान लॉकर (Small Locker)"
                required
                className={`${inputClass} ${isEditing ? 'border-primary bg-amber-50/40 font-semibold' : ''}`}
              />
            </div>
            <div>
              <label className={labelClass}>आकार / परिमाणे (Dimensions)</label>
              <input
                type="text"
                name="dimensions"
                value={formData.dimensions}
                onChange={handleChange}
                placeholder='उदा. 5" x 7" x 20"'
                className={inputClass}
              />
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2">
            <h3 className="text-[11px] font-bold text-gray-800 flex items-center gap-1">
              <DollarSign size={13} className="text-primary" /> भाडे व अनामत दर नियम (Rent & Deposit Structure)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>वार्षिक भाडे (Annual Rent ₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  name="annualRent"
                  value={formData.annualRent}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>सुरक्षा अनामत (Security Deposit ₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  name="securityDeposit"
                  value={formData.securityDeposit}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>मासिक विलंब शुल्क (Late Fee/Month ₹)</label>
                <input
                  type="number"
                  step="0.01"
                  name="lateFeePerMonth"
                  value={formData.lateFeePerMonth}
                  onChange={handleChange}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>जीएसटी दर (GST %)</label>
                <input
                  type="number"
                  step="0.01"
                  name="gstRate"
                  value={formData.gstRate}
                  onChange={handleChange}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Ledger Mappings */}
          <div className="bg-blue-50/50 p-3 rounded border border-blue-200">
            <h3 className="text-[11px] font-bold text-primary mb-2 flex items-center gap-1">
              <Shield size={13} className="text-primary" /> जनरल लेजर खाती जोडणी (GL Account Mappings)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>अनामत देयता खाते (Deposit Liability)</label>
                <SearchableSelect
                  name="depositLiabilityLedgerID"
                  value={formData.depositLiabilityLedgerID}
                  onChange={handleChange}
                  options={ledgerOptions}
                />
              </div>
              <div>
                <label className={labelClass}>भाडे उत्पन्न खाते (Rent Income)</label>
                <SearchableSelect
                  name="rentIncomeLedgerID"
                  value={formData.rentIncomeLedgerID}
                  onChange={handleChange}
                  options={ledgerOptions}
                />
              </div>
              <div>
                <label className={labelClass}>दंड/विलंब शुल्क खाते (Late Fee Income)</label>
                <SearchableSelect
                  name="lateFeeIncomeLedgerID"
                  value={formData.lateFeeIncomeLedgerID}
                  onChange={handleChange}
                  options={ledgerOptions}
                />
              </div>
              <div>
                <label className={labelClass}>जीएसटी देयता खाते (GST Liability)</label>
                <SearchableSelect
                  name="gstLiabilityLedgerID"
                  value={formData.gstLiabilityLedgerID}
                  onChange={handleChange}
                  options={ledgerOptions}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <span>सक्रिय प्रकार (Active Status)</span>
            </label>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded cursor-pointer flex items-center gap-1"
              >
                <RotateCcw size={13} /> रिसेट
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-primary hover:opacity-90 rounded shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Save size={13} /> {isEditing ? 'बदल जतन करा (Update)' : 'नवीन जतन करा (Save)'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Types Table */}
      <div className="bg-white rounded-md shadow-2xs border border-gray-300 overflow-hidden">
        <div className="p-2.5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
            <Layers size={14} className="text-primary" /> उपलब्ध लॉकर प्रकार यादी (Available Types List)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-800 border-b border-gray-300 font-bold">
                <th className="py-2.5 px-3">कोड</th>
                <th className="py-2.5 px-3">प्रकाराचे नाव</th>
                <th className="py-2.5 px-3">परिमाणे</th>
                <th className="py-2.5 px-3 text-right">वार्षिक भाडे</th>
                <th className="py-2.5 px-3 text-right">अनामत रक्कम</th>
                <th className="py-2.5 px-3 text-right">विलंब शुल्क/महिना</th>
                <th className="py-2.5 px-3 text-center">एकूण लॉकर</th>
                <th className="py-2.5 px-3 text-center">उपलब्ध</th>
                <th className="py-2.5 px-3 text-center">स्थिती</th>
                <th className="py-2.5 px-3 text-center">कृती (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700">
              {types.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400 font-bold">
                    कोणतेही लॉकर प्रकार उपलब्ध नाहीत.
                  </td>
                </tr>
              ) : (
                types.map((t) => (
                  <tr 
                    key={t.lockerTypeID} 
                    className={`transition-colors ${isEditing && formData.lockerTypeID === t.lockerTypeID ? 'bg-blue-50 border-l-4 border-l-primary' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-2 px-3 font-bold text-gray-800">{t.typeCode}</td>
                    <td className="py-2 px-3 font-bold text-gray-900">{t.typeName}</td>
                    <td className="py-2 px-3 text-gray-500 font-mono">{t.dimensions || '-'}</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700 font-mono">₹{t.annualRent?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-bold text-blue-700 font-mono">₹{t.securityDeposit?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right text-gray-600 font-mono">₹{t.lateFeePerMonth?.toFixed(2) || '0.00'}</td>
                    <td className="py-2 px-3 text-center font-bold text-gray-800">{t.totalLockersCount ?? 0}</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-600">{t.availableLockersCount ?? 0}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.isActive ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-gray-100 text-gray-600 border-gray-300'
                      }`}>
                        {t.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleEdit(t)}
                          title="दुरुस्त करा (Edit)"
                          className="px-2 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 rounded flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit2 size={12} />
                          <span>दुरुस्त करा</span>
                        </button>
                        <button
                          onClick={() => handleDelete(t.lockerTypeID)}
                          title="डिलीट करा (Delete)"
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 size={14} />
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
};

export default LockerTypeMaster;
