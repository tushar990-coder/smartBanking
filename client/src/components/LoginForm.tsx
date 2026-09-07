import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, Calendar, User, Lock, ArrowRight, ShieldCheck, Landmark, ChevronDown } from 'lucide-react';

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
          // Set safe defaults
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
    setFormData({...formData, [e.target.name]: e.target.value});
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
        throw new Error(typeof data === 'string' ? data : (data?.message || 'लॉगिन अयशस्वी झाले. युझरनेम किंवा पासवर्ड तपासा.'));
      }

      login(data);
    } catch (err: any) {
      console.error('Login submission error:', err);
      setError(err?.message || 'लॉगिन अयशस्वी झाले. कृपया माहिती तपासा.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 relative p-4 overflow-hidden font-sans">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Compact & Sleek Main Card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden z-10 border border-slate-200/80 transition-all duration-300">
        
        {/* Top Hero Banner - Dark Slate to Emerald */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0E8A5A] to-emerald-950 text-white p-5 text-center relative overflow-hidden">
          {/* Subtle Glass Accents */}
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-md border border-white/20 mb-2 shadow-inner">
              <Landmark size={26} className="text-emerald-300" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">
              SMART <span className="text-emerald-400">BANKING</span>
            </h1>
            <p className="text-[11px] text-slate-200/90 font-medium tracking-wide mt-0.5">
              स्मार्ट बँकिंग कोर सिस्टीम (Core Banking ERP)
            </p>
          </div>
        </div>

        {/* Compact Form Body */}
        <div className="p-5 bg-white">
          {error && (
            <div className="bg-red-50 text-red-700 p-2.5 rounded-lg mb-3 text-xs font-semibold flex items-center gap-2 border border-red-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            
            {/* 2-Column Compact Dropdowns */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  आर्थिक वर्ष (FY)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Calendar size={14} />
                  </div>
                  <select
                    name="financialYearID"
                    value={formData.financialYearID}
                    onChange={handleChange}
                    className="block w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
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
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  शाखा (Branch)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 size={14} />
                  </div>
                  <select
                    name="branchID"
                    value={formData.branchID}
                    onChange={handleChange}
                    className="block w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
                    required
                  >
                    {branches.length === 0 ? (
                      <option value="1">मुख्य शाखा (Main Branch)</option>
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
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </div>

            {/* User ID Field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                युझर आयडी (User ID)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <User size={14} />
                </div>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="block w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                  required
                  placeholder="युझर नेम टाका"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                पासवर्ड (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={14} />
                </div>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                  required
                  placeholder="••••••••"
                  autoComplete="new-password"
                  data-lpignore="true"
                />
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-slate-900 via-[#0E8A5A] to-emerald-950 text-white py-2 px-4 rounded-md text-xs font-bold shadow-md hover:brightness-110 transition-all cursor-pointer disabled:opacity-70 group"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    प्रमाणिकरण चालू आहे...
                  </span>
                ) : (
                  <>
                    <span>लॉगिन करा (Sign In)</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Security Badge */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-emerald-800">
              <ShieldCheck size={12} className="text-emerald-600" /> सुरक्षीत 256-Bit SSL
            </span>
            <span>&copy; {new Date().getFullYear()} Smart Banking</span>
          </div>
        </div>

      </div>
    </div>
  );
}
