import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';

interface LoanDocument {
  loanDocumentID: number;
  loanAccountID: number;
  documentType: string;
  documentName: string;
  filePath: string;
  uploadedDate: string;
}

export default function LoanDocumentsUpload() {
  const [loanAccounts, setLoanAccounts] = useState<any[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  
  const [documentType, setDocumentType] = useState('आधार कार्ड (Aadhar Card)');
  const [documentName, setDocumentName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const API_DOCS = '/api/LoanDocuments';
  const API_LOANS = '/api/LoanAccounts';

  useEffect(() => {
    fetchLoans();
  }, []);

  useEffect(() => {
    if (selectedLoanId) {
      fetchDocuments();
    } else {
      setDocuments([]);
    }
  }, [selectedLoanId]);

  const fetchLoans = async () => {
    try {
      const res = await fetch(API_LOANS);
      if (res.ok) {
        const data = await res.json();
        setLoanAccounts(data.filter((l: any) => l.status === 'Active'));
      }
    } catch (error) {
      console.error('Error fetching loans', error);
    }
  };

  const fetchDocuments = async () => {
    if (!selectedLoanId) return;
    try {
      const res = await fetch(`${API_DOCS}/ByLoanAccount/${selectedLoanId}`);
      if (res.ok) {
        setDocuments(await res.json());
      }
    } catch (error) {
      console.error('Error fetching documents', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) {
      alert("कृपया कर्ज खाते निवडा!");
      return;
    }
    if (!selectedFile) {
      alert("कृपया फाईल निवडा!");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('loanAccountId', selectedLoanId);
      formData.append('documentType', documentType);
      formData.append('documentName', documentName);
      formData.append('file', selectedFile);

      const res = await fetch(`${API_DOCS}/Upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        alert("कागदपत्र यशस्वीरीत्या अपलोड झाले!");
        setSelectedFile(null);
        setDocumentName('');
        // clear file input
        const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
        
        fetchDocuments();
      } else {
        alert("अपलोड करताना त्रुटी आली.");
      }
    } catch (error) {
      console.error("Error uploading", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("तुम्हाला हे कागदपत्र नक्की डिलीट करायचे आहे का?")) {
      try {
        await fetch(`${API_DOCS}/${id}`, { method: 'DELETE' });
        fetchDocuments();
      } catch (error) {
        console.error("Error deleting", error);
      }
    }
  };

  const loanOptions = loanAccounts.map(l => ({
    value: l.loanAccountID.toString(),
    label: `${l.loanAccountNo} - ${l.member?.firstName} ${l.member?.lastName}`
  }));

  const inputClass = "w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-blue-500 text-xs bg-white";
  const labelClass = "block text-[11px] font-semibold text-gray-700 mb-0.5";

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Standard ERP Header Banner */}
      <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div>
          <h1 className="text-sm font-bold tracking-wide">कर्ज कागदपत्रे अपलोड (Loan Documents)</h1>
          <p className="text-[10px] text-blue-100 font-normal">७/१२ उतारा, आधार कार्ड, पॅन कार्ड, जामीनदार संमती व तारण दस्तऐवज अपलोड</p>
        </div>
      </div>

      {/* Loan Selection */}
      <div className="bg-white p-2.5 rounded-sm shadow-xs border border-gray-200 mb-2.5 flex items-end space-x-4">
        <div className="flex-1 max-w-md">
          <label className={labelClass}>कर्ज खाते निवडा (Select Loan Account)</label>
          <SearchableSelect 
            name="selectedLoanId" 
            value={selectedLoanId} 
            onChange={(e: any) => setSelectedLoanId(e.target.value)} 
            options={loanOptions} 
          />
        </div>
      </div>

      {selectedLoanId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Upload Form */}
          <div className="md:col-span-1 bg-white p-2.5 rounded-sm shadow-xs border border-gray-200">
            <h2 className="text-xs font-bold text-primary mb-2 border-b pb-1">नवीन कागदपत्र अपलोड करा</h2>
            <form onSubmit={handleUpload} className="space-y-2">
              <div>
                <label className={labelClass}>कागदपत्राचा प्रकार</label>
                <select value={documentType} onChange={e => setDocumentType(e.target.value)} className={inputClass}>
                  <option value="आधार कार्ड (Aadhar Card)">आधार कार्ड (Aadhar Card)</option>
                  <option value="पॅन कार्ड (PAN Card)">पॅन कार्ड (PAN Card)</option>
                  <option value="७/१२ उतारा (7/12 Extract)">७/१२ उतारा (7/12 Extract)</option>
                  <option value="फोटो (Photograph)">फोटो (Photograph)</option>
                  <option value="प्रॉमिसरी नोट (Promissory Note)">प्रॉमिसरी नोट (Promissory Note)</option>
                  <option value="इतर (Other)">इतर (Other)</option>
                </select>
              </div>
              
              <div>
                <label className={labelClass}>वर्णन / नाव (पर्यायी)</label>
                <input type="text" value={documentName} onChange={e => setDocumentName(e.target.value)} className={inputClass} placeholder="उदा. जामीनदाराचे आधार कार्ड" />
              </div>

              <div>
                <label className={labelClass}>फाईल निवडा (PDF/Image)</label>
                <input type="file" id="fileUpload" onChange={handleFileChange} className={`${inputClass} bg-gray-50`} required />
              </div>

              <div className="pt-1.5">
                <button type="submit" disabled={uploading} className={`w-full text-white py-1.5 rounded-sm font-semibold text-xs transition-colors cursor-pointer ${uploading ? 'bg-gray-400' : 'bg-primary hover:bg-[#004a75]'}`}>
                  {uploading ? 'अपलोड होत आहे...' : 'अपलोड करा (Upload)'}
                </button>
              </div>
            </form>
          </div>

          {/* Grid */}
          <div className="md:col-span-2 bg-white p-2.5 rounded-sm shadow-xs border border-gray-200">
            <h2 className="text-xs font-bold text-gray-800 mb-2 border-b pb-1">अपलोड केलेली कागदपत्रे</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left border-collapse">
                <thead className="bg-gray-100 text-gray-700 text-[11px]">
                  <tr>
                    <th className="border border-gray-200 px-2 py-1">प्रकार</th>
                    <th className="border border-gray-200 px-2 py-1">वर्णन</th>
                    <th className="border border-gray-200 px-2 py-1">तारीख</th>
                    <th className="border border-gray-200 px-2 py-1 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(d => (
                    <tr key={d.loanDocumentID} className="hover:bg-gray-50 text-[11px]">
                      <td className="border border-gray-200 px-2 py-1 font-semibold text-primary">{d.documentType}</td>
                      <td className="border border-gray-200 px-2 py-1">{d.documentName || '-'}</td>
                      <td className="border border-gray-200 px-2 py-1">{new Date(d.uploadedDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td className="border border-gray-200 px-2 py-1 text-center space-x-2">
                        <a href={`${d.filePath}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">पहा (View)</a>
                        <span className="text-gray-300">|</span>
                        <button type="button" onClick={() => handleDelete(d.loanDocumentID)} className="text-red-600 font-bold hover:underline cursor-pointer">डिलीट</button>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && (
                    <tr><td colSpan={4} className="border border-gray-200 px-2 py-4 text-center text-gray-500 text-xs">कोणतीही कागदपत्रे नाहीत.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

