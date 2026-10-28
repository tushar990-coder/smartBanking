import React, { useState, useEffect, useRef } from 'react';
import SearchableSelect from './SearchableSelect';
import { Camera, Image as ImageIcon, ZoomIn, RefreshCw, Sparkles, Trash2, Edit3, X, Plus, Receipt } from 'lucide-react';
import GoldLoanReceiptPrintModal, { GoldLoanReceiptData, GoldLoanReceiptItem } from './GoldLoanReceiptPrintModal';

interface GoldLoanDetail {
  goldLoanDetailID: number;
  loanAccountID: number;
  ornamentName: string;
  quantity: number;
  grossWeight: number;
  netWeight: number;
  purity: number;
  goldRatePerGram: number;
  estimatedValue: number;
  imagePath: string | null;
  valuerName?: string | null;
  valuerValuation?: number;
  valuationReceiptNo?: string | null;
  valuationDate?: string | null;
  remarks?: string | null;
}

const DEFAULT_ORNAMENTS = [
  'सोन्याची साखळी (Chain)',
  'सोन्याची अंगठी (Ring)',
  'सोन्याचे पाटल्या / बांगड्या (Bangles)',
  'सोन्याचा हार / नेकलेस (Necklace)',
  'सोन्याचे मंगलसूत्र (Mangalsutra)',
  'सोन्याची वेढणी / नाणे (Coin/Bar)',
  'सोन्याचे झुमके / कानातील (Earrings)',
  'सोन्याचे पदक / पेंडंट (Pendant)',
  'सोन्याचे कडे (Kade)',
  'इतर सुवर्ण अलंकार (Other Ornaments)'
];

export default function GoldLoanDetails() {
  const [loanAccounts, setLoanAccounts] = useState<any[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [goldDetails, setGoldDetails] = useState<GoldLoanDetail[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [ornamentNames, setOrnamentNames] = useState<string[]>(DEFAULT_ORNAMENTS);
  const [showCustomItemInput, setShowCustomItemInput] = useState(false);
  const [customItemText, setCustomItemText] = useState('');
  const [activeSanstha, setActiveSanstha] = useState<any>(null);
  const [receiptModalData, setReceiptModalData] = useState<GoldLoanReceiptData | null>(null);

  // Camera & Photo states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [formData, setFormData] = useState({
    goldLoanDetailID: 0,
    ornamentName: 'सोन्याची साखळी (Chain)',
    quantity: '1',
    grossWeight: '',
    netWeight: '',
    purity: '22',
    goldRatePerGram: '6000',
    estimatedValue: '',
    imagePath: '',
    valuerName: '',
    valuerValuation: '',
    valuationReceiptNo: '',
    valuationDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const API_GOLD = '/api/GoldLoanDetails';
  const API_LOANS = '/api/LoanAccounts';

  useEffect(() => {
    fetchLoans();
    fetchSanstha();
  }, []);

  const fetchSanstha = async () => {
    try {
      const res = await fetch('/api/SansthaDetails');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setActiveSanstha(data[0]);
        } else if (data && !Array.isArray(data)) {
          setActiveSanstha(data);
        }
      }
    } catch (e) {
      console.error('Error fetching sanstha', e);
    }
  };

  useEffect(() => {
    if (selectedLoanId) {
      fetchGoldDetails();
    } else {
      setGoldDetails([]);
    }
  }, [selectedLoanId]);

  const hasGoldKeyword = (txt?: string | null): boolean => {
    if (!txt) return false;
    const t = txt.toLowerCase();
    return (
      t.includes('gold') ||
      t.includes('सोने') ||
      t.includes('सोन्या') ||
      t.includes('सुवर्ण') ||
      t.includes('दागिन') ||
      t.includes('अलंकार') ||
      t.includes('ornament') ||
      t.includes('jewel')
    );
  };

  const fetchLoans = async () => {
    try {
      const res = await fetch(API_LOANS);
      if (res.ok) {
        const data = await res.json();
        const urlLoanId = new URLSearchParams(window.location.search).get('loanAccountId');
        const sessionLoanId = sessionStorage.getItem('cbs_target_gold_loan_id');
        if (sessionLoanId) {
          sessionStorage.removeItem('cbs_target_gold_loan_id');
        }
        const preselectLoanId = urlLoanId || sessionLoanId || '';

        // [REQUIREMENT 5]: Show Active Gold Loans (and any explicitly navigated Gold Loan account)
        const goldLoans = (Array.isArray(data) ? data : []).filter((l: any) => {
          const isExplicitTarget = preselectLoanId && String(l.loanAccountID) === String(preselectLoanId);
          if (!isExplicitTarget && l.status !== 'Active') return false;
          const isGold =
            l.loanRate?.collateralCategory?.toLowerCase() === 'gold' ||
            hasGoldKeyword(l.loanRate?.loanType) ||
            hasGoldKeyword(l.loanRate?.shortName) ||
            hasGoldKeyword((l.loanRate as any)?.securityType) ||
            hasGoldKeyword(l.loanType) ||
            hasGoldKeyword(l.securityDetails);
          return isGold || isExplicitTarget;
        });
        setLoanAccounts(goldLoans);

        if (preselectLoanId && goldLoans.some((l: any) => String(l.loanAccountID) === String(preselectLoanId))) {
          setSelectedLoanId(String(preselectLoanId));
        }
      }
    } catch (error) {
      console.error('Error fetching loans', error);
    }
  };

  const fetchGoldDetails = async () => {
    if (!selectedLoanId) return;
    try {
      const res = await fetch(`${API_GOLD}/ByLoanAccount/${selectedLoanId}`);
      if (res.ok) {
        setGoldDetails(await res.json());
      }
    } catch (error) {
      console.error('Error fetching gold details', error);
    }
  };

  const getPurityRatio = (purityVal: number | string): number => {
    const p = parseFloat(purityVal?.toString() || '22');
    if (p <= 0 || p > 24) return 22 / 24;
    return p / 24;
  };

  const calculateValuation = (netWt: number, purityVal: number | string, rate: number): number => {
    if (netWt <= 0 || rate <= 0) return 0;
    const ratio = getPurityRatio(purityVal);
    const pureGrams = netWt * ratio;
    return Math.round(pureGrams * rate);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Auto calculate estimated value factor in Karat purity
      if (name === 'netWeight' || name === 'goldRatePerGram' || name === 'purity') {
        const wt = parseFloat(name === 'netWeight' ? value : prev.netWeight) || 0;
        const rt = parseFloat(name === 'goldRatePerGram' ? value : prev.goldRatePerGram) || 0;
        const pur = name === 'purity' ? value : prev.purity;
        const autoVal = calculateValuation(wt, pur, rt);
        newData.estimatedValue = autoVal > 0 ? autoVal.toString() : '';
        if (prev.valuerValuation === '' || prev.valuerValuation === prev.estimatedValue) {
          newData.valuerValuation = autoVal > 0 ? autoVal.toString() : '';
        }
      }
      
      return newData;
    });
  };

  // Camera handlers
  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        setCameraStream(stream);
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } else {
        alert('या ब्राउझरमध्ये कॅमेरा उपलब्ध नाही.');
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      alert('कॅमेरा सुरू करताना त्रुटी आली. कृपया कॅमेरा परवानगी तपासा: ' + (err.message || ''));
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setFormData(prev => ({ ...prev, imagePath: dataUrl }));
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('फोटोची साईझ 5MB पेक्षा कमी असावी.');
      return;
    }
    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData(prev => ({ ...prev, imagePath: base64 }));
      setIsUploadingPhoto(false);
    };
    reader.onerror = () => {
      alert('फोटो लोड करताना त्रुटी आली.');
      setIsUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAddCustomOrnament = () => {
    const trimmed = customItemText.trim();
    if (!trimmed) return;
    if (!ornamentNames.includes(trimmed)) {
      setOrnamentNames(prev => [...prev, trimmed]);
    }
    setFormData(prev => ({ ...prev, ornamentName: trimmed }));
    setCustomItemText('');
    setShowCustomItemInput(false);
  };

  const handleNew = () => {
    stopCamera();
    setFormData({
      goldLoanDetailID: 0,
      ornamentName: 'सोन्याची साखळी (Chain)',
      quantity: '1',
      grossWeight: '',
      netWeight: '',
      purity: '22',
      goldRatePerGram: '6000',
      estimatedValue: '',
      imagePath: '',
      valuerName: '',
      valuerValuation: '',
      valuationReceiptNo: '',
      valuationDate: new Date().toISOString().split('T')[0],
      remarks: ''
    });
    setIsEditing(false);
  };

  const handleEdit = (item: GoldLoanDetail) => {
    setIsEditing(true);
    if (!ornamentNames.includes(item.ornamentName)) {
      setOrnamentNames(prev => [...prev, item.ornamentName]);
    }
    setFormData({
      goldLoanDetailID: item.goldLoanDetailID,
      ornamentName: item.ornamentName,
      quantity: item.quantity.toString(),
      grossWeight: item.grossWeight.toString(),
      netWeight: item.netWeight.toString(),
      purity: item.purity.toString(),
      goldRatePerGram: item.goldRatePerGram.toString(),
      estimatedValue: item.estimatedValue.toString(),
      imagePath: item.imagePath || '',
      valuerName: item.valuerName || '',
      valuerValuation: item.valuerValuation?.toString() || '',
      valuationReceiptNo: item.valuationReceiptNo || '',
      valuationDate: item.valuationDate ? item.valuationDate.split('T')[0] : new Date().toISOString().split('T')[0],
      remarks: item.remarks || ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) {
      alert("कृपया कर्ज खाते निवडा!");
      return;
    }

    const net = parseFloat(formData.netWeight || '0');
    if (net <= 0) {
      alert("कृपया निव्वळ वजन (Net Weight) टाका!");
      return;
    }

    try {
      const pureValuation = calculateValuation(net, formData.purity, parseFloat(formData.goldRatePerGram || '0'));
      const finalValuation = parseFloat(formData.estimatedValue || '0') || pureValuation;
      const valuerVal = parseFloat(formData.valuerValuation || '0');

      const payload = {
        goldLoanDetailID: formData.goldLoanDetailID,
        loanAccountID: parseInt(selectedLoanId),
        ornamentName: formData.ornamentName,
        quantity: parseInt(formData.quantity || '1'),
        grossWeight: parseFloat(formData.grossWeight || formData.netWeight || '0'),
        netWeight: net,
        purity: parseFloat(formData.purity || '22'),
        goldRatePerGram: parseFloat(formData.goldRatePerGram || '0'),
        estimatedValue: finalValuation,
        imagePath: formData.imagePath || null,
        valuerName: formData.valuerName || null,
        valuerValuation: valuerVal > 0 ? valuerVal : finalValuation,
        valuationReceiptNo: formData.valuationReceiptNo || null,
        valuationDate: formData.valuationDate || null,
        remarks: formData.remarks || null
      };

      const url = isEditing ? `${API_GOLD}/${formData.goldLoanDetailID}` : API_GOLD;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fetchGoldDetails();
        handleNew();
      } else {
        const err = await res.text();
        alert('माहिती सेव्ह करताना त्रुटी आली: ' + err);
      }
    } catch (error) {
      console.error("Error saving gold details", error);
    }
  };

  const handleOpenPrintReceipt = () => {
    const selLoan = loanAccounts.find(l => l.loanAccountID.toString() === selectedLoanId);
    if (!selLoan) return;

    const custName = selLoan.customer 
      ? `${selLoan.customer.firstName || ''} ${selLoan.customer.middleName || ''} ${selLoan.customer.lastName || ''}`.trim()
      : (selLoan.member ? `${selLoan.member.firstName || ''} ${selLoan.member.middleName || ''} ${selLoan.member.lastName || ''}`.trim() : '');

    const mobile = selLoan.customer?.mobileNumber || selLoan.member?.mobileNumber || '';
    const address = selLoan.customer?.address || selLoan.member?.address || '';
    const memberCode = selLoan.customer?.cifNo || selLoan.member?.memberCode || '';
    const scheme = selLoan.loanRate?.shortName || selLoan.loanRate?.name || selLoan.loanType || 'सुवर्ण तारण कर्ज';

    const withValuer = goldDetails.find(g => g.valuerName);

    const receiptItems: GoldLoanReceiptItem[] = goldDetails.map((g, idx) => ({
      srNo: idx + 1,
      ornamentName: g.ornamentName,
      quantity: g.quantity || 1,
      grossWeight: g.grossWeight,
      netWeight: g.netWeight,
      purity: g.purity,
      goldRatePerGram: g.goldRatePerGram,
      estimatedValue: g.estimatedValue,
      valuerValuation: g.valuerValuation,
      valuerName: g.valuerName,
      valuationReceiptNo: g.valuationReceiptNo,
      valuationDate: g.valuationDate,
      imagePath: g.imagePath,
      remarks: g.remarks || ''
    }));

    setReceiptModalData({
      receiptNo: withValuer?.valuationReceiptNo || `GL-${selLoan.loanAccountNo}`,
      receiptDate: withValuer?.valuationDate || new Date().toISOString().split('T')[0],
      loanAccountNo: selLoan.loanAccountNo,
      loanAccountID: selLoan.loanAccountID,
      borrowerName: custName,
      memberCode: memberCode,
      mobileNo: mobile,
      address: address,
      loanSchemeName: scheme,
      sanctionedAmount: selLoan.sanctionedAmount || selLoan.loanAmount,
      disbursedAmount: selLoan.loanAmount,
      interestRate: selLoan.loanRate?.interestRate || selLoan.interestRate,
      durationMonths: selLoan.durationMonths,
      valuerName: withValuer?.valuerName || '',
      valuationReceiptNo: withValuer?.valuationReceiptNo || '',
      valuationDate: withValuer?.valuationDate || '',
      items: receiptItems,
      branchName: activeSanstha?.branchName || '',
      sansthaInfo: activeSanstha
    });
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("तुम्हाला हा दागिना नक्की डिलीट करायचा आहे का?")) {
      try {
        await fetch(`${API_GOLD}/${id}`, { method: 'DELETE' });
        fetchGoldDetails();
        if (formData.goldLoanDetailID === id) {
          handleNew();
        }
      } catch (error) {
        console.error("Error deleting", error);
      }
    }
  };

  const loanOptions = loanAccounts.map(l => {
    const custObj = l.customer || l.member?.customer || l.member;
    const custName = custObj
      ? `${custObj.firstName || ''} ${custObj.middleName || ''} ${custObj.lastName || ''}`.trim().replace(/\s+/g, ' ')
      : '';
    const cif = l.customer?.cifNo || l.member?.customer?.cifNo || l.member?.memberCode || '';
    const scheme = l.loanRate?.shortName || l.loanRate?.loanType || l.loanType || '';
    return {
      value: l.loanAccountID.toString(),
      label: `${l.loanAccountNo}${cif ? ` - ${cif}` : ''}${custName ? ` - ${custName}` : ''}${scheme ? ` (${scheme})` : ''}`
    };
  });

  const inputClass = "w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-xs";
  const labelClass = "block text-xs font-semibold text-gray-700 mb-0.5";

  const totalEstimatedValue = goldDetails.reduce((sum, item) => sum + (item.estimatedValue || 0), 0);
  const totalValuerValuation = goldDetails.reduce((sum, item) => sum + (item.valuerValuation || item.estimatedValue || 0), 0);
  const totalNetWeight = goldDetails.reduce((sum, item) => sum + (item.netWeight || 0), 0);
  const totalGrossWeight = goldDetails.reduce((sum, item) => sum + (item.grossWeight || 0), 0);
  const totalQuantity = goldDetails.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Standard ERP Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 px-4 py-2.5 text-white flex items-center justify-between shadow-xs rounded-sm border border-amber-500">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-100" />
          <div>
            <h1 className="text-sm font-bold tracking-wide">सुवर्ण कर्ज तारण (Gold Loan Collateral Register)</h1>
            <p className="text-[10px] text-amber-100 font-normal">दागिने वजन, कॅरेट शुद्धता, सिस्टीम व सोनाराचे अधिकृत मूल्यांकन आणि फोटो व्यवस्थापन</p>
          </div>
        </div>
      </div>

      {/* Loan Selection */}
      <div className="bg-white p-2.5 rounded-sm shadow-sm border border-amber-200 mb-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[280px] max-w-lg">
          <label className={labelClass}>
            सोने तारण कर्ज खाते निवडा (Select Gold Loan Account) <span className="text-rose-500">*</span>
          </label>
          <SearchableSelect 
            name="selectedLoanId" 
            value={selectedLoanId} 
            onChange={(e: any) => setSelectedLoanId(e.target.value)} 
            options={loanOptions} 
            placeholder="सोने तारण कर्ज खाते शोधा..."
          />
        </div>
        <div className="text-[11px] text-slate-500 font-medium pb-1">
          {loanAccounts.length > 0 ? (
            <span>💡 एकूण <strong>{loanAccounts.length}</strong> सक्रिय सोने तारण खाती उपलब्ध</span>
          ) : (
            <span className="text-rose-600">⚠️ कोणतीही सक्रिय सोने तारण कर्ज खाती आढळली नाहीत.</span>
          )}
        </div>
      </div>

      {selectedLoanId && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Form */}
          <div className="lg:col-span-5 bg-white p-3 rounded-sm shadow-sm border border-amber-200">
            <div className="flex items-center justify-between border-b border-amber-100 pb-1.5 mb-2">
              <h2 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <span>💎</span>
                <span>{isEditing ? 'दागिन्याची माहिती दुरुस्त करा (Edit Item)' : 'नवीन दागिन्याची माहिती भरा (Add Gold Item)'}</span>
              </h2>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleNew}
                  className="text-[10px] text-rose-700 font-bold hover:underline cursor-pointer"
                >
                  रद्द करा (Reset)
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              {/* Ornament Selection with Custom Add */}
              <div>
                <label className={labelClass}>
                  दागिन्याचे नाव (Ornament Name) <span className="text-rose-500">*</span>
                </label>
                {!showCustomItemInput ? (
                  <div className="flex gap-1">
                    <select
                      value={formData.ornamentName}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setShowCustomItemInput(true);
                          setCustomItemText('');
                        } else {
                          setFormData(prev => ({ ...prev, ornamentName: e.target.value }));
                        }
                      }}
                      className={`${inputClass} flex-1`}
                    >
                      {ornamentNames.map((name, i) => (
                        <option key={i} value={name}>{name}</option>
                      ))}
                      <option value="__ADD_NEW__">➕ नवीन जिन्नस टाईप करा (Add Custom)...</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomItemInput(true);
                        setCustomItemText('');
                      }}
                      title="नवीन दागिन्याचे नाव जोडा"
                      className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 rounded-sm text-xs font-bold cursor-pointer"
                    >
                      ➕
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={customItemText}
                      onChange={(e) => setCustomItemText(e.target.value)}
                      placeholder="उदा. सोन्याचे तोडे"
                      className={`${inputClass} flex-1 border-amber-400 bg-amber-50/50`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomOrnament}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 rounded-sm text-[10px] font-bold cursor-pointer"
                    >
                      जोडा
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomItemInput(false)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 rounded-sm text-[10px] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Quantity & Purity */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>नग (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    className={`${inputClass} font-mono`}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>शुद्धता (Karat) *</label>
                  <select
                    name="purity"
                    value={formData.purity}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="24">24K (99.9% शुद्ध)</option>
                    <option value="22">22K (91.6% हॉलमार्क)</option>
                    <option value="20">20K (83.3%)</option>
                    <option value="18">18K (75.0%)</option>
                  </select>
                </div>
              </div>

              {/* Weights */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Gross Wt (ग्रॉस ग्रॅम)</label>
                  <input
                    type="number"
                    step="0.001"
                    name="grossWeight"
                    value={formData.grossWeight}
                    onChange={handleChange}
                    className={`${inputClass} font-mono`}
                    placeholder="15.500"
                  />
                </div>
                <div>
                  <label className={labelClass}>Net Wt (निव्वळ ग्रॅम) *</label>
                  <input
                    type="number"
                    step="0.001"
                    name="netWeight"
                    value={formData.netWeight}
                    onChange={handleChange}
                    className={`${inputClass} font-mono font-bold text-amber-950`}
                    placeholder="14.800"
                    required
                  />
                </div>
              </div>

              {/* Rate & System Valuation */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>प्रति ग्रॅम दर (Rate/g ₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="goldRatePerGram"
                    value={formData.goldRatePerGram}
                    onChange={handleChange}
                    className={`${inputClass} font-mono`}
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className={labelClass}>सिस्टीम मूल्य (₹)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const autoVal = calculateValuation(
                          parseFloat(formData.netWeight || '0'),
                          formData.purity,
                          parseFloat(formData.goldRatePerGram || '0')
                        );
                        setFormData(prev => ({ ...prev, estimatedValue: autoVal.toString() }));
                      }}
                      title="पुन्हा काढा"
                      className="text-[9px] text-emerald-700 hover:underline flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>कॅल्क्युलेट</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    name="estimatedValue"
                    value={formData.estimatedValue}
                    onChange={handleChange}
                    className={`${inputClass} bg-emerald-50/60 font-bold font-mono text-emerald-800 border-emerald-300`}
                  />
                </div>
              </div>

              {/* Valuer Details Box */}
              <div className="bg-amber-50/70 p-2 rounded border border-amber-200 space-y-1.5">
                <div className="text-[10px] font-bold text-amber-950 flex items-center gap-1">
                  <span>🏛️</span>
                  <span>सोनाराने केलेले अधिकृत मूल्यांकन (Goldsmith Valuation)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-700 mb-0.5 block">सोनाराचे नाव</label>
                    <input
                      type="text"
                      name="valuerName"
                      value={formData.valuerName}
                      onChange={handleChange}
                      className={`${inputClass} bg-white`}
                      placeholder="उदा. जगताप सराफ"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-900 mb-0.5 block">सोनाराचे मूल्यांकन (₹) *</label>
                    <input
                      type="number"
                      name="valuerValuation"
                      value={formData.valuerValuation}
                      onChange={handleChange}
                      className={`${inputClass} bg-amber-100/60 font-bold font-mono text-amber-950 border-amber-400`}
                      placeholder="पावतीवरील रक्कम"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-700 mb-0.5 block">पावती क्र. (Receipt No)</label>
                    <input
                      type="text"
                      name="valuationReceiptNo"
                      value={formData.valuationReceiptNo}
                      onChange={handleChange}
                      className={`${inputClass} bg-white`}
                      placeholder="VAL-001"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-700 mb-0.5 block">व्हॅल्युएशन तारीख</label>
                    <input
                      type="date"
                      name="valuationDate"
                      value={formData.valuationDate}
                      onChange={handleChange}
                      className={`${inputClass} bg-white`}
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <label className="text-[10px] font-bold text-gray-700 mb-0.5 block">शेरा / दागिना वर्णन (Remarks / Condition)</label>
                  <input
                    type="text"
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    className={`${inputClass} bg-white`}
                    placeholder="उदा. चांगल्या स्थितीत, खडे नसलेले, हॉलमार्क छाप"
                  />
                </div>
              </div>

              {/* Ornament Photo Capture / Upload */}
              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-[10px] font-bold text-slate-800">दागिन्याचा फोटो</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-2.5 h-2.5" />
                      <span>कॅमेरा</span>
                    </button>

                    <label className="bg-slate-700 hover:bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer">
                      <ImageIcon className="w-2.5 h-2.5" />
                      <span>फाईल</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {formData.imagePath && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          onClick={() => setPreviewImageModal(formData.imagePath)}
                          className="relative group border border-slate-300 rounded overflow-hidden cursor-pointer"
                        >
                          <img src={formData.imagePath} alt="Ornament" className="w-6 h-6 object-cover" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ZoomIn className="w-2.5 h-2.5 text-white" />
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, imagePath: '' }))}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-1 border-t border-gray-100 mt-2">
                <button
                  type="button"
                  onClick={handleNew}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-1.5 rounded-sm font-bold text-xs shadow-xs cursor-pointer"
                >
                  नवीन
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-1.5 rounded-sm font-bold text-xs shadow-xs cursor-pointer"
                >
                  {isEditing ? '✓ बदल सेव्ह करा' : '➕ तारण जोडा'}
                </button>
              </div>
            </form>
          </div>

          {/* Grid Table */}
          <div className="lg:col-span-7 bg-white p-3 rounded-sm shadow-sm border border-amber-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-amber-100 pb-1.5 mb-2 gap-2">
                <div>
                  <h2 className="text-xs font-bold text-gray-800">
                    तारण ठेवलेले दागिने ({goldDetails.length})
                  </h2>
                  <span className="text-[10px] text-slate-500 italic">नोंद एडिट करण्यासाठी 'बदला' वर क्लिक करा</span>
                </div>
                {goldDetails.length > 0 && (
                  <button
                    type="button"
                    onClick={handleOpenPrintReceipt}
                    className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white px-2.5 py-1 rounded text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5 border border-amber-500 transition-transform active:scale-95"
                    title="या कर्ज खात्याची अधिकृत सुवर्ण तारण पावती A4 प्रिंट करा"
                  >
                    <Receipt size={14} className="text-amber-100" />
                    <span>🧾 सुवर्ण तारण पावती (A4 Print)</span>
                  </button>
                )}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
                <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-center">
                  <span className="text-[9px] font-bold text-gray-500 block uppercase">दागिने नग</span>
                  <span className="text-xs font-black text-gray-800">{goldDetails.length} जिन्नस ({totalQuantity} नग)</span>
                </div>
                <div className="bg-amber-50 p-1.5 rounded border border-amber-200 text-center">
                  <span className="text-[9px] font-bold text-amber-800 block uppercase">निव्वळ वजन</span>
                  <span className="text-xs font-black text-amber-950 font-mono">{totalNetWeight.toFixed(3)}g</span>
                </div>
                <div className="bg-emerald-50 p-1.5 rounded border border-emerald-200 text-center">
                  <span className="text-[9px] font-bold text-emerald-800 block uppercase">सिस्टीम मूल्यांकन</span>
                  <span className="text-xs font-black text-emerald-800 font-mono">₹{totalEstimatedValue.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-gradient-to-br from-amber-100 to-yellow-100 p-1.5 rounded border border-amber-400 text-center">
                  <span className="text-[9px] font-bold text-amber-900 block uppercase">सोनाराचे मूल्यांकन</span>
                  <span className="text-xs font-black text-amber-950 font-mono">₹{totalValuerValuation.toLocaleString('en-IN')}</span>
                </div>
              </div>
              
              <div className="overflow-x-auto max-h-[50vh]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 text-[10px] uppercase font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-1 border text-center w-8">फोटो</th>
                      <th className="p-1.5 border">नाव</th>
                      <th className="p-1 border text-center">नग</th>
                      <th className="p-1 border text-right">Net Wt</th>
                      <th className="p-1 border text-center">कॅरेट</th>
                      <th className="p-1 border text-right">दर / g</th>
                      <th className="p-1.5 border text-right">सिस्टीम (₹)</th>
                      <th className="p-1.5 border text-right font-bold text-amber-950 bg-amber-50/50">सोनार (₹)</th>
                      <th className="p-1.5 border">व्हॅल्यूअर</th>
                      <th className="p-1 border text-center w-16">कृती</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] text-gray-800 font-mono">
                    {goldDetails.map(g => (
                      <tr key={g.goldLoanDetailID} className="border-b hover:bg-amber-50/30 transition-colors">
                        <td className="p-1 border text-center">
                          {g.imagePath ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImageModal(g.imagePath)}
                              className="border border-amber-300 rounded p-0.5 hover:scale-110 transition-transform cursor-pointer inline-block"
                              title="फोटो पहा"
                            >
                              <img src={g.imagePath} alt="Gold" className="w-5 h-5 object-cover rounded-xs" />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[9px] font-sans">-</span>
                          )}
                        </td>
                        <td className="p-1.5 border font-sans font-medium text-gray-900">{g.ornamentName}</td>
                        <td className="p-1 border text-center">{g.quantity}</td>
                        <td className="p-1 border text-right font-bold text-amber-900">{g.netWeight.toFixed(3)}g</td>
                        <td className="p-1 border text-center font-bold text-amber-800">{g.purity}K</td>
                        <td className="p-1 border text-right">₹{g.goldRatePerGram.toFixed(0)}</td>
                        <td className="p-1.5 border text-right font-bold text-emerald-700">₹{g.estimatedValue.toLocaleString('en-IN')}</td>
                        <td className="p-1.5 border text-right font-black text-amber-950 bg-amber-50/30">
                          ₹{(g.valuerValuation || g.estimatedValue).toLocaleString('en-IN')}
                        </td>
                        <td className="p-1.5 border font-sans text-[10px] text-slate-700">
                          {g.valuerName ? (
                            <span>{g.valuerName} {g.valuationReceiptNo ? `(#${g.valuationReceiptNo})` : ''}</span>
                          ) : '-'}
                        </td>
                        <td className="p-1 border text-center font-sans">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(g)}
                              className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-1 py-0.5 rounded text-[10px] font-bold border border-blue-200 cursor-pointer"
                            >
                              बदला
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(g.goldLoanDetailID)}
                              className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-1 py-0.5 rounded text-[10px] font-bold border border-rose-200 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {goldDetails.length === 0 && (
                      <tr>
                        <td colSpan={10} className="border px-2 py-6 text-center text-slate-400 font-sans italic">
                          या कर्ज खात्याला अद्याप कोणतेही तारण दागिने जोडलेले नाहीत.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {goldDetails.length > 0 && (
              <div className="mt-3 p-2 bg-amber-50/80 border border-amber-200 rounded text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="text-amber-950 font-medium">
                  ✨ एकूण तारण: <strong>{goldDetails.length}</strong> जिन्नस ({totalNetWeight.toFixed(2)}g निव्वळ वजन)
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800">
                    अधिकृत तारण मूल्यांकन: <strong className="text-amber-900 font-mono text-sm">₹{totalValuerValuation.toLocaleString('en-IN')}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenPrintReceipt}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Receipt size={12} />
                    <span>पावती प्रिंट</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIVE CAMERA CAPTURE MODAL */}
      {isCameraActive && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-3 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-md p-3 max-w-lg w-full flex flex-col items-center gap-3 shadow-2xl">
            <div className="w-full flex justify-between items-center text-white pb-1 border-b border-slate-800">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>दागिन्याचा फोटो काढा (Live Camera Feed)</span>
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="w-full bg-black rounded overflow-hidden aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                autoPlay
                muted
              />
            </div>

            <div className="flex items-center gap-2 w-full justify-between pt-1">
              <button
                type="button"
                onClick={stopCamera}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-xs font-bold cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer animate-bounce"
              >
                <Camera className="w-4 h-4" />
                <span>📸 फोटो कॅप्चर करा (Snap & Save)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO ZOOM MODAL */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="bg-white rounded-md p-2 max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center px-1 pb-1 border-b">
              <span className="text-xs font-bold text-slate-800">दागिन्याचा फोटो (Ornament Photo Preview)</span>
              <button
                type="button"
                onClick={() => setPreviewImageModal(null)}
                className="text-slate-500 hover:text-slate-800 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center">
              <img
                src={previewImageModal}
                alt="Gold Ornament Zoom"
                className="max-w-full max-h-[72vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Gold Loan Receipt Print Modal */}
      {receiptModalData && (
        <GoldLoanReceiptPrintModal
          isOpen={!!receiptModalData}
          onClose={() => setReceiptModalData(null)}
          receiptData={receiptModalData}
          activeSanstha={activeSanstha}
        />
      )}
    </div>
  );
}
