import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Building2, RefreshCw, CheckCircle2, ShieldCheck, MapPin, FileBadge, 
  RotateCcw, CheckSquare, IndianRupee, Phone, Mail, Calendar, 
  FileText, Shield, Sparkles, Scale, Plus, Pencil, Trash2, AlertTriangle
} from 'lucide-react';

interface AuthorizedCapitalHistoryItem {
  historyID: number;
  sansthaID: number;
  effectiveDate: string;
  authorizedCapitalAmount: number;
  shareFaceValue: number;
  authorizedShareCount: number;
  resolutionNo?: string | null;
  registrarApprovalNo?: string | null;
  remarks?: string | null;
}

interface AuthorizedCapitalOverview {
  sansthaId: number;
  currentAuthorizedCapital: number;
  currentShareFaceValue: number;
  currentAuthorizedShareCount: number;
  paidUpShareCapital: number;
  remainingCapacity: number;
  utilizationPercent: number;
  history: AuthorizedCapitalHistoryItem[];
}

interface SansthaDetail {
  sansthaID: number;
  sansthaName: string;
  address: string;
  village?: string;
  taluka?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  contactNo: string;
  email: string;
  registrationNo: string;
  registrationDate?: string;
  gstNo: string;
  logoPath: string;
  autoPostVouchers: boolean;
  autoPostVoucherLimit?: number;
  isMobileCompulsory?: boolean;
  isAadhaarCompulsory?: boolean;
  isPanCompulsory?: boolean;
  fdRenewalReceiptPolicy?: 'NEW_RECEIPT' | 'RETAIN_ORIGINAL' | 'NEXT_LEGACY' | 'HYBRID_CHOICE';
  allowManualReceiptNoOnRenewal?: boolean;
  shareFaceValue?: number | string;
  authorizedShareCapital?: number | string;
  dividendRate?: number | string;
}

export default function SansthaMaster() {
  const [sansthaDetails, setSansthaDetails] = useState<SansthaDetail[]>([]);
  const [formData, setFormData] = useState<Partial<SansthaDetail>>({
    sansthaName: '', address: '', village: '', taluka: '', district: '', state: '', pinCode: '', contactNo: '', email: '', registrationNo: '', registrationDate: '', gstNo: '', logoPath: '', autoPostVouchers: false, autoPostVoucherLimit: 0,
    isMobileCompulsory: true, isAadhaarCompulsory: true, isPanCompulsory: false,
    fdRenewalReceiptPolicy: 'NEW_RECEIPT', allowManualReceiptNoOnRenewal: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // अधिकृत भागभांडवल व उपविधी नोंदवही (Authorised Share Capital & Bye-Law History)
  const [capOverview, setCapOverview] = useState<AuthorizedCapitalOverview | null>(null);
  const [capLoading, setCapLoading] = useState(false);
  const [capSaving, setCapSaving] = useState(false);
  const [capError, setCapError] = useState('');
  const [capSuccess, setCapSuccess] = useState('');
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);
  const [capEffectiveDate, setCapEffectiveDate] = useState<string>(`${new Date().getFullYear() - 1}-04-01`);
  const [capAmount, setCapAmount] = useState<string>('');
  const [capFaceValue, setCapFaceValue] = useState<string>('100');
  const [capResolutionNo, setCapResolutionNo] = useState<string>('');
  const [capApprovalNo, setCapApprovalNo] = useState<string>('');
  const [capRemarks, setCapRemarks] = useState<string>('');

  const API_URL = '/api/SansthaDetails';
  const sansthaNameInputRef = useRef<HTMLInputElement>(null);

  const fetchAuthorizedCapitalHistory = async () => {
    setCapLoading(true);
    try {
      const res = await axios.get(`${API_URL}/authorized-capital-history`);
      if (res.data) {
        setCapOverview(res.data);
      }
    } catch (err) {
      console.error('Error fetching authorized share capital history', err);
    } finally {
      setCapLoading(false);
    }
  };

  const resetCapitalForm = (defaultDate?: string) => {
    setEditingHistoryId(null);
    setCapEffectiveDate(defaultDate || new Date().toISOString().split('T')[0]);
    setCapAmount('');
    setCapFaceValue(String(capOverview?.currentShareFaceValue || 100));
    setCapResolutionNo('');
    setCapApprovalNo('');
    setCapRemarks('');
    setCapError('');
  };

  const handleSaveAuthorizedCapital = async () => {
    setCapError('');
    setCapSuccess('');
    const amt = parseFloat(capAmount);
    const face = parseFloat(capFaceValue) || 100;
    if (!capEffectiveDate) {
      setCapError('कृपया प्रभावी दिनांक (Effective Date) निवडा.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setCapError('कृपया वैध अधिकृत भागभांडवल रक्कम (₹ > 0) प्रविष्ट करा.');
      return;
    }
    if (!Number.isFinite(face) || face <= 0) {
      setCapError('कृपया एका शेअरचे वैध दर्शनी मूल्य (₹ > 0) प्रविष्ट करा.');
      return;
    }

    setCapSaving(true);
    try {
      const payload = {
        effectiveDate: capEffectiveDate,
        authorizedCapitalAmount: amt,
        shareFaceValue: face,
        authorizedShareCount: Math.floor(amt / face),
        resolutionNo: capResolutionNo.trim() || null,
        registrarApprovalNo: capApprovalNo.trim() || null,
        remarks: capRemarks.trim() || null
      };

      if (editingHistoryId) {
        await axios.put(`${API_URL}/authorized-capital-history/${editingHistoryId}`, payload);
        setCapSuccess('अधिकृत भागभांडवल नोंद यशस्वीरीत्या अद्ययावत झाली आहे.');
      } else {
        await axios.post(`${API_URL}/authorized-capital-history`, payload);
        setCapSuccess('नवीन अधिकृत भागभांडवल नोंद यशस्वीरीत्या जतन झाली आहे (ताळेबंदात आपोआप परावर्तित होईल).');
      }
      resetCapitalForm();
      await Promise.all([fetchAuthorizedCapitalHistory(), fetchSansthaDetails()]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'अधिकृत भागभांडवल सेव्ह करताना त्रुटी आली.';
      setCapError(msg);
    } finally {
      setCapSaving(false);
    }
  };

  const handleEditCapitalRow = (row: AuthorizedCapitalHistoryItem) => {
    setCapError('');
    setCapSuccess('');
    setEditingHistoryId(row.historyID);
    setCapEffectiveDate(row.effectiveDate ? row.effectiveDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setCapAmount(String(row.authorizedCapitalAmount));
    setCapFaceValue(String(row.shareFaceValue || 100));
    setCapResolutionNo(row.resolutionNo || '');
    setCapApprovalNo(row.registrarApprovalNo || '');
    setCapRemarks(row.remarks || '');
  };

  const handleDeleteCapitalRow = async (row: AuthorizedCapitalHistoryItem) => {
    const dt = row.effectiveDate ? row.effectiveDate.split('T')[0].split('-').reverse().join('/') : '';
    if (!window.confirm(`दिनांक ${dt} ची ₹${row.authorizedCapitalAmount.toLocaleString('en-IN')} अधिकृत भागभांडवलाची नोंद खात्रीपूर्वक हटवायची का?`)) {
      return;
    }
    setCapError('');
    setCapSuccess('');
    try {
      await axios.delete(`${API_URL}/authorized-capital-history/${row.historyID}`);
      if (editingHistoryId === row.historyID) {
        resetCapitalForm();
      }
      setCapSuccess('अधिकृत भागभांडवल नोंद हटवली गेली आहे.');
      await Promise.all([fetchAuthorizedCapitalHistory(), fetchSansthaDetails()]);
    } catch (err: any) {
      setCapError(err?.response?.data?.message || 'नोंद हटवताना त्रुटी आली.');
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      setLoading(true);
      try {
        const response = await axios.get(API_URL);
        if (isMounted && response.data) {
          const data = Array.isArray(response.data) ? response.data : [response.data];
          setSansthaDetails(data);
          if (data.length > 0) {
            const profile = { ...data[0] };
            if (profile.registrationDate) {
              profile.registrationDate = profile.registrationDate.split('T')[0];
            }
            setFormData(profile);
          }
        }
      } catch (error) {
        if (isMounted) console.error("Error fetching Sanstha Details", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();
    fetchAuthorizedCapitalHistory();
    const timer = setTimeout(() => {
      if (isMounted && sansthaNameInputRef.current) {
        sansthaNameInputRef.current.focus();
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const fetchSansthaDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API_URL);
      if (response.data) {
        const data = Array.isArray(response.data) ? response.data : [response.data];
        setSansthaDetails(data);
        if (data.length > 0) {
          const profile = { ...data[0] };
          if (profile.registrationDate) {
            profile.registrationDate = profile.registrationDate.split('T')[0];
          }
          setFormData(profile);
        }
      }
    } catch (error) {
      console.error("Error fetching Sanstha Details", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : e.target.type === 'number'
      ? (e.target.value === '' ? '' : e.target.value)
      : e.target.value;

    if (e.target.name === 'fdRenewalReceiptPolicy' && value === 'RETAIN_ORIGINAL') {
      setFormData({ ...formData, fdRenewalReceiptPolicy: 'RETAIN_ORIGINAL', allowManualReceiptNoOnRenewal: false });
      return;
    }

    setFormData({ ...formData, [e.target.name]: value });
  };

  const normalizeDateForApi = (dateStr?: string | null): string | null => {
    if (!dateStr || !dateStr.trim()) return null;
    const clean = dateStr.trim().split('T')[0];
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    return clean;
  };

  const resetForm = () => {
    if (sansthaDetails.length > 0) {
      const profile = { ...sansthaDetails[0] };
      if (profile.registrationDate) {
        profile.registrationDate = profile.registrationDate.split('T')[0];
      }
      setFormData(profile);
    }
    setTimeout(() => {
      sansthaNameInputRef.current?.focus();
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sansthaName || !formData.sansthaName.trim()) {
      alert("कृपया संस्थेचे नाव भरा.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const isUpdating = Boolean(formData.sansthaID && formData.sansthaID > 0);
      const url = isUpdating ? `${API_URL}/${formData.sansthaID}` : API_URL;

      const payload: any = {
        sansthaID: formData.sansthaID || 0,
        sansthaName: formData.sansthaName.trim(),
        address: formData.address ? formData.address.trim() : null,
        village: formData.village ? formData.village.trim() : null,
        taluka: formData.taluka ? formData.taluka.trim() : null,
        district: formData.district ? formData.district.trim() : null,
        state: formData.state ? formData.state.trim() : null,
        pinCode: formData.pinCode ? formData.pinCode.trim() : null,
        contactNo: formData.contactNo ? formData.contactNo.trim() : null,
        email: formData.email ? formData.email.trim() : null,
        registrationNo: formData.registrationNo ? formData.registrationNo.trim() : null,
        registrationDate: normalizeDateForApi(formData.registrationDate),
        gstNo: formData.gstNo ? formData.gstNo.trim() : null,
        logoPath: formData.logoPath || null,
        autoPostVouchers: false,
        autoPostVoucherLimit: 0,
        isMobileCompulsory: formData.isMobileCompulsory ?? true,
        isAadhaarCompulsory: formData.isAadhaarCompulsory ?? true,
        isPanCompulsory: formData.isPanCompulsory ?? false,
        fdRenewalReceiptPolicy: formData.fdRenewalReceiptPolicy || 'NEW_RECEIPT',
        allowManualReceiptNoOnRenewal: formData.fdRenewalReceiptPolicy === 'RETAIN_ORIGINAL' ? false : Boolean(formData.allowManualReceiptNoOnRenewal),
      };

      let response;
      if (isUpdating) {
        response = await axios.put(url, payload);
      } else {
        response = await axios.post(url, payload);
      }

      if (response.status >= 200 && response.status < 300) {
        setSaveSuccess(true);
        alert("संस्थेची माहिती यशस्वीरित्या सेव्ह झाली! (Sanstha Details Saved Successfully!)");
        fetchSansthaDetails();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error: any) {
      console.error("Error saving Sanstha Details", error);
      const msg = error.response?.data?.message || "संस्था माहिती सेव्ह करताना त्रुटी आली. कृपया सर्व फील्ड्स तपासा.";
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

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
              <span>संस्था प्रोफाईल व सिस्टीम नियम</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Sanstha Profile & Core Banking Configurations)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              पतसंस्थेची अधिकृत माहिती, नोंदणी तपशील, पत्ता व केवायसी अनिवार्यतेचे नियम व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-emerald-700 text-xs font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 animate-in fade-in">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>माहिती सेव्ह झाली!</span>
            </span>
          )}

          <button
            type="button"
            onClick={fetchSansthaDetails}
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
          <div className="min-w-0">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">नोंदणीकृत संस्था</div>
            <div className="text-xs font-black text-gray-900 truncate" title={formData.sansthaName || 'मुख्य संस्था'}>
              {formData.sansthaName || 'मुख्य संस्था'}
            </div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <FileBadge className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">नोंदणी क्रमांक</div>
            <div className="text-xs font-black text-emerald-800 truncate">
              {formData.registrationNo || 'नोंदणीकृत'}
            </div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">केवायसी नियम</div>
            <div className="text-xs font-black text-indigo-950">
              {formData.isMobileCompulsory && formData.isAadhaarCompulsory ? 'कडक (Strict KYC)' : 'सामान्य (Standard)'}
            </div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">व्हाउचर पासिंग नियम</div>
            <div className="text-xs font-black text-emerald-800">
              १००% मॅनेजर मंजुरी
            </div>
          </div>
        </div>
      </div>

      {/* 📝 3. MAIN SINGLE UNIFIED FORM */}
      <form onSubmit={handleSubmit} className="space-y-3">
        
        {/* SECTION 1: संस्थेची मूलभूत व कायदेशीर माहिती */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. संस्थेची मूलभूत व कायदेशीर माहिती (Basic & Legal Details)</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="sm:col-span-2">
              <label className={labelClass}>संस्थेचे पूर्ण नाव (Organization Name) <span className="text-red-500">*</span></label>
              <input 
                ref={sansthaNameInputRef}
                type="text" 
                name="sansthaName" 
                value={formData.sansthaName || ''} 
                onChange={handleChange} 
                required 
                className={`${inputClass} font-bold text-gray-900`} 
                placeholder="उदा. श्री समर्थ ग्रामीण बिगर शेती सह. पतसंस्था मर्यादित"
              />
            </div>

            <div>
              <label className={labelClass}>नोंदणी क्रमांक (Registration No)</label>
              <input 
                type="text" 
                name="registrationNo" 
                value={formData.registrationNo || ''} 
                onChange={handleChange} 
                className={inputClass} 
                placeholder="उदा. KOP/KVR/RSR/123/2015"
              />
            </div>

            <div>
              <label className={labelClass}>नोंदणी दिनांक (Registration Date)</label>
              <input 
                type="date" 
                name="registrationDate" 
                value={formData.registrationDate || ''} 
                onChange={handleChange} 
                className={inputClass} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-gray-100">
            <div>
              <label className={labelClass}>जीएसटी नंबर (GST No)</label>
              <input 
                type="text" 
                name="gstNo" 
                value={formData.gstNo || ''} 
                onChange={handleChange} 
                className={`${inputClass} uppercase font-mono`} 
                placeholder="27AAAAA0000A1Z5"
              />
            </div>

            <div>
              <label className={labelClass}>संपर्क क्रमांक (Contact No)</label>
              <input 
                type="text" 
                name="contactNo" 
                value={formData.contactNo || ''} 
                onChange={handleChange} 
                className={inputClass} 
                placeholder="उदा. 0231-2525255 / 9876543210"
              />
            </div>

            <div>
              <label className={labelClass}>ईमेल आयडी (Email ID)</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email || ''} 
                onChange={handleChange} 
                className={inputClass} 
                placeholder="info@sanstha.com"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: अधिकृत पत्ता व ठिकाण */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. अधिकृत पत्ता व ठिकाण (Registered Office Address)</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
            <div className="sm:col-span-2">
              <label className={labelClass}>पत्ता / गल्ली (Building / Street Address)</label>
              <input 
                type="text" 
                name="address" 
                value={formData.address || ''} 
                onChange={handleChange}
                className={inputClass} 
                placeholder="उदा. मुख्य चौक, मेन रोड" 
              />
            </div>

            <div>
              <label className={labelClass}>गाव / शहर (Village / City)</label>
              <input 
                type="text" 
                name="village" 
                value={formData.village || ''} 
                onChange={handleChange} 
                className={inputClass} 
                placeholder="उदा. देवाळे" 
              />
            </div>

            <div>
              <label className={labelClass}>तालुका (Taluka)</label>
              <input 
                type="text" 
                name="taluka" 
                value={formData.taluka || ''} 
                onChange={handleChange} 
                className={inputClass} 
                placeholder="उदा. करवीर" 
              />
            </div>

            <div>
              <label className={labelClass}>जिल्हा (District)</label>
              <input 
                type="text" 
                name="district" 
                value={formData.district || ''} 
                onChange={handleChange} 
                className={inputClass} 
                placeholder="उदा. कोल्हापूर" 
              />
            </div>

            <div>
              <label className={labelClass}>पिनकोड (Pin Code)</label>
              <input 
                type="text" 
                name="pinCode" 
                value={formData.pinCode || ''} 
                onChange={handleChange} 
                maxLength={6}
                className={`${inputClass} font-mono`} 
                placeholder="४१६२०१" 
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: खातेदार नोंदणी व केवायसी नियम */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">३. खातेदार नोंदणी व केवायसी पडताळणी नियम (Customer Registration & KYC Rules)</h2>
            </div>
            <span className="text-[10px] text-gray-500 font-medium">नवीन खातेदार व खाते उघडताना लागू होणारे नियम</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Rule 1: Mobile Compulsory */}
            <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 hover:bg-blue-50/50 p-2.5 rounded-sm border border-slate-200 transition select-none">
              <input
                type="checkbox"
                name="isMobileCompulsory"
                checked={formData.isMobileCompulsory !== false}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer mt-0.5"
              />
              <div className="text-[11px]">
                <span className="font-bold text-gray-900 block">📱 मोबाईल नंबर अनिवार्य</span>
                <span className="text-[10px] text-gray-500 font-normal leading-tight block mt-0.5">
                  खातेदार नोंदणीसाठी १० अंकी मोबाईल नंबर भरणे आवश्यक राहील.
                </span>
              </div>
            </label>

            {/* Rule 2: Aadhaar Compulsory */}
            <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 hover:bg-blue-50/50 p-2.5 rounded-sm border border-slate-200 transition select-none">
              <input
                type="checkbox"
                name="isAadhaarCompulsory"
                checked={formData.isAadhaarCompulsory !== false}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer mt-0.5"
              />
              <div className="text-[11px]">
                <span className="font-bold text-gray-900 block">🪪 आधार कार्ड अनिवार्य</span>
                <span className="text-[10px] text-gray-500 font-normal leading-tight block mt-0.5">
                  १२ अंकी आधार नंबर व ओळख पडताळणी बंधनकारक राहील.
                </span>
              </div>
            </label>

            {/* Rule 3: PAN Compulsory */}
            <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 hover:bg-blue-50/50 p-2.5 rounded-sm border border-slate-200 transition select-none">
              <input
                type="checkbox"
                name="isPanCompulsory"
                checked={Boolean(formData.isPanCompulsory)}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer mt-0.5"
              />
              <div className="text-[11px]">
                <span className="font-bold text-gray-900 block">💳 पॅन कार्ड अनिवार्य</span>
                <span className="text-[10px] text-gray-500 font-normal leading-tight block mt-0.5">
                  १० अक्षरी पॅन नंबर भरणे बंधनकारक राहील.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Section 4: FD Renewal Receipt Number Policy */}
        <div className="bg-white border border-gray-200 rounded-sm p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
            <div className="flex items-center gap-1.5">
              <FileBadge className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">४. मुदत ठेव नूतनीकरण पावती क्रमांक धोरण (FD Renewal Receipt No Policy)</h2>
            </div>
            <span className="text-[10px] text-gray-500 font-medium">मॅन्युअल व स्वयंचलित (Auto-Renewal) दोन्हीवर लागू</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[11px] font-bold text-slate-800 block mb-1">
                नूतनीकरणावेळी पावती क्रमांक कसा द्यावा?
              </label>
              <select
                name="fdRenewalReceiptPolicy"
                value={formData.fdRenewalReceiptPolicy || 'NEW_RECEIPT'}
                onChange={handleChange}
                className="w-full h-9 px-2.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-sm focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="NEW_RECEIPT">१. नवीन १४-अंकी CBS पावती क्रमांक द्या (Issue New CBS Receipt No)</option>
                <option value="RETAIN_ORIGINAL">२. पहिला मूळ पावती / जुना FD क्रमांक कायम ठेवा — Same (Retain Original)</option>
                <option value="NEXT_LEGACY">३. आपोआप पुढील जुना FD क्रमांक तयार करा — Next (Next Legacy No)</option>
                <option value="HYBRID_CHOICE">४. नूतनीकरणावेळी वापरकर्त्याला निवडू द्या (Allow Choice / Hybrid)</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                {formData.fdRenewalReceiptPolicy === 'RETAIN_ORIGINAL'
                  ? 'अंतर्गत CBS खाते क्रमांक १४-अंकी युनिक राहील, मात्र ग्राहक पावती व जुना क्र. पहिल्या ठेवीचा कायम (Same) ठेवला जाईल.'
                  : formData.fdRenewalReceiptPolicy === 'NEXT_LEGACY'
                  ? 'मॅन्युअल व ऑटो-रिन्यू दोन्हीमध्ये १४-अंकी CBS खाते क्र. सोबतच जुना / पावती क्रमांक (Legacy No) आपोआप पुढील क्रमाने तयार होईल.'
                  : formData.fdRenewalReceiptPolicy === 'HYBRID_CHOICE'
                  ? 'नूतनीकरण स्क्रीनवर नवीन CBS क्र., मूळ क्र. कायम (Same), किंवा पुढील जुना क्र. (Next) निवडता येईल.'
                  : 'प्रत्येक नूतनीकरणावेळी नवीन १४-अंकी CBS पावती क्रमांक तयार होईल.'}
              </p>
            </div>

            <label
              className={`flex items-start gap-2.5 p-2.5 rounded-sm border transition select-none self-start mt-1 ${
                formData.fdRenewalReceiptPolicy === 'RETAIN_ORIGINAL'
                  ? 'bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed'
                  : 'cursor-pointer bg-slate-50 hover:bg-blue-50/50 border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                name="allowManualReceiptNoOnRenewal"
                disabled={formData.fdRenewalReceiptPolicy === 'RETAIN_ORIGINAL'}
                checked={formData.fdRenewalReceiptPolicy === 'RETAIN_ORIGINAL' ? false : Boolean(formData.allowManualReceiptNoOnRenewal)}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer mt-0.5 disabled:cursor-not-allowed"
              />
              <div className="text-[11px]">
                <span className="font-bold text-gray-900 block">✍️ नूतनीकरणात मॅन्युअल / प्री-प्रिंटेड पावती क्र. मुभा</span>
                <span className="text-[10px] text-gray-500 font-normal leading-tight block mt-0.5">
                  {formData.fdRenewalReceiptPolicy === 'RETAIN_ORIGINAL'
                    ? 'मूळ पावती क्र. कायम धोरण सक्रिय असल्याने मॅन्युअल कस्टम पावती क्र. पर्याय बंद ठेवला आहे.'
                    : 'सुरू केल्यास नूतनीकरण करताना संस्थेचे प्री-प्रिंटेड पावती पुस्तक क्र. स्वतः टाकता येतील.'}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Form Action Footer */}
        <div className="pt-2 flex justify-end items-center gap-2 border-t border-gray-200">
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>रीसेट (Reset)</span>
          </button>

          <button 
            type="submit" 
            disabled={isSaving}
            className="px-6 py-2 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>सेव्ह होत आहे...</span>
              </>
            ) : (
              <>
                <CheckSquare size={14} />
                <span>💾 संस्था माहिती सेव्ह करा (Save Profile)</span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* Section 5: Authorised Share Capital & Bye-Law Register (Non-Accounting Statutory Memo) */}
      <div className="bg-white border border-gray-200 rounded-sm p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-primary">
              ५. अधिकृत भागभांडवल व उपविधी नोंदवही (Authorised Share Capital &amp; Bye-Law Register)
            </h2>
          </div>
          <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-semibold">
            ताळेबंद (Form &apos;N&apos;) वैधानिक मेमो नोंद — एकूण देयता बेरजेत समाविष्ट नाही
          </span>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-2">
            <span className="text-[10px] text-slate-500 block font-semibold">सद्य अधिकृत भागभांडवल (Authorised)</span>
            <span className="font-mono font-extrabold text-sm text-primary">
              ₹ {(capOverview?.currentAuthorizedCapital || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 block font-mono">
              {(capOverview?.currentAuthorizedShareCount || 0).toLocaleString('en-IN')} शेअर्स @ ₹{(capOverview?.currentShareFaceValue || 100).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-sm p-2">
            <span className="text-[10px] text-emerald-700 block font-semibold">प्रत्यक्ष वसुल भागभांडवल (Paid-Up)</span>
            <span className="font-mono font-extrabold text-sm text-emerald-800">
              ₹ {(capOverview?.paidUpShareCapital || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-700 block">सभासद शेअर्स खात्यांनुसार</span>
          </div>
          <div className="bg-amber-50/70 border border-amber-200 rounded-sm p-2">
            <span className="text-[10px] text-amber-800 block font-semibold">उर्वरित भागभांडवल मर्यादा (Remaining)</span>
            <span className="font-mono font-extrabold text-sm text-amber-900">
              ₹ {(capOverview?.remainingCapacity || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-amber-700 block">वापर: {(capOverview?.utilizationPercent || 0).toFixed(2)}%</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 flex flex-col justify-between">
            <span className="text-[10px] text-slate-600 font-semibold">मर्यादा वापर स्थिती (Utilization)</span>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden my-1">
              <div
                className={`h-full transition-all ${
                  (capOverview?.utilizationPercent || 0) >= 90
                    ? 'bg-red-600'
                    : (capOverview?.utilizationPercent || 0) >= 75
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(100, capOverview?.utilizationPercent || 0)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500">
              वाढ/घट करण्यासाठी खाली प्रभावी दिनांकासह नोंद जोडा
            </span>
          </div>
        </div>

        {capError && (
          <div className="bg-red-50 border border-red-300 text-red-800 text-xs px-3 py-2 rounded-sm flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{capError}</span>
          </div>
        )}
        {capSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs px-3 py-2 rounded-sm flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{capSuccess}</span>
          </div>
        )}

        {/* Revision Entry Form */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-sm p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800">
              {editingHistoryId ? '✏️ अधिकृत भागभांडवल नोंद दुरुस्त करा (Edit Revision)' : '➕ अधिकृत भागभांडवल वाढ / घट नोंदवा (Add Revision)'}
            </span>
            {editingHistoryId && (
              <button
                type="button"
                onClick={() => resetCapitalForm()}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                रद्द करा (Cancel Edit)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">प्रभावी दिनांक *</label>
              <input
                type="date"
                value={capEffectiveDate}
                onChange={(e) => setCapEffectiveDate(e.target.value)}
                className="w-full h-8 px-2 text-xs font-semibold bg-white border border-slate-300 rounded-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">अधिकृत भागभांडवल (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={capAmount}
                onChange={(e) => setCapAmount(e.target.value)}
                placeholder="उदा. 5000000"
                className="w-full h-8 px-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">शेअर दर्शनी मूल्य (₹)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={capFaceValue}
                onChange={(e) => setCapFaceValue(e.target.value)}
                className="w-full h-8 px-2 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">अधिकृत शेअर्स (Auto)</label>
              <input
                type="text"
                readOnly
                value={
                  parseFloat(capAmount) > 0 && parseFloat(capFaceValue) > 0
                    ? Math.floor(parseFloat(capAmount) / parseFloat(capFaceValue)).toLocaleString('en-IN')
                    : '0'
                }
                className="w-full h-8 px-2 text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300 rounded-sm"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">AGM ठराव क्र.</label>
              <input
                type="text"
                value={capResolutionNo}
                onChange={(e) => setCapResolutionNo(e.target.value)}
                placeholder="उदा. ठराव क्र. ५"
                className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">निबंधक मंजुरी क्र.</label>
              <input
                type="text"
                value={capApprovalNo}
                onChange={(e) => setCapApprovalNo(e.target.value)}
                placeholder="उदा. DDR/2025/12"
                className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <input
              type="text"
              value={capRemarks}
              onChange={(e) => setCapRemarks(e.target.value)}
              placeholder="शेरा / उपविधी दुरुस्ती तपशील (ऐच्छिक)"
              className="flex-1 min-w-[220px] h-8 px-2 text-xs bg-white border border-slate-300 rounded-sm focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveAuthorizedCapital}
              disabled={capSaving}
              className="h-8 px-4 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {capSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingHistoryId ? 'बदल अपडेट करा' : 'भागभांडवल नोंद जतन करा'}</span>
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="border border-slate-200 rounded-sm overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-2.5 py-1.5 text-left">प्रभावी दिनांक</th>
                <th className="px-2.5 py-1.5 text-right">अधिकृत भागभांडवल (₹)</th>
                <th className="px-2.5 py-1.5 text-right">दर्शनी मूल्य (₹)</th>
                <th className="px-2.5 py-1.5 text-right">अधिकृत शेअर्स</th>
                <th className="px-2.5 py-1.5 text-left">ठराव / निबंधक मंजुरी</th>
                <th className="px-2.5 py-1.5 text-left">शेरा</th>
                <th className="px-2.5 py-1.5 text-center w-24">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {capLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-500">लोड होत आहे...</td>
                </tr>
              ) : !capOverview?.history || capOverview.history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                    अद्याप कोणतीही अधिकृत भागभांडवल नोंद नाही. वरील फॉर्ममधून पहिली नोंद (उदा. ₹50,00,000) जोडा.
                  </td>
                </tr>
              ) : (
                capOverview.history.map((item, idx) => (
                  <tr key={item.historyID} className={idx === 0 ? 'bg-blue-50/40 font-semibold' : 'hover:bg-slate-50'}>
                    <td className="px-2.5 py-1.5 font-mono">
                      {item.effectiveDate ? item.effectiveDate.split('T')[0].split('-').reverse().join('/') : '-'}
                      {idx === 0 && (
                        <span className="ml-1.5 text-[9.5px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-bold">
                          सद्य लागू
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900">
                      ₹ {Number(item.authorizedCapitalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono">
                      ₹ {Number(item.shareFaceValue || 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono">
                      {Number(item.authorizedShareCount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-700">
                      {[item.resolutionNo, item.registrarApprovalNo].filter(Boolean).join(' • ') || '-'}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-600">{item.remarks || '-'}</td>
                    <td className="px-2.5 py-1.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditCapitalRow(item)}
                          className="p-1 text-blue-700 hover:bg-blue-100 rounded cursor-pointer"
                          title="दुरुस्त करा"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCapitalRow(item)}
                          className="p-1 text-red-700 hover:bg-red-100 rounded cursor-pointer"
                          title="हटवा"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
