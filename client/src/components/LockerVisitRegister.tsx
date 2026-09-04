import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Plus, 
  Save, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Printer, 
  Search, 
  UserCheck, 
  Key, 
  Calendar, 
  ShieldCheck, 
  LogOut, 
  User, 
  Filter 
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface AllotmentOption {
  allotmentID: number;
  lockerAccountNo: string;
  lockerNo: string;
  cabinetNo: string;
  keyNo: string;
  memberName: string;
  memberNo: string;
  operatingInstruction: string;
  jointMember1_Name?: string;
  jointMember2_Name?: string;
  status: string;
}

interface VisitRecord {
  visitID: number;
  branchID: number;
  allotmentID: number;
  lockerAccountNo: string;
  lockerNo: string;
  cabinetNo: string;
  keyNo: string;
  memberName: string;
  visitDate: string;
  timeIn: string;
  timeOut?: string;
  operatedBy: string;
  operatorName: string;
  isSignatureVerified: boolean;
  bankOfficerName?: string;
  remarks?: string;
  createdAt: string;
}

const LockerVisitRegister: React.FC = () => {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [allotments, setAllotments] = useState<AllotmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Date filters
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    branchID: 1,
    allotmentID: '',
    visitDate: new Date().toISOString().split('T')[0],
    timeIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timeOut: '',
    operatedBy: 'PrimaryMember',
    operatorName: '',
    isSignatureVerified: true,
    bankOfficerName: 'लॉकर कस्टोडियन (Locker Custodian)',
    remarks: ''
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchVisits = async () => {
    setLoading(true);
    try {
      let url = `/api/LockerVisits?fromDate=${fromDate}&toDate=${toDate}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setVisits(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllotments = async () => {
    try {
      const res = await fetch('/api/LockerAllotments?status=Active');
      if (res.ok) {
        const data = await res.json();
        setAllotments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchVisits();
    fetchAllotments();
  }, []);

  // When Allotment is selected, auto fill operator name
  useEffect(() => {
    if (formData.allotmentID) {
      const selected = allotments.find(a => a.allotmentID.toString() === formData.allotmentID.toString());
      if (selected) {
        if (formData.operatedBy === 'PrimaryMember') {
          setFormData(prev => ({ ...prev, operatorName: selected.memberName || '' }));
        } else if (formData.operatedBy === 'JointMember1' && selected.jointMember1_Name) {
          setFormData(prev => ({ ...prev, operatorName: selected.jointMember1_Name || '' }));
        } else if (formData.operatedBy === 'JointMember2' && selected.jointMember2_Name) {
          setFormData(prev => ({ ...prev, operatorName: selected.jointMember2_Name || '' }));
        }
      }
    }
  }, [formData.allotmentID, formData.operatedBy, allotments]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string; value: string | number; type?: string } }
  ) => {
    const target = e.target as any;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setFormData(prev => ({
      ...prev,
      [target.name]: value
    }));
  };

  const handleReset = () => {
    setFormData({
      branchID: 1,
      allotmentID: '',
      visitDate: new Date().toISOString().split('T')[0],
      timeIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeOut: '',
      operatedBy: 'PrimaryMember',
      operatorName: '',
      isSignatureVerified: true,
      bankOfficerName: 'लॉकर कस्टोडियन (Locker Custodian)',
      remarks: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.allotmentID) {
      showMsg('कृपया लॉकर खाते निवडा.', 'error');
      return;
    }
    if (!formData.operatorName.trim()) {
      showMsg('कृपया हाताळणाऱ्या व्यक्तीचे नाव टाका.', 'error');
      return;
    }

    const payload = {
      branchID: Number(formData.branchID) || 1,
      allotmentID: parseInt(formData.allotmentID),
      visitDate: formData.visitDate,
      timeIn: formData.timeIn,
      timeOut: formData.timeOut,
      operatedBy: formData.operatedBy,
      operatorName: formData.operatorName.trim(),
      isSignatureVerified: formData.isSignatureVerified,
      bankOfficerName: formData.bankOfficerName.trim(),
      remarks: formData.remarks
    };

    try {
      const res = await fetch('/api/LockerVisits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showMsg('लॉकर व्हिजिट नोंद यशस्वीरीत्या सेव्ह झाली!');
        handleReset();
        fetchVisits();
      } else {
        const data = await res.json();
        showMsg(data.message || 'त्रुटी आली.', 'error');
      }
    } catch (err) {
      console.error(err);
      showMsg('सर्व्हर एरर आली.', 'error');
    }
  };

  const handleMarkTimeOut = async (visitId: number) => {
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const res = await fetch(`/api/LockerVisits/${visitId}/TimeOut`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeOut: currentTime })
      });

      if (res.ok) {
        showMsg(`बाहेर पडण्याची वेळ (${currentTime}) नोंदवली गेली!`);
        fetchVisits();
      } else {
        showMsg('Time Out नोंदवता आला नाही.', 'error');
      }
    } catch (err) {
      console.error(err);
      showMsg('सर्व्हर एरर आली.', 'error');
    }
  };

  const safeAllotments = Array.isArray(allotments) ? allotments : [];
  const safeVisits = Array.isArray(visits) ? visits : [];

  const allotmentDropdownOptions = [
    { value: '', label: '-- लॉकर खाते निवडा --' },
    ...safeAllotments.map(a => ({
      value: a.allotmentID.toString(),
      label: `${a.lockerAccountNo} | लॉकर: ${a.cabinetNo}-${a.lockerNo} (चावी: ${a.keyNo}) | ${a.memberName}`
    }))
  ];

  const selectedAllotmentDetails = safeAllotments.find(a => a.allotmentID.toString() === formData.allotmentID.toString());

  // Filtered visits
  const filteredVisits = safeVisits.filter(v => {
    const term = searchTerm.toLowerCase();
    return !term || 
      (v.lockerAccountNo && v.lockerAccountNo.toLowerCase().includes(term)) ||
      (v.lockerNo && v.lockerNo.toLowerCase().includes(term)) ||
      (v.memberName && v.memberName.toLowerCase().includes(term)) ||
      (v.operatorName && v.operatorName.toLowerCase().includes(term));
  });

  // Currently Inside Vault (No TimeOut yet)
  const insideVaultVisits = safeVisits.filter(v => !v.timeOut && v.visitDate && v.visitDate.startsWith(new Date().toISOString().split('T')[0]));

  const inputClass = "w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white";
  const labelClass = "block text-[11px] font-bold text-slate-700 mb-0.5";

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg shadow-xs border border-slate-200 gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">दैनिक लॉकर हाताळणी नोंदवही (Locker Visit Register)</h1>
            <p className="text-xs text-slate-500">लॉकर रूम उघडल्याची वेळ, ग्राहक सही पडताळणी व कस्टोडियन तपासणी (Dual Key Register)</p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md shadow-xs flex items-center gap-1"
        >
          <Printer size={14} /> नोंदवही प्रिंट करा
        </button>
      </div>

      {message && (
        <div className={`p-2.5 rounded-md text-xs font-semibold flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Active Inside Vault Alert Banner */}
      {insideVaultVisits.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-300 p-3 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
            <p className="text-xs font-bold text-amber-900">
              सध्या लॉकर रूममध्ये उपस्थित: <strong>{insideVaultVisits.length} ग्राहक</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {insideVaultVisits.map(iv => (
              <button
                key={iv.visitID}
                onClick={() => handleMarkTimeOut(iv.visitID)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-md flex items-center gap-1 shadow-xs"
              >
                <LogOut size={12} /> {iv.lockerNo} ({iv.operatorName.split(' ')[0]}) - Time Out करा
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Entry Form */}
      <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Plus size={14} className="text-emerald-600" /> नवीन लॉकर रूम व्हिजिट नोंद (Record Locker Access)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className={labelClass}>लॉकर खाते निवडा *</label>
              <SearchableSelect
                name="allotmentID"
                value={formData.allotmentID}
                onChange={handleChange}
                options={allotmentDropdownOptions}
                placeholder="-- लॉकर खाते किंवा लॉकर क्रमांक शोधा --"
              />
            </div>
            <div>
              <label className={labelClass}>तारीख (Visit Date) *</label>
              <input
                type="date"
                name="visitDate"
                value={formData.visitDate}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
          </div>

          {/* Selected Account Info Card */}
          {selectedAllotmentDetails && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">मुख्य सभासद</span>
                <p className="font-bold text-slate-800">{selectedAllotmentDetails.memberName}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">कपाट व लॉकर</span>
                <p className="font-bold text-emerald-800">{selectedAllotmentDetails.cabinetNo} - {selectedAllotmentDetails.lockerNo}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">चावी क्रमांक</span>
                <p className="font-mono font-bold text-slate-700">{selectedAllotmentDetails.keyNo}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">ऑपरेटिंग पद्धत</span>
                <p className="font-semibold text-purple-700">{selectedAllotmentDetails.operatingInstruction}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>लॉकर कोणी हाताळला? *</label>
              <select
                name="operatedBy"
                value={formData.operatedBy}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="PrimaryMember">मुख्य सभासद (Primary Member)</option>
                <option value="JointMember1">सह-धारक १ (Joint Holder 1)</option>
                <option value="JointMember2">सह-धारक २ (Joint Holder 2)</option>
                <option value="Nominee">वारसदार (Nominee / Legal Heir)</option>
                <option value="PowerOfAttorney">मुखत्यारपत्र धारक (POA)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>हाताळणाऱ्या व्यक्तीचे नाव *</label>
              <input
                type="text"
                name="operatorName"
                value={formData.operatorName}
                onChange={handleChange}
                placeholder="व्यक्तीचे नाव"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>आत येण्याची वेळ (Time In) *</label>
              <input
                type="text"
                name="timeIn"
                value={formData.timeIn}
                onChange={handleChange}
                placeholder="उदा. 11:30 AM"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>बाहेर पडण्याची वेळ (Time Out - ऐच्छिक)</label>
              <input
                type="text"
                name="timeOut"
                value={formData.timeOut}
                onChange={handleChange}
                placeholder="उदा. 11:45 AM"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>बँक कस्टोडियन / अधिकारी नाव</label>
              <input
                type="text"
                name="bankOfficerName"
                value={formData.bankOfficerName}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>शेरा (Remarks)</label>
              <input
                type="text"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                placeholder="ऐच्छिक शेरा"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                name="isSignatureVerified"
                checked={formData.isSignatureVerified}
                onChange={handleChange}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="flex items-center gap-1 text-emerald-800">
                <ShieldCheck size={14} className="text-emerald-600" /> ग्राहकाची सही व ओळख पडताळली (Signature & KYC Verified)
              </span>
            </label>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1"
              >
                <RotateCcw size={13} /> रिसेट
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs flex items-center gap-1"
              >
                <Save size={13} /> व्हिजिट नोंद सेव्ह करा
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* History Log Table */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-2 bg-slate-50/50">
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-700">कालावधी:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="text-xs px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <span className="text-xs text-slate-500">ते</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="text-xs px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              onClick={fetchVisits}
              className="px-3 py-1 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-md flex items-center gap-1"
            >
              <Filter size={12} /> शोधा
            </button>
          </div>

          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="लॉकर क्र. / ग्राहक शोधा..."
              className="w-full text-xs pl-7 pr-2.5 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                <th className="py-2 px-3">तारीख</th>
                <th className="py-2 px-3">खाते क्र.</th>
                <th className="py-2 px-3">लॉकर क्र.</th>
                <th className="py-2 px-3">चावी क्र.</th>
                <th className="py-2 px-3">हाताळणाऱ्या व्यक्तीचे नाव</th>
                <th className="py-2 px-3">नाते/प्रकार</th>
                <th className="py-2 px-3 text-center">Time In</th>
                <th className="py-2 px-3 text-center">Time Out</th>
                <th className="py-2 px-3 text-center">सही पडताळणी</th>
                <th className="py-2 px-3">कस्टोडियन अधिकारी</th>
                <th className="py-2 px-3 text-center">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-slate-400">
                    कोणत्याही व्हिजिट नोंदी सापडल्या नाहीत.
                  </td>
                </tr>
              ) : (
                filteredVisits.map((v) => (
                  <tr key={v.visitID} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-semibold">{new Date(v.visitDate).toLocaleDateString('en-GB')}</td>
                    <td className="py-2 px-3 font-mono font-bold text-emerald-800">{v.lockerAccountNo}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{v.cabinetNo} - {v.lockerNo}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{v.keyNo}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{v.operatorName}</td>
                    <td className="py-2 px-3 text-slate-600">{v.operatedBy}</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">{v.timeIn}</td>
                    <td className="py-2 px-3 text-center">
                      {v.timeOut ? (
                        <span className="font-bold text-slate-800">{v.timeOut}</span>
                      ) : (
                        <button
                          onClick={() => handleMarkTimeOut(v.visitID)}
                          className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-[10px] font-bold border border-amber-300"
                        >
                          Time Out नोंदवा
                        </button>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-emerald-600 font-bold">✓ प्रमाणित</span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{v.bankOfficerName || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-[10px] text-slate-400 font-mono">#{v.visitID}</span>
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

export default LockerVisitRegister;
