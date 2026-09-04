import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Printer, 
  FileSpreadsheet, 
  FileText, 
  Maximize2, 
  Minimize2, 
  Layers,
  FileCheck
} from 'lucide-react';
import './cbsPrintStyles.css';

export type CbsPaperSize = 'a4-portrait' | 'a4-landscape' | 'legal-landscape' | 'a5-portrait';
export type CbsSignatureTier = '3-tier' | '4-tier' | 'voucher-3-tier' | 'none';

export interface SansthaDetails {
  sansthaID?: number;
  sansthaName?: string;
  address?: string;
  village?: string;
  taluka?: string;
  district?: string;
  pinCode?: string;
  registrationNo?: string;
  registrationDate?: string;
  contactNo?: string;
  mobileNo?: string;
  email?: string;
}

export interface CbsReportLayoutProps {
  /** Paper size: 'a4-portrait' (default) | 'a4-landscape' | 'legal-landscape' | 'a5-portrait' */
  defaultPaperSize?: CbsPaperSize;
  /** Allow switching paper size from toolbar */
  allowPaperSizeToggle?: boolean;
  /** Main Marathi Report Title */
  reportTitle: string;
  /** Subtitle / English Title */
  reportSubtitle?: string;
  /** Date Period or As-on Date text */
  periodText?: string;
  /** Branch Name */
  branchName?: string;
  /** Custom Sanstha Info (if already loaded) */
  sansthaInfo?: SansthaDetails | null;
  /** Optional summary strip (e.g., Member details, account balance) */
  summaryBanner?: React.ReactNode;
  /** Signature block type: '3-tier' (default), '4-tier', 'voucher-3-tier', 'none' */
  signatureTier?: CbsSignatureTier;
  /** Custom signature titles */
  signatureTitles?: { title: string; subtitle?: string }[];
  /** Excel export callback */
  onExportExcel?: () => void;
  /** PDF download callback */
  onDownloadPdf?: () => void;
  /** Direct Print callback (defaults to window.print) */
  onPrint?: () => void;
  /** Additional controls inside toolbar */
  extraToolbarControls?: React.ReactNode;
  /** Loading indicator */
  isLoading?: boolean;
  /** Empty or initial state message if no data */
  emptyState?: React.ReactNode;
  /** Has data to show */
  hasData?: boolean;
  /** Prepared By user name */
  preparedBy?: string;
  /** Content of the report (Table / Grid) */
  children: React.ReactNode;
}

export const formatDisplayDate = (dStr?: string | null) => {
  if (!dStr) return '-';
  try {
    const clean = dStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dStr;
  }
};

export default function CbsReportLayout({
  defaultPaperSize = 'a4-portrait',
  allowPaperSizeToggle = true,
  reportTitle,
  reportSubtitle,
  periodText,
  branchName,
  sansthaInfo: propSansthaInfo,
  summaryBanner,
  signatureTier = '3-tier',
  signatureTitles,
  onExportExcel,
  onDownloadPdf,
  onPrint,
  extraToolbarControls,
  isLoading = false,
  emptyState,
  hasData = true,
  preparedBy = 'Admin',
  children
}: CbsReportLayoutProps) {
  const [paperSize, setPaperSize] = useState<CbsPaperSize>(defaultPaperSize);
  const [fetchedSanstha, setFetchedSanstha] = useState<SansthaDetails | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState<string>('');
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Sync default paper size if prop changes
  useEffect(() => {
    setPaperSize(defaultPaperSize);
  }, [defaultPaperSize]);

  // Fetch Sanstha Details if not provided
  useEffect(() => {
    if (!propSansthaInfo) {
      axios.get('/api/SansthaDetails')
        .then(res => {
          if (res.data) {
            if (Array.isArray(res.data) && res.data.length > 0) {
              setFetchedSanstha(res.data[0]);
            } else if (!Array.isArray(res.data)) {
              setFetchedSanstha(res.data);
            }
          }
        })
        .catch(err => console.error('Error loading Sanstha details in CbsReportLayout', err));
    }
  }, [propSansthaInfo]);

  // Update real-time timestamp for audit footer
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setCurrentTimestamp(`${dateStr} ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const activeSanstha = propSansthaInfo || fetchedSanstha;

  const handleTriggerPrint = () => {
    // Add page sizing class to body before printing
    document.body.classList.remove(
      'cbs-print-a4-portrait', 
      'cbs-print-a4-landscape', 
      'cbs-print-legal-landscape', 
      'cbs-print-a5-portrait'
    );
    document.body.classList.add(`cbs-print-${paperSize}`);

    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  // Preview container class based on selected paper
  const getPreviewClass = () => {
    switch (paperSize) {
      case 'a4-landscape':
        return 'cbs-paper-preview-a4-landscape';
      case 'legal-landscape':
        return 'cbs-paper-preview-legal-landscape';
      case 'a5-portrait':
        return 'cbs-paper-preview-a5-portrait';
      case 'a4-portrait':
      default:
        return 'cbs-paper-preview-a4-portrait';
    }
  };

  // Default signatures configuration
  const getSignatureList = () => {
    if (signatureTitles && signatureTitles.length > 0) return signatureTitles;
    if (signatureTier === '4-tier') {
      return [
        { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Branch Head)' },
        { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Director)' }
      ];
    }
    if (signatureTier === 'voucher-3-tier') {
      return [
        { title: 'तयार करणारा', subtitle: '(Prepared By)' },
        { title: 'तपासणारा / रोखपाल', subtitle: '(Checked By / Cashier)' },
        { title: 'अधिकारी / व्यवस्थापक', subtitle: '(Authorized Signatory)' }
      ];
    }
    return [
      { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
      { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
      { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Branch Head)' }
    ];
  };

  return (
    <div className="cbs-report-wrapper p-2 sm:p-4 bg-slate-100 min-h-screen">
      
      {/* 1. Sleek Unified CBS Action Toolbar (Hidden on Print) */}
      <div className="cbs-toolbar bg-white px-3 py-1.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print flex flex-wrap items-center justify-between gap-2">
        
        {/* Left: Report Title & Paper Indicator */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FileText size={13} className="stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-gray-900 leading-none flex items-center gap-1">
              <span>{reportTitle}</span>
              {reportSubtitle && (
                <span className="text-[10px] font-normal text-slate-500 hidden md:inline">({reportSubtitle})</span>
              )}
            </h2>
          </div>
        </div>

        {/* Center: Extra Controls (Filters, Search, Dates) */}
        {extraToolbarControls && (
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-center">
            {extraToolbarControls}
          </div>
        )}

        {/* Right: Paper Sizer + Export + Print Action Strip */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Paper Sizing Selector */}
          {allowPaperSizeToggle && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300 text-[10.5px]">
              <button
                type="button"
                onClick={() => setPaperSize('a4-portrait')}
                className={`px-1.5 py-0.5 rounded-xs font-medium cursor-pointer transition-colors ${
                  paperSize === 'a4-portrait' 
                    ? 'bg-primary text-white font-bold shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="A4 पोर्ट्रेट कागद (६ ते ८ कॉलम्स)"
              >
                A4 पोर्ट्रेट
              </button>
              
              <button
                type="button"
                onClick={() => setPaperSize('a4-landscape')}
                className={`px-1.5 py-0.5 rounded-xs font-medium cursor-pointer transition-colors ${
                  paperSize === 'a4-landscape' 
                    ? 'bg-primary text-white font-bold shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="A4 लँडस्केप कागद (८ ते १० कॉलम्स)"
              >
                A4 लँडस्केप
              </button>
              
              <button
                type="button"
                onClick={() => setPaperSize('legal-landscape')}
                className={`px-1.5 py-0.5 rounded-xs font-medium cursor-pointer transition-colors ${
                  paperSize === 'legal-landscape' 
                    ? 'bg-primary text-white font-bold shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Legal लँडस्केप कागद (१० ते १५ कॉलम्स)"
              >
                Legal लँडस्केप
              </button>
            </div>
          )}

          {/* Excel Export */}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              disabled={!hasData || isLoading}
              className={`h-6 bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-0.5 rounded-xs text-[11px] font-semibold shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              title="एक्सेल फाइल डाऊनलोड करा (.xlsx)"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>
          )}

          {/* PDF Download */}
          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={!hasData || isLoading}
              className={`h-6 bg-rose-700 hover:bg-rose-800 text-white px-2 py-0.5 rounded-xs text-[11px] font-semibold shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              title="PDF डाऊनलोड करा"
            >
              <FileCheck size={12} />
              <span>PDF</span>
            </button>
          )}

          {/* Print Button */}
          <button
            type="button"
            onClick={handleTriggerPrint}
            disabled={!hasData || isLoading}
            className={`h-6 bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-0.5 rounded-xs text-[11px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
            title="थेट प्रिंट काढा (Ctrl + P)"
          >
            <Printer size={12} />
            <span>प्रिंट ({paperSize === 'legal-landscape' ? 'Legal' : paperSize === 'a4-landscape' ? 'A4 Land.' : 'A4'})</span>
          </button>

        </div>

      </div>

      {/* 2. Main Printable Paper Container */}
      {hasData ? (
        <div 
          ref={printAreaRef}
          className={`cbs-print-container ${getPreviewClass()} p-3 sm:p-5 rounded-xs shadow-md border border-slate-300 flex flex-col justify-between`}
        >
          <div>
            
            {/* 🏛️ Standard CBS Compact Header (Max 65px Vertical Space) */}
            <div className="cbs-compact-header">
              
              {/* Registration No & Date Top Bar */}
              <div className="cbs-reg-bar">
                <div>
                  <span>रजि. नं.: </span>
                  <span className="font-mono font-bold text-slate-900">{activeSanstha?.registrationNo || '-'}</span>
                </div>
                {branchName && (
                  <div>
                    <span>शाखा: </span>
                    <span className="font-bold text-slate-900">{branchName}</span>
                  </div>
                )}
                <div>
                  <span>रजि. दि.: </span>
                  <span className="font-mono font-bold text-slate-900">
                    {activeSanstha?.registrationDate ? formatDisplayDate(activeSanstha.registrationDate) : '-'}
                  </span>
                </div>
              </div>

              {/* Sanstha Name */}
              <h1 className="cbs-sanstha-title">
                {activeSanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h1>

              {/* Clean Address Bar */}
              <p className="cbs-address-text">
                {[
                  activeSanstha?.address,
                  (!activeSanstha?.address?.includes(activeSanstha?.village || '___') && activeSanstha?.village) ? `मु. ${activeSanstha.village}` : null,
                  (!activeSanstha?.address?.includes(activeSanstha?.taluka || '___') && activeSanstha?.taluka) ? `ता. ${activeSanstha.taluka}` : null,
                  (!activeSanstha?.address?.includes(activeSanstha?.district || '___') && activeSanstha?.district) ? `जि. ${activeSanstha.district}` : null,
                  activeSanstha?.pinCode ? `पिन: ${activeSanstha.pinCode}` : null
                ].filter(Boolean).join(', ')}
              </p>

            </div>

            {/* 🎗️ Report Ribbon (Title & Period) */}
            <div className="cbs-ribbon">
              <div className="cbs-ribbon-title flex items-center gap-1.5">
                <span>{reportTitle}</span>
                {reportSubtitle && (
                  <span className="text-[9.5px] font-normal text-slate-600">({reportSubtitle})</span>
                )}
              </div>
              {periodText && (
                <div className="cbs-ribbon-meta">
                  <span className="text-slate-600 font-medium">कालावधी: </span>
                  <span className="font-mono">{periodText}</span>
                </div>
              )}
            </div>

            {/* 👤 Optional Summary Strip (Member details, Account stats, etc.) */}
            {summaryBanner && (
              <div className="cbs-summary-banner">
                {summaryBanner}
              </div>
            )}

            {/* 📊 Main Data Grid (Children) */}
            <div className="cbs-data-content overflow-x-auto">
              {children}
            </div>

          </div>

          {/* 3. Footer Section (Signatures + Audit Stamp) */}
          <div className="cbs-footer-group mt-6">
            
            {/* ✍️ Statutory 3 or 4 Tier Signature Strip */}
            {signatureTier !== 'none' && (
              <div 
                className="cbs-signature-strip"
                style={{
                  gridTemplateColumns: `repeat(${getSignatureList().length}, minmax(0, 1fr))`
                }}
              >
                {getSignatureList().map((sig, idx) => (
                  <div key={idx} className="cbs-sig-col">
                    <div className="cbs-sig-line">{sig.title}</div>
                    {sig.subtitle && <div className="cbs-sig-sub">{sig.subtitle}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* 🕒 Audit Stamp Bar */}
            <div className="cbs-audit-footer">
              <div>
                <span>प्रिंट दिनांक व वेळ: </span>
                <strong className="text-slate-800">{currentTimestamp}</strong>
              </div>
              <div>
                <span>तयार करणार: </span>
                <strong className="text-slate-800">{preparedBy}</strong>
              </div>
              <div>
                <span>प्रणाली: </span>
                <strong className="text-slate-800">SmartBanking CBS v2.4</strong>
              </div>
            </div>

          </div>

        </div>
      ) : (
        emptyState || (
          <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
            <Layers size={32} className="mx-auto mb-2 text-primary/40" />
            <p className="font-semibold text-xs">माहिती पाहण्यासाठी वरील फिल्टर निवडून शोध बटनावर क्लिक करा.</p>
          </div>
        )
      )}

    </div>
  );
}
