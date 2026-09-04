import React, { useState, useEffect, useRef } from 'react';

interface FinancialYear {
  financialYearID: number;
  yearCode: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
}

export default function FinancialYearMaster() {
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const yearCodeInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    yearCode: '',
    startDate: '',
    endDate: '',
    isActive: false,
    isClosed: false
  });
  
  const API_URL = '/api/FinancialYears';

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const fetchYears = async () => {
    try {
      const response = await fetch(API_URL, { headers: getHeaders() });
      if (response.ok) {
        const data = await response.json();
        setYears(data);
      }
    } catch (error) {
      console.error("Error fetching years", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleEdit = (year: FinancialYear) => {
    setEditingId(year.financialYearID);
    setFormData({
      yearCode: year.yearCode,
      startDate: year.startDate ? year.startDate.split('T')[0] : '',
      endDate: year.endDate ? year.endDate.split('T')[0] : '',
      isActive: year.isActive,
      isClosed: year.isClosed
    });

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (yearCodeInputRef.current) {
        yearCodeInputRef.current.focus();
        yearCodeInputRef.current.select();
      }
    }, 120);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ yearCode: '', startDate: '', endDate: '', isActive: false, isClosed: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? 'PUT' : 'POST';
      const bodyData = editingId ? { ...formData, financialYearID: editingId } : formData;

      const response = await fetch(url, {
        method: method,
        headers: getHeaders(),
        body: JSON.stringify(bodyData)
      });
      if (response.ok) {
        fetchYears();
        handleCancelEdit();
        alert(editingId ? 'आर्थिक वर्ष यशस्वीरित्या अपडेट झाले!' : 'आर्थिक वर्ष यशस्वीरित्या सेव्ह झाले!');
      } else {
        const errorText = await response.text();
        alert(`एरर: ${errorText || 'माहिती सेव्ह करणे अयशस्वी झाले.'}`);
      }
    } catch (error) {
      console.error("Error saving year", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('तुम्हाला खात्री आहे का की हे आर्थिक वर्ष डिलीट करायचे आहे?')) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (response.ok) {
        alert('आर्थिक वर्ष यशस्वीरित्या डिलीट झाले!');
        fetchYears();
      } else {
        const errorText = await response.text();
        alert(`एरर: ${errorText || 'डिलीट करणे अयशस्वी झाले.'}`);
      }
    } catch (error) {
      console.error("Error deleting financial year", error);
      alert('सर्व्हरशी संपर्क साधता आला नाही.');
    }
  };

  return (
    <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
      <div className="mb-2 flex justify-between items-end border-b-2 border-red-600 pb-1">
        <h1 className="text-lg font-bold text-gray-800">आर्थिक वर्ष (Financial Year) माहिती</h1>
      </div>
      
      <div 
        ref={formContainerRef}
        className={`bg-white p-2 rounded-sm shadow-sm border transition-all duration-300 mb-3 ${
          editingId ? 'border-primary ring-2 ring-primary/20 shadow-md bg-blue-50/10' : 'border-gray-200'
        }`}
      >
        <div className="flex justify-between items-center border-b pb-1 mb-2">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <span>{editingId ? `✏️ आर्थिक वर्ष अपडेट करा (संपादन मोड - आयडी: ${editingId})` : '➕ नवीन आर्थिक वर्ष जोडा'}</span>
            {editingId && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                संपादन चालू (Editing)
              </span>
            )}
          </h2>
          {editingId && (
            <button 
              type="button" 
              onClick={handleCancelEdit}
              className="text-xs text-gray-500 hover:text-red-600 font-semibold cursor-pointer"
            >
              ✕ संपादन रद्द करा (Cancel)
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-1.5 items-end">
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">वर्षाचा कोड (Year Code)</label>
            <input 
              ref={yearCodeInputRef}
              type="text" 
              name="yearCode" 
              value={formData.yearCode} 
              onChange={handleChange} 
              required 
              placeholder="उदा. 2024-2025" 
              className={`w-full border px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs ${
                editingId ? 'border-primary bg-amber-50/40 font-semibold' : 'border-gray-300'
              }`} 
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">सुरुवात तारीख (Start Date)</label>
            <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">शेवटची तारीख (End Date)</label>
            <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
          </div>

          <div className="flex items-center space-x-2 pb-1">
            <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} id="isActive" className="h-3 w-3 text-blue-600" />
            <label htmlFor="isActive" className="text-xs font-semibold text-gray-700">सध्याचे (Active) वर्ष म्हणून सेट करा</label>
          </div>

          <div className="md:col-span-4 flex justify-end gap-2 pt-1">
            {editingId && (
              <button type="button" onClick={handleCancelEdit} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-1 rounded-sm font-medium shadow-sm transition-colors text-xs">
                रद्द करा (Cancel)
              </button>
            )}
            <button type="submit" className="bg-primary hover:bg-[#004a75] text-white px-6 py-1 rounded-sm font-medium shadow-sm transition-colors text-xs">
              {editingId ? 'अपडेट करा (Update)' : 'सेव्ह करा (Save)'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-3">
        <h2 className="text-sm font-bold text-gray-800 mb-1 border-b pb-0.5 flex justify-between">
          <span>नोंदवलेली आर्थिक वर्षे</span>
          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-sm">{years.length} वर्षे</span>
        </h2>
        <div className="overflow-x-auto bg-white rounded-sm shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-xs text-center">
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">वर्षाचा कोड (Year Code)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">सुरुवात तारीख (Start Date)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">शेवटची तारीख (End Date)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">स्टेटस (Status)</th>
                <th className="px-2 py-1.5 font-medium text-center">कृती (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {years.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">कोणतेही आर्थिक वर्ष आढळले नाही.</td></tr>
              ) : (
                years.map((year) => (
                  <tr key={year.financialYearID} className="hover:bg-gray-50">
                    <td className="px-2 py-1 border-r border-gray-200 text-left font-medium text-primary">{year.yearCode}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left">{new Date(year.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left">{new Date(year.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left">
                      <span className={`px-1.5 py-0.5 inline-flex text-[10px] leading-3 font-semibold rounded-sm ${
                        year.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {year.isActive ? 'सक्रिय (Active)' : 'निष्क्रिय (Inactive)'}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-center space-x-1.5">
                      <button
                        onClick={() => handleEdit(year)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-sm font-semibold text-[10px] transition-colors"
                      >
                        बदला (Edit)
                      </button>
                      <button
                        onClick={() => handleDelete(year.financialYearID)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-sm font-semibold text-[10px] transition-colors"
                      >
                        डिलीट (Delete)
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

