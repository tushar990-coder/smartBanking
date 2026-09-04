import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Rocket, 
  CloudDownload, 
  FileArchive, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Database, 
  ShieldCheck, 
  History, 
  Sparkles,
  ArrowRight,
  Server,
  Calendar,
  Layers,
  UploadCloud,
  Check
} from 'lucide-react';

interface VersionInfo {
  currentVersion: string;
  buildDate: string;
  databaseName: string;
  lastUpdatedOn?: string | null;
  lastAppliedPatch?: string;
  history: HistoryEntry[];
}

interface HistoryEntry {
  id: number;
  versionNumber: string;
  appliedOn: string;
  patchName: string;
  status: string;
  remarks?: string;
  appliedBy?: string;
}

interface OnlineCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  downloadUrl: string;
  downloadSizeMb: number;
  changelog: string[];
  isCritical: boolean;
  message: string;
}

interface StagedValidation {
  isValid: boolean;
  version: string;
  releaseDate: string;
  changelog: string[];
  hasDatabaseMigration: boolean;
  fileSizeBytes: number;
  errorMessage?: string;
}

export default function SystemUpdateMaster() {
  const [activeTab, setActiveTab] = useState<'online' | 'offline' | 'history'>('online');
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState<boolean>(true);

  // Online Update State
  const [isCheckingOnline, setIsCheckingOnline] = useState<boolean>(false);
  const [onlineResult, setOnlineResult] = useState<OnlineCheckResult | null>(null);
  const [isDownloadingOnline, setIsDownloadingOnline] = useState<boolean>(false);

  // Offline Patch State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [stagedPatch, setStagedPatch] = useState<StagedValidation | null>(null);

  // Applying Update Flow State
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyStep, setApplyStep] = useState<number>(0);
  const [applyStatusText, setApplyStatusText] = useState<string>('');
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCurrentVersionInfo();
  }, []);

  const fetchCurrentVersionInfo = async () => {
    setIsLoadingInfo(true);
    try {
      const res = await axios.get('/api/SystemUpdate/current-version');
      setVersionInfo(res.data);
    } catch (err) {
      console.error('Failed to fetch system version info', err);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleCheckOnline = async () => {
    setIsCheckingOnline(true);
    setOnlineResult(null);
    try {
      const res = await axios.get('/api/SystemUpdate/check-online');
      setOnlineResult(res.data);
    } catch (err: any) {
      console.error('Online update check failed', err);
      alert('अपडेट सर्व्हरशी संपर्क होऊ शकला नाही. इंटरनेट कनेक्शन तपासा.');
    } finally {
      setIsCheckingOnline(false);
    }
  };

  const handleDownloadAndStageOnline = async () => {
    if (!onlineResult || !onlineResult.downloadUrl) return;

    setIsDownloadingOnline(true);
    try {
      const res = await axios.post('/api/SystemUpdate/download-online', {
        downloadUrl: onlineResult.downloadUrl
      });
      setStagedPatch(res.data);
      alert('नवीन आवृत्ती यशस्वीरीत्या डाउनलोड झाली आहे! आता खालील "अपडेट लागू करा" बटणावर क्लिक करा.');
    } catch (err: any) {
      console.error('Download failed', err);
      alert(err.response?.data?.message || 'डाउनलोड करताना त्रुटी आली.');
    } finally {
      setIsDownloadingOnline(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.zip')) {
        alert('फक्त .zip स्वरूपातील पॅच फाईल निवडा.');
        return;
      }
      setSelectedFile(file);
      setStagedPatch(null);
    }
  };

  const handleUploadAndStageOffline = async () => {
    if (!selectedFile) {
      alert('कृपया प्रथम .zip फाईल निवडा.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('patchFile', selectedFile);

    try {
      const res = await axios.post('/api/SystemUpdate/upload-patch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStagedPatch(res.data);
    } catch (err: any) {
      console.error('Upload failed', err);
      alert(err.response?.data?.message || 'पॅच फाईल अपलोड करताना त्रुटी आली.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!window.confirm('तुम्ही खात्रीशीरपणे सॉफ्टवेअर अपडेट करू इच्छिता का? सिस्टीम आपोआप बॅकअप घेऊन रीस्टार्ट होईल.')) {
      return;
    }

    setIsApplying(true);
    setApplyStep(1);
    setApplyStatusText('डेटाबेसचा स्वयंचलित बॅकअप घेतला जात आहे (Zero Data Loss)...');

    try {
      // Small visual delay for step 1
      await new Promise(r => setTimeout(r, 1000));
      setApplyStep(2);
      setApplyStatusText('संचयी डेटाबेस मायग्रेशन आणि स्कीमा सिंक केले जात आहे...');

      const res = await axios.post('/api/SystemUpdate/apply');

      setApplyStep(3);
      setApplyStatusText('सिस्टीम फाइल्स अपडेट होत आहेत...');

      await new Promise(r => setTimeout(r, 1200));
      setApplyStep(4);
      setApplyStatusText('सर्व्हर रीस्टार्ट होत आहे, कृपया ५-१० सेकंद थांबा...');
      setIsReconnecting(true);

      // Start polling for server revival
      pollForReboot();
    } catch (err: any) {
      console.error('Apply update failed', err);
      setIsApplying(false);
      setIsReconnecting(false);
      alert(err.response?.data?.message || 'अपडेट लागू करताना त्रुटी आली.');
    }
  };

  const pollForReboot = () => {
    let attempts = 0;
    const maxAttempts = 30;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const check = await axios.get('/api/SystemUpdate/current-version', { timeout: 2500 });
        if (check.status === 200) {
          clearInterval(interval);
          setApplyStep(5);
          setApplyStatusText('अपडेट यशस्वी! नवीन व्हर्जन लोड होत आहे...');
          setUpdateSuccess(true);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch {
        // Still rebooting
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setApplyStatusText('सर्व्हर रीस्टार्ट होण्यास वेळ लागत आहे. कृपया १ मिनिटानंतर पेज रीफ्रेश करा.');
      }
    }, 2000);
  };

  return (
    <div className="p-3 sm:p-5 max-w-5xl mx-auto space-y-4 font-sans text-slate-800">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-primary/95 to-slate-900 text-white p-4 sm:p-5 rounded-lg shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
            <Rocket size={22} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <span>सिस्टीम अपडेट व आवृत्ती व्यवस्थापन</span>
              <span className="text-[11px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                1-Click Update
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              सॉफ्टवेअर नवीन आवृत्तीवर अद्ययावत करा, सुरक्षित डेटाबेस मायग्रेशन आणि बॅकअपसह.
            </p>
          </div>
        </div>

        <button
          onClick={fetchCurrentVersionInfo}
          disabled={isLoadingInfo}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/20 cursor-pointer self-end sm:self-auto shrink-0"
          title="माहिती रीफ्रेश करा"
        >
          <RefreshCw size={13} className={isLoadingInfo ? 'animate-spin' : ''} />
          <span>रीफ्रेश</span>
        </button>
      </div>

      {/* Current Version & System Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <Layers size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">सध्याची आवृत्ती (Current Version)</span>
            <span className="text-sm font-extrabold text-blue-700 font-mono">
              v{versionInfo?.currentVersion || '1.0.0'}
            </span>
            {versionInfo?.buildDate && (
              <span className="text-[10px] text-slate-400 block">रिलीज: {versionInfo.buildDate}</span>
            )}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Database size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">डेटाबेस स्थिती (Database)</span>
            <span className="text-xs font-bold text-emerald-700 truncate block">
              {versionInfo?.databaseName || 'SmartBanking'} [सक्रिय]
            </span>
            <span className="text-[10px] text-slate-400 block">ऑटो-मायग्रेशन सक्षम</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">डेटा सुरक्षा हमी</span>
            <span className="text-xs font-bold text-purple-700 block">
              Zero Data Loss Protection
            </span>
            <span className="text-[10px] text-slate-400 block">अपडेटपूर्वी ऑटो बॅकअप</span>
          </div>
        </div>

      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1 gap-1">
          
          <button
            onClick={() => setActiveTab('online')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'online'
                ? 'bg-white text-primary shadow-xs border border-slate-200/80 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <CloudDownload size={15} />
            <span>१. ऑनलाइन ऑटो-अपडेट (Online Cloud Update)</span>
          </button>

          <button
            onClick={() => setActiveTab('offline')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'offline'
                ? 'bg-white text-primary shadow-xs border border-slate-200/80 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <FileArchive size={15} />
            <span>२. ऑफलाइन फाईल पॅच (.zip) (Offline Patch)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-4 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'history'
                ? 'bg-white text-primary shadow-xs border border-slate-200/80 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <History size={15} />
            <span>अपडेट इतिहास</span>
          </button>

        </div>

        {/* Tab Content 1: Online Cloud Update */}
        {activeTab === 'online' && (
          <div className="p-4 sm:p-6 space-y-4">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-blue-50/60 rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <CloudDownload size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-blue-950">क्लाउड सर्व्हरवरून थेट ऑटो-अपडेट</h3>
                  <p className="text-xs text-blue-800/80 mt-0.5">
                    इंटरनेट उपलब्ध असल्यास 'Check for Updates' वर क्लिक करून नवीनतम आवृत्ती तपासा.
                  </p>
                </div>
              </div>

              <button
                onClick={handleCheckOnline}
                disabled={isCheckingOnline}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isCheckingOnline ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>तपासत आहे...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>नवीन अपडेट तपासा (Check for Updates)</span>
                  </>
                )}
              </button>
            </div>

            {/* Online Result Display */}
            {onlineResult && (
              <div className="animate-in fade-in duration-300">
                {onlineResult.hasUpdate ? (
                  <div className="bg-amber-50/70 border-2 border-amber-300 rounded-lg p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            नवीन आवृत्ती उपलब्ध
                          </span>
                          <span className="text-base font-extrabold text-gray-900 font-mono">
                            v{onlineResult.latestVersion}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          रिलीज दिनांक: <strong className="font-mono text-gray-800">{onlineResult.releaseDate || 'नवीन'}</strong> | आकार: <strong className="font-mono">{onlineResult.downloadSizeMb ? `${onlineResult.downloadSizeMb} MB` : '35 MB'}</strong>
                        </p>
                      </div>

                      {!stagedPatch && (
                        <button
                          onClick={handleDownloadAndStageOnline}
                          disabled={isDownloadingOnline}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isDownloadingOnline ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>डाउनलोड होत आहे...</span>
                            </>
                          ) : (
                            <>
                              <CloudDownload size={14} />
                              <span>१. पॅच डाउनलोड करा</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Changelog */}
                    {onlineResult.changelog && onlineResult.changelog.length > 0 && (
                      <div className="bg-white/80 rounded p-3 border border-amber-200 text-xs">
                        <span className="font-bold text-gray-800 block mb-1">नवीन वैशिष्ट्ये आणि सुधारणा (What's New):</span>
                        <ul className="space-y-1 text-gray-700 pl-4 list-disc">
                          {onlineResult.changelog.map((c, i) => (
                            <li key={i} className="leading-snug">{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                    <span>{onlineResult.message || 'आपले सॉफ्टवेअर अद्ययावत (Up-to-date) आहे! कोणत्याही नवीन अपडेटची आवश्यकता नाही.'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Staged Download Confirmation & Apply Button */}
            {stagedPatch && (
              <div className="bg-emerald-50/90 border-2 border-emerald-400 rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                      अपडेट पॅच (v{stagedPatch.version}) तयार आहे!
                    </h4>
                    <p className="text-xs text-emerald-800">
                      सॉफ्टवेअर रीस्टार्ट करून नवीन व्हर्जन लागू करण्यासाठी खालील बटण दाबा.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleApplyUpdate}
                  disabled={isApplying}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer animate-pulse"
                >
                  <Rocket size={15} />
                  <span>२. अपडेट लागू करा (Apply Update)</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* Tab Content 2: Offline Patch ZIP Upload */}
        {activeTab === 'offline' && (
          <div className="p-4 sm:p-6 space-y-4">
            
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-primary/60 rounded-xl p-6 text-center transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <UploadCloud size={24} />
              </div>

              <h3 className="text-sm font-bold text-slate-800">
                {selectedFile ? selectedFile.name : 'अपडेट पॅच फाईल (.zip) निवडा किंवा ड्रॅग करा'}
              </h3>
              
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                डेव्हलपरकडून मिळालेली <span className="font-mono font-semibold">SmartBanking_Update_vX.X.X.zip</span> फाईल सिलेक्ट करा.
              </p>

              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  {selectedFile ? 'दुसरी फाईल निवडा' : 'ब्राउझ करा (.zip)'}
                </button>

                {selectedFile && !stagedPatch && (
                  <button
                    onClick={handleUploadAndStageOffline}
                    disabled={isUploading}
                    className="px-4 py-1.5 bg-primary hover:opacity-90 text-white rounded text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>तपासत आहे...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} />
                        <span>पॅच तपासा व स्टेज करा</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Staged Patch Information & Apply Button */}
            {stagedPatch && (
              <div className="bg-emerald-50/90 border border-emerald-300 rounded-lg p-4 sm:p-5 space-y-3 animate-in fade-in duration-300">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        वैध पॅच फाईल (Verified)
                      </span>
                      <span className="text-sm font-extrabold text-emerald-950 font-mono">
                        आवृत्ती: v{stagedPatch.version}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900 mt-1">
                      रिलीज दिनांक: <strong className="font-mono">{stagedPatch.releaseDate}</strong> | 
                      {stagedPatch.hasDatabaseMigration && (
                        <span className="text-amber-800 font-bold ml-1">✓ नवीन डेटाबेस स्कीमा समाविष्ट</span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={handleApplyUpdate}
                    disabled={isApplying}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <Rocket size={15} />
                    <span>अपडेट लागू करा (Apply Patch)</span>
                  </button>
                </div>

                {stagedPatch.changelog && stagedPatch.changelog.length > 0 && (
                  <div className="bg-white/90 rounded p-3 border border-emerald-200 text-xs">
                    <span className="font-bold text-gray-800 block mb-1">या पॅचमधील बदल (Changelog):</span>
                    <ul className="space-y-1 text-gray-700 pl-4 list-disc">
                      {stagedPatch.changelog.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Tab Content 3: Update History Log */}
        {activeTab === 'history' && (
          <div className="p-4 sm:p-6 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <History size={14} className="text-primary" />
              <span>लागू केलेल्या अपडेट्सचा इतिहास (Update History Log)</span>
            </h3>

            {(!versionInfo?.history || versionInfo.history.length === 0) ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded border border-slate-200">
                कोणतीही मागील अपडेट नोंद उपलब्ध नाही.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">आवृत्ती (Version)</th>
                      <th className="py-2 px-3">दिनांक व वेळ</th>
                      <th className="py-2 px-3">पॅच नाव</th>
                      <th className="py-2 px-3">स्थिती</th>
                      <th className="py-2 px-3">तपशील (Remarks)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {versionInfo.history.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-primary">v{h.versionNumber}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                          {new Date(h.appliedOn).toLocaleString('en-GB')}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">{h.patchName}</td>
                        <td className="py-2 px-3">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {h.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] max-w-xs truncate">{h.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Live Updating Modal Overlay */}
      {isApplying && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 font-sans">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center space-y-5 border border-slate-200">
            
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto relative">
              {updateSuccess ? (
                <CheckCircle2 size={36} className="text-emerald-600 animate-bounce" />
              ) : (
                <RefreshCw size={32} className="animate-spin text-primary" />
              )}
            </div>

            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {updateSuccess ? 'अपडेट यशस्वी झाले!' : 'सिस्टीम अपडेट होत आहे...'}
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                कृपया ब्राउझर किंवा कॉम्प्युटर बंद करू नका.
              </p>
            </div>

            {/* Step Progress Indicators */}
            <div className="space-y-2 text-left bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              
              <div className={`flex items-center gap-2 ${applyStep >= 1 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                {applyStep > 1 ? <Check size={14} className="text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current" />}
                <span>१. डेटाबेसचा स्वयंचलित बॅकअप (.bak)</span>
              </div>

              <div className={`flex items-center gap-2 ${applyStep >= 2 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                {applyStep > 2 ? <Check size={14} className="text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current" />}
                <span>२. संचयी डेटाबेस स्कीमा सिंक</span>
              </div>

              <div className={`flex items-center gap-2 ${applyStep >= 3 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                {applyStep > 3 ? <Check size={14} className="text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current" />}
                <span>३. सर्व्हर फाइल्स रिप्लेसमेंट</span>
              </div>

              <div className={`flex items-center gap-2 ${applyStep >= 4 ? 'text-blue-700 font-bold animate-pulse' : 'text-slate-400'}`}>
                {applyStep >= 5 ? <Check size={14} className="text-emerald-600" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current" />}
                <span>४. सर्व्हर रीस्टार्ट व स्वयंचलित रीलोड</span>
              </div>

            </div>

            <div className="text-[11px] text-slate-600 font-medium">
              {applyStatusText}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
