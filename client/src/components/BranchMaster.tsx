import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, RefreshCw, CheckCircle2, XCircle, Search, Edit2, 
  Trash2, Plus, RotateCcw, CheckSquare, Layers, Building, Phone, Mail, MapPin
} from 'lucide-react';

interface Branch {
  branchID: number;
  branchCode: string;
  branchName: string;
  branchType: string;
  address?: string;
  ifscCode?: string;
  mobileNo?: string;
  email?: string;
  defaultCashLedgerID?: number;
  defaultCashLedger?: {
    ledgerID: number;
    ledgerCode?: string;
    ledgerName: string;
  };
  isActive: boolean;
}

interface LedgerOption {
  ledgerID: number;
  ledgerCode: string;
  ledgerName: string;
  accountType?: string;
  accountGroup?: { groupName: string };
}

export default function BranchMaster() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cashLedgers, setCashLedgers] = useState<LedgerOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const branchNameInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    branchCode: '',
    branchName: '',
    branchType: 'Branch',
    address: '',
    ifscCode: '',
    mobileNo: '',
    email: '',
    defaultCashLedgerID: '' as number | '',
    isActive: true
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = '/api/Branches';

  useEffect(() => {
    fetchBranches();
    fetchCashLedgers();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setBranches(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching branches", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCashLedgers = async () => {
    try {
      const response = await fetch('/api/Ledgers');
      if (response.ok) {
        const data: LedgerOption[] = await response.json();
        const cashFiltered = data.filter(l => 
          (l.accountType && l.accountType.toLowerCase().includes('cash')) ||
          l.ledgerName.includes('रोख') ||
          l.ledgerName.toLowerCase().includes('cash') ||
          (l.accountGroup && (l.accountGroup.groupName.includes('रोख') || l.accountGroup.groupName.toLowerCase().includes('cash')))
        );
        setCashLedgers(cashFiltered.length > 0 ? cashFiltered : data);
      }
    } catch (error) {
      console.error("Error fetching cash ledgers", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' 
      ? target.checked 
      : (target.name === 'defaultCashLedgerID' ? (target.value === '' ? '' : Number(target.value)) : target.value);
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleEdit = (branch: Branch) => {
    setEditingId(branch.branchID);
    setFormData({
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      branchType: branch.branchType || 'Branch',
      address: branch.address || '',
      ifscCode: branch.ifscCode || '',
      mobileNo: branch.mobileNo || '',
      email: branch.email || '',
      defaultCashLedgerID: branch.defaultCashLedgerID || '',
      isActive: branch.isActive
    });
    setErrorMsg('');
    setSuccessMsg('');

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (branchNameInputRef.current) {
        branchNameInputRef.current.focus();
        branchNameInputRef.current.select();
      }
    }, 120);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      branchCode: '',
      branchName: '',
      branchType: 'Branch',
      address: '',
      ifscCode: '',
      mobileNo: '',
      email: '',
      defaultCashLedgerID: '',
      isActive: true
    });
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? 'PUT' : 'POST';
      
      const payload = editingId ? { branchID: editingId, ...formData } : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSuccessMsg(editingId ? "शाखा यशस्वीरित्या अपडेट केली!" : "शाखा यशस्वीरित्या जोडली!");
        fetchBranches();
        handleCancel();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        let errText = "शाखा सेव्ह करताना काहीतरी चूक झाली.";
        try {
          const text = await response.text();
          if (text) {
            try {
              const json = JSON.parse(text);
              errText = json.message || json.title || (typeof json === 'string' ? json : text);
            } catch {
              errText = text;
            }
          }
        } catch (e) {
          console.error("Error reading error text", e);
        }
        setErrorMsg(errText);
      }
    } catch (error) {
      console.error("Error saving branch", error);
      setErrorMsg("शाखा सेव्ह करताना नेटवर्क एरर आला.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे की तुम्ही ही शाखा डिलीट करू इच्छिता?")) {
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccessMsg("शाखा यशस्वीरित्या डिलीट केली!");
        fetchBranches();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const text = await response.text();
        setErrorMsg(text || "शाखा डिलीट करता आली नाही. ही शाखा वापरली जात असावी.");
      }
    } catch (error) {
      console.error("Error deleting branch", error);
      setErrorMsg("शाखा डिलीट करताना एरर आला.");
    }
  };

  const filteredBranches = branches.filter((b) =>
    (b.branchName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.branchCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.ifscCode && b.ifscCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (b.mobileNo && b.mobileNo.includes(searchTerm))
  );

  const totalBranches = branches.length;
  const headOfficeCount = branches.filter(b => (b.branchType || '').toLowerCase() === 'headoffice').length;
  const activeBranchesCount = branches.filter(b => b.isActive).length;
  const inactiveBranchesCount = totalBranches - activeBranchesCount;

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans pb-8">
      
      {/* 🌟 1. TOP SLEEK CBS HEADER BANNER */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Building2 size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>शाखा व्यवस्थापन मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Branch & Head Office Master)</span>
              {editingId && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editingId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              मुख्य कार्यालय (Head Office) व विविध शाखांची नोंदणी, रोख खाते मॅपिंग, संपर्क व पत्ता व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {editingId && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCancel}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन नोंद (Reset)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          <button
            type="button"
            onClick={fetchBranches}
            disabled={loading}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="डेटा रिफ्रेश करा"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>
        </div>
      </div>

      {/* 📊 2. SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण शाखा</div>
            <div className="text-sm font-black text-gray-900">{totalBranches}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-purple-50 text-purple-700 border border-purple-200 rounded">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">मुख्य कार्यालय (HO)</div>
            <div className="text-sm font-black text-purple-900">{headOfficeCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय शाखा</div>
            <div className="text-sm font-black text-emerald-800">{activeBranchesCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded">
            <XCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">निष्क्रिय शाखा</div>
            <div className="text-sm font-black text-rose-800">{inactiveBranchesCount}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-3 p-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm text-xs font-bold flex justify-between items-center shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-3 p-2 bg-red-50 text-red-800 border border-red-300 rounded-sm text-xs font-bold flex justify-between items-center shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* 📝 3. MAIN BRANCH FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 rounded-sm shadow-xs border transition-all duration-300 mb-3 ${
          editingId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* SECTION 1: शाखा तपशील व माहिती */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">
                  {editingId ? `१. शाखा माहिती सुधारणा (संपादन मोड - आयडी: ${editingId})` : "१. नवीन शाखा नोंदणी व तपशील (Branch Details & Configuration)"}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>शाखा प्रकार (Branch Type) <span className="text-red-500">*</span></label>
                <select
                  name="branchType"
                  value={formData.branchType}
                  onChange={handleChange}
                  required
                  className={`${inputClass} font-bold`}
                >
                  <option value="Branch">🏢 शाखा (Branch)</option>
                  <option value="HeadOffice">👑 मुख्य कार्यालय (Head Office - HO)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>शाखा कोड (Branch Code) <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="branchCode" 
                  value={formData.branchCode} 
                  onChange={handleChange} 
                  required 
                  maxLength={10}
                  placeholder="उदा. HO01, PN02" 
                  className={`${inputClass} uppercase font-bold text-primary`} 
                />
              </div>
              
              <div>
                <label className={labelClass}>शाखेचे नाव (Branch Name) <span className="text-red-500">*</span></label>
                <input 
                  ref={branchNameInputRef}
                  type="text" 
                  name="branchName" 
                  value={formData.branchName} 
                  onChange={handleChange} 
                  required 
                  placeholder="उदा. मुख्य कार्यालय / पडवळवाडी शाखा" 
                  className={`${inputClass} ${editingId ? 'bg-amber-50/60 font-semibold' : ''}`} 
                />
              </div>

              <div className="flex items-center gap-1.5 pt-4">
                <input 
                  type="checkbox" 
                  name="isActive" 
                  checked={formData.isActive} 
                  onChange={handleChange} 
                  id="isActive" 
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer" 
                />
                <label htmlFor="isActive" className="text-[11px] font-bold text-gray-800 cursor-pointer select-none">
                  सक्रिय शाखा (Active Branch)
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 border-t border-gray-100">
              <div>
                <label className={labelClass}>मोबाईल नंबर (Mobile No)</label>
                <input 
                  type="text" 
                  name="mobileNo" 
                  value={formData.mobileNo} 
                  onChange={handleChange} 
                  maxLength={15}
                  placeholder="उदा. 9876543210" 
                  className={inputClass} 
                />
              </div>

              <div>
                <label className={labelClass}>ई-मेल (Email Address)</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  placeholder="branch@bank.com" 
                  className={inputClass} 
                />
              </div>

              <div>
                <label className={labelClass}>IFSC कोड (IFSC Code)</label>
                <input 
                  type="text" 
                  name="ifscCode" 
                  value={formData.ifscCode} 
                  onChange={handleChange} 
                  placeholder="उदा. IFSC0000001" 
                  className={`${inputClass} font-mono uppercase`} 
                />
              </div>

              <div>
                <label className={labelClass}>
                  💰 डिफॉल्ट रोख खाते (Default Cash Ledger)
                </label>
                <select
                  name="defaultCashLedgerID"
                  value={formData.defaultCashLedgerID}
                  onChange={handleChange}
                  className={`${inputClass} font-medium text-gray-800`}
                >
                  <option value="">-- ऑटोमॅटिक / जनरल रोख खाते --</option>
                  {cashLedgers.map((l) => (
                    <option key={l.ledgerID} value={l.ledgerID}>
                      {l.ledgerID} - {l.ledgerName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-1">
              <label className={labelClass}>शाखेचा संपूर्ण पत्ता (Branch Address)</label>
              <input 
                type="text" 
                name="address" 
                value={formData.address} 
                onChange={handleChange} 
                placeholder="शाखेचा संपूर्ण पत्ता लिहा" 
                className={inputClass} 
              />
            </div>
          </div>

          {/* Form Action Footer */}
          <div className="pt-2 flex justify-end items-center gap-2 border-t border-gray-200">
            {editingId && (
              <button 
                type="button" 
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>रद्द करा</span>
              </button>
            )}

            <button 
              type="submit" 
              className={`px-6 py-2 ${
                editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>{editingId ? "✏️ शाखा अपडेट करा" : "💾 नवीन शाखा जतन करा"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 📜 4. REGISTERED BRANCHES TABLE */}
      <div className="bg-white rounded-sm shadow-xs overflow-hidden border border-gray-200 border-t-2 border-primary">
        <div className="bg-slate-50 px-3.5 py-2 border-b border-gray-200 font-bold text-gray-900 flex justify-between items-center text-xs flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-primary">
            <Layers className="w-4 h-4 text-primary" />
            <span>नोंदणीकृत शाखांची यादी (Registered Branches List - {filteredBranches.length})</span>
          </span>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="शाखा कोड, नाव, IFSC किंवा मोबाईल शोधा..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 text-[11px] border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-[28px] w-64"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="p-2 text-center border-r border-gray-200 w-24">प्रकार (Type)</th>
                <th className="p-2 border-r border-gray-200 w-24">शाखा कोड</th>
                <th className="p-2 border-r border-gray-200">शाखेचे नाव</th>
                <th className="p-2 border-r border-gray-200">रोख खाते (Cash Ledger)</th>
                <th className="p-2 border-r border-gray-200">मोबाईल / ईमेल</th>
                <th className="p-2 border-r border-gray-200">पत्ता / IFSC</th>
                <th className="p-2 text-center border-r border-gray-200 w-20">स्थिती</th>
                <th className="p-2 text-center w-28">क्रिया (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-400 italic">
                    कोणत्याही शाखा उपलब्ध नाहीत.
                  </td>
                </tr>
              ) : (
                filteredBranches.map((b) => {
                  const isHo = (b.branchType || '').toLowerCase() === 'headoffice';
                  return (
                    <tr key={b.branchID} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-2 border-r border-gray-200 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isHo ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {isHo ? '👑 Head Office' : '🏢 Branch'}
                        </span>
                      </td>
                      <td className="p-2 border-r border-gray-200 font-bold text-primary font-mono">{b.branchCode}</td>
                      <td className="p-2 border-r border-gray-200 font-bold text-gray-900">{b.branchName}</td>
                      <td className="p-2 border-r border-gray-200 text-emerald-800 font-medium">
                        {b.defaultCashLedger ? (
                          <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] font-semibold">
                            💼 {b.defaultCashLedger.ledgerName}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-[10px]">
                            ⚙️ ऑटोमॅटिक
                          </span>
                        )}
                      </td>
                      <td className="p-2 border-r border-gray-200 text-gray-700">
                        <div>📞 {b.mobileNo || '-'}</div>
                        <div className="text-[10px] text-gray-500">✉️ {b.email || '-'}</div>
                      </td>
                      <td className="p-2 border-r border-gray-200 text-gray-600">
                        <div>{b.address || '-'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">IFSC: {b.ifscCode || '-'}</div>
                      </td>
                      <td className="p-2 border-r border-gray-200 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                        }`}>
                          {b.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => handleEdit(b)}
                            className="px-2 py-0.5 bg-blue-50 text-primary hover:bg-blue-100 border border-blue-200 rounded-sm font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            संपादन
                          </button>
                          {!isHo && b.branchID !== 1 && (
                            <button 
                              onClick={() => handleDelete(b.branchID)}
                              className="px-2 py-0.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-sm font-bold text-[10px] transition-colors cursor-pointer"
                            >
                              डिलीट
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
