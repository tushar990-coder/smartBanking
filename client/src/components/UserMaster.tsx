import React, { useState, useEffect, useRef } from 'react';
import {
  Users, RefreshCw, CheckCircle2, ShieldCheck, ShieldAlert, Lock,
  Unlock, KeyRound, Edit2, Plus, RotateCcw, CheckSquare, Layers,
  Search, UserCheck, Shield, Crown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSuperAdminRole, isAdminOrSuperAdminRole } from '../utils/permissionUtils';

interface Role {
  roleID: number;
  roleName: string;
  roleCode?: string;
  description?: string;
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

const HEAD_OFFICE_ROLE_KEYS = new Set([
  'superadmin',
  'super admin',
  'admin',
  'systemadmin',
  'headoffice',
  'ho_manager',
  'ho manager',
  'auditor',
  'generalmanager',
  'ceo',
  'chairman'
]);

const isHeadOfficeRoleName = (roleName?: string | null): boolean => {
  if (!roleName) return false;
  return HEAD_OFFICE_ROLE_KEYS.has(roleName.trim().toLowerCase());
};

const formatRoleOptionLabel = (roleName: string): string => {
  if (isSuperAdminRole(roleName)) return '👑 Super Admin — सर्वोच्च प्रशासक';
  const r = roleName.trim().toLowerCase();
  if (r === 'admin' || r === 'systemadmin') return `🛡️ ${roleName} — प्रणाली प्रशासक`;
  if (r === 'ho_manager' || r === 'ho manager' || r === 'headoffice') return `🏢 ${roleName} — मुख्य कार्यालय`;
  if (r === 'manager' || r === 'branchmanager' || r === 'branch_manager') return `🏬 ${roleName} — शाखा व्यवस्थापक`;
  if (r === 'accountant') return `📊 ${roleName} — लेखापाल`;
  if (r === 'cashier') return `💵 ${roleName} — रोखपाल`;
  if (r === 'clerk' || r === 'operator') return `⌨️ ${roleName} — लिपिक / ऑपरेटर`;
  if (r === 'auditor') return `🔍 ${roleName} — तपासनीस (Auditor)`;
  return roleName;
};

export default function UserMaster() {
  const { user: currentUser } = useAuth();
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

  const currentRole = currentUser?.roleName || currentUser?.role || '';
  const callerIsSuperAdmin = isSuperAdminRole(currentRole);
  const callerIsAdminOrSuper = isAdminOrSuperAdminRole(currentRole);
  const isCallerMasterAdmin = (currentUser?.username || '').trim().toLowerCase() === 'admin';

  const activeSuperAdminCount = users.filter(
    u => u.isActive && !u.isLocked && isSuperAdminRole(u.roleName)
  ).length;

  // Safe Bootstrap Rule: If zero active SuperAdmin accounts exist in DB yet,
  // allow Master 'admin' (or initial Admin when no 'admin' account exists) to create/assign the first SuperAdmin.
  const hasMasterAdminRow = users.some(
    u => u.userID === 1 || (u.username || '').trim().toLowerCase() === 'admin'
  );
  const canManageSuperAdmin =
    callerIsSuperAdmin ||
    (activeSuperAdminCount === 0 &&
      (isCallerMasterAdmin || (!hasMasterAdminRow && callerIsAdminOrSuper)));

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchBranches();
  }, []);

  const getAuthHeaders = (): HeadersInit => {
    try {
      const saved = sessionStorage.getItem('bhisi_user') || localStorage.getItem('bhisi_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u?.token) {
          return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${u.token}`
          };
        }
      }
    } catch {}
    return { 'Content-Type': 'application/json' };
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/Users', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } else if (res.status === 401 || res.status === 403) {
        setError('तुम्हाला युजर व्यवस्थापन पाहण्याचा अधिकार नाही (Unauthorized / Access Denied).');
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
      setError('सर्व्हरशी संपर्क साधताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/Users/Roles', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRoles(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch roles', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/Branches', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBranches(Array.isArray(data) ? data : []);
        if (data.length > 0) {
          setFormData(prev => prev.defaultBranchID ? prev : { ...prev, defaultBranchID: data[0].branchID.toString() });
        }
      }
    } catch (err) {
      console.error('Failed to fetch branches', err);
    }
  };

  const getDefaultAssignableRoleId = (): string => {
    const assignable = roles.filter(r => {
      if (isSuperAdminRole(r.roleName) && !canManageSuperAdmin) return false;
      if (!callerIsAdminOrSuper && r.roleName.trim().toLowerCase() === 'admin') return false;
      return true;
    });
    const nonSuperDefault = assignable.find(r => !isSuperAdminRole(r.roleName)) || assignable[0];
    return nonSuperDefault ? nonSuperDefault.roleID.toString() : '';
  };

  const resetForm = () => {
    setFormData({
      userID: 0,
      username: '',
      roleID: getDefaultAssignableRoleId(),
      defaultBranchID: branches.length > 0 ? branches[0].branchID.toString() : '',
      isActive: true
    });
    setIsEditing(false);
    setShowForm(false);
    setError('');
    setSuccessMsg('');
  };

  const handleAddNew = (preselectSuperAdmin = false) => {
    const superRole = roles.find(r => isSuperAdminRole(r.roleName));
    const chosenRoleId =
      preselectSuperAdmin && superRole && canManageSuperAdmin
        ? superRole.roleID.toString()
        : getDefaultAssignableRoleId();

    setFormData({
      userID: 0,
      username: '',
      roleID: chosenRoleId,
      defaultBranchID: preselectSuperAdmin ? '' : (branches.length > 0 ? branches[0].branchID.toString() : ''),
      isActive: true
    });
    setIsEditing(false);
    setError('');
    setSuccessMsg('');
    setShowForm(true);

    setTimeout(() => {
      if (formContainerRef.current) {
        formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      usernameInputRef.current?.focus();
    }, 100);
  };

  const handleEdit = (target: User) => {
    if (isSuperAdminRole(target.roleName) && !canManageSuperAdmin) {
      setError("सुरक्षा नियम: 'Super Admin' खात्यामध्ये बदल करण्याचा अधिकार फक्त 'Super Admin' लाच आहे.");
      return;
    }

    setError('');
    setSuccessMsg('');
    setFormData({
      userID: target.userID,
      username: target.username,
      roleID: target.roleID.toString(),
      defaultBranchID: target.defaultBranchID ? target.defaultBranchID.toString() : '',
      isActive: target.isActive
    });
    setIsEditing(true);
    setShowForm(true);

    setTimeout(() => {
      if (formContainerRef.current) {
        formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (usernameInputRef.current && target.username.toLowerCase() !== 'admin') {
        usernameInputRef.current.focus();
        usernameInputRef.current.select();
      }
    }, 120);
  };

  const selectedRoleObj = roles.find(r => r.roleID.toString() === formData.roleID);
  const selectedRoleIsHo = selectedRoleObj ? isHeadOfficeRoleName(selectedRoleObj.roleName) : false;

  const handleRoleChange = (newRoleId: string) => {
    const picked = roles.find(r => r.roleID.toString() === newRoleId);
    const pickedIsHo = picked ? isHeadOfficeRoleName(picked.roleName) : false;
    setFormData(prev => ({
      ...prev,
      roleID: newRoleId,
      defaultBranchID: pickedIsHo
        ? prev.defaultBranchID
        : (prev.defaultBranchID || (branches.length > 0 ? branches[0].branchID.toString() : ''))
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.roleID) {
      setError('कृपया युजरसाठी वैध प्रवेश अधिकार रोल (Role) निवडा.');
      return;
    }

    if (!selectedRoleIsHo && !formData.defaultBranchID) {
      setError('शाखा-स्तरीय रोलसाठी (Manager / Accountant / Cashier / Clerk) डिफॉल्ट शाखा निवडणे अनिवार्य आहे.');
      return;
    }

    setLoading(true);
    const payload = {
      username: formData.username.trim(),
      roleID: parseInt(formData.roleID, 10),
      defaultBranchID: formData.defaultBranchID ? parseInt(formData.defaultBranchID, 10) : null,
      isActive: formData.isActive
    };

    try {
      const url = isEditing ? `/api/Users/${formData.userID}` : '/api/Users';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
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

      setSuccessMsg(
        isEditing
          ? 'युजर माहिती व रोल यशस्वीरित्या अपडेट केला!'
          : "नवीन युजर तयार केला! (डिफॉल्ट पासवर्ड: 'Welcome@123')"
      );
      await fetchUsers();
      await fetchRoles();

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
    const targetUser = users.find(u => u.userID === id);
    if (!targetUser) return;

    if (isSuperAdminRole(targetUser.roleName) && !callerIsSuperAdmin) {
      alert("सुरक्षा नियम: 'Super Admin' खात्याचा पासवर्ड रिसेट करण्याचा अधिकार फक्त 'Super Admin' लाच आहे.");
      return;
    }

    if ((targetUser.username?.toLowerCase() === 'admin' || id === 1) && !callerIsSuperAdmin) {
      alert('मास्टर ॲडमिन (admin) खात्याचा पासवर्ड सुरक्षित असून तो फक्त Super Admin मार्फतच रिसेट करता येतो.');
      return;
    }

    if (!window.confirm(`तुम्हाला खात्री आहे का की '${targetUser.username}' चा पासवर्ड रिसेट करायचा आहे? नवीन पासवर्ड 'Welcome@123' असा सेट केला जाईल.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/Users/${id}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        alert('पासवर्ड रिसेट यशस्वी झाला! नवीन पासवर्ड: Welcome@123');
        fetchUsers();
      } else {
        const errText = await res.text();
        alert(errText || 'पासवर्ड रिसेट करताना त्रुटी आली.');
      }
    } catch {
      alert('सर्व्हरशी संपर्क साधताना त्रुटी आली.');
    }
  };

  const handleToggleLock = async (id: number, currentStatus: boolean) => {
    const targetUser = users.find(u => u.userID === id);
    if (!targetUser) return;

    if (isSuperAdminRole(targetUser.roleName) && !callerIsSuperAdmin) {
      alert("सुरक्षा नियम: 'Super Admin' खाते लॉक/अनलॉक करण्याचा अधिकार फक्त 'Super Admin' लाच आहे.");
      return;
    }

    if ((targetUser.username?.toLowerCase() === 'admin' || id === 1) && !callerIsSuperAdmin) {
      alert('मास्टर ॲडमिन (admin) खाते सुरक्षित असून ते लॉक करता येत नाही.');
      return;
    }

    const action = currentStatus ? 'अनलॉक (Unlock)' : 'लॉक (Lock)';
    if (!window.confirm(`तुम्हाला खात्री आहे का की '${targetUser.username}' हे अकाउंट ${action} करायचे आहे?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/Users/${id}/toggle-lock`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        alert(`अकाउंट यशस्वीरित्या ${currentStatus ? 'अनलॉक' : 'लॉक'} केले!`);
        fetchUsers();
      } else {
        const errText = await res.text();
        alert(errText || `अकाउंट ${action} करताना त्रुटी आली.`);
      }
    } catch {
      alert('सर्व्हरशी संपर्क साधताना त्रुटी आली.');
    }
  };

  const renderRoleBadge = (roleName: string) => {
    if (isSuperAdminRole(roleName)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
          <Crown size={11} className="text-amber-600 shrink-0" />
          <span>Super Admin</span>
        </span>
      );
    }
    const r = (roleName || '').trim().toLowerCase();
    if (r === 'admin' || r === 'systemadmin') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/30">
          <ShieldCheck size={11} className="shrink-0" />
          <span>{roleName}</span>
        </span>
      );
    }
    if (r === 'manager' || r === 'branchmanager' || r === 'branch_manager' || r === 'ho_manager' || r === 'ho manager') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
          <Shield size={11} className="text-amber-700 shrink-0" />
          <span>{roleName}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
        <Shield size={11} className="text-slate-600 shrink-0" />
        <span>{roleName || 'User'}</span>
      </span>
    );
  };

  const filteredUsers = users.filter(u =>
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.roleName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (isSuperAdminRole(u.roleName) && 'super admin'.includes(searchTerm.toLowerCase())) ||
    (u.branchName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers = users.length;
  const activeUsersCount = users.filter(u => u.isActive && !u.isLocked).length;
  const lockedUsersCount = users.filter(u => u.isLocked).length;

  const editingMasterAdmin = isEditing && (formData.username.toLowerCase() === 'admin' || formData.userID === 1);
  const editingSelf = isEditing && (currentUser?.username || '').toLowerCase() === formData.username.toLowerCase();

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans pb-8">

      {/* 1. TOP SLEEK CBS HEADER BANNER */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-2.5 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <ShieldCheck size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>युजर व्यवस्थापन व सुरक्षा मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(User &amp; Super Admin Role Management)</span>
              {callerIsSuperAdmin && (
                <span className="bg-purple-100 text-purple-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-purple-300 inline-flex items-center gap-1">
                  <Crown size={11} className="text-amber-600" />
                  <span>Super Admin मोड</span>
                </span>
              )}
              {isEditing && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                  ✏️ संपादन चालू (#{formData.userID})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              सिस्टीम वापरकर्ते (Users), Super Admin / Admin प्रवेश अधिकार (Roles), शाखा संलग्नता आणि पासवर्ड सुरक्षा व्यवस्थापन
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

          {!showForm && canManageSuperAdmin && (
            <button
              type="button"
              onClick={() => handleAddNew(true)}
              className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="नवीन Super Admin युजर तयार करा"
            >
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>+ Super Admin</span>
            </button>
          )}

          {!showForm && (
            <button
              type="button"
              onClick={() => handleAddNew(false)}
              className="px-2.5 py-1 bg-primary hover:opacity-90 text-white rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="नवीन युजर जोडा"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>नवीन युजर</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => { fetchUsers(); fetchRoles(); }}
            disabled={loading}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="डेटा रिफ्रेश करा"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>
        </div>
      </div>

      {/* Bootstrap Notice if no SuperAdmin exists yet */}
      {!loading && users.length > 0 && activeSuperAdminCount === 0 && canManageSuperAdmin && (
        <div className="mb-2.5 px-3 py-2 bg-purple-50 text-purple-950 border border-purple-200 rounded-sm flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 font-semibold">
            <Crown className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              या डेटाबेसमध्ये अद्याप कोणताही <strong>Super Admin</strong> युजर नेमलेला नाही. आपण नवीन <strong>Super Admin</strong> युजर तयार करू शकता किंवा मास्टर खात्याला अपग्रेड करू शकता.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleAddNew(true)}
            className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-sm font-bold text-[10.5px] cursor-pointer shrink-0"
          >
            👑 पहिला Super Admin तयार करा
          </button>
        </div>
      )}

      {/* 2. SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2.5">
        <div className="bg-white p-2 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 text-primary border border-primary/20 rounded">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण युजर्स</div>
            <div className="text-sm font-black text-gray-900">{totalUsers}</div>
          </div>
        </div>

        <div className="bg-white p-2 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">
            <Crown className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Super Admin</div>
            <div className="text-sm font-black text-purple-900">{activeSuperAdminCount}</div>
          </div>
        </div>

        <div className="bg-white p-2 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय युजर्स</div>
            <div className="text-sm font-black text-emerald-800">{activeUsersCount}</div>
          </div>
        </div>

        <div className="bg-white p-2 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">लॉक अकाउंट्स</div>
            <div className="text-sm font-black text-rose-800">{lockedUsersCount}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-2.5 p-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm text-xs font-bold flex justify-between items-center shadow-2xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {error && (
        <div className="mb-2.5 p-2 bg-red-50 text-red-800 border border-red-300 rounded-sm text-xs font-bold flex justify-between items-center shadow-2xs">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* 3. USER REGISTRATION & EDIT FORM */}
      {showForm && (
        <div
          ref={formContainerRef}
          className={`bg-white p-3 rounded-sm shadow-xs border transition-all duration-200 mb-2.5 ${
            isEditing ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-gray-200'
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div className="bg-white p-3 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
              <div className="flex items-center justify-between border-b border-gray-200 pb-1.5 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-bold text-primary">
                    {isEditing
                      ? `१. युजर माहिती व रोल संपादन (युझर: ${formData.username})`
                      : '१. नवीन युजर तयार करा (User Registration & Access Role)'}
                  </h2>
                </div>
                {selectedRoleObj && isSuperAdminRole(selectedRoleObj.roleName) && (
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-extrabold inline-flex items-center gap-1">
                    <Crown size={11} className="text-amber-600" />
                    <span>सर्वोच्च अधिकार: सर्व शाखा व सर्व मॉड्यूल्स पूर्ण नियंत्रण</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelClass}>युझरनेम (Username) <span className="text-red-500">*</span></label>
                  <input
                    ref={usernameInputRef}
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    placeholder="उदा. superadmin / rohit_p"
                    autoComplete="off"
                    className={`${inputClass} font-bold text-gray-900 ${
                      editingMasterAdmin ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : (isEditing ? 'bg-amber-50/60' : '')
                    }`}
                    required
                    disabled={editingMasterAdmin}
                  />
                </div>

                <div>
                  <label className={labelClass}>प्रवेश अधिकार रोल (Role) <span className="text-red-500">*</span></label>
                  <select
                    value={formData.roleID}
                    onChange={e => handleRoleChange(e.target.value)}
                    className={`${inputClass} font-bold`}
                    required
                    disabled={editingMasterAdmin && !canManageSuperAdmin}
                  >
                    <option value="">-- रोल निवडा --</option>
                    {roles.map(r => {
                      const roleIsSuper = isSuperAdminRole(r.roleName);
                      const roleIsAdmin = r.roleName.trim().toLowerCase() === 'admin';
                      const optionDisabled =
                        (roleIsSuper && !canManageSuperAdmin) ||
                        (roleIsAdmin && !callerIsAdminOrSuper);

                      if (optionDisabled && formData.roleID !== r.roleID.toString()) {
                        return null;
                      }

                      return (
                        <option key={r.roleID} value={r.roleID} disabled={optionDisabled}>
                          {formatRoleOptionLabel(r.roleName)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    डिफॉल्ट शाखा (Default Branch) {!selectedRoleIsHo && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={formData.defaultBranchID}
                    onChange={e => setFormData({ ...formData, defaultBranchID: e.target.value })}
                    className={inputClass}
                    required={!selectedRoleIsHo}
                  >
                    {selectedRoleIsHo ? (
                      <option value="">-- सर्व शाखा (All Branches / HO) --</option>
                    ) : (
                      <option value="">-- शाखा निवडा --</option>
                    )}
                    {branches.map(b => (
                      <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                    ))}
                  </select>
                  {selectedRoleIsHo && (
                    <div className="text-[10px] text-primary font-semibold mt-0.5">
                      🌐 मुख्य कार्यालय रोल: सर्व शाखांमध्ये स्विच करण्याची परवानगी लागू
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-4">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    disabled={editingMasterAdmin || editingSelf}
                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer disabled:opacity-50"
                  />
                  <label htmlFor="isActive" className="text-[11px] font-bold text-gray-800 cursor-pointer select-none">
                    सक्रिय युजर (Active User)
                  </label>
                </div>
              </div>

              {!isEditing && (
                <div className="pt-1.5 border-t border-gray-100 text-[10.5px] text-gray-600">
                  💡 <strong>टीप:</strong> नवीन तयार होणाऱ्या युजरचा प्राथमिक पासवर्ड <strong>'Welcome@123'</strong> असा असेल. युजर पहिल्या लॉगिनवेळी स्वतःचा नवीन पासवर्ड सेट करू शकेल.
                </div>
              )}
            </div>

            {/* Form Action Footer */}
            <div className="pt-1.5 flex justify-end items-center gap-2 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>रद्द करा</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-1.5 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{loading ? 'जतन होत आहे...' : (isEditing ? '✏️ युजर अपडेट करा' : '💾 युजर सेव्ह करा')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. REGISTERED USERS TABLE */}
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
                placeholder="युझरनेम, रोल (Super Admin) किंवा शाखा शोधा..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-6 py-1 text-[11px] border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-[28px] w-64"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap leading-tight">
            <thead>
              <tr className="bg-[#5A1A14] text-amber-50 font-bold border-b border-amber-400/30">
                <th className="px-2.5 py-1.5 border-r border-amber-400/25 text-center w-12 whitespace-nowrap">ID</th>
                <th className="px-2.5 py-1.5 border-r border-amber-400/25 whitespace-nowrap">युझरनेम (Username)</th>
                <th className="px-2.5 py-1.5 border-r border-amber-400/25 whitespace-nowrap">रोल (Role)</th>
                <th className="px-2.5 py-1.5 border-r border-amber-400/25 whitespace-nowrap">डिफॉल्ट शाखा (Branch)</th>
                <th className="px-2.5 py-1.5 border-r border-amber-400/25 text-center whitespace-nowrap">स्थिती (Status)</th>
                <th className="px-2.5 py-1.5 text-center w-48 whitespace-nowrap">सुरक्षा कृती (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400 italic">
                    कोणतेही युजर्स सापडले नाहीत.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((rowUser) => {
                  const rowIsSuperAdmin = isSuperAdminRole(rowUser.roleName);
                  const rowIsMasterAdmin = rowUser.username?.toLowerCase() === 'admin' || rowUser.userID === 1;
                  const rowIsSelf = (currentUser?.username || '').toLowerCase() === (rowUser.username || '').toLowerCase();

                  const protectedSuperAdminForNonSuper = rowIsSuperAdmin && !callerIsSuperAdmin;
                  const canEditRow = !protectedSuperAdminForNonSuper && (!rowIsMasterAdmin || callerIsSuperAdmin || isCallerMasterAdmin);
                  const isSoleActiveSuperAdmin = rowIsSuperAdmin && rowUser.isActive && !rowUser.isLocked && activeSuperAdminCount <= 1;

                  return (
                    <tr key={rowUser.userID} className="hover:bg-primary/10 transition-colors">
                      <td className="px-2.5 py-1 border-r border-gray-200 text-center font-mono text-gray-600 align-middle">{rowUser.userID}</td>
                      <td className="px-2.5 py-1 border-r border-gray-200 font-bold text-gray-900 align-middle">
                        <div className="flex items-center gap-1.5">
                          {rowIsSuperAdmin ? (
                            <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                          )}
                          <span>{rowUser.username}</span>
                          {rowIsSelf && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                              तुम्ही
                            </span>
                          )}
                        </div>
                        {rowUser.lastLoginDate && (
                          <div className="text-[9.5px] text-gray-500 font-normal">
                            शेवटचा लॉगिन: {new Date(rowUser.lastLoginDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-1 border-r border-gray-200 align-middle">
                        {renderRoleBadge(rowUser.roleName)}
                      </td>
                      <td className="px-2.5 py-1 border-r border-gray-200 text-gray-800 font-medium align-middle">
                        {rowUser.branchName
                          ? `🏢 ${rowUser.branchName}${isHeadOfficeRoleName(rowUser.roleName) ? ' (सर्व शाखा प्रवेश)' : ''}`
                          : '🌐 सर्व शाखा (All Branches)'}
                      </td>
                      <td className="px-2.5 py-1 border-r border-gray-200 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          {rowUser.isActive ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              सक्रिय
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-300">
                              निष्क्रिय
                            </span>
                          )}
                          {rowUser.isLocked && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              🔒 लॉक
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 py-1 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          {protectedSuperAdminForNonSuper ? (
                            <span
                              className="px-2 py-0.5 bg-purple-50 text-purple-900 border border-purple-300 rounded-sm font-bold text-[10px] inline-flex items-center gap-1 cursor-not-allowed select-none"
                              title="Super Admin खाते सर्वोच्च संरक्षित आहे (फक्त Super Admin बदल करू शकतो)"
                            >
                              <Crown size={11} className="text-amber-600" />
                              <span>सुरक्षित (Super Admin)</span>
                            </span>
                          ) : (
                            <>
                              {canEditRow && (
                                <button
                                  onClick={() => handleEdit(rowUser)}
                                  className="px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                                  title="माहिती व रोल संपादन करा"
                                >
                                  <Edit2 size={11} />
                                  <span>एडिट</span>
                                </button>
                              )}

                              {rowIsSelf ? (
                                <span
                                  className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-sm font-bold text-[10px] flex items-center gap-1 cursor-default select-none"
                                  title="तुमचे सध्या सुरू असलेले लॉगिन खाते"
                                >
                                  <ShieldCheck size={11} className="text-emerald-600" />
                                  <span>चालू खाते</span>
                                </span>
                              ) : rowIsMasterAdmin && !callerIsSuperAdmin ? (
                                <span
                                  className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-sm font-bold text-[10px] flex items-center gap-1 cursor-not-allowed select-none"
                                  title="मास्टर ॲडमिन खाते सुरक्षित आहे (फक्त Super Admin पासवर्ड रिसेट किंवा लॉक करू शकतो)"
                                >
                                  <Shield size={11} className="text-emerald-600" />
                                  <span>सुरक्षित (Admin)</span>
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleResetPassword(rowUser.userID)}
                                    className="px-2 py-0.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                                    title="पासवर्ड Welcome@123 वर रिसेट करा"
                                  >
                                    <KeyRound size={11} />
                                    <span>पासवर्ड रिसेट</span>
                                  </button>

                                  {isSoleActiveSuperAdmin ? (
                                    <span
                                      className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-sm font-bold text-[10px] flex items-center gap-0.5 cursor-not-allowed select-none"
                                      title="एकमेव सक्रिय Super Admin खाते लॉक करता येणार नाही"
                                    >
                                      <Crown size={11} className="text-amber-600" />
                                      <span>संरक्षित</span>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleToggleLock(rowUser.userID, rowUser.isLocked)}
                                      className={`px-2 py-0.5 border rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5 ${
                                        rowUser.isLocked
                                          ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300'
                                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-300'
                                      }`}
                                      title={rowUser.isLocked ? 'अकाउंट अनलॉक करा' : 'अकाउंट लॉक करा'}
                                    >
                                      {rowUser.isLocked ? <Unlock size={11} /> : <Lock size={11} />}
                                      <span>{rowUser.isLocked ? 'अनलॉक' : 'लॉक'}</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
