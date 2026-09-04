import React, { useRef, useState, useEffect } from 'react';
import { getAmountInWordsMarathi } from '../utils/marathiWords';
import { Printer, X, Award, ShieldCheck } from 'lucide-react';

interface CertificateData {
  certificateId: number;
  certificateNo: string;
  issueDate: string;
  memberName: string;
  memberNameEng?: string;
  memberNo: string;
  legacyMemberNo?: string;
  accountNo?: string;
  cifNo?: string;
  fromShareNo: number;
  toShareNo: number;
  numberOfShares: number;
  faceValue: number;
  totalAmount: number;
  memberAddress?: string;
  village?: string;
  mobileNo?: string;
  fatherHusbandName?: string;
  status?: string;
  printCount?: number;
  jointMemberNames?: string;
  membershipType?: string;
}

interface Props {
  certificate: CertificateData;
  onClose: () => void;
}

const ShareCertificatePreview: React.FC<Props> = ({ certificate, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [sanstha, setSanstha] = useState<any>(null);

  // Background Paper Colors
  const [paperBgColor, setPaperBgColor] = useState<string>('#ffffff'); // Default: Pure White
  const [certificateTheme, setCertificateTheme] = useState<'navy-gold' | 'royal-maroon' | 'classic-emerald'>('navy-gold');

  useEffect(() => {
    fetch('/api/SansthaDetails')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setSanstha(data[0]);
        }
      })
      .catch(err => console.error('Failed to fetch SansthaDetails:', err));
  }, []);

  const handlePrint = async () => {
    try {
      await fetch(`/api/ShareCertificates/${certificate.certificateId}/print`, {
        method: 'POST'
      });
    } catch (e) {
      console.error('Failed to log print', e);
    }
    window.print();
  };

  const amountInWords = getAmountInWordsMarathi(certificate.totalAmount);

  // Format date to DD/MM/YYYY
  const formattedDate = (() => {
    if (!certificate.issueDate) return new Date().toLocaleDateString('en-GB');
    try {
      const d = new Date(certificate.issueDate);
      if (isNaN(d.getTime())) return certificate.issueDate;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return certificate.issueDate;
    }
  })();

  // Theme primary color mappings
  const themeColors = {
    'navy-gold': {
      primary: '#102a43',
      primaryLight: '#1e3a5f',
      gold: '#996515',
      goldLight: '#b8860b',
      sealText: '#102a43',
      accentBg: 'bg-blue-50/50'
    },
    'royal-maroon': {
      primary: '#8b1528',
      primaryLight: '#a81c33',
      gold: '#996515',
      goldLight: '#b8860b',
      sealText: '#8b1528',
      accentBg: 'bg-red-50/50'
    },
    'classic-emerald': {
      primary: '#136f4d',
      primaryLight: '#1b8a61',
      gold: '#996515',
      goldLight: '#b8860b',
      sealText: '#136f4d',
      accentBg: 'bg-emerald-50/50'
    }
  }[certificateTheme];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      {/* Modal Container */}
      <div className="bg-white text-gray-900 w-full max-w-5xl max-h-[96vh] flex flex-col rounded-lg shadow-2xl overflow-hidden border border-gray-300 print-modal-container">
        
        {/* Top Action Bar (Clean, Bright & Professional) */}
        <div className="bg-slate-100 px-4 py-2.5 flex flex-wrap justify-between items-center border-b border-gray-300 no-print gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-primary font-bold">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                <span>अधिकृत शेअर प्रमाणपत्र प्रिव्ह्यू (Official Share Certificate)</span>
                <span className="bg-blue-50 text-blue-900 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {certificate.certificateNo}
                </span>
              </h2>
              <p className="text-[10px] text-gray-500">
                महाराष्ट्र सहकारी संस्था अधिनियम १९६० अन्वये कायदेशीर भाग प्रमाणपत्र स्वरूप
              </p>
            </div>
          </div>

          {/* Background Color & Theme Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Background Color Selector */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-300 text-xs shadow-2xs">
              <span className="text-[10px] text-gray-600 font-bold mr-0.5">बॅकग्राऊंड रंग:</span>
              <button
                type="button"
                onClick={() => setPaperBgColor('#ffffff')}
                title="शुभ्र पांढरा (Pure White)"
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                  paperBgColor === '#ffffff' ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-400"></span>
                पांढरा
              </button>

              <button
                type="button"
                onClick={() => setPaperBgColor('#fffdf5')}
                title="शाही क्रीम / आयव्हरी (Ivory Cream)"
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                  paperBgColor === '#fffdf5' ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-2xs' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#fffdf5] border border-amber-300"></span>
                क्रीम / आयव्हरी
              </button>

              <button
                type="button"
                onClick={() => setPaperBgColor('#fbf8ee')}
                title="पार्चमेंट गोल्ड (Parchment Gold)"
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                  paperBgColor === '#fbf8ee' ? 'bg-amber-100 border-amber-600 text-amber-950 shadow-2xs' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#fbf8ee] border border-amber-400"></span>
                पार्चमेंट
              </button>

              <button
                type="button"
                onClick={() => setPaperBgColor('#f4f8fc')}
                title="सॉफ्ट सिल्क ब्ल्यू (Soft Silk Blue)"
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                  paperBgColor === '#f4f8fc' ? 'bg-blue-100 border-blue-500 text-blue-950 shadow-2xs' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#f4f8fc] border border-blue-300"></span>
                सिल्क ब्ल्यू
              </button>
            </div>

            {/* Print Button */}
            <button 
              type="button"
              onClick={handlePrint}
              className="bg-primary hover:bg-[#004a75] text-white px-3.5 py-1.5 rounded-sm font-bold shadow-xs transition-all text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ प्रिंट करा (Print)</span>
            </button>

            {/* Close Button */}
            <button 
              type="button"
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5 rounded-sm font-bold text-xs flex items-center gap-1 cursor-pointer transition"
              title="बंद करा"
            >
              <X className="w-3.5 h-3.5" />
              <span>बंद करा</span>
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area (Bright & Clear Backdrop) */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center bg-slate-200/90 items-start">
          
          {/* ========================================================================= */}
          {/* A4 CERTIFICATE CANVAS (PRINT & VIEW) */}
          {/* ========================================================================= */}
          <div 
            ref={printRef} 
            className="print-area shadow-2xl relative select-none"
            style={{ 
              width: '210mm', 
              minHeight: '297mm', 
              padding: '12mm',
              boxSizing: 'border-box',
              backgroundColor: paperBgColor,
              color: '#1a1a1a',
              fontFamily: "'Noto Serif Devanagari', 'Georgia', 'Times New Roman', serif"
            }}
          >
            {/* 1. Outer Multi-Layer Luxury Guilloché Ornamental Borders */}
            <div className="absolute inset-[6mm] border-[5px] border-[#996515] pointer-events-none rounded-xs" />
            <div className="absolute inset-[8mm] border-[2px] border-[#102a43] pointer-events-none rounded-xs" />
            <div className="absolute inset-[10mm] border-[1px] border-dashed border-[#b8860b] pointer-events-none rounded-xs opacity-70" />

            {/* Corner Decorative Ornaments */}
            <div className="absolute top-[5mm] left-[5mm] text-[#996515] text-xl font-bold select-none">❖</div>
            <div className="absolute top-[5mm] right-[5mm] text-[#996515] text-xl font-bold select-none">❖</div>
            <div className="absolute bottom-[5mm] left-[5mm] text-[#996515] text-xl font-bold select-none">❖</div>
            <div className="absolute bottom-[5mm] right-[5mm] text-[#996515] text-xl font-bold select-none">❖</div>

            {/* Background Watermark Emblem */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] overflow-hidden">
              <div className="w-[140mm] h-[140mm] rounded-full border-[15px] border-[#102a43] flex items-center justify-center font-bold text-8xl text-[#102a43] transform -rotate-12">
                🏛️
              </div>
            </div>

            {/* Certificate Inner Container */}
            <div className="relative z-10 flex flex-col justify-between h-full px-4 py-2 text-slate-900">
              
              {/* ========================================================================= */}
              {/* 2. SOCIETY HEADER & LEGAL CREDENTIALS */}
              {/* ========================================================================= */}
              <div className="text-center pb-2 border-b-2 border-[#b8860b]">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#102a43] to-[#243b53] border-2 border-[#b8860b] flex items-center justify-center text-2xl shadow-xs text-amber-300">
                    🏛️
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#102a43] leading-none uppercase drop-shadow-2xs">
                      {sanstha?.sansthaName || 'आदर्श नागरिक सहकारी पतसंस्था मर्यादित'}
                    </h1>
                    <p className="text-[11px] font-bold text-[#825a1e] tracking-wide mt-1">
                      ( महाराष्ट्र सहकारी संस्था अधिनियम १९६० अन्वये अधिकृत नोंदणीकृत )
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-gray-700 font-semibold flex flex-wrap justify-center items-center gap-x-4 gap-y-0.5 mt-1">
                  <span>📍 {sanstha?.address || 'मुख्य कार्यालय: शिवाजी चौक, मुख्य रस्ता'}, {sanstha?.village || ''} {sanstha?.taluka ? `ता. ${sanstha.taluka}` : ''} {sanstha?.district ? `जि. ${sanstha.district}` : ''} {sanstha?.pinCode ? `- ${sanstha.pinCode}` : ''}</span>
                  {sanstha?.contactNo && <span>📞 फोन: {sanstha.contactNo}</span>}
                  {sanstha?.email && <span>✉️ ई-मेल: {sanstha.email}</span>}
                </div>

                <div className="text-[10px] text-gray-600 font-bold mt-1 bg-amber-50/80 inline-block px-3 py-0.5 rounded border border-amber-200">
                  नोंदणी क्रमांक: <span className="font-mono font-bold text-[#102a43]">{sanstha?.registrationNo || 'PNE/BNK/123/2010'}</span>
                  {sanstha?.registrationDate && <span> | नोंदणी दिनांक: {new Date(sanstha.registrationDate).toLocaleDateString('en-GB')}</span>}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 3. ORNATE TITLE EMBLEM & METADATA BAR */}
              {/* ========================================================================= */}
              <div className="text-center my-3">
                <div className="inline-block relative">
                  <div className="bg-gradient-to-r from-[#102a43] via-[#1e3a5f] to-[#102a43] text-white px-8 py-1.5 rounded-full border-2 border-[#b8860b] shadow-md">
                    <span className="text-lg font-black tracking-widest uppercase text-amber-200">
                      भाग प्रमाणपत्र
                    </span>
                    <span className="text-xs tracking-wider ml-2 text-blue-100 font-sans font-bold">
                      ( SHARE CERTIFICATE )
                    </span>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-0.5 bg-[#b8860b]"></div>
                </div>
              </div>

              {/* 4-Box Key Reference Strip */}
              <div className="grid grid-cols-4 gap-2 mb-3 bg-amber-50/50 p-2 rounded border border-amber-300 text-xs shadow-2xs">
                <div className="border-r border-amber-200 pr-1">
                  <span className="text-[10px] text-gray-600 font-bold block">प्रमाणपत्र क्रमांक (Cert No.)</span>
                  <span className="font-mono font-black text-red-700 text-xs tracking-wider">{certificate.certificateNo}</span>
                </div>
                <div className="border-r border-amber-200 pr-1">
                  <span className="text-[10px] text-gray-600 font-bold block">जारी दिनांक (Issue Date)</span>
                  <span className="font-bold text-[#102a43] text-xs">{formattedDate}</span>
                </div>
                <div className="border-r border-amber-200 pr-1">
                  <span className="text-[10px] text-gray-600 font-bold block">सभासद क्रमांक (Member ID)</span>
                  <span className="font-mono font-black text-emerald-800 text-xs">
                    {certificate.memberNo || 'MEM0001'}
                    {certificate.legacyMemberNo && <span className="text-gray-500 font-normal ml-1">({certificate.legacyMemberNo})</span>}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-600 font-bold block">शेअर खाते क्र. (Share A/c No)</span>
                  <span className="font-mono font-bold text-[#102a43] text-xs">{certificate.accountNo || 'SH-0001'}</span>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 4. MEMBER CERTIFICATION & LEGAL DECLARATION */}
              {/* ========================================================================= */}
              <div className="text-justify text-xs leading-relaxed px-2 space-y-2.5">
                
                {/* Legal Certification Statement */}
                <p className="indent-6 text-gray-900 leading-5">
                  याद्वारे प्रमाणित करण्यात येते की, खालील तपशील असलेले सभासद संस्थेच्या अधिकृत भाग भांडवल नोंदवहीत नोंदवले गेले असून, ते या संस्थेचे खालीलप्रमाणे प्रत्येकी <b className="text-[#102a43]">₹{certificate.faceValue.toFixed(2)}/- (अक्षरी रुपये शंभर फक्त)</b> दर्शनी मूल्याचे पूर्ण भरणा झालेले शेअर्स संस्थेच्या उपविधी (Bye-laws) व नियमांच्या अधीन राहून कायदेशीररित्या धारण करीत आहेत.
                </p>

                {/* Member Profile Box */}
                <div className="bg-white/95 p-3 rounded border border-gray-300 shadow-2xs grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">भागधारकाचे संपूर्ण नाव (Shareholder Full Name):</span>
                    <span className="text-sm font-black text-[#102a43]">
                      श्री / श्रीमती {certificate.memberName}
                    </span>
                    {certificate.memberNameEng && (
                      <span className="block text-[10px] text-gray-600 font-sans italic">
                        ({certificate.memberNameEng})
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">वडिलांचे / पतीचे नाव (Father / Husband Name):</span>
                    <span className="font-bold text-gray-800">
                      {certificate.fatherHusbandName ? `श्री. ${certificate.fatherHusbandName}` : '-'}
                    </span>
                  </div>

                  <div className="md:col-span-2 border-t border-gray-100 pt-1 flex flex-wrap items-center justify-between gap-1">
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block">पत्ता व रहिवासी गाव (Residential Address & Village):</span>
                      <span className="font-bold text-gray-800">
                        {certificate.memberAddress || certificate.village || 'संस्थेच्या कार्यक्षेत्रातील रहिवासी'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded font-bold">
                        {certificate.membershipType === 'Associate' ? 'सह-सभासद (Associate)' : certificate.membershipType === 'Nominal' ? 'नाममात्र (Nominal)' : 'नियमित सभासद (Regular Member)'}
                      </span>
                    </div>
                  </div>

                  {certificate.jointMemberNames && (
                    <div className="md:col-span-2 bg-indigo-50/80 p-1.5 rounded border border-indigo-200">
                      <span className="text-[10px] text-indigo-900 font-bold block">सह-धारक / संयुक्त सभासद (Joint / Associate Holder):</span>
                      <span className="text-xs font-black text-indigo-950">
                        {certificate.jointMemberNames}
                      </span>
                    </div>
                  )}
                </div>

                {/* ========================================================================= */}
                {/* 5. DISTINCTIVE SHAREHOLDING SCHEDULE TABLE */}
                {/* ========================================================================= */}
                <div className="pt-1">
                  <table className="w-full border-collapse text-xs border-2 border-[#102a43] text-center shadow-xs">
                    <thead>
                      <tr className="bg-[#102a43] text-amber-200 font-bold text-[11px]">
                        <th className="border border-blue-900 py-1.5 px-2">शेअर नंबर पासून<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(From Share No.)</span></th>
                        <th className="border border-blue-900 py-1.5 px-2">शेअर नंबर पर्यंत<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(To Share No.)</span></th>
                        <th className="border border-blue-900 py-1.5 px-2">एकूण शेअर्स संख्या<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(No. of Shares)</span></th>
                        <th className="border border-blue-900 py-1.5 px-2">दर्शनी मूल्य<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(Face Value)</span></th>
                        <th className="border border-blue-900 py-1.5 px-2">एकूण जमा भागभांडवल<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(Total Amount)</span></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white font-mono font-bold text-gray-900">
                      <tr className="border-b border-gray-300">
                        <td className="border-r border-gray-300 py-2 text-sm">{certificate.fromShareNo}</td>
                        <td className="border-r border-gray-300 py-2 text-sm">{certificate.toShareNo}</td>
                        <td className="border-r border-gray-300 py-2 text-sm text-emerald-800">{certificate.numberOfShares}</td>
                        <td className="border-r border-gray-300 py-2 text-sm">₹{certificate.faceValue.toFixed(2)}</td>
                        <td className="py-2 text-base font-black text-blue-950 bg-blue-50/50">
                          ₹{certificate.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Amount in Marathi Words Callout */}
                <div className="bg-emerald-50/80 border border-emerald-300 p-2 rounded text-xs font-bold text-emerald-950 flex items-center justify-between">
                  <span>रक्कम अक्षरी: <span className="font-black text-emerald-900 underline underline-offset-2">{amountInWords}</span></span>
                  <span className="text-[10px] text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                    शेअर्स संख्या: {certificate.numberOfShares}
                  </span>
                </div>

              </div>

              {/* ========================================================================= */}
              {/* 6. SIGNATORIES & OFFICIAL EMBOSSED SEAL */}
              {/* ========================================================================= */}
              <div className="pt-6 pb-2">
                <div className="flex justify-between items-end px-2">
                  
                  {/* Manager / CEO */}
                  <div className="text-center w-36">
                    <div className="border-b-2 border-gray-800 mb-1.5 h-10"></div>
                    <span className="font-bold text-xs text-gray-900 block">व्यवस्थापक / खजिनदार</span>
                    <span className="text-[9px] text-gray-500 font-sans block">(Manager / Treasurer)</span>
                  </div>

                  {/* Central Official Seal */}
                  <div className="flex flex-col items-center justify-center relative">
                    <div className="w-20 h-20 border-2 border-double border-[#b8860b] rounded-full flex flex-col items-center justify-center text-[#b8860b] text-[9px] font-black p-1 bg-amber-50/30 text-center shadow-xs">
                      <ShieldCheck className="w-4 h-4 text-[#b8860b] mb-0.5" />
                      <span>संस्थेची</span>
                      <span className="text-[8px] tracking-widest text-[#102a43]">अधिकृत मुद्रा</span>
                      <span className="text-[7px] text-gray-500 font-sans">OFFICIAL SEAL</span>
                    </div>
                  </div>

                  {/* Secretary */}
                  <div className="text-center w-36">
                    <div className="border-b-2 border-gray-800 mb-1.5 h-10"></div>
                    <span className="font-bold text-xs text-gray-900 block">मानद सचिव</span>
                    <span className="text-[9px] text-gray-500 font-sans block">(Hon. Secretary)</span>
                  </div>

                  {/* Chairman */}
                  <div className="text-center w-36">
                    <div className="border-b-2 border-gray-800 mb-1.5 h-10"></div>
                    <span className="font-bold text-xs text-gray-900 block">चेअरमन / अध्यक्ष</span>
                    <span className="text-[9px] text-gray-500 font-sans block">(Chairman / President)</span>
                  </div>

                </div>
              </div>

              {/* ========================================================================= */}
              {/* 7. IMPORTANT BYE-LAWS FOOTNOTE */}
              {/* ========================================================================= */}
              <div className="border-t border-gray-300 pt-1.5 text-[9px] text-gray-600 leading-tight">
                <div className="font-bold text-gray-700 mb-0.5">महत्वाच्या सूचना व नियम:</div>
                <div className="grid grid-cols-2 gap-x-2">
                  <p>१. सदर प्रमाणपत्र संस्थेच्या संचालक मंडळाच्या मान्यतेने व उपविधीनुसार जारी करण्यात आले आहे.</p>
                  <p>२. संस्थेच्या पूर्वपरवानगीशिवाय हे प्रमाणपत्र कोणालाही परस्पर हस्तांतरित करता येणार नाही.</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* High-DPI Print Stylesheet */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body * {
            visibility: hidden !important;
          }
          .print-area, .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            background-color: ${paperBgColor} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-modal-container {
            background: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
};

export default ShareCertificatePreview;
