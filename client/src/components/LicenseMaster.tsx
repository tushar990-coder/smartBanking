import React, { useState, useEffect } from 'react';
import { Shield, Key, Copy, Check, Upload, AlertTriangle, CheckCircle, RefreshCw, Server, Calendar, Clock, Building } from 'lucide-react';
import api from '../utils/api';

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
  planName?: string;
  enabledFeatures?: string[];
}

const LicenseMaster: React.FC = () => {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [licenseText, setLicenseText] = useState<string>('');
  const [activating, setActivating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLicenseStatus = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.get('/license/status');
      setStatus(res.data);
    } catch (err: any) {
      if (err.response?.data?.status) {
        setStatus(err.response.data.status);
      } else {
        setFeedback({ type: 'error', text: 'लायसन्स माहिती लोड करण्यात अडचण आली.' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenseStatus();
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
      setFeedback({ type: 'error', text: 'कृपया लायसन्स फाईल निवडा किंवा कोड पेस्ट करा.' });
      return;
    }

    setActivating(true);
    setFeedback(null);

    try {
      const res = await api.post('/license/activate', { licenseContent: licenseText.trim() });
      if (res.data?.success) {
        setFeedback({ type: 'success', text: 'लायसन्स यशस्वीरित्या सक्रिय झाले! (License Activated Successfully)' });
        setLicenseText('');
        fetchLicenseStatus();
      } else {
        setFeedback({ type: 'error', text: res.data?.result?.message || 'लायसन्स सक्रिय करता आले नाही.' });
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.result?.message || err.response?.data?.message || 'लायसन्स अमान्य आहे किंवा सही जुळत नाही.';
      setFeedback({ type: 'error', text: errMsg });
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/50">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 backdrop-blur-md">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide flex items-center gap-2">
              स्मार्ट बँकिंग लायसन्स व्यवस्थापन
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Offline Node-Locked
              </span>
            </h1>
            <p className="text-slate-300 text-xs mt-1">
              स्थानिक संगणक सुरक्षा, RSA 2048-bit डिजिटल स्वाक्षरी आणि मशीन नोंदणी
            </p>
          </div>
        </div>

        <button
          onClick={fetchLicenseStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700/60 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-600 transition shadow-sm w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          रिफ्रेश करा
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Grid: Status & Machine Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Machine Code Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-3 text-slate-800 font-bold text-base pb-3 border-b border-slate-100">
            <Server className="w-5 h-5 text-indigo-600" />
            <span>संगणक मशीन कोड (Hardware Machine Code)</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            हे सॉफ्टवेअर फक्त याच संगणकावर चालण्यासाठी खालील मशीन कोड वापरला जातो. नवीन लायसन्स की मिळवण्यासाठी हा कोड कॉपी करून वेंडरला पाठवा:
          </p>

          <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <code className="font-mono text-sm font-bold text-slate-900 tracking-wider">
              {status?.machineCode || 'कोड तपासत आहे...'}
            </code>
            <button
              onClick={copyMachineCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition shadow-sm shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-white" />}
              <span>{copied ? 'कॉपी झाले!' : 'कॉपी करा'}</span>
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
            <strong>टीप:</strong> कॉम्प्युटरचा मदरबोर्ड किंवा प्रोसेसर बदलल्यास मशीन कोड बदलू शकतो, अशा वेळी वेंडरकडून मोफत रिन्यूअल की घ्या.
          </div>
        </div>

        {/* License Status Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
              <Key className="w-5 h-5 text-emerald-600" />
              <span>सध्याची लायसन्स स्थिती (License Status)</span>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                status?.isValid
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {status?.isValid ? 'सक्रिय (Active)' : 'अवैध / निष्क्रीय (Inactive)'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" /> संस्था नाव:
              </span>
              <span className="font-bold text-slate-800">{status?.sansthaName || 'नोंदणीकृत नाही'}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> मुदत समाप्ती:
              </span>
              <span className="font-bold text-slate-800">
                {status?.expiryDate ? new Date(status.expiryDate).toLocaleDateString('mr-IN') : 'लागू नाही'}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> शिल्लक दिवस:
              </span>
              <span
                className={`font-extrabold ${
                  (status?.daysRemaining ?? 0) > 30
                    ? 'text-emerald-600'
                    : (status?.daysRemaining ?? 0) > 0
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}
              >
                {status?.daysRemaining !== undefined ? `${status.daysRemaining} दिवस` : '0 दिवस'}
              </span>
            </div>

            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">प्लॅन प्रकार:</span>
              <span className="font-semibold text-indigo-700">{status?.planName || 'Enterprise Core'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activation / Renewal Box */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base pb-3 border-b border-slate-100">
          <Upload className="w-5 h-5 text-emerald-600" />
          <span>नवीन लायसन्स सक्रिय करा / नूतनीकरण करा (Activate or Renew License)</span>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            पर्याय १: 'license.lic' फाईल निवडा (Upload License File):
          </label>
          <input
            type="file"
            accept=".lic,.json,.txt"
            onChange={handleFileUpload}
            className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 border border-slate-200 rounded-xl p-1 bg-slate-50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            पर्याय २: किंवा लायसन्स कोड खाली पेस्ट करा (Paste License String):
          </label>
          <textarea
            value={licenseText}
            onChange={(e) => setLicenseText(e.target.value)}
            placeholder='{"PayloadJson": "...", "Signature": "..."}'
            rows={4}
            className="w-full text-xs font-mono p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
          />
        </div>

        <button
          onClick={activateLicense}
          disabled={activating || !licenseText.trim()}
          className="w-full md:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {activating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
          <span>लायसन्स सक्रिय करा (Activate License)</span>
        </button>
      </div>
    </div>
  );
};

export default LicenseMaster;
