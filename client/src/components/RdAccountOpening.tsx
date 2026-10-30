import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import BankLedgerSelect from './common/BankLedgerSelect';
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  UserCheck,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  User,
  Info,
  CheckCircle,
  XCircle,
  Search,
  Printer,
  Trash2,
  PlusCircle,
  List,
  Save,
  CreditCard,
  Building,
  ShieldCheck,
  Sparkles,
  Users,
  UserPlus,
  Bookmark,
  RefreshCw
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import CustomerSearchSelect from './common/CustomerSearchSelect';

interface Member {
  customerID?: number;
  memberID: number;
  cifNo?: string;
  memberCode?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNo?: string;
}

interface RdScheme {
  rdSchemeID: number;
  schemeName: string;
  schemeCode: string;
  schemeCodeNumeric?: number;
  interestRate: number;
  durationMonths: number;
  installmentAmount: number;
  minimumInstallment?: number;
  maximumInstallment?: number;
  interestMethod?: string;
  branchID?: number | null;
  branch?: { branchID: number; branchName: string } | null;
}

interface Branch {
  branchID: number;
  branchName: string;
}

interface PigmyAgent {
  agentID: number;
  agentName: string;
  agentCode: string;
}

interface SavingAccountItem {
  savingAccountID: number;
  accountNo?: string;
  accountNumber?: string;
  currentBalance?: number;
  balance?: number;
  minimumBalance?: number;
  lienAmount?: number;
  availableBalance?: number;
}

interface RdAccountItem {
  rdAccountID: number;
  accountNo: string;
  formattedAccountNo?: string;
  legacyAccountNumber?: string;
  rdSchemeID?: number;
  memberName?: string;
  memberCode?: string;
  schemeName?: string;
  installmentAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  accountType?: string;
  jointMemberName?: string;
  paymentMode?: string;
  maturityInstruction?: string;
  passbookNo?: string;
  nomineeName?: string;
}

export interface RdAccountOpeningProps {
  voucherId?: number;
  isPassingMode?: boolean;
  onNavigate?: (tab: string) => void;
}

export default function RdAccountOpening({
  voucherId: propVoucherId,
  isPassingMode: propIsPassingMode,
  onNavigate
}: RdAccountOpeningProps = {}) {
  const urlParams = new URLSearchParams(window.location.search);
  const voucherIdFromUrl = urlParams.get('voucherId') ? parseInt(urlParams.get('voucherId')!) : undefined;
  const isPassingModeFromUrl = urlParams.get('passingMode') === 'true';

  const voucherId = propVoucherId || voucherIdFromUrl;
  const isPassingMode = propIsPassingMode || isPassingModeFromUrl;

  const [passingVoucherData, setPassingVoucherData] = useState<any | null>(null);
  const [passingLoading, setPassingLoading] = useState<boolean>(false);
  const [passingActionLoading, setPassingActionLoading] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [view, setView] = useState<'form' | 'list'>('form');
  const [members, setMembers] = useState<Member[]>([]);
  const [schemes, setSchemes] = useState<RdScheme[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [agents, setAgents] = useState<PigmyAgent[]>([]);
  const [savingAccounts, setSavingAccounts] = useState<SavingAccountItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Next account number preview
  const [nextAccountNo, setNextAccountNo] = useState('');
  const [loadingAccountNo, setLoadingAccountNo] = useState(false);

  // List view state
  const [rdList, setRdList] = useState<RdAccountItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [listError, setListError] = useState('');
  const [listSuccess, setListSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; accountNo: string } | null>(null);

  const { user } = useAuth();
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];

  // Schedule view state
  const [showSchedule, setShowSchedule] = useState(false);

  // Print modal state
  const [printAccount, setPrintAccount] = useState<RdAccountItem | null>(null);

  const [formData, setFormData] = useState({
    branchID: 1,
    memberID: '',
    rdSchemeID: '',
    accountType: 'Single', // Single, Joint, Minor
    jointMemberID: '',
    guardianName: '',
    guardianRelation: '',
    openingDate: activeBusinessDate,
    installmentAmount: 0,
    durationMonths: 12,
    interestRate: 8.0,
    maturityDate: '',
    maturityAmount: 0,
    paymentMode: 'Cash', // Cash, Bank, AutoDebit_Saving
    bankLedgerID: 0,
    savingAccountID: '',
    maturityInstruction: 'Cash_Payout', // Credit_Saving, Cash_Payout, Transfer_FD
    agentID: '',
    passbookNo: '',
    nomineeName: '',
    nomineeRelation: '',
    accountNo: '',
    legacyAccountNumber: '',
    remarks: 'नवीन आवर्ती ठेव खाते उघडले',
  });

  // Sync CBS Business Date if changed
  useEffect(() => {
    if (user?.businessDate) {
      setFormData(prev => ({
        ...prev,
        openingDate: user.businessDate.split('T')[0]
      }));
    }
  }, [user?.businessDate]);

  const [autoAccountNo, setAutoAccountNo] = useState('');
  const [isCustomAccountNo, setIsCustomAccountNo] = useState(false);


  const fetchNextAccountNo = async (branchId: number, schemeId?: string | number) => {
    if (isPassingMode) return;
    setLoadingAccountNo(true);
    try {
      const q = schemeId ? `?branchId=${branchId}&schemeId=${schemeId}&t=${Date.now()}` : `?branchId=${branchId}&t=${Date.now()}`;
      const res = await axios.get(`/api/RdAccounts/next-account-no${q}`);
      const rawNo = res.data?.accountNo || (typeof res.data === 'string' ? res.data : '');
      const formatted = res.data?.formattedAccountNo || rawNo || '---';
      setAutoAccountNo(rawNo);
      setNextAccountNo(formatted);
      if (!isCustomAccountNo && rawNo) {
        setFormData(prev => ({
          ...prev,
          accountNo: rawNo
        }));
      }
    } catch (err) {
      console.error('Error fetching next account number', err);
      setNextAccountNo('---');
    } finally {
      setLoadingAccountNo(false);
    }
  };

  const handleResetAccountNo = () => {
    setIsCustomAccountNo(false);
    setFormData(prev => ({
      ...prev,
      accountNo: autoAccountNo
    }));
  };

  const handleAccountNoChange = (val: string) => {
    setIsCustomAccountNo(true);
    setFormData(prev => ({
      ...prev,
      accountNo: val
    }));
  };

  const fetchSchemesForBranch = async (bId: number) => {
    try {
      const res = await axios.get(`/api/RdSchemes?branchId=${bId}`);
      const sList = Array.isArray(res.data) ? res.data : [];
      const active = sList.filter((s: any) => s && s.isActive);
      setSchemes(active);
      return active;
    } catch (err) {
      console.error('Error fetching RD schemes for branch', err);
      return [];
    }
  };

  useEffect(() => {
    if (isPassingMode && voucherId) {
      loadPassingVoucher(voucherId);
    }
  }, [isPassingMode, voucherId]);

  const loadPassingVoucher = async (vId: number) => {
    setPassingLoading(true);
    try {
      const res = await axios.get(`/api/RdAccounts/by-voucher/${vId}`);
      const { rdAccount, voucher } = res.data;
      setPassingVoucherData(voucher);

      if (rdAccount) {
        setNextAccountNo(rdAccount.accountNo);
        const bId = rdAccount.branchID || 1;
        fetchSchemesForBranch(bId);
        setFormData(prev => ({
          ...prev,
          branchID: rdAccount.branchID || 1,
          memberID: rdAccount.customerID?.toString() || '',
          rdSchemeID: rdAccount.rdSchemeID?.toString() || '',
          installmentAmount: rdAccount.installmentAmount,
          durationMonths: rdAccount.durationMonths,
          interestRate: rdAccount.interestRate,
          openingDate: rdAccount.openingDate ? rdAccount.openingDate.split('T')[0] : prev.openingDate,
          maturityDate: rdAccount.maturityDate ? rdAccount.maturityDate.split('T')[0] : '',
          maturityAmount: rdAccount.maturityAmount,
          nomineeName: rdAccount.nomineeName || '',
          nomineeRelation: rdAccount.nomineeRelation || '',
          remarks: rdAccount.remarks || '',
          paymentMode: rdAccount.paymentMode || 'Cash',
          bankLedgerID: Number(rdAccount.bankLedgerID || rdAccount.bankAccountLedgerID || 0),
          savingAccountID: rdAccount.savingAccountID?.toString() || ''
        }));
      }
    } catch (err: any) {
      console.error('Error loading RD voucher:', err);
      setError('व्हाउचरशी संबंधित आरडी माहिती लोड करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingLoading(false);
    }
  };

  const handlePassVoucher = async () => {
    if (!voucherId) return;
    if (!window.confirm('आपण खात्रीपूर्वक हे आवर्ती ठेव (RD) व्हाउचर मंजूर व पास करू इच्छिता?')) return;
    setPassingActionLoading(true);
    try {
      await axios.post('/api/VoucherPosting/Post', [voucherId]);
      alert('व्हाउचर यशस्वीरीत्या मंजूर व पास करण्यात आले!');
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      alert('व्हाउचर पास करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  const handleRejectVoucher = async () => {
    if (!voucherId) return;
    if (!rejectReason.trim()) {
      alert('कृपया नामंजूर / रद्द करण्याचे कारण नमूद करा.');
      return;
    }
    setPassingActionLoading(true);
    try {
      await axios.delete(`/api/VoucherPosting/${voucherId}?reason=${encodeURIComponent(rejectReason.trim())}`, {
        data: { reason: rejectReason.trim() }
      });
      alert('व्हाउचर यशस्वीरित्या नामंजूर / रद्द करण्यात आले!');
      setRejectModalOpen(false);
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      alert('व्हाउचर रद्द करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  const fetchCustomerSavingAccounts = async (cIdStr: string) => {
    if (!cIdStr) {
      setSavingAccounts([]);
      return;
    }
    try {
      const res = await axios.get(`/api/SavingAccounts?customerId=${cIdStr}`);
      const dataList = Array.isArray(res.data) ? res.data : [];
      setSavingAccounts(dataList);
      if (dataList.length > 0) {
        setFormData((prev) => ({ ...prev, savingAccountID: (dataList[0].savingAccountID ?? '').toString() }));
      }
    } catch (err) {
      console.error('Error fetching saving accounts', err);
      setSavingAccounts([]);
    }
  };

  const fetchRdList = async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await axios.get('/api/RdAccounts');
      setRdList(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Error fetching RD accounts list', err);
      setListError('आरडी खात्यांची यादी लोड करताना त्रुटी आली.');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        let memberIdStr = params.get('memberId') || params.get('customerId');
        if (!memberIdStr) {
          try {
            const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
            if (rawBridge) {
              sessionStorage.removeItem('cbs_active_customer_transfer');
              const bridgeData = JSON.parse(rawBridge);
              if (bridgeData) {
                memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : (bridgeData.customerId ? String(bridgeData.customerId) : null);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }

        // Fast-track targeted customer load (~20ms)
        if (memberIdStr) {
          const mId = parseInt(memberIdStr, 10);
          axios.get(`/api/Customers/${mId}`).then(singleRes => {
            if (singleRes.data && isMounted) {
              const c = singleRes.data;
              setMembers(prev => {
                if (prev.length <= 1) return [c];
                return prev;
              });
              setFormData(prev => ({ ...prev, memberID: mId.toString() }));
              fetchCustomerSavingAccounts(mId.toString());
            }
          }).catch(e => console.warn('Fast-track customer lookup error', e));
        }

        const [mRes, bRes, agRes] = await axios.all([
          axios.get('/api/Customers'),
          axios.get('/api/Branches'),
          axios.get('/api/PigmyAgents'),
        ]);
        if (!isMounted) return;
        const mList = Array.isArray(mRes.data) ? mRes.data : [];
        const bList = Array.isArray(bRes.data) ? bRes.data : [];
        const agList = Array.isArray(agRes.data) ? agRes.data : [];

        setMembers(mList);
        setBranches(bList);
        setAgents(agList);

        const defaultBranch = bList.length > 0 ? bList[0].branchID : 1;
        fetchNextAccountNo(defaultBranch);
        const sRes = await axios.get(`/api/RdSchemes?branchId=${defaultBranch}`);
        const sList = Array.isArray(sRes.data) ? sRes.data : [];
        setSchemes(sList.filter((s: any) => s && s.isActive));

        if (memberIdStr && mList.length > 0) {
          const mId = parseInt(memberIdStr, 10);
          const matchedMember = mList.find((m: any) => m && ((m.customerID || m.memberID) === mId));
          if (matchedMember && isMounted) {
            setFormData((prev) => ({
              ...prev,
              memberID: mId.toString()
            }));
            fetchCustomerSavingAccounts(mId.toString());
          }
        }
      } catch (err) {
        console.error('Error loading initial data', err);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (view === 'list') {
      const load = async () => {
        setListLoading(true);
        setListError('');
        try {
          const res = await axios.get('/api/RdAccounts');
          if (isMounted) {
            setRdList(Array.isArray(res.data) ? res.data : []);
          }
        } catch (err: any) {
          if (isMounted) {
            console.error('Error fetching RD accounts list', err);
            setListError('आरडी खात्यांची यादी लोड करताना त्रुटी आली.');
          }
        } finally {
          if (isMounted) {
            setListLoading(false);
          }
        }
      };
      load();
    }
    return () => {
      isMounted = false;
    };
  }, [view]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'branchID') {
      const bId = parseInt(value, 10) || 1;
      fetchNextAccountNo(bId, formData.rdSchemeID);
      fetchSchemesForBranch(bId);
    }

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: e.target.type === 'number' ? (value === '' ? '' : value) : value,
      };

      if (['openingDate', 'durationMonths', 'interestRate', 'installmentAmount'].includes(name)) {
        const dur = parseInt(String(updated.durationMonths), 10) || 0;
        if (name === 'openingDate' || name === 'durationMonths') {
          const opening = new Date(updated.openingDate);
          if (!isNaN(opening.getTime())) {
            opening.setMonth(opening.getMonth() + dur);
            updated.maturityDate = opening.toISOString().split('T')[0];
          }
        }
        
        // Recalculate maturity amount
        const inst = parseFloat(String(updated.installmentAmount)) || 0;
        const r = parseFloat(String(updated.interestRate)) || 0;
        const method = schemes.find((s) => s.rdSchemeID === parseInt(String(updated.rdSchemeID), 10))?.interestMethod || 'Compound';

        let totalMat = 0;
        if (method === 'Simple' || method === 'Flat') {
          let runningBalance = 0;
          let totalInterest = 0;
          for (let month = 1; month <= dur; month++) {
            runningBalance += inst;
            totalInterest += (runningBalance * r) / (12 * 100);
          }
          totalMat = runningBalance + totalInterest;
        } else {
          for (let k = 1; k <= dur; k++) {
            const monthsInBank = dur - k + 1;
            const factor = Math.pow(1.0 + (r / 400.0), monthsInBank / 3.0);
            totalMat += inst * factor;
          }
        }
        updated.maturityAmount = Math.round(totalMat);
      }
      return updated;
    });
  };

  const handleMemberSelect = (val: any) => {
    const mIdStr = val?.target?.value ?? val;
    setFormData((prev) => ({ ...prev, memberID: mIdStr }));
    fetchCustomerSavingAccounts(mIdStr);
  };

  const handleSchemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const schemeId = parseInt(e.target.value, 10);
    fetchNextAccountNo(formData.branchID || 1, schemeId || undefined);
    const selected = schemes.find((s) => s.rdSchemeID === schemeId);
    if (selected) {
      setFormData((prev) => {
        const inst = parseFloat(String(prev.installmentAmount)) || 0;
        const dur = selected.durationMonths;
        const r = selected.interestRate;

        // Auto Maturity Date
        const opening = new Date(prev.openingDate);
        opening.setMonth(opening.getMonth() + dur);
        const maturityDateStr = opening.toISOString().split('T')[0];

        // Maturity formula (Compound or Flat)
        const p = inst;
        const n = dur;
        const method = selected.interestMethod || 'Compound';

        let totalMat = 0;
        if (method === 'Simple' || method === 'Flat') {
          let runningBalance = 0;
          let totalInterest = 0;
          for (let month = 1; month <= n; month++) {
            runningBalance += p;
            totalInterest += (runningBalance * r) / (12 * 100);
          }
          totalMat = runningBalance + totalInterest;
        } else {
          for (let k = 1; k <= n; k++) {
            const monthsInBank = n - k + 1;
            const factor = Math.pow(1.0 + (r / 400.0), monthsInBank / 3.0);
            totalMat += p * factor;
          }
        }
        const expectedMaturity = Math.round(totalMat);

        return {
          ...prev,
          rdSchemeID: schemeId.toString(),
          durationMonths: dur,
          interestRate: r,
          maturityDate: maturityDateStr,
          maturityAmount: expectedMaturity,
        };
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        rdSchemeID: '',
        interestRate: 8.0,
        maturityDate: '',
        maturityAmount: 0,
      }));
    }
  };

  const resetForm = (keepMessages: boolean = false) => {
    setFormData({
      branchID: formData.branchID || 1,
      memberID: '',
      rdSchemeID: '',
      accountType: 'Single',
      jointMemberID: '',
      guardianName: '',
      guardianRelation: '',
      openingDate: activeBusinessDate,
      installmentAmount: 0,
      durationMonths: 12,
      interestRate: 8.0,
      maturityDate: '',
      maturityAmount: 0,
      paymentMode: 'Cash',
      bankLedgerID: 0,
      savingAccountID: '',
      maturityInstruction: 'Cash_Payout',
      agentID: '',
      passbookNo: '',
      nomineeName: '',
      nomineeRelation: '',
      accountNo: '',
      legacyAccountNumber: '',
      remarks: 'नवीन आवर्ती ठेव खाते उघडले',
    });
    setIsCustomAccountNo(false);
    setAutoAccountNo('');
    if (!keepMessages) {
      setError('');
      setSuccess('');
    }
    setSavingAccounts([]);
    fetchNextAccountNo(formData.branchID || 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberID) {
      setError('कृपया खातेदार निवडा.');
      return;
    }
    if (!formData.rdSchemeID) {
      setError('कृपया आरडी ठेव योजना निवडा.');
      return;
    }
    if (formData.accountType === 'Joint' && !formData.jointMemberID) {
      setError('कृपया संयुक्त खातेदाराची निवड करा.');
      return;
    }
    if (formData.paymentMode === 'AutoDebit_Saving') {
      if (!formData.savingAccountID) {
        setError('ऑटो-डेबिटसाठी कृपया खातेदाराचे बचत खाते निवडा.');
        return;
      }
      const selSb = (Array.isArray(savingAccounts) ? savingAccounts : []).find(
        (s) => Number(s.savingAccountID) === Number(formData.savingAccountID)
      );
      const firstInstAmt = parseFloat(formData.installmentAmount as any) || 0;
      if (selSb && firstInstAmt > 0) {
        const curBal = Number(selSb.currentBalance ?? selSb.balance ?? 0);
        const minBal = Number(selSb.minimumBalance ?? 0);
        const lienAmt = Number(selSb.lienAmount ?? 0);
        const availBal = Math.max(0, curBal - lienAmt - minBal);
        if (firstInstAmt > availBal) {
          setError(`संलग्न बचत खात्यात पहिल्या हप्त्यासाठी अपुरी वर्गपात्र शिल्लक! (किमान शिल्लक ₹${minBal.toFixed(2)} व तारण ₹${lienAmt.toFixed(2)} वगळून उपलब्ध: ₹${availBal.toFixed(2)}, आवश्यक हप्ता: ₹${firstInstAmt.toFixed(2)})`);
          return;
        }
      }
    }
    if (formData.paymentMode === 'Bank' && (!formData.bankLedgerID || Number(formData.bankLedgerID) <= 0)) {
      setError('बँक ट्रान्सफरसाठी कृपया बँक जी.एल. खाते (Bank GL Account) निवडा.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...formData,
        accountNo: isCustomAccountNo && formData.accountNo ? formData.accountNo.trim() : (autoAccountNo || 'AUTO'),
        legacyAccountNumber: formData.legacyAccountNumber ? formData.legacyAccountNumber.trim() : null,
        branchID: parseInt(formData.branchID as any, 10) || 1,
        customerID: parseInt(formData.memberID, 10),
        rdSchemeID: parseInt(formData.rdSchemeID, 10),
        jointCustomerID: formData.accountType === 'Joint' && formData.jointMemberID ? parseInt(formData.jointMemberID, 10) : null,
        bankLedgerID: formData.paymentMode === 'Bank' && Number(formData.bankLedgerID) > 0 ? Number(formData.bankLedgerID) : null,
        savingAccountID: formData.paymentMode === 'AutoDebit_Saving' && formData.savingAccountID ? parseInt(formData.savingAccountID, 10) : null,
        agentID: formData.agentID ? parseInt(formData.agentID, 10) : null,
        installmentAmount: parseFloat(formData.installmentAmount as any) || 0,
        durationMonths: parseInt(formData.durationMonths as any, 10) || 12,
        interestRate: parseFloat(formData.interestRate as any) || 0,
        maturityAmount: parseFloat(formData.maturityAmount as any) || 0,
      };
      const res = await axios.post('/api/RdAccounts', payload);
      const createdAccNo = res.data.accountNo || '';
      resetForm(true);
      setSuccess(`✅ नवीन आरडी खाते यशस्वीरीत्या सुरू झाले! खाते क्रमांक: ${createdAccNo}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const errText = typeof err.response?.data === 'string'
        ? err.response.data
        : err.response?.data?.message || 'नवीन आरडी खाते उघडताना त्रुटी आली.';
      setError(errText);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    try {
      await axios.delete(`/api/RdAccounts/${id}`);
      setListSuccess('आरडी खाते यशस्वीरीत्या हटवण्यात आले.');
      setDeleteConfirm(null);
      fetchRdList();
    } catch (err: any) {
      setListError('खाते हटवताना त्रुटी आली.');
    }
  };

  const filteredRdList = rdList.filter((item) => {
    const accMatch = item.accountNo?.toLowerCase().includes(listSearch.toLowerCase());
    const nameMatch = item.memberName?.toLowerCase().includes(listSearch.toLowerCase());
    const codeMatch = item.memberCode?.toLowerCase().includes(listSearch.toLowerCase());
    return accMatch || nameMatch || codeMatch;
  });

  // Calculate Breakdown
  const totalPrincipalDeposited = (formData.installmentAmount || 0) * (formData.durationMonths || 0);
  const estimatedInterestEarned = Math.max(0, (formData.maturityAmount || 0) - totalPrincipalDeposited);

  const generateSchedule = () => {
    if (!formData.installmentAmount || !formData.durationMonths || formData.installmentAmount <= 0) return [];
    
    const rows = [];
    let runningBalance = 0;
    const method = schemes.find(s => s.rdSchemeID === parseInt(String(formData.rdSchemeID), 10))?.interestMethod || 'Compound';
    const rate = formData.interestRate || 0;
    const opening = new Date(formData.openingDate);
    
    for (let i = 1; i <= formData.durationMonths; i++) {
      const rowDate = new Date(opening);
      rowDate.setMonth(rowDate.getMonth() + i - 1);
      
      const installmentVal = parseFloat(String(formData.installmentAmount)) || 0;
      runningBalance += installmentVal;
      
      let interest = 0;
      if (method === 'Simple' || method === 'Flat') {
        interest = (runningBalance * rate) / (12 * 100);
      } else {
        const monthsInBank = formData.durationMonths - i + 1;
        const factor = Math.pow(1.0 + (rate / 400.0), monthsInBank / 3.0);
        interest = (installmentVal * factor) - installmentVal;
      }
      
      rows.push({
        month: i,
        date: rowDate.toLocaleDateString('en-GB'),
        deposit: installmentVal,
        balance: runningBalance,
        interest: interest
      });
    }
    return rows;
  };

  const duplicateLegacyAccount = useMemo(() => {
    if (!formData.legacyAccountNumber || !formData.legacyAccountNumber.trim() || !formData.rdSchemeID) return null;
    const clean = formData.legacyAccountNumber.trim().toLowerCase();
    const sId = Number(formData.rdSchemeID);
    return rdList.find(r => 
      Number(r.rdSchemeID) === sId &&
      r.legacyAccountNumber && r.legacyAccountNumber.trim().toLowerCase() === clean
    );
  }, [formData.legacyAccountNumber, formData.rdSchemeID, rdList]);

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full px-2 py-1 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white font-medium";

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container Frame matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 flex flex-col mb-4">

        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
              <span>📋 नवीन आवर्ती ठेव खाते नोंदणी (New RD Account Opening Master)</span>
            </h2>
            <p className="text-[10px] text-blue-100 font-normal">नवीन आवर्ती ठेव खाते नोंदणी, हप्ता जमा आणि ऑटोमॅटिक पावती क्रमांक जनरेशन</p>
          </div>

          {/* View Switcher Buttons */}
          <div className="flex items-center gap-2">
            {!isPassingMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setView('form')}
                  className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                    view === 'form' 
                      ? 'bg-white text-primary font-bold border-white' 
                      : 'bg-blue-800/60 hover:bg-blue-800 text-white border-blue-400/40'
                  }`}
                >
                  <span>✍️ नवीन अर्ज (New Form)</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setView('list'); fetchRdList(); }}
                  className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                    view === 'list' 
                      ? 'bg-white text-primary font-bold border-white' 
                      : 'bg-blue-800/60 hover:bg-blue-800 text-white border-blue-400/40'
                  }`}
                >
                  <span>👁️ खाती यादी (Account List)</span>
                </button>
              </>
            ) : (
              <span className="bg-amber-400 text-slate-950 font-bold px-2.5 py-0.5 rounded text-xs flex items-center gap-1">
                🔒 व्हाउचर तपासणी मोड (Checker Mode)
              </span>
            )}
          </div>
        </div>

        {/* Checker Mode Amber Alert Banner */}
        {isPassingMode && (
          <div className="bg-amber-500 text-slate-950 p-3 mx-3 mt-3 rounded shadow-md border-2 border-amber-600 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-extrabold text-sm uppercase tracking-wide">
                  आवर्ती ठेव पावती व्हाउचर तपासणी (RD Opening Voucher Checker Mode)
                </div>
                <div className="text-xs text-amber-950 font-medium mt-0.5">
                  व्हाउचर क्र: <span className="font-mono font-bold">{passingVoucherData?.voucherNo || voucherId}</span> |
                  हप्ता रक्कम: <span className="font-bold">₹{passingVoucherData?.totalAmount?.toLocaleString('en-IN') || formData.installmentAmount}</span> |
                  तारीख: <span className="font-bold">{passingVoucherData?.voucherDate ? new Date(passingVoucherData.voucherDate).toLocaleDateString('mr-IN') : formData.openingDate}</span> |
                  स्थिती: <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold text-[10px]">{passingVoucherData?.status || 'Pending'}</span>
                </div>
              </div>
            </div>
            <div className="text-xs font-bold bg-amber-100 text-amber-950 px-2.5 py-1 rounded border border-amber-400">
              🔒 तपासणी मोड: फक्त वाचन अनुज्ञेय (Read Only Lockdown)
            </div>
          </div>
        )}

        <div className="p-3">
          {/* ==================== FORM VIEW ==================== */}
          {view === 'form' && (
        <div className="space-y-4">
          {/* Alert Messages */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-2 text-xs">
              <XCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="flex-1 font-medium">{error}</span>
              <button onClick={() => setError('')} className="font-bold text-slate-400 hover:text-slate-600">×</button>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-500 text-emerald-950 rounded-lg flex items-center gap-2.5 text-xs ring-2 ring-emerald-200 shadow-sm animate-in fade-in">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="flex-1 font-bold text-sm">{success}</span>
              <button onClick={() => setSuccess('')} className="font-bold text-emerald-700 hover:text-emerald-900 text-base cursor-pointer px-1">×</button>
            </div>
          )}

          {/* Main Form Card - Compact 2-Column CBS Layout */}
          <form onSubmit={handleSubmit} className="bg-white rounded-md shadow-xs border border-slate-200">
            <fieldset disabled={isPassingMode} className="contents">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3">
                {/* ================= LEFT COLUMN: Data Entry Fields (8 cols) ================= */}
                <div className="lg:col-span-8 space-y-2.5">
                  {/* Section 1: प्राथमिक व खातेदार माहिती */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded p-2.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">१</span>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          खातेदार व योजना तपशील (Customer & Scheme)
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-slate-500 font-semibold">आरडी क्र.:</span>
                        {loadingAccountNo ? (
                          <span className="text-indigo-600 font-bold animate-pulse text-[10px]">तयार होत आहे...</span>
                        ) : (
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[11px]">
                            {nextAccountNo || '---'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-3">
                        <label className={labelClass}>शाखा (Branch) <span className="text-red-500">*</span></label>
                        <select name="branchID" value={formData.branchID} onChange={handleChange} className={inputClass}>
                          {(Array.isArray(branches) ? branches : []).map((b, idx) => (
                            <option key={`branch-${b.branchID ?? '0'}-${idx}`} value={b.branchID}>{b.branchName}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-6">
                        <label className={labelClass}>खातेदार निवडा (Customer / CIF) <span className="text-red-500">*</span></label>
                        <CustomerSearchSelect
                          customers={members}
                          value={formData.memberID ? Number(formData.memberID) : ''}
                          onChange={(val) => handleMemberSelect(val ? String(val) : '')}
                          placeholder="-- CIF / नाव / मोबाईलने शोधा --"
                          isDisabled={isPassingMode}
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className={labelClass}>खाते प्रकार (Mode) <span className="text-red-500">*</span></label>
                        <select name="accountType" value={formData.accountType} onChange={handleChange} className={inputClass}>
                          <option value="Single">वैयक्तिक (Single)</option>
                          <option value="Joint">संयुक्त (Joint)</option>
                          <option value="Minor">अल्पवयीन (Minor)</option>
                        </select>
                      </div>
                    </div>

                    {/* Conditional Joint Member Selector */}
                    {formData.accountType === 'Joint' && (
                      <div className="p-2 bg-indigo-50/70 border border-indigo-200 rounded text-xs space-y-1">
                        <label className={labelClass}>संयुक्त खातेदार निवडा (Select Joint Customer) <span className="text-red-500">*</span></label>
                        <CustomerSearchSelect
                          customers={members.filter((m: any) => (m.customerID || m.memberID)?.toString() !== formData.memberID)}
                          value={formData.jointMemberID ? Number(formData.jointMemberID) : ''}
                          onChange={(val) => setFormData((prev) => ({ ...prev, jointMemberID: val ? String(val) : '' }))}
                          placeholder="-- दुसरा खातेदार (CIF / नाव / मोबाईलने शोधा) --"
                          isDisabled={isPassingMode}
                        />
                      </div>
                    )}

                    {/* Conditional Minor Guardian Fields */}
                    {formData.accountType === 'Minor' && (
                      <div className="p-2 bg-amber-50/80 border border-amber-200 rounded grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className={labelClass}>पालकाचे नाव (Guardian Name) <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            name="guardianName"
                            value={formData.guardianName}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="पालकाचे नाव"
                            required
                          />
                        </div>
                        <div>
                          <label className={labelClass}>पालकाचे नाते (Guardian Relation) <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            name="guardianRelation"
                            value={formData.guardianRelation}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="उदा. वडील, आई"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* Scheme, Duration, Rate */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-0.5">
                      <div className="sm:col-span-6">
                        <label className={labelClass}>आवर्ती ठेव योजना (RD Scheme) <span className="text-red-500">*</span></label>
                        <select name="rdSchemeID" value={formData.rdSchemeID} onChange={handleSchemeChange} className={inputClass}>
                          <option value="">--- योजना निवडा ---</option>
                          {(Array.isArray(schemes) ? schemes : []).map((s, idx) => (
                            <option key={`scheme-${s.rdSchemeID ?? '0'}-${idx}`} value={s.rdSchemeID}>
                              {s.schemeName} (कोड: {s.schemeCode || s.schemeCodeNumeric || 501})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className={labelClass}>कालावधी (महिने)</label>
                        <div className="relative">
                          <input
                            type="number"
                            name="durationMonths"
                            value={formData.durationMonths || ''}
                            readOnly
                            className={`${inputClass} bg-slate-100 font-bold text-slate-800 cursor-not-allowed`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">महिने</span>
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <label className={labelClass}>वार्षिक व्याजदर (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            name="interestRate"
                            value={formData.interestRate || ''}
                            readOnly
                            className={`${inputClass} bg-emerald-50 text-emerald-700 font-bold cursor-not-allowed`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600 font-bold">% p.a.</span>
                        </div>
                      </div>
                    </div>

                    {/* Account Number & Legacy Number Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-0.5">
                      <div className="sm:col-span-7">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className={labelClass}>
                            आरडी खाते क्रमांक (Account No) <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
                              isCustomAccountNo
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                            }`}>
                              {isCustomAccountNo ? 'कस्टम' : 'ऑटो'}
                            </span>
                            {isCustomAccountNo && (
                              <button
                                type="button"
                                onClick={handleResetAccountNo}
                                title="ऑटो नंबरवर रिसेट करा"
                                className="text-[9px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                              >
                                ↺ रीसेट
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="text"
                          name="accountNo"
                          value={formData.accountNo || autoAccountNo}
                          onChange={(e) => handleAccountNoChange(e.target.value)}
                          placeholder="उदा. 001-501-0000001-4"
                          disabled={isPassingMode}
                          className={`${inputClass} font-mono font-bold ${
                            isCustomAccountNo
                              ? 'border-amber-400 bg-amber-50/50 text-amber-900 focus:ring-amber-400'
                              : 'border-indigo-300 bg-indigo-50/30 text-indigo-900 focus:ring-indigo-400'
                          }`}
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className={labelClass}>
                            जुना आरडी क्र. (Legacy No)
                          </label>
                          <span className="text-[10px] text-slate-400 font-medium">पर्यायी</span>
                        </div>
                        <input
                          type="text"
                          name="legacyAccountNumber"
                          value={formData.legacyAccountNumber}
                          onChange={handleChange}
                          placeholder="उदा. RD-101 / 55"
                          disabled={isPassingMode}
                          className={`${inputClass} font-semibold ${
                            duplicateLegacyAccount
                              ? 'border-red-500 bg-red-50 text-red-900 focus:ring-red-400'
                              : 'border-slate-300 bg-white text-gray-900'
                          }`}
                        />
                        {duplicateLegacyAccount && (
                          <span className="text-[10px] text-red-600 font-bold block mt-0.5 leading-tight">
                            ⚠️ वापरलेला नंबर: {duplicateLegacyAccount.accountNo}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: हप्ता व भरणा तपशील */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">२</span>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        हप्ता व भरणा तपशील (Installment & Payment Setup)
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-4">
                        <label className={labelClass}>खाते उघडल्याची तारीख <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          name="openingDate"
                          value={formData.openingDate}
                          onChange={handleChange}
                          className={inputClass}
                          required
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className={labelClass}>मासिक हप्ता रक्कम (₹) <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          name="installmentAmount"
                          value={formData.installmentAmount || ''}
                          onChange={handleChange}
                          placeholder="उदा. 1000"
                          className={`${inputClass} font-mono font-bold text-slate-900`}
                          required
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className={labelClass}>हप्ता भरणा मोड <span className="text-red-500">*</span></label>
                        <select name="paymentMode" value={formData.paymentMode} onChange={handleChange} className={inputClass}>
                          <option value="Cash">💵 रोख (Cash)</option>
                          <option value="Bank">🏦 बँक ट्रान्सफर (Bank Transfer)</option>
                          <option value="AutoDebit_Saving">💳 बचत खात्यातून ऑटो-डेबिट (Auto-Debit)</option>
                        </select>
                      </div>
                    </div>

                    {/* Auto-Debit Linked Saving Account / Bank GL / Cash Badge Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-0.5">
                      {formData.paymentMode === 'AutoDebit_Saving' ? (
                        <div className="sm:col-span-6">
                          <label className={labelClass}>संलग्न बचत खाते (Linked SB Account) <span className="text-red-500">*</span></label>
                          <select name="savingAccountID" value={formData.savingAccountID} onChange={handleChange} className={inputClass} required>
                            <option value="">--- बचत खाते निवडा ---</option>
                            {(Array.isArray(savingAccounts) ? savingAccounts : []).map((s, idx) => {
                              const curBal = Number(s.currentBalance ?? s.balance ?? 0);
                              const minBal = Number(s.minimumBalance ?? 0);
                              const lienAmt = Number(s.lienAmount ?? 0);
                              const availBal = Math.max(0, curBal - lienAmt - minBal);
                              const accLabel = s.accountNo || s.accountNumber || `SB#${s.savingAccountID}`;
                              return (
                                <option key={`sav-${s.savingAccountID ?? '0'}-${idx}`} value={s.savingAccountID}>
                                  {accLabel} (शिल्लक: ₹{curBal.toLocaleString('en-IN')} | वर्गपात्र: ₹{availBal.toLocaleString('en-IN')} | किमान: ₹{minBal})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      ) : formData.paymentMode === 'Bank' ? (
                        <div className="sm:col-span-6 p-2 bg-blue-50/70 border border-blue-200 rounded">
                          <BankLedgerSelect
                            value={formData.bankLedgerID}
                            onChange={(id) => setFormData((prev) => ({ ...prev, bankLedgerID: id }))}
                            disabled={isPassingMode}
                            showCountBadge
                          />
                        </div>
                      ) : (
                        <div className="sm:col-span-6 flex items-center">
                          <CashLedgerReflectBadge 
                            branchId={formData.branchID} 
                            transactionType="Deposit" 
                            customTitle="रोख खाते (Cash Ledger)"
                          />
                        </div>
                      )}

                      <div className="sm:col-span-6">
                        <label className={labelClass}>मुदतपूर्ती सूचना (Maturity Instruction) <span className="text-red-500">*</span></label>
                        <select name="maturityInstruction" value={formData.maturityInstruction} onChange={handleChange} className={inputClass}>
                          <option value="Cash_Payout">रोख भरणा करा (Cash Payout)</option>
                          <option value="Credit_Saving">बचत खात्यात जमा करा (Credit to Saving)</option>
                          <option value="Transfer_FD">मुदत ठेवीत रुपांतर करा (Convert to FD)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: वारसदार, एजंट व पासबुक */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">३</span>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        वारसदार, एजंट व इतर (Nominee, Agent & Remarks)
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-4">
                        <label className={labelClass}>वारसदार नाव (Nominee Name)</label>
                        <input
                          type="text"
                          name="nomineeName"
                          value={formData.nomineeName}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="वारसदाराचे नाव"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className={labelClass}>वारस नाते (Relation)</label>
                        <select name="nomineeRelation" value={formData.nomineeRelation} onChange={handleChange} className={inputClass}>
                          <option value="">-- नाते निवडा --</option>
                          <option value="स्वतः">स्वतः (Self)</option>
                          <option value="पत्नी">पत्नी (Wife)</option>
                          <option value="पती">पती (Husband)</option>
                          <option value="पती/पत्नी">पती/पत्नी (Spouse)</option>
                          <option value="मुलगा">मुलगा (Son)</option>
                          <option value="मुलगी">मुलगी (Daughter)</option>
                          <option value="आई">आई (Mother)</option>
                          <option value="वडील">वडील (Father)</option>
                          <option value="भाऊ">भाऊ (Brother)</option>
                          <option value="बहीण">बहीण (Sister)</option>
                          <option value="सुन">सुन (Daughter-in-law)</option>
                          <option value="जावई">जावई (Son-in-law)</option>
                          <option value="नातू/नात">नातू / नात (Grandchild)</option>
                          <option value="इतर">इतर (Other)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className={labelClass}>हप्ता संकलन एजंट (Agent)</label>
                        <select name="agentID" value={formData.agentID} onChange={handleChange} className={inputClass}>
                          <option value="">-- एजंट (ऐच्छिक) --</option>
                          {(Array.isArray(agents) ? agents : []).map((a, idx) => (
                            <option key={`agent-${a.agentID ?? '0'}-${idx}`} value={a.agentID}>
                              {a.agentName} ({a.agentCode})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className={labelClass}>पासबुक क्र. (PB No)</label>
                        <input
                          type="text"
                          name="passbookNo"
                          value={formData.passbookNo}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="PB-101"
                        />
                      </div>
                    </div>

                    <div className="pt-0.5">
                      <label className={labelClass}>शेरा (Remarks)</label>
                      <input
                        type="text"
                        name="remarks"
                        value={formData.remarks}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="नोंद / शेरा लिहा"
                      />
                    </div>
                  </div>
                </div>

                {/* ================= RIGHT COLUMN: Live Calculation Widget & Action Bar (4 cols) ================= */}
                <div className="lg:col-span-4 flex flex-col gap-2.5">
                  {/* Sticky Financial Summary Card */}
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 border-2 border-emerald-500/30 rounded-lg p-3 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">📊</span>
                        <h3 className="font-extrabold text-xs text-emerald-950 uppercase tracking-wide">
                          थेट मुदतपूर्ती गणना (Maturity Calculation)
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">
                        Live CBS
                      </span>
                    </div>

                    {/* Big Hero Maturity Amount Display */}
                    <div className="bg-white rounded-md p-3 border border-emerald-200 text-center shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        एकूण मुदतपूर्ती रक्कम (Maturity Amount)
                      </span>
                      <div className="text-2xl font-black font-mono text-emerald-700 mt-0.5">
                        ₹ {formData.maturityAmount ? formData.maturityAmount.toLocaleString('en-IN') : '0'}
                      </div>
                      <div className="text-[11px] text-slate-600 font-semibold mt-1 flex items-center justify-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 inline" />
                        <span>मुदत तारीख: </span>
                        <strong className="text-slate-900 font-mono">
                          {formData.maturityDate || '---'}
                        </strong>
                      </div>
                    </div>

                    {/* Detailed Financial Breakdown Table */}
                    <div className="bg-white rounded-md border border-emerald-100 divide-y divide-emerald-50 text-xs">
                      <div className="flex items-center justify-between p-2">
                        <span className="text-slate-600 text-[11px]">एकूण जमा मुद्दल:</span>
                        <span className="font-mono font-bold text-slate-900">
                          ₹ {totalPrincipalDeposited.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 text-[10px] text-slate-500 bg-slate-50/50">
                        <span>हप्ता गणित:</span>
                        <span>{formData.durationMonths || 12} महिने × ₹{(formData.installmentAmount || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between p-2">
                        <span className="text-slate-600 text-[11px]">अंदाजित व्याज लाभ:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          + ₹ {estimatedInterestEarned.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 text-[10px] text-slate-500 bg-slate-50/50">
                        <span>व्याजदर / पद्धत:</span>
                        <span className="font-semibold text-emerald-700">
                          {formData.interestRate}% ({schemes.find(s => s.rdSchemeID === parseInt(String(formData.rdSchemeID), 10))?.interestMethod || 'Compound'})
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2">
                        <span className="text-slate-600 text-[11px]">भरणा पद्धत:</span>
                        <span className="font-semibold text-slate-800 text-[11px]">
                          {formData.paymentMode === 'Cash'
                            ? '💵 रोख भरणा'
                            : formData.paymentMode === 'Bank'
                              ? '🏦 बँक ट्रान्सफर'
                              : '💳 ऑटो-डेबिट (बचत)'}
                        </span>
                      </div>
                    </div>

                    {/* View Schedule Modal Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setShowSchedule(true)}
                      className="w-full py-1.5 px-3 bg-white hover:bg-emerald-100/70 text-emerald-800 font-bold border border-emerald-300 rounded text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                    >
                      <List className="w-3.5 h-3.5 text-emerald-700" />
                      <span>हप्ता व व्याज शेड्युल पहा (View Schedule)</span>
                    </button>
                  </div>

                  {/* Action Buttons Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
                    {isPassingMode ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={handlePassVoucher}
                          disabled={passingActionLoading}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <span>✅</span> {passingActionLoading ? 'मंजूर होत आहे...' : 'मंजूर व पास करा (Pass)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectModalOpen(true)}
                          disabled={passingActionLoading}
                          className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <span>❌</span> नामंजूर / रद्द करा
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting')}
                          className="w-full py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded text-xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>↩️</span> पासिंग यादीवर परत
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow-xs text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          <span>{loading ? 'जतन होत आहे...' : 'खाते उघडा (Open Account)'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => resetForm()}
                          className="w-full py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded text-xs transition cursor-pointer text-center"
                        >
                          फॉर्म रीसेट करा (Reset)
                        </button>

                        <div className="text-[10px] text-slate-500 flex items-start gap-1 pt-1 leading-tight">
                          <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                          <span>
                            {formData.paymentMode === 'AutoDebit_Saving'
                              ? 'पहिला हप्ता बचत खात्यातून ऑटो-डेबिट होऊन व्हाउचर तयार होईल.'
                              : formData.paymentMode === 'Bank'
                                ? 'पहिला हप्ता निवडलेल्या बँक जी.एल. खात्यात जमा होऊन पावती व्हाउचर तयार होईल.'
                                : 'पहिला हप्ता रोख जमा होऊन स्वयंचलित पावती व्हाउचर पोस्ट होईल.'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </fieldset>
          </form>
        </div>
      )}

      {/* ==================== LIST VIEW ==================== */}
      {view === 'list' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800">उघडलेल्या आरडी खात्यांची यादी (RD Accounts)</h2>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-full text-[10px] border border-indigo-100">
                {rdList.length}
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="खाते क्र. किंवा नाव शोधा..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {listError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span>{listError}</span>
            </div>
          )}

          {listSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{listSuccess}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3">खाते क्रमांक</th>
                  <th className="py-2.5 px-3">खातेदार नाव</th>
                  <th className="py-2.5 px-3">प्रकार</th>
                  <th className="py-2.5 px-3">योजना</th>
                  <th className="py-2.5 px-3 text-right">मासिक हप्ता (₹)</th>
                  <th className="py-2.5 px-3 text-center">व्याजदर (%)</th>
                  <th className="py-2.5 px-3 text-center">मुदतपूर्ती तारीख</th>
                  <th className="py-2.5 px-3 text-right">मुदतपूर्ती रक्कम (₹)</th>
                  <th className="py-2.5 px-3 text-center">स्थिती</th>
                  <th className="py-2.5 px-3 text-center">क्रिया (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {listLoading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      लोड होत आहे...
                    </td>
                  </tr>
                ) : filteredRdList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                      कोणतेही आरडी खाते सापडले नाही.
                    </td>
                  </tr>
                ) : (
                  filteredRdList.map((item) => (
                    <tr key={item.rdAccountID} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {(item as any).formattedAccountNo || (item.accountNo?.length === 14 ? `${item.accountNo.slice(0,3)}-${item.accountNo.slice(3,6)}-${item.accountNo.slice(6,13)}-${item.accountNo.slice(13)}` : item.accountNo)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        <div>{item.memberName || '-'}</div>
                        {item.jointMemberName && <div className="text-[10px] text-indigo-600 font-normal">संयुक्त: {item.jointMemberName}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                          {item.accountType === 'Joint' ? 'संयुक्त' : item.accountType === 'Minor' ? 'अल्पवयीन' : 'वैयक्तिक'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{item.schemeName || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                        ₹{item.installmentAmount?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                        {item.interestRate}%
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium">
                        {item.maturityDate ? new Date(item.maturityDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        ₹{item.maturityAmount?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 ${
                          item.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {item.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setPrintAccount(item)}
                            className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded transition"
                            title="पावती प्रिंट करा"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm({ id: item.rdAccountID, accountNo: item.accountNo })}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded transition"
                            title="खाते हटवा"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">खाते हटवण्याची खात्री करा (Delete Confirm)</h3>
            <p className="text-xs text-slate-600">
              तुम्हाला नक्की आरडी खाते क्रमांक <strong className="font-mono text-indigo-700">{deleteConfirm.accountNo}</strong> हटवायचे आहे का?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs"
              >
                रद्द करा
              </button>
              <button
                onClick={() => handleDeleteAccount(deleteConfirm.id)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-xs"
              >
                होय, हटवा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Passbook Modal */}
      {printAccount && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">आरडी खाते पावती (RD Account Certificate)</h3>
              </div>
              <button onClick={() => setPrintAccount(null)} className="text-slate-400 hover:text-slate-600 font-bold">×</button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">खाते क्रमांक:</span> <strong className="font-mono text-indigo-700">{printAccount.accountNo}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">खातेदार नाव:</span> <strong className="text-slate-800">{printAccount.memberName}</strong></div>
              {printAccount.jointMemberName && <div className="flex justify-between"><span className="text-slate-500">संयुक्त खातेदार:</span> <strong className="text-indigo-600">{printAccount.jointMemberName}</strong></div>}
              <div className="flex justify-between"><span className="text-slate-500">योजना:</span> <span>{printAccount.schemeName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">मासिक हप्ता:</span> <strong className="text-indigo-700">₹{printAccount.installmentAmount?.toLocaleString('en-IN')}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">व्याजदर:</span> <strong className="text-emerald-600">{printAccount.interestRate}%</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">मुदतपूर्ती तारीख:</span> <span>{printAccount.maturityDate ? new Date(printAccount.maturityDate).toLocaleDateString('en-IN') : '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">मुदतपूर्ती रक्कम:</span> <strong className="text-emerald-700">₹{printAccount.maturityAmount?.toLocaleString('en-IN')}</strong></div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPrintAccount(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs"
              >
                बंद करा
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>प्रिंट काढा (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}
        {/* Reject Confirmation Modal */}
        {rejectModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-2xl border border-gray-200 space-y-4">
              <div className="flex items-center gap-2 text-rose-600 border-b border-rose-100 pb-2">
                <span className="text-xl">❌</span>
                <h3 className="font-bold text-sm">आवर्ती ठेव (RD) व्हाउचर नामंजूर / रद्द करा</h3>
              </div>

              <p className="text-xs text-gray-600">
                व्हाउचर क्र. <strong className="text-gray-900 font-mono">{passingVoucherData?.voucherNo || voucherId}</strong> नामंजूर करण्याचे कारण खालीलप्रमाणे नोंदवा:
              </p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="नामंजूर / रद्द करण्याचे कारण प्रविष्ट करा..."
                rows={3}
                className="w-full text-xs border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500 font-sans"
                required
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  disabled={passingActionLoading}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  मागे फिरा
                </button>
                <button
                  type="button"
                  onClick={handleRejectVoucher}
                  disabled={passingActionLoading || !rejectReason.trim()}
                  className="px-4 py-1.5 text-xs font-bold rounded bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {passingActionLoading ? 'रद्द होत आहे...' : 'होय, व्हाउचर रद्द करा'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Modal Popup */}
        {showSchedule && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
              <div className="px-4 py-3 bg-emerald-700 text-white rounded-t-lg flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs flex items-center gap-1.5">
                    <span>📅 आरडी हप्ता व व्याज शेड्युल (RD Installment Schedule)</span>
                  </h3>
                  <p className="text-[10px] text-emerald-100 mt-0.5">
                    हप्ता: ₹{formData.installmentAmount?.toLocaleString('en-IN')} | कालावधी: {formData.durationMonths} महिने | व्याजदर: {formData.interestRate}% ({schemes.find(s => s.rdSchemeID === parseInt(String(formData.rdSchemeID), 10))?.interestMethod || 'Compound'})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSchedule(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-800 hover:bg-emerald-900 text-white text-base font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 overflow-y-auto max-h-[60vh]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-emerald-50 sticky top-0 border-b border-emerald-200 text-emerald-900 text-[11px]">
                    <tr>
                      <th className="px-2.5 py-1.5 font-bold">हप्ता क्र.</th>
                      <th className="px-2.5 py-1.5 font-bold">दिनांक</th>
                      <th className="px-2.5 py-1.5 font-bold text-right">जमा रक्कम (₹)</th>
                      <th className="px-2.5 py-1.5 font-bold text-right">नावे रक्कम</th>
                      <th className="px-2.5 py-1.5 font-bold text-right">एकूण शिल्लक (₹)</th>
                      <th className="px-2.5 py-1.5 font-bold text-right">व्याज (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50 text-[11px]">
                    {generateSchedule().map((row, idx) => (
                      <tr key={idx} className="hover:bg-emerald-50/40">
                        <td className="px-2.5 py-1 font-semibold text-slate-700">{row.month}</td>
                        <td className="px-2.5 py-1 text-slate-600">{row.date}</td>
                        <td className="px-2.5 py-1 text-right font-mono text-slate-800">{row.deposit?.toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-1 text-right font-mono text-slate-400">-</td>
                        <td className="px-2.5 py-1 text-right font-mono font-bold text-slate-900">{row.balance?.toLocaleString('en-IN')}</td>
                        <td className="px-2.5 py-1 text-right font-mono font-semibold text-emerald-700">{row.interest.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-emerald-100 font-bold border-t-2 border-emerald-300 text-emerald-950 text-xs">
                    <tr>
                      <td colSpan={2} className="px-2.5 py-2 text-right">एकूण (Total):</td>
                      <td className="px-2.5 py-2 text-right font-mono">₹{totalPrincipalDeposited.toLocaleString('en-IN')}</td>
                      <td colSpan={2} className="px-2.5 py-2 text-right font-mono text-emerald-900">
                        मुदतपूर्ती (Maturity): ₹{formData.maturityAmount?.toLocaleString('en-IN')}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-emerald-800">
                        + ₹{estimatedInterestEarned.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 rounded-b-lg flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSchedule(false)}
                  className="px-4 py-1.5 text-xs font-semibold rounded bg-slate-700 hover:bg-slate-800 text-white cursor-pointer"
                >
                  बंद करा (Close)
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
