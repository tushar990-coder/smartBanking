import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Building2, RefreshCw, CheckCircle2, ShieldCheck, MapPin, FileBadge, 
  RotateCcw, CheckSquare, Coins, IndianRupee, Phone, Mail, Calendar, 
  FileText, Shield, Sparkles
} from 'lucide-react';

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
  shareFaceValue?: number | string;
  authorizedShareCapital?: number | string;
  dividendRate?: number | string;
}

export default function SansthaMaster() {
  const [sansthaDetails, setSansthaDetails] = useState<SansthaDetail[]>([]);
  const [formData, setFormData] = useState<Partial<SansthaDetail>>({
    sansthaName: '', address: '', village: '', taluka: '', district: '', state: '', pinCode: '', contactNo: '', email: '', registrationNo: '', registrationDate: '', gstNo: '', logoPath: '', autoPostVouchers: true, autoPostVoucherLimit: 50000,
    isMobileCompulsory: true, isAadhaarCompulsory: true, isPanCompulsory: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_URL = '/api/SansthaDetails';
  const sansthaNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSansthaDetails();
    setTimeout(() => {
      if (sansthaNameInputRef.current) {
        sansthaNameInputRef.current.focus();
      }
    }, 150);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : e.target.type === 'number'
      ? (e.target.value === '' ? '' : e.target.value)
      : e.target.value;
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
        autoPostVouchers: formData.autoPostVouchers ?? true,
        autoPostVoucherLimit: Number(formData.autoPostVoucherLimit) || 50000,
        isMobileCompulsory: formData.isMobileCompulsory ?? true,
        isAadhaarCompulsory: formData.isAadhaarCompulsory ?? true,
        isPanCompulsory: formData.isPanCompulsory ?? false,
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
              पतसंस्थेची अधिकृत माहिती, नोंदणी तपशील, पत्ता, केवायसी अनिवार्यतेचे नियम व ऑटो-व्हाउचर मर्यादा व्यवस्थापन
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
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ऑटो-व्हाउचर मर्यादा</div>
            <div className="text-xs font-black text-amber-800 font-mono">
              ₹{(Number(formData.autoPostVoucherLimit) || 50000).toLocaleString('en-IN')}
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
            <span className="text-[10px] text-gray-500 font-medium">नवीन ग्राहक व खाते उघडताना लागू होणारे नियम</span>
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

        {/* SECTION 4: दैनंदिन व्हाउचर ऑटो-पोस्ट नियम */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">४. दैनंदिन व्हाउचर ऑटो-पोस्ट नियम (Daily Voucher Auto-Posting & Limit)</h2>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                id="autoPostVouchers" 
                name="autoPostVouchers" 
                checked={formData.autoPostVouchers !== false} 
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer" 
              />
              <span className="text-xs font-bold text-gray-900">
                व्हाउचर सेव्ह केल्यावर आपोआप पोस्ट करा (Auto-Post Vouchers)
              </span>
            </label>

            {formData.autoPostVouchers !== false && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center pt-2 border-t border-gray-100 animate-in fade-in duration-200">
                <div>
                  <label className={labelClass}>
                    ऑटो पोस्ट व्हाउचर मर्यादा (रक्कम ₹) / Auto-Post Limit (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-gray-500 font-bold">₹</span>
                    <input 
                      type="number" 
                      name="autoPostVoucherLimit" 
                      value={formData.autoPostVoucherLimit ?? 50000} 
                      onChange={handleChange} 
                      onFocus={(e) => e.target.select()} 
                      min="0" 
                      step="1000"
                      className={`${inputClass} pl-6 font-bold font-mono text-primary`} 
                      placeholder="उदा. 50000" 
                    />
                  </div>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 p-2 rounded-sm text-[10.5px] text-gray-700 leading-relaxed">
                  💡 <strong>नियम:</strong> या मर्यादेपर्यंतचे (उदा. <strong>₹{(formData.autoPostVoucherLimit ?? 50000).toLocaleString('en-IN')}</strong>) व्हाउचर सेव्ह करताच आपोआप मंजूर (Approved/Posted) होतील. यापेक्षा जास्त रक्कमेचे व्हाउचर मॅनेजर मंजुरीसाठी पेंडिंग (Pending) राहतील.
                </div>
              </div>
            )}
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
    </div>
  );
}
