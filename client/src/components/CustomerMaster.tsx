import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Search, X, Edit, Trash2, UserPlus, UserCheck, MapPin, FileText, Camera, 
  Check, Eye, RefreshCw, UserCheck2, ShieldAlert, Download, CreditCard, Sparkles, 
  Inbox, CheckCircle2, Clock, XCircle, AlertCircle, Plus, Phone, Calendar, 
  Layers, UploadCloud, Maximize2, ShieldCheck, FileBadge, RotateCcw, Award, CheckSquare,
  Building2, BookOpen, FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getLockedBranchId, isHeadOfficeUser, resolveWriteBranchId } from '../utils/branchAccess';
import { transliterateMarathi } from '../utils/transliterateMarathi';
import { isValidAadhaar, isValidPAN, maskAadhaar } from '../utils/kycValidation';
import DeceasedClaimSettlementModal from './DeceasedClaimSettlementModal';
import CustomerBulkEntry from './CustomerBulkEntry';
import DoorstepPermissionsModal from './DoorstepPermissionsModal';

interface Customer {
  customerID: number;
  branchID: number;
  branch?: {
    branchName: string;
    branchCode: string;
  };
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
  registrationDate: string;
  nomineeName?: string;
  nomineeNameEng?: string;
  nomineeRelation?: string;
  nomineeAddress?: string;
  nomineeBirthDate?: string;
  nomineeIsMinor?: boolean;
  nomineeGuardianName?: string;
  status: string;
  gender?: string;
  birthDate?: string;
  occupation?: string;
  casteCategory?: string;
  caste?: string;
  email?: string;
  isMinor?: boolean;
  guardianName?: string;
  guardianNameEng?: string;
  guardianRelation?: string;
  guardianAadhaarNo?: string;
  guardianMobileNo?: string;
  guardianAddress?: string;
  photoPath?: string;
  signaturePath?: string;
  aadhaarDocPath?: string;
  panDocPath?: string;
  employerId?: number;
  employeeCode?: string;
  legacyCustomerNo?: string;
  customerType?: string;
  kycStatus?: string;
  riskCategory?: string;
  ckycNo?: string;
}

interface Branch {
  branchID: number;
  branchCode: string;
  branchName: string;
}

export default function CustomerMaster({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employers, setEmployers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [directoryPage, setDirectoryPage] = useState<number>(1);
  const [directoryPageSize, setDirectoryPageSize] = useState<number>(50);
  const [directorySortDir, setDirectorySortDir] = useState<'asc' | 'desc'>('asc');
  const [directoryTotalCount, setDirectoryTotalCount] = useState<number>(0);
  const [directoryLoading, setDirectoryLoading] = useState<boolean>(false);
  const [customerStats, setCustomerStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    kycCompleteCustomers: 0,
    lastLegacyCustomerNo: '',
    nextLegacyCustomerNo: ''
  });
  const [legacyDuplicate, setLegacyDuplicate] = useState<{
    customerID: number;
    cifNo: string;
    firstName: string;
    lastName: string;
    legacyCustomerNo?: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isBulkEntryOpen, setIsBulkEntryOpen] = useState(false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [signUploading, setSignUploading] = useState(false);
  const [aadhaarUploading, setAadhaarUploading] = useState(false);
  const [panUploading, setPanUploading] = useState(false);

  // Agent Customer Requests & Simultaneous Pigmy States
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [loadedAgentName, setLoadedAgentName] = useState<string>('');
  
  const [pigmySchemes, setPigmySchemes] = useState<any[]>([]);
  const [pigmyAgents, setPigmyAgents] = useState<any[]>([]);
  const [pigmyFormData, setPigmyFormData] = useState({
    openPigmyAccount: false,
    pigmySchemeID: '',
    pigmyAgentID: '',
    dailyDepositAmount: 100,
    initialDepositAmount: 0
  });

  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; requestId: number | null; reason: string }>({
    isOpen: false,
    requestId: null,
    reason: ''
  });

  // Doorstep Multi-Product & Privacy Permissions Modal State
  const [doorstepModal, setDoorstepModal] = useState<{ isOpen: boolean; customerId: number; customerName: string }>({
    isOpen: false,
    customerId: 0,
    customerName: ''
  });

  // KYC Compulsory Toggles
  const [isMobileCompulsory, setIsMobileCompulsory] = useState<boolean>(false);
  const [isAadhaarCompulsory, setIsAadhaarCompulsory] = useState<boolean>(false);
  const [isPanCompulsory, setIsPanCompulsory] = useState<boolean>(false);

  // Document Zoom / Full Preview Modal State
  const [previewDocModal, setPreviewDocModal] = useState<{ isOpen: boolean; title: string; docUrl: string } | null>(null);

  // Live Camera Modal State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'signature' | 'aadhaarDoc' | 'panDoc'>('photo');
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const legacyCustomerNoInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef<boolean>(true);

  // Persistent / Sticky Registration Date (खाते सुरू दिनांक) across form saves & resets
  const [stickyRegistrationDate, setStickyRegistrationDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [formData, setFormData] = useState({
    branchID: resolveWriteBranchId(user, localStorage.getItem('globalBranchId')),
    cifNo: '',
    legacyCustomerNo: '',
    firstName: '',
    middleName: '',
    lastName: '',
    nickName: '',
    firstNameEng: '',
    middleNameEng: '',
    lastNameEng: '',
    address: '',
    addressEng: '',
    village: '',
    taluka: '',
    district: '',
    mobileNo: '',
    email: '',
    aadhaarNo: '',
    panNo: '',
    registrationDate: new Date().toISOString().split('T')[0],
    nomineeName: '',
    nomineeNameEng: '',
    nomineeRelation: '',
    nomineeAddress: '',
    nomineeBirthDate: '',
    nomineeIsMinor: false,
    nomineeGuardianName: '',
    status: 'Active',
    gender: '',
    birthDate: '',
    occupation: '',
    casteCategory: '',
    caste: '',
    isMinor: false,
    guardianName: '',
    guardianNameEng: '',
    guardianRelation: '',
    guardianAadhaarNo: '',
    guardianMobileNo: '',
    guardianAddress: '',
    photoPath: '',
    signaturePath: '',
    aadhaarDocPath: '',
    panDocPath: '',
    employerId: '',
    employeeCode: '',
    customerType: 'Individual',
    kycStatus: 'Verified',
    riskCategory: 'Low',
    ckycNo: ''
  });

  const [sansthaDefaults, setSansthaDefaults] = useState({
    address: '',
    village: '',
    taluka: '',
    district: ''
  });

  const [isDeceasedModalOpen, setIsDeceasedModalOpen] = useState(false);
  const [selectedDeceasedCustomerId, setSelectedDeceasedCustomerId] = useState<number>(0);

  const API_URL = '/api/Customers';
  const BRANCH_API_URL = '/api/Branches';

  const getAuthHeaders = (): Record<string, string> => {
    const token = user?.token || localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchNextCif();
    fetchBranches();
    fetchEmployers();
    fetchSansthaDetails();
    fetchPendingAgentRequests();
    fetchPigmyDependencies();

    setTimeout(() => {
      legacyCustomerNoInputRef.current?.focus();
    }, 200);

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounce directory search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setDirectoryPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch paginated directory only when the modal is open
  useEffect(() => {
    if (isListModalOpen) {
      fetchCustomers(directoryPage, directoryPageSize, debouncedSearchQuery, directorySortDir);
    }
  }, [isListModalOpen, directoryPage, directoryPageSize, debouncedSearchQuery, directorySortDir]);

  // Debounced server-side duplicate check for legacyCustomerNo
  useEffect(() => {
    const trimmed = formData.legacyCustomerNo?.trim();
    if (!trimmed) {
      setLegacyDuplicate(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ legacyNo: trimmed });
        if (editingId !== null) {
          params.set('excludeId', String(editingId));
        }
        const res = await fetch(`${API_URL}/check-legacy?${params.toString()}`, {
          headers: getAuthHeaders()
        });
        if (res.ok && isMountedRef.current) {
          const data = await res.json();
          setLegacyDuplicate(data.exists && data.customer ? data.customer : null);
        }
      } catch (err) {
        console.error('Error checking legacy duplicate:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.legacyCustomerNo, editingId]);

  const fetchNextCif = async (updateFormCif: boolean = true) => {
    try {
      const response = await fetch(`${API_URL}/next-cif`, { headers: getAuthHeaders() });
      if (response.ok && isMountedRef.current) {
        const text = await response.text();
        let generatedCif = '';
        let suggestedLegacyNo = '';
        try {
          const parsed = JSON.parse(text);
          generatedCif = parsed.nextCifNo || parsed.cifNo || (typeof parsed === 'string' ? parsed : '');
          if (typeof parsed === 'object' && parsed !== null) {
            suggestedLegacyNo = parsed.nextLegacyCustomerNo ? String(parsed.nextLegacyCustomerNo) : '';
            setCustomerStats({
              totalCustomers: Number(parsed.totalCustomers ?? parsed.totalActiveCustomers ?? 0),
              activeCustomers: Number(parsed.activeCustomers ?? parsed.totalActiveCustomers ?? 0),
              kycCompleteCustomers: Number(parsed.kycCompleteCustomers ?? 0),
              lastLegacyCustomerNo: parsed.lastLegacyCustomerNo ? String(parsed.lastLegacyCustomerNo) : '',
              nextLegacyCustomerNo: suggestedLegacyNo
            });
          }
        } catch {
          generatedCif = text.replace(/^"|"$/g, '').trim();
        }

        if (updateFormCif && isMountedRef.current) {
          setFormData(prev => ({
            ...prev,
            cifNo: (generatedCif && typeof generatedCif === 'string') ? generatedCif : prev.cifNo,
            legacyCustomerNo: suggestedLegacyNo || prev.legacyCustomerNo
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching next CIF:', error);
    }
  };

  const fetchCustomers = async (
    page: number = directoryPage,
    pageSize: number = directoryPageSize,
    search: string = debouncedSearchQuery,
    sortDir: 'asc' | 'desc' = directorySortDir
  ) => {
    try {
      setDirectoryLoading(true);
      const effectivePageSize = pageSize <= 0 ? 10000 : pageSize;
      const effectivePage = pageSize <= 0 ? 1 : page;
      const params = new URLSearchParams({
        page: String(effectivePage),
        pageSize: String(effectivePageSize),
        sortDir: sortDir
      });
      if (search) {
        params.set('search', search);
      }
      const response = await fetch(`${API_URL}?${params.toString()}`, { headers: getAuthHeaders() });
      if (response.ok && isMountedRef.current) {
        const totalHeader = response.headers.get('X-Total-Count');
        const data = await response.json();
        const rows = Array.isArray(data) ? data : [];
        setCustomers(rows);
        if (totalHeader !== null && Number(totalHeader) > 0) {
          setDirectoryTotalCount(Number(totalHeader));
        } else if (!search && customerStats.totalCustomers > rows.length) {
          setDirectoryTotalCount(customerStats.totalCustomers);
        } else {
          setDirectoryTotalCount(rows.length);
        }
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      if (isMountedRef.current) {
        setDirectoryLoading(false);
      }
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch(BRANCH_API_URL, { headers: getAuthHeaders() });
      if (response.ok && isMountedRef.current) {
        const data = await response.json();
        const branchList = Array.isArray(data) ? data : [];
        setBranches(branchList);
        if (branchList.length > 0 && !formData.branchID) {
          setFormData(prev => ({ ...prev, branchID: branchList[0].branchID }));
        }
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchEmployers = async () => {
    try {
      const response = await fetch('/api/Employers', { headers: getAuthHeaders() });
      if (response.ok && isMountedRef.current) {
        const data = await response.json();
        setEmployers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching employers:', error);
    }
  };

  const fetchSansthaDetails = async () => {
    try {
      const response = await fetch('/api/SansthaDetails', { headers: getAuthHeaders() });
      if (response.ok && isMountedRef.current) {
        const rawData = await response.json();
        const data = Array.isArray(rawData) ? rawData[0] : rawData;
        if (data) {
          const defaults = {
            address: data.address || '',
            village: data.village || data.city || '',
            taluka: data.taluka || '',
            district: data.district || ''
          };
          setSansthaDefaults(defaults);
          setFormData(prev => ({
            ...prev,
            address: prev.address || defaults.address,
            village: prev.village || defaults.village,
            taluka: prev.taluka || defaults.taluka,
            district: prev.district || defaults.district
          }));

          if (data.isMobileCompulsory !== undefined) setIsMobileCompulsory(Boolean(data.isMobileCompulsory));
          if (data.isAadhaarCompulsory !== undefined) setIsAadhaarCompulsory(Boolean(data.isAadhaarCompulsory));
          if (data.isPanCompulsory !== undefined) setIsPanCompulsory(Boolean(data.isPanCompulsory));
        }
      }
    } catch (error) {
      console.error('Error fetching sanstha details:', error);
    }
  };

  const fetchPendingAgentRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await fetch('/api/AgentCustomerRequests/pending', { headers: getAuthHeaders() });
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        setPendingRequests(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error fetching agent requests", e);
    } finally {
      if (isMountedRef.current) setLoadingRequests(false);
    }
  };

  const fetchPigmyDependencies = async () => {
    try {
      const [schemesRes, agentsRes] = await Promise.all([
        fetch('/api/PigmySchemes', { headers: getAuthHeaders() }),
        fetch('/api/PigmyAgents', { headers: getAuthHeaders() })
      ]);
      if (schemesRes.ok && isMountedRef.current) {
        const data = await schemesRes.json();
        setPigmySchemes(Array.isArray(data) ? data : []);
      }
      if (agentsRes.ok && isMountedRef.current) {
        const data = await agentsRes.json();
        setPigmyAgents(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error fetching pigmy schemes/agents", e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'photo' | 'signature' | 'aadhaarDoc' | 'panDoc') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setUploading = 
      fieldName === 'photo' ? setPhotoUploading :
      fieldName === 'signature' ? setSignUploading :
      fieldName === 'aadhaarDoc' ? setAadhaarUploading : setPanUploading;

    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    setUploading(true);
    try {
      const response = await fetch('/api/Customers/upload', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: uploadFormData
      });

      if (response.ok) {
        const data = await response.json();
        const targetPathKey = 
          fieldName === 'photo' ? 'photoPath' :
          fieldName === 'signature' ? 'signaturePath' :
          fieldName === 'aadhaarDoc' ? 'aadhaarDocPath' : 'panDocPath';

        setFormData(prev => ({
          ...prev,
          [targetPathKey]: data.filePath || data.url || data.path
        }));
      } else {
        alert("फाईल अपलोड अयशस्वी झाली.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("सर्व्हरशी संपर्क साधताना एरर आली.");
    } finally {
      setUploading(false);
    }
  };

  // Live Camera Handlers
  const startCamera = async (mode: 'photo' | 'signature' | 'aadhaarDoc' | 'panDoc') => {
    setCameraMode(mode);
    setCapturedDataUrl(null);
    setIsCameraModalOpen(true);

    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("कॅमेरा चालू करता आला नाही. कृपया कॅमेरा परवानगी तपासा.");
      setIsCameraModalOpen(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraModalOpen(false);
    setCapturedDataUrl(null);
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedDataUrl(dataUrl);
    }
  };

  const saveCapturedImage = async () => {
    if (!capturedDataUrl) return;
    setIsCapturing(true);

    try {
      const res = await fetch(capturedDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${cameraMode}_${Date.now()}.jpg`, { type: 'image/jpeg' });

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/Customers/upload', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: uploadFormData
      });

      if (response.ok) {
        const data = await response.json();
        const uploadedPath = data.filePath || data.url || data.path;
        const targetPathKey = 
          cameraMode === 'photo' ? 'photoPath' :
          cameraMode === 'signature' ? 'signaturePath' :
          cameraMode === 'aadhaarDoc' ? 'aadhaarDocPath' : 'panDocPath';

        setFormData(prev => ({
          ...prev,
          [targetPathKey]: uploadedPath
        }));
        stopCamera();
      } else {
        alert("कॅमेरा फोटो सेव्ह करता आला नाही.");
      }
    } catch (e) {
      console.error("Camera upload error", e);
      alert("फोटो अपलोड करताना एरर आली.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === 'registrationDate') {
      setStickyRegistrationDate(value);
    }

    if (name === 'firstName') {
      const transliterated = transliterateMarathi(value);
      setFormData(prev => ({
        ...prev,
        firstName: value,
        firstNameEng: transliterated
      }));
      return;
    }

    if (name === 'middleName') {
      const transliterated = transliterateMarathi(value);
      setFormData(prev => ({
        ...prev,
        middleName: value,
        middleNameEng: transliterated
      }));
      return;
    }

    if (name === 'lastName') {
      const transliterated = transliterateMarathi(value);
      setFormData(prev => ({
        ...prev,
        lastName: value,
        lastNameEng: transliterated
      }));
      return;
    }

    if (name === 'nomineeName') {
      const transliterated = transliterateMarathi(value);
      setFormData(prev => ({
        ...prev,
        nomineeName: value,
        nomineeNameEng: transliterated
      }));
      return;
    }

    if (name === 'guardianName') {
      const transliterated = transliterateMarathi(value);
      setFormData(prev => ({
        ...prev,
        guardianName: value,
        guardianNameEng: transliterated
      }));
      return;
    }

    if (name === 'aadhaarNo') {
      const cleanAadhaar = value.replace(/\D/g, '').slice(0, 12);
      setFormData(prev => ({
        ...prev,
        aadhaarNo: cleanAadhaar
      }));
      return;
    }

    if (name === 'panNo') {
      const cleanPan = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      setFormData(prev => ({
        ...prev,
        panNo: cleanPan
      }));
      return;
    }

    if (name === 'ckycNo') {
      const cleanCkyc = value.replace(/\D/g, '').slice(0, 14);
      setFormData(prev => ({
        ...prev,
        ckycNo: cleanCkyc
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
      alert("कृपया खातेदाराचे पहिले नाव आणि आडनाव भरा.");
      return;
    }

    if (formData.legacyCustomerNo && formData.legacyCustomerNo.trim()) {
      const trimmedLegacy = formData.legacyCustomerNo.trim();
      if (legacyDuplicate && legacyDuplicate.customerID !== editingId) {
        alert(`हा जुना खातेदार आयडी (${formData.legacyCustomerNo}) आधीच खातेदार '${legacyDuplicate.firstName} ${legacyDuplicate.lastName}' (CIF: ${legacyDuplicate.cifNo}) साठी नोंदवला आहे.`);
        legacyCustomerNoInputRef.current?.focus();
        return;
      }
      try {
        const params = new URLSearchParams({ legacyNo: trimmedLegacy });
        if (editingId !== null) params.set('excludeId', String(editingId));
        const checkRes = await fetch(`${API_URL}/check-legacy?${params.toString()}`, { headers: getAuthHeaders() });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.exists && checkData.customer) {
            alert(`हा जुना खातेदार आयडी (${formData.legacyCustomerNo}) आधीच खातेदार '${checkData.customer.firstName} ${checkData.customer.lastName}' (CIF: ${checkData.customer.cifNo}) साठी नोंदवला आहे.`);
            legacyCustomerNoInputRef.current?.focus();
            return;
          }
        }
      } catch (err) {
        console.error('Error verifying legacy ID before submit:', err);
      }
    }

    if (isMobileCompulsory && !formData.mobileNo?.trim()) {
      alert("मोबाईल नंबर अनिवार्य आहे.");
      return;
    }

    if (formData.aadhaarNo && formData.aadhaarNo.trim()) {
      const aadhaarCheck = isValidAadhaar(formData.aadhaarNo);
      if (!aadhaarCheck.isValid) {
        alert(`आधार क्रमांक अमान्य: ${aadhaarCheck.error}`);
        return;
      }
    } else if (isAadhaarCompulsory) {
      alert("आधार नंबर अनिवार्य आहे.");
      return;
    }

    if (formData.panNo && formData.panNo.trim()) {
      const panCheck = isValidPAN(formData.panNo);
      if (!panCheck.isValid) {
        alert(`पॅन क्रमांक अमान्य: ${panCheck.error}`);
        return;
      }
    } else if (isPanCompulsory) {
      alert("पॅन नंबर अनिवार्य आहे.");
      return;
    }

    const payload: any = {
      ...formData,
      branchID: Number(formData.branchID),
      employerId: formData.employerId ? Number(formData.employerId) : null,
      employeeCode: formData.employeeCode ? formData.employeeCode.trim() : null,
      birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
      registrationDate: formData.registrationDate ? new Date(formData.registrationDate).toISOString() : new Date().toISOString(),
      nomineeBirthDate: formData.nomineeBirthDate ? new Date(formData.nomineeBirthDate).toISOString() : null,
      isMinor: Boolean(formData.isMinor),
      nomineeIsMinor: Boolean(formData.nomineeIsMinor)
    };

    try {
      if (selectedRequestId) {
        const approvePayload = {
          customerData: payload,
          pigmyData: {
            openPigmyAccount: pigmyFormData.openPigmyAccount,
            pigmySchemeID: pigmyFormData.pigmySchemeID ? Number(pigmyFormData.pigmySchemeID) : null,
            pigmyAgentID: pigmyFormData.pigmyAgentID ? Number(pigmyFormData.pigmyAgentID) : null,
            dailyDepositAmount: Number(pigmyFormData.dailyDepositAmount || 100),
            openingBalance: Number(pigmyFormData.initialDepositAmount || 0)
          }
        };

        const res = await fetch(`/api/AgentCustomerRequests/${selectedRequestId}/approve-and-create`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(approvePayload)
        });

        if (res.ok) {
          const resData = await res.json();
          alert(`नवीन खातेदार आणि पिग्मी खाते यशस्वीरित्या तयार झाले.\nCIF: ${resData.cifNo}\nPigmy A/c: ${resData.pigmyAccountNo || 'N/A'}`);
          resetForm();
          if (isListModalOpen) fetchCustomers(directoryPage, directoryPageSize, debouncedSearchQuery);
          fetchPendingAgentRequests();
          setTimeout(() => legacyCustomerNoInputRef.current?.focus(), 100);
        } else {
          let errorMsg = 'जतन करता आले नाही.';
          try {
            const text = await res.text();
            try {
              const err = JSON.parse(text);
              errorMsg = err.message || err.title || (typeof err === 'string' ? err : text);
            } catch { errorMsg = text || res.statusText; }
          } catch { errorMsg = res.statusText; }
          alert(`त्रुटी: ${errorMsg}`);
        }
        return; // EXIT HERE so standard logic is skipped entirely
      }

      let response;
      if (editingId !== null) {
        response = await fetch(`${API_URL}/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ ...payload, customerID: editingId })
        });
      } else {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
        let savedCustomer: any = {};
        try {
          savedCustomer = await response.json();
        } catch {
          savedCustomer = {};
        }
        const targetCustomerId = (editingId !== null) ? editingId : savedCustomer.customerID;

        // If open pigmy account was selected
        if (pigmyFormData.openPigmyAccount && pigmyFormData.pigmySchemeID && pigmyFormData.pigmyAgentID) {
          try {
            const pigmyPayload = {
              customerID: targetCustomerId,
              branchID: Number(formData.branchID),
              pigmySchemeID: Number(pigmyFormData.pigmySchemeID),
              pigmyAgentID: Number(pigmyFormData.pigmyAgentID),
              dailyDepositAmount: Number(pigmyFormData.dailyDepositAmount || 100),
              initialDepositAmount: Number(pigmyFormData.initialDepositAmount || 0),
              openingDate: new Date().toISOString()
            };
            await fetch('/api/PigmyAccounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify(pigmyPayload)
            });
          } catch (err) {
            console.error("Error auto-opening pigmy account", err);
          }
        }

        alert(editingId !== null ? "खातेदार माहिती यशस्वीरित्या अपडेट झाली!" : "नवीन खातेदार (CIF) यशस्वीरित्या सेव्ह झाला!");
        resetForm();
        if (isListModalOpen) fetchCustomers(directoryPage, directoryPageSize, debouncedSearchQuery);
        fetchPendingAgentRequests();
        setTimeout(() => {
          legacyCustomerNoInputRef.current?.focus();
        }, 100);
      } else {
        let errorMsg = 'जतन करता आले नाही.';
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
        alert(`त्रुटी: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      alert(`सर्व्हरशी संपर्क साधताना एरर आली: ${error?.message || error}`);
    }
  };

  const applyCustomerToForm = (customer: Customer) => {
    setFormData({
      branchID: customer.branchID || 1,
      cifNo: customer.cifNo || '',
      legacyCustomerNo: customer.legacyCustomerNo || (customer as any).LegacyCustomerNo || (customer as any).oldMemberCode || (customer as any).memberProfile?.oldMemberCode || '',
      firstName: customer.firstName || '',
      middleName: customer.middleName || '',
      lastName: customer.lastName || '',
      nickName: customer.nickName || '',
      firstNameEng: customer.firstNameEng || '',
      middleNameEng: customer.middleNameEng || '',
      lastNameEng: customer.lastNameEng || '',
      address: customer.address || '',
      addressEng: customer.addressEng || '',
      village: customer.village || '',
      taluka: customer.taluka || '',
      district: customer.district || '',
      mobileNo: customer.mobileNo || '',
      email: customer.email || '',
      aadhaarNo: customer.aadhaarNo || '',
      panNo: customer.panNo || '',
      registrationDate: customer.registrationDate ? customer.registrationDate.split('T')[0] : new Date().toISOString().split('T')[0],
      nomineeName: customer.nomineeName || '',
      nomineeNameEng: customer.nomineeNameEng || '',
      nomineeRelation: customer.nomineeRelation || '',
      nomineeAddress: customer.nomineeAddress || '',
      nomineeBirthDate: customer.nomineeBirthDate ? customer.nomineeBirthDate.split('T')[0] : '',
      nomineeIsMinor: !!customer.nomineeIsMinor,
      nomineeGuardianName: customer.nomineeGuardianName || '',
      status: customer.status || 'Active',
      gender: customer.gender || '',
      birthDate: customer.birthDate ? customer.birthDate.split('T')[0] : '',
      occupation: customer.occupation || '',
      casteCategory: customer.casteCategory || '',
      caste: customer.caste || '',
      isMinor: !!customer.isMinor,
      guardianName: customer.guardianName || '',
      guardianNameEng: customer.guardianNameEng || '',
      guardianRelation: customer.guardianRelation || '',
      guardianAadhaarNo: customer.guardianAadhaarNo || '',
      guardianMobileNo: customer.guardianMobileNo || '',
      guardianAddress: customer.guardianAddress || '',
      photoPath: customer.photoPath || '',
      signaturePath: customer.signaturePath || '',
      aadhaarDocPath: customer.aadhaarDocPath || '',
      panDocPath: customer.panDocPath || '',
      employerId: customer.employerId ? customer.employerId.toString() : '',
      employeeCode: customer.employeeCode || '',
      customerType: customer.customerType || 'Individual',
      kycStatus: customer.kycStatus || 'Verified',
      riskCategory: customer.riskCategory || 'Low',
      ckycNo: customer.ckycNo || ''
    });
  };

  const handleEdit = async (customer: Customer) => {
    setEditingId(customer.customerID);
    applyCustomerToForm(customer);

    setIsListModalOpen(false);
    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    try {
      const res = await fetch(`${API_URL}/${customer.customerID}`, { headers: getAuthHeaders() });
      if (res.ok && isMountedRef.current) {
        const fullCustomer = await res.json();
        if (fullCustomer && fullCustomer.customerID === customer.customerID) {
          applyCustomerToForm(fullCustomer);
        }
      }
    } catch (err) {
      console.error('Error fetching full customer details for edit:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे का की हा खातेदार डिलीट करायचा आहे? (Are you sure you want to delete this customer?)")) return;

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        let msg = "खातेदार यशस्वीरित्या डिलीट केला.";
        try {
          const data = await response.json();
          msg = data.message || msg;
        } catch {}
        alert(msg);
        if (isListModalOpen) {
          await fetchCustomers(directoryPage, directoryPageSize, debouncedSearchQuery);
        }
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
        alert(`त्रुटी: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      alert(`सर्व्हरशी संपर्क साधताना त्रुटी आली: ${error?.message || error}`);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedRequestId(null);
    setLoadedAgentName('');
    setPigmyFormData({
      openPigmyAccount: false,
      pigmySchemeID: '',
      pigmyAgentID: '',
      dailyDepositAmount: 100,
      initialDepositAmount: 0
    });
    setFormData({
      branchID: resolveWriteBranchId(user, localStorage.getItem('globalBranchId')),
      cifNo: '',
      legacyCustomerNo: '',
      firstName: '',
      middleName: '',
      lastName: '',
      nickName: '',
      firstNameEng: '',
      middleNameEng: '',
      lastNameEng: '',
      address: sansthaDefaults.address,
      addressEng: '',
      village: sansthaDefaults.village,
      taluka: sansthaDefaults.taluka,
      district: sansthaDefaults.district,
      mobileNo: '',
      email: '',
      aadhaarNo: '',
      panNo: '',
      registrationDate: stickyRegistrationDate || new Date().toISOString().split('T')[0],
      nomineeName: '',
      nomineeNameEng: '',
      nomineeRelation: '',
      nomineeAddress: '',
      nomineeBirthDate: '',
      nomineeIsMinor: false,
      nomineeGuardianName: '',
      status: 'Active',
      gender: '',
      birthDate: '',
      occupation: '',
      casteCategory: '',
      caste: '',
      isMinor: false,
      guardianName: '',
      guardianNameEng: '',
      guardianRelation: '',
      guardianAadhaarNo: '',
      guardianMobileNo: '',
      guardianAddress: '',
      photoPath: '',
      signaturePath: '',
      aadhaarDocPath: '',
      panDocPath: '',
      employerId: '',
      employeeCode: '',
      customerType: 'Individual',
      kycStatus: 'Verified',
      riskCategory: 'Low',
      ckycNo: ''
    });
    fetchNextCif();
    setTimeout(() => {
      legacyCustomerNoInputRef.current?.focus();
    }, 100);
  };

  const handleLoadAgentRequest = (req: any) => {
    setSelectedRequestId(req.requestID);
    setLoadedAgentName(req.agentName || req.pigmyAgent?.agentName || 'एजंट');
    
    setFormData(prev => ({
      ...prev,
      firstName: req.firstName || '',
      middleName: req.middleName || '',
      lastName: req.lastName || '',
      firstNameEng: req.firstNameEng || transliterateMarathi(req.firstName || ''),
      middleNameEng: req.middleNameEng || transliterateMarathi(req.middleName || ''),
      lastNameEng: req.lastNameEng || transliterateMarathi(req.lastName || ''),
      mobileNo: req.mobileNo || '',
      address: req.address || '',
      village: req.village || '',
      aadhaarNo: req.aadhaarNo || '',
      panNo: req.panNo || '',
      gender: req.gender || '',
      birthDate: req.birthDate ? req.birthDate.split('T')[0] : '',
      occupation: req.occupation || '',
      nomineeName: req.nomineeName || '',
      nomineeRelation: req.nomineeRelation || '',
      photoPath: req.photoPath || '',
      signaturePath: req.signaturePath || '',
      aadhaarDocPath: req.aadhaarDocPath || '',
      panDocPath: req.panDocPath || ''
    }));

    if (req.openPigmyAccount) {
      setPigmyFormData({
        openPigmyAccount: true,
        pigmySchemeID: req.pigmySchemeID ? String(req.pigmySchemeID) : '',
        pigmyAgentID: req.pigmyAgentID ? String(req.pigmyAgentID) : '',
        dailyDepositAmount: req.dailyDepositAmount || 100,
        initialDepositAmount: req.initialDepositAmount || 0
      });
    }

    setIsRequestsModalOpen(false);
    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleClearAgentRequest = () => {
    setSelectedRequestId(null);
    setLoadedAgentName('');
    resetForm();
  };

  const handleRejectRequest = async () => {
    if (!rejectModal.requestId) return;
    try {
      const res = await fetch(`/api/AgentCustomerRequests/${rejectModal.requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reason: rejectModal.reason || 'अर्जात त्रुटी आढळली.' })
      });
      if (res.ok) {
        alert("अर्ज नाकारण्यात आला.");
        setRejectModal({ isOpen: false, requestId: null, reason: '' });
        fetchPendingAgentRequests();
      } else {
        alert("अर्ज नाकारताना त्रुटी आली.");
      }
    } catch (e) {
      console.error(e);
      alert("सर्व्हरशी संपर्क साधताना एरर आली.");
    }
  };

  const handleHarmonizeCifs = async () => {
    if (!window.confirm("तुम्हाला सर्व जुन्या खातेदारांचे CIF कोड सिरीयल प्रमाणे (Harmonize) करायचे आहेत का?")) return;
    try {
      const res = await fetch(`${API_URL}/harmonize-cifs`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "CIF कोड यशस्वीरित्या सुसंगत केले.");
        if (isListModalOpen) {
          fetchCustomers(directoryPage, directoryPageSize, debouncedSearchQuery);
        }
        fetchNextCif(editingId === null);
      } else {
        alert("CIF सुसंगत करताना त्रुटी आली.");
      }
    } catch (e) {
      console.error(e);
      alert("सर्व्हरशी संपर्क साधताना त्रुटी आली.");
    }
  };

  const filteredCustomers = customers || [];

  // KPI Calculations (from fast server-side stats)
  const totalCustomersCount = customerStats.totalCustomers;
  const activeCustomersCount = customerStats.activeCustomers;
  const kycCompleteCount = customerStats.kycCompleteCustomers;
  const pendingRequestsCount = pendingRequests.length;

  const labelClass = 'block text-[11px] font-semibold text-[#6E493C] mb-1 tracking-tight';
  const inputClass =
    'w-full text-[12px] border border-amber-200/90 rounded-lg px-2.5 py-1.5 hover:border-amber-300 focus:ring-2 focus:ring-[#B44814]/15 focus:border-[#B44814] focus:outline-none bg-white text-[#3F1912] font-medium transition duration-150 h-[34px] placeholder:text-[#A8897C]';

  // Live Onboarding & KYC Completeness Calculation (for Right Profile Preview Rail)
  const kycChecklist = [
    { label: 'खातेदाराचे नाव (मराठी)', done: Boolean(formData.firstName?.trim() && formData.lastName?.trim()) },
    { label: 'मोबाईल नंबर (१० अंकी)', done: Boolean(formData.mobileNo && formData.mobileNo.trim().length === 10) },
    { label: 'आधार क्रमांक (वैध)', done: Boolean(formData.aadhaarNo && formData.aadhaarNo.length === 12 && isValidAadhaar(formData.aadhaarNo).isValid) },
    { label: 'पॅन क्रमांक (वैध)', done: Boolean(formData.panNo && formData.panNo.length === 10 && isValidPAN(formData.panNo).isValid) },
    { label: 'पत्ता व गाव तपशील', done: Boolean(formData.village?.trim() || formData.address?.trim()) },
    { label: 'खातेदार फोटो', done: Boolean(formData.photoPath) },
    { label: 'डिजिटल स्वाक्षरी', done: Boolean(formData.signaturePath) },
    { label: 'वारसदार नोंद', done: Boolean(formData.nomineeName?.trim()) },
  ];
  const completedChecksCount = kycChecklist.filter(x => x.done).length;
  const profileCompletionPct = Math.round((completedChecksCount / kycChecklist.length) * 100);
  const previewFullNameMr = [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ').trim();
  const previewFullNameEng = [formData.firstNameEng, formData.middleNameEng, formData.lastNameEng].filter(Boolean).join(' ').trim();
  const selectedBranchObj = branches.find(b => Number(b.branchID) === Number(formData.branchID));

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isBulkEntryOpen) {
    return (
      <CustomerBulkEntry
        onBack={() => setIsBulkEntryOpen(false)}
        onNavigateToCustomers={() => {
          setIsBulkEntryOpen(false);
          fetchNextCif(editingId === null);
        }}
      />
    );
  }

  return (
    <div
      className="min-h-full w-full p-3 sm:p-4 text-[12px] font-sans"
      style={{
        background:
          'radial-gradient(circle at 12% 10%, #FDE8E1 0%, rgba(253,232,225,0) 45%), radial-gradient(circle at 88% 12%, #FDE6C4 0%, rgba(253,230,196,0) 44%), radial-gradient(circle at 78% 85%, #FCD9B6 0%, rgba(252,217,182,0) 44%), linear-gradient(135deg, #FDF2EE 0%, #FFFBF7 46%, #FEF3E2 82%, #FCE3BE 100%)',
      }}
    >
      <div className="max-w-[1520px] mx-auto space-y-3.5 pb-6">
        {/* ====================================================================
            EXECUTIVE CBS TOP COMMAND BAR (Faint Pastel Rose-Ivory-Apricot)
           ==================================================================== */}
        <div
          className="relative overflow-hidden rounded-2xl text-[#5A1A14] shadow-[0_8px_24px_rgba(124,36,24,0.08)] border border-amber-300/75 px-4 py-3 pt-3.5 flex flex-wrap items-center justify-between gap-3"
          style={{
            background: 'linear-gradient(125deg, #FCEAE4 0%, #FFF9F2 48%, #FEF0D8 82%, #FCE0B8 100%)',
          }}
        >
          {/* Thin Maroon-to-Saffron Accent Ribbon */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
          />
          <div className="flex items-center gap-3 min-w-0 relative z-10">
            <div
              className="w-10 h-10 rounded-xl text-white border border-amber-200/60 shadow-[0_6px_14px_rgba(154,52,18,0.24)] flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
            >
              <Users className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-[15px] font-extrabold tracking-tight text-[#4A1410]">
                  खातेदार नोंदणी व{' '}
                  <span className="bg-gradient-to-r from-[#7C2418] via-[#B44814] to-[#D97706] bg-clip-text text-transparent">
                    CIF व्यवस्थापन
                  </span>
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#7C2418] bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 rounded-md font-mono">
                  CUSTOMER ONBOARDING
                </span>
                {editingId !== null && (
                  <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs">
                    <Edit className="w-3 h-3" />
                    संपादन मोड #{editingId}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#7A5243] font-medium mt-0.5 hidden sm:block">
                कोअर बँकिंग सिस्टीम (CBS) • CIF निर्मिती, KYC पडताळणी, बायोमेट्रिक कागदपत्रे व वारसदार नोंदणी
              </p>
            </div>
          </div>

          {/* Right Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap relative z-10">
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 bg-white/90 hover:bg-amber-50 text-[#7C2418] border border-amber-300/80 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>संपादन रद्द</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                fetchPendingAgentRequests();
                setIsRequestsModalOpen(true);
              }}
              className="px-3 py-1.5 bg-white/90 hover:bg-amber-50 text-[#5A1A14] border border-amber-300/80 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="मोबाईल ॲप / एजंट द्वारे आलेल्या नवीन खातेदार विनंत्या"
            >
              <Inbox className="w-3.5 h-3.5 text-[#D97706]" />
              <span>एजंट विनंत्या</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  pendingRequests.length > 0
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-100 text-[#7C2418]'
                }`}
              >
                {pendingRequests.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('customer-bulk');
                } else {
                  setIsBulkEntryOpen(true);
                }
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/40 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="एकाच स्क्रीनवर १००+ खातेदार Excel सारखे भरा"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>बल्क नोंदणी (Excel)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsListModalOpen(true)}
              className="px-3.5 py-1.5 text-white rounded-lg text-[11.5px] font-bold flex items-center gap-1.5 transition shadow-sm hover:brightness-105 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
              title="सर्व नोंदणीकृत खातेदार यादी पॉप-अप मध्ये पहा"
            >
              <Layers className="w-3.5 h-3.5 text-amber-100" />
              <span>खातेदार यादी ({totalCustomersCount})</span>
            </button>
          </div>
        </div>

        {/* Agent Request Loaded Banner */}
        {selectedRequestId && (
          <div className="bg-amber-50 border border-amber-300 px-4 py-2.5 text-amber-950 flex items-center justify-between rounded-xl shadow-2xs gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                एजंट अर्ज #{selectedRequestId}
              </span>
              <span className="text-xs font-semibold">
                {loadedAgentName
                  ? `${loadedAgentName} यांच्याकडून पाठवलेली खातेदार माहिती फॉर्ममध्ये लोड केली आहे.`
                  : 'एजंटने पाठवलेली माहिती फॉर्ममध्ये लोड केली आहे.'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearAgentRequest}
              className="bg-amber-900 hover:bg-amber-950 text-white text-[11px] font-semibold px-3 py-1 rounded-lg cursor-pointer inline-flex items-center gap-1 transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>विनंती रद्द करा</span>
            </button>
          </div>
        )}

        {/* Quick Section Navigation Bar */}
        <div className="bg-white/90 backdrop-blur-md rounded-xl border border-amber-200/80 px-3 py-2 shadow-[0_4px_14px_rgba(124,36,24,0.05)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'sec-personal', num: '01', label: 'वैयक्तिक माहिती' },
              { id: 'sec-contact', num: '02', label: 'संपर्क व पत्ता' },
              { id: 'sec-kyc', num: '03', label: 'KYC व कागदपत्रे' },
              { id: 'sec-nominee', num: '04', label: 'वारसदार व पालक' },
              { id: 'sec-pigmy', num: '05', label: 'सोबत पिग्मी खाते' },
            ].map(step => (
              <button
                key={step.id}
                type="button"
                onClick={() => scrollToSection(step.id)}
                className="px-2.5 py-1 rounded-lg bg-[#FFF9F2] hover:bg-amber-100/70 text-[#5C3A2E] hover:text-[#5A1A14] border border-amber-200/80 hover:border-[#D97706]/50 text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <span className="text-[10px] font-mono font-bold text-[#B44814]">{step.num}</span>
                <span>{step.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#6E493C] font-semibold shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              सक्रिय: <strong className="text-[#4A1410] font-mono">{activeCustomersCount}</strong>
            </span>
            <span className="text-amber-300">|</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B44814]" />
              KYC पूर्ण: <strong className="text-[#4A1410] font-mono">{kycCompleteCount}</strong>
            </span>
          </div>
        </div>

        {/* ====================================================================
            2-COLUMN EXECUTIVE WORKSTATION: MAIN FORM (9 cols) + LIVE CIF RAIL (3 cols)
           ==================================================================== */}
        <form onSubmit={handleSubmit} ref={formContainerRef as any}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* LEFT MAIN ONBOARDING WORKSPACE (9 Cols) */}
            <div
              className={`lg:col-span-9 space-y-3.5 ${
                editingId !== null ? 'ring-2 ring-amber-400/60 rounded-xl p-1.5 bg-amber-50/30' : ''
              }`}
            >
              {/* SECTION 01: वैयक्तिक व सिस्टीम माहिती */}
              <section
                id="sec-personal"
                className="bg-white/95 rounded-xl border border-amber-200/75 shadow-[0_4px_16px_rgba(124,36,24,0.05)] overflow-hidden scroll-mt-4"
              >
                <div className="px-4 py-2.5 bg-gradient-to-r from-[#FDF4EF] via-[#FFFBF7] to-[#FEF5E7] border-b border-amber-200/70 border-l-[3px] border-l-[#7C2418] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-mono font-bold text-[#7C2418] bg-[#FCEAE4] border border-[#7C2418]/25 px-1.5 py-0.5 rounded">
                      01
                    </span>
                    <h2 className="text-[12.5px] font-bold text-[#4A1410]">
                      वैयक्तिक व सिस्टीम माहिती
                    </h2>
                    <span className="text-[10.5px] text-[#9A7465] font-medium hidden sm:inline">
                      Basic &amp; Personal Profile
                    </span>
                  </div>

                  <label
                    htmlFor="isMinor"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer select-none transition ${
                      formData.isMinor
                        ? 'bg-amber-50 border-amber-400 text-amber-900'
                        : 'bg-white border-amber-200 text-[#6E493C] hover:bg-amber-50/70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="isMinor"
                      name="isMinor"
                      checked={Boolean(formData.isMinor)}
                      onChange={handleChange}
                      className="w-3.5 h-3.5 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>अज्ञान खातेदार (Minor)</span>
                  </label>
                </div>

                <div className="p-4 space-y-3.5">
                  {/* Sub-group A: Core System Identifiers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
                      <label className={labelClass}>
                        शाखा (Branch) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="branchID"
                        value={formData.branchID || 1}
                        onChange={handleChange}
                        required
                        disabled={!isHeadOfficeUser(user)}
                        className={`${inputClass} ${!isHeadOfficeUser(user) ? 'bg-[#FFF8F1] text-[#6E493C] cursor-not-allowed' : ''}`}
                      >
                        {(getLockedBranchId(user) ? branches.filter(b => b.branchID === getLockedBranchId(user)) : branches).map(b => (
                          <option key={b.branchID} value={b.branchID}>
                            {b.branchName} ({b.branchCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>
                        CIF क्रमांक (System Code) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="cifNo"
                        value={formData.cifNo || ''}
                        readOnly
                        className={`${inputClass} font-mono font-bold text-[#7C2418] bg-[#FFF8F1] border-amber-200/90 cursor-not-allowed`}
                        placeholder="CIF001066"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 gap-1">
                        <label className="text-[11px] font-semibold text-slate-600 tracking-tight truncate">
                          जुना / लेगसी क्र.
                        </label>
                        {customerStats.nextLegacyCustomerNo && (
                          <button
                            type="button"
                            onClick={() => {
                              if (editingId === null) {
                                setFormData(prev => ({ ...prev, legacyCustomerNo: customerStats.nextLegacyCustomerNo }));
                              }
                            }}
                            className="text-[9.5px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded cursor-pointer shrink-0 transition"
                            title="पुढील सुचवलेला क्रमांक भरा"
                          >
                            पुढील: {customerStats.nextLegacyCustomerNo}
                          </button>
                        )}
                      </div>
                      <input
                        ref={legacyCustomerNoInputRef}
                        type="text"
                        name="legacyCustomerNo"
                        value={formData.legacyCustomerNo || ''}
                        onChange={handleChange}
                        className={`${inputClass} font-mono ${
                          legacyDuplicate
                            ? 'border-rose-500 bg-rose-50/70 text-rose-900 font-bold focus:ring-rose-500/20 focus:border-rose-500'
                            : ''
                        }`}
                        placeholder={
                          customerStats.nextLegacyCustomerNo
                            ? `पुढील क्र: ${customerStats.nextLegacyCustomerNo}`
                            : 'उदा. 1234'
                        }
                      />
                      {legacyDuplicate && (
                        <span className="text-[10px] text-rose-600 font-semibold block mt-1">
                          हा क्र. आधीच {legacyDuplicate.firstName} {legacyDuplicate.lastName} ({legacyDuplicate.cifNo}) कडे आहे.
                        </span>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>
                        खाते स्थिती (Status) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        required
                        className={`${inputClass} font-semibold`}
                      >
                        <option value="Active">सक्रिय (Active)</option>
                        <option value="Deactive">निष्क्रिय (Deactive)</option>
                        <option value="Mayat">मयत (Deceased)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subtle Architectural Divider */}
                  <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
                      <label className={labelClass}>
                        पहिले नाव (मराठी) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        ref={firstNameInputRef}
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        className={`${inputClass} ${editingId !== null ? 'bg-amber-50/50 font-semibold' : ''}`}
                        placeholder="पहिले नाव"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>वडिलांचे / पतीचे नाव (मराठी)</label>
                      <input
                        type="text"
                        name="middleName"
                        value={formData.middleName}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="वडिलांचे / पतीचे नाव"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        आडनाव (मराठी) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        className={inputClass}
                        placeholder="आडनाव"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>टोपण नाव (Nickname)</label>
                      <input
                        type="text"
                        name="nickName"
                        value={formData.nickName || ''}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="ऐच्छिक"
                      />
                    </div>
                  </div>

                  {/* English Names & Registration Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
                      <label className={labelClass}>First Name (English)</label>
                      <input
                        type="text"
                        name="firstNameEng"
                        value={formData.firstNameEng || ''}
                        onChange={handleChange}
                        className={`${inputClass} capitalize`}
                        placeholder="First Name"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Middle Name (English)</label>
                      <input
                        type="text"
                        name="middleNameEng"
                        value={formData.middleNameEng || ''}
                        onChange={handleChange}
                        className={`${inputClass} capitalize`}
                        placeholder="Middle Name"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Last Name (English)</label>
                      <input
                        type="text"
                        name="lastNameEng"
                        value={formData.lastNameEng || ''}
                        onChange={handleChange}
                        className={`${inputClass} capitalize`}
                        placeholder="Last Name"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        खाते सुरू दिनांक <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="registrationDate"
                        value={formData.registrationDate}
                        onChange={handleChange}
                        required
                        className={`${inputClass} font-mono font-semibold text-[#7C2418]`}
                      />
                    </div>
                  </div>

                  {/* Demographics & Employment */}
                  <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
                      <label className={labelClass}>खातेदार प्रकार (Customer Type)</label>
                      <select
                        name="customerType"
                        value={formData.customerType || 'Individual'}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="Individual">वैयक्तिक (Individual)</option>
                        <option value="Joint">संयुक्त (Joint)</option>
                        <option value="Proprietorship">प्रोप्रायटरशिप (Proprietorship)</option>
                        <option value="Firm">भागीदारी संस्था (Firm)</option>
                        <option value="Trust">ट्रस्ट / मंडळ (Trust)</option>
                        <option value="Society">सहकारी संस्था (Society)</option>
                        <option value="SHG">बचत गट (SHG)</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>लिंग (Gender)</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="">-- निवडा --</option>
                        <option value="Male">पुरुष (Male)</option>
                        <option value="Female">स्त्री (Female)</option>
                        <option value="Other">इतर (Other)</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>जन्म तारीख (Birth Date)</label>
                      <input
                        type="date"
                        name="birthDate"
                        value={formData.birthDate}
                        onChange={handleChange}
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>व्यवसाय (Occupation)</label>
                      <input
                        type="text"
                        name="occupation"
                        value={formData.occupation}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="शेती, नोकरी, व्यवसाय..."
                      />
                    </div>

                    <div>
                      <label className={labelClass}>नियोक्ता / ऑफिस (Employer)</label>
                      <select
                        name="employerId"
                        value={formData.employerId}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="">-- नियोक्ता निवडा (ऐच्छिक) --</option>
                        {employers.map((emp: any) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>कर्मचारी कोड (Emp Code)</label>
                      <input
                        type="text"
                        name="employeeCode"
                        value={formData.employeeCode}
                        onChange={handleChange}
                        className={`${inputClass} font-mono`}
                        placeholder="उदा. 101"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>प्रवर्ग / वर्गवारी (Category)</label>
                      <select
                        name="casteCategory"
                        value={formData.casteCategory || ''}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="">-- निवडा --</option>
                        <option value="Open">खुला (Open)</option>
                        <option value="OBC">ओबीसी (OBC)</option>
                        <option value="SC">एस.सी. (SC)</option>
                        <option value="ST">एस.टी. (ST)</option>
                        <option value="NT">एन.टी. (NT)</option>
                        <option value="SBC">एस.बी.सी. (SBC)</option>
                        <option value="VJNT">व्ही.जे.एन.टी. (VJNT)</option>
                        <option value="EWS">ई.डब्ल्यू.एस. (EWS)</option>
                        <option value="Other">इतर (Other)</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>जात (Caste)</label>
                      <input
                        type="text"
                        name="caste"
                        value={formData.caste || ''}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="जात प्रविष्ट करा"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 02: संपर्क व पत्ता माहिती */}
              <section
                id="sec-contact"
                className="bg-white/95 rounded-xl border border-amber-200/75 shadow-[0_4px_16px_rgba(124,36,24,0.05)] overflow-hidden scroll-mt-4"
              >
                <div className="px-4 py-2.5 bg-gradient-to-r from-[#FDF4EF] via-[#FFFBF7] to-[#FEF5E7] border-b border-amber-200/70 border-l-[3px] border-l-[#B44814] flex items-center gap-2">
                  <span className="text-[10.5px] font-mono font-bold text-[#9A3412] bg-orange-50 border border-orange-200/90 px-1.5 py-0.5 rounded">
                    02
                  </span>
                  <h2 className="text-[12.5px] font-bold text-[#4A1410]">
                    संपर्क व पत्ता माहिती
                  </h2>
                  <span className="text-[10.5px] text-[#9A7465] font-medium hidden sm:inline">
                    Contact &amp; Residential Address
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-semibold text-[#6E493C]">
                          मोबाईल क्र. {isMobileCompulsory && <span className="text-rose-500">*</span>}
                        </label>
                        <label className="inline-flex items-center gap-1 text-[9.5px] text-[#8C5E4F] hover:text-[#9A3412] cursor-pointer font-semibold select-none">
                          <input
                            type="checkbox"
                            checked={isMobileCompulsory}
                            onChange={e => setIsMobileCompulsory(e.target.checked)}
                            className="rounded border-amber-300 h-3 w-3 text-[#B44814] focus:ring-0 cursor-pointer"
                          />
                          <span>अनिवार्य</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        name="mobileNo"
                        value={formData.mobileNo || ''}
                        onChange={handleChange}
                        required={isMobileCompulsory}
                        maxLength={10}
                        className={`${inputClass} font-mono font-semibold`}
                        placeholder="१० अंकी मोबाईल"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>ईमेल आयडी (Email)</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email || ''}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="name@example.com"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>गाव (Village)</label>
                      <input
                        type="text"
                        name="village"
                        value={formData.village}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="गावाचे नाव"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>तालुका (Taluka)</label>
                      <input
                        type="text"
                        name="taluka"
                        value={formData.taluka}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="तालुका"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>जिल्हा (District)</label>
                      <input
                        type="text"
                        name="district"
                        value={formData.district}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="जिल्हा"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>संपूर्ण पत्ता (मराठी)</label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="घर क्र., गल्ली, मु. पो., ता., जि."
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Full Address (English)</label>
                      <input
                        type="text"
                        name="addressEng"
                        value={formData.addressEng || ''}
                        onChange={handleChange}
                        className={`${inputClass} capitalize`}
                        placeholder="Full Residential Address"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 03: केवायसी व कागदपत्रे */}
              <section
                id="sec-kyc"
                className="bg-white/95 rounded-xl border border-amber-200/75 shadow-[0_4px_16px_rgba(124,36,24,0.05)] overflow-hidden scroll-mt-4"
              >
                <div className="px-4 py-2.5 bg-gradient-to-r from-[#FDF4EF] via-[#FFFBF7] to-[#FEF5E7] border-b border-amber-200/70 border-l-[3px] border-l-[#D97706] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-mono font-bold text-[#B45309] bg-amber-50 border border-amber-200/90 px-1.5 py-0.5 rounded">
                      03
                    </span>
                    <h2 className="text-[12.5px] font-bold text-[#4A1410]">
                      केवायसी (KYC) व कागदपत्र पडताळणी
                    </h2>
                    <span className="text-[10.5px] text-[#9A7465] font-medium hidden sm:inline">
                      Statutory Compliance &amp; Document Vault
                    </span>
                  </div>
                  <span className="text-[10.5px] text-[#8C5E4F] font-medium">
                    थेट कॅमेरा स्कॅन किंवा फाईल अपलोड (JPG / PNG / PDF)
                  </span>
                </div>

                <div className="p-4 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-semibold text-[#6E493C]">
                          आधार क्र. {isAadhaarCompulsory && <span className="text-rose-500">*</span>}
                        </label>
                        <label className="inline-flex items-center gap-1 text-[9.5px] text-[#8C5E4F] hover:text-[#9A3412] cursor-pointer font-semibold select-none">
                          <input
                            type="checkbox"
                            checked={isAadhaarCompulsory}
                            onChange={e => setIsAadhaarCompulsory(e.target.checked)}
                            className="rounded border-amber-300 h-3 w-3 text-[#B44814] focus:ring-0 cursor-pointer"
                          />
                          <span>अनिवार्य</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        name="aadhaarNo"
                        value={formData.aadhaarNo || ''}
                        onChange={handleChange}
                        required={isAadhaarCompulsory}
                        maxLength={12}
                        className={`${inputClass} font-mono`}
                        placeholder="१२ अंकी आधार क्र."
                      />
                      {formData.aadhaarNo && formData.aadhaarNo.length > 0 && (
                        <div className="mt-1 text-[10px]">
                          {formData.aadhaarNo.length < 12 ? (
                            <span className="text-amber-600 font-medium">
                              १२ अंक टाका ({formData.aadhaarNo.length}/१२)
                            </span>
                          ) : isValidAadhaar(formData.aadhaarNo).isValid ? (
                            <span className="text-emerald-700 font-semibold">वैध आधार (Verhoeff Check पास)</span>
                          ) : (
                            <span className="text-rose-600 font-semibold">{isValidAadhaar(formData.aadhaarNo).error}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-semibold text-[#6E493C]">
                          पॅन क्र. (PAN) {isPanCompulsory && <span className="text-rose-500">*</span>}
                        </label>
                        <label className="inline-flex items-center gap-1 text-[9.5px] text-[#8C5E4F] hover:text-[#9A3412] cursor-pointer font-semibold select-none">
                          <input
                            type="checkbox"
                            checked={isPanCompulsory}
                            onChange={e => setIsPanCompulsory(e.target.checked)}
                            className="rounded border-amber-300 h-3 w-3 text-[#B44814] focus:ring-0 cursor-pointer"
                          />
                          <span>अनिवार्य</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        name="panNo"
                        value={formData.panNo || ''}
                        onChange={handleChange}
                        required={isPanCompulsory}
                        maxLength={10}
                        className={`${inputClass} uppercase font-mono font-semibold`}
                        placeholder="ABCDE1234F"
                      />
                      {formData.panNo && formData.panNo.length > 0 && (
                        <div className="mt-1 text-[10px]">
                          {formData.panNo.length < 10 ? (
                            <span className="text-amber-600 font-medium">
                              १० अक्षरे टाका ({formData.panNo.length}/१०)
                            </span>
                          ) : isValidPAN(formData.panNo).isValid ? (
                            <span className="text-emerald-700 font-semibold">वैध PAN फॉरमॅट</span>
                          ) : (
                            <span className="text-rose-600 font-semibold">{isValidPAN(formData.panNo).error}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>केवायसी स्थिती (KYC Status)</label>
                      <select
                        name="kycStatus"
                        value={formData.kycStatus || 'Verified'}
                        onChange={handleChange}
                        className={`${inputClass} font-semibold ${
                          formData.kycStatus === 'Verified'
                            ? 'text-emerald-700 bg-emerald-50/40'
                            : formData.kycStatus === 'Pending'
                            ? 'text-amber-700 bg-amber-50/40'
                            : 'text-[#9A3412]'
                        }`}
                      >
                        <option value="Verified">पूर्ण (Verified)</option>
                        <option value="Pending">अपूर्ण (Pending)</option>
                        <option value="ReKYCDue">रि-केवायसी बाकी (Re-KYC Due)</option>
                        <option value="Simplified">सुलभीकृत (Simplified)</option>
                        <option value="Exempted">सूट दिलेले (Exempted)</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>जोखीम श्रेणी (Risk Category)</label>
                      <select
                        name="riskCategory"
                        value={formData.riskCategory || 'Low'}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="Low">कमी जोखीम (Low - १० वर्षे)</option>
                        <option value="Medium">मध्यम जोखीम (Medium - ८ वर्षे)</option>
                        <option value="High">उच्च जोखीम (High - २ वर्षे)</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>CKYC क्रमांक (१४ अंकी)</label>
                      <input
                        type="text"
                        name="ckycNo"
                        value={formData.ckycNo || ''}
                        onChange={handleChange}
                        maxLength={14}
                        className={`${inputClass} font-mono`}
                        placeholder="CKYC क्रमांक"
                      />
                    </div>
                  </div>

                  {/* 4 Clean Enterprise Document Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                    {[
                      {
                        key: 'photo' as const,
                        title: 'खातेदार फोटो',
                        sub: 'Passport Photo',
                        path: formData.photoPath,
                        uploading: photoUploading,
                        accept: 'image/*',
                        previewTitle: 'खातेदार फोटो (Customer Photo)',
                        clear: () => setFormData(prev => ({ ...prev, photoPath: '' })),
                        icon: Camera,
                        contain: false,
                      },
                      {
                        key: 'signature' as const,
                        title: 'डिजिटल स्वाक्षरी',
                        sub: 'Specimen Signature',
                        path: formData.signaturePath,
                        uploading: signUploading,
                        accept: 'image/*',
                        previewTitle: 'डिजिटल स्वाक्षरी (Signature)',
                        clear: () => setFormData(prev => ({ ...prev, signaturePath: '' })),
                        icon: FileText,
                        contain: true,
                      },
                      {
                        key: 'aadhaarDoc' as const,
                        title: 'आधार कार्ड प्रत',
                        sub: 'Aadhaar KYC Proof',
                        path: formData.aadhaarDocPath,
                        uploading: aadhaarUploading,
                        accept: 'image/*,application/pdf',
                        previewTitle: 'आधार कार्ड डॉक्युमेंट (Aadhaar)',
                        clear: () => setFormData(prev => ({ ...prev, aadhaarDocPath: '' })),
                        icon: FileBadge,
                        contain: false,
                      },
                      {
                        key: 'panDoc' as const,
                        title: 'पॅन कार्ड प्रत',
                        sub: 'PAN Tax Proof',
                        path: formData.panDocPath,
                        uploading: panUploading,
                        accept: 'image/*,application/pdf',
                        previewTitle: 'पॅन कार्ड डॉक्युमेंट (PAN)',
                        clear: () => setFormData(prev => ({ ...prev, panDocPath: '' })),
                        icon: CreditCard,
                        contain: false,
                      },
                    ].map(doc => {
                      const DocIcon = doc.icon;
                      return (
                        <div
                          key={doc.key}
                          className="rounded-xl border border-amber-200/80 bg-[#FFFBF7] p-2.5 flex flex-col justify-between hover:border-[#D97706]/60 transition"
                        >
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <div className="w-12 h-12 rounded-lg bg-white border border-amber-200/80 flex items-center justify-center overflow-hidden shrink-0">
                              {doc.uploading ? (
                                <RefreshCw className="w-4 h-4 text-[#B44814] animate-spin" />
                              ) : doc.path ? (
                                doc.path.toLowerCase().endsWith('.pdf') ? (
                                  <span className="text-[10px] font-bold text-rose-600 font-mono">PDF</span>
                                ) : (
                                  <img
                                    src={doc.path}
                                    alt={doc.title}
                                    className={`w-full h-full ${doc.contain ? 'object-contain p-0.5' : 'object-cover'}`}
                                  />
                                )
                              ) : (
                                <DocIcon className="w-4 h-4 text-[#B88B75]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11.5px] font-bold text-[#4A1410] truncate">{doc.title}</div>
                              <div className="text-[9.5px] text-[#9A7465] truncate">{doc.sub}</div>
                              {doc.path ? (
                                <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9.5px] text-emerald-700 font-semibold">
                                  <Check className="w-3 h-3" />
                                  अपलोड पूर्ण
                                </span>
                              ) : (
                                <span className="inline-block mt-0.5 text-[9.5px] text-[#A8897C] font-medium">
                                  अपलोड बाकी
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 pt-2 border-t border-amber-200/70">
                            <label className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 bg-white hover:bg-amber-50 text-[#5C3A2E] border border-amber-200/90 rounded-md text-[10.5px] font-semibold cursor-pointer transition">
                              <UploadCloud className="w-3 h-3 text-[#B45309]" />
                              <span>फाईल</span>
                              <input
                                type="file"
                                accept={doc.accept}
                                className="hidden"
                                onChange={e => handleFileUpload(e, doc.key)}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => startCamera(doc.key)}
                              className="inline-flex items-center justify-center gap-1 py-1 px-2 text-white rounded-md text-[10.5px] font-semibold cursor-pointer hover:brightness-110 transition"
                              style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 100%)' }}
                            >
                              <Camera className="w-3 h-3" />
                              <span>स्कॅन</span>
                            </button>
                            {doc.path && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDocModal({ isOpen: true, title: doc.previewTitle, docUrl: doc.path })
                                  }
                                  className="p-1 bg-white hover:bg-amber-50 text-[#9A3412] border border-amber-200 rounded-md cursor-pointer transition"
                                  title="पहा"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={doc.clear}
                                  className="p-1 bg-white hover:bg-rose-50 text-rose-600 border border-amber-200 rounded-md cursor-pointer transition"
                                  title="काढा"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* CONDITIONAL GUARDIAN SECTION (when isMinor is true) */}
              {formData.isMinor && (
                <section className="bg-white rounded-xl border border-amber-300 shadow-2xs overflow-hidden">
                  <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-200 border-l-[3px] border-l-amber-500 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-amber-700" />
                    <h2 className="text-[12.5px] font-bold text-amber-950">
                      अज्ञान खातेदार पालकाची माहिती (Guardian Details)
                    </h2>
                  </div>

                  <div className="p-4 space-y-3 bg-amber-50/15">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      <div>
                        <label className={labelClass}>
                          पालकाचे नाव (मराठी) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="guardianName"
                          value={formData.guardianName || ''}
                          onChange={handleChange}
                          required={Boolean(formData.isMinor)}
                          className={inputClass}
                          placeholder="पालकाचे पूर्ण नाव"
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Guardian Name (English)</label>
                        <input
                          type="text"
                          name="guardianNameEng"
                          value={formData.guardianNameEng || ''}
                          onChange={handleChange}
                          className={`${inputClass} capitalize`}
                          placeholder="Guardian Name"
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          पालकाचे नाते (Relation) <span className="text-rose-500">*</span>
                        </label>
                        <select
                          name="guardianRelation"
                          value={formData.guardianRelation || ''}
                          onChange={handleChange}
                          required={Boolean(formData.isMinor)}
                          className={inputClass}
                        >
                          <option value="">-- नाते निवडा --</option>
                          <option value="Father">वडील (Father)</option>
                          <option value="Mother">आई (Mother)</option>
                          <option value="Grandfather">आजोबा (Grandfather)</option>
                          <option value="Uncle">काका (Uncle)</option>
                          <option value="Other">इतर (Other)</option>
                        </select>
                      </div>

                      <div>
                        <label className={labelClass}>पालकाचा मोबाईल क्र.</label>
                        <input
                          type="text"
                          name="guardianMobileNo"
                          value={formData.guardianMobileNo || ''}
                          onChange={handleChange}
                          maxLength={10}
                          className={`${inputClass} font-mono`}
                          placeholder="१० अंकी मोबाईल"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className={labelClass}>पालकाचा आधार क्र.</label>
                        <input
                          type="text"
                          name="guardianAadhaarNo"
                          value={formData.guardianAadhaarNo || ''}
                          onChange={handleChange}
                          maxLength={12}
                          className={`${inputClass} font-mono`}
                          placeholder="१२ अंकी आधार"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className={labelClass}>पालकाचा संपूर्ण पत्ता (Guardian Address)</label>
                        <input
                          type="text"
                          name="guardianAddress"
                          value={formData.guardianAddress || ''}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="पालकाचा संपूर्ण पत्ता"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* SECTION 04: वारसदार माहिती */}
              <section
                id="sec-nominee"
                className="bg-white/95 rounded-xl border border-amber-200/75 shadow-[0_4px_16px_rgba(124,36,24,0.05)] overflow-hidden scroll-mt-4"
              >
                <div className="px-4 py-2.5 bg-gradient-to-r from-[#FDF4EF] via-[#FFFBF7] to-[#FEF5E7] border-b border-amber-200/70 border-l-[3px] border-l-[#9A3412] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-mono font-bold text-[#7C2418] bg-rose-50 border border-rose-200/90 px-1.5 py-0.5 rounded">
                      04
                    </span>
                    <h2 className="text-[12.5px] font-bold text-[#4A1410]">
                      वारसदार माहिती
                    </h2>
                    <span className="text-[10.5px] text-[#9A7465] font-medium hidden sm:inline">
                      Nomination Details
                    </span>
                  </div>

                  <label
                    htmlFor="nomineeIsMinor"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer select-none transition ${
                      formData.nomineeIsMinor
                        ? 'bg-amber-50 border-amber-400 text-amber-900'
                        : 'bg-white border-amber-200 text-[#6E493C] hover:bg-amber-50/70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="nomineeIsMinor"
                      name="nomineeIsMinor"
                      checked={formData.nomineeIsMinor || false}
                      onChange={handleChange}
                      className="w-3.5 h-3.5 text-[#B44814] rounded border-amber-300 focus:ring-[#B44814] cursor-pointer"
                    />
                    <span>वारसदार अज्ञान (Minor) आहे</span>
                  </label>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
                      <label className={labelClass}>वारसदाराचे नाव (मराठी)</label>
                      <input
                        type="text"
                        name="nomineeName"
                        value={formData.nomineeName}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="वारसदाराचे पूर्ण नाव"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Nominee Name (English)</label>
                      <input
                        type="text"
                        name="nomineeNameEng"
                        value={formData.nomineeNameEng || ''}
                        onChange={handleChange}
                        className={`${inputClass} capitalize`}
                        placeholder="Nominee Full Name"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>वारसदाराचे नाते (Relation)</label>
                      <select
                        name="nomineeRelation"
                        value={formData.nomineeRelation}
                        onChange={handleChange}
                        className={inputClass}
                      >
                        <option value="">-- निवडा --</option>
                        <option value="Self">स्वतः (Self)</option>
                        <option value="Spouse">पती/पत्नी (Spouse)</option>
                        <option value="Son">मुलगा (Son)</option>
                        <option value="Daughter">मुलगी (Daughter)</option>
                        <option value="Father">वडील (Father)</option>
                        <option value="Mother">आई (Mother)</option>
                        <option value="Brother">भाऊ (Brother)</option>
                        <option value="Sister">बहीण (Sister)</option>
                        <option value="Other">इतर (Other)</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>वारसदाराची जन्मतारीख</label>
                      <input
                        type="date"
                        name="nomineeBirthDate"
                        value={formData.nomineeBirthDate || ''}
                        onChange={handleChange}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>वारसदाराचा पत्ता (Nominee Address)</label>
                      <input
                        type="text"
                        name="nomineeAddress"
                        value={formData.nomineeAddress || ''}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="वारसदाराचा संपूर्ण पत्ता"
                      />
                    </div>

                    {formData.nomineeIsMinor && (
                      <div>
                        <label className={labelClass}>अज्ञान वारसदाराच्या पालकाचे नाव (Guardian Name)</label>
                        <input
                          type="text"
                          name="nomineeGuardianName"
                          value={formData.nomineeGuardianName || ''}
                          onChange={handleChange}
                          className={`${inputClass} border-amber-300 bg-amber-50/40`}
                          placeholder="पालकाचे पूर्ण नाव"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* SECTION 05: सोबत पिग्मी खाते उघडा */}
              <section
                id="sec-pigmy"
                className="bg-white/95 rounded-xl border border-amber-200/75 shadow-[0_4px_16px_rgba(124,36,24,0.05)] overflow-hidden scroll-mt-4"
              >
                <div className="px-4 py-2.5 bg-gradient-to-r from-[#FDF4EF] via-[#FFFBF7] to-[#FEF5E7] border-b border-amber-200/70 border-l-[3px] border-l-emerald-600 flex items-center justify-between flex-wrap gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-[10.5px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded">
                      05
                    </span>
                    <input
                      type="checkbox"
                      checked={pigmyFormData.openPigmyAccount}
                      onChange={e => setPigmyFormData(p => ({ ...p, openPigmyAccount: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded border-amber-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-[12.5px] font-bold text-[#4A1410]">
                      सोबत पिग्मी दैनिक बचत खाते उघडा
                    </span>
                    <span className="text-[10.5px] text-[#9A7465] font-medium hidden sm:inline">
                      Simultaneous Pigmy Account
                    </span>
                  </label>
                  {pigmyFormData.openPigmyAccount && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2.5 py-0.5 rounded-full">
                      सक्रिय — पिग्मी खाते आपोआप तयार होईल
                    </span>
                  )}
                </div>

                {pigmyFormData.openPigmyAccount && (
                  <div className="p-4 bg-emerald-50/15 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
                      <label className={labelClass}>
                        पिग्मी प्रतिनिधी (Agent) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={pigmyFormData.pigmyAgentID}
                        onChange={e => setPigmyFormData(p => ({ ...p, pigmyAgentID: e.target.value }))}
                        className={inputClass}
                        required={pigmyFormData.openPigmyAccount}
                      >
                        <option value="">-- प्रतिनिधी निवडा --</option>
                        {pigmyAgents.map((a: any) => (
                          <option key={a.pigmyAgentID || a.id} value={a.pigmyAgentID || a.id}>
                            {a.agentName || a.name} ({a.agentCode || a.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>
                        पिग्मी योजना (Scheme) <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={pigmyFormData.pigmySchemeID}
                        onChange={e => setPigmyFormData(p => ({ ...p, pigmySchemeID: e.target.value }))}
                        className={inputClass}
                        required={pigmyFormData.openPigmyAccount}
                      >
                        <option value="">-- योजना निवडा --</option>
                        {pigmySchemes.map((s: any) => (
                          <option key={s.pigmySchemeID || s.id} value={s.pigmySchemeID || s.id}>
                            {s.schemeName || s.name} ({s.interestRate || 0}%)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>दैनिक हप्ता लक्ष्य (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={pigmyFormData.dailyDepositAmount}
                        onChange={e =>
                          setPigmyFormData(p => ({ ...p, dailyDepositAmount: parseFloat(e.target.value) || 0 }))
                        }
                        className={`${inputClass} text-right font-mono font-bold text-emerald-800`}
                        placeholder="100"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>प्रारंभिक जमा (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={pigmyFormData.initialDepositAmount}
                        onChange={e =>
                          setPigmyFormData(p => ({ ...p, initialDepositAmount: parseFloat(e.target.value) || 0 }))
                        }
                        className={`${inputClass} text-right font-mono`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* STICKY EXECUTIVE SUBMIT ACTION BAR */}
              <div className="sticky bottom-2 z-20 bg-white/95 backdrop-blur-md rounded-xl border border-amber-200/90 shadow-[0_8px_24px_rgba(124,36,24,0.10)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-[11px] text-[#6E493C]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      editingId !== null ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  {editingId !== null ? (
                    <span className="font-semibold text-amber-900">
                      संपादन सुरू: <strong className="font-mono">{formData.cifNo}</strong>
                    </span>
                  ) : (
                    <span>
                      नवीन CIF: <strong className="font-mono text-[#7C2418]">{formData.cifNo || '-'}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3.5 py-2 bg-[#FFF8F1] hover:bg-amber-100/70 text-[#5C3A2E] font-semibold rounded-lg text-xs border border-amber-200/90 cursor-pointer inline-flex items-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{editingId !== null ? 'संपादन रद्द करा' : 'फॉर्म रिकामा करा'}</span>
                  </button>

                  {editingId !== null && (
                    <button
                      type="button"
                      onClick={() => handleDelete(Number(editingId))}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs border border-rose-200 cursor-pointer inline-flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>डिलीट करा</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    className="px-5 py-2 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md hover:brightness-105 active:scale-[0.98] inline-flex items-center gap-1.5 transition-all"
                    style={{
                      background:
                        editingId !== null
                          ? 'linear-gradient(135deg, #D97706 0%, #B45309 100%)'
                          : 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)',
                    }}
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>{editingId !== null ? 'खातेदार अपडेट करा' : 'खातेदार (CIF) सेव्ह करा'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ================================================================
                RIGHT STICKY EXECUTIVE RAIL: LIVE CIF CARD + KYC READINESS METER
               ================================================================ */}
            <aside className="lg:col-span-3 space-y-3.5 lg:sticky lg:top-3">
              {/* Live Pastel Rose-Ivory CIF Identity Card Preview */}
              <div className="rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(124,36,24,0.09)] border border-amber-300/75 bg-white">
                <div
                  className="p-4 pt-4.5 text-[#4A1410] relative overflow-hidden border-b border-amber-200/80"
                  style={{
                    background: 'linear-gradient(135deg, #FCEAE4 0%, #FFF8F0 52%, #FCE0B8 100%)',
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
                  />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#9A3412] font-bold">
                      LIVE CIF PREVIEW
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                        formData.status === 'Active'
                          ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-300/80'
                          : formData.status === 'Mayat'
                          ? 'bg-rose-100/90 text-rose-800 border border-rose-300/80'
                          : 'bg-amber-100/90 text-amber-800 border border-amber-300/80'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          formData.status === 'Active'
                            ? 'bg-emerald-500'
                            : formData.status === 'Mayat'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      {formData.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startCamera('photo')}
                      className="w-14 h-14 rounded-xl bg-white/85 border border-amber-300/80 flex items-center justify-center overflow-hidden shrink-0 hover:ring-2 hover:ring-[#D97706]/60 transition cursor-pointer shadow-2xs"
                      title="फोटो कॅप्चर करण्यासाठी क्लिक करा"
                    >
                      {formData.photoPath ? (
                        <img src={formData.photoPath} alt="Customer" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-5 h-5 text-[#B44814]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-extrabold text-[#4A1410] leading-snug truncate">
                        {previewFullNameMr || 'नवीन खातेदार नाव'}
                      </div>
                      <div className="text-[10.5px] text-[#8C4A32] truncate mt-0.5 capitalize font-medium">
                        {previewFullNameEng || 'Customer English Name'}
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-white/85 text-[#7C2418] border border-amber-300/80 px-2 py-0.5 rounded shadow-2xs">
                        <span>{formData.cifNo || 'CIF------'}</span>
                        {formData.legacyCustomerNo && (
                          <>
                            <span className="text-amber-400">•</span>
                            <span className="text-[#B45309]">#{formData.legacyCustomerNo}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Metadata Rows */}
                <div className="p-3.5 space-y-2 text-[11px] bg-white">
                  <div className="flex items-center justify-between py-1 border-b border-amber-100/80">
                    <span className="text-[#8C5E4F]">शाखा</span>
                    <span className="font-semibold text-[#4A1410] truncate max-w-[160px]">
                      {selectedBranchObj?.branchName || `Branch #${formData.branchID || 1}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-amber-100/80">
                    <span className="text-[#8C5E4F]">प्रकार / जोखीम</span>
                    <span className="font-semibold text-[#4A1410]">
                      {formData.customerType || 'Individual'} • {formData.riskCategory || 'Low'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-amber-100/80">
                    <span className="text-[#8C5E4F]">मोबाईल</span>
                    <span className="font-mono font-semibold text-[#4A1410]">
                      {formData.mobileNo || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#8C5E4F]">गाव / वारसदार</span>
                    <span className="font-semibold text-[#4A1410] truncate max-w-[160px]">
                      {formData.village || '—'} {formData.nomineeName ? `• ${formData.nomineeName}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live KYC & Onboarding Readiness Card */}
              <div className="bg-white/95 rounded-xl border border-amber-200/80 shadow-[0_4px_16px_rgba(124,36,24,0.05)] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#B44814]" />
                    <h3 className="text-[11.5px] font-bold text-[#4A1410]">प्रोफाइल व KYC पूर्णता</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#7C2418]">{profileCompletionPct}%</span>
                </div>

                <div className="w-full h-1.5 bg-amber-100/80 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${profileCompletionPct}%`,
                      background: 'linear-gradient(90deg, #B44814 0%, #D97706 55%, #10B981 100%)',
                    }}
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  {kycChecklist.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <span className={item.done ? 'text-[#4A1410] font-medium' : 'text-[#A8897C]'}>
                        {item.label}
                      </span>
                      {item.done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-200 shrink-0 mr-0.5" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Directory Summary Card */}
              <div className="bg-white/95 rounded-xl border border-amber-200/80 shadow-[0_4px_16px_rgba(124,36,24,0.05)] p-3.5 space-y-2">
                <div className="text-[10.5px] font-bold text-[#8C4A32] uppercase tracking-wider">
                  खातेदार रजिस्टर सारांश
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsListModalOpen(true)}
                    className="p-2 rounded-lg bg-[#FFFBF7] hover:bg-amber-50/90 border border-amber-200/75 hover:border-amber-300 text-left transition cursor-pointer"
                  >
                    <div className="text-[10px] text-[#8C5E4F] font-medium">एकूण नोंदणी</div>
                    <div className="text-sm font-mono font-bold text-[#4A1410]">{totalCustomersCount}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fetchPendingAgentRequests();
                      setIsRequestsModalOpen(true);
                    }}
                    className="p-2 rounded-lg bg-[#FFFBF7] hover:bg-amber-50/90 border border-amber-200/75 hover:border-amber-300 text-left transition cursor-pointer"
                  >
                    <div className="text-[10px] text-[#8C5E4F] font-medium">एजंट अर्ज</div>
                    <div className="text-sm font-mono font-bold text-[#B45309]">{pendingRequestsCount}</div>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </div>

      {/* 📷 LIVE CAMERA CAPTURE MODAL */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm">
                  {cameraMode === 'photo' && 'खातेदार फोटो कॅमेरा (Square 400x400)'}
                  {cameraMode === 'signature' && 'स्वाक्षरी कॅमेरा (Horizontal 600x200)'}
                  {cameraMode === 'aadhaarDoc' && 'आधार कार्ड कॅमेरा (800x500)'}
                  {cameraMode === 'panDoc' && 'पॅन कार्ड कॅमेरा (800x500)'}
                </span>
              </div>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-black flex items-center justify-center relative min-h-[300px]">
              {!capturedDataUrl ? (
                <video ref={videoRef} className="max-h-[350px] w-full object-contain rounded" autoPlay playsInline />
              ) : (
                <img src={capturedDataUrl} alt="Captured" className="max-h-[350px] object-contain rounded border-2 border-primary" />
              )}
            </div>

            <div className="p-3 bg-slate-100 flex justify-between items-center">
              <div className="flex gap-2">
                {!capturedDataUrl ? (
                  <button
                    type="button"
                    onClick={captureSnapshot}
                    className="px-5 py-1.5 bg-primary hover:opacity-90 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>फोटो काढा (Capture)</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setCapturedDataUrl(null)}
                      className="px-3 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded font-bold text-xs cursor-pointer"
                    >
                      पुन्हा काढा
                    </button>
                    <button
                      type="button"
                      disabled={isCapturing}
                      onClick={saveCapturedImage}
                      className="px-5 py-1.5 bg-primary hover:opacity-90 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isCapturing ? 'जतन होत आहे...' : 'हा फोटो वापरा (Save)'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 DOCUMENT FULL ZOOM MODAL */}
      {previewDocModal?.isOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
              <span className="font-bold text-sm">{previewDocModal.title}</span>
              <button onClick={() => setPreviewDocModal(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center max-h-[500px] overflow-auto">
              <img src={previewDocModal.docUrl} alt="Document Zoom" className="max-w-full max-h-[450px] object-contain rounded shadow" />
            </div>
          </div>
        </div>
      )}

      {/* 👥 CUSTOMER DIRECTORY & INSTANT SEARCH MODAL */}
      {isListModalOpen && (
        <div className="fixed inset-0 bg-stone-950/55 z-50 flex items-center justify-center p-1.5 sm:p-3 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-[98vw] w-full h-[92vh] flex flex-col overflow-hidden border border-amber-300/80">
            <div
              className="relative px-4 py-2 pt-2.5 text-[#4A1410] flex justify-between items-center shrink-0 border-b border-amber-200/90"
              style={{
                background: 'linear-gradient(125deg, #FCEAE4 0%, #FFF9F2 48%, #FCE0B8 100%)',
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
              />
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg text-white flex items-center justify-center shrink-0 shadow-xs"
                  style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                >
                  <Users className="w-4 h-4 text-white" />
                </div>
                <span className="font-extrabold text-xs sm:text-sm truncate text-[#4A1410]">
                  नोंदणीकृत खातेदार यादी व शोध
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/85 border border-amber-300/80 text-[#7C2418]">
                  एकूण: {totalCustomersCount} | शोध निकाल: {directoryTotalCount}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleHarmonizeCifs}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-md shadow-xs cursor-pointer flex items-center gap-1 border border-emerald-500/40 transition"
                  title="सर्व खातेदारांचे CIF क्रमांक सलग (Sequential) करा"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>CIF सिंक (Auto-Harmonize)</span>
                </button>
                <button
                  onClick={() => setIsListModalOpen(false)}
                  className="text-[#7C2418] hover:text-[#4A1410] hover:bg-amber-100/80 rounded-md p-1 cursor-pointer transition"
                  title="बंद करा"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-3 py-1.5 bg-gradient-to-r from-[#FDF2EE] via-[#FFFBF7] to-[#FEF3E2] border-b border-amber-200/80 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="w-3.5 h-3.5 text-[#B44814] absolute left-2.5 top-1.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="नाव, CIF, जुना लेगसी क्र., मोबाईल, आधार, पॅन किंवा गाव शोधा..."
                  className="w-full pl-8 pr-8 py-0.5 border border-amber-200 rounded-md text-[11px] focus:ring-1 focus:ring-[#B44814] focus:border-[#B44814] outline-none bg-white h-[26px]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1 text-[#8C5E4F] hover:text-[#4A1410] cursor-pointer"
                    title="शोध साफ करा"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {directoryLoading && (
                  <span className="text-[#9A3412] font-bold flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>लोड होत आहे...</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDirectorySortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    setDirectoryPage(1);
                  }}
                  className="px-2 py-0.5 bg-white hover:bg-amber-50 border border-amber-200 rounded-md font-bold text-[#4A1410] h-[26px] cursor-pointer shadow-2xs flex items-center gap-1 text-[10.5px]"
                  title="यादीची क्रमवारी बदला (१ पासून किंवा शेवटच्या नोंदीपासून)"
                >
                  <span>{directorySortDir === 'asc' ? '⬆️ १ पासून (जुने ➔ नवीन)' : '⬇️ शेवटून (नवीन ➔ जुने)'}</span>
                </button>
                <label className="font-bold text-[#6E493C] text-[10.5px]">प्रति पान:</label>
                <select
                  value={directoryPageSize}
                  onChange={e => {
                    setDirectoryPageSize(Number(e.target.value));
                    setDirectoryPage(1);
                  }}
                  className="border border-amber-200 rounded-md px-1.5 py-0.5 bg-white font-bold text-[#4A1410] h-[26px] outline-none cursor-pointer text-[10.5px]"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={0}>सर्व (All - {directoryTotalCount || totalCustomersCount})</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white">
              <table className="w-full text-left border-collapse text-[11px] leading-tight whitespace-nowrap">
                <thead>
                  <tr className="bg-[#5A1A14] text-amber-50 sticky top-0 font-bold z-20 text-[10.5px] tracking-wide">
                    <th className="py-1.5 px-2 text-center w-9 border-r border-white/10 sticky left-0 bg-[#5A1A14] z-30">अ.क्र.</th>
                    <th className="py-1.5 px-1.5 text-center w-8 border-r border-white/10">फोटो</th>
                    <th className="py-1.5 px-2 border-r border-white/10">CIF कोड</th>
                    <th className="py-1.5 px-2 border-r border-white/10 text-center">ID</th>
                    <th className="py-1.5 px-2 border-r border-white/10">जुना / लेगसी क्र.</th>
                    <th className="py-1.5 px-2 border-r border-white/10">सभासद क्र.</th>
                    <th className="py-1.5 px-2 border-r border-white/10">शाखा</th>
                    <th className="py-1.5 px-2 border-r border-white/10">खातेदाराचे पूर्ण नाव (मराठी)</th>
                    <th className="py-1.5 px-2 border-r border-white/10">इंग्रजी नाव (English)</th>
                    <th className="py-1.5 px-2 border-r border-white/10">टोपणनाव</th>
                    <th className="py-1.5 px-2 text-center border-r border-white/10">खाते सुरू दि.</th>
                    <th className="py-1.5 px-2 text-center border-r border-white/10">लिंग</th>
                    <th className="py-1.5 px-2 text-center border-r border-white/10">जन्म तारीख</th>
                    <th className="py-1.5 px-2 border-r border-white/10">प्रकार</th>
                    <th className="py-1.5 px-2 text-center border-r border-white/10">अल्पवयीन</th>
                    <th className="py-1.5 px-2 border-r border-white/10">प्रवर्ग</th>
                    <th className="py-1.5 px-2 border-r border-white/10">जात</th>
                    <th className="py-1.5 px-2 border-r border-white/10">व्यवसाय</th>
                    <th className="py-1.5 px-2 border-r border-white/10">मोबाईल नंबर</th>
                    <th className="py-1.5 px-2 border-r border-white/10">ईमेल</th>
                    <th className="py-1.5 px-2 border-r border-white/10">आधार नंबर</th>
                    <th className="py-1.5 px-2 border-r border-white/10">पॅन नंबर</th>
                    <th className="py-1.5 px-2 border-r border-white/10">CKYC क्र.</th>
                    <th className="py-1.5 px-2 text-center border-r border-white/10">KYC / जोखीम</th>
                    <th className="py-1.5 px-2 border-r border-white/10">पत्ता (मराठी)</th>
                    <th className="py-1.5 px-2 border-r border-white/10">गाव</th>
                    <th className="py-1.5 px-2 border-r border-white/10">तालुका</th>
                    <th className="py-1.5 px-2 border-r border-white/10">जिल्हा</th>
                    <th className="py-1.5 px-2 border-r border-white/10">संस्था / कर्मचारी कोड</th>
                    <th className="py-1.5 px-2 border-r border-white/10">वारसदार नाव</th>
                    <th className="py-1.5 px-2 border-r border-white/10">वारसदार नाते</th>
                    <th className="py-1.5 px-2 border-r border-white/10">वारसदार जन्म दि. / पत्ता</th>
                    <th className="py-1.5 px-2 border-r border-white/10">पालक (Guardian)</th>
                    <th className="py-1.5 px-2 text-center border-r border-white/10">कागदपत्रे</th>
                    <th className="py-1.5 px-2 text-center border-r border-white/10">स्टेटस</th>
                    <th className="py-1.5 px-2 text-center sticky right-0 bg-[#5A1A14] z-30 shadow-[-4px_0_8px_rgba(90,26,20,0.22)]">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/80">
                  {filteredCustomers.map((c, index) => {
                    const rowNo = directoryPageSize <= 0
                      ? index + 1
                      : (directoryPage - 1) * directoryPageSize + index + 1;
                    const marathiName = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ') || '-';
                    const englishName = [c.firstNameEng, c.middleNameEng, c.lastNameEng].filter(Boolean).join(' ') || '-';
                    const legacyNo = c.legacyCustomerNo || (c as any).LegacyCustomerNo || (c as any).oldMemberCode || (c as any).memberProfile?.oldMemberCode || '-';
                    const memberCode = (c as any).memberProfile?.memberCode || (c as any).memberProfile?.legacyMemberNo || '-';
                    const branchName = c.branch?.branchName || branches.find(b => b.branchID === c.branchID)?.branchName || (c.branchID ? `Branch #${c.branchID}` : '-');
                    const employerName = c.employerId
                      ? (employers.find(e => Number(e.employerId ?? e.employerID ?? e.id) === Number(c.employerId))?.employerName || `#${c.employerId}`)
                      : '';
                    const employerDisplay = [employerName, c.employeeCode ? `(${c.employeeCode})` : ''].filter(Boolean).join(' ') || '-';
                    const nomineeExtra = [
                      c.nomineeBirthDate ? new Date(c.nomineeBirthDate).toLocaleDateString('en-GB') : '',
                      c.nomineeIsMinor ? 'अल्पवयीन' : '',
                      c.nomineeAddress || ''
                    ].filter(Boolean).join(' | ') || '-';
                    const guardianDisplay = c.guardianName
                      ? [c.guardianName, c.guardianRelation ? `(${c.guardianRelation})` : '', c.guardianMobileNo || ''].filter(Boolean).join(' ')
                      : '-';
                    const kycStatus = c.kycStatus || 'Verified';
                    const riskCategory = c.riskCategory || 'Low';
                    const rowBgClass = index % 2 === 0 ? 'bg-white' : 'bg-[#FFFBF7]';

                    return (
                      <tr
                        key={c.customerID}
                        className={`h-[28px] ${rowBgClass} hover:bg-amber-50/80 transition-colors group`}
                      >
                        <td className={`py-1 px-2 text-center font-bold text-[#8C5E4F] border-r border-amber-100/80 sticky left-0 ${rowBgClass} group-hover:bg-amber-50/80 z-10`}>
                          {rowNo}
                        </td>
                        <td className="py-0.5 px-1.5 text-center border-r border-amber-100/80">
                          <button
                            type="button"
                            disabled={!c.photoPath}
                            onClick={() => c.photoPath && setPreviewDocModal({ isOpen: true, title: `${marathiName} - फोटो`, docUrl: c.photoPath })}
                            className={`w-5 h-5 mx-auto rounded-full bg-amber-100 overflow-hidden flex items-center justify-center border border-amber-300/80 ${c.photoPath ? 'cursor-pointer hover:ring-2 hover:ring-[#D97706]' : 'cursor-default'}`}
                            title={c.photoPath ? 'फोटो मोठा पहा' : 'फोटो अपलोड नाही'}
                          >
                            {c.photoPath ? (
                              <img src={c.photoPath} alt="P" className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-3 h-3 text-[#B88B75]" />
                            )}
                          </button>
                        </td>
                        <td className="py-1 px-2 font-black text-[#9A3412] border-r border-amber-100/80 font-mono">{c.cifNo || '-'}</td>
                        <td className="py-1 px-2 text-center font-semibold text-slate-600 border-r border-amber-100/80">#{c.customerID}</td>
                        <td className="py-1 px-2 font-semibold text-slate-700 border-r border-amber-100/80">{legacyNo}</td>
                        <td className="py-1 px-2 font-semibold text-[#7C2418] border-r border-amber-100/80">{memberCode}</td>
                        <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80 max-w-[130px] truncate" title={branchName}>
                          {branchName}
                        </td>
                        <td className="py-1 px-2 font-bold text-[#4A1410] border-r border-amber-100/80 max-w-[200px] truncate" title={marathiName}>
                          {marathiName}
                        </td>
                        <td className="py-1 px-2 text-slate-600 border-r border-amber-100/80 max-w-[180px] truncate" title={englishName}>
                          {englishName}
                        </td>
                        <td className="py-1 px-2 text-slate-600 border-r border-amber-100/80 max-w-[110px] truncate" title={c.nickName || '-'}>
                          {c.nickName || '-'}
                        </td>
                        <td className="py-1 px-2 text-center text-[#7C2418] font-semibold bg-amber-50/50 border-r border-amber-100/80">
                          {c.registrationDate ? new Date(c.registrationDate).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="py-1 px-2 text-center text-slate-700 border-r border-amber-100/80">{c.gender || '-'}</td>
                        <td className="py-1 px-2 text-center text-slate-700 border-r border-amber-100/80">
                          {c.birthDate ? new Date(c.birthDate).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80">
                          <span className="px-1.5 py-0.5 rounded bg-orange-50 text-[#9A3412] border border-orange-200/80 text-[10px] font-semibold">
                            {c.customerType || 'Individual'}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-center border-r border-slate-200/70">
                          {c.isMinor ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">होय</span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">नाही</span>
                          )}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200/70">
                          {c.casteCategory ? (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold border border-slate-200">
                              {c.casteCategory}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-1 px-2 text-slate-700 border-r border-slate-200/70">{c.caste || '-'}</td>
                        <td className="py-1 px-2 text-slate-700 border-r border-slate-200/70 max-w-[120px] truncate" title={c.occupation || '-'}>
                          {c.occupation || '-'}
                        </td>
                        <td className="py-1 px-2 font-bold text-[#7C2418] border-r border-amber-100/80 font-mono">{c.mobileNo || '-'}</td>
                        <td className="py-1 px-2 text-slate-600 border-r border-amber-100/80 max-w-[150px] truncate" title={c.email || '-'}>
                          {c.email || '-'}
                        </td>
                        <td className="py-1 px-2 text-slate-700 font-mono border-r border-amber-100/80">{c.aadhaarNo || '-'}</td>
                        <td className="py-1 px-2 font-mono font-bold text-slate-800 uppercase border-r border-amber-100/80">{c.panNo || '-'}</td>
                        <td className="py-1 px-2 font-mono text-slate-700 border-r border-amber-100/80">{c.ckycNo || '-'}</td>
                        <td className="py-1 px-2 text-center border-r border-amber-100/80">
                          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold mr-1 ${
                            kycStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {kycStatus}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                            riskCategory === 'High'
                              ? 'bg-red-100 text-red-700'
                              : riskCategory === 'Medium'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-orange-100 text-[#9A3412]'
                          }`}>
                            {riskCategory}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80 max-w-[180px] truncate" title={c.address || '-'}>
                          {c.address || '-'}
                        </td>
                        <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80 max-w-[120px] truncate" title={c.village || '-'}>
                          {c.village || '-'}
                        </td>
                        <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80 max-w-[110px] truncate" title={c.taluka || '-'}>
                          {c.taluka || '-'}
                        </td>
                        <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80 max-w-[110px] truncate" title={c.district || '-'}>
                          {c.district || '-'}
                        </td>
                        <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80 max-w-[150px] truncate" title={employerDisplay}>
                          {employerDisplay}
                        </td>
                        <td className="py-1 px-2 text-slate-800 font-medium border-r border-amber-100/80 max-w-[150px] truncate" title={c.nomineeName || '-'}>
                          {c.nomineeName || '-'}
                        </td>
                        <td className="py-1 px-2 text-slate-600 border-r border-amber-100/80">{c.nomineeRelation || '-'}</td>
                        <td className="py-1 px-2 text-slate-600 border-r border-amber-100/80 max-w-[160px] truncate" title={nomineeExtra}>
                          {nomineeExtra}
                        </td>
                        <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80 max-w-[160px] truncate" title={guardianDisplay}>
                          {guardianDisplay}
                        </td>
                        <td className="py-1 px-2 text-center border-r border-amber-100/80">
                          <div className="inline-flex items-center gap-1">
                            {c.signaturePath && (
                              <button
                                type="button"
                                onClick={() => setPreviewDocModal({ isOpen: true, title: `${marathiName} - सही`, docUrl: c.signaturePath! })}
                                className="px-1 py-0.5 rounded bg-orange-50 hover:bg-orange-100 text-[#9A3412] border border-orange-200 text-[9.5px] font-bold cursor-pointer"
                                title="सही पहा"
                              >
                                सही
                              </button>
                            )}
                            {c.aadhaarDocPath && (
                              <button
                                type="button"
                                onClick={() => setPreviewDocModal({ isOpen: true, title: `${marathiName} - आधार कार्ड`, docUrl: c.aadhaarDocPath! })}
                                className="px-1 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9.5px] font-bold cursor-pointer"
                                title="आधार डॉक्युमेंट पहा"
                              >
                                आधार
                              </button>
                            )}
                            {c.panDocPath && (
                              <button
                                type="button"
                                onClick={() => setPreviewDocModal({ isOpen: true, title: `${marathiName} - पॅन कार्ड`, docUrl: c.panDocPath! })}
                                className="px-1 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-[#B45309] border border-amber-200 text-[9.5px] font-bold cursor-pointer"
                                title="पॅन डॉक्युमेंट पहा"
                              >
                                पॅन
                              </button>
                            )}
                            {!c.signaturePath && !c.aadhaarDocPath && !c.panDocPath && (
                              <span className="text-slate-400 text-[10px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1 px-2 text-center border-r border-amber-100/80">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            c.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'Deceased'
                                ? 'bg-slate-200 text-slate-800'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className={`py-0.5 px-2 text-center sticky right-0 ${rowBgClass} group-hover:bg-amber-50/80 z-10 shadow-[-4px_0_8px_rgba(90,26,20,0.06)]`}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => setDoorstepModal({ isOpen: true, customerId: c.customerID, customerName: `${c.firstName} ${c.lastName}` })}
                              className="p-1 text-emerald-600 hover:bg-emerald-100/80 rounded transition cursor-pointer"
                              title="डोअरस्टेप वसुली व गोपनीयता परवानग्या (Doorstep Privacy & Collection Settings)"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEdit(c)}
                              className="p-1 text-[#9A3412] hover:bg-amber-100/80 rounded transition cursor-pointer"
                              title="एडिट करा"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.customerID)}
                              className="p-1 text-red-600 hover:bg-red-100/80 rounded transition cursor-pointer"
                              title="डिलीट करा"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={36} className="p-10 text-center text-[#8C5E4F]">
                        {directoryLoading ? (
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="w-7 h-7 animate-spin text-[#B44814]" />
                            <p className="font-semibold text-[#5A1A14]">खातेदार यादी लोड होत आहे...</p>
                          </div>
                        ) : (
                          <>
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="font-semibold">कोणताही खातेदार सापडला नाही.</p>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {(() => {
              const effectiveTotal = Math.max(directoryTotalCount, filteredCustomers.length);
              const totalPages = directoryPageSize <= 0 ? 1 : Math.max(1, Math.ceil(effectiveTotal / directoryPageSize));
              const startRow = effectiveTotal === 0 ? 0 : (directoryPageSize <= 0 ? 1 : (directoryPage - 1) * directoryPageSize + 1);
              const endRow = effectiveTotal === 0 ? 0 : (directoryPageSize <= 0 ? effectiveTotal : Math.min(directoryPage * directoryPageSize, effectiveTotal));

              // Build visible page numbers window (up to 7 buttons)
              const pageNumbers: number[] = [];
              const maxButtons = 7;
              let startPage = Math.max(1, directoryPage - 3);
              let endPage = Math.min(totalPages, startPage + maxButtons - 1);
              if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
              }
              for (let p = startPage; p <= endPage; p++) {
                pageNumbers.push(p);
              }

              return (
                <div className="px-4 py-2 bg-[#FFF8F1] border-t border-amber-200/90 flex flex-wrap justify-between items-center gap-2 shrink-0 text-[11px]">
                  <div className="font-bold text-[#5C3A2E] flex items-center gap-3">
                    {effectiveTotal > 0 ? (
                      <span>
                        दाखवत आहे: <span className="text-[#9A3412]">{startRow}</span> ते{' '}
                        <span className="text-[#9A3412]">{endRow}</span> (एकूण निकाल:{' '}
                        <span className="text-[#4A1410]">{effectiveTotal}</span>)
                      </span>
                    ) : (
                      <span>एकूण निकाल: 0</span>
                    )}
                    {customerStats.nextLegacyCustomerNo && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-black text-[10px]">
                        पुढील सुचवलेला जुना क्र.: {customerStats.nextLegacyCustomerNo}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={directoryPage <= 1 || directoryLoading || directoryPageSize <= 0}
                      onClick={() => setDirectoryPage(1)}
                      className="px-2.5 py-1 bg-white border border-amber-200 rounded font-bold text-[#5C3A2E] hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                      title="पहिल्या पानावर जा (First Page)"
                    >
                      ⏮️ पहिले
                    </button>
                    <button
                      type="button"
                      disabled={directoryPage <= 1 || directoryLoading || directoryPageSize <= 0}
                      onClick={() => setDirectoryPage(prev => Math.max(1, prev - 1))}
                      className="px-3 py-1 bg-white border border-amber-200 rounded font-bold text-[#5C3A2E] hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      ⬅️ मागील पान (Prev)
                    </button>

                    {totalPages > 1 && pageNumbers.map(pNum => (
                      <button
                        key={pNum}
                        type="button"
                        disabled={directoryLoading}
                        onClick={() => setDirectoryPage(pNum)}
                        className={`min-w-[28px] px-2 py-1 rounded font-black border cursor-pointer transition ${
                          pNum === directoryPage
                            ? 'bg-[#9A3412] text-white border-[#9A3412] shadow-xs'
                            : 'bg-white text-[#5C3A2E] border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        {pNum}
                      </button>
                    ))}

                    <span className="font-black text-[#4A1410] px-1.5">
                      पान क्र. {directoryPageSize <= 0 ? 1 : directoryPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={directoryPage >= totalPages || directoryLoading || directoryPageSize <= 0}
                      onClick={() => setDirectoryPage(prev => Math.min(totalPages, prev + 1))}
                      className="px-3 py-1 bg-white border border-amber-200 rounded font-bold text-[#5C3A2E] hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      पुढील पान (Next) ➡️
                    </button>
                    <button
                      type="button"
                      disabled={directoryPage >= totalPages || directoryLoading || directoryPageSize <= 0}
                      onClick={() => setDirectoryPage(totalPages)}
                      className="px-2.5 py-1 bg-white border border-amber-200 rounded font-bold text-[#5C3A2E] hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                      title="शेवटच्या पानावर जा (Last Page)"
                    >
                      शेवटचे ⏭️
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 📥 AGENT REQUESTS MODAL */}
      {isRequestsModalOpen && (
        <div className="fixed inset-0 bg-stone-950/55 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden border border-amber-300/80">
            <div
              className="px-4 py-2.5 text-white flex justify-between items-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-amber-200" />
                <span className="font-bold text-sm">एजंट मोबाईल ॲपवरून आलेले नवीन खातेदार अर्ज ({pendingRequests.length})</span>
              </div>
              <button onClick={() => setIsRequestsModalOpen(false)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3 bg-[#FFFBF7]">
              {pendingRequests.length === 0 ? (
                <div className="p-12 text-center text-[#8C5E4F]">
                  <Inbox className="w-12 h-12 mx-auto mb-2 opacity-30 text-amber-600" />
                  <p className="font-semibold">सध्या कोणताही प्रलंबित अर्ज नाही.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingRequests.map(req => (
                    <div key={req.requestID} className="border border-amber-200 rounded-xl p-3.5 bg-white flex flex-col justify-between shadow-2xs">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-sm text-[#4A1410]">{req.firstName} {req.middleName} {req.lastName}</span>
                          <span className="text-[10px] bg-amber-100 text-[#7C2418] font-bold px-2 py-0.5 rounded border border-amber-300">
                            {req.agentName || 'एजंट'}
                          </span>
                        </div>
                        <div className="text-xs text-[#6E493C] space-y-1">
                          <p>📱 मोबाईल: <span className="font-bold text-[#4A1410]">{req.mobileNo}</span></p>
                          <p>📍 गाव/पत्ता: {req.village || req.address || '-'}</p>
                          {req.openPigmyAccount && (
                            <p className="text-[#9A3412] font-bold">✨ पिग्मी ठेव खाते उघडण्याची विनंती (हप्ता: ₹{req.dailyDepositAmount})</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3 pt-2.5 border-t border-amber-200/80">
                        <button
                          type="button"
                          onClick={() => handleLoadAgentRequest(req)}
                          className="flex-1 py-1.5 text-white rounded-lg font-bold text-xs shadow-2xs hover:brightness-105 transition cursor-pointer"
                          style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                        >
                          अर्ज लोड करा (Load)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DECEASED CLAIM SETTLEMENT MODAL */}
      {isDeceasedModalOpen && (
        <DeceasedClaimSettlementModal
          isOpen={isDeceasedModalOpen}
          memberId={selectedDeceasedCustomerId}
          onClose={() => setIsDeceasedModalOpen(false)}
          onSettled={() => {
            setIsDeceasedModalOpen(false);
            fetchNextCif(editingId === null);
            if (isListModalOpen) {
              fetchCustomers(directoryPage, directoryPageSize, debouncedSearchQuery);
            }
          }}
        />
      )}

      {/* DOORSTEP PRIVACY & MULTI-PRODUCT PERMISSIONS MODAL */}
      {doorstepModal.isOpen && (
        <DoorstepPermissionsModal
          isOpen={doorstepModal.isOpen}
          customerId={doorstepModal.customerId}
          customerName={doorstepModal.customerName}
          onClose={() => setDoorstepModal({ isOpen: false, customerId: 0, customerName: '' })}
          onUpdated={() => {
            // Optional refresh
          }}
        />
      )}
    </div>
  );
}
