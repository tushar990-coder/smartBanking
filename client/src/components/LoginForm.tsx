import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  Calendar, 
  User, 
  Lock, 
  ArrowRight, 
  ShieldCheck, 
  Landmark, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Sparkles,
  AlertCircle 
} from 'lucide-react';

export default function LoginForm() {
  const { login } = useAuth();
  
  const [branches, setBranches] = useState<any[]>([]);
  const [financialYears, setFinancialYears] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    username: 'admin',
    password: '',
    branchID: '',
    financialYearID: '',
    businessDate: ''
  });
  
  const [branchDateInfo, setBranchDateInfo] = useState<{
    businessDate?: string;
    isDayClosed?: boolean;
    lastClosedDate?: string;
  } | null>(null);
  const [dateWarning, setDateWarning] = useState<string>('');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const cachedSansthaName = typeof window !== 'undefined' ? (localStorage.getItem('cbs_sanstha_name') || '') : '';

  const fetchBranchBusinessDate = async (branchId: string) => {
    try {
      const res = await fetch(`/api/Auth/branch-business-date/${branchId}`);
      if (res.ok) {
        const data = await res.json();
        setBranchDateInfo(data);
        if (data.businessDate) {
          setFormData(prev => ({ ...prev, businessDate: data.businessDate }));
        }
      }
    } catch (err) {
      console.error("Failed to load branch business date", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        const [branchRes, fyRes] = await Promise.all([
          fetch('/api/Branches'),
          fetch('/api/FinancialYears')
        ]);
        const branchRaw = branchRes.ok ? await branchRes.json() : [];
        const fyRaw = fyRes.ok ? await fyRes.json() : [];
        
        const branchData: any[] = Array.isArray(branchRaw) ? branchRaw : (branchRaw?.value || []);
        const fyData: any[] = Array.isArray(fyRaw) ? fyRaw : (fyRaw?.value || []);
        
        if (!isMounted) return;

        setBranches(branchData);
        setFinancialYears(fyData);
        
        const activeFy = fyData.find((f: any) => f.isActive ?? f.IsActive) || fyData[0];
        const firstBranch = branchData[0];
        const initialBranchId = firstBranch ? (firstBranch.branchID ?? firstBranch.branchId ?? firstBranch.BranchID ?? '1').toString() : '1';
        
        setFormData(prev => ({
          ...prev,
          branchID: initialBranchId,
          financialYearID: activeFy ? (activeFy.financialYearID ?? activeFy.financialYearId ?? activeFy.FinancialYearID ?? '1').toString() : '1'
        }));

        fetchBranchBusinessDate(initialBranchId);
        
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load initial data", err);
          setFormData(prev => ({
            ...prev,
            branchID: prev.branchID || '1',
            financialYearID: prev.financialYearID || '1'
          }));
        }
      }
    };

    fetchInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const validateBusinessDate = (dateVal: string, fy: any, lastClosed?: string): string => {
    if (!dateVal) {
      return 'कृपया कामकाजाची तारीख प्रविष्ट करा.';
    }

    const parts = dateVal.split('-');
    if (parts.length !== 3) {
      return 'अवैध तारीख स्वरूप. कृपया योग्य तारीख प्रविष्ट करा.';
    }

    const year = parseInt(parts[0], 10);
    if (isNaN(year) || year < 2000 || year > 2099 || parts[0].length !== 4) {
      return `अवैध वर्ष (${parts[0]})! वर्ष 2000 ते 2099 दरम्यान ४ अंकी असणे आवश्यक आहे (उदा. 2026).`;
    }

    // Check Financial Year boundaries
    if (fy) {
      const fStart = (fy.startDate || fy.StartDate)?.split('T')[0];
      const fEnd = (fy.endDate || fy.EndDate)?.split('T')[0];
      const fCode = fy.yearCode || fy.YearCode || 'निवडलेल्या आर्थिक वर्षात';

      if (fStart && dateVal < fStart) {
        return `कामकाजाची तारीख ${fCode} या आर्थिक वर्षाच्या सुरुवातीपेक्षा (${new Date(fStart).toLocaleDateString('en-GB')}) जुनी असू शकत नाही.`;
      }
      if (fEnd && dateVal > fEnd) {
        return `कामकाजाची तारीख ${fCode} या आर्थिक वर्षाच्या अखेरपेक्षा (${new Date(fEnd).toLocaleDateString('en-GB')}) पुढील असू शकत नाही.`;
      }
    }

    // Check closed date
    if (lastClosed && dateVal <= lastClosed) {
      return `दिनांक ${new Date(dateVal).toLocaleDateString('en-GB')} चा दिवस आधीच दिवसअखेर करून बंद करण्यात आला आहे. बंद तारखेवर लॉगिन करता येणार नाही.`;
    }

    return '';
  };

  const handleDateBlur = () => {
    if (!formData.businessDate) return;
    const parts = formData.businessDate.split('-');
    if (parts.length === 3) {
      let year = parseInt(parts[0], 10);
      const month = parts[1];
      const day = parts[2];

      // Auto-correct 2-digit or short year (e.g. 26 or 0026 -> 2026)
      if (year > 0 && year < 100) {
        year = 2000 + year;
        const corrected = `${year.toString().padStart(4, '0')}-${month}-${day}`;
        setFormData(prev => ({ ...prev, businessDate: corrected }));
        const currentFy = financialYears.find(f => 
          (f.financialYearID ?? f.financialYearId ?? f.FinancialYearID)?.toString() === formData.financialYearID
        );
        const err = validateBusinessDate(corrected, currentFy, branchDateInfo?.lastClosedDate);
        setDateWarning(err);
        return;
      }
    }

    const currentFy = financialYears.find(f => 
      (f.financialYearID ?? f.financialYearId ?? f.FinancialYearID)?.toString() === formData.financialYearID
    );
    const err = validateBusinessDate(formData.businessDate, currentFy, branchDateInfo?.lastClosedDate);
    setDateWarning(err);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'branchID') {
      fetchBranchBusinessDate(value);
      setDateWarning('');
    } else if (name === 'financialYearID') {
      const nextFy = financialYears.find(f => 
        (f.financialYearID ?? f.financialYearId ?? f.FinancialYearID)?.toString() === value
      );
      if (formData.businessDate) {
        const warn = validateBusinessDate(formData.businessDate, nextFy, branchDateInfo?.lastClosedDate);
        setDateWarning(warn);
      }
    } else if (name === 'businessDate') {
      const currentFy = financialYears.find(f => 
        (f.financialYearID ?? f.financialYearId ?? f.FinancialYearID)?.toString() === formData.financialYearID
      );
      const warn = validateBusinessDate(value, currentFy, branchDateInfo?.lastClosedDate);
      setDateWarning(warn);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Strict Validation Gate
    const currentFy = financialYears.find(f => 
      (f.financialYearID ?? f.financialYearId ?? f.FinancialYearID)?.toString() === formData.financialYearID
    );
    const dateErr = validateBusinessDate(formData.businessDate, currentFy, branchDateInfo?.lastClosedDate);
    if (dateErr) {
      setError(dateErr);
      setDateWarning(dateErr);
      return;
    }

    if (dateWarning) {
      setError(dateWarning);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/Auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          branchID: parseInt(formData.branchID || '1'),
          financialYearID: parseInt(formData.financialYearID || '1'),
          businessDate: formData.businessDate ? formData.businessDate.split('T')[0] : null
        })
      });

      const text = await response.text();
      let data: any = text;
      try {
        data = JSON.parse(text);
      } catch {}

      if (!response.ok) {
        let errorMsg = 'लॉगिन अयशस्वी झाले. युझर आयडी किंवा पासवर्ड तपासा.';
        const raw = typeof data === 'string' ? data : (data?.message || '');
        if (raw.toLowerCase().includes('invalid username') || raw.toLowerCase().includes('invalid agent') || raw.toLowerCase().includes('incorrect password')) {
          errorMsg = 'चुकीचा युझर आयडी किंवा पासवर्ड. कृपया पुन्हा तपासा.';
        } else if (raw.toLowerCase().includes('locked')) {
          errorMsg = 'वारंवार चुकीच्या प्रयत्नांमुळे खाते लॉक झाले आहे. कृपया ॲडमिनशी संपर्क साधा.';
        } else if (raw.toLowerCase().includes('inactive')) {
          errorMsg = 'हे युझर खाते निष्क्रिय (Inactive) आहे.';
        } else if (raw) {
          errorMsg = raw;
        }
        throw new Error(errorMsg);
      }

      login(data);
    } catch (err: any) {
      console.error('Login submission error:', err);
      const msg = err?.message;
      if (!msg || msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('fetch')) {
        setError('बॅकएंड सर्व्हरशी संपर्क होऊ शकला नाही. कृपया सर्व्हर सुरू असल्याची खात्री करा.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative p-3 sm:p-5 overflow-hidden font-sans select-none"
      style={{
        background:
          'radial-gradient(circle at 16% 16%, rgba(251,214,205,0.62) 0%, rgba(251,214,205,0) 48%), radial-gradient(circle at 86% 14%, rgba(254,226,184,0.72) 0%, rgba(254,226,184,0) 46%), radial-gradient(circle at 76% 80%, rgba(253,213,155,0.58) 0%, rgba(253,213,155,0) 46%), radial-gradient(circle at 14% 82%, rgba(245,204,196,0.52) 0%, rgba(245,204,196,0) 48%), linear-gradient(135deg, #FDF2EE 0%, #FFFBF7 44%, #FEF3E2 80%, #FCE3BE 100%)',
      }}
    >
      {/* Soft Faint Pastel Maroon-Peach-Gold Pure-Vector Wave Canvas (Zero Images) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-24 -left-20 w-[440px] h-[440px] rounded-full opacity-35 blur-3xl"
          style={{ background: 'radial-gradient(circle, #E2A396 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-10 right-8 w-[480px] h-[480px] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #FCD396 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-14 left-1/3 w-[540px] h-[340px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #FDBA74 0%, transparent 72%)' }}
        />

        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage: 'radial-gradient(#B45309 0.8px, transparent 0.8px)',
            backgroundSize: '28px 28px',
          }}
        />

        <svg
          viewBox="0 0 1440 520"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full h-[58%] opacity-90"
        >
          <defs>
            <linearGradient id="loginPastelWave1" x1="0%" y1="50%" x2="100%" y2="30%">
              <stop offset="0%" stopColor="#A94438" stopOpacity="0.20" />
              <stop offset="38%" stopColor="#D97742" stopOpacity="0.18" />
              <stop offset="72%" stopColor="#F59E0B" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#EA8C2E" stopOpacity="0.24" />
            </linearGradient>
            <linearGradient id="loginPastelWave2" x1="0%" y1="60%" x2="100%" y2="40%">
              <stop offset="0%" stopColor="#B9584A" stopOpacity="0.14" />
              <stop offset="45%" stopColor="#F59E0B" stopOpacity="0.18" />
              <stop offset="80%" stopColor="#FBBF24" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="loginPastelWave3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
              <stop offset="50%" stopColor="#FFF7ED" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FDE6C4" stopOpacity="0.52" />
            </linearGradient>
          </defs>

          <path
            d="M0,260 C210,165 390,340 660,245 C920,155 1170,110 1440,195 L1440,520 L0,520 Z"
            fill="url(#loginPastelWave1)"
          />
          <path
            d="M0,335 C260,235 480,385 780,280 C1050,185 1250,240 1440,150 L1440,520 L0,520 Z"
            fill="url(#loginPastelWave2)"
          />
          <path
            d="M0,400 C320,320 620,445 960,365 C1190,310 1330,335 1440,295 L1440,520 L0,520 Z"
            fill="url(#loginPastelWave3)"
          />
        </svg>
      </div>

      {/* Top Subtle Status Pill (Matches Dashboard Top Strip) */}
      <div className="relative z-10 mb-3.5 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/82 backdrop-blur-md border border-amber-200/80 shadow-xs text-[11px] font-bold text-[#6B2118]">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>SMART BANKING CBS</span>
        <span className="text-amber-300">&bull;</span>
        <span className="text-[#8C4A32] font-semibold">को-ऑपरेटिव्ह कोर बँकिंग प्रणाली</span>
      </div>

      {/* Main Warm Ivory Frosted Glass Login Card */}
      <div className="relative w-full max-w-[400px] rounded-[26px] overflow-hidden backdrop-blur-2xl bg-white/92 border border-amber-200/80 shadow-[0_24px_65px_-14px_rgba(124,36,24,0.18),0_4px_14px_rgba(90,26,20,0.06),inset_0_1px_2px_rgba(255,255,255,1)] z-10 transition-all duration-300">
        {/* Top Maroon-Saffron Accent Strip */}
        <div
          className="h-1.5 w-full"
          style={{
            background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)',
          }}
        />

        <div className="p-5 sm:p-6">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center relative z-10 mb-4">
            <div className="relative mb-3 group">
              <div
                className="absolute inset-0 rounded-2xl blur-lg opacity-35 scale-110 group-hover:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #8C2D19 0%, #D97706 60%, #F59E0B 100%)' }}
              />
              <div
                className="relative w-[54px] h-[54px] rounded-[18px] flex items-center justify-center text-white shadow-[0_10px_24px_rgba(124,36,24,0.32)] border border-white/50"
                style={{
                  background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)',
                }}
              >
                <Landmark size={24} className="text-white drop-shadow-xs" strokeWidth={2} />
              </div>
            </div>

            <h1 className="text-xl sm:text-[23px] font-black tracking-tight text-[#5A1A14] flex items-center gap-1.5">
              SMART{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg, #7C2418 0%, #B44814 52%, #D97706 100%)' }}
              >
                BANKING
              </span>
            </h1>

            {cachedSansthaName && cachedSansthaName !== 'तुमची संस्था' ? (
              <p className="text-[11px] text-[#7C2418] font-bold tracking-tight mt-0.5 line-clamp-1 max-w-full px-2">
                {cachedSansthaName}
              </p>
            ) : (
              <p className="text-[10.5px] text-[#8C5E4F] font-semibold tracking-wide mt-0.5">
                स्मार्ट बँकिंग कोर सिस्टीम &bull; Core Banking ERP
              </p>
            )}

            <div
              className="w-20 h-0.5 rounded-full my-2 opacity-85"
              style={{
                background: 'linear-gradient(90deg, #7C2418 0%, #D97706 55%, #F59E0B 100%)',
              }}
            />

            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-50/90 border border-amber-200/85 text-[9.5px] font-bold text-[#9A3412] shadow-2xs">
              <Sparkles size={11} className="text-[#D97706]" />
              <span>सुरक्षित बँकिंग पोर्टल (Secure Portal)</span>
            </div>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div className="relative z-10 mb-3.5 p-2.5 rounded-xl bg-rose-50/95 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-start gap-2 shadow-xs animate-shake">
              <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-2.5">
            {/* 2-Column Compact Dropdowns */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Financial Year */}
              <div>
                <label className="block text-[9.5px] font-bold text-[#6E493C] uppercase tracking-wider mb-1 truncate">
                  आर्थिक वर्ष (FY)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#A8897C] group-focus-within:text-[#B44814] transition-colors">
                    <Calendar size={12} />
                  </div>
                  <select
                    name="financialYearID"
                    value={formData.financialYearID}
                    onChange={handleChange}
                    className="w-full pl-7 pr-5 py-1.5 bg-white/95 border border-amber-200/90 rounded-xl text-[11px] font-semibold text-[#4A1410] placeholder-[#A8897C] shadow-2xs transition-all hover:border-amber-300 focus:bg-white focus:border-[#B44814] focus:ring-2 focus:ring-[#B44814]/15 focus:outline-none appearance-none cursor-pointer"
                    required
                  >
                    {financialYears.length === 0 ? (
                      <option value="1">2026-2027</option>
                    ) : (
                      financialYears.map((fy: any, idx: number) => {
                        const id = (fy.financialYearID ?? fy.financialYearId ?? fy.FinancialYearID ?? idx + 1).toString();
                        const name = fy.yearCode ?? fy.YearCode ?? fy.name ?? '2026-2027';
                        return (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        );
                      })
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[#A8897C] group-focus-within:text-[#B44814] transition-colors">
                    <ChevronDown size={12} />
                  </div>
                </div>
              </div>

              {/* Branch */}
              <div>
                <label className="block text-[9.5px] font-bold text-[#6E493C] uppercase tracking-wider mb-1 truncate">
                  शाखा (Branch)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#A8897C] group-focus-within:text-[#B44814] transition-colors">
                    <Building2 size={12} />
                  </div>
                  <select
                    name="branchID"
                    value={formData.branchID}
                    onChange={handleChange}
                    className="w-full pl-7 pr-5 py-1.5 bg-white/95 border border-amber-200/90 rounded-xl text-[11px] font-semibold text-[#4A1410] placeholder-[#A8897C] shadow-2xs transition-all hover:border-amber-300 focus:bg-white focus:border-[#B44814] focus:ring-2 focus:ring-[#B44814]/15 focus:outline-none appearance-none cursor-pointer"
                    required
                  >
                    {branches.length === 0 ? (
                      <option value="1">मुख्य शाखा</option>
                    ) : (
                      branches.map((b: any, idx: number) => {
                        const id = (b.branchID ?? b.branchId ?? b.BranchID ?? idx + 1).toString();
                        const name = b.branchName ?? b.BranchName ?? b.name ?? 'मुख्य शाखा';
                        return (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        );
                      })
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[#A8897C] group-focus-within:text-[#B44814] transition-colors">
                    <ChevronDown size={12} />
                  </div>
                </div>
              </div>
            </div>

            {/* Business Date Selection Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[9.5px] font-bold text-[#6E493C] uppercase tracking-wider">
                  कामकाजाची तारीख (Business Date)
                </label>
                {branchDateInfo && (
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      branchDateInfo.isDayClosed
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {branchDateInfo.isDayClosed ? '⚠️ दिवस बंद (Closed)' : '🟢 दिवस चालू (Open)'}
                  </span>
                )}
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#A8897C] group-focus-within:text-[#B44814] transition-colors">
                  <Calendar size={12} />
                </div>
                {(() => {
                  const currentFy = financialYears.find(f =>
                    (f.financialYearID ?? f.financialYearId ?? f.FinancialYearID)?.toString() === formData.financialYearID
                  );
                  const fyMin = (currentFy?.startDate || currentFy?.StartDate)?.split('T')[0] || '2000-01-01';
                  const fyMax = (currentFy?.endDate || currentFy?.EndDate)?.split('T')[0] || '2099-12-31';
                  return (
                    <input
                      type="date"
                      name="businessDate"
                      value={formData.businessDate}
                      onChange={handleChange}
                      onBlur={handleDateBlur}
                      min={fyMin}
                      max={fyMax}
                      className={`w-full pl-7 pr-3 py-1.5 bg-white/95 border rounded-xl text-[11px] font-mono font-bold text-[#4A1410] shadow-2xs transition-all focus:bg-white focus:outline-none ${
                        dateWarning
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-amber-200/90 hover:border-amber-300 focus:border-[#B44814] focus:ring-2 focus:ring-[#B44814]/15'
                      }`}
                      required
                    />
                  );
                })()}
              </div>
              {dateWarning ? (
                <p className="text-[9.5px] text-rose-600 font-bold mt-1 flex items-center gap-1 leading-tight">
                  <span>⛔</span> <span>{dateWarning}</span>
                </p>
              ) : branchDateInfo?.lastClosedDate ? (
                <p className="text-[9.5px] text-[#8C5E4F] mt-0.5 font-medium">
                  शेवटचा बंद दिवस:{' '}
                  <span className="font-mono font-bold text-[#4A1410]">
                    {new Date(branchDateInfo.lastClosedDate).toLocaleDateString('en-GB')}
                  </span>
                </p>
              ) : null}
            </div>

            {/* User ID Field */}
            <div>
              <label className="block text-[9.5px] font-bold text-[#6E493C] uppercase tracking-wider mb-1">
                युझर आयडी (User ID)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A8897C] group-focus-within:text-[#B44814] transition-colors">
                  <User size={13} />
                </div>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-8 pr-3 py-1.5 bg-white/95 border border-amber-200/90 rounded-xl text-xs font-semibold text-[#4A1410] placeholder-[#A8897C] shadow-2xs transition-all hover:border-amber-300 focus:bg-white focus:border-[#B44814] focus:ring-2 focus:ring-[#B44814]/15 focus:outline-none"
                  required
                  placeholder="युझर नेम टाका"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div>
              <label className="block text-[9.5px] font-bold text-[#6E493C] uppercase tracking-wider mb-1">
                पासवर्ड (Password)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A8897C] group-focus-within:text-[#B44814] transition-colors">
                  <Lock size={13} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-8 pr-9 py-1.5 bg-white/95 border border-amber-200/90 rounded-xl text-xs font-semibold text-[#4A1410] placeholder-[#A8897C] shadow-2xs transition-all hover:border-amber-300 focus:bg-white focus:border-[#B44814] focus:ring-2 focus:ring-[#B44814]/15 focus:outline-none"
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  data-lpignore="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A8897C] hover:text-[#B44814] transition-colors cursor-pointer focus:outline-none"
                  title={showPassword ? 'पासवर्ड लपवा' : 'पासवर्ड दाखवा'}
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            {/* Signature Maroon-Saffron Primary CTA Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-2xl font-bold text-xs text-white flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] shadow-[0_12px_28px_-6px_rgba(124,36,24,0.42),inset_0_1px_1px_rgba(255,255,255,0.35)] border border-white/25 disabled:opacity-60 disabled:cursor-not-allowed group"
                style={{
                  background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)',
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    प्रमाणिकरण करत आहे...
                  </span>
                ) : (
                  <>
                    <span className="tracking-wide">लॉगिन करा (Sign In)</span>
                    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Security Badges */}
          <div className="relative z-10 mt-4 pt-3 border-t border-amber-200/70 flex items-center justify-between text-[9.5px] text-[#8C5E4F]">
            <span className="flex items-center gap-1 font-bold text-[#7C2418] bg-amber-50/90 px-2.5 py-0.5 rounded-full border border-amber-200/80">
              <ShieldCheck size={11} className="text-emerald-600" />
              256-Bit SSL सुरक्षित
            </span>
            <span className="text-[#8C5E4F] font-semibold">&copy; {new Date().getFullYear()} Smart Banking CBS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
