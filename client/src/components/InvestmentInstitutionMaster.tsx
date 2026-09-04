import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Building2,
  Building,
  Save,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  RotateCcw,
  Search,
  Landmark,
  FileSpreadsheet,
  X,
  Plus,
  Layers,
  Phone,
  Mail,
  MapPin,
  User
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface InvestmentInstitution {
  institutionID: number;
  branchID: number;
  branchName: string;
  institutionName: string;
  institutionType: string;
  institutionBranchName: string;
  address: string;
  contactPerson: string;
  mobileNumber: string;
  emailID: string;
  isActive: boolean;
}

const InvestmentInstitutionMaster: React.FC = () => {
  const [institutions, setInstitutions] = useState<InvestmentInstitution[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showListModal, setShowListModal] = useState(false);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const institutionNameInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  const [formData, setFormData] = useState({
    branchID: 1,
    institutionName: '',
    institutionType: 'Bank',
    institutionBranchName: '',
    address: '',
    contactPerson: '',
    mobileNumber: '',
    emailID: '',
    isActive: true,
  });

  useEffect(() => {
    fetchInstitutions();
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      setBranches(response.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchInstitutions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/InvestmentInstitutions`);
      const list = (response.data || []).map((i: any) => ({
        ...i,
        institutionID: Number(i.institutionID || i.institutionId || i.InvestmentInstitutionID || i.investmentInstitutionID || 0)
      }));
      setInstitutions(list);
    } catch (err) {
      setError('गुंतवणूक संस्था लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditId(null);
    setFormData({
      branchID: 1,
      institutionName: '',
      institutionType: 'Bank',
      institutionBranchName: '',
      address: '',
      contactPerson: '',
      mobileNumber: '',
      emailID: '',
      isActive: true,
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.institutionName.trim()) {
      setError('कृपया संस्थेचे नाव प्रविष्ट करा.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (isEditMode && editId) {
        await axios.put(`${API_URL}/InvestmentInstitutions/${editId}`, {
          ...formData,
          institutionID: editId,
        });
        setSuccess('गुंतवणूक संस्था माहिती यशस्वीरीत्या अद्ययावत (Updated) झाली!');
      } else {
        await axios.post(`${API_URL}/InvestmentInstitutions`, formData);
        setSuccess('नवीन गुंतवणूक संस्था यशस्वीरीत्या जतन (Saved) झाली!');
      }
      resetForm();
      fetchInstitutions();
    } catch (err: any) {
      setError(typeof err.response?.data === 'string' ? err.response.data : 'संस्था जतन करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (inst: InvestmentInstitution) => {
    setIsEditMode(true);
    setEditId(inst.institutionID);
    setFormData({
      branchID: inst.branchID || 1,
      institutionName: inst.institutionName || '',
      institutionType: inst.institutionType || 'Bank',
      institutionBranchName: inst.institutionBranchName || '',
      address: inst.address || '',
      contactPerson: inst.contactPerson || '',
      mobileNumber: inst.mobileNumber || '',
      emailID: inst.emailID || '',
      isActive: inst.isActive ?? true,
    });
    setError('');
    setSuccess('');
    setShowListModal(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      if (institutionNameInputRef.current) {
        institutionNameInputRef.current.focus();
        institutionNameInputRef.current.select();
      }
    }, 120);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('तुम्हाला खरोखर ही गुंतवणूक संस्था काढून टाकायची आहे का?')) return;
    try {
      await axios.delete(`${API_URL}/InvestmentInstitutions/${id}`);
      setSuccess('गुंतवणूक संस्था यशस्वीरीत्या काढून टाकली!');
      fetchInstitutions();
    } catch (err: any) {
      setError(typeof err.response?.data === 'string' ? err.response.data : 'संस्था काढताना त्रुटी.');
    }
  };

  const handleExportExcel = () => {
    if (institutions.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = institutions.map((i, idx) => ({
      'अ.क्र.': idx + 1,
      'संस्था आयडी': i.institutionID,
      'संस्थेचे नाव': i.institutionName,
      'प्रकार': i.institutionType,
      'शाखा (संस्थेची)': i.institutionBranchName || '-',
      'पत्ता': i.address || '-',
      'संपर्क व्यक्ती': i.contactPerson || '-',
      'मोबाईल नं': i.mobileNumber || '-',
      'ईमेल': i.emailID || '-',
      'स्थिती': i.isActive ? 'सक्रिय' : 'निष्क्रिय'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InvestmentInstitutions');
    XLSX.writeFile(wb, `Investment_Institutions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const institutionTypes = [
    { value: 'Bank', label: 'बँक (Bank / Commercial Bank)' },
    { value: 'Cooperative', label: 'जिल्हा / नागरी सहकारी बँक (Cooperative Bank)' },
    { value: 'Patsanstha', label: 'पतसंस्था (Credit Society)' },
    { value: 'Government', label: 'शासकीय संस्था / बॉण्ड्स (Govt Bonds)' },
    { value: 'MutualFund', label: 'म्युच्युअल फंड (Mutual Fund / Trust)' },
    { value: 'Other', label: 'इतर वित्तीय संस्था (Other Financial Institution)' }
  ];

  const filteredInstitutions = institutions.filter((i) => {
    const q = searchTerm.toLowerCase();
    return (
      (i.institutionName || '').toLowerCase().includes(q) ||
      (i.institutionType || '').toLowerCase().includes(q) ||
      (i.institutionBranchName || '').toLowerCase().includes(q) ||
      (i.contactPerson || '').toLowerCase().includes(q) ||
      (i.mobileNumber || '').toLowerCase().includes(q)
    );
  });

  const activeCount = institutions.filter(i => i.isActive).length;
  const banksCount = institutions.filter(i => i.institutionType === 'Bank' || i.institutionType === 'Cooperative').length;

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Building2 size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>गुंतवणूक संस्था मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Investment Institution Master)</span>
              {isEditMode && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              गुंतवणूक ठेव व शेअर्ससाठी वित्तीय संस्था, जिल्हा बँका व पतसंस्था नोंदणी व व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isEditMode && (
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन संस्था</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchInstitutions();
              setShowListModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व गुंतवणूक संस्था यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेली संस्था यादी पहा ({institutions.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण नोंदणीकृत संस्था</div>
            <div className="text-sm font-black text-gray-900">{institutions.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय संस्था (Active)</div>
            <div className="text-sm font-black text-emerald-800">{activeCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">बँका व सहकारी संस्था</div>
            <div className="text-sm font-black text-indigo-950">{banksCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">लागू शाखा</div>
            <div className="text-sm font-black text-amber-800">{branches.length || 1}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* MAIN SINGLE UNIFIED FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          isEditMode ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Institution Details */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Landmark className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. संस्था प्राथमिक माहिती (Institution Details)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>लागू शाखा (Branch)</label>
                <select 
                  name="branchID" 
                  value={formData.branchID} 
                  onChange={handleChange}
                  className={inputClass}
                >
                  {branches.map((b: any) => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  संस्थेचे नाव <span className="text-red-500">*</span>
                </label>
                <input 
                  ref={institutionNameInputRef}
                  type="text" 
                  name="institutionName" 
                  value={formData.institutionName} 
                  onChange={handleChange} 
                  required
                  className={`${inputClass} ${isEditMode ? 'border-primary bg-amber-50/40 font-semibold' : ''}`}
                  placeholder="उदा. जिल्हा मध्यवर्ती सहकारी बँक / SBI" 
                />
              </div>

              <div>
                <label className={labelClass}>
                  संस्था प्रकार (Institution Type) <span className="text-red-500">*</span>
                </label>
                <select 
                  name="institutionType" 
                  value={formData.institutionType} 
                  onChange={handleChange}
                  className={inputClass}
                >
                  {institutionTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>शाखा नाव (संस्थेची शाखा)</label>
                <input 
                  type="text" 
                  name="institutionBranchName" 
                  value={formData.institutionBranchName} 
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. कोपरगाव मुख्य शाखा" 
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Address */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. पत्ता व संपर्क तपशील (Address & Contact Info)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>पत्ता (Address)</label>
                <input 
                  type="text" 
                  name="address" 
                  value={formData.address} 
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. मेन रोड, कोपरगाव"
                />
              </div>

              <div>
                <label className={labelClass}>संपर्क व्यक्ती (Contact Person)</label>
                <input 
                  type="text" 
                  name="contactPerson" 
                  value={formData.contactPerson} 
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. शाखा व्यवस्थापक"
                />
              </div>

              <div>
                <label className={labelClass}>मोबाईल नंबर (Mobile No)</label>
                <input 
                  type="text" 
                  name="mobileNumber" 
                  value={formData.mobileNumber} 
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. 98xxxxxxxx"
                />
              </div>

              <div>
                <label className={labelClass}>ईमेल आयडी (Email ID)</label>
                <input 
                  type="email" 
                  name="emailID" 
                  value={formData.emailID} 
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. manager@bank.com"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Status & Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <span>सक्रिय संस्था म्हणून ठेवा (Is Active)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs transition-all flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>रद्द करा (Reset)</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'जतन होत आहे...' : isEditMode ? 'संस्था अद्ययावत करा (Update)' : 'संस्था जतन करा (Save Institution)'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: REGISTERED INSTITUTIONS LIST                                */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेली गुंतवणूक संस्था यादी (Registered Institutions List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredInstitutions.length} संस्था
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input 
                  type="text" 
                  placeholder="संस्थेचे नाव, प्रकार किंवा शाखेने शोधा..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-64 lg:w-80 focus:outline-none focus:border-primary bg-white shadow-2xs"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={institutions.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="एक्सेल फाइल डाउनलोड करा"
              >
                <FileSpreadsheet size={13} />
                <span>एक्सेल एक्सपोर्ट (.xlsx)</span>
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-10">अ.क्र.</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left w-20">संस्था आयडी</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left">संस्थेचे नाव</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left w-32">प्रकार</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left w-32">शाखा (संस्थेची)</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left w-32">संपर्क व्यक्ती</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left w-28">मोबाईल</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-center w-20">स्थिती</th>
                      <th className="px-3 py-1.5 text-center w-24">कृती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-gray-500 font-bold">
                          डेटा लोड होत आहे...
                        </td>
                      </tr>
                    ) : filteredInstitutions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतीही संस्था सापडली नाही.
                        </td>
                      </tr>
                    ) : (
                      filteredInstitutions.map((inst, idx) => (
                        <tr key={inst.institutionID || idx} className="hover:bg-primary/5 transition-colors">
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 font-mono font-bold text-primary">#{inst.institutionID}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 font-bold text-gray-900">{inst.institutionName}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {inst.institutionType}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-gray-700">{inst.institutionBranchName || '-'}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-gray-700">{inst.contactPerson || '-'}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 font-mono text-gray-700">{inst.mobileNumber || '-'}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              inst.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                            }`}>
                              {inst.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-center space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleEdit(inst)}
                              className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[10px] font-bold border border-amber-300 cursor-pointer"
                              title="संपादन करा"
                            >
                              ✏️ संपादन
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(inst.institutionID)}
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-[10px] font-bold border border-rose-300 cursor-pointer"
                              title="हटवा"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-between items-center text-xs shrink-0">
              <span className="text-gray-500 font-medium">
                टीप: येथे सेव्ह केलेली संस्था थेट 'गुंतवणूक योजना मास्टर' व 'गुंतवणूक खाते उघडणे' मध्ये उपलब्ध होते.
              </span>
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default InvestmentInstitutionMaster;
