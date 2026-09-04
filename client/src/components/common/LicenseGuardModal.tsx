import React, { useState, useEffect } from 'react';
import { ShieldAlert, Key, Copy, Check, Upload, RefreshCw, Server, AlertTriangle, PhoneCall } from 'lucide-react';
import api from '../../utils/api';

interface LicenseStatus {
  isValid: boolean;
  statusCode: string;
  message: string;
  machineCode: string;
  clientName?: string;
  sansthaName?: string;
  issuedDate?: string;
  expiryDate?: string;
  daysRemaining: number;
}

const LicenseGuardModal: React.FC = () => {
  const [show, setShow] = useState<boolean>(false);
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [licenseText, setLicenseText] = useState<string>('');
  const [activating, setActivating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const res = await api.get('/license/status');
      setStatus(res.data);
      if (!res.data?.isValid) {
        setShow(true);
      } else {
        setShow(false);
      }
    } catch (err: any) {
      if (err.response?.data?.status) {
        setStatus(err.response.data.status);
        setShow(true);
      }
    }
  };

  useEffect(() => {
    checkStatus();

    const handleLicenseLocked = (event: any) => {
      if (event.detail?.status) {
        setStatus(event.detail.status);
      }
      setShow(true);
    };

    window.addEventListener('license-locked', handleLicenseLocked);
    return () => window.removeEventListener('license-locked', handleLicenseLocked);
  }, []);

  const copyMachineCode = () => {
    if (status?.machineCode) {
      navigator.clipboard.writeText(status.machineCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setLicenseText(content);
      }
    };
    reader.readAsText(file);
  };

  const activateLicense = async () => {
    if (!licenseText.trim()) {
      setErrorMsg('कृपया लायसन्स फाईल निवडा किंवा कोड पेस्ट करा.');
      return;
    }

    setActivating(true);
    setErrorMsg(null);

    try {
      const res = await api.post('/license/activate', { licenseContent: licenseText.trim() });
      if (res.data?.success) {
        setShow(false);
        setLicenseText('');
        window.location.reload();
      } else {
        setErrorMsg(res.data?.result?.message || 'लायसन्स सक्रिय करता आले नाही.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.result?.message || err.response?.data?.message || 'लायसन्स अमान्य आहे.';
      setErrorMsg(msg);
    } finally {
      setActivating(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-700 text-white p-6 relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-wide">
                सॉफ्टवेअर नोंदणी व लायसन्स आवश्यक
              </h2>
              <p className="text-rose-100 text-xs mt-0.5">
                {status?.message || 'सॉफ्टवेअर चालवण्यासाठी वैध ऑफलाइन लायसन्स आवश्यक आहे.'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Machine Code Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-indigo-600" />
                या संगणकाचा Machine Code:
              </span>
              <button
                onClick={copyMachineCode}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition text-[11px]"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'कॉपी झाले!' : 'कॉपी करा'}</span>
              </button>
            </div>
            <div className="bg-white border border-slate-300 rounded-xl p-2.5 font-mono text-slate-900 font-bold text-center tracking-wider text-sm select-all">
              {status?.machineCode || 'तपासत आहे...'}
            </div>
            <p className="text-[11px] text-slate-500">
              हा मशीन कोड वेंडरला पाठवून <strong>'license.lic'</strong> फाईल मिळवा.
            </p>
          </div>

          {/* Upload / Paste Form */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                'license.lic' फाईल निवडा:
              </label>
              <input
                type="file"
                accept=".lic,.json,.txt"
                onChange={handleFileUpload}
                className="block w-full text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 border border-slate-200 rounded-xl p-1 bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                किंवा लायसन्स कोड इथे पेस्ट करा:
              </label>
              <textarea
                value={licenseText}
                onChange={(e) => setLicenseText(e.target.value)}
                placeholder='{"PayloadJson": "...", "Signature": "..."}'
                rows={3}
                className="w-full font-mono p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none bg-slate-50"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
              <span>सपोर्ट व लायसन्ससाठी वेंडरशी संपर्क साधा</span>
            </div>

            <button
              onClick={activateLicense}
              disabled={activating || !licenseText.trim()}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {activating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              <span>सक्रिय करा (Activate)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseGuardModal;
