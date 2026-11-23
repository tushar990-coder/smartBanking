import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  ShieldCheck,
  FileText,
  Lock,
  Building2,
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  History,
  Plus,
  Printer,
  Trash2,
  ExternalLink,
  Coins,
  ArrowRight,
  X
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';

interface LoanDocumentItem {
  loanDocumentID: number;
  loanAccountID: number;
  documentType: string;
  documentName: string;
  filePath: string;
  uploadedDate: string;
}

interface LoanAccountMeta {
  loanAccountID: number;
  loanAccountNo: string;
  branchID: number;
  borrowerName: string;
  cifNo: string;
  mobileNo: string;
  schemeName: string;
  status: string;
  sanctionedAmount: number;
  principalBalance: number;
  isGoldLoan: boolean;
  isPendingGoldRelease: boolean;
  packetNumber: string;
  custodyStatus: string;
  custodyLocationDisplay: string;
  documentCount: number;
}

interface LoanDocumentsUploadProps {
  onNavigate?: (tab: string, params?: any) => void;
  initialLoanAccountId?: number | null;
}

const DOCUMENT_TYPES = [
  '७/१२ व ८-अ उतारा (7/12 & 8A Extract)',
  'आधार कार्ड (Aadhaar Card)',
  'पॅन कार्ड (PAN Card)',
  'जामीनदार संमतीपत्र (Guarantor Consent)',
  'तारण दस्तऐवज / गहाणखत (Mortgage / Collateral Deed)',
  'सोनार मूल्यांकन पावती (Goldsmith Valuation Certificate)',
  'दागिने पाकीट सील फोटो (Gold Packet Seal Photo)',
  'प्रॉमिसरी नोट (Promissory Note)',
  'दागिने परत सुपूर्दगी पावती (Gold Release Acknowledgement)',
  'फोटो (Photograph)',
  'इतर (Other)'
];

const fmtAmt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function LoanDocumentsUpload({ onNavigate, initialLoanAccountId }: LoanDocumentsUploadProps = {}) {
  const { user } = useAuth();
  const activeBizDate = getBusinessDateStr(user?.businessDate);

  const [accounts, setAccounts] = useState<LoanAccountMeta[]>([]);
  const [accountFilter, setAccountFilter] = useState<'all' | 'gold' | 'pending-release'>('all');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'custody' | 'documents'>('custody');

  // Masters for Custody
  const [ownLockers, setOwnLockers] = useState<any[]>([]);
  const [externalLockers, setExternalLockers] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);

  // Loaded Loan Custody & Documents Data
  const [custodyDetails, setCustodyDetails] = useState<any>(null);
  const [documents, setDocuments] = useState<LoanDocumentItem[]>([]);
  const [loadingLoan, setLoadingLoan] = useState(false);

  // Feedback banners
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Custody Assignment Form
  const [packetNumber, setPacketNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [targetCustodyStatus, setTargetCustodyStatus] = useState<'BRANCH_SAFE' | 'OWN_LOCKER' | 'EXTERNAL_LOCKER'>('BRANCH_SAFE');
  const [vaultRackNo, setVaultRackNo] = useState('मुख्य तिजोरी');
  const [selectedOwnLockerId, setSelectedOwnLockerId] = useState<string>('');
  const [selectedExtLockerId, setSelectedExtLockerId] = useState<string>('');
  const [movementDate, setMovementDate] = useState<string>(activeBizDate);
  const [custodyRemarks, setCustodyRemarks] = useState('');
  const [savingCustody, setSavingCustody] = useState(false);

  // Customer Gold Release Form
  const [releaseDate, setReleaseDate] = useState<string>(activeBizDate);
  const [releasedToName, setReleasedToName] = useState('');
  const [releasedToRelation, setReleasedToRelation] = useState('स्वतः कर्जदार (Self)');
  const [receiverMobile, setReceiverMobile] = useState('');
  const [receiverIdProof, setReceiverIdProof] = useState('');
  const [releaseAckBase64, setReleaseAckBase64] = useState<string>('');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [releasingGold, setReleasingGold] = useState(false);

  // Quick-Add External Hired Locker Modal
  const [showExtLockerModal, setShowExtLockerModal] = useState(false);
  const [extLockerForm, setExtLockerForm] = useState({
    institutionID: '',
    bankOrSocietyName: '',
    bankBranchName: '',
    lockerNo: '',
    cabinetOrBoxNo: '',
    keyNo: '',
    annualRentAmount: '',
    authorizedSignatories: '',
    remarks: ''
  });

  // Document Upload Form
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [documentName, setDocumentName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadMastersAndAccounts();
  }, [accountFilter]);

  useEffect(() => {
    if (user?.businessDate) {
      const bz = getBusinessDateStr(user.businessDate);
      setMovementDate(bz);
      setReleaseDate(bz);
    }
  }, [user?.businessDate]);

  useEffect(() => {
    if (selectedLoanId) {
      loadLoanWorkspace(Number(selectedLoanId));
    } else {
      setCustodyDetails(null);
      setDocuments([]);
    }
  }, [selectedLoanId]);

  const loadMastersAndAccounts = async () => {
    try {
      const [accRes, mstRes] = await Promise.all([
        axios.get('/api/GoldCustody/accounts', { params: { filter: accountFilter } }),
        axios.get('/api/GoldCustody/masters')
      ]);

      const accList: LoanAccountMeta[] = Array.isArray(accRes.data) ? accRes.data : [];
      setAccounts(accList);
      setOwnLockers(mstRes.data?.ownLockers || []);
      setExternalLockers(mstRes.data?.externalLockers || []);
      setInstitutions(mstRes.data?.institutions || []);

      const urlId = new URLSearchParams(window.location.search).get('loanAccountId');
      const storedId = sessionStorage.getItem('cbs_target_collateral_loan_id');
      if (storedId) sessionStorage.removeItem('cbs_target_collateral_loan_id');

      const targetId = initialLoanAccountId
        ? String(initialLoanAccountId)
        : (storedId || urlId || '');

      if (targetId && accList.some((a) => String(a.loanAccountID) === targetId)) {
        setSelectedLoanId(targetId);
      }
    } catch (err) {
      console.error('Failed loading collateral accounts/masters:', err);
    }
  };

  const loadLoanWorkspace = async (loanId: number) => {
    setLoadingLoan(true);
    setErrorMsg('');
    try {
      const [custRes, docRes] = await Promise.all([
        axios.get(`/api/GoldCustody/by-loan/${loanId}`),
        axios.get(`/api/LoanDocuments/ByLoanAccount/${loanId}`)
      ]);

      const data = custRes.data;
      setCustodyDetails(data);
      setDocuments(Array.isArray(docRes.data) ? docRes.data : []);

      if (data?.isGoldLoan) {
        setActiveTab('custody');
        const c = data.custody;
        if (c) {
          setPacketNumber(c.packetNumber || '');
          setSealNumber(c.sealNumber || '');
          if (c.custodyStatus === 'OWN_LOCKER' || c.custodyStatus === 'EXTERNAL_LOCKER' || c.custodyStatus === 'BRANCH_SAFE') {
            setTargetCustodyStatus(c.custodyStatus);
          } else {
            setTargetCustodyStatus('BRANCH_SAFE');
          }
          setVaultRackNo(c.vaultRackOrTrayNo || 'मुख्य तिजोरी');
          setSelectedOwnLockerId(c.ownLockerID ? String(c.ownLockerID) : '');
          setSelectedExtLockerId(c.externalLockerID ? String(c.externalLockerID) : '');
          setCustodyRemarks(c.remarks || '');
        }
        setReleasedToName(data.loanSummary?.borrowerName || '');
        setReceiverMobile(data.loanSummary?.mobileNo || '');
      } else {
        setActiveTab('documents');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.response?.data || 'कर्ज तारण माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoadingLoan(false);
    }
  };

  const loanOptions = useMemo(() => {
    return accounts.map((l) => {
      let badge = l.isGoldLoan ? 'सोने तारण' : l.schemeName;
      let badgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
      if (l.isPendingGoldRelease) {
        badge = '⚠️ कर्ज बंद - दागिने सुपूर्द बाकी';
        badgeColor = 'bg-red-100 text-red-800 border-red-300';
      } else if (l.custodyStatus === 'REPLEDGED_BORROWING') {
        badge = '🔗 पुनर्गहाण (Re-pledged)';
        badgeColor = 'bg-purple-100 text-purple-900 border-purple-300';
      } else if (l.custodyStatus === 'RELEASED_TO_CUSTOMER') {
        badge = '✅ दागिने सुपूर्द';
        badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      } else if (!l.isGoldLoan) {
        badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
      }

      return {
        value: String(l.loanAccountID),
        label: `${l.loanAccountNo} — ${l.borrowerName}`,
        subLabel: `${l.cifNo ? `CIF: ${l.cifNo} | ` : ''}${l.schemeName} | बाकी: ₹${fmtAmt(l.principalBalance)}${
          l.isGoldLoan && l.custodyLocationDisplay ? ` | 📍 ${l.custodyLocationDisplay}` : ''
        }`,
        badge,
        badgeColor
      };
    });
  }, [accounts]);

  const handleSaveCustodyLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) return;
    setErrorMsg('');
    setSuccessMsg('');
    setSavingCustody(true);
    try {
      const res = await axios.post('/api/GoldCustody/assign-location', {
        loanAccountID: Number(selectedLoanId),
        packetNumber,
        sealNumber,
        custodyStatus: targetCustodyStatus,
        vaultRackOrTrayNo: targetCustodyStatus === 'BRANCH_SAFE' ? vaultRackNo : null,
        ownLockerID: targetCustodyStatus === 'OWN_LOCKER' ? Number(selectedOwnLockerId || 0) : null,
        externalLockerID: targetCustodyStatus === 'EXTERNAL_LOCKER' ? Number(selectedExtLockerId || 0) : null,
        movementDate,
        remarks: custodyRemarks
      });

      setSuccessMsg(res.data?.message || 'कस्टडी ठिकाण यशस्वीरीत्या जतन झाले!');
      await loadLoanWorkspace(Number(selectedLoanId));
      loadMastersAndAccounts();
    } catch (err: any) {
      setErrorMsg(typeof err.response?.data === 'string' ? err.response.data : 'कस्टडी ठिकाण जतन करताना त्रुटी आली.');
    } finally {
      setSavingCustody(false);
    }
  };

  const handleCreateExternalLocker = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await axios.post('/api/GoldCustody/external-lockers', {
        branchID: Number(user?.branchID || 1),
        institutionID: extLockerForm.institutionID ? Number(extLockerForm.institutionID) : null,
        bankOrSocietyName: extLockerForm.bankOrSocietyName,
        bankBranchName: extLockerForm.bankBranchName,
        lockerNo: extLockerForm.lockerNo,
        cabinetOrBoxNo: extLockerForm.cabinetOrBoxNo,
        keyNo: extLockerForm.keyNo,
        annualRentAmount: Number(extLockerForm.annualRentAmount || 0),
        authorizedSignatories: extLockerForm.authorizedSignatories,
        remarks: extLockerForm.remarks,
        isActive: true
      });
      const created = res.data;
      setExternalLockers((prev) => [...prev, created]);
      setSelectedExtLockerId(String(created.externalLockerID));
      setTargetCustodyStatus('EXTERNAL_LOCKER');
      setShowExtLockerModal(false);
      setExtLockerForm({
        institutionID: '',
        bankOrSocietyName: '',
        bankBranchName: '',
        lockerNo: '',
        cabinetOrBoxNo: '',
        keyNo: '',
        annualRentAmount: '',
        authorizedSignatories: '',
        remarks: ''
      });
      setSuccessMsg(`बाह्य बँक लॉकर '${created.bankOrSocietyName} - ${created.lockerNo}' जोडले गेले!`);
    } catch (err: any) {
      setErrorMsg(typeof err.response?.data === 'string' ? err.response.data : 'बाह्य लॉकर जतन करताना त्रुटी आली.');
    }
  };

  const handleReleasePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReleaseAckBase64((ev.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const handleReleaseToCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) return;
    if (!window.confirm('खातेदाराची संपूर्ण कर्ज बाकी शून्य असल्याची खात्री केली आहे का? दागिने सुपूर्द केल्याची नोंद कायमस्वरूपी जतन होईल.')) {
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setReleasingGold(true);
    try {
      const res = await axios.post('/api/GoldCustody/release-to-customer', {
        loanAccountID: Number(selectedLoanId),
        releaseDate,
        releasedToName,
        releasedToRelation,
        receiverMobile,
        receiverIdProof,
        acknowledgementBase64Image: releaseAckBase64 || null,
        remarks: releaseRemarks
      });

      setSuccessMsg(res.data?.message || 'दागिने खातेदारास यशस्वीरीत्या सुपूर्द केले!');
      setReleaseAckBase64('');
      await loadLoanWorkspace(Number(selectedLoanId));
      loadMastersAndAccounts();
    } catch (err: any) {
      setErrorMsg(typeof err.response?.data === 'string' ? err.response.data : 'दागिने सुपूर्द करताना त्रुटी आली.');
    } finally {
      setReleasingGold(false);
    }
  };

  const handlePrintReleaseReceipt = () => {
    if (!custodyDetails?.custody || !custodyDetails?.loanSummary) return;
    const ls = custodyDetails.loanSummary;
    const c = custodyDetails.custody;
    const items: any[] = custodyDetails.ornaments || [];

    const rowsHtml = items
      .map(
        (g, idx) => `
        <tr>
          <td style="text-align:center">${idx + 1}</td>
          <td>${g.ornamentName}</td>
          <td style="text-align:center">${g.quantity || 1}</td>
          <td style="text-align:right">${fmtWt(g.grossWeight)}</td>
          <td style="text-align:right">${fmtWt(g.netWeight)}</td>
          <td style="text-align:center">${g.purity}K</td>
        </tr>`
      )
      .join('');

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>दागिने सुपूर्दगी पावती - ${ls.loanAccountNo}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #0f172a; }
        h2, h4 { margin: 3px 0; text-align: center; }
        .box { border: 1px solid #334155; padding: 12px; margin-top: 12px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #334155; padding: 6px 8px; }
        th { background: #f1f5f9; }
        .sigs { display: flex; justify-content: space-between; margin-top: 56px; font-weight: bold; }
      </style></head><body>
        <h2>सोने तारण दागिने परत सुपूर्दगी पावती (Gold Ornament Release Receipt)</h2>
        <h4>शाखा: ${ls.branchName} | सुपूर्दगी पावती क्र.: ${c.releaseReceiptNo || '-'} | दिनांक: ${
          c.releasedDate ? new Date(c.releasedDate).toLocaleDateString('en-GB') : releaseDate
        }</h4>
        <div class="box">
          <div><strong>कर्ज खाते क्र.:</strong> ${ls.loanAccountNo} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>पाकीट क्र.:</strong> ${c.packetNumber} ${c.sealNumber ? `(सील: ${c.sealNumber})` : ''}</div>
          <div style="margin-top:4px"><strong>कर्जदाराचे नाव:</strong> ${ls.borrowerName} (CIF: ${ls.cifNo || '-'})</div>
          <div style="margin-top:4px"><strong>दागिने स्वीकारणाऱ्याचे नाव:</strong> ${c.releasedToName || ls.borrowerName} (${c.releasedToRelation || 'स्वतः'}) &nbsp;&nbsp;|&nbsp;&nbsp; <strong>ओळखपत्र:</strong> ${c.receiverIdProof || '-'}</div>
        </div>
        <table>
          <thead>
            <tr><th>अ.क्र.</th><th>दागिन्याचे वर्णन</th><th>नग</th><th>एकूण वजन (g)</th><th>निव्वळ वजन (g)</th><th>शुद्धता</th></tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="6" style="text-align:center">पाकीट क्र. ${c.packetNumber} मधील संपूर्ण सोने तारण दागिने</td></tr>`}
          </tbody>
        </table>
        <p style="margin-top:14px;line-height:1.6">
          मी वरील सोने तारण कर्ज खात्याची संपूर्ण मुद्दल व व्याज रक्कम भरून खाते बंद केले असून, मी तारण ठेवलेले वरील सर्व सोन्याचे दागिने मला आज मोजून व तपासून सुस्थितीत परत मिळाले आहेत. आता माझी संस्थेकडे कोणतीही तक्रार राहिलेली नाही.
        </p>
        <div class="sigs">
          <div>दागिने स्वीकारणाऱ्याची स्वाक्षरी<br/><small>(${c.releasedToName || ls.borrowerName})</small></div>
          <div>खजिनदार / तिजोरी प्रमुख</div>
          <div>शाखा व्यवस्थापक / सचिव</div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || !selectedFile) {
      setErrorMsg('कृपया कर्ज खाते आणि फाईल निवडा.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('loanAccountId', selectedLoanId);
      formData.append('documentType', documentType);
      formData.append('documentName', documentName);
      formData.append('uploadedDate', activeBizDate);
      formData.append('file', selectedFile);

      await axios.post('/api/LoanDocuments/Upload', formData);
      setSuccessMsg('कागदपत्र यशस्वीरीत्या अपलोड झाले!');
      setSelectedFile(null);
      setDocumentName('');
      const fileInput = document.getElementById('collateralFileUpload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      const docRes = await axios.get(`/api/LoanDocuments/ByLoanAccount/${selectedLoanId}`);
      setDocuments(Array.isArray(docRes.data) ? docRes.data : []);
    } catch (err: any) {
      setErrorMsg(typeof err.response?.data === 'string' ? err.response.data : 'कागदपत्र अपलोड करताना त्रुटी आली.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!window.confirm('तुम्हाला हे कागदपत्र नक्की डिलीट करायचे आहे का?')) return;
    try {
      await axios.delete(`/api/LoanDocuments/${id}`);
      setDocuments((prev) => prev.filter((d) => d.loanDocumentID !== id));
    } catch (err) {
      setErrorMsg('कागदपत्र डिलीट करताना त्रुटी आली.');
    }
  };

  const cust = custodyDetails?.custody;
  const ls = custodyDetails?.loanSummary;
  const isGold = Boolean(custodyDetails?.isGoldLoan);
  const isRepledged = cust?.custodyStatus === 'REPLEDGED_BORROWING';
  const isReleased = cust?.custodyStatus === 'RELEASED_TO_CUSTOMER';

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Upgraded Header Banner */}
      <div className="bg-primary px-3.5 py-2.5 text-white flex flex-wrap items-center justify-between gap-2 shadow-sm rounded-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-white/15 rounded">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold tracking-wide">
              कर्ज तारण दस्तऐवज व सोने दागिने कस्टडी ट्रॅकिंग (Loan Collateral &amp; Gold Custody Tracker)
            </h1>
            <p className="text-[10.5px] text-blue-100 font-normal">
              ७/१२ उतारा, केवायसी, तारण दस्तऐवज अपलोड आणि सोने दागिने पाकीट (तिजोरी / संस्था लॉकर / बँक लॉकर / पुनर्गहाण / सुपूर्दगी) ट्रॅकिंग
            </p>
          </div>
        </div>

        {onNavigate && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('gold-loan-details')}
              className="px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Coins size={13} /> सोने जिन्नस नोंदणी
            </button>
            <button
              type="button"
              onClick={() => onNavigate('bank-borrowing')}
              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Building2 size={13} /> बाह्य कर्जे / पुनर्गहाण <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Filter Pills + Loan Account Search */}
      <div className="bg-white p-3 rounded-sm shadow-xs border border-slate-200 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-600">सूची फिल्टर:</span>
            {[
              { id: 'all', label: 'सर्व कर्ज खाती (All Loans)' },
              { id: 'gold', label: '🏅 फक्त सोने तारण कर्जे' },
              { id: 'pending-release', label: '⚠️ बंद कर्जे — दागिने सुपूर्द बाकी' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAccountFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer transition-all ${
                  accountFilter === f.id
                    ? 'bg-primary text-white border-primary shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            उपलब्ध खाती: <strong>{accounts.length}</strong>
          </span>
        </div>

        <div className="max-w-2xl">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            कर्ज खाते शोधा व निवडा (खाते क्र., नाव किंवा CIF)
          </label>
          <SearchableSelect
            name="selectedLoanId"
            value={selectedLoanId}
            onChange={(e: any) => setSelectedLoanId(String(e.target.value || ''))}
            options={loanOptions}
            placeholder="-- कर्ज खाते क्रमांक किंवा कर्जदाराचे नाव शोधा --"
            minMenuWidth={520}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded border border-red-300 bg-red-50 text-red-800 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={15} className="shrink-0" /> <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="shrink-0" /> <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {loadingLoan && (
        <div className="p-8 bg-white border rounded text-center text-slate-500 font-semibold">
          कर्ज खाते व कस्टडी माहिती लोड होत आहे...
        </div>
      )}

      {!loadingLoan && selectedLoanId && ls && (
        <>
          {/* Summary Strip */}
          <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-2xs grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <div className="text-[10px] text-slate-500">कर्जदार व योजना</div>
              <div className="font-bold text-slate-900 text-xs">{ls.borrowerName}</div>
              <div className="text-[10.5px] text-slate-600">{ls.loanAccountNo} • {ls.schemeName}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">मंजूर कर्ज / व्याजदर</div>
              <div className="font-bold text-slate-900 font-mono">₹{fmtAmt(ls.sanctionedAmount)}</div>
              <div className="text-[10.5px] text-slate-600">{ls.interestRate}% वार्षिक</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">सद्य येणे बाकी (मुद्दल + व्याज)</div>
              <div className={`font-bold font-mono ${ls.isZeroBalance ? 'text-emerald-700' : 'text-rose-700'}`}>
                ₹{fmtAmt((ls.principalBalance || 0) + (ls.interestBalance || 0) + (ls.overdueInterestBalance || 0))}
              </div>
              <div className="text-[10px] text-slate-600">खाते स्थिती: <strong>{ls.status}</strong></div>
            </div>
            {isGold && cust && (
              <>
                <div>
                  <div className="text-[10px] text-slate-500">सोने पाकीट व वजन</div>
                  <div className="font-bold text-amber-900 font-mono">{cust.packetNumber}</div>
                  <div className="text-[10.5px] text-slate-600">
                    {cust.totalOrnamentsCount} नग | निव्वळ: {fmtWt(cust.totalNetWeight)}g
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">सध्या दागिने कोठे आहेत?</div>
                  <div
                    className={`font-bold text-[11px] leading-snug ${
                      isRepledged
                        ? 'text-purple-800'
                        : isReleased
                        ? 'text-emerald-700'
                        : 'text-blue-900'
                    }`}
                  >
                    📍 {custodyDetails.custodyLocationDisplay}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mode Tabs */}
          <div className="flex border-b border-slate-300 gap-1">
            {isGold && (
              <button
                type="button"
                onClick={() => setActiveTab('custody')}
                className={`px-4 py-2 font-bold text-xs rounded-t border-t border-x cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'custody'
                    ? 'bg-white text-primary border-slate-300 -mb-px'
                    : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70'
                }`}
              >
                <Lock size={14} /> १. सोने दागिने पाकीट व लॉकर ट्रॅकिंग (Gold Custody &amp; Release)
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 font-bold text-xs rounded-t border-t border-x cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'documents' || !isGold
                  ? 'bg-white text-primary border-slate-300 -mb-px'
                  : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70'
              }`}
            >
              <FileText size={14} /> {isGold ? '२. ' : ''}७/१२, केवायसी व तारण कागदपत्रे अपलोड ({documents.length})
            </button>
          </div>

          {/* TAB 1: GOLD CUSTODY & LOCKER / BANK LOCKER / RELEASE WORKBENCH */}
          {isGold && activeTab === 'custody' && cust && (
            <div className="space-y-3">
              {/* Re-pledged Active Warning Banner */}
              {isRepledged && custodyDetails.activePledge && (
                <div className="p-3 rounded border-2 border-purple-400 bg-purple-50 text-purple-950 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-xs flex items-center gap-1.5 text-purple-900">
                      <AlertTriangle size={16} /> हे सोने पाकीट बाह्य बँक / पतसंस्थेकडे पुनर्गहाण (Re-pledged) आहे!
                    </div>
                    <div className="text-[11px]">
                      संस्था/बँक: <strong>{custodyDetails.activePledge.lenderName}</strong> | बाह्य कर्ज क्र.:{' '}
                      <strong>{custodyDetails.activePledge.borrowingNo}</strong> | घेतलेला व्याजदर:{' '}
                      <strong>{custodyDetails.activePledge.borrowingInterestRate}%</strong> | ग्राहक व्याजदर:{' '}
                      <strong>{custodyDetails.activePledge.customerLoanInterestRate}%</strong> (नफा फरक:{' '}
                      <strong className="text-emerald-800">+{custodyDetails.activePledge.interestSpreadPercent}%</strong>)
                    </div>
                    <div className="text-[10.5px] text-purple-800">
                      सूचना: खातेदारास दागिने परत करण्यासाठी किंवा दुसऱ्या लॉकरमध्ये ठेवण्यासाठी आधी बाह्य कर्ज विभागात जाऊन हे पाकीट सोडवून (Unpledge) घ्या.
                    </div>
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('bank-borrowing')}
                      className="px-3 py-1.5 rounded bg-purple-800 hover:bg-purple-900 text-white font-bold cursor-pointer shrink-0"
                    >
                      बाह्य कर्ज विभाग उघडा →
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Left Card: Assign / Move Vault or Locker Location */}
                <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-2xs">
                  <h2 className="text-xs font-bold text-primary border-b pb-1.5 mb-2.5 flex items-center gap-1.5">
                    <Lock size={14} /> दागिने ठेवण्याचे ठिकाण नोंदवा / बदला (Vault / Own Locker / External Bank Locker)
                  </h2>

                  <form onSubmit={handleSaveCustodyLocation} className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">पाकीट / पिशवी क्र. *</label>
                        <input
                          type="text"
                          required
                          disabled={isRepledged || isReleased}
                          value={packetNumber}
                          onChange={(e) => setPacketNumber(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 font-mono font-bold disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">सील क्रमांक (Seal No.)</label>
                        <input
                          type="text"
                          disabled={isRepledged || isReleased}
                          value={sealNumber}
                          onChange={(e) => setSealNumber(e.target.value)}
                          placeholder="उदा. SL-9042"
                          className="w-full border border-slate-300 rounded px-2 py-1 font-mono disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">नोंद दिनांक</label>
                        <input
                          type="date"
                          disabled={isRepledged || isReleased}
                          value={movementDate}
                          onChange={(e) => setMovementDate(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 font-mono disabled:bg-slate-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">दागिने कोठे ठेवले आहेत? *</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'BRANCH_SAFE', label: '१. शाखा तिजोरी (Safe)' },
                          { id: 'OWN_LOCKER', label: '२. संस्थेचे स्वतःचे लॉकर' },
                          { id: 'EXTERNAL_LOCKER', label: '३. बँक / पतसंस्था लॉकर' }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={isRepledged || isReleased}
                            onClick={() => setTargetCustodyStatus(opt.id as any)}
                            className={`px-2 py-1.5 rounded border text-[11px] font-bold cursor-pointer text-center ${
                              targetCustodyStatus === opt.id
                                ? 'bg-blue-50 border-primary text-primary ring-1 ring-primary'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            } disabled:opacity-50`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {targetCustodyStatus === 'BRANCH_SAFE' && (
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">
                          तिजोरी / कपाट / ट्रे क्रमांक
                        </label>
                        <input
                          type="text"
                          disabled={isRepledged || isReleased}
                          value={vaultRackNo}
                          onChange={(e) => setVaultRackNo(e.target.value)}
                          placeholder="उदा. मुख्य तिजोरी - ट्रे क्र. २"
                          className="w-full border border-slate-300 rounded px-2 py-1"
                        />
                      </div>
                    )}

                    {targetCustodyStatus === 'OWN_LOCKER' && (
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">
                          संस्थेतील लॉकर निवडा (Sanstha Locker) *
                        </label>
                        <select
                          required
                          disabled={isRepledged || isReleased}
                          value={selectedOwnLockerId}
                          onChange={(e) => setSelectedOwnLockerId(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                        >
                          <option value="">-- संस्था लॉकर निवडा --</option>
                          {ownLockers.map((l: any) => (
                            <option key={l.lockerID} value={l.lockerID}>
                              कपाट {l.cabinetNo} — लॉकर क्र. {l.lockerNo} (चावी: {l.keyNo}) [{l.typeName || l.status}]
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {targetCustodyStatus === 'EXTERNAL_LOCKER' && (
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10.5px] font-semibold text-slate-700">
                            इतर बँक / पतसंस्थेतील भाड्याचे लॉकर निवडा *
                          </label>
                          <button
                            type="button"
                            disabled={isRepledged || isReleased}
                            onClick={() => setShowExtLockerModal(true)}
                            className="text-[10.5px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus size={12} /> नवीन बाह्य लॉकर जोडा
                          </button>
                        </div>
                        <select
                          required
                          disabled={isRepledged || isReleased}
                          value={selectedExtLockerId}
                          onChange={(e) => setSelectedExtLockerId(e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                        >
                          <option value="">-- बँक / पतसंस्था लॉकर निवडा --</option>
                          {externalLockers.map((el: any) => (
                            <option key={el.externalLockerID} value={el.externalLockerID}>
                              {el.bankOrSocietyName} {el.bankBranchName ? `(${el.bankBranchName})` : ''} — लॉकर क्र. {el.lockerNo}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">शेरा / नोंद</label>
                      <input
                        type="text"
                        disabled={isRepledged || isReleased}
                        value={custodyRemarks}
                        onChange={(e) => setCustodyRemarks(e.target.value)}
                        placeholder="उदा. वाटपानंतर सीलबंद करून बँक लॉकरमध्ये ठेवले"
                        className="w-full border border-slate-300 rounded px-2 py-1"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingCustody || isRepledged || isReleased}
                      className="w-full py-1.5 rounded bg-primary hover:opacity-95 text-white font-bold cursor-pointer disabled:opacity-40"
                    >
                      {savingCustody ? 'जतन होत आहे...' : 'कस्टडी ठिकाण जतन करा (Save Custody Location)'}
                    </button>
                  </form>
                </div>

                {/* Right Card: Customer Ornament Handover / Release */}
                <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-2xs flex flex-col justify-between">
                  <div>
                    <h2 className="text-xs font-bold text-emerald-800 border-b pb-1.5 mb-2.5 flex items-center gap-1.5">
                      <PackageCheck size={14} /> पूर्ण कर्ज वसुलीनंतर खातेदारास दागिने सुपूर्दगी (Customer Release)
                    </h2>

                    {isReleased ? (
                      <div className="p-3 rounded bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2">
                        <div className="font-bold text-xs flex items-center gap-1.5 text-emerald-800">
                          <CheckCircle2 size={16} /> हे सोने दागिने खातेदारास सुपूर्द केले गेले आहेत!
                        </div>
                        <div className="text-[11px] space-y-0.5">
                          <div>सुपूर्दगी पावती क्र.: <strong>{cust.releaseReceiptNo}</strong></div>
                          <div>सुपूर्द दिनांक: <strong>{cust.releasedDate ? new Date(cust.releasedDate).toLocaleDateString('en-GB') : '-'}</strong></div>
                          <div>स्वीकारणार: <strong>{cust.releasedToName}</strong> ({cust.releasedToRelation})</div>
                          {cust.receiverIdProof && <div>ओळखपत्र तपशील: <strong>{cust.receiverIdProof}</strong></div>}
                        </div>
                        <button
                          type="button"
                          onClick={handlePrintReleaseReceipt}
                          className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer size={14} /> दागिने सुपूर्दगी पावती छापा
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleReleaseToCustomer} className="space-y-2">
                        {!ls.canReleaseToCustomer && (
                          <div className="p-2 rounded bg-amber-50 border border-amber-300 text-amber-950 text-[11px] space-y-0.5">
                            <div className="font-bold">⚠️ दागिने सुपूर्दगीसाठी खालील अटी पूर्ण होणे आवश्यक आहे:</div>
                            {!ls.isZeroBalance && (
                              <div>• कर्जाची येणे बाकी अद्याप ₹{fmtAmt(ls.principalBalance + ls.interestBalance + ls.overdueInterestBalance)} शिल्लक आहे.</div>
                            )}
                            {ls.pendingCollectionVouchers > 0 && (
                              <div>• वसुलीचे {ls.pendingCollectionVouchers} व्हाउचर अद्याप प्रलंबित (Pending Passing) आहे.</div>
                            )}
                            {isRepledged && (
                              <div className="text-red-700 font-bold">• हे पाकीट बाह्य कर्जात पुनर्गहाण (Re-pledged) आहे — आधी ते सोडवून घ्या.</div>
                            )}
                          </div>
                        )}

                        {ls.canReleaseToCustomer && (
                          <div className="p-2 rounded bg-emerald-50 border border-emerald-300 text-emerald-900 font-semibold text-[11px]">
                            ✓ कर्ज १००% फेडले गेले आहे! खालील ठिकाणाहून पाकीट काढा: <strong>{custodyDetails.custodyLocationDisplay}</strong>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">सुपूर्द दिनांक *</label>
                            <input
                              type="date"
                              required
                              disabled={!ls.canReleaseToCustomer}
                              value={releaseDate}
                              onChange={(e) => setReleaseDate(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 font-mono disabled:bg-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">नाते / अधिकार</label>
                            <select
                              disabled={!ls.canReleaseToCustomer}
                              value={releasedToRelation}
                              onChange={(e) => setReleasedToRelation(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 bg-white disabled:bg-slate-100"
                            >
                              <option value="स्वतः कर्जदार (Self)">स्वतः कर्जदार (Self)</option>
                              <option value="कायदेशीर वारस (Legal Heir)">कायदेशीर वारस (Legal Heir)</option>
                              <option value="अधिकृत प्रतिनिधी (Authorized)">अधिकृत प्रतिनिधी (Authorized)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">स्वीकारणाऱ्याचे पूर्ण नाव *</label>
                            <input
                              type="text"
                              required
                              disabled={!ls.canReleaseToCustomer}
                              value={releasedToName}
                              onChange={(e) => setReleasedToName(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1 disabled:bg-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">ओळखपत्र क्र. (आधार/पॅन)</label>
                            <input
                              type="text"
                              disabled={!ls.canReleaseToCustomer}
                              value={receiverIdProof}
                              onChange={(e) => setReceiverIdProof(e.target.value)}
                              placeholder="उदा. Aadhaar XXXX-1234"
                              className="w-full border border-slate-300 rounded px-2 py-1 disabled:bg-slate-100"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">स्वाक्षरी पोहोच फोटो (ऐच्छिक)</label>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={!ls.canReleaseToCustomer}
                              onChange={handleReleasePhotoCapture}
                              className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-[10.5px] bg-slate-50"
                            />
                          </div>
                          <div>
                            <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">शेरा</label>
                            <input
                              type="text"
                              disabled={!ls.canReleaseToCustomer}
                              value={releaseRemarks}
                              onChange={(e) => setReleaseRemarks(e.target.value)}
                              placeholder="तपासून सुस्थितीत सुपूर्द"
                              className="w-full border border-slate-300 rounded px-2 py-1 disabled:bg-slate-100"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={!ls.canReleaseToCustomer || releasingGold}
                          className="w-full py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer disabled:opacity-40"
                        >
                          {releasingGold ? 'नोंद होत आहे...' : 'खातेदारास दागिने सुपूर्द करा व पावती बनवा'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Ornaments Table + Custody Movement Audit Trail */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-2xs">
                  <h3 className="font-bold text-slate-800 mb-2 border-b pb-1">
                    तारण ठेवलेले सोन्याचे दागिने ({(custodyDetails.ornaments || []).length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-[11px]">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="border px-2 py-1 text-left">दागिना</th>
                          <th className="border px-1.5 py-1 text-center">नग</th>
                          <th className="border px-2 py-1 text-right">निव्वळ वजन (g)</th>
                          <th className="border px-2 py-1 text-right">मूल्यांकन (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(custodyDetails.ornaments || []).map((g: any) => (
                          <tr key={g.goldLoanDetailID}>
                            <td className="border px-2 py-1 font-medium">{g.ornamentName} ({g.purity}K)</td>
                            <td className="border px-1.5 py-1 text-center">{g.quantity}</td>
                            <td className="border px-2 py-1 text-right font-mono">{fmtWt(g.netWeight)}</td>
                            <td className="border px-2 py-1 text-right font-mono">
                              ₹{fmtAmt(g.valuerValuation || g.estimatedValue)}
                            </td>
                          </tr>
                        ))}
                        {(custodyDetails.ornaments || []).length === 0 && (
                          <tr>
                            <td colSpan={4} className="border px-2 py-4 text-center text-slate-500">
                              सुट्टे दागिने अद्याप नोंदवलेले नाहीत. वरून "सोने जिन्नस नोंदणी" उघडून जोडा.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-2xs">
                  <h3 className="font-bold text-slate-800 mb-2 border-b pb-1 flex items-center gap-1.5">
                    <History size={14} /> दागिने पाकीट हालचाल इतिहास (Custody Audit Trail)
                  </h3>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {(custodyDetails.movementLogs || []).map((m: any) => (
                      <div key={m.movementLogID} className="p-2 rounded border border-slate-200 bg-slate-50/70 text-[11px]">
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span>📍 {m.toLocationSummary}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {new Date(m.movementDate).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                        {m.fromLocationSummary && (
                          <div className="text-[10px] text-slate-500">पूर्वी: {m.fromLocationSummary}</div>
                        )}
                        {m.remarks && <div className="text-[10.5px] text-slate-700 mt-0.5">{m.remarks}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COLLATERAL & KYC DOCUMENTS UPLOAD */}
          {(activeTab === 'documents' || !isGold) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1 bg-white p-3 rounded-sm shadow-2xs border border-slate-300">
                <h2 className="text-xs font-bold text-primary mb-2.5 border-b pb-1.5">
                  नवीन तारण / केवायसी कागदपत्र अपलोड करा
                </h2>
                <form onSubmit={handleUploadDocument} className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">कागदपत्राचा प्रकार *</label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full border border-slate-300 px-2 py-1.5 rounded bg-white text-xs"
                    >
                      {DOCUMENT_TYPES.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">वर्णन / संदर्भ (पर्यायी)</label>
                    <input
                      type="text"
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      className="w-full border border-slate-300 px-2 py-1.5 rounded text-xs"
                      placeholder="उदा. गट नं. १४२ सातबारा / जामीनदार संमती"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">फाईल निवडा (PDF / Image) *</label>
                    <input
                      type="file"
                      id="collateralFileUpload"
                      required
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full border border-slate-300 px-2 py-1 rounded bg-slate-50 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full py-1.5 rounded bg-primary hover:opacity-95 text-white font-bold cursor-pointer disabled:opacity-40"
                  >
                    {uploading ? 'अपलोड होत आहे...' : 'अपलोड करा (Upload Document)'}
                  </button>
                </form>
              </div>

              <div className="md:col-span-2 bg-white p-3 rounded-sm shadow-2xs border border-slate-300">
                <h2 className="text-xs font-bold text-slate-800 mb-2.5 border-b pb-1.5">
                  अपलोड केलेली तारण व केवायसी कागदपत्रे ({documents.length})
                </h2>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 text-[11px]">
                      <tr>
                        <th className="border border-slate-200 px-2.5 py-1.5">प्रकार</th>
                        <th className="border border-slate-200 px-2.5 py-1.5">वर्णन</th>
                        <th className="border border-slate-200 px-2.5 py-1.5">दिनांक</th>
                        <th className="border border-slate-200 px-2.5 py-1.5 text-center">कृती</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((d) => (
                        <tr key={d.loanDocumentID} className="hover:bg-slate-50 text-[11px]">
                          <td className="border border-slate-200 px-2.5 py-1.5 font-semibold text-primary">
                            {d.documentType}
                          </td>
                          <td className="border border-slate-200 px-2.5 py-1.5">{d.documentName || '-'}</td>
                          <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                            {new Date(d.uploadedDate).toLocaleDateString('en-GB')}
                          </td>
                          <td className="border border-slate-200 px-2.5 py-1.5 text-center space-x-3">
                            <a
                              href={d.filePath}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-blue-700 font-bold hover:underline"
                            >
                              <ExternalLink size={12} /> पहा
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(d.loanDocumentID)}
                              className="inline-flex items-center gap-0.5 text-red-600 font-bold hover:underline cursor-pointer"
                            >
                              <Trash2 size={12} /> काढा
                            </button>
                          </td>
                        </tr>
                      ))}
                      {documents.length === 0 && (
                        <tr>
                          <td colSpan={4} className="border border-slate-200 px-2 py-6 text-center text-slate-500">
                            या कर्ज खात्यासाठी अद्याप कोणतीही कागदपत्रे अपलोड केलेली नाहीत.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick-Add External Bank/Patsanstha Locker Modal */}
      {showExtLockerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-xl border border-slate-300 max-w-md w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900">
                इतर बँक / पतसंस्थेतील भाड्याचे लॉकर नोंदणी
              </h3>
              <button type="button" onClick={() => setShowExtLockerModal(false)} className="cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateExternalLocker} className="space-y-2">
              {institutions.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">नोंदणीकृत बँक/पतसंस्था निवडा (पर्यायी)</label>
                  <select
                    value={extLockerForm.institutionID}
                    onChange={(e) => {
                      const id = e.target.value;
                      const inst = institutions.find((i: any) => String(i.institutionID) === id);
                      setExtLockerForm((prev) => ({
                        ...prev,
                        institutionID: id,
                        bankOrSocietyName: inst ? inst.institutionName : prev.bankOrSocietyName,
                        bankBranchName: inst ? inst.institutionBranchName || '' : prev.bankBranchName
                      }));
                    }}
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="">-- किंवा खाली थेट नाव टाका --</option>
                    {institutions.map((i: any) => (
                      <option key={i.institutionID} value={i.institutionID}>
                        {i.institutionName} ({i.institutionBranchName || i.institutionType})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">बँक / पतसंस्थेचे नाव *</label>
                  <input
                    type="text"
                    required
                    value={extLockerForm.bankOrSocietyName}
                    onChange={(e) => setExtLockerForm((p) => ({ ...p, bankOrSocietyName: e.target.value }))}
                    placeholder="उदा. जिल्हा मध्यवर्ती बँक"
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">शाखा नाव</label>
                  <input
                    type="text"
                    value={extLockerForm.bankBranchName}
                    onChange={(e) => setExtLockerForm((p) => ({ ...p, bankBranchName: e.target.value }))}
                    placeholder="उदा. मुख्य शाखा"
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">लॉकर क्र. *</label>
                  <input
                    type="text"
                    required
                    value={extLockerForm.lockerNo}
                    onChange={(e) => setExtLockerForm((p) => ({ ...p, lockerNo: e.target.value }))}
                    placeholder="L-108"
                    className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">कपाट / बॉक्स</label>
                  <input
                    type="text"
                    value={extLockerForm.cabinetOrBoxNo}
                    onChange={(e) => setExtLockerForm((p) => ({ ...p, cabinetOrBoxNo: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">चावी क्र.</label>
                  <input
                    type="text"
                    value={extLockerForm.keyNo}
                    onChange={(e) => setExtLockerForm((p) => ({ ...p, keyNo: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">वार्षिक भाडे (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={extLockerForm.annualRentAmount}
                    onChange={(e) => setExtLockerForm((p) => ({ ...p, annualRentAmount: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">अधिकृत पदाधिकारी</label>
                  <input
                    type="text"
                    value={extLockerForm.authorizedSignatories}
                    onChange={(e) => setExtLockerForm((p) => ({ ...p, authorizedSignatories: e.target.value }))}
                    placeholder="सचिव / अध्यक्ष"
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowExtLockerModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-primary text-white font-bold cursor-pointer"
                >
                  लॉकर जतन करा
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
