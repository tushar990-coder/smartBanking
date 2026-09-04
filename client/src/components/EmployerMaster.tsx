import React, { useState, useEffect, useRef } from 'react';
import { Building2, Plus, Search, Edit, Trash2, X, Check, Phone, MapPin } from 'lucide-react';

interface Employer {
  id: number;
  name: string;
  contactNo?: string;
  address?: string;
  isActive: boolean;
}

export default function EmployerMaster() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    contactNo: '',
    address: '',
    isActive: true
  });

  useEffect(() => {
    fetchEmployers();
  }, []);

  const fetchEmployers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/Employers');
      if (response.ok) {
        const data = await response.json();
        setEmployers(data);
      }
    } catch (error) {
      console.error("Error fetching employers", error);
    } finally {
      setLoading(false);
    }
  };

  const showModal = (record: Employer | null = null) => {
    if (record) {
      setEditingId(record.id);
      setFormData({
        name: record.name || '',
        contactNo: record.contactNo || '',
        address: record.address || '',
        isActive: record.isActive !== undefined ? record.isActive : true
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        contactNo: '',
        address: '',
        isActive: true
      });
    }
    setIsModalVisible(true);
    setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
        nameInputRef.current.select();
      }
    }, 120);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const onFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/Employers/${editingId}` : '/api/Employers';
      const payload = editingId ? { ...formData, id: editingId } : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setIsModalVisible(false);
        fetchEmployers();
        alert(`संस्था / मालक माहिती यशस्वीरित्या ${editingId ? 'अपडेट' : 'सेव्ह'} झाली!`);
      } else {
        const errorText = await response.text();
        alert(errorText || 'माहिती सेव्ह करण्यात त्रुटी आली.');
      }
    } catch (error) {
      console.error("Error saving employer", error);
      alert('सर्व्हरशी संपर्क साधताना त्रुटी आली.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे का की ही संस्था/मालक माहिती हटवायची आहे?")) return;
    try {
      const response = await fetch(`/api/Employers/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchEmployers();
        alert("संस्था / मालक माहिती यशस्वीरित्या हटवली!");
      } else {
        const errorText = await response.text();
        alert(errorText || "माहिती हटवता आली नाही.");
      }
    } catch (error) {
      console.error("Error deleting employer", error);
    }
  };

  const filteredEmployers = employers.filter(emp => {
    const q = searchQuery.toLowerCase();
    const nameMatch = emp.name.toLowerCase().includes(q);
    const contactMatch = emp.contactNo ? emp.contactNo.includes(q) : false;
    const addressMatch = emp.address ? emp.address.toLowerCase().includes(q) : false;
    return nameMatch || contactMatch || addressMatch;
  });

  return (
    <div className="p-2 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-6">
      {/* Top Header Action Bar */}
      <div className="mb-3 flex flex-wrap justify-between items-center bg-white p-2.5 rounded-md shadow-xs border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary p-2 rounded-md">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800 leading-tight">Employer Master (संस्था / मालक माहिती)</h1>
            <p className="text-[11px] text-gray-500">सभासदांच्या नोकरीच्या संस्था व मालकांची यादी व्यवस्थापित करा</p>
          </div>
        </div>

        <button 
          type="button"
          onClick={() => showModal()}
          className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-[#004a75] hover:from-[#004a75] hover:to-[#003452] text-white px-3.5 py-1.5 rounded-md font-semibold text-xs shadow-md transition-all cursor-pointer mt-2 sm:mt-0"
        >
          <Plus className="w-4 h-4" />
          <span>नवीन संस्था / मालक जोडा (Add Employer)</span>
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-md shadow-md border border-gray-200 overflow-hidden">
        {/* Search Toolbar */}
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="नाव, पत्ता किंवा संपर्क नंबरने शोधा..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 pl-9 pr-3 py-1.5 rounded-md bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs shadow-xs"
            />
          </div>

          <div className="text-xs text-gray-500 font-medium self-end sm:self-center">
            एकूण नोंदणीकृत संस्था / मालक: <strong className="text-primary font-bold">{filteredEmployers.length}</strong>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-xs font-semibold">
            लोड होत आहे... (Loading Employers...)
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-center">
              <thead className="bg-slate-100 text-slate-700 border-b border-gray-300 shadow-xs">
                <tr>
                  <th className="px-3 py-2 border-r border-gray-200 font-bold text-left w-14">आयडी</th>
                  <th className="px-3 py-2 border-r border-gray-200 font-bold text-left">संस्था / मालकाचे नाव (Employer Name)</th>
                  <th className="px-3 py-2 border-r border-gray-200 font-bold text-left">पत्ता / ठिकाण (Address)</th>
                  <th className="px-3 py-2 border-r border-gray-200 font-bold text-left">संपर्क क्रमांक (Contact No)</th>
                  <th className="px-3 py-2 border-r border-gray-200 font-bold text-center w-28">स्थिती (Status)</th>
                  <th className="px-3 py-2 font-bold text-center w-36">कृती (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredEmployers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Building2 className="w-8 h-8 text-gray-300" />
                        <p className="font-semibold text-gray-600">कोणतीही संस्था किंवा मालक सापडला नाही.</p>
                        <p className="text-[11px] text-gray-400">वर दिलेल्या 'नवीन संस्था / मालक जोडा' बटणावर क्लिक करून नोंदणी करा.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployers.map((emp) => (
                    <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-3 py-2 border-r border-gray-100 text-left font-semibold text-gray-500">
                        #{emp.id}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-100 text-left font-bold text-gray-800">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
                            {emp.name.charAt(0)}
                          </div>
                          <span>{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 border-r border-gray-100 text-left font-medium text-gray-700">
                        {emp.address ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600 shrink-0" /> {emp.address}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">नाही</span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-100 text-left font-medium text-gray-600">
                        {emp.contactNo ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400 shrink-0" /> {emp.contactNo}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">नाही</span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-gray-100 text-center">
                        <span className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-full ${
                          emp.isActive ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {emp.isActive ? 'सक्रिय (Active)' : 'निष्क्रिय (Inactive)'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => showModal(emp)} 
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="माहिती बदला (Edit)"
                          >
                            <Edit className="w-3 h-3" />
                            <span>बदला</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDelete(emp.id)} 
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            title="माहिती डिलीट करा (Delete)"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>हटवा</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Employer Modal Dialog */}
      {isModalVisible && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-gray-300 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-slate-900 to-primary text-white border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-200" />
                <h3 className="text-xs font-bold tracking-wide">
                  {editingId ? 'संस्था / मालक माहिती संपादित करा (Edit Employer)' : 'नवीन संस्था / मालक नोंदणी (Add Employer)'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={handleCancel}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Modal Form */}
            <form onSubmit={onFinish} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  संस्था / मालकाचे नाव (Employer / Company Name) *
                </label>
                <input 
                  ref={nameInputRef}
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                  placeholder="उदा. महाराष्ट्र शासन / फिनोलेक्स केबल्स / स्वाभिमानी शुगर्स"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  पत्ता / ठिकाण (Address / Location)
                </label>
                <input 
                  type="text" 
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="उदा. स्टेशन रोड, कोल्हापूर / एमआयडीसी, पुणे"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  संपर्क क्रमांक (Contact Number)
                </label>
                <input 
                  type="text" 
                  value={formData.contactNo}
                  onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="उदा. 0231-2654321 किंवा 9876543210"
                />
              </div>

              <div className="pt-1 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="isActive" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  सक्रिय स्थिती (Active Status)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 mt-2">
                <button 
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  रद्द करा (Cancel)
                </button>
                <button 
                  type="submit"
                  className="bg-gradient-to-r from-primary to-[#004a75] hover:from-[#004a75] text-white px-5 py-1.5 rounded text-xs font-bold shadow-md transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingId ? 'अपडेट करा (Update)' : 'सेव्ह करा (Save)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

