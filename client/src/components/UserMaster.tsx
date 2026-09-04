import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, RefreshCw, CheckCircle2, ShieldCheck, ShieldAlert, Lock, 
  Unlock, KeyRound, Edit2, Plus, RotateCcw, CheckSquare, Layers, 
  Search, Building2, UserCheck, Shield
} from 'lucide-react';

interface Role {
  roleID: number;
  roleName: string;
}

interface Branch {
  branchID: number;
  branchName: string;
}

interface User {
  userID: number;
  username: string;
  roleID: number;
  roleName: string;
  defaultBranchID: number | null;
  branchName: string;
  isActive: boolean;
  isLocked: boolean;
  failedLoginAttempts: number;
  requirePasswordChange: boolean;
  lastLoginDate: string | null;
}

export default function UserMaster() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    userID: 0,
    username: '',
    roleID: '',
    defaultBranchID: '',
    isActive: true
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchBranches();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/Users');
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/Users/Roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch roles", err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/Branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(Array.isArray(data) ? data : []);
        if (data.length > 0) {
          setFormData(prev => prev.defaultBranchID ? prev : { ...prev, defaultBranchID: data[0].branchID.toString() });
        }
      }
    } catch (err) {
      console.error("Failed to fetch branches", err);
    }
  };

  const resetForm = () => {
    setFormData({
      userID: 0,
      username: '',
      roleID: roles.length > 0 ? roles[0].roleID.toString() : '',
      defaultBranchID: branches.length > 0 ? branches[0].branchID.toString() : '',
      isActive: true
    });
    setIsEditing(false);
    setShowForm(false);
    setError('');
    setSuccessMsg('');
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
    setTimeout(() => {
      if (formContainerRef.current) {
        formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      usernameInputRef.current?.focus();
    }, 100);
  };

  const handleEdit = (user: User) => {
    setFormData({
      userID: user.userID,
      username: user.username,
      roleID: user.roleID.toString(),
      defaultBranchID: user.defaultBranchID ? user.defaultBranchID.toString() : '',
      isActive: user.isActive
    });
    setIsEditing(true);
    setShowForm(true);

    setTimeout(() => {
      if (formContainerRef.current) {
        formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (usernameInputRef.current && user.username !== 'admin') {
        usernameInputRef.current.focus();
        usernameInputRef.current.select();
      }
    }, 120);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    const payload = {
      username: formData.username.trim(),
      roleID: parseInt(formData.roleID),
      defaultBranchID: formData.defaultBranchID ? parseInt(formData.defaultBranchID) : null,
      isActive: formData.isActive
    };

    try {
      const url = isEditing ? `/api/Users/${formData.userID}` : '/api/Users';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errText = 'ऑपरेशन अयशस्वी झाले.';
        try {
          const text = await res.text();
          if (text) {
            try {
              const json = JSON.parse(text);
              errText = json.message || json.title || (typeof json === 'string' ? json : text);
            } catch {
              errText = text;
            }
          }
        } catch {}
        throw new Error(errText);
      }

      setSuccessMsg(isEditing ? 'युजर यशस्वीरित्या अपडेट केला!' : "नवीन युजर तयार केला! (डिफॉल्ट पासवर्ड: 'Welcome@123')");
      fetchUsers();
      
      if (!isEditing) {
        setTimeout(resetForm, 2500);
      } else {
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'युजर सेव्ह करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे का की या युजरचा पासवर्ड रिसेट करायचा आहे? पासवर्ड 'Welcome@123' असा सेट केला जाईल.")) {
      return;
    }
    
    try {
      const res = await fetch(`/api/Users/${id}/reset-password`, { method: 'POST' });
      if (res.ok) {
        alert("पासवर्ड रिसेट यशस्वी झाला! नवीन पासवर्ड: Welcome@123");
        fetchUsers();
      } else {
        alert("पासवर्ड रिसेट करताना त्रुटी आली.");
      }
    } catch (err) {
      alert("सर्व्हरशी संपर्क साधताना त्रुटी आली.");
    }
  };

  const handleToggleLock = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? 'अनलॉक (Unlock)' : 'लॉक (Lock)';
    if (!window.confirm(`तुम्हाला खात्री आहे का की हे अकाउंट ${action} करायचे आहे?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/Users/${id}/toggle-lock`, { method: 'POST' });
      if (res.ok) {
        alert(`अकाउंट यशस्वीरित्या ${currentStatus ? 'अनलॉक' : 'लॉक'} केले!`);
        fetchUsers();
      } else {
        alert(`अकाउंट ${action} करताना त्रुटी आली.`);
      }
    } catch (err) {
      alert("सर्व्हरशी संपर्क साधताना त्रुटी आली.");
    }
  };

  const filteredUsers = users.filter(u =>
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.roleName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.branchName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers = users.length;
  const activeUsersCount = users.filter(u => u.isActive && !u.isLocked).length;
  const lockedUsersCount = users.filter(u => u.isLocked).length;
  const rolesCount = roles.length;

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans pb-8">
      
      {/* 🌟 1. TOP SLEEK CBS HEADER BANNER */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <ShieldCheck size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>युजर व्यवस्थापन व सुरक्षा मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(User & Access Role Management)</span>
              {isEditing && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.userID})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              सिस्टीम वापरकर्ते (Users), प्रवेश अधिकार (Roles), शाखा संलग्नता आणि पासवर्ड सुरक्षा व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {showForm && (
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="फॉर्म बंद करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>रद्द करा</span>
            </button>
          )}

          {!showForm && (
            <button
              type="button"
              onClick={handleAddNew}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="नवीन युजर जोडा"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>नवीन युजर</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchUsers}
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
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण युजर्स</div>
            <div className="text-sm font-black text-gray-900">{totalUsers}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय युजर्स</div>
            <div className="text-sm font-black text-emerald-800">{activeUsersCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">लॉक अकाउंट्स</div>
            <div className="text-sm font-black text-rose-800">{lockedUsersCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">उपलब्ध रोल्स</div>
            <div className="text-sm font-black text-amber-800">{rolesCount}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-3 p-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm text-xs font-bold flex justify-between items-center shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {error && (
        <div className="mb-3 p-2 bg-red-50 text-red-800 border border-red-300 rounded-sm text-xs font-bold flex justify-between items-center shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* 📝 3. USER REGISTRATION & EDIT FORM */}
      {showForm && (
        <div 
          ref={formContainerRef}
          className={`bg-white p-3.5 rounded-sm shadow-xs border transition-all duration-300 mb-3 ${
            isEditing ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
              <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-bold text-primary">
                    {isEditing ? `१. युजर माहिती संपादन (युझर: ${formData.username})` : '१. नवीन युजर तयार करा (User Registration & Access Role)'}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelClass}>युझरनेम (Username) <span className="text-red-500">*</span></label>
                  <input
                    ref={usernameInputRef}
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    placeholder="उदा. rohit_p"
                    className={`${inputClass} font-bold text-gray-900 ${
                      isEditing ? 'bg-amber-50/60 font-semibold' : ''
                    }`}
                    required
                    disabled={isEditing && formData.username === 'admin'}
                  />
                </div>
                
                <div>
                  <label className={labelClass}>प्रवेश अधिकार रोल (Role) <span className="text-red-500">*</span></label>
                  <select
                    value={formData.roleID}
                    onChange={e => setFormData({...formData, roleID: e.target.value})}
                    className={`${inputClass} font-bold`}
                    required
                  >
                    <option value="">-- रोल निवडा --</option>
                    {roles.map(r => (
                      <option key={r.roleID} value={r.roleID}>{r.roleName}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className={labelClass}>डिफॉल्ट शाखा (Default Branch)</label>
                  <select
                    value={formData.defaultBranchID}
                    onChange={e => setFormData({...formData, defaultBranchID: e.target.value})}
                    className={inputClass}
                  >
                    <option value="">-- सर्व शाखा (All Branches) --</option>
                    {branches.map(b => (
                      <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-1.5 pt-4">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="isActive" className="text-[11px] font-bold text-gray-800 cursor-pointer select-none">
                    सक्रिय युजर (Active User)
                  </label>
                </div>
              </div>

              {!isEditing && (
                <div className="pt-2 border-t border-gray-100 text-[10.5px] text-gray-600">
                  💡 <strong>टीप:</strong> नवीन तयार होणाऱ्या युजरचा प्राथमिक पासवर्ड <strong>'Welcome@123'</strong> असा असेल. युजर पहिल्या लॉगिनवेळी पासवर्ड बदलू शकेल.
                </div>
              )}
            </div>

            {/* Form Action Footer */}
            <div className="pt-2 flex justify-end items-center gap-2 border-t border-gray-200">
              <button 
                type="button" 
                onClick={resetForm}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>रद्द करा</span>
              </button>

              <button 
                type="submit" 
                disabled={loading}
                className="px-6 py-2 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{loading ? 'जतन होत आहे...' : (isEditing ? '✏️ युजर अपडेट करा' : '💾 युजर सेव्ह करा')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 📜 4. REGISTERED USERS TABLE */}
      <div className="bg-white rounded-sm shadow-xs overflow-hidden border border-gray-200 border-t-2 border-primary">
        <div className="bg-slate-50 px-3.5 py-2 border-b border-gray-200 font-bold text-gray-900 flex justify-between items-center text-xs flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-primary">
            <Layers className="w-4 h-4 text-primary" />
            <span>नोंदणीकृत युजर्स यादी (Registered Users Directory - {filteredUsers.length})</span>
          </span>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="युझरनेम, रोल किंवा शाखा शोधा..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 text-[11px] border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-[28px] w-64"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="p-2 border-r border-gray-200 text-center w-12">ID</th>
                <th className="p-2 border-r border-gray-200">युझरनेम (Username)</th>
                <th className="p-2 border-r border-gray-200">रोल (Role)</th>
                <th className="p-2 border-r border-gray-200">डिफॉल्ट शाखा (Branch)</th>
                <th className="p-2 border-r border-gray-200 text-center">स्थिती (Status)</th>
                <th className="p-2 text-center w-40">सुरक्षा कृती (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400 italic">
                    कोणतेही युजर्स सापडले नाहीत.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.userID} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-2 border-r border-gray-200 text-center font-mono text-gray-600">{user.userID}</td>
                    <td className="p-2 border-r border-gray-200 font-bold text-gray-900">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span>{user.username}</span>
                      </div>
                      {user.lastLoginDate && (
                        <div className="text-[9.5px] text-gray-500 font-normal">
                          शेवटचा लॉगिन: {new Date(user.lastLoginDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border-r border-gray-200">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        🛡️ {user.roleName}
                      </span>
                    </td>
                    <td className="p-2 border-r border-gray-200 text-gray-800 font-medium">
                      {user.branchName ? `🏢 ${user.branchName}` : '🌐 सर्व शाखा (All)'}
                    </td>
                    <td className="p-2 border-r border-gray-200 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {user.isActive ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            सक्रिय
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-300">
                            निष्क्रिय
                          </span>
                        )}
                        {user.isLocked && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            🔒 लॉक
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => handleEdit(user)}
                          className="px-2 py-0.5 bg-blue-50 text-primary hover:bg-blue-100 border border-blue-200 rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                          title="माहिती संपादन करा"
                        >
                          <Edit2 size={11} />
                          <span>एडिट</span>
                        </button>
                        
                        <button 
                          onClick={() => handleResetPassword(user.userID)}
                          className="px-2 py-0.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                          title="पासवर्ड Welcome@123 वर रिसेट करा"
                        >
                          <KeyRound size={11} />
                          <span>पासवर्ड रिसेट</span>
                        </button>

                        <button 
                          onClick={() => handleToggleLock(user.userID, user.isLocked)}
                          className={`px-2 py-0.5 border rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5 ${
                            user.isLocked 
                              ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300' 
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-300'
                          }`}
                          title={user.isLocked ? 'अकाउंट अनलॉक करा' : 'अकाउंट लॉक करा'}
                        >
                          {user.isLocked ? <Unlock size={11} /> : <Lock size={11} />}
                          <span>{user.isLocked ? 'अनलॉक' : 'लॉक'}</span>
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
