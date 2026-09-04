import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  Building,
  RotateCcw
} from 'lucide-react';

interface CompanyBranch {
  branchID: number;
  branchCode: string;
  branchName: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  mobileNo?: string;
  email?: string;
  status: boolean;
}

export default function CompanyBranchMaster() {
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const branchNameInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    branchCode: '',
    branchName: '',
    address: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
    mobileNo: '',
    email: '',
    status: true
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const API_URL = '/api/BranchMaster';

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
      }
    } catch (error) {
      console.error("Error fetching company branches", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleEdit = (branch: CompanyBranch) => {
    setEditingId(branch.branchID);
    setFormData({
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      address: branch.address || '',
      city: branch.city || '',
      district: branch.district || '',
      state: branch.state || '',
      pincode: branch.pincode || '',
      mobileNo: branch.mobileNo || '',
      email: branch.email || '',
      status: branch.status
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
      address: '',
      city: '',
      district: '',
      state: '',
      pincode: '',
      mobileNo: '',
      email: '',
      status: true
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
        setSuccessMsg(editingId ? "कंपनी शाखा यशस्वीरित्या अपडेट केली!" : "कंपनी शाखा यशस्वीरित्या जोडली!");
        fetchBranches();
        handleCancel();
      } else {
        const text = await response.text();
        setErrorMsg(text || "कंपनी शाखा सेव्ह करताना काहीतरी चूक झाली.");
      }
    } catch (error) {
      console.error("Error saving company branch", error);
      setErrorMsg("कंपनी शाखा सेव्ह करताना नेटवर्क एरर आला.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे की तुम्ही ही कंपनी शाखा डिलीट करू इच्छिता?")) {
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccessMsg("कंपनी शाखा यशस्वीरित्या डिलीट केली!");
        fetchBranches();
      } else {
        const text = await response.text();
        setErrorMsg(text || "कंपनी शाखा डिलीट करता आली नाही. ही शाखा वापरली जात असावी.");
      }
    } catch (error) {
      console.error("Error deleting company branch", error);
      setErrorMsg("कंपनी शाखा डिलीट करताना एरर आला.");
    }
  };

  const filteredBranches = branches.filter((b) =>
    b.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.branchCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.city && b.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (b.district && b.district.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (b.mobileNo && b.mobileNo.includes(searchTerm))
  );

  const totalBranches = branches.length;
  const activeBranchesCount = branches.filter(b => b.status).length;
  const inactiveBranchesCount = totalBranches - activeBranchesCount;

  return (
    <div className="p-2 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans overflow-y-auto">
      {/* Header Bar */}
      <div className="text-xs font-bold text-primary border-b border-gray-300 pb-1.5 mb-2 flex justify-between items-center bg-white p-2.5 rounded-sm shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 text-primary rounded-sm">
            <Building size={16} />
          </div>
          <div>
            <h1 className="text-xs font-bold text-primary tracking-tight">कंपनी शाखा व्यवस्थापन (Company Branch Management)</h1>
            <p className="text-[10px] text-gray-500 font-normal">संस्थेच्या सर्व प्रादेशिक व कंपनी शाखांची माहिती व पत्ता नोंदणी</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-2 p-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm text-[11px] font-bold flex justify-between items-center animate-fade-in">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold hover:text-emerald-900 cursor-pointer">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-2 p-2 bg-red-50 text-red-800 border border-red-300 rounded-sm text-[11px] font-bold flex justify-between items-center animate-fade-in">
          <div className="flex items-center gap-1.5">
            <XCircle size={14} className="text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-700 font-bold hover:text-red-900 cursor-pointer">✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase">एकूण कंपनी शाखा (Total)</div>
            <div className="text-sm font-black text-slate-800 mt-0.5">{totalBranches}</div>
          </div>
          <div className="p-2 bg-slate-100 text-slate-700 rounded-sm">
            <Building2 size={18} />
          </div>
        </div>
        <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-emerald-700 uppercase">सक्रिय शाखा (Active)</div>
            <div className="text-sm font-black text-emerald-700 mt-0.5">{activeBranchesCount}</div>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-sm">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-red-600 uppercase">निष्क्रिय शाखा (Inactive)</div>
            <div className="text-sm font-black text-red-600 mt-0.5">{inactiveBranchesCount}</div>
          </div>
          <div className="p-2 bg-red-50 text-red-600 rounded-sm">
            <XCircle size={18} />
          </div>
        </div>
      </div>

      {/* Company Branch Form Card */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3 rounded-sm shadow-2xs border transition-all duration-300 mb-2 ${
          editingId ? 'border-primary ring-2 ring-primary/20 shadow-md bg-blue-50/10' : 'border-gray-200'
        }`}
      >
        <div className="text-[11px] font-bold text-primary border-b border-gray-200 pb-1.5 mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {editingId ? <Edit3 size={14} className="text-primary" /> : <Plus size={14} className="text-primary" />}
            <span>{editingId ? `✏️ कंपनी शाखा माहिती सुधारणा करा (संपादन मोड - आयडी: ${editingId})` : "➕ नवीन कंपनी शाखा जोडा"}</span>
            {editingId && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse ml-2">
                संपादन चालू (Editing)
              </span>
            )}
          </div>
          {editingId && (
            <button 
              type="button" 
              onClick={handleCancel}
              className="text-xs text-gray-500 hover:text-red-600 font-semibold cursor-pointer"
            >
              ✕ संपादन रद्द करा (Cancel)
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-end">
          
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">शाखा कोड (Branch Code) *</label>
            <input 
              type="text" 
              name="branchCode" 
              value={formData.branchCode} 
              onChange={handleChange} 
              required 
              maxLength={20}
              placeholder="उदा. HO01, BR02" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white font-bold uppercase" 
            />
          </div>
          
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">शाखेचे नाव (Branch Name) *</label>
            <input 
              ref={branchNameInputRef}
              type="text" 
              name="branchName" 
              value={formData.branchName} 
              onChange={handleChange} 
              required 
              placeholder="उदा. मुख्य प्रशासकीय कार्यालय" 
              className={`w-full text-xs border rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                editingId ? 'border-primary bg-amber-50/40 font-semibold' : 'border-gray-300 bg-white font-bold text-gray-800'
              }`} 
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">शाखेचा पत्ता (Branch Address)</label>
            <input 
              type="text" 
              name="address" 
              value={formData.address} 
              onChange={handleChange} 
              placeholder="शाखेचा संपूर्ण पत्ता लिहा" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white" 
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">शहर (City)</label>
            <input 
              type="text" 
              name="city" 
              value={formData.city} 
              onChange={handleChange} 
              placeholder="शहर" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white" 
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">जिल्हा (District)</label>
            <input 
              type="text" 
              name="district" 
              value={formData.district} 
              onChange={handleChange} 
              placeholder="जिल्हा" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white" 
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">राज्य (State)</label>
            <input 
              type="text" 
              name="state" 
              value={formData.state} 
              onChange={handleChange} 
              placeholder="महाराष्ट्र" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white" 
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">पिनकोड (Pincode)</label>
            <input 
              type="text" 
              name="pincode" 
              value={formData.pincode} 
              onChange={handleChange} 
              maxLength={6}
              placeholder="416001" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white font-mono" 
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">मोबाईल नंबर (Mobile No)</label>
            <input 
              type="text" 
              name="mobileNo" 
              value={formData.mobileNo} 
              onChange={handleChange} 
              maxLength={15}
              placeholder="उदा. 9876543210" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white" 
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">ई-मेल (Email Address)</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              placeholder="branch@company.com" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white" 
            />
          </div>

          <div className="flex items-center space-x-2 py-1">
            <input 
              type="checkbox" 
              name="status" 
              checked={formData.status} 
              onChange={handleChange} 
              id="companyBranchStatus" 
              className="h-3.5 w-3.5 text-primary border-gray-300 rounded-sm focus:ring-primary cursor-pointer" 
            />
            <label htmlFor="companyBranchStatus" className="text-[11px] font-semibold text-gray-700 cursor-pointer">सक्रिय (Active)</label>
          </div>

          <div className="md:col-span-4 flex space-x-2 justify-end pt-1 border-t border-gray-100 mt-1">
            {editingId && (
              <button 
                type="button" 
                onClick={handleCancel}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-sm text-xs font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <RotateCcw size={12} />
                रद्द करा
              </button>
            )}
            <button 
              type="submit" 
              className="bg-primary hover:bg-[#004a75] text-white px-4 py-1.5 rounded-sm text-xs font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
            >
              {editingId ? <Edit3 size={12} /> : <Plus size={12} />}
              {editingId ? "अपडेट करा" : "जतन करा"}
            </button>
          </div>
        </form>
      </div>

      {/* Company Branch Table Card */}
      <div className="bg-white p-2.5 rounded-sm shadow-2xs border border-gray-200 flex-1 flex flex-col">
        <div className="flex justify-between items-center border-b border-gray-200 pb-1.5 mb-2">
          <div className="text-[11px] font-bold text-primary flex items-center gap-1.5">
            <Building size={14} />
            <span>कंपनी शाखांची यादी (Company Branches List)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 font-medium">शोधा:</span>
            <div className="relative">
              <input
                type="text"
                placeholder="शाखा कोड / नाव / शहर / मोबाईल..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-6 pr-2 py-0.5 text-[11px] border border-gray-300 rounded-sm focus:outline-none focus:border-primary bg-white w-56"
              />
              <Search size={12} className="absolute left-1.5 top-1.5 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-primary text-white font-medium">
                <th className="p-1.5 border border-gray-300 text-left">कोड</th>
                <th className="p-1.5 border border-gray-300 text-left">शाखेचे नाव</th>
                <th className="p-1.5 border border-gray-300 text-left">संपूर्ण पत्ता</th>
                <th className="p-1.5 border border-gray-300 text-left">शहर / जिल्हा</th>
                <th className="p-1.5 border border-gray-300 text-left">संपर्क (मोबाईल / ई-मेल)</th>
                <th className="p-1.5 border border-gray-300 text-center">स्थिती</th>
                <th className="p-1.5 border border-gray-300 text-center">क्रिया (Actions)</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500 italic">कोणत्याही कंपनी शाखा उपलब्ध नाहीत.</td>
                </tr>
              ) : (
                filteredBranches.map((b) => (
                  <tr key={b.branchID} className="border-b border-gray-200 hover:bg-blue-50/50 transition-colors">
                    <td className="p-1.5 border-r border-gray-200 font-bold text-primary uppercase">{b.branchCode}</td>
                    <td className="p-1.5 border-r border-gray-200 font-bold text-gray-800">{b.branchName}</td>
                    <td className="p-1.5 border-r border-gray-200 text-gray-600">{b.address || '-'}</td>
                    <td className="p-1.5 border-r border-gray-200 text-gray-700">
                      {[b.city, b.district, b.state].filter(Boolean).join(', ') || '-'}
                      {b.pincode && <span className="text-[10px] font-mono text-gray-500 block">पिन: {b.pincode}</span>}
                    </td>
                    <td className="p-1.5 border-r border-gray-200 text-gray-700">
                      {b.mobileNo && <div>📞 {b.mobileNo}</div>}
                      {b.email && <div className="text-[10px] text-gray-500">✉️ {b.email}</div>}
                      {!b.mobileNo && !b.email && '-'}
                    </td>
                    <td className="p-1.5 border-r border-gray-200 text-center">
                      <span className={`px-2 py-0.5 rounded-xs text-[9px] font-bold ${
                        b.status ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                      }`}>
                        {b.status ? 'सक्रिय' : 'निष्क्रिय'}
                      </span>
                    </td>
                    <td className="p-1.5 text-center flex justify-center space-x-1.5">
                      <button 
                        onClick={() => handleEdit(b)}
                        className="px-2 py-0.5 bg-blue-50 text-primary hover:bg-blue-100 border border-blue-200 rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 size={11} />
                        संपादन
                      </button>
                      <button 
                        onClick={() => handleDelete(b.branchID)}
                        className="px-2 py-0.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 size={11} />
                        डिलीट
                      </button>
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
