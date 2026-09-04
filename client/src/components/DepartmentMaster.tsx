import React, { useState, useEffect, useRef } from 'react';

interface Department {
  departmentID: number;
  departmentCode: string;
  departmentName: string;
  description?: string;
  status: boolean;
}

export default function DepartmentMaster() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const departmentNameInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    departmentCode: '',
    departmentName: '',
    description: '',
    status: true
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const API_URL = '/api/DepartmentMaster';

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Error fetching departments", error);
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

  const handleEdit = (dept: Department) => {
    setEditingId(dept.departmentID);
    setFormData({
      departmentCode: dept.departmentCode,
      departmentName: dept.departmentName,
      description: dept.description || '',
      status: dept.status
    });
    setErrorMsg('');
    setSuccessMsg('');

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (departmentNameInputRef.current) {
        departmentNameInputRef.current.focus();
        departmentNameInputRef.current.select();
      }
    }, 120);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      departmentCode: '',
      departmentName: '',
      description: '',
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
      
      const payload = editingId ? { departmentID: editingId, ...formData } : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSuccessMsg(editingId ? "विभाग यशस्वीरित्या अपडेट केला!" : "विभाग यशस्वीरित्या जोडला!");
        fetchDepartments();
        handleCancel();
      } else {
        const text = await response.text();
        setErrorMsg(text || "विभाग सेव्ह करताना काहीतरी चूक झाली.");
      }
    } catch (error) {
      console.error("Error saving department", error);
      setErrorMsg("विभाग सेव्ह करताना नेटवर्क एरर आला.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे की तुम्ही हा विभाग डिलीट करू इच्छिता?")) {
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccessMsg("विभाग यशस्वीरित्या डिलीट केला!");
        fetchDepartments();
      } else {
        const text = await response.text();
        setErrorMsg(text || "विभाग डिलीट करता आला नाही. हा विभाग वापरला जात असावा.");
      }
    } catch (error) {
      console.error("Error deleting department", error);
      setErrorMsg("विभाग डिलीट करताना एरर आला.");
    }
  };

  const filteredDepartments = departments.filter((d) =>
    d.departmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.departmentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalDepts = departments.length;
  const activeDeptsCount = departments.filter(d => d.status).length;
  const inactiveDeptsCount = totalDepts - activeDeptsCount;

  return (
    <div className="p-2 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans overflow-y-auto">
      {/* Top Title Bar */}
      <div className="text-xs font-bold text-primary border-b border-gray-400 pb-1 mb-2 flex justify-between items-center">
        <span>विभाग व्यवस्थापन (Department Management)</span>
        <span className="text-[10px] text-gray-500 font-normal">संस्थेच्या विभागांची माहिती</span>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-2 p-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm text-[11px] font-bold flex justify-between items-center">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-2 p-1.5 bg-red-50 text-red-800 border border-red-300 rounded-sm text-[11px] font-bold flex justify-between items-center">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-red-700 font-bold">✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-2xs">
          <div className="text-[10px] font-bold text-gray-500 uppercase">एकूण विभाग (Total Departments)</div>
          <div className="text-sm font-black text-gray-800 mt-0.5">{totalDepts}</div>
        </div>
        <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-2xs">
          <div className="text-[10px] font-bold text-gray-500 uppercase">सक्रिय विभाग (Active)</div>
          <div className="text-sm font-black text-emerald-700 mt-0.5">{activeDeptsCount}</div>
        </div>
        <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-2xs">
          <div className="text-[10px] font-bold text-gray-500 uppercase">निष्क्रिय विभाग (Inactive)</div>
          <div className="text-sm font-black text-red-600 mt-0.5">{inactiveDeptsCount}</div>
        </div>
      </div>

      {/* Department Form Card */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-2.5 rounded-sm shadow-2xs border transition-all duration-300 mb-2 ${
          editingId ? 'border-primary ring-2 ring-primary/20 shadow-md bg-blue-50/10' : 'border-gray-200'
        }`}
      >
        <div className="text-[11px] font-bold text-primary border-b border-gray-200 pb-1 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{editingId ? `✏️ विभाग माहिती सुधारणा करा (संपादन मोड - आयडी: ${editingId})` : "➕ नवीन विभाग जोडा"}</span>
            {editingId && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
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
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">विभाग कोड (Department Code) *</label>
            <input 
              type="text" 
              name="departmentCode" 
              value={formData.departmentCode} 
              onChange={handleChange} 
              required 
              maxLength={20}
              placeholder="उदा. IT, HR, ACC" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white" 
            />
          </div>
          
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">विभागाचे नाव (Department Name) *</label>
            <input 
              ref={departmentNameInputRef}
              type="text" 
              name="departmentName" 
              value={formData.departmentName} 
              onChange={handleChange} 
              required 
              placeholder="उदा. माहिती तंत्रज्ञान विभाग" 
              className={`w-full text-xs border rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                editingId ? 'border-primary bg-amber-50/40 font-semibold' : 'border-gray-300 bg-white'
              }`} 
            />
          </div>

          <div className="flex items-center space-x-2 py-1">
            <input 
              type="checkbox" 
              name="status" 
              checked={formData.status} 
              onChange={handleChange} 
              id="status" 
              className="h-3.5 w-3.5 text-primary border-gray-300 rounded-sm focus:ring-primary" 
            />
            <label htmlFor="status" className="text-[11px] font-semibold text-gray-700 cursor-pointer">सक्रिय (Active Department)</label>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">माहिती (Description)</label>
            <input 
              type="text" 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              placeholder="विभागाची अतिरिक्त माहिती लिहा" 
              className="w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white" 
            />
          </div>

          <div className="flex space-x-2 justify-end">
            {editingId && (
              <button 
                type="button" 
                onClick={handleCancel}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-sm text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              >
                रद्द करा
              </button>
            )}
            <button 
              type="submit" 
              className="bg-primary hover:bg-[#004a75] text-white px-4 py-1 rounded-sm text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            >
              {editingId ? "अपडेट करा" : "जतन करा"}
            </button>
          </div>
        </form>
      </div>

      {/* Department Table Card */}
      <div className="bg-white p-2.5 rounded-sm shadow-2xs border border-gray-200 flex-1 flex flex-col">
        <div className="flex justify-between items-center border-b border-gray-200 pb-1 mb-2">
          <div className="text-[11px] font-bold text-primary">
            विभागांची यादी (Departments List)
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">शोधा:</span>
            <input
              type="text"
              placeholder="विभाग कोड / नाव..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2 py-0.5 text-[11px] border border-gray-300 rounded-sm focus:outline-none focus:border-primary bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-primary text-white font-medium">
                <th className="p-1.5 border border-gray-300 text-left">विभाग कोड</th>
                <th className="p-1.5 border border-gray-300 text-left">विभागाचे नाव</th>
                <th className="p-1.5 border border-gray-300 text-left">माहिती</th>
                <th className="p-1.5 border border-gray-300 text-center">स्थिती</th>
                <th className="p-1.5 border border-gray-300 text-center">क्रिया (Actions)</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-gray-500 italic">कोणतेही विभाग उपलब्ध नाहीत.</td>
                </tr>
              ) : (
                filteredDepartments.map((d) => (
                  <tr key={d.departmentID} className="border-b border-gray-200 hover:bg-blue-50/50 transition-colors">
                    <td className="p-1.5 border-r border-gray-200 font-bold text-primary">{d.departmentCode}</td>
                    <td className="p-1.5 border-r border-gray-200 font-bold text-gray-800">{d.departmentName}</td>
                    <td className="p-1.5 border-r border-gray-200 text-gray-600">{d.description || '-'}</td>
                    <td className="p-1.5 border-r border-gray-200 text-center">
                      <span className={`px-2 py-0.5 rounded-xs text-[9px] font-bold ${
                        d.status ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                      }`}>
                        {d.status ? 'सक्रिय' : 'निष्क्रिय'}
                      </span>
                    </td>
                    <td className="p-1.5 text-center flex justify-center space-x-1.5">
                      <button 
                        onClick={() => handleEdit(d)}
                        className="px-2 py-0.5 bg-blue-50 text-primary hover:bg-blue-100 border border-blue-200 rounded-sm font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        संपादन
                      </button>
                      <button 
                        onClick={() => handleDelete(d.departmentID)}
                        className="px-2 py-0.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-sm font-bold text-[10px] transition-colors cursor-pointer"
                      >
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

