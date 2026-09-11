import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Search, X, Edit2, Trash2, UserPlus, UserCheck, MapPin, FileText, Camera, 
  Check, Eye, RefreshCw, UserCheck2, ShieldAlert, Download, CreditCard, Sparkles, 
  Inbox, CheckCircle2, Clock, XCircle, AlertCircle, Plus, Phone, Calendar, 
  Layers, UploadCloud, Maximize2, ShieldCheck, FileBadge, Award, Coins, IndianRupee,
  Scale, BookOpen, Printer, Building2, CheckSquare, Filter, Landmark, RotateCcw,
  CheckCircle, Percent
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CustomerSearchSelect, { CustomerOption } from './common/CustomerSearchSelect';
import DeceasedClaimSettlementModal from './DeceasedClaimSettlementModal';
import ShareCertificatePreview from './ShareCertificatePreview';

interface Customer extends CustomerOption {
  customerID: number;
  cifNo: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nickName?: string;
  firstNameEng?: string;
  middleNameEng?: string;
  lastNameEng?: string;
  address?: string;
  addressEng?: string;
  village?: string;
  taluka?: string;
  district?: string;
  mobileNo: string;
  aadhaarNo: string;
  panNo?: string;
  gender?: string;
  birthDate?: string;
  occupation?: string;
  casteCategory?: string;
  caste?: string;
  email?: string;
  photoPath?: string;
  signaturePath?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineeAddress?: string;
}

interface Member {
  memberID: number;
  customerID?: number;
  branchID: number;
  branch?: {
    branchName: string;
    branchCode: string;
  };
  memberCode: string;
  oldMemberCode?: string;
  cifNo?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nickName?: string;
  firstNameEng?: string;
  middleNameEng?: string;
  lastNameEng?: string;
  address?: string;
  village?: string;
  taluka?: string;
  district?: string;
  mobileNo: string;
  aadhaarNo: string;
  panNo?: string;
  joiningDate: string;
  status: string;
  membershipType: string;
  gender?: string;
  birthDate?: string;
  occupation?: string;
  casteCategory?: string;
  caste?: string;
  email?: string;
  photoPath?: string;
  signaturePath?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineeAddress?: string;
  legacyMemberNo?: string;
  // Enriched Share Details
  totalShareCount?: number;
  totalShareAmount?: number;
  latestCertificateNo?: string;
}

interface Branch {
  branchID: number;
  branchCode: string;
  branchName: string;
}

interface MemberMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function MemberMaster({ onNavigate }: MemberMasterProps = {}) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Summary modal after saving new member displaying Member & Share Details
  const [newRegisteredMember, setNewRegisteredMember] = useState<{
    memberId: number;
    memberCode: string;
    memberName: string;
    voucherNo?: string;
    feeAmount?: number;
    sharesCount?: number;
    shareAmount?: number;
    fromShareNo?: number | string;
    toShareNo?: number | string;
    certNo?: string;
  } | null>(null);

  // List Modal Filter States
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');

  // Selected Customer for New Member Application
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Share Allotment & Admission Fees Configuration
  const [shareConfig, setShareConfig] = useState<{
    allotmentDate: string;
    numberOfShares: number | '';
    faceValue: number;
    admissionFee: number;
    buildingFund: number;
    paymentMode: 'Cash' | 'Transfer';
    savingAccountId: number | '';
  }>({
    allotmentDate: new Date().toISOString().split('T')[0],
    numberOfShares: '',
    faceValue: 100,
    admissionFee: 10,
    buildingFund: 0,
    paymentMode: 'Cash', // Cash or Transfer
    savingAccountId: ''
  });

  const [nextShareConfig, setNextShareConfig] = useState<{
    nextCertificateNo: string;
    nextFromShareNo: number;
  }>({
    nextCertificateNo: '',
    nextFromShareNo: 1
  });

  const [customerSavingAccounts, setCustomerSavingAccounts] = useState<any[]>([]);
  const [loadingSavingAccounts, setLoadingSavingAccounts] = useState(false);

  // Board Approval & Resolution Details (MCS Act Compliance)
  const [resolutionData, setResolutionData] = useState({
    applicationDate: new Date().toISOString().split('T')[0],
    resolutionNo: '',
    resolutionDate: new Date().toISOString().split('T')[0],
    joiningDate: new Date().toISOString().split('T')[0],
    proposerMemberID: '',
    seconderMemberID: ''
  });

  // Member Core Form State
  const [formData, setFormData] = useState({
    branchID: user?.branchID || 1,
    memberCode: '',
    legacyMemberNo: '',
    cifNo: '',
    membershipType: 'Regular', // Regular, Associate, Nominal, Sympathizer
    status: 'Active',
    // Customer KYC / Demographics mirrored
    firstName: '',
    middleName: '',
    lastName: '',
    nickName: '',
    firstNameEng: '',
    middleNameEng: '',
    lastNameEng: '',
    address: '',
    village: '',
    taluka: '',
    district: '',
    mobileNo: '',
    email: '',
    aadhaarNo: '',
    panNo: '',
    gender: 'Male',
    birthDate: '',
    occupation: '',
    casteCategory: '',
    caste: '',
    nomineeName: '',
    nomineeRelation: '',
    nomineeAddress: '',
    photoPath: '',
    signaturePath: ''
  });

  // Certificate Preview Modal
  const [previewCertModal, setPreviewCertModal] = useState<{ 
    isOpen: boolean; 
    memberId: number; 
    memberName: string;
    certNo?: string;
    shares?: number;
    amount?: number;
  } | null>(null);
  const [isDeceasedModalOpen, setIsDeceasedModalOpen] = useState(false);
  const [selectedDeceasedMemberId, setSelectedDeceasedMemberId] = useState<number>(0);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  const API_URL = '/api/Members';
  const CUSTOMER_API_URL = '/api/Customers';
  const BRANCH_API_URL = '/api/Branches';

  const getAuthHeaders = (): Record<string, string> => {
    const token = user?.token || localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchNextMemberCode();
    fetchNextShareConfig();
    fetchCustomers();
    fetchMembers();
    fetchBranches();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchNextShareConfig = async () => {
    try {
      const response = await fetch('/api/ShareAccounts/NextShareConfig', { headers: getAuthHeaders() });
      if (response.ok && isMountedRef.current) {
        const data = await response.json();
        if (data && isMountedRef.current) {
          setNextShareConfig({
            nextCertificateNo: data.nextCertificateNo || '',
            nextFromShareNo: data.nextFromShareNo || 1
          });
        }
      }
    } catch (e) {
      console.error("Error fetching next share config:", e);
    }
  };

  const fetchNextMemberCode = async () => {
    try {
      const response = await fetch(`${API_URL}/next-code`, { headers: getAuthHeaders() });
      if (response.ok && isMountedRef.current) {
        const code = await response.text();
        const cleaned = code.replace(/^"|"$/g, '').trim();
        if (cleaned && isMountedRef.current) {
          setFormData(prev => ({ ...prev, memberCode: cleaned }));
        }
      }
    } catch (e) {
      console.error("Error fetching next member code:", e);
    }
  };

  const fetchCustomers = async (existingMembers?: Member[]) => {
    try {
      const res = await fetch(CUSTOMER_API_URL, { headers: getAuthHeaders() });
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        const rawCusts = Array.isArray(data) ? data : [];
        const memList = existingMembers || members;
        
        const enriched = rawCusts.map((c: any) => {
          const matched = memList.find(m => (m.customerID && m.customerID === c.customerID) || (m.cifNo && m.cifNo === c.cifNo));
          return {
            ...c,
            memberCode: matched?.memberCode || c.memberProfile?.memberCode || c.memberCode || ''
          };
        });

        if (isMountedRef.current) {
          setCustomers(enriched);
        }
      }
    } catch (e) {
      console.error("Error fetching customers", e);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_URL}?membersOnly=true`, { headers: getAuthHeaders() });
      let memberList: Member[] = [];
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        memberList = Array.isArray(data) ? data : [];
      }

      try {
        const shRes = await fetch('/api/ShareAccounts/Shareholders', { headers: getAuthHeaders() });
        if (shRes.ok && isMountedRef.current) {
          const shData = await shRes.json();
          if (Array.isArray(shData)) {
            const shMap = new Map<number, any>();
            shData.forEach(s => shMap.set(s.memberId || s.MemberId, s));

            memberList = memberList.map(m => {
              const sh = shMap.get(m.memberID);
              return {
                ...m,
                totalShareCount: sh ? sh.totalShareCount : (m.totalShareCount || 0),
                totalShareAmount: sh ? sh.totalShareAmount : (m.totalShareAmount || 0),
                latestCertificateNo: sh ? sh.latestCertificateNo : (m.latestCertificateNo || '')
              };
            });
          }
        }
      } catch (shErr) {
        console.error("Error fetching shareholder details", shErr);
      }

      if (!isMountedRef.current) return;

      const strictlyMembers = memberList.filter(m => 
        m.memberCode && 
        m.memberCode.trim() !== '' && 
        !m.memberCode.startsWith('TEMP')
      );

      if (isMountedRef.current) {
        setMembers(strictlyMembers);
        fetchCustomers(strictlyMembers);
      }
    } catch (e) {
      console.error("Error fetching members", e);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(BRANCH_API_URL, { headers: getAuthHeaders() });
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        setBranches(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error fetching branches", e);
    }
  };

  const fetchCustomerSavingAccounts = async (customerId: number) => {
    if (!customerId) {
      setCustomerSavingAccounts([]);
      setShareConfig(prev => ({ ...prev, savingAccountId: '' }));
      return;
    }
    setLoadingSavingAccounts(true);
    try {
      const res = await fetch(`/api/SavingAccounts?customerId=${customerId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const activeAccounts = list.filter((a: any) => a.status !== 'Closed' && a.status !== 'Frozen');
        setCustomerSavingAccounts(activeAccounts);
        if (activeAccounts.length > 0) {
          setShareConfig(prev => {
            const exists = activeAccounts.some((a: any) => a.savingAccountID === prev.savingAccountId);
            return {
              ...prev,
              savingAccountId: exists ? prev.savingAccountId : activeAccounts[0].savingAccountID
            };
          });
        } else {
          setShareConfig(prev => ({ ...prev, savingAccountId: '' }));
        }
      } else {
        setCustomerSavingAccounts([]);
        setShareConfig(prev => ({ ...prev, savingAccountId: '' }));
      }
    } catch (err) {
      console.error("Error fetching customer saving accounts", err);
      setCustomerSavingAccounts([]);
      setShareConfig(prev => ({ ...prev, savingAccountId: '' }));
    } finally {
      setLoadingSavingAccounts(false);
    }
  };

  const handleCustomerSelect = (customerId: number | '') => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setSelectedCustomer(null);
      setCustomerSavingAccounts([]);
      setShareConfig(prev => ({ ...prev, savingAccountId: '' }));
      fetchNextMemberCode();
      return;
    }

    // Fetch saving accounts for the selected customer
    fetchCustomerSavingAccounts(Number(customerId));

    const cust = customers.find(c => c.customerID === customerId);
    if (cust) {
      setSelectedCustomer(cust);

      // Find if this customer is already a registered member
      const matchedMember = members.find(m => 
        (m.customerID && m.customerID === customerId) || 
        (m.cifNo && cust.cifNo && m.cifNo.trim().toLowerCase() === cust.cifNo.trim().toLowerCase()) ||
        (cust.memberCode && m.memberCode === cust.memberCode)
      );

      const isRegistered = Boolean(
        (cust.memberCode && !cust.memberCode.startsWith('TEMP')) ||
        (matchedMember && matchedMember.memberCode && !matchedMember.memberCode.startsWith('TEMP'))
      );

      const memCode = matchedMember?.memberCode || cust.memberCode || '';

      setFormData(prev => ({
        ...prev,
        branchID: matchedMember?.branchID || cust.branchID || prev.branchID,
        memberCode: isRegistered ? memCode : prev.memberCode,
        legacyMemberNo: matchedMember?.legacyMemberNo || (matchedMember as any)?.oldMemberCode || '',
        cifNo: cust.cifNo || matchedMember?.cifNo || '',
        membershipType: matchedMember?.membershipType || 'Regular',
        status: matchedMember?.status || 'Active',
        firstName: cust.firstName || matchedMember?.firstName || '',
        middleName: cust.middleName || matchedMember?.middleName || '',
        lastName: cust.lastName || matchedMember?.lastName || '',
        nickName: cust.nickName || matchedMember?.nickName || '',
        firstNameEng: cust.firstNameEng || matchedMember?.firstNameEng || '',
        middleNameEng: cust.middleNameEng || matchedMember?.middleNameEng || '',
        lastNameEng: cust.lastNameEng || matchedMember?.lastNameEng || '',
        address: cust.address || matchedMember?.address || '',
        village: cust.village || matchedMember?.village || '',
        taluka: cust.taluka || matchedMember?.taluka || '',
        district: cust.district || matchedMember?.district || '',
        mobileNo: cust.mobileNo || matchedMember?.mobileNo || '',
        email: cust.email || matchedMember?.email || '',
        aadhaarNo: cust.aadhaarNo || matchedMember?.aadhaarNo || '',
        panNo: cust.panNo || matchedMember?.panNo || '',
        gender: cust.gender || matchedMember?.gender || 'Male',
        birthDate: cust.birthDate ? cust.birthDate.split('T')[0] : (matchedMember?.birthDate ? matchedMember.birthDate.split('T')[0] : ''),
        occupation: cust.occupation || matchedMember?.occupation || '',
        casteCategory: cust.casteCategory || matchedMember?.casteCategory || '',
        caste: cust.caste || matchedMember?.caste || '',
        nomineeName: cust.nomineeName || matchedMember?.nomineeName || '',
        nomineeRelation: cust.nomineeRelation || matchedMember?.nomineeRelation || '',
        nomineeAddress: cust.nomineeAddress || matchedMember?.nomineeAddress || '',
        photoPath: cust.photoPath || matchedMember?.photoPath || '',
        signaturePath: cust.signaturePath || matchedMember?.signaturePath || ''
      }));

      if (isRegistered && matchedMember) {
        // Populate existing member resolution details
        setResolutionData(prev => ({
          ...prev,
          applicationDate: (matchedMember as any).applicationDate ? (matchedMember as any).applicationDate.split('T')[0] : (matchedMember.joiningDate ? matchedMember.joiningDate.split('T')[0] : prev.applicationDate),
          resolutionNo: (matchedMember as any).resolutionNo || '',
          resolutionDate: (matchedMember as any).resolutionDate ? (matchedMember as any).resolutionDate.split('T')[0] : (matchedMember.joiningDate ? matchedMember.joiningDate.split('T')[0] : prev.resolutionDate),
          joiningDate: matchedMember.joiningDate ? matchedMember.joiningDate.split('T')[0] : prev.joiningDate,
          proposerMemberID: (matchedMember as any).proposerMemberID ? String((matchedMember as any).proposerMemberID) : '',
          seconderMemberID: (matchedMember as any).seconderMemberID ? String((matchedMember as any).seconderMemberID) : ''
        }));
      } else {
        // If not already a member, ensure fresh next codes are active
        fetchNextMemberCode();
      }
    }
  };

  const isExistingMember = !editingId && Boolean(
    selectedCustomer?.memberCode && 
    selectedCustomer.memberCode.trim() !== '' && 
    !selectedCustomer.memberCode.startsWith('TEMP')
  );

  const shareCapitalAmount = (Number(shareConfig.numberOfShares) || 0) * (shareConfig.faceValue || 100);
  const totalPayable = shareCapitalAmount + (shareConfig.admissionFee || 0) + (shareConfig.buildingFund || 0);

  const autoFromShareNo = nextShareConfig.nextFromShareNo || 1;
  const hasShares = shareConfig.numberOfShares !== '' && Number(shareConfig.numberOfShares) > 0;
  const autoToShareNo = hasShares 
    ? autoFromShareNo + Number(shareConfig.numberOfShares) - 1 
    : 0;
  const autoCertificateNo = hasShares 
    ? (nextShareConfig.nextCertificateNo || `CERT-${new Date().getFullYear()}-00001`) 
    : '-';

  const handleApplicationDateChange = (val: string) => {
    setResolutionData(prev => {
      const updated = { ...prev, applicationDate: val };
      if (prev.resolutionDate && val > prev.resolutionDate) {
        updated.resolutionDate = val;
      }
      if (prev.joiningDate && val > prev.joiningDate) {
        updated.joiningDate = val;
      }
      return updated;
    });
    setShareConfig(prev => {
      if (prev.allotmentDate && val > prev.allotmentDate) {
        return { ...prev, allotmentDate: val };
      }
      return prev;
    });
  };

  const handleResolutionDateChange = (val: string) => {
    if (resolutionData.applicationDate && val < resolutionData.applicationDate) {
      setError("ठराव दिनांक (Resolution Date) हा अर्ज दिनांकापेक्षा (Application Date) आधीचा असू शकत नाही.");
      return;
    }
    setError("");
    setResolutionData(prev => {
      const updated = { ...prev, resolutionDate: val };
      if (prev.joiningDate && val > prev.joiningDate) {
        updated.joiningDate = val;
      }
      return updated;
    });
    setShareConfig(prev => {
      if (prev.allotmentDate && val > prev.allotmentDate) {
        return { ...prev, allotmentDate: val };
      }
      return prev;
    });
  };

  const handleAllotmentDateChange = (val: string) => {
    if (resolutionData.applicationDate && val < resolutionData.applicationDate) {
      setError("शेअर्स वाटप तारीख (Allotment Date) ही अर्ज दिनांकापेक्षा (Application Date) आधीची असू शकत नाही.");
      return;
    }
    if (resolutionData.resolutionDate && val < resolutionData.resolutionDate) {
      setError("शेअर्स वाटप तारीख (Allotment Date) ही ठराव दिनांकापेक्षा (Resolution Date) आधीची असू शकत नाही.");
      return;
    }
    setError("");
    setShareConfig(prev => ({ ...prev, allotmentDate: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Mandatory Share Quantity Validation
    if (shareConfig.numberOfShares === '' || Number(shareConfig.numberOfShares) <= 0) {
      setError("कृपया शेअर्स संख्या (Qty) भरा. शेअर्स संख्या प्रविष्ट केल्याशिवाय अर्ज जतन करता येणार नाही.");
      return;
    }

    // Date validations (MCS Act compliance)
    if (resolutionData.applicationDate && resolutionData.resolutionDate) {
      if (resolutionData.resolutionDate < resolutionData.applicationDate) {
        setError("ठराव दिनांक (Resolution Date) हा अर्ज दिनांकापेक्षा (Application Date) आधीचा असू शकत नाही.");
        return;
      }
    }
    if (hasShares && shareConfig.allotmentDate) {
      if (resolutionData.applicationDate && shareConfig.allotmentDate < resolutionData.applicationDate) {
        setError("शेअर्स वाटप तारीख (Allotment Date) ही अर्ज दिनांकापेक्षा (Application Date) आधीची असू शकत नाही.");
        return;
      }
      if (resolutionData.resolutionDate && shareConfig.allotmentDate < resolutionData.resolutionDate) {
        setError("शेअर्स वाटप तारीख (Allotment Date) ही ठराव दिनांकापेक्षा (Resolution Date) आधीची असू शकत नाही.");
        return;
      }
    }

    if (!editingId && !selectedCustomerId) {
      setError("कृपया प्रथम खातेदार (Customer) निवडा किंवा खातेदार नोंदणी करा.");
      return;
    }

    if (shareConfig.paymentMode === 'Transfer') {
      if (!selectedCustomerId) {
        setError("कृपया प्रथम खातेदार (Customer) निवडा.");
        return;
      }
      if (customerSavingAccounts.length === 0) {
        setError("या खातेदाराचे कोणतेही सक्रिय बचत खाते उपलब्ध नसल्याने 'बचत खात्यातून वर्ग' करता येणार नाही. कृपया 'रोख भरणा' निवडा किंवा आधी बचत खाते उघडा.");
        return;
      }
      if (!shareConfig.savingAccountId) {
        setError("कृपया भरणा करण्यासाठी खातेदाराचे बचत खाते निवडा.");
        return;
      }
      const selAcc = customerSavingAccounts.find((a: any) => a.savingAccountID === Number(shareConfig.savingAccountId));
      const availBal = selAcc ? ((selAcc.currentBalance || 0) - (selAcc.lienAmount || 0) - (selAcc.minimumBalance || 0)) : 0;
      if (totalPayable > 0 && availBal < totalPayable) {
        setError(`निवडलेल्या बचत खात्यामध्ये अपुरी शिल्लक आहे. (उपलब्ध: ₹${availBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, आवश्यक: ₹${totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`);
        return;
      }
    }

    if (!formData.memberCode?.trim()) {
      setError("कृपया सभासद क्रमांक (Member Code) भरा.");
      return;
    }

    if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
      setError("सभासदाचे पहिले नाव आणि आडनाव आवश्यक आहे.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...formData,
        memberID: editingId !== null ? Number(editingId) : 0,
        customerID: selectedCustomerId ? Number(selectedCustomerId) : (editingId !== null ? formData.cifNo : null),
        branchID: Number(formData.branchID),
        joiningDate: resolutionData.joiningDate ? new Date(resolutionData.joiningDate).toISOString() : new Date().toISOString(),
        birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
        membershipType: formData.membershipType || 'Regular',
        status: formData.status || 'Active',
        numberOfShares: Number(shareConfig.numberOfShares) || 0,
        shareFaceValue: Number(shareConfig.faceValue) || 100,
        allotmentDate: shareConfig.allotmentDate ? new Date(shareConfig.allotmentDate).toISOString() : null,
        admissionFee: Number(shareConfig.admissionFee) || 0,
        buildingFund: Number(shareConfig.buildingFund) || 0,
        paymentMode: shareConfig.paymentMode || 'Cash',
        savingAccountId: shareConfig.paymentMode === 'Transfer' && shareConfig.savingAccountId ? Number(shareConfig.savingAccountId) : null
      };

      let response;
      if (editingId !== null) {
        response = await fetch(`${API_URL}/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
        let savedMember: any = {};
        try {
          savedMember = await response.json();
        } catch {
          savedMember = {};
        }
        const targetMemberId = (editingId !== null) ? editingId : savedMember.memberID;
        const targetMemberCode = savedMember.memberCode || formData.memberCode;
        const vchNo = savedMember.generatedVoucherNo;

        if (editingId === null) {
          setNewRegisteredMember({
            memberId: targetMemberId,
            memberCode: targetMemberCode,
            memberName: `${formData.firstName} ${formData.lastName}`,
            voucherNo: vchNo,
            feeAmount: totalPayable,
            sharesCount: Number(shareConfig.numberOfShares) || 0,
            shareAmount: shareCapitalAmount,
            fromShareNo: autoFromShareNo,
            toShareNo: autoToShareNo,
            certNo: autoCertificateNo
          });
          if (shareConfig.numberOfShares > 0 && vchNo) {
            setSuccess(`नवीन सभासद नोंदणी व भाग वाटप (${shareConfig.numberOfShares} शेअर्स) यशस्वी! पावती व्हाऊचर क्र. ${vchNo} (रक्कम: ₹${totalPayable.toLocaleString('en-IN')}) रोजकीर्द (Day Book) ला जमा झाले आहे.`);
          } else if (vchNo) {
            setSuccess(`नवीन सभासद नोंदणी अर्ज यशस्वी! पावती व्हाऊचर क्र. ${vchNo} (रक्कम: ₹${totalPayable.toLocaleString('en-IN')}) रोजकीर्द (Day Book) ला जमा झाले आहे.`);
          } else {
            setSuccess("नवीन सभासद नोंदणी अर्ज यशस्वीरित्या जतन झाला!");
          }
        } else {
          setSuccess("सभासद माहिती यशस्वीरित्या अद्ययावत केली!");
        }

        resetForm();
        fetchMembers();
      } else {
        let errorMsg = 'सभासद अर्ज सेव्ह करता आला नाही.';
        try {
          const text = await response.text();
          try {
            const err = JSON.parse(text);
            errorMsg = err.message || err.title || (typeof err === 'string' ? err : text);
          } catch {
            errorMsg = text || response.statusText;
          }
        } catch {
          errorMsg = response.statusText;
        }
        setError(`त्रुटी: ${errorMsg}`);
      }
    } catch (err: any) {
      console.error("Submit error:", err);
      setError(`सर्व्हरशी संपर्क साधताना एरर आली: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (member: Member) => {
    setEditingId(member.memberID);
    setSelectedCustomerId(member.customerID || '');
    if (member.customerID) {
      fetchCustomerSavingAccounts(member.customerID);
    }
    setFormData({
      branchID: member.branchID || 1,
      memberCode: member.memberCode || '',
      legacyMemberNo: member.legacyMemberNo || (member as any).oldMemberCode || '',
      cifNo: member.cifNo || '',
      membershipType: member.membershipType || 'Regular',
      status: member.status || 'Active',
      firstName: member.firstName || '',
      middleName: member.middleName || '',
      lastName: member.lastName || '',
      nickName: member.nickName || '',
      firstNameEng: member.firstNameEng || '',
      middleNameEng: member.middleNameEng || '',
      lastNameEng: member.lastNameEng || '',
      address: member.address || '',
      village: member.village || '',
      taluka: member.taluka || '',
      district: member.district || '',
      mobileNo: member.mobileNo || '',
      email: member.email || '',
      aadhaarNo: member.aadhaarNo || '',
      panNo: member.panNo || '',
      gender: member.gender || 'Male',
      birthDate: member.birthDate ? member.birthDate.split('T')[0] : '',
      occupation: member.occupation || '',
      casteCategory: member.casteCategory || '',
      caste: member.caste || '',
      nomineeName: member.nomineeName || '',
      nomineeRelation: member.nomineeRelation || '',
      nomineeAddress: member.nomineeAddress || '',
      photoPath: member.photoPath || '',
      signaturePath: member.signaturePath || ''
    });

    setError('');
    setSuccess('');
    setIsListModalOpen(false);
    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे का की हा सभासद रद्द / डिलीट करायचा आहे? (Are you sure you want to delete this member?)")) return;
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        let msg = "सभासद यशस्वीरित्या डिलीट केला.";
        try {
          const data = await response.json();
          msg = data.message || msg;
        } catch {}
        setSuccess(msg);
        await fetchMembers();
        await fetchNextMemberCode();
        resetForm();
      } else {
        let errorMsg = 'डिलीट करता आले नाही.';
        try {
          const text = await response.text();
          try {
            const err = JSON.parse(text);
            errorMsg = err.message || err.title || (typeof err === 'string' ? err : text);
          } catch {
            errorMsg = text || response.statusText;
          }
        } catch {
          errorMsg = response.statusText;
        }
        setError(`त्रुटी: ${errorMsg}`);
      }
    } catch (e: any) {
      console.error("Delete member error:", e);
      setError(`सर्व्हर एरर: ${e?.message || e}`);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedCustomerId('');
    setSelectedCustomer(null);
    setShareConfig({
      allotmentDate: new Date().toISOString().split('T')[0],
      numberOfShares: '',
      faceValue: 100,
      admissionFee: 10,
      buildingFund: 0,
      paymentMode: 'Cash',
      savingAccountId: ''
    });
    setFormData({
      branchID: user?.branchID || 1,
      memberCode: '',
      legacyMemberNo: '',
      cifNo: '',
      membershipType: 'Regular',
      status: 'Active',
      firstName: '',
      middleName: '',
      lastName: '',
      nickName: '',
      firstNameEng: '',
      middleNameEng: '',
      lastNameEng: '',
      address: '',
      village: '',
      taluka: '',
      district: '',
      mobileNo: '',
      email: '',
      aadhaarNo: '',
      panNo: '',
      gender: 'Male',
      birthDate: '',
      occupation: '',
      casteCategory: '',
      caste: '',
      nomineeName: '',
      nomineeRelation: '',
      nomineeAddress: '',
      photoPath: '',
      signaturePath: ''
    });
    fetchNextMemberCode();
    fetchNextShareConfig();
    setError('');
    setSuccess('');
  };

  // Strictly Filter Genuine Registered Members
  const filteredMembers = members.filter(m => {
    if (!m.memberCode || m.memberCode.trim() === '' || m.memberCode.startsWith('TEMP')) {
      return false;
    }

    if (selectedTypeFilter !== 'All' && m.membershipType !== selectedTypeFilter) {
      return false;
    }

    if (selectedStatusFilter !== 'All' && m.status !== selectedStatusFilter) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = `${m.firstName} ${m.middleName || ''} ${m.lastName}`.toLowerCase();
    const code = (m.memberCode || '').toLowerCase();
    const cif = (m.cifNo || '').toLowerCase();
    const mobile = (m.mobileNo || '').toLowerCase();
    const village = (m.village || '').toLowerCase();
    const aadhaar = (m.aadhaarNo || '').toLowerCase();

    return name.includes(q) || code.includes(q) || cif.includes(q) || mobile.includes(q) || village.includes(q) || aadhaar.includes(q);
  });

  // KPI Calculations
  const totalMembersCount = members.length;
  const totalCapitalAllMembers = members.reduce((acc, curr) => acc + (curr.totalShareAmount || 0), 0);
  const totalSharesAllMembers = members.reduce((acc, curr) => acc + (curr.totalShareCount || 0), 0);
  const activeMembersCount = members.filter(m => m.status === 'Active').length;

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* 🌟 Top Sleek CBS Header Banner (Matching FD Opening Balance Migration) */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Award size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>सभासदत्व नोंदणी अर्ज</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Member Registration Application)</span>
              {editingId !== null && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.memberCode})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              महाराष्ट्र सहकारी संस्था अधिनियम, १९६० (MCS Act Sec 24 / Form I) नुसार नवीन सभासद अर्ज नोंदणी व संचालक मंडळ ठराव व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchMembers();
              setIsListModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व नोंदणीकृत सभासद यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदणीकृत सभासद यादी ({members.length})</span>
          </button>
        </div>
      </div>

      {/* 📊 Summary KPI Cards (Matching Theme) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण सभासद</div>
            <div className="text-sm font-black text-gray-900">{totalMembersCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण भाग भांडवल (₹)</div>
            <div className="text-sm font-black text-emerald-800">₹{totalCapitalAllMembers.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण वाटप शेअर्स</div>
            <div className="text-sm font-black text-indigo-950">{totalSharesAllMembers.toLocaleString('en-IN')} भाग</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय सभासद</div>
            <div className="text-sm font-black text-amber-800">{activeMembersCount} / {totalMembersCount}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* 📝 MAIN SINGLE UNIFIED APPLICATION FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          editingId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Customer Linkage & Branch */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">१. खातेदार निवड व शाखा (Customer Linkage & Branch)</h2>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">आधी खातेदार नोंदणी झाली असल्यास थेट शोधा व निवडा</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  नोंदणीकृत खातेदार निवडा (Search Customer by CIF / Name / Mobile / Aadhaar) <span className="text-red-500">*</span>
                </label>
                <CustomerSearchSelect
                  customers={customers}
                  value={selectedCustomerId}
                  onChange={handleCustomerSelect}
                  isDisabled={!!editingId}
                  placeholder="-- खातेदार शोधा व निवडा (उदा. CIF001066 / तुषार / 9876...) --"
                />
              </div>

              <div>
                <label className={labelClass}>शाखा (Branch) <span className="text-red-500">*</span></label>
                <select 
                  value={formData.branchID} 
                  onChange={e => setFormData(prev => ({ ...prev, branchID: Number(e.target.value) }))}
                  required
                  className={inputClass}
                >
                  {branches.map(b => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName} ({b.branchCode})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Verified Customer 360 Badge Preview Card */}
            {selectedCustomer && (
              <div className="mt-2.5 p-2.5 bg-primary/5 rounded border border-primary/20 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                    {selectedCustomer.photoPath ? (
                      <img src={selectedCustomer.photoPath} alt="Photo" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span>{selectedCustomer.firstName} {selectedCustomer.middleName} {selectedCustomer.lastName}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-black border border-emerald-300">
                        CIF: {selectedCustomer.cifNo}
                      </span>
                      {selectedCustomer.memberCode && !selectedCustomer.memberCode.startsWith('TEMP') && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-black flex items-center gap-1 shadow-2xs">
                          👑 विद्यमान सभासद क्र.: {selectedCustomer.memberCode}
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      📱 {selectedCustomer.mobileNo || 'मोबाईल नाही'} | 🪪 आधार: {selectedCustomer.aadhaarNo || '-'} | 💳 पॅन: {selectedCustomer.panNo || '-'}
                    </p>
                    <p className="text-[10px] text-slate-600 font-medium truncate max-w-md">
                      📍 {selectedCustomer.address || selectedCustomer.village || '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-1 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    केवायसी पडताळणी पूर्ण (KYC Verified)
                  </span>
                </div>
              </div>
            )}

            {/* Existing Member Alert Banner */}
            {isExistingMember && (
              <div className="mt-2.5 p-3 bg-amber-50 border-2 border-amber-400 rounded-sm flex items-start gap-2.5 shadow-2xs animate-in fade-in">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2">
                    <span>सदर खातेदार आधीच अधिकृत नोंदणीकृत सभासद आहेत (सभासद क्र.: {selectedCustomer?.memberCode})</span>
                    <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px] font-black border border-amber-400">
                      👑 विद्यमान सभासद (Existing Member)
                    </span>
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-1">
                    या खातेदाराचे सभासदत्व आणि भाग भांडवल वाटप (Share Allotment) आधीच मंजूर व पूर्ण झालेले आहे. खाली त्यांची विद्यमान नोंद केवळ पाहण्यासाठी (Read-only) दर्शविली आहे. नवीन सभासद अर्ज भरण्याची किंवा शेअर्स वाटप करण्याची आवश्यकता नाही.
                  </p>
                </div>
              </div>
            )}
          </div>

          <fieldset disabled={isExistingMember} className="space-y-3 disabled:opacity-85 border-0 p-0 m-0 min-w-0">

          {/* Section 2: Membership Classification */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">२. सभासदत्व तपशील व वर्गीकरण (Membership Classification - MCS Act Sec 24)</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>सभासद क्रमांक (Member Code) <span className="text-red-500">*</span></label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={formData.memberCode}
                    onChange={e => setFormData(prev => ({ ...prev, memberCode: e.target.value }))}
                    required
                    placeholder="उदा. MEM001050"
                    className={`${inputClass} font-mono font-bold text-primary`}
                  />
                  <button
                    type="button"
                    onClick={fetchNextMemberCode}
                    title="पुढील कोड रिफ्रेश करा"
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-gray-300 rounded-sm cursor-pointer shadow-2xs flex items-center justify-center h-[28px]"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-700" />
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>सभासद प्रकार (Membership Type - Sec 24) <span className="text-red-500">*</span></label>
                <select
                  value={formData.membershipType}
                  onChange={e => {
                    const mType = e.target.value;
                    setFormData(prev => ({ ...prev, membershipType: mType }));
                    if (mType === 'Nominal') {
                      setShareConfig(prev => ({ ...prev, numberOfShares: 0 }));
                    } else if (shareConfig.numberOfShares === 0) {
                      setShareConfig(prev => ({ ...prev, numberOfShares: 10 }));
                    }
                  }}
                  required
                  className={`${inputClass} font-bold text-primary`}
                >
                  <option value="Regular">नियमित सभासद (Regular Member - वर्ग 'अ')</option>
                  <option value="Associate">सह-सभासद (Associate Member - Sec 24(2))</option>
                  <option value="Nominal">नाममात्र सभासद (Nominal Member - Sec 24(1))</option>
                  <option value="Sympathizer">सहानुभूतीदार (Sympathizer)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>जुना / लेगसी सभासद क्र. (LF No)</label>
                <input
                  type="text"
                  value={formData.legacyMemberNo}
                  onChange={e => setFormData(prev => ({ ...prev, legacyMemberNo: e.target.value }))}
                  placeholder="उदा. LF-1234"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>सभासद स्थिती (Status) <span className="text-red-500">*</span></label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className={`${inputClass} font-bold`}
                >
                  <option value="Active">🟢 सक्रिय (Active)</option>
                  <option value="Inactive">🟡 निष्क्रिय (Inactive)</option>
                  <option value="Mayat">🔴 मयत (Deceased)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Board Resolution & Approval */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">३. संचालक मंडळ ठराव व मंजुरी (Board Resolution Details - MCS Act Compliance)</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>अर्ज दिनांक (Application Date) <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={resolutionData.applicationDate}
                  onChange={e => handleApplicationDateChange(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>ठराव क्रमांक (Resolution No) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={resolutionData.resolutionNo}
                  onChange={e => setResolutionData(prev => ({ ...prev, resolutionNo: e.target.value }))}
                  placeholder="उदा. ठराव क्र. 4/12"
                  className={`${inputClass} font-bold`}
                />
              </div>

              <div>
                <label className={labelClass}>ठराव दिनांक (Resolution Date) <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={resolutionData.resolutionDate}
                  min={resolutionData.applicationDate}
                  onChange={e => handleResolutionDateChange(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>सभासदत्व सुरू दिनांक (Joining Date) <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={resolutionData.joiningDate}
                  min={resolutionData.resolutionDate || resolutionData.applicationDate}
                  onChange={e => setResolutionData(prev => ({ ...prev, joiningDate: e.target.value }))}
                  required
                  className={`${inputClass} font-bold text-primary`}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Share Allotment, Fees & Payment Method */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">४. भाग भांडवल वाटप, प्रवेश शुल्क व भरणा तपशील (Share Allotment, Admission Fees & Payment Method)</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Row 1: Share Basic Allotment */}
              <div>
                <label className={labelClass}>वाटप तारीख (Date) <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={shareConfig.allotmentDate}
                  min={resolutionData.resolutionDate || resolutionData.applicationDate}
                  onChange={e => handleAllotmentDateChange(e.target.value)}
                  className={`${inputClass} font-bold`}
                />
              </div>

              <div>
                <label className={labelClass}>शेअर्स संख्या (Qty) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="उदा. 10"
                  value={shareConfig.numberOfShares}
                  onChange={e => {
                    const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                    setShareConfig(prev => ({ ...prev, numberOfShares: val }));
                  }}
                  className={`${inputClass} font-mono font-bold text-right text-primary`}
                />
                <span className="text-[10px] text-slate-500 font-semibold">(@ ₹{shareConfig.faceValue}/शेअर)</span>
              </div>

              <div>
                <label className={labelClass}>प्रति शेअर दर (Rate ₹)</label>
                <input
                  type="number"
                  readOnly
                  value={shareConfig.faceValue}
                  className={`${inputClass} font-mono text-right bg-slate-50 cursor-not-allowed`}
                />
              </div>

              <div>
                <label className={labelClass}>शेअर्स रक्कम (Share Capital ₹)</label>
                <input
                  type="text"
                  readOnly
                  value={`₹ ${shareCapitalAmount.toLocaleString('en-IN')}`}
                  className={`${inputClass} font-mono font-bold text-emerald-800 bg-emerald-50 text-right cursor-not-allowed border-emerald-300`}
                />
              </div>

              {/* Row 2: Auto-Calculated Share Range & Certificate No */}
              <div>
                <label className={labelClass}>
                  <span>शेअर्स नं. पासून (From Share No)</span>
                  <span className="text-[10px] text-blue-600 font-bold ml-1">[Auto]</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={hasShares ? autoFromShareNo : '-'}
                  className={`${inputClass} font-mono font-bold bg-slate-50 text-slate-800 text-center cursor-not-allowed border-slate-300`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>शेअर्स नं. पर्यंत (To Share No)</span>
                  <span className="text-[10px] text-blue-600 font-bold ml-1">[Auto]</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={hasShares ? autoToShareNo : '-'}
                  className={`${inputClass} font-mono font-bold bg-slate-50 text-slate-800 text-center cursor-not-allowed border-slate-300`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>
                  <span>सर्टिफिकेट नं. (Certificate No)</span>
                  <span className="text-[10px] text-blue-600 font-bold ml-1">[Auto]</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={hasShares ? autoCertificateNo : '-'}
                  className={`${inputClass} font-mono font-bold bg-slate-50 text-primary text-center cursor-not-allowed border-slate-300`}
                />
              </div>

              {/* Row 3: Fees & Total Amount */}
              <div>
                <label className={labelClass}>प्रवेश शुल्क (Admission Fee ₹) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  value={shareConfig.admissionFee}
                  onChange={e => setShareConfig(prev => ({ ...prev, admissionFee: parseFloat(e.target.value) || 0 }))}
                  className={`${inputClass} font-mono text-right`}
                />
              </div>

              <div>
                <label className={labelClass}>इमारत / कल्याण निधी (Fund ₹)</label>
                <input
                  type="number"
                  min="0"
                  value={shareConfig.buildingFund}
                  onChange={e => setShareConfig(prev => ({ ...prev, buildingFund: parseFloat(e.target.value) || 0 }))}
                  className={`${inputClass} font-mono text-right`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>एकूण देय रक्कम (Total Amount ₹)</label>
                <input
                  type="text"
                  readOnly
                  value={`₹ ${totalPayable.toLocaleString('en-IN')}`}
                  className={`${inputClass} font-mono font-bold text-primary bg-primary/10 text-right cursor-not-allowed border-primary/30 text-sm`}
                />
              </div>

              {/* Row 4: Payment Mode */}
              <div className="sm:col-span-2 md:col-span-4">
                <label className={labelClass}>भरणा प्रकार (Payment Mode) <span className="text-red-500">*</span></label>
                <select
                  value={shareConfig.paymentMode}
                  onChange={e => {
                    const newMode = e.target.value as 'Cash' | 'Transfer';
                    setShareConfig(prev => ({ ...prev, paymentMode: newMode }));
                    if (newMode === 'Transfer' && selectedCustomerId && customerSavingAccounts.length === 0 && !loadingSavingAccounts) {
                      fetchCustomerSavingAccounts(Number(selectedCustomerId));
                    }
                  }}
                  className={`${inputClass} font-bold max-w-sm`}
                >
                  <option value="Cash">💵 रोख भरणा (Cash Deposit)</option>
                  <option value="Transfer">🏦 बचत खात्यातून वर्ग (Transfer)</option>
                </select>
              </div>

              {/* Dynamic Customer Saving Account Dropdown when Transfer is selected */}
              {shareConfig.paymentMode === 'Transfer' && (
                <div className="sm:col-span-2 md:col-span-4 mt-1 p-2.5 bg-blue-50/60 rounded border border-blue-200 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 items-end">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>
                        खातेदाराचे बचत खाते निवडा (Select Customer's Saving Account) <span className="text-red-500">*</span>
                      </label>
                      {loadingSavingAccounts ? (
                        <div className="p-2 text-slate-500 text-xs font-semibold flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                          बचत खाती लोड होत आहेत...
                        </div>
                      ) : !selectedCustomerId ? (
                        <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded font-medium">
                          ℹ️ बचत खाते निवडण्यासाठी कृपया आधी खातेदार (Customer) निवडा.
                        </div>
                      ) : customerSavingAccounts.length > 0 ? (
                        <select
                          value={shareConfig.savingAccountId}
                          onChange={e => setShareConfig(prev => ({ ...prev, savingAccountId: e.target.value === '' ? '' : Number(e.target.value) }))}
                          required
                          className={`${inputClass} font-bold text-blue-900 bg-white`}
                        >
                          <option value="">-- बचत खाते निवडा (Select Account) --</option>
                          {customerSavingAccounts.map((acc: any) => {
                            const availBal = (acc.currentBalance || 0) - (acc.lienAmount || 0) - (acc.minimumBalance || 0);
                            return (
                              <option key={acc.savingAccountID} value={acc.savingAccountID}>
                                🏦 {acc.accountNo} - {acc.ledgerName || 'बचत ठेव'} | उपलब्ध शिल्लक: ₹{availBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({acc.status || 'Active'})
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded font-bold flex items-center gap-1.5">
                          <span>⚠️ या खातेदाराचे कोणतेही सक्रिय बचत खाते आढळले नाही. कृपया आधी खातेदाराचे बचत खाते उघडा किंवा '💵 रोख भरणा' पर्याय निवडा.</span>
                        </div>
                      )}
                    </div>

                    {/* Selected Account Balance Preview Badge */}
                    {shareConfig.savingAccountId && (
                      <div>
                        {(() => {
                          const selAcc = customerSavingAccounts.find((a: any) => a.savingAccountID === Number(shareConfig.savingAccountId));
                          if (!selAcc) return null;
                          const availBal = (selAcc.currentBalance || 0) - (selAcc.lienAmount || 0) - (selAcc.minimumBalance || 0);
                          const isShort = totalPayable > 0 && availBal < totalPayable;
                          return (
                            <div className={`p-2 rounded border text-xs ${isShort ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'}`}>
                              <div className="flex justify-between items-center font-bold">
                                <span>उपलब्ध शिल्लक:</span>
                                <span className="font-mono text-sm">₹{availBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              {isShort && (
                                <div className="text-[10px] font-bold text-rose-700 mt-0.5">
                                  ⚠️ अपुरी शिल्लक! देय: ₹{totalPayable.toLocaleString('en-IN')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Proposer & Seconder */}
          <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
            <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">५. सुचक व अनुमोदक सभासद (Proposer & Seconder)</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className={labelClass}>सुचक सभासद (Proposer Member)</label>
                <select
                  value={resolutionData.proposerMemberID}
                  onChange={e => setResolutionData(prev => ({ ...prev, proposerMemberID: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">-- विद्यमान सुचक सभासद निवडा --</option>
                  {members.map(m => (
                    <option key={m.memberID} value={m.memberID}>
                      [{m.memberCode}] {m.firstName} {m.lastName} ({m.village || '-'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>अनुमोदक सभासद (Seconder Member)</label>
                <select
                  value={resolutionData.seconderMemberID}
                  onChange={e => setResolutionData(prev => ({ ...prev, seconderMemberID: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">-- विद्यमान अनुमोदक सभासद निवडा --</option>
                  {members.map(m => (
                    <option key={m.memberID} value={m.memberID}>
                      [{m.memberCode}] {m.firstName} {m.lastName} ({m.village || '-'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          </fieldset>

          {/* Form Action Buttons (Matching CBS Layout) */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{editingId !== null ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            {isExistingMember ? (
              <div className="px-4 py-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-sm font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>👑 विद्यमान सभासद - अर्ज व भाग वाटप आधीच मंजूर आहे</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className={`px-6 py-2 ${
                  editingId !== null ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
                } text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>{saving ? 'जतन होत आहे...' : (editingId !== null ? '✏️ सभासद माहिती अपडेट करा' : '💾 सभासदत्व अर्ज जतन करा')}</span>
              </button>
            )}
          </div>

        </form>
      </div>

      {/* 👥 REGISTERED SHAREHOLDER MEMBERS LIST MODAL */}
      {isListModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded shadow-2xl max-w-6xl w-full h-[88vh] flex flex-col overflow-hidden border border-slate-300">
            
            {/* Modal Top Ribbon */}
            <div className="px-4 py-2.5 bg-primary text-white flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-300" />
                <div>
                  <span className="font-bold text-sm">नोंदणीकृत सभासद यादी (Registered Shareholder Members: {members.length})</span>
                  <p className="text-[10px] text-blue-100 font-normal">संस्थेचे अधिकृत भागधारक सभासद व शेअर्स तपशील (Form 'I' / Register of Members)</p>
                </div>
              </div>
              <button onClick={() => setIsListModalOpen(false)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2.5 shrink-0">
              
              {/* Type Tabs */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('All')}
                  className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${selectedTypeFilter === 'All' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  सर्व सभासद ({members.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('Regular')}
                  className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${selectedTypeFilter === 'Regular' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  नियमित ('अ')
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('Associate')}
                  className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${selectedTypeFilter === 'Associate' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  सह-सभासद ('ब')
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('Nominal')}
                  className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${selectedTypeFilter === 'Nominal' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  नाममात्र ('क')
                </button>
              </div>

              {/* Status Select & Search */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="border border-slate-300 rounded px-2.5 py-1 text-[11px] bg-white font-bold outline-none h-[28px]"
                >
                  <option value="All">सर्व स्थिती (All Status)</option>
                  <option value="Active">🟢 सक्रिय (Active)</option>
                  <option value="Inactive">🟡 निष्क्रिय (Inactive)</option>
                  <option value="Mayat">🔴 मयत (Deceased)</option>
                </select>

                {/* Instant Search Box */}
                <div className="relative min-w-[240px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="सभासद कोड, CIF, नाव, मोबाईल..."
                    className="w-full pl-8 pr-3 py-1 border border-slate-300 rounded text-[11px] focus:ring-1 focus:ring-primary focus:border-primary outline-none h-[28px]"
                  />
                </div>
              </div>

            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto p-2">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0 font-bold z-10">
                    <th className="p-2">सभासद क्र.</th>
                    <th className="p-2">CIF कोड</th>
                    <th className="p-2">सभासदाचे पूर्ण नाव</th>
                    <th className="p-2">प्रकार</th>
                    <th className="p-2 text-right">शेअर्स</th>
                    <th className="p-2 text-right">भाग भांडवल (₹)</th>
                    <th className="p-2">मोबाईल व गाव</th>
                    <th className="p-2 text-center">स्थिती</th>
                    <th className="p-2 text-center">कृती</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(m => (
                    <tr key={m.memberID} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="p-2 font-black text-primary flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>{m.memberCode}</span>
                      </td>
                      <td className="p-2 font-bold text-slate-600">{m.cifNo || '-'}</td>
                      <td className="p-2 font-bold text-slate-800">
                        <div>
                          <span>{m.firstName} {m.middleName} {m.lastName}</span>
                          {m.nickName && <span className="text-[10px] text-slate-400 font-normal ml-1">({m.nickName})</span>}
                        </div>
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          m.membershipType === 'Regular' 
                            ? 'bg-blue-50 text-blue-900 border-blue-200' 
                            : m.membershipType === 'Associate'
                            ? 'bg-purple-50 text-purple-900 border-purple-200'
                            : 'bg-slate-50 text-slate-800 border-slate-200'
                        }`}>
                          {m.membershipType === 'Regular' ? 'नियमित (वर्ग अ)' : (m.membershipType === 'Associate' ? 'सह-सभासद (वर्ग ब)' : (m.membershipType === 'Nominal' ? 'नाममात्र (वर्ग क)' : m.membershipType))}
                        </span>
                      </td>
                      <td className="p-2 text-right font-black text-emerald-800">
                        {m.totalShareCount || 0}
                      </td>
                      <td className="p-2 text-right font-black text-slate-800">
                        ₹{(m.totalShareAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-2 text-slate-600">
                        <div className="font-medium text-slate-700">{m.mobileNo || '-'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{m.village || m.address || '-'}</div>
                      </td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEdit(m)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded transition cursor-pointer"
                            title="एडिट करा"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setPreviewCertModal({ 
                              isOpen: true, 
                              memberId: m.memberID, 
                              memberName: `${m.firstName} ${m.lastName}`,
                              certNo: m.latestCertificateNo || `CERT-${m.memberCode}`,
                              shares: m.totalShareCount || 10,
                              amount: m.totalShareAmount || 1000
                            })}
                            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                            title="भाग दाखला (Share Certificate)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.memberID)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="डिलीट करा"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-slate-400">
                        <Award className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-600" />
                        <p className="font-semibold">कोणताही नोंदणीकृत सभासद सापडला नाही.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Bottom Summary Bar */}
            <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs text-slate-600 shrink-0">
              <span className="font-bold">
                एकूण दर्शवलेले सभासद: {filteredMembers.length}
              </span>
              <span className="font-semibold text-primary">
                एकूण भाग भांडवल: ₹{filteredMembers.reduce((acc, curr) => acc + (curr.totalShareAmount || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>

          </div>
        </div>
      )}

      {/* SHARE CERTIFICATE PREVIEW MODAL */}
      {previewCertModal?.isOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-3 bg-primary text-white flex justify-between items-center">
              <span className="font-bold text-sm">भाग दाखला प्रिव्ह्यू - {previewCertModal.memberName}</span>
              <button onClick={() => setPreviewCertModal(null)} className="text-white hover:text-red-200 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-slate-100 flex items-center justify-center">
              <ShareCertificatePreview 
                certificate={{
                  certificateId: 1,
                  certificateNo: previewCertModal.certNo || 'CERT-AUTO',
                  issueDate: new Date().toISOString(),
                  memberName: previewCertModal.memberName,
                  memberNo: String(previewCertModal.memberId),
                  fromShareNo: 1,
                  toShareNo: previewCertModal.shares || 10,
                  numberOfShares: previewCertModal.shares || 10,
                  faceValue: 100,
                  totalAmount: previewCertModal.amount || 1000,
                  status: 'Active',
                  printCount: 1
                }}
                onClose={() => setPreviewCertModal(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* DECEASED CLAIM SETTLEMENT MODAL */}
      {isDeceasedModalOpen && (
        <DeceasedClaimSettlementModal
          isOpen={isDeceasedModalOpen}
          memberId={selectedDeceasedMemberId}
          onClose={() => setIsDeceasedModalOpen(false)}
          onSettled={() => {
            setIsDeceasedModalOpen(false);
            fetchMembers();
          }}
        />
      )}

      {/* 🌟 NEW MEMBER REGISTRATION & SHARE ALLOTMENT SUCCESS MODAL */}
      {newRegisteredMember && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-md shadow-2xl max-w-lg w-full overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-primary text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <span className="font-bold text-sm">सभासद व शेअर्स वाटप माहिती (Member & Share Details)</span>
              </div>
              <button
                onClick={() => setNewRegisteredMember(null)}
                className="text-white/80 hover:text-white cursor-pointer font-bold text-base"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs space-y-2.5 text-emerald-950">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs pb-1.5 border-b border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>नवीन सभासद नोंदणी व भाग भांडवल वाटप यशस्वीरित्या पूर्ण झाले आहे!</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/80 p-2 rounded border border-emerald-200">
                    <span className="text-[10px] text-slate-500 font-medium block">सभासद कोड (Member Code)</span>
                    <strong className="text-primary font-bold text-sm">{newRegisteredMember.memberCode}</strong>
                  </div>
                  <div className="bg-white/80 p-2 rounded border border-emerald-200">
                    <span className="text-[10px] text-slate-500 font-medium block">सभासद क्रमांक (Member ID)</span>
                    <strong className="text-slate-800 font-bold text-sm">#{newRegisteredMember.memberId}</strong>
                  </div>
                  <div className="col-span-2 bg-white/80 p-2 rounded border border-emerald-200">
                    <span className="text-[10px] text-slate-500 font-medium block">सभासदाचे नाव (Member Name)</span>
                    <strong className="text-slate-900 font-bold">{newRegisteredMember.memberName}</strong>
                  </div>

                  {newRegisteredMember.sharesCount && newRegisteredMember.sharesCount > 0 ? (
                    <>
                      <div className="bg-white/80 p-2 rounded border border-emerald-200">
                        <span className="text-[10px] text-slate-500 font-medium block">वाटप शेअर्स (Shares Allotted)</span>
                        <strong className="text-emerald-800 font-bold">
                          {newRegisteredMember.sharesCount} शेअर्स (₹{newRegisteredMember.shareAmount?.toLocaleString('en-IN')})
                        </strong>
                      </div>
                      <div className="bg-white/80 p-2 rounded border border-emerald-200">
                        <span className="text-[10px] text-slate-500 font-medium block">शेअर्स नंबर श्रेणी (Share Numbers)</span>
                        <strong className="font-mono text-slate-800 font-bold">
                          {newRegisteredMember.fromShareNo} ते {newRegisteredMember.toShareNo}
                        </strong>
                      </div>
                      <div className="col-span-2 bg-white/80 p-2 rounded border border-emerald-200">
                        <span className="text-[10px] text-slate-500 font-medium block">भाग दाखला क्रमांक (Certificate No)</span>
                        <strong className="font-mono text-primary font-bold">{newRegisteredMember.certNo}</strong>
                      </div>
                    </>
                  ) : null}

                  {newRegisteredMember.voucherNo && (
                    <div className="col-span-2 bg-emerald-100/90 border border-emerald-300 rounded p-2 text-xs text-emerald-950 font-bold flex items-center justify-between">
                      <span>🧾 पावती क्र.: <strong className="font-mono text-primary">{newRegisteredMember.voucherNo}</strong></span>
                      <span className="text-emerald-800">एकूण रक्कम: ₹{newRegisteredMember.feeAmount?.toLocaleString('en-IN')} (Day Book जमा ✅)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setNewRegisteredMember(null);
                    setIsListModalOpen(true);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4 text-slate-600" />
                  <span>नोंदणीकृत सभासद यादी पहा</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewRegisteredMember(null)}
                  className="px-5 py-2 bg-primary hover:opacity-95 text-white rounded font-bold text-xs cursor-pointer shadow-xs"
                >
                  नवीन अर्ज भरा (New Application)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
