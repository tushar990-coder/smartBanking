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
    financialYearID: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        
        setFormData(prev => ({
          ...prev,
          branchID: firstBranch ? (firstBranch.branchID ?? firstBranch.branchId ?? firstBranch.BranchID ?? '1').toString() : '1',
          financialYearID: activeFy ? (activeFy.financialYearID ?? activeFy.financialYearId ?? activeFy.FinancialYearID ?? '1').toString() : '1'
        }));
        
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/Auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          branchID: parseInt(formData.branchID || '1'),
          financialYearID: parseInt(formData.financialYearID || '1')
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
    <div className="min-h-screen flex items-center justify-center relative p-3 sm:p-4 overflow-hidden font-sans select-none bg-gradient-to-br from-[#ebf3f0] via-[#f7f5f7] to-[#ebe7f2]">
      
      {/* 🌸 Ambient Pastel Misty Auras (Soft Sage Mint, Warm Alabaster, Pale Lavender) */}
      <div className="absolute -top-[12%] -left-[10%] w-[520px] h-[520px] bg-[#dbece5]/75 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-[12%] -right-[10%] w-[540px] h-[540px] bg-[#e7e1ef]/75 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[22%] right-[20%] w-[380px] h-[380px] bg-[#fffbf5]/90 rounded-full blur-[90px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] left-[18%] w-[320px] h-[320px] bg-[#e4e9f4]/60 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Subtle Aesthetic Background Geometry (Connected Nodes / Clay Dots) */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <circle cx="15%" cy="20%" r="48" fill="rgba(255,255,255,0.7)" filter="drop-shadow(0 4px 12px rgba(180,165,175,0.12))" />
          <circle cx="85%" cy="25%" r="40" fill="rgba(255,255,255,0.6)" filter="drop-shadow(0 4px 10px rgba(180,165,175,0.1))" />
          <circle cx="20%" cy="80%" r="36" fill="rgba(255,255,255,0.6)" filter="drop-shadow(0 4px 10px rgba(180,165,175,0.1))" />
          <circle cx="82%" cy="78%" r="52" fill="rgba(255,255,255,0.7)" filter="drop-shadow(0 4px 12px rgba(180,165,175,0.12))" />
          <path d="M 15% 20% Q 50% 10% 85% 25%" stroke="rgba(195, 185, 195, 0.35)" strokeWidth="1.2" strokeDasharray="4 4" fill="none" />
          <path d="M 20% 80% Q 50% 90% 82% 78%" stroke="rgba(195, 185, 195, 0.35)" strokeWidth="1.2" strokeDasharray="4 4" fill="none" />
        </svg>
      </div>

      {/* 🪟 Main Frosted Ceramic / Clay Glass Card Container */}
      <div className="relative w-full max-w-[370px] rounded-3xl p-5 sm:p-6 backdrop-blur-2xl bg-white/80 border border-white/90 shadow-[0_22px_60px_-15px_rgba(65,45,60,0.1),0_2px_8px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(255,255,255,1)] z-10 transition-all duration-300 before:absolute before:inset-x-8 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center relative z-10 mb-4">
          
          {/* Signature Cocoa-Espresso Icon Badge (Matches Loomi3D Sparkle Badge) */}
          <div className="relative mb-2.5 group">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-[#824b52] to-[#2c1d24] rounded-2xl blur-xs opacity-25 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-[#7e474e] via-[#5c3339] to-[#2c1d24] shadow-[0_8px_20px_-4px_rgba(70,35,45,0.4),inset_0_1px_1px_rgba(255,255,255,0.35)] border border-[#9b636a]/40">
              <Landmark size={22} className="text-white drop-shadow-xs" />
            </div>
          </div>

          <h1 className="text-xl sm:text-[22px] font-black tracking-tight text-[#221a1f] flex items-center gap-1.5">
            SMART <span className="bg-gradient-to-r from-[#7e474e] via-[#5c3339] to-[#2c1d24] bg-clip-text text-transparent">BANKING</span>
          </h1>
          <p className="text-[10.5px] text-[#71636c] font-medium tracking-wide mt-0.5">
            स्मार्ट बँकिंग कोर सिस्टीम &bull; Core Banking ERP
          </p>

          {/* Aesthetic Pill Badge (Matches Sample's '✦ AI Magic' Chip) */}
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/75 border border-[#d8d0d5] text-[9.5px] font-semibold text-[#4a3d46] mt-2 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <Sparkles size={11} className="text-[#7e474e]" />
            <span>सुरक्षित बँकिंग पोर्टल (Secure Portal)</span>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="relative z-10 mb-3.5 p-2.5 rounded-xl bg-[#fff2f2]/95 border border-[#f2caca] text-[#8e2e2e] text-[11px] font-medium flex items-start gap-2 shadow-xs animate-shake">
            <AlertCircle size={14} className="text-[#a83333] shrink-0 mt-0.5" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="relative z-10 space-y-2.5">
          
          {/* 2-Column Compact Dropdowns */}
          <div className="grid grid-cols-2 gap-2">
            {/* Financial Year */}
            <div>
              <label className="block text-[9.5px] font-bold text-[#63545e] uppercase tracking-wider mb-1 truncate">
                आर्थिक वर्ष (FY)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#7a6b74] group-focus-within:text-[#7e474e] transition-colors">
                  <Calendar size={12} />
                </div>
                <select
                  name="financialYearID"
                  value={formData.financialYearID}
                  onChange={handleChange}
                  className="w-full pl-7 pr-5 py-1.5 bg-white/95 border border-[#e5dfe3] rounded-xl text-[11px] font-semibold text-[#251c22] placeholder-[#a699a2] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-[#cfc4cb] focus:bg-white focus:border-[#7e474e] focus:ring-2 focus:ring-[#7e474e]/20 focus:outline-none appearance-none cursor-pointer"
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
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[#7a6b74] group-focus-within:text-[#7e474e] transition-colors">
                  <ChevronDown size={12} />
                </div>
              </div>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-[9.5px] font-bold text-[#63545e] uppercase tracking-wider mb-1 truncate">
                शाखा (Branch)
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#7a6b74] group-focus-within:text-[#7e474e] transition-colors">
                  <Building2 size={12} />
                </div>
                <select
                  name="branchID"
                  value={formData.branchID}
                  onChange={handleChange}
                  className="w-full pl-7 pr-5 py-1.5 bg-white/95 border border-[#e5dfe3] rounded-xl text-[11px] font-semibold text-[#251c22] placeholder-[#a699a2] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-[#cfc4cb] focus:bg-white focus:border-[#7e474e] focus:ring-2 focus:ring-[#7e474e]/20 focus:outline-none appearance-none cursor-pointer"
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
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[#7a6b74] group-focus-within:text-[#7e474e] transition-colors">
                  <ChevronDown size={12} />
                </div>
              </div>
            </div>
          </div>

          {/* User ID Field */}
          <div>
            <label className="block text-[9.5px] font-bold text-[#63545e] uppercase tracking-wider mb-1">
              युझर आयडी (User ID)
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7a6b74] group-focus-within:text-[#7e474e] transition-colors">
                <User size={13} />
              </div>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full pl-8 pr-3 py-1.5 bg-white/95 border border-[#e5dfe3] rounded-xl text-xs font-semibold text-[#251c22] placeholder-[#a699a2] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-[#cfc4cb] focus:bg-white focus:border-[#7e474e] focus:ring-2 focus:ring-[#7e474e]/20 focus:outline-none"
                required
                placeholder="युझर नेम टाका"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password Field with Show/Hide Toggle */}
          <div>
            <label className="block text-[9.5px] font-bold text-[#63545e] uppercase tracking-wider mb-1">
              पासवर्ड (Password)
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7a6b74] group-focus-within:text-[#7e474e] transition-colors">
                <Lock size={13} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-8 pr-9 py-1.5 bg-white/95 border border-[#e5dfe3] rounded-xl text-xs font-semibold text-[#251c22] placeholder-[#a699a2] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-[#cfc4cb] focus:bg-white focus:border-[#7e474e] focus:ring-2 focus:ring-[#7e474e]/20 focus:outline-none"
                required
                placeholder="••••••••"
                autoComplete="current-password"
                data-lpignore="true"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#7a6b74] hover:text-[#7e474e] transition-colors cursor-pointer focus:outline-none"
                title={showPassword ? 'पासवर्ड लपवा' : 'पासवर्ड दाखवा'}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {/* 🌟 Signature Primary CTA Button (Matches Loomi3D 'Get Started' Button) */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-2xl font-bold text-xs text-white flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 bg-gradient-to-r from-[#824b52] via-[#5e343a] to-[#281a22] hover:from-[#92565e] hover:via-[#6c3c43] hover:to-[#32202a] active:scale-[0.98] shadow-[0_10px_25px_-5px_rgba(70,35,45,0.38),inset_0_1px_1px_rgba(255,255,255,0.35)] border border-[#9b636a]/40 disabled:opacity-60 disabled:cursor-not-allowed group"
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
        <div className="relative z-10 mt-3.5 pt-3 border-t border-[#ebe4e8] flex items-center justify-between text-[9px] text-[#7a6b74]">
          <span className="flex items-center gap-1 font-semibold text-[#5c343a] bg-[#7e474e]/10 px-2.5 py-0.5 rounded-full border border-[#7e474e]/20 backdrop-blur-xs">
            <ShieldCheck size={11} className="text-[#7e474e]" />
            256-Bit SSL सुरक्षित
          </span>
          <span className="text-[#8a7c85] font-medium">&copy; {new Date().getFullYear()} Smart Banking</span>
        </div>

      </div>
    </div>
  );
}
