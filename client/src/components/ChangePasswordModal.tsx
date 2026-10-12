import React, { useState } from 'react';
import { 
  KeyRound, ShieldCheck, Eye, EyeOff, AlertCircle, 
  CheckCircle2, X, Lock, LogOut, Check 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

export default function ChangePasswordModal({ isOpen, onClose, isMandatory = false }: ChangePasswordModalProps) {
  const { user, logout, markPasswordChanged } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen || !user) return null;

  // Validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid = hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial && passwordsMatch && currentPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/Auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || (typeof data === 'string' ? data : 'पासवर्ड बदलताना त्रुटी आली. चालू पासवर्ड तपासा.'));
      }

      setSuccess('पासवर्ड यशस्वीरित्या बदलला आहे!');
      markPasswordChanged();

      setTimeout(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'सर्व्हरशी संपर्क साधताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden font-sans text-xs">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/20 text-emerald-400 rounded">
              <KeyRound size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">पासवर्ड बदला (Change Password)</h3>
              <p className="text-[10px] text-slate-400">वापरकर्ता: <span className="text-white font-mono font-bold">{user.username}</span></p>
            </div>
          </div>

          {!isMandatory && (
            <button
              onClick={onClose}
              disabled={loading}
              className="text-slate-400 hover:text-white p-1 rounded-sm transition-colors cursor-pointer"
              title="बंद करा"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Mandatory Warning Banner */}
        {isMandatory && (
          <div className="bg-amber-50 border-b border-amber-200 p-2.5 px-3.5 flex items-start gap-2 text-amber-900">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">सुरक्षा सूचना:</span> प्रथम लॉगिनवेळी किंवा पासवर्ड रिसेट झाल्यानंतर सुरक्षिततेसाठी स्वतःचा नवीन पासवर्ड सेट करणे बंधनकारक आहे.
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-[11px] font-medium flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-[11px] font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              चालू पासवर्ड (Current Password) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="सध्याचा पासवर्ड टाका"
                required
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 pr-8 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-8"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              नवीन पासवर्ड (New Password) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="किमान ८ अक्षरांचा नवीन पासवर्ड"
                required
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 pr-8 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-8"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              नवीन पासवर्ड पुन्हा टाका (Confirm Password) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="नवीन पासवर्ड पुन्हा प्रविष्ट करा"
                required
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 pr-8 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-8"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Password Requirements Checklist */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[10.5px] space-y-1 text-slate-600">
            <div className="font-bold text-slate-700 mb-1">पासवर्ड काठिण्य निकष (Password Criteria):</div>
            <div className="grid grid-cols-2 gap-1">
              <div className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                <Check size={12} className={hasMinLength ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'} />
                <span>किमान ८ अक्षरे</span>
              </div>
              <div className={`flex items-center gap-1 ${hasUpper ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                <Check size={12} className={hasUpper ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'} />
                <span>१ मोठा वर्ण (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1 ${hasLower ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                <Check size={12} className={hasLower ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'} />
                <span>१ लहान वर्ण (a-z)</span>
              </div>
              <div className={`flex items-center gap-1 ${hasDigit ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                <Check size={12} className={hasDigit ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'} />
                <span>१ अंक (0-9)</span>
              </div>
              <div className={`flex items-center gap-1 ${hasSpecial ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                <Check size={12} className={hasSpecial ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'} />
                <span>१ विशेष चिन्ह (@,#,$)</span>
              </div>
              <div className={`flex items-center gap-1 ${passwordsMatch ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                <Check size={12} className={passwordsMatch ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'} />
                <span>पासवर्ड जुळतात</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-gray-100 gap-2">
            {isMandatory ? (
              <button
                type="button"
                onClick={logout}
                className="text-red-600 hover:text-red-700 font-bold text-[11px] flex items-center gap-1 px-2 py-1.5 rounded hover:bg-red-50 cursor-pointer transition-colors"
                title="लॉगिन रद्द करा"
              >
                <LogOut size={13} />
                <span>लॉगआउट करा</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition-colors cursor-pointer"
              >
                रद्द करा
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="px-4 py-1.5 bg-primary hover:opacity-95 text-white font-bold rounded text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
            >
              <ShieldCheck size={14} />
              <span>{loading ? 'बदलत आहे...' : 'पासवर्ड सेव्ह करा'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
