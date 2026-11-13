import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { getAmountInWordsMarathi } from '../utils/marathiWords';
import { Printer, X, Award, ShieldCheck, Copy } from 'lucide-react';

export interface CertificateData {
  certificateId: number;
  certificateNo: string;
  issueDate: string;
  memberId?: number;
  branchId?: number;
  branchName?: string;
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
  taluka?: string;
  district?: string;
  mobileNo?: string;
  fatherHusbandName?: string;
  occupation?: string;
  age?: number | null;
  nomineeName?: string;
  nomineeRelation?: string;
  status?: string;
  rawStatus?: string;
  printCount?: number;
  cancellationReason?: string;
  jointMemberNames?: string;
  membershipType?: string;
}

interface Props {
  certificate: CertificateData;
  onClose: () => void;
  onPrinted?: (certificateId: number, newPrintCount: number) => void;
}

const ShareCertificatePreview: React.FC<Props> = ({ certificate, onClose, onPrinted }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [sanstha, setSanstha] = useState<any>(null);
  const [localPrintCount, setLocalPrintCount] = useState<number>(certificate.printCount || 0);
  const [showDuplicateBadge, setShowDuplicateBadge] = useState<boolean>((certificate.printCount || 0) > 0);

  // Background Paper Colors
  const [paperBgColor, setPaperBgColor] = useState<string>('#fffdf5'); // Default: Royal Ivory Cream

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios
      .get('/api/SansthaDetails', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSanstha(res.data[0]);
        }
      })
      .catch(err => console.error('Failed to fetch SansthaDetails:', err));
  }, []);

  const handlePrint = async () => {
    try {
      if (certificate.certificateId && certificate.certificateId > 0) {
        const token = localStorage.getItem('token');
        const res = await axios.post(
          `/api/ShareCertificates/${certificate.certificateId}/print`,
          {},
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        );
        const updatedCount = res.data?.printCount ?? localPrintCount + 1;
        setLocalPrintCount(updatedCount);
        if (onPrinted) {
          onPrinted(certificate.certificateId, updatedCount);
        }
      }
    } catch (e) {
      console.error('Failed to log print', e);
    }
    window.print();
  };

  const amountInWords = getAmountInWordsMarathi(certificate.totalAmount);
  const faceValueInWords = getAmountInWordsMarathi(certificate.faceValue);

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

  return (
    <div className="share-cert-preview-modal fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      {/* Modal Container */}
      <div className="bg-white text-gray-900 w-full max-w-5xl max-h-[96vh] flex flex-col rounded-sm shadow-2xl overflow-hidden border border-primary/30 print-modal-container">
        
        {/* Top Action Bar (Theme Matched) */}
        <div className="bg-primary/10 px-4 py-2.5 flex flex-wrap justify-between items-center border-b border-primary/25 no-print gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-primary flex items-center gap-2">
                <span>अधिकृत शेअर प्रमाणपत्र प्रिव्ह्यू (Official Share Certificate)</span>
                <span className="bg-white text-primary border border-primary/30 text-[10px] px-2 py-0.5 rounded-sm font-mono font-bold">
                  {certificate.certificateNo}
                </span>
                <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[10px] px-2 py-0.5 rounded-sm font-bold">
                  प्रिंट संख्या: {localPrintCount}
                </span>
              </h2>
              <p className="text-[10px] text-slate-600 font-medium">
                महाराष्ट्र सहकारी संस्था अधिनियम १९६० अन्वये अधिकृत भाग प्रमाणपत्र स्वरूप
              </p>
            </div>
          </div>

          {/* Background Color & Copy Mode Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Original / Duplicate Toggle */}
            <button
              type="button"
              onClick={() => setShowDuplicateBadge(prev => !prev)}
              className={`px-2.5 py-1 rounded-sm border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
                showDuplicateBadge
                  ? 'bg-amber-100 border-amber-400 text-amber-900'
                  : 'bg-white border-primary/30 text-primary'
              }`}
              title="मूळ प्रत / दुय्यम प्रत (Original / Duplicate Copy)"
            >
              <Copy className="w-3 h-3" />
              <span>{showDuplicateBadge ? 'दुय्यम प्रत (Duplicate)' : 'मूळ प्रत (Original)'}</span>
            </button>

            {/* Background Color Selector */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-sm border border-gray-300 text-xs shadow-2xs">
              <span className="text-[10px] text-gray-600 font-bold mr-0.5">कागद रंग:</span>
              <button
                type="button"
                onClick={() => setPaperBgColor('#ffffff')}
                title="शुभ्र पांढरा (Pure White)"
                className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                  paperBgColor === '#ffffff' ? 'bg-primary/10 border-primary text-primary shadow-2xs' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-400"></span>
                पांढरा
              </button>

              <button
                type="button"
                onClick={() => setPaperBgColor('#fffdf5')}
                title="शाही क्रीम / आयव्हरी (Ivory Cream)"
                className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                  paperBgColor === '#fffdf5' ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-2xs' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#fffdf5] border border-amber-300"></span>
                क्रीम
              </button>

              <button
                type="button"
                onClick={() => setPaperBgColor('#fbf8ee')}
                title="पार्चमेंट गोल्ड (Parchment Gold)"
                className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
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
                className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
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
              className="bg-primary hover:opacity-90 text-white px-3.5 py-1.5 rounded-sm font-bold shadow-2xs transition-all text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>प्रिंट करा (Print)</span>
            </button>

            {/* Close Button */}
            <button 
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 px-3 py-1.5 rounded-sm font-bold text-xs flex items-center gap-1 cursor-pointer transition"
              title="बंद करा"
            >
              <X className="w-3.5 h-3.5" />
              <span>बंद करा</span>
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center bg-slate-200/90 items-start print-scroll-wrapper">
          
          {/* ========================================================================= */}
          {/* A4 CERTIFICATE CANVAS (PRINT & VIEW) */}
          {/* ========================================================================= */}
          <div 
            ref={printRef} 
            className="print-area shadow-2xl relative select-none"
            style={{ 
              width: '210mm', 
              minHeight: '282mm', 
              padding: '12mm',
              boxSizing: 'border-box',
              backgroundColor: paperBgColor,
              color: '#1a1a1a',
              fontFamily: "'Noto Serif Devanagari', 'Georgia', 'Times New Roman', serif"
            }}
          >
            {/* 1. Outer Multi-Layer Ornamental Borders */}
            <div className="absolute inset-[5mm] border-[4px] border-[#996515] pointer-events-none rounded-xs" />
            <div className="absolute inset-[7mm] border-[2px] border-[#102a43] pointer-events-none rounded-xs" />
            <div className="absolute inset-[9mm] border-[1px] border-dashed border-[#b8860b] pointer-events-none rounded-xs opacity-70" />

            {/* Corner Decorative Ornaments */}
            <div className="absolute top-[4mm] left-[4mm] text-[#996515] text-lg font-bold select-none">❖</div>
            <div className="absolute top-[4mm] right-[4mm] text-[#996515] text-lg font-bold select-none">❖</div>
            <div className="absolute bottom-[4mm] left-[4mm] text-[#996515] text-lg font-bold select-none">❖</div>
            <div className="absolute bottom-[4mm] right-[4mm] text-[#996515] text-lg font-bold select-none">❖</div>

            {/* Cancelled or Duplicate Watermark */}
            {certificate.status === 'Cancelled' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-hidden">
                <div className="border-8 border-red-600/35 text-red-600/35 font-black text-6xl px-10 py-4 rounded-xl transform -rotate-30 uppercase tracking-widest">
                  रद्द (CANCELLED)
                </div>
              </div>
            )}

            {/* Background Watermark Emblem */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] overflow-hidden">
              <div className="w-[135mm] h-[135mm] rounded-full border-[14px] border-[#102a43] flex items-center justify-center font-bold text-8xl text-[#102a43] transform -rotate-12">
                🏛️
              </div>
            </div>

            {/* Certificate Inner Container */}
            <div className="relative z-10 flex flex-col justify-between h-full px-4 py-2 text-slate-900">
              
              {/* ========================================================================= */}
              {/* 2. SOCIETY HEADER & LEGAL CREDENTIALS */}
              {/* ========================================================================= */}
              <div className="text-center pb-2.5 border-b-2 border-[#b8860b]">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#102a43] to-[#243b53] border-2 border-[#b8860b] flex items-center justify-center text-2xl shadow-xs text-amber-300">
                    🏛️
                  </div>
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#102a43] leading-none uppercase">
                      {sanstha?.sansthaName || 'आदर्श नागरिक सहकारी पतसंस्था मर्यादित'}
                    </h1>
                    <p className="text-[11px] font-bold text-[#825a1e] tracking-wide mt-1">
                      ( महाराष्ट्र सहकारी संस्था अधिनियम १९६० अन्वये अधिकृत नोंदणीकृत संस्था )
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-gray-700 font-semibold flex flex-wrap justify-center items-center gap-x-4 gap-y-0.5 mt-1">
                  <span>
                    📍 {sanstha?.address || 'मुख्य कार्यालय'}, {sanstha?.village || ''}{' '}
                    {sanstha?.taluka ? `ता. ${sanstha.taluka}` : ''}{' '}
                    {sanstha?.district ? `जि. ${sanstha.district}` : ''}{' '}
                    {sanstha?.pinCode ? `- ${sanstha.pinCode}` : ''}
                  </span>
                  {sanstha?.contactNo && <span>📞 फोन: {sanstha.contactNo}</span>}
                  {sanstha?.email && <span>✉️ ई-मेल: {sanstha.email}</span>}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-1.5">
                  <div className="text-[10px] text-gray-700 font-bold bg-amber-50/90 inline-block px-3 py-0.5 rounded border border-amber-200">
                    नोंदणी क्रमांक: <span className="font-mono font-bold text-[#102a43]">{sanstha?.registrationNo || 'PNE/BNK/123/2010'}</span>
                    {sanstha?.registrationDate && <span> | नोंदणी दिनांक: {new Date(sanstha.registrationDate).toLocaleDateString('en-GB')}</span>}
                  </div>
                  {certificate.branchName && (
                    <div className="text-[10px] text-blue-900 font-bold bg-blue-50/90 inline-block px-2.5 py-0.5 rounded border border-blue-200">
                      शाखा: {certificate.branchName}
                    </div>
                  )}
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 3. ORNATE TITLE EMBLEM & METADATA BAR */}
              {/* ========================================================================= */}
              <div className="text-center my-3 relative">
                <div className="inline-block relative">
                  <div className="bg-gradient-to-r from-[#102a43] via-[#1e3a5f] to-[#102a43] text-white px-8 py-1.5 rounded-full border-2 border-[#b8860b] shadow-md">
                    <span className="text-lg font-black tracking-widest uppercase text-amber-200">
                      भाग प्रमाणपत्र
                    </span>
                    <span className="text-xs tracking-wider ml-2 text-blue-100 font-sans font-bold">
                      ( OFFICIAL SHARE CERTIFICATE )
                    </span>
                  </div>
                </div>
                {showDuplicateBadge && (
                  <div className="mt-1">
                    <span className="inline-block bg-amber-100 text-amber-900 border border-amber-400 px-3 py-0.5 rounded text-[10px] font-black tracking-wider uppercase">
                      दुय्यम प्रत (DUPLICATE COPY)
                    </span>
                  </div>
                )}
              </div>

              {/* 5-Box Key Reference Strip */}
              <div className="grid grid-cols-5 gap-2 mb-3 bg-amber-50/60 p-2.5 rounded border border-amber-300 text-xs shadow-2xs">
                <div className="border-r border-amber-200 pr-1.5">
                  <span className="text-[10px] text-gray-600 font-bold block">प्रमाणपत्र क्र. (Cert No.)</span>
                  <span className="font-mono font-black text-red-700 text-xs tracking-wider">{certificate.certificateNo}</span>
                </div>
                <div className="border-r border-amber-200 pr-1.5">
                  <span className="text-[10px] text-gray-600 font-bold block">वाटप दिनांक (Issue Date)</span>
                  <span className="font-bold text-[#102a43] text-xs">{formattedDate}</span>
                </div>
                <div className="border-r border-amber-200 pr-1.5">
                  <span className="text-[10px] text-gray-600 font-bold block">सभासद क्र. (Member No.)</span>
                  <span className="font-mono font-black text-emerald-800 text-xs">
                    {certificate.memberNo || '-'}
                  </span>
                </div>
                <div className="border-r border-amber-200 pr-1.5">
                  <span className="text-[10px] text-gray-600 font-bold block">जुना क्र. / L.F. क्र.</span>
                  <span className="font-mono font-black text-amber-900 text-xs">
                    {certificate.legacyMemberNo || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-600 font-bold block">शेअर खाते / CIF क्र.</span>
                  <span className="font-mono font-bold text-[#102a43] text-xs">
                    {certificate.accountNo || '-'}
                    {certificate.cifNo ? ` (${certificate.cifNo})` : ''}
                  </span>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 4. MEMBER CERTIFICATION & LEGAL DECLARATION */}
              {/* ========================================================================= */}
              <div className="text-justify text-xs leading-relaxed px-1 space-y-2.5">
                
                {/* Legal Certification Statement */}
                <p className="indent-6 text-gray-900 leading-5">
                  याद्वारे प्रमाणित करण्यात येते की, खालील तपशील असलेले सभासद संस्थेच्या अधिकृत भाग भांडवल नोंदवहीत (Share Register) नोंदवले गेले असून, ते या संस्थेचे खालीलप्रमाणे प्रत्येकी <b className="text-[#102a43]">₹{certificate.faceValue.toFixed(2)}/- ({faceValueInWords})</b> दर्शनी मूल्याचे पूर्ण भरणा झालेले शेअर्स (Fully Paid-up Shares) संस्थेच्या उपविधी (Bye-laws) व नियमांच्या अधीन राहून कायदेशीररित्या धारण करीत आहेत.
                </p>

                {/* Member Profile Box */}
                <div className="bg-white/95 p-3 rounded border border-gray-300 shadow-2xs grid grid-cols-12 gap-x-4 gap-y-2 text-xs">
                  <div className="col-span-7">
                    <span className="text-[10px] text-gray-500 font-bold block">भागधारकाचे संपूर्ण नाव (Shareholder Full Name):</span>
                    <span className="text-sm font-black text-[#102a43]">
                      श्री / श्रीमती {certificate.memberName || '-'}
                    </span>
                    {certificate.memberNameEng && (
                      <span className="block text-[10px] text-gray-600 font-sans italic">
                        ({certificate.memberNameEng})
                      </span>
                    )}
                  </div>

                  <div className="col-span-5">
                    <span className="text-[10px] text-gray-500 font-bold block">वडिलांचे / पतीचे नाव (Father / Husband Name):</span>
                    <span className="font-bold text-gray-800">
                      {certificate.fatherHusbandName ? `श्री. ${certificate.fatherHusbandName}` : '-'}
                    </span>
                  </div>

                  <div className="col-span-7 border-t border-gray-100 pt-1.5">
                    <span className="text-[10px] text-gray-500 font-bold block">पत्ता व रहिवासी गाव (Residential Address & Village):</span>
                    <span className="font-bold text-gray-800">
                      {certificate.memberAddress || certificate.village || 'संस्थेच्या कार्यक्षेत्रातील रहिवासी'}
                      {certificate.taluka ? `, ता. ${certificate.taluka}` : ''}
                      {certificate.district ? `, जि. ${certificate.district}` : ''}
                    </span>
                  </div>

                  <div className="col-span-5 border-t border-gray-100 pt-1.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block">मोबाईल / व्यवसाय:</span>
                      <span className="font-bold text-gray-800">
                        {certificate.mobileNo || '-'}
                        {certificate.occupation ? ` (${certificate.occupation})` : ''}
                        {certificate.age ? `, वय: ${certificate.age}` : ''}
                      </span>
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded font-bold shrink-0">
                      {certificate.membershipType === 'Associate'
                        ? 'सह-सभासद (वर्ग ब)'
                        : certificate.membershipType === 'Nominal'
                          ? 'नाममात्र (वर्ग क)'
                          : 'नियमित सभासद (वर्ग अ)'}
                    </span>
                  </div>

                  {(certificate.nomineeName || certificate.jointMemberNames) && (
                    <div className="col-span-12 border-t border-gray-100 pt-1.5 grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold block">अधिकृत वारसदाराचे नाव व नाते (Nominee & Relation):</span>
                        <span className="font-bold text-gray-900">
                          {certificate.nomineeName
                            ? `${certificate.nomineeName}${certificate.nomineeRelation ? ` (${certificate.nomineeRelation})` : ''}`
                            : '-'}
                        </span>
                      </div>
                      {certificate.jointMemberNames && (
                        <div className="bg-indigo-50/80 px-2 py-1 rounded border border-indigo-200">
                          <span className="text-[10px] text-indigo-900 font-bold block">सह-धारक / संयुक्त सभासद (Joint Holder):</span>
                          <span className="text-xs font-black text-indigo-950">
                            {certificate.jointMemberNames}
                          </span>
                        </div>
                      )}
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
                        <th className="border border-blue-900 py-1.5 px-2">शेअर क्रमांक पासून<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(From Share No.)</span></th>
                        <th className="border border-blue-900 py-1.5 px-2">शेअर क्रमांक पर्यंत<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(To Share No.)</span></th>
                        <th className="border border-blue-900 py-1.5 px-2">एकूण शेअर्स संख्या<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(No. of Shares)</span></th>
                        <th className="border border-blue-900 py-1.5 px-2">प्रती शेअर दर्शनी मूल्य<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(Face Value)</span></th>
                        <th className="border border-blue-900 py-1.5 px-2">एकूण जमा भागभांडवल रक्कम<br /><span className="text-[9px] text-blue-200 font-normal font-sans">(Total Share Capital ₹)</span></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white font-mono font-bold text-gray-900">
                      <tr className="border-b border-gray-300">
                        <td className="border-r border-gray-300 py-2.5 text-sm">{certificate.fromShareNo}</td>
                        <td className="border-r border-gray-300 py-2.5 text-sm">{certificate.toShareNo}</td>
                        <td className="border-r border-gray-300 py-2.5 text-sm text-emerald-800 font-black">{certificate.numberOfShares}</td>
                        <td className="border-r border-gray-300 py-2.5 text-sm">₹{certificate.faceValue.toFixed(2)}</td>
                        <td className="py-2.5 text-base font-black text-blue-950 bg-blue-50/50">
                          ₹{certificate.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Amount in Marathi Words Callout */}
                <div className="bg-emerald-50/80 border border-emerald-300 p-2 rounded text-xs font-bold text-emerald-950 flex items-center justify-between">
                  <span>रक्कम अक्षरी: <span className="font-black text-emerald-900 underline underline-offset-2">{amountInWords}</span></span>
                  <span className="text-[10px] text-emerald-800 bg-white px-2.5 py-0.5 rounded border border-emerald-200 font-black">
                    एकूण शेअर्स: {certificate.numberOfShares} (क्र. {certificate.fromShareNo} ते {certificate.toShareNo})
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
                    <span className="font-bold text-xs text-gray-900 block">व्यवस्थापक / मुख्य कार्यकारी</span>
                    <span className="text-[9px] text-gray-500 font-sans block">(Manager / CEO)</span>
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

                  {/* Secretary / Director */}
                  <div className="text-center w-36">
                    <div className="border-b-2 border-gray-800 mb-1.5 h-10"></div>
                    <span className="font-bold text-xs text-gray-900 block">मानद सचिव / संचालक</span>
                    <span className="text-[9px] text-gray-500 font-sans block">(Hon. Secretary / Director)</span>
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
                <div className="font-bold text-gray-700 mb-0.5">महत्वाच्या सूचना व नियम (Important Rules):</div>
                <div className="grid grid-cols-2 gap-x-3">
                  <p>१. सदर प्रमाणपत्र संस्थेच्या संचालक मंडळाच्या मान्यतेने व उपविधीनुसार जारी करण्यात आले आहे.</p>
                  <p>२. संस्थेच्या पूर्वपरवानगीशिवाय हे प्रमाणपत्र कोणालाही परस्पर हस्तांतरित किंवा गहाण ठेवता येणार नाही.</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* High-DPI Single-Page A4 Print Isolation Stylesheet */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
          }
          /* Hide the background ShareCertificateReport table completely when preview modal is open */
          .share-cert-report-main {
            display: none !important;
          }
          .no-print {
            display: none !important;
          }
          .share-cert-preview-modal {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          .print-modal-container {
            max-width: 100% !important;
            max-height: none !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .print-scroll-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            overflow: visible !important;
            display: block !important;
          }
          .print-area {
            width: 100% !important;
            max-width: 198mm !important;
            min-height: 278mm !important;
            margin: 0 auto !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background-color: ${paperBgColor} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
    </div>
  );
};

export default ShareCertificatePreview;
