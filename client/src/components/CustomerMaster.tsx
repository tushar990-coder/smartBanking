import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Search, X, Edit, Trash2, UserPlus, UserCheck, MapPin, FileText, Camera, 
  Check, Eye, RefreshCw, UserCheck2, ShieldAlert, Download, CreditCard, Sparkles, 
  Inbox, CheckCircle2, Clock, XCircle, AlertCircle, Plus, Phone, Calendar, 
  Layers, UploadCloud, Maximize2, ShieldCheck, FileBadge, RotateCcw, Award, CheckSquare,
  Building2, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { transliterateMarathi } from '../utils/transliterateMarathi';
import DeceasedClaimSettlementModal from './DeceasedClaimSettlementModal';

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
  legacyCustomerNo?: string;
}

interface Branch {
  branchID: number;
  branchCode: string;
  branchName: string;
}

export default function CustomerMaster() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employers, setEmployers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

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
    branchID: user?.branchID || 1,
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
    employerId: ''
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
    fetchCustomers();
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

  const fetchNextCif = async () => {
    try {
      const response = await fetch(`${API_URL}/next-cif`, { headers: getAuthHeaders() });
      if (response.ok && isMountedRef.current) {
        const text = await response.text();
        let generatedCif = '';
        try {
          const parsed = JSON.parse(text);
          generatedCif = parsed.nextCifNo || parsed.cifNo || parsed;
        } catch {
          generatedCif = text.replace(/^"|"$/g, '').trim();
        }

        if (generatedCif && typeof generatedCif === 'string' && isMountedRef.current) {
          setFormData(prev => ({
            ...prev,
            cifNo: generatedCif
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching next CIF:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch(API_URL, { headers: getAuthHeaders() });
      if (response.ok && isMountedRef.current) {
        const data = await response.json();
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
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
      const response = await fetch('/api/Upload', {
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

      const response = await fetch('/api/Upload', {
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
      const trimmedLegacy = formData.legacyCustomerNo.trim().toLowerCase();
      const duplicate = customers.find(c => c.customerID !== editingId && (c.legacyCustomerNo?.trim().toLowerCase() === trimmedLegacy || (c as any).LegacyCustomerNo?.trim().toLowerCase() === trimmedLegacy));
      if (duplicate) {
        alert(`हा जुना ग्राहक आयडी (${formData.legacyCustomerNo}) आधीच ग्राहक '${duplicate.firstName} ${duplicate.lastName}' (CIF: ${duplicate.cifNo}) साठी नोंदवला आहे.`);
        legacyCustomerNoInputRef.current?.focus();
        return;
      }
    }

    if (isMobileCompulsory && !formData.mobileNo?.trim()) {
      alert("मोबाईल नंबर अनिवार्य आहे.");
      return;
    }

    if (isAadhaarCompulsory && !formData.aadhaarNo?.trim()) {
      alert("आधार नंबर अनिवार्य आहे.");
      return;
    }

    if (isPanCompulsory && !formData.panNo?.trim()) {
      alert("पॅन नंबर अनिवार्य आहे.");
      return;
    }

    const payload: any = {
      ...formData,
      branchID: Number(formData.branchID),
      employerId: formData.employerId ? Number(formData.employerId) : null,
      birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
      registrationDate: formData.registrationDate ? new Date(formData.registrationDate).toISOString() : new Date().toISOString(),
      nomineeBirthDate: formData.nomineeBirthDate ? new Date(formData.nomineeBirthDate).toISOString() : null,
      isMinor: Boolean(formData.isMinor),
      nomineeIsMinor: Boolean(formData.nomineeIsMinor)
    };

    try {
      let response;
      if (editingId) {
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
        const targetCustomerId = editingId || savedCustomer.customerID;

        // If agent request was loaded, approve it
        if (selectedRequestId) {
          try {
            await fetch(`/api/AgentCustomerRequests/${selectedRequestId}/approve`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
              },
              body: JSON.stringify({ customerId: targetCustomerId })
            });
          } catch (e) {
            console.error("Error auto-approving agent request", e);
          }
        }

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

        alert(editingId ? "खातेदार माहिती यशस्वीरित्या अपडेट झाली!" : "नवीन खातेदार (CIF) यशस्वीरित्या सेव्ह झाला!");
        resetForm();
        fetchCustomers();
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

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.customerID);
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
      employerId: customer.employerId ? customer.employerId.toString() : ''
    });

    setIsListModalOpen(false);
    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        await fetchCustomers();
        await fetchNextCif();
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
      branchID: user?.branchID || 1,
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
      employerId: ''
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
        pigmySchemeID: req.pigmySchemeID ? String(req.pigmySchemeID) : (pigmySchemes.length > 0 ? String(pigmySchemes[0].pigmySchemeID) : ''),
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
        fetchCustomers();
        fetchNextCif();
      } else {
        alert("CIF सुसंगत करताना त्रुटी आली.");
      }
    } catch (e) {
      console.error(e);
      alert("सर्व्हरशी संपर्क साधताना त्रुटी आली.");
    }
  };

  const filteredCustomers = (customers || []).filter(c => {
    if (!c) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return true;
    const name = `${c.firstName || ''} ${c.middleName || ''} ${c.lastName || ''}`.toLowerCase();
    const engName = `${c.firstNameEng || ''} ${c.middleNameEng || ''} ${c.lastNameEng || ''}`.toLowerCase();
    const cif = (c.cifNo || '').toLowerCase();
    const mobile = (c.mobileNo || '').toLowerCase();
    const aadhaar = (c.aadhaarNo || '').toLowerCase();
    const pan = (c.panNo || '').toLowerCase();
    const village = (c.village || '').toLowerCase();
    const legacy = (c.legacyCustomerNo || (c as any).LegacyCustomerNo || '').toLowerCase();

    return (
      name.includes(q) ||
      engName.includes(q) ||
      cif.includes(q) ||
      mobile.includes(q) ||
      aadhaar.includes(q) ||
      pan.includes(q) ||
      village.includes(q) ||
      legacy.includes(q)
    );
  });

  // KPI Calculations
  const totalCustomersCount = customers.length;
  const activeCustomersCount = customers.filter(c => c.status === 'Active').length;
  const kycCompleteCount = customers.filter(c => c.aadhaarNo && c.panNo).length;
  const pendingRequestsCount = pendingRequests.length;

  // Real-time duplicate check for legacyCustomerNo
  const legacyDuplicate = React.useMemo(() => {
    if (!formData.legacyCustomerNo || !formData.legacyCustomerNo.trim()) return null;
    const trimmed = formData.legacyCustomerNo.trim().toLowerCase();
    return customers.find(c => c.customerID !== editingId && (c.legacyCustomerNo?.trim().toLowerCase() === trimmed || (c as any).LegacyCustomerNo?.trim().toLowerCase() === trimmed)) || null;
  }, [formData.legacyCustomerNo, customers, editingId]);

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* 🌟 Top Sleek CBS Header Banner (Matching FD Opening Balance Migration & Member Master) */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Users size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>ग्राहक / खातेदार नोंदणी मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Customer / CIF Master)</span>
              {editingId && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editingId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              नवीन खातेदार नोंदणी, CIF कोड वाटप, केवायसी (KYC) पडताळणी, छायाचित्र, स्वाक्षरी व कागदपत्रे व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {editingId && (
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
            onClick={() => {
              fetchPendingAgentRequests();
              setIsRequestsModalOpen(true);
            }}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold px-2.5 py-1 rounded-sm flex items-center gap-1.5 shadow-2xs transition-all relative border border-amber-500/40 cursor-pointer"
            title="मोबाईल ॲप / एजंट द्वारे आलेल्या नवीन ग्राहक विनंत्या"
          >
            <Download className="w-3.5 h-3.5 text-slate-900" />
            <span>📥 एजंट विनंत्या</span>
            {pendingRequests.length > 0 ? (
              <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-bounce shadow-xs">
                {pendingRequests.length}
              </span>
            ) : (
              <span className="bg-amber-500/40 text-slate-900 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                0
              </span>
            )}
          </button>

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
              fetchCustomers();
              setIsListModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व नोंदणीकृत खातेदार यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदणीकृत खातेदार यादी ({customers.length})</span>
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
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण खातेदार</div>
            <div className="text-sm font-black text-gray-900">{totalCustomersCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय खातेदार</div>
            <div className="text-sm font-black text-emerald-800">{activeCustomersCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">केवायसी पूर्ण</div>
            <div className="text-sm font-black text-indigo-950">{kycCompleteCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Inbox className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">प्रलंबित एजंट अर्ज</div>
            <div className="text-sm font-black text-amber-800">{pendingRequestsCount}</div>
          </div>
        </div>
      </div>

      {/* Agent Request Loaded Alert Banner */}
      {selectedRequestId && (
        <div className="mb-3 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 px-3.5 py-2 text-slate-950 flex items-center justify-between rounded-sm shadow-xs border border-amber-600/40 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-2xs">
              <Sparkles className="w-3 h-3 text-amber-300" />
              एजंट विनंती #{selectedRequestId}
            </span>
            <span className="text-xs font-bold text-slate-950">
              {loadedAgentName ? `${loadedAgentName} यांच्याकडून पाठवलेली ग्राहक माहिती फॉर्ममध्ये लोड केली आहे.` : 'एजंटने पाठवलेली माहिती फॉर्ममध्ये लोड केली आहे.'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearAgentRequest}
            className="bg-slate-900 hover:bg-black text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-xs cursor-pointer flex items-center gap-1 transition-colors"
          >
            ✕ विनंती रद्द करा
          </button>
        </div>
      )}

      {/* 📝 MAIN SINGLE UNIFIED FORM CONTAINER */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          editingId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* SECTION 1: बेसिक व वैयक्तिक माहिती */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">१. वैयक्तिक व सिस्टीम माहिती (Basic & Personal Details)</h2>
              </div>
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>शाखा (Branch) <span className="text-red-500">*</span></label>
                <select 
                  name="branchID" 
                  value={formData.branchID || 1} 
                  onChange={handleChange} 
                  required
                  className={inputClass}
                >
                  {branches.map(b => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName} ({b.branchCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>खातेदार कोड (Customer Code) <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="cifNo" 
                  value={formData.cifNo || ''} 
                  readOnly
                  className={`${inputClass} font-mono font-bold text-primary bg-slate-100 cursor-not-allowed`} 
                  placeholder="CIF001066" 
                />
              </div>

              <div>
                <label className={labelClass}>जुना आयडी / लेगसी क्र.</label>
                <input 
                  ref={legacyCustomerNoInputRef}
                  type="text" 
                  name="legacyCustomerNo" 
                  value={formData.legacyCustomerNo || ''} 
                  onChange={handleChange}
                  className={`${inputClass} ${legacyDuplicate ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-bold focus:ring-rose-500' : ''}`} 
                  placeholder="उदा. 1234" 
                />
                {legacyDuplicate && (
                  <span className="text-[10px] text-rose-600 font-bold block mt-0.5 animate-pulse">
                    ⚠️ हा आयडी आधीच {legacyDuplicate.firstName} {legacyDuplicate.lastName} (CIF: {legacyDuplicate.cifNo}) कडे नोंदवला आहे.
                  </span>
                )}
              </div>

              <div>
                <label className={labelClass}>स्टेटस (Status) <span className="text-red-500">*</span></label>
                <select 
                  name="status" 
                  value={formData.status} 
                  onChange={handleChange} 
                  required
                  className={`${inputClass} font-bold`}
                >
                  <option value="Active">🟢 सक्रिय (Active)</option>
                  <option value="Deactive">🟡 निष्क्रिय (Deactive)</option>
                  <option value="Mayat">🔴 मयत (Deceased)</option>
                </select>
              </div>
            </div>

            {/* Row 2: Marathi Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
              <div>
                <label className={labelClass}>पहिले नाव (मराठी) <span className="text-red-500">*</span></label>
                <input 
                  ref={firstNameInputRef}
                  type="text" 
                  name="firstName" 
                  value={formData.firstName} 
                  onChange={handleChange} 
                  required
                  className={`${inputClass} ${editingId ? 'bg-amber-50/60 font-semibold' : ''}`} 
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
                  placeholder="वडिलांचे नाव" 
                />
              </div>

              <div>
                <label className={labelClass}>आडनाव (मराठी) <span className="text-red-500">*</span></label>
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
                  placeholder="उदा. बंडू" 
                />
              </div>
            </div>

            {/* Row 3: English Names & Registration Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
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
                <label className={labelClass}>खाते सुरू दिनांक <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  name="registrationDate" 
                  value={formData.registrationDate} 
                  onChange={handleChange} 
                  required
                  className={`${inputClass} font-bold text-primary`} 
                />
              </div>
            </div>

            {/* Row 4: Demographics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 pt-1">
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
                  className={inputClass} 
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
                  placeholder="व्यवसाय" 
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
                  placeholder="उदा. मराठा, कुणबी" 
                />
              </div>

              <div className="flex items-center gap-1.5 pt-4">
                <input 
                  type="checkbox" 
                  id="isMinor" 
                  name="isMinor" 
                  checked={Boolean(formData.isMinor)} 
                  onChange={handleChange} 
                  className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="isMinor" className="text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  अज्ञान खातेदार (Is Minor)
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 2: संपर्क व पत्ता माहिती */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">२. संपर्क व पत्ता माहिती (Contact & Address Details)</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className={labelClass}>
                    मोबाईल नंबर {isMobileCompulsory ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(पर्यायी)</span>}
                  </label>
                  <label className="flex items-center gap-1 text-[9px] text-primary cursor-pointer font-bold select-none bg-blue-50 px-1 rounded border border-blue-200">
                    <input
                      type="checkbox"
                      checked={isMobileCompulsory}
                      onChange={e => setIsMobileCompulsory(e.target.checked)}
                      className="rounded border-gray-300 h-2.5 w-2.5 text-primary focus:ring-0 cursor-pointer"
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
                  className={inputClass}
                  placeholder={isMobileCompulsory ? "१० अंकी मोबाईल *" : "१० अंकी मोबाईल"}
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
                  placeholder="example@email.com" 
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
                  placeholder="तालुक्याचे नाव" 
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className={labelClass}>पत्ता (Address Marathi)</label>
                <input 
                  type="text" 
                  name="address" 
                  value={formData.address} 
                  onChange={handleChange}
                  className={inputClass} 
                  placeholder="मु. पो. पडवळवाडी, जि. सांगली" 
                />
              </div>

              <div>
                <label className={labelClass}>Address (English)</label>
                <input 
                  type="text" 
                  name="addressEng" 
                  value={formData.addressEng || ''} 
                  onChange={handleChange}
                  className={`${inputClass} capitalize`} 
                  placeholder="Address In English" 
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: केवायसी व ओळख कागदपत्रे */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">३. केवायसी व ओळख कागदपत्रे (KYC & Document Verification)</h2>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">कॅमेऱ्याने थेट स्कॅन करा किंवा कॉम्प्युटरमधून फाईल निवडा</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className={labelClass}>
                    आधार नंबर {isAadhaarCompulsory ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(पर्यायी)</span>}
                  </label>
                  <label className="flex items-center gap-1 text-[9px] text-primary cursor-pointer font-bold select-none bg-blue-50 px-1 rounded border border-blue-200">
                    <input
                      type="checkbox"
                      checked={isAadhaarCompulsory}
                      onChange={e => setIsAadhaarCompulsory(e.target.checked)}
                      className="rounded border-gray-300 h-2.5 w-2.5 text-primary focus:ring-0 cursor-pointer"
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
                  placeholder={isAadhaarCompulsory ? "१२ अंकी आधार (आवश्यक) *" : "१२ अंकी आधार"}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className={labelClass}>
                    पॅन नंबर {isPanCompulsory ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(पर्यायी)</span>}
                  </label>
                  <label className="flex items-center gap-1 text-[9px] text-primary cursor-pointer font-bold select-none bg-blue-50 px-1 rounded border border-blue-200">
                    <input
                      type="checkbox"
                      checked={isPanCompulsory}
                      onChange={e => setIsPanCompulsory(e.target.checked)}
                      className="rounded border-gray-300 h-2.5 w-2.5 text-primary focus:ring-0 cursor-pointer"
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
                  className={`${inputClass} uppercase font-mono font-bold`}
                  placeholder={isPanCompulsory ? "ABCDE1234F (आवश्यक) *" : "ABCDE1234F"}
                />
              </div>
            </div>

            {/* 4 Document Upload Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1.5 border-t border-gray-100">
              
              {/* 1. Photo Card */}
              <div className="bg-slate-50 p-2.5 rounded-sm border border-slate-200 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative w-12 h-12 bg-white rounded border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {formData.photoPath ? (
                      <img src={formData.photoPath} alt="Photo" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-800 truncate">१. खातेदार फोटो</label>
                    {formData.photoPath ? (
                      <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded font-bold">✓ सेव्ह</span>
                    ) : (
                      <span className="text-[9px] text-gray-500">अपलोड बाकी</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-1 border-t border-slate-200">
                  <label className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer flex-1 text-center shadow-2xs">
                    <span>📁 फाईल</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'photo')} />
                  </label>
                  <button
                    type="button"
                    onClick={() => startCamera('photo')}
                    className="bg-primary hover:opacity-90 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <Camera size={11} />
                    <span>कॅमेरा</span>
                  </button>
                  {formData.photoPath && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewDocModal({ isOpen: true, title: 'खातेदार फोटो (Customer Photo)', docUrl: formData.photoPath })}
                        className="bg-indigo-50 text-indigo-700 border border-indigo-200 p-0.5 rounded text-[10px] cursor-pointer"
                        title="पाहा"
                      >
                        <Eye size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, photoPath: '' }))}
                        className="bg-red-50 text-red-600 border border-red-200 p-0.5 rounded text-[10px] cursor-pointer"
                        title="काढा"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 2. Signature Card */}
              <div className="bg-slate-50 p-2.5 rounded-sm border border-slate-200 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative w-14 h-12 bg-white rounded border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {formData.signaturePath ? (
                      <img src={formData.signaturePath} alt="Signature" className="w-full h-full object-contain p-0.5" />
                    ) : (
                      <FileText className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-800 truncate">२. डिजिटल स्वाक्षरी</label>
                    {formData.signaturePath ? (
                      <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded font-bold">✓ सेव्ह</span>
                    ) : (
                      <span className="text-[9px] text-gray-500">अपलोड बाकी</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-1 border-t border-slate-200">
                  <label className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer flex-1 text-center shadow-2xs">
                    <span>📁 फाईल</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'signature')} />
                  </label>
                  <button
                    type="button"
                    onClick={() => startCamera('signature')}
                    className="bg-primary hover:opacity-90 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <Camera size={11} />
                    <span>स्कॅन</span>
                  </button>
                  {formData.signaturePath && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewDocModal({ isOpen: true, title: 'डिजिटल स्वाक्षरी (Signature)', docUrl: formData.signaturePath })}
                        className="bg-indigo-50 text-indigo-700 border border-indigo-200 p-0.5 rounded text-[10px] cursor-pointer"
                        title="पाहा"
                      >
                        <Eye size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, signaturePath: '' }))}
                        className="bg-red-50 text-red-600 border border-red-200 p-0.5 rounded text-[10px] cursor-pointer"
                        title="काढा"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 3. Aadhaar Document Card */}
              <div className="bg-slate-50 p-2.5 rounded-sm border border-slate-200 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative w-14 h-12 bg-white rounded border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {formData.aadhaarDocPath ? (
                      formData.aadhaarDocPath.toLowerCase().endsWith('.pdf') ? (
                        <span className="text-[9px] font-bold text-red-600">PDF</span>
                      ) : (
                        <img src={formData.aadhaarDocPath} alt="Aadhaar" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <span className="text-base">🪪</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-800 truncate">३. आधार कार्ड</label>
                    {formData.aadhaarDocPath ? (
                      <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded font-bold">✓ सेव्ह</span>
                    ) : (
                      <span className="text-[9px] text-gray-500">कागदपत्र बाकी</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-1 border-t border-slate-200">
                  <label className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer flex-1 text-center shadow-2xs">
                    <span>📁 फाईल</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'aadhaarDoc')} />
                  </label>
                  <button
                    type="button"
                    onClick={() => startCamera('aadhaarDoc')}
                    className="bg-primary hover:opacity-90 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <Camera size={11} />
                    <span>स्कॅन</span>
                  </button>
                  {formData.aadhaarDocPath && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewDocModal({ isOpen: true, title: 'आधार कार्ड डॉक्युमेंट (Aadhaar)', docUrl: formData.aadhaarDocPath })}
                        className="bg-indigo-50 text-indigo-700 border border-indigo-200 p-0.5 rounded text-[10px] cursor-pointer"
                        title="पाहा"
                      >
                        <Eye size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, aadhaarDocPath: '' }))}
                        className="bg-red-50 text-red-600 border border-red-200 p-0.5 rounded text-[10px] cursor-pointer"
                        title="काढा"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 4. PAN Document Card */}
              <div className="bg-slate-50 p-2.5 rounded-sm border border-slate-200 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative w-14 h-12 bg-white rounded border border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {formData.panDocPath ? (
                      formData.panDocPath.toLowerCase().endsWith('.pdf') ? (
                        <span className="text-[9px] font-bold text-red-600">PDF</span>
                      ) : (
                        <img src={formData.panDocPath} alt="PAN" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <span className="text-base">💳</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-800 truncate">४. पॅन कार्ड</label>
                    {formData.panDocPath ? (
                      <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded font-bold">✓ सेव्ह</span>
                    ) : (
                      <span className="text-[9px] text-gray-500">कागदपत्र बाकी</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-1 border-t border-slate-200">
                  <label className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer flex-1 text-center shadow-2xs">
                    <span>📁 फाईल</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'panDoc')} />
                  </label>
                  <button
                    type="button"
                    onClick={() => startCamera('panDoc')}
                    className="bg-primary hover:opacity-90 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <Camera size={11} />
                    <span>स्कॅन</span>
                  </button>
                  {formData.panDocPath && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewDocModal({ isOpen: true, title: 'पॅन कार्ड डॉक्युमेंट (PAN)', docUrl: formData.panDocPath })}
                        className="bg-indigo-50 text-indigo-700 border border-indigo-200 p-0.5 rounded text-[10px] cursor-pointer"
                        title="पाहा"
                      >
                        <Eye size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, panDocPath: '' }))}
                        className="bg-red-50 text-red-600 border border-red-200 p-0.5 rounded text-[10px] cursor-pointer"
                        title="काढा"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 4: अज्ञान खातेदार पालकाची माहिती (Conditional if isMinor) */}
          {formData.isMinor && (
            <div className="bg-amber-50/80 p-3.5 rounded-sm border border-amber-300 space-y-2.5">
              <div className="flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
                <UserCheck className="w-4 h-4 text-amber-700" />
                <h2 className="text-xs font-bold text-amber-900">४. अज्ञान खातेदार पालकाची माहिती (Guardian Details)</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelClass}>पालकाचे नाव (मराठी) <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    name="guardianName" 
                    value={formData.guardianName || ''} 
                    onChange={handleChange} 
                    required={Boolean(formData.isMinor)}
                    className={inputClass} 
                    placeholder="पालकाचे नाव (मराठी)" 
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
                    placeholder="Guardian Name in English" 
                  />
                </div>

                <div>
                  <label className={labelClass}>पालकाचे नाते (Relation) <span className="text-red-500">*</span></label>
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
                    className={inputClass} 
                    placeholder="१० अंकी मोबाईल" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
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
          )}

          {/* SECTION 5: वारसदार माहिती */}
          <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">५. वारसदार माहिती (Nominee Details)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>वारसदाराचे नाव (Marathi)</label>
                <input 
                  type="text" 
                  name="nomineeName" 
                  value={formData.nomineeName} 
                  onChange={handleChange}
                  className={inputClass} 
                  placeholder="वारसदाराचे नाव" 
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
                  placeholder="Nominee Name In English" 
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
                <label className={labelClass}>वारसदाराचा पत्ता (Nominee Address)</label>
                <input 
                  type="text" 
                  name="nomineeAddress" 
                  value={formData.nomineeAddress || ''} 
                  onChange={handleChange}
                  className={inputClass} 
                  placeholder="वारसदाराचा पत्ता" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
              <div>
                <label className={labelClass}>वारसदाराची जन्मतारीख</label>
                <input 
                  type="date" 
                  name="nomineeBirthDate" 
                  value={formData.nomineeBirthDate || ''} 
                  onChange={handleChange}
                  className={inputClass} 
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input 
                  type="checkbox" 
                  id="nomineeIsMinor" 
                  name="nomineeIsMinor" 
                  checked={formData.nomineeIsMinor || false} 
                  onChange={handleChange} 
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="nomineeIsMinor" className="text-[11px] font-bold text-gray-800 cursor-pointer select-none">
                  वारसदार अज्ञान (Minor) आहे?
                </label>
              </div>

              {formData.nomineeIsMinor && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>अज्ञान वारसदाराच्या पालकाचे नाव (Guardian Name)</label>
                  <input 
                    type="text" 
                    name="nomineeGuardianName" 
                    value={formData.nomineeGuardianName || ''} 
                    onChange={handleChange}
                    className={`${inputClass} border-amber-300 bg-amber-50/50`} 
                    placeholder="पालकाचे पूर्ण नाव" 
                  />
                </div>
              )}
            </div>
          </div>

          {/* SECTION 6: सोबत पिग्मी दैनिक बचत खाते सुरू करणे (Simultaneous Pigmy Account Opening) */}
          <div className="bg-emerald-50/70 p-3.5 rounded-sm border border-emerald-300 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-200 pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pigmyFormData.openPigmyAccount}
                  onChange={(e) => setPigmyFormData(p => ({ ...p, openPigmyAccount: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  <span>६. सोबत पिग्मी दैनिक बचत खाते उघडा (Open Pigmy Account Simultaneously)</span>
                </span>
              </label>
              {pigmyFormData.openPigmyAccount && (
                <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-sm">
                  ✓ ग्राहकासोबत पिग्मी खातेही उघडले जाईल
                </span>
              )}
            </div>

            {pigmyFormData.openPigmyAccount && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 animate-in fade-in duration-200">
                <div>
                  <label className={labelClass}>पिग्मी प्रतिनिधी (Pigmy Agent) <span className="text-red-500">*</span></label>
                  <select
                    value={pigmyFormData.pigmyAgentID}
                    onChange={(e) => setPigmyFormData(p => ({ ...p, pigmyAgentID: e.target.value }))}
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
                  <label className={labelClass}>पिग्मी योजना (Pigmy Scheme) <span className="text-red-500">*</span></label>
                  <select
                    value={pigmyFormData.pigmySchemeID}
                    onChange={(e) => setPigmyFormData(p => ({ ...p, pigmySchemeID: e.target.value }))}
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
                  <label className={labelClass}>दैनिक हप्ता लक्ष्य (Daily Target ₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={pigmyFormData.dailyDepositAmount}
                    onChange={(e) => setPigmyFormData(p => ({ ...p, dailyDepositAmount: parseFloat(e.target.value) || 0 }))}
                    className={`${inputClass} text-right font-mono font-bold text-emerald-800`}
                    placeholder="₹ 100"
                  />
                </div>

                <div>
                  <label className={labelClass}>प्रारंभिक जमा (Initial Deposit ₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={pigmyFormData.initialDepositAmount}
                    onChange={(e) => setPigmyFormData(p => ({ ...p, initialDepositAmount: parseFloat(e.target.value) || 0 }))}
                    className={`${inputClass} text-right font-mono`}
                    placeholder="₹ 0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Action Buttons (Matching CBS Layout) */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{editingId ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => handleDelete(Number(editingId))}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-sm text-xs border border-red-300 cursor-pointer shadow-2xs flex items-center gap-1 transition"
                title="हा खातेदार डिलीट करा"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>खातेदार डिलीट करा</span>
              </button>
            )}

            <button
              type="submit"
              className={`px-6 py-2 ${
                editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>{editingId ? '✏️ खातेदार अपडेट करा' : '💾 नवीन खातेदार (CIF) सेव्ह करा'}</span>
            </button>
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
                  {cameraMode === 'photo' && 'ग्राहक फोटो कॅमेरा (Square 400x400)'}
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded shadow-2xl max-w-[96vw] w-full h-[90vh] flex flex-col overflow-hidden border border-slate-300">
            <div className="px-4 py-2.5 bg-primary text-white flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-300" />
                <span className="font-bold text-sm sm:text-base">
                  नोंदणीकृत खातेदार यादी व शोध (एकूण खातेदार: {customers.length} | शोध निकाल: {filteredCustomers.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleHarmonizeCifs}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-sm shadow-xs cursor-pointer flex items-center gap-1 border border-emerald-500"
                  title="सर्व खातेदारांचे CIF क्रमांक सलग (Sequential) करा"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>CIF सिंक (Auto-Harmonize)</span>
                </button>
                <button onClick={() => setIsListModalOpen(false)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2.5 shrink-0">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="नाव, CIF, जुना लेगसी क्र., मोबाईल, आधार, पॅन, जात, प्रवर्ग किंवा पत्ता..."
                  className="w-full pl-8 pr-3 py-1 border border-slate-300 rounded text-[11px] focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white h-[28px]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2">
              <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 sticky top-0 font-bold shadow-xs z-10">
                    <th className="p-2 text-center w-12">अ.क्र.</th>
                    <th className="p-2 text-center w-10">फोटो</th>
                    <th className="p-2">CIF कोड</th>
                    <th className="p-2">ग्राहक ID</th>
                    <th className="p-2">जुना / लेगसी क्र.</th>
                    <th className="p-2 min-w-[180px]">खातेदाराचे पूर्ण नाव</th>
                    <th className="p-2 text-center">खाते सुरू दिनांक</th>
                    <th className="p-2 text-center">जन्म तारीख</th>
                    <th className="p-2">प्रवर्ग / वर्गवारी</th>
                    <th className="p-2">जात</th>
                    <th className="p-2">व्यवसाय</th>
                    <th className="p-2">मोबाईल नंबर</th>
                    <th className="p-2">आधार नंबर</th>
                    <th className="p-2">पॅन नंबर</th>
                    <th className="p-2 min-w-[160px]">पत्ता / गाव</th>
                    <th className="p-2">वारसदार व नाते</th>
                    <th className="p-2 text-center">स्टेटस</th>
                    <th className="p-2 text-center sticky right-0 bg-slate-100 shadow-l">कृती</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c, index) => (
                    <tr key={c.customerID} className="border-b border-slate-100 hover:bg-blue-50/50 transition">
                      <td className="p-2 text-center font-bold text-slate-500 bg-slate-50/60">
                        {index + 1}
                      </td>
                      <td className="p-1.5 text-center">
                        <div className="w-7 h-7 mx-auto rounded-full bg-slate-200 overflow-hidden flex items-center justify-center border border-slate-300 shadow-2xs">
                          {c.photoPath ? (
                            <img src={c.photoPath} alt="P" className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="p-2 font-black text-primary">{c.cifNo}</td>
                      <td className="p-2 font-bold text-slate-700">#{c.customerID}</td>
                      <td className="p-2 font-semibold text-slate-700">
                        {c.legacyCustomerNo || (c as any).LegacyCustomerNo || (c as any).oldMemberCode || (c as any).memberProfile?.oldMemberCode || '-'}
                      </td>
                      <td className="p-2 font-bold text-slate-800">
                        {c.firstName} {c.middleName} {c.lastName}
                        {c.firstNameEng && (
                          <span className="block text-[10px] text-slate-500 font-normal">
                            {c.firstNameEng} {c.lastNameEng}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-center text-blue-900 font-bold bg-blue-50/40">
                        {c.registrationDate ? new Date(c.registrationDate).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="p-2 text-center text-slate-600 font-medium">
                        {c.birthDate ? new Date(c.birthDate).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="p-2">
                        {c.casteCategory ? (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold border border-slate-200">
                            {c.casteCategory}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-2 text-slate-700">{c.caste || '-'}</td>
                      <td className="p-2 text-slate-700 font-medium">{c.occupation || '-'}</td>
                      <td className="p-2 font-bold text-blue-700">{c.mobileNo || '-'}</td>
                      <td className="p-2 text-slate-600 font-mono text-[11px]">{c.aadhaarNo || '-'}</td>
                      <td className="p-2 font-mono font-bold text-slate-700 uppercase text-[11px]">{c.panNo || '-'}</td>
                      <td className="p-2 text-slate-600 max-w-[200px] truncate" title={c.address ? `${c.address}${c.village ? ', ' + c.village : ''}` : (c.village || '-')}>
                        {c.address ? `${c.address}${c.village ? ', ' + c.village : ''}` : (c.village || '-')}
                      </td>
                      <td className="p-2 text-slate-700 font-medium">
                        {c.nomineeName ? (
                          <span>
                            {c.nomineeName} {c.nomineeRelation && <span className="text-[10px] text-slate-500 font-normal">({c.nomineeRelation})</span>}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-2 text-center sticky right-0 bg-white shadow-l">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(c)}
                            className="p-1 text-primary hover:bg-primary/10 rounded transition cursor-pointer"
                            title="एडिट करा"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.customerID)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="डिलीट करा"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={16} className="p-10 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">कोणताही खातेदार सापडला नाही.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 📥 AGENT REQUESTS MODAL */}
      {isRequestsModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden border border-slate-300">
            <div className="px-4 py-2.5 bg-primary text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-amber-300" />
                <span className="font-bold text-sm">एजंट मोबाईल ॲपवरून आलेले नवीन खातेदार अर्ज ({pendingRequests.length})</span>
              </div>
              <button onClick={() => setIsRequestsModalOpen(false)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3">
              {pendingRequests.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Inbox className="w-12 h-12 mx-auto mb-2 opacity-30 text-amber-600" />
                  <p className="font-semibold">सध्या कोणताही प्रलंबित अर्ज नाही.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingRequests.map(req => (
                    <div key={req.requestID} className="border border-amber-200 rounded-sm p-3.5 bg-amber-50/40 flex flex-col justify-between shadow-2xs">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-sm text-slate-800">{req.firstName} {req.middleName} {req.lastName}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-300">
                            {req.agentName || 'एजंट'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                          <p>📱 मोबाईल: <span className="font-bold text-slate-800">{req.mobileNo}</span></p>
                          <p>📍 गाव/पत्ता: {req.village || req.address || '-'}</p>
                          {req.openPigmyAccount && (
                            <p className="text-primary font-bold">✨ पिग्मी ठेव खाते उघडण्याची विनंती (हप्ता: ₹{req.dailyDepositAmount})</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3 pt-2.5 border-t border-amber-200">
                        <button
                          type="button"
                          onClick={() => handleLoadAgentRequest(req)}
                          className="flex-1 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm font-bold text-xs shadow-2xs transition cursor-pointer"
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
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}
